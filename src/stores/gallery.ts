import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import type { GeneratedMediaBase, GeneratedMedia, PendingMedia, PersistedMedia, CostTier } from '@/types'
import { persistMedia, listPersistedMedia, type PersistedMediaResult } from '@/lib/persistence'
import { isFalUrl } from '@/lib/utils/url'
import { getUserId } from '@/lib/user'

export interface EditHistoryEntry {
  item: GeneratedMedia
  operation: 'original' | 'edit' | 'upscale' | 'remove-bg'
  depth: number
}

interface GalleryState {
  items: GeneratedMedia[]
  pendingItems: PendingMedia[]
  isPersisting: boolean
  persistingIds: Set<string>
  hydratedFromR2: boolean
  add: (item: GeneratedMediaBase) => string
  addWithPersistence: (item: GeneratedMediaBase) => Promise<string>
  addPending: (item: Omit<PendingMedia, 'id' | 'createdAt'>, count?: number) => string[]
  removePending: (ids?: string[]) => void
  markPendingFailed: (id: string, error: string) => void
  dismissPending: (id: string) => void
  remove: (id: string) => void
  clear: () => void
  getById: (id: string) => GeneratedMedia | undefined
  updateItem: (id: string, updates: Partial<GeneratedMedia>) => void
  migrateItemToR2: (id: string) => Promise<boolean>
  hydrateFromR2: () => Promise<void>
  migrateUnpersistedItems: () => void
  getEditHistory: (id: string) => EditHistoryEntry[]
}

const UPSCALE_PREFIXES = ['fal-ai/imageutils/super-resolution', 'fal-ai/bria/', 'fal-ai/topaz/']
const BG_REMOVAL_PREFIXES = ['fal-ai/imageutils/rembg', 'fal-ai/bria/rmbg']

function inferOperation(model: string, prompt: string): 'original' | 'edit' | 'upscale' | 'remove-bg' {
  if (UPSCALE_PREFIXES.some((p) => model.startsWith(p)) || prompt.includes('(upscaled)')) return 'upscale'
  if (BG_REMOVAL_PREFIXES.some((p) => model.startsWith(p)) || prompt.includes('(background removed)')) return 'remove-bg'
  if (model.includes('/edit') || model.includes('image-to-image')) return 'edit'
  return 'original'
}

const MAX_PERSISTED_ITEMS = 100
const MAX_PERSISTED_PENDING_ITEMS = 25

function isEphemeralUrl(url?: string) {
  return Boolean(url && (url.startsWith('data:') || url.startsWith('blob:')))
}

function sanitizeItemForPersistence(item: GeneratedMedia): GeneratedMedia | null {
  if (isEphemeralUrl(item.url)) {
    return null
  }

  return {
    ...item,
    metadata: item.metadata
      ? {
          ...item.metadata,
          source: isEphemeralUrl(item.metadata.source) ? undefined : item.metadata.source,
        }
      : undefined,
  }
}

const galleryStorage: StateStorage = {
  getItem: (name) => {
    if (typeof window === 'undefined') return null
    return window.localStorage.getItem(name)
  },
  setItem: (name, value) => {
    if (typeof window === 'undefined') return

    try {
      window.localStorage.setItem(name, value)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.warn('[gallery.persist] Local storage quota exceeded; skipping persistence update.', error)
        return
      }

      throw error
    }
  },
  removeItem: (name) => {
    if (typeof window === 'undefined') return
    window.localStorage.removeItem(name)
  },
}

function persistedMediaToGalleryItem(media: PersistedMedia): GeneratedMedia {
  const r2PublicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL
  const url = r2PublicUrl && media.provider === 'r2'
    ? `${r2PublicUrl}/${media.storageId}`
    : media.url

  return {
    id: media.storageId,
    type: media.type,
    url,
    prompt: media.prompt || '',
    model: media.modelId || '',
    costTier: media.costTier as CostTier | undefined,
    createdAt: new Date(media.createdAt),
    metadata: {
      storageId: media.storageId,
      persisted: true,
      userId: media.userId,
      estimatedCost: media.estimatedCost,
      seed: media.seed,
      duration: media.duration != null ? String(media.duration) : undefined,
      aspectRatio: media.aspectRatio,
      resolution: media.resolution,
      negativePrompt: media.negativePrompt,
    },
  }
}

