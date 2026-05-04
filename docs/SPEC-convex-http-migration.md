# SPEC: Convex HTTP → Native Migration

## Contexto

PixelCraft tiene 11 HTTP routes custom en `convex/http.ts` que envuelven queries/mutations de Convex. Estos routes existen porque los callers hacen `fetch()` directo al endpoint `.convex.site` en vez de usar el cliente nativo de Convex.

### El problema

- Los callers client-side (browser) hacen cross-origin requests → CORS errors
- Se pierde reactividad en tiempo real (Convex nativo push actualizaciones via WebSocket)
- Más boilerplate: cada route necesita HTTP handler + CORS + OPTIONS preflight
- Se duplica lógica: la mutation ya existe en `convex/collections.ts`, el HTTP route solo la wrappea

## Auditoría: Estado Actual

### Routes con callers CLIENT-SIDE (collections.ts)

| Route | Caller | Línea | Estado |
|-------|--------|-------|--------|
| `GET /api/collections/list` | `collections.ts` `hydrateFromConvex()` | 233 | Migra a `client.query()` |
| `POST /api/collections/create` | `collections.ts` `syncToConvex()` | 331 | Migra a `client.mutation()` |
| `POST /api/collections/update` | `collections.ts` `syncToConvex()` | 318 | Migra a `client.mutation()` |

### Routes con callers SERVER-SIDE (persistence.ts — Next.js Server Actions)

| Route | Caller | Línea | Estado |
|-------|--------|-------|--------|
| `POST /files/persistFromUrl` | `persistence.ts` `runLegacyPersist()` | 131 | Mantener HTTP (fallback legacy) |
| `POST /files/preparePersistUpload` | `persistence.ts` `persistMedia()` | 182 | Mantener HTTP (server→server) |
| `POST /files/finalizePersistUpload` | `persistence.ts` `persistMedia()` | 261 | Mantener HTTP (server→server) |
| `GET /api/media/list` | `persistence.ts` `listPersistedMedia()` | 328 | Mantener HTTP (server→server) |
| `POST /api/media/delete` | `persistence.ts` `deletePersistedMedia()` | 354 | **DEAD CODE** — nunca llamado |

### Routes SIN callers (definidos pero nunca usados)

| Route | Origen | Estado |
|-------|--------|--------|
| `POST /files/upload` | Librería `convex-files-control` | Evaluar si la lib lo necesita internamente |
| `GET /files/download` | Librería `convex-files-control` | Evaluar si la lib lo necesita internamente |
| `POST /api/collections/addItems` | `convex/http.ts` | Eliminar (la mutation existe pero el route no se usa) |
| `POST /api/collections/removeItems` | `convex/http.ts` | Eliminar |
| `POST /api/collections/delete` | `convex/http.ts` | Eliminar |

## Plan de Migración

### Fase 1: Migrar collections a Convex nativo

**Objetivo**: Eliminar los 3 HTTP routes de collections y usar `ConvexReactClient` directamente desde el Zustand store.

**Archivos afectados:**
- `src/stores/collections.ts` — reemplazar `fetch()` por `client.query()` / `client.mutation()`
- `convex/http.ts` — eliminar 6 routes de collections (3 de datos + 3 OPTIONS preflight)
- `src/components/providers/ConvexProvider.tsx` — exponer el cliente para uso fuera de React

**Patrón actual (HTTP manual):**
```ts
const response = await fetch(`${siteUrl}/api/collections/list?userId=...`)
const data = await response.json()
```

**Patrón nuevo (Convex nativo):**
```ts
import { ConvexReactClient } from "convex/react"
import { api } from "../../convex/_generated/api"

const client = new ConvexReactClient(convexUrl)
const data = await client.query(api.collections.listByUser, { userId })
```

**Consideraciones:**
- `ConvexReactClient` es singleton — crear una instancia, no una por llamada
- El store ya tiene `getUserId()` — pasar como argumento a la mutation
- El store usa IDs locales (UUID) vs IDs de Convex — mantener la lógica de merge que ya existe
- `syncToConvex()` es fire-and-forget — mantener ese comportamiento, no bloquear la UI
- Las mutations `addItems`, `removeItems`, `remove` ya existen en `convex/collections.ts` pero no se usan desde el store. Evaluar si `syncToConvex()` debería llamarlas (actualmente solo hace create/update)

**Beneficios:**
- Elimina CORS errors completamente
- Reactividad: si otro tab/cliente modifica collections, se refleja en tiempo real
- Menos código: eliminar ~60 líneas de HTTP routes
- Eliminar la necesidad de `getConvexSiteUrl()` helper

### Fase 2: Cleanup dead code

- Eliminar `deletePersistedMedia()` de `persistence.ts` (exported, nunca llamado)
- Eliminar 3 HTTP routes de collections sin callers (`addItems`, `removeItems`, `delete`)
- Evaluar si los routes de la librería (`/files/upload`, `/files/download`) se necesitan. Si `preparePersistUpload`/`finalizePersistUpload` son el flujo principal, los de la librería son redundantes

### Fase 3 (Opcional): Migrar persistence a ConvexHttpClient

Las server actions de `persistence.ts` hacen fetch HTTP al Convex site URL. Podrían usar `ConvexHttpClient`:

```ts
import { ConvexHttpClient } from "convex/browser"
const client = new ConvexHttpClient(convexUrl)
const result = await client.mutation(api.files.generateUploadUrl, { provider: "r2" })
```

**Beneficio**: Código más limpio, type-safe (usa `api.*` references).
**Riesgo**: Bajo — server-to-server, sin CORS involucrado. Es una mejora de DX, no funcional.

## Resumen de Decisiones

| Elemento | Decisión | Razón |
|----------|----------|-------|
| Collections routes | Migrar a Convex nativo | CORS + reactividad + menos código |
| Files/persistence routes | Mantener HTTP | Server-to-server, funciona bien |
| Dead routes (3 collections + delete media) | Eliminar | Nunca llamados |
| Library routes (upload/download) | Investigar | Puede que la lib los necesite internamente |
| CORS headers actuales | Mantener mientras HTTP routes existan | Los routes de persistence los necesitan |

## Estimación

- Fase 1: ~2-3 horas (modificar store + provider + eliminar routes)
- Fase 2: ~30 min (limpieza directa)
- Fase 3: ~1-2 horas (opcional, refactoring de persistence)

## Preguntas Abiertas

1. `syncToConvex()` solo hace create/update — ¿debería también sincronizar addItems/removeItems/delete?
2. Los IDs de collections son UUIDs locales vs Convex `_id` — ¿convendría unificar esto?
3. La librería `convex-files-control` registra upload/download routes — ¿las necesita para algún flujo interno o se pueden desactivar?