export const useGallery = create<GalleryState>()(
  persist(
    (set, get) => ({
      items: [],
      pendingItems: [],
      isPersisting: false,
      persistingIds: new Set<string>(),
      hydratedFromR2: false,

      hydrateFromR2: async () => {
        if (get().hydratedFromR2) return

        try {
          const userId = getUserId()
          const r2Items = await listPersistedMedia(200, userId)

          if (!r2Items || r2Items.length === 0) {
            set({ hydratedFromR2: true })
            return
          }

          const r2GalleryItems = r2Items.map(persistedMediaToGalleryItem)
          const r2StorageIds = new Set<string>(r2Items.map((m: PersistedMedia) => m.storageId))

          set((state) => {
            const localOnlyItems = state.items.filter((item) => {
              if (item.metadata?.storageId && r2StorageIds.has(item.metadata.storageId)) {
                return false
              }
              if (item.metadata?.persisted) {
                return false
              }
              return true
            })

            const seenIds = new Set<string>()
            const finalItems: GeneratedMedia[] = []

            for (const item of r2GalleryItems) {
              if (!seenIds.has(item.id)) {
                seenIds.add(item.id)
                finalItems.push(item)
              }
            }

            for (const item of localOnlyItems) {
              if (!seenIds.has(item.id)) {
                seenIds.add(item.id)
                finalItems.push(item)
              }
            }

            finalItems.sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            )

            return {
              items: finalItems,
              hydratedFromR2: true,
            }
          })
        } catch (error) {
          console.error('[gallery] Failed to hydrate from R2:', error)
          set({ hydratedFromR2: true })
        }
      },

      migrateUnpersistedItems: () => {
        const state = get()
        const migrating = new Set(state.persistingIds)

        const itemsToMigrate = state.items.filter(
          (item) =>
            !item.metadata?.persisted &&
            isFalUrl(item.url) &&
            !migrating.has(item.id)
        )

        if (itemsToMigrate.length === 0) return

        const newPersistingIds = new Set(migrating)
        for (const item of itemsToMigrate) {
          newPersistingIds.add(item.id)
        }
        set({ persistingIds: newPersistingIds, isPersisting: true })

        void (async () => {
          for (const item of itemsToMigrate) {
            try {
              await get().migrateItemToR2(item.id)
            } catch (error) {
              console.error('[gallery] Failed to migrate item:', item.id, error)
            }
          }

          set((state) => {
            const next = new Set(state.persistingIds)
            for (const item of itemsToMigrate) {
              next.delete(item.id)
            }
            return {
              persistingIds: next,
              isPersisting: next.size > 0,
            }
          })
        })()
      },

      add: (item) => {
        const id = crypto.randomUUID()
        const newItem: GeneratedMedia = {
          ...item,
          id,
          createdAt: new Date(),
        }
        set((state) => ({ items: [newItem, ...state.items] }))
        return id
      },

      addPending: (item, count = 1) => {
        const safeCount = Math.max(1, count)
        const nextPending = Array.from({ length: safeCount }, () => ({
          ...item,
          id: crypto.randomUUID(),
          createdAt: new Date(),
          status: 'pending' as const,
        }))

        set((state) => ({ pendingItems: [...nextPending, ...state.pendingItems] }))

        return nextPending.map((pending) => pending.id)
      },

      removePending: (ids) => {
        if (!ids?.length) {
          set({ pendingItems: [] })
          return
        }

        const pendingIds = new Set(ids)
        set((state) => ({
          pendingItems: state.pendingItems.filter((item) => !pendingIds.has(item.id)),
        }))
      },

      markPendingFailed: (id, error) => {
        set((state) => ({
          pendingItems: state.pendingItems.map((item) =>
            item.id === id ? { ...item, status: 'failed' as const, error } : item
          ),
        }))
      },

      dismissPending: (id) => {
        set((state) => ({
          pendingItems: state.pendingItems.filter((item) => item.id !== id),
        }))
      },

      addWithPersistence: async (item) => {
        const id = get().add(item)
        const userId = getUserId()

        set((state) => {
          const next = new Set(state.persistingIds)
          next.add(id)
          return { persistingIds: next, isPersisting: true }
        })

        try {
          const result: PersistedMediaResult = await persistMedia({
            url: item.url,
            type: item.type,
            prompt: item.prompt,
            model: item.model,
            costTier: item.costTier,
            estimatedCost: item.metadata?.estimatedCost,
            userId,
            metadata: {
              seed: item.metadata?.seed,
              duration: item.metadata?.duration ? parseFloat(item.metadata.duration) : undefined,
              aspectRatio: item.metadata?.aspectRatio,
              resolution: item.metadata?.resolution,
              negativePrompt: item.metadata?.negativePrompt,
            },
          })

          if (result.persisted) {
            get().updateItem(id, {
              url: result.url,
              metadata: {
                ...item.metadata,
                storageId: result.storageId,
                persisted: true,
                userId,
              },
            })
          }
        } catch (error) {
          console.error('Failed to persist media:', error)
        } finally {
          set((state) => {
            const next = new Set(state.persistingIds)
            next.delete(id)
            return {
              persistingIds: next,
              isPersisting: next.size > 0,
            }
          })
        }

        return id
      },

      remove: (id) => {
        set((state) => ({ items: state.items.filter((i) => i.id !== id) }))
      },

      clear: () => set({ items: [] }),

      getById: (id) => get().items.find((i) => i.id === id),

      updateItem: (id, updates) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, ...updates } : item
          ),
        }))
      },

      getEditHistory: (id) => {
        const allItems = get().items
        const byId = new Map(allItems.map((i) => [i.id, i]))

        const target = byId.get(id)
        if (!target) return []

        const ancestors: GeneratedMedia[] = []
        let current = target
        const visited = new Set<string>()
        while (current?.metadata?.sourceId && !visited.has(current.id)) {
          visited.add(current.id)
          const parent = byId.get(current.metadata.sourceId)
          if (!parent) break
          ancestors.unshift(parent)
          current = parent
        }

        const childrenOf = (parentId: string, depth: number): EditHistoryEntry[] => {
          const children: EditHistoryEntry[] = []
          for (const item of allItems) {
            if (item.metadata?.sourceId === parentId) {
              const op = inferOperation(item.model, item.prompt)
              children.push({ item, operation: op, depth })
              children.push(...childrenOf(item.id, depth + 1))
            }
          }
          return children
        }

        const result: EditHistoryEntry[] = []

        for (let i = 0; i < ancestors.length; i++) {
          const op = i === 0 ? 'original' : inferOperation(ancestors[i].model, ancestors[i].prompt)
          result.push({ item: ancestors[i], operation: op, depth: 0 })
        }

        const rootId = ancestors.length > 0 ? ancestors[0].id : id
        const rootOp = ancestors.length > 0 ? 'original' : inferOperation(target.model, target.prompt)
        if (ancestors.length === 0) {
          result.push({ item: target, operation: rootOp, depth: 0 })
        }

        const descendants = childrenOf(rootId, 1)
        for (const entry of descendants) {
          if (!result.some((r) => r.item.id === entry.item.id)) {
            result.push(entry)
          }
        }

        if (ancestors.length > 0 && !result.some((r) => r.item.id === target.id)) {
          const targetOp = inferOperation(target.model, target.prompt)
          result.push({ item: target, operation: targetOp, depth: 1 })
        }

        result.sort((a, b) => new Date(a.item.createdAt).getTime() - new Date(b.item.createdAt).getTime())

        return result
      },

      migrateItemToR2: async (id) => {
        const item = get().getById(id)
        if (!item) return false

        if (item.metadata?.persisted) return true

        if (!isFalUrl(item.url)) return false

        const userId = getUserId()

        set((state) => {
          const next = new Set(state.persistingIds)
          next.add(id)
          return { persistingIds: next, isPersisting: true }
        })

        try {
          const result: PersistedMediaResult = await persistMedia({
            url: item.url,
            type: item.type,
            prompt: item.prompt,
            model: item.model,
            costTier: item.costTier,
            estimatedCost: item.metadata?.estimatedCost,
            userId,
            metadata: {
              seed: item.metadata?.seed,
              duration: item.metadata?.duration ? parseFloat(item.metadata.duration) : undefined,
              aspectRatio: item.metadata?.aspectRatio,
              resolution: item.metadata?.resolution,
              negativePrompt: item.metadata?.negativePrompt,
            },
          })

          if (result.persisted) {
            get().updateItem(id, {
              url: result.url,
              metadata: {
                ...item.metadata,
                storageId: result.storageId,
                persisted: true,
                userId,
              },
            })
            return true
          }

          return false
        } catch (error) {
          console.error('Failed to migrate item to R2:', error)
          return false
        } finally {
          set((state) => {
            const next = new Set(state.persistingIds)
            next.delete(id)
            return {
              persistingIds: next,
              isPersisting: next.size > 0,
            }
          })
        }
      },
    }),
    {
      name: 'pixelcraft-gallery',
      storage: createJSONStorage(() => galleryStorage),
      partialize: (state) => ({
        items: state.items
          .map(sanitizeItemForPersistence)
          .filter((item): item is GeneratedMedia => item !== null)
          .slice(0, MAX_PERSISTED_ITEMS),
        pendingItems: state.pendingItems.slice(0, MAX_PERSISTED_PENDING_ITEMS),
      }),
    }
  )
)
