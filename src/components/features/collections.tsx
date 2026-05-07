'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useGallery } from '@/stores/gallery'
import { useCollections } from '@/stores/collections'
import {
  COLLECTION_COLORS,
  type Collection,
  type CollectionColor,
  type GeneratedMedia,
} from '@/types'
import {
  ArrowLeft,
  FolderOpen,
  Plus,
  Pencil,
  Trash2,
  ImageIcon,
  Video,
  Search,
  FolderPlus,
  Sparkles,
  Maximize2,
  PackagePlus,
  Download,
} from 'lucide-react'
import { toast } from 'sonner'
import { AnimatePresence, motion, galleryItemVariants } from '@/lib/motion'
import { getCollectionItems, calculateCollectionCost } from '@/lib/collection-cost'
import { exportCollectionCostCSV } from '@/lib/csv-export'
import { formatCostEstimate, formatCostEstimateMxn } from '@/lib/cost-estimate'
import { AssetPicker } from '@/components/features/asset-picker'

// ── Types ──────────────────────────────────────────────────────────

interface CollectionsProps {
  onSwitchTab?: (tab: 'gallery' | 'storage' | 'collections') => void
}

interface FormData {
  name: string
  description: string
  color: CollectionColor
}

const EMPTY_FORM: FormData = {
  name: '',
  description: '',
  color: 'blue',
}

const MAX_NAME_LENGTH = 100
const MAX_DESCRIPTION_LENGTH = 500

// ── Helpers (mirroring gallery.tsx patterns) ────────────────────────

function getMediaFrameClass(
  type: 'image' | 'video',
  metadata?: { imageSize?: string; aspectRatio?: string }
) {
  if (type === 'video') {
    if (metadata?.aspectRatio === '9:16') return 'aspect-[9/16]'
    if (metadata?.aspectRatio === '1:1') return 'aspect-square'
    return 'aspect-video'
  }
  switch (metadata?.imageSize) {
    case 'landscape_4_3': return 'aspect-[4/3]'
    case 'portrait_4_3': return 'aspect-[3/4]'
    case 'landscape_16_9': return 'aspect-video'
    case 'portrait_16_9': return 'aspect-[9/16]'
    case 'square':
    case 'square_hd': return 'aspect-square'
    default: return 'aspect-square'
  }
}

function getDisplayModel(model: string) {
  if (model === 'upload') return 'Subida por usuario'
  return model.replace(/^fal-ai\//, '')
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// ── Color Picker ───────────────────────────────────────────────────

function ColorPicker({
  value,
  onChange,
}: {
  value: CollectionColor
  onChange: (color: CollectionColor) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(COLLECTION_COLORS) as CollectionColor[]).map((colorKey) => {
        const config = COLLECTION_COLORS[colorKey]
        const isSelected = value === colorKey
        return (
          <button
            key={colorKey}
            type="button"
            onClick={() => onChange(colorKey)}
            className={`flex h-9 w-9 items-center justify-center rounded-xl border-2 transition ${isSelected
              ? `${config.bg} ${config.border} ring-2 ring-offset-2 ring-offset-slate-950`
              : 'border-secondary/15 hover:border-secondary/30'
              }`}
            aria-label={config.label}
            title={config.label}
          >
            <span className={`h-4 w-4 rounded-full ${config.dot}`} />
          </button>
        )
      })}
    </div>
  )
}

// ── Collection Card ────────────────────────────────────────────────

function CollectionCard({
  collection,
  itemCount,
  coverUrl,
  galleryItems,
  onEdit,
  onDelete,
  onClick,
}: {
  collection: Collection
  itemCount: number
  coverUrl: string | null
  galleryItems: GeneratedMedia[]
  onEdit: () => void
  onDelete: () => void
  onClick: () => void
}) {
  const colorConfig = COLLECTION_COLORS[collection.color] ?? COLLECTION_COLORS.blue
  const items = getCollectionItems(galleryItems, collection)
  const { totalUsd } = calculateCollectionCost(items)

  return (
    <motion.div
      layout
      variants={galleryItemVariants}
      initial="initial"
      animate={{ opacity: 1, scale: 1 }}
      exit="exit"
      className="group relative"
    >
      <button
        type="button"
        onClick={onClick}
        className={`depth-mixed card-hover block w-full overflow-hidden rounded-2xl border ${colorConfig.border} bg-slate-900/78 text-left transition`}
      >
        {/* Cover image area */}
        <div className="relative aspect-[2/1] w-full bg-black/40">
          {coverUrl ? (
            <Image
              src={coverUrl}
              alt={collection.name}
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className={`flex h-full w-full items-center justify-center ${colorConfig.bg}`}>
              <FolderOpen className={`h-12 w-12 ${colorConfig.dot} opacity-40`} />
            </div>
          )}
          {/* Color indicator bar */}
          <div className={`absolute bottom-0 left-0 right-0 h-1 ${colorConfig.dot}`} />
          {/* Hover actions overlay */}
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onEdit() }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onEdit() } }}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/20"
              aria-label="Editar colección"
            >
              <Pencil className="h-4 w-4" />
            </span>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onDelete() }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onDelete() } }}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 backdrop-blur-sm transition hover:bg-red-500/20"
              aria-label="Eliminar colección"
            >
              <Trash2 className="h-4 w-4" />
            </span>
          </div>
        </div>
        {/* Info section */}
        <div className="px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${colorConfig.dot}`} />
            <p className="truncate text-sm font-medium text-white">{collection.name}</p>
          </div>
          {collection.description && (
            <p className="mt-1 line-clamp-2 text-xs text-slate-400">{collection.description}</p>
          )}
          <div className="mt-2 flex items-center gap-2">
            <Badge variant="secondary" className="depth-secondary border border-secondary/20 bg-secondary/10 text-xs text-secondary-tint">
              {itemCount} {itemCount === 1 ? 'elemento' : 'elementos'}
            </Badge>
            {totalUsd > 0 && (
              <Badge variant="secondary" className="depth-primary border border-primary/20 bg-primary/10 text-primary-tint text-xs">
                {formatCostEstimate(totalUsd)} <span className="mx-0.5 opacity-50">·</span> {formatCostEstimateMxn(totalUsd)}
              </Badge>
            )}
          </div>
        </div>
      </button>
    </motion.div>
  )
}

// ── Collection Detail View ──────────────────────────────────────────

function CollectionDetail({
  collection,
  galleryItems,
  onBack,
  onEdit,
  onDelete,
  onOpenPicker,
}: {
  collection: Collection
  galleryItems: GeneratedMedia[]
  onBack: () => void
  onEdit: () => void
  onDelete: () => void
  onOpenPicker?: (collectionId: string, collectionName: string, collectionColor: CollectionColor) => void
}) {
  const colorConfig = COLLECTION_COLORS[collection.color] ?? COLLECTION_COLORS.blue
  const items = getCollectionItems(galleryItems, collection)
  const { totalUsd } = calculateCollectionCost(items)

  return (
    <div className="flex h-full flex-col">
      {/* Detail header */}
      <div className="surface-secondary flex items-center justify-between gap-3 border-b border-secondary/20 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-secondary/15 bg-secondary/10 text-secondary-tint transition hover:bg-secondary/15 hover:text-white"
            aria-label="Volver a colecciones"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className={`h-3 w-3 shrink-0 rounded-full ${colorConfig.dot}`} />
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-white">{collection.name}</h2>
            {collection.description && (
              <p className="truncate text-xs text-slate-400">{collection.description}</p>
            )}
          </div>
          <Badge variant="secondary" className="depth-secondary border border-secondary/20 bg-secondary/10 text-xs text-secondary-tint">
            {items.length} {items.length === 1 ? 'elemento' : 'elementos'}
          </Badge>
          {totalUsd > 0 && (
            <>
              <Badge variant="secondary" className="depth-primary border border-primary/20 bg-primary/10 text-primary-tint">
                {formatCostEstimate(totalUsd)} USD
              </Badge>
              <Badge variant="secondary" className="depth-primary border border-primary/20 bg-primary/10 text-primary-tint">
                {formatCostEstimateMxn(totalUsd)}
              </Badge>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              onOpenPicker?.(collection.id, collection.name, collection.color)
            }}
            className="depth-primary rounded-2xl border border-primary/25 bg-primary/20 px-3 py-1.5 text-xs font-medium text-primary-tint transition hover:bg-primary/30 hover:border-primary/40"
          >
            <PackagePlus className="mr-1.5 inline h-3 w-3" />
            Añadir assets
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="depth-secondary rounded-2xl border border-secondary/15 bg-secondary/10 px-3 py-1.5 text-xs font-medium text-secondary-tint transition hover:bg-secondary/15 hover:text-white"
          >
            <Pencil className="mr-1.5 inline h-3 w-3" />
            Editar
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-500/20 hover:text-red-300"
          >
            <Trash2 className="mr-1.5 inline h-3 w-3" />
            Eliminar
          </button>
        </div>
      </div>

      {/* Items grid or empty state */}
      {items.length === 0 ? (
        <div className="flex min-h-[calc(100dvh-10rem)] flex-1 items-center justify-center p-8">
          <div className="depth-mixed max-w-md rounded-[2rem] border border-dashed border-secondary/15 bg-slate-900/70 px-12 py-16 text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 via-primary/10 to-transparent">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
                <Sparkles className="h-8 w-8 text-primary-tint" />
              </div>
            </div>
            <p className="text-lg font-semibold text-white">Colección vacía</p>
            <p className="mt-3 text-sm text-slate-400">
              Añade assets desde tu galería para llenar esta colección.
            </p>
            <button
              type="button"
              onClick={() => {
                onOpenPicker?.(collection.id, collection.name, collection.color)
              }}
              className="mt-8 inline-flex items-center gap-2 rounded-2xl border border-primary/30 bg-primary/20 px-6 py-3 text-sm font-semibold text-primary-tint transition hover:bg-primary/30 hover:border-primary/40 active:scale-[0.98]"
            >
              <PackagePlus className="h-4 w-4" />
              Añadir assets
            </button>
          </div>
        </div>
      ) : (
        <ScrollArea className="h-[calc(100vh-4.75rem)] h-[calc(100dvh-4.75rem)]">
          <div className="grid auto-rows-auto grid-cols-[repeat(auto-fill,minmax(280px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(360px,1fr))] gap-4 p-5">
            <AnimatePresence mode="popLayout">
              {items.map((item, index) => (
                <motion.div
                  key={item.id}
                  layout
                  variants={galleryItemVariants}
                  initial="initial"
                  animate={{ opacity: 1, scale: 1 }}
                  exit="exit"
                  className="group relative animate-in fade-in slide-in-from-bottom-4 fill-mode-both"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="depth-mixed card-hover block w-full overflow-hidden rounded-2xl border border-secondary/15 bg-slate-900/78 text-left transition">
                    <div className={`relative w-full bg-black/40 ${getMediaFrameClass(item.type, item.metadata)}`}>
                      {item.type === 'video' ? (
                        <video
                          src={item.url}
                          className="absolute inset-0 h-full w-full object-contain"
                          muted
                          playsInline
                        />
                      ) : (
                        <Image
                          src={item.url}
                          alt={item.prompt}
                          fill
                          className="object-contain"
                          loading={index < 8 ? 'eager' : 'lazy'}
                          unoptimized
                        />
                      )}
                    </div>
                    <div className="absolute right-2.5 top-2.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <span className="depth-primary rounded-full border border-primary/20 bg-primary/15 p-1.5 text-primary-tint">
                        <Maximize2 className="h-3.5 w-3.5" />
                      </span>
                    </div>
                    <div className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        {item.type === 'video' ? (
                          <Video className="h-3.5 w-3.5 shrink-0 text-secondary-tint" />
                        ) : (
                          <ImageIcon className="h-3.5 w-3.5 shrink-0 text-primary-tint" />
                        )}
                        <p className="truncate text-xs font-medium text-white">
                          {getDisplayModel(item.model)}
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </ScrollArea>
      )}
    </div>
  )
}

// ── Reusable Dialogs ───────────────────────────────────────────────

function CollectionDialogs({
  createOpen,
  editTarget,
  deleteTarget,
  formData,
  setFormData,
  setCreateOpen,
  setEditTarget,
  setDeleteTarget,
  onHandleCreate,
  onHandleEdit,
  onHandleDelete,
}: {
  createOpen: boolean
  editTarget: Collection | null
  deleteTarget: Collection | null
  formData: FormData
  setFormData: React.Dispatch<React.SetStateAction<FormData>>
  setCreateOpen: React.Dispatch<React.SetStateAction<boolean>>
  setEditTarget: React.Dispatch<React.SetStateAction<Collection | null>>
  setDeleteTarget: React.Dispatch<React.SetStateAction<Collection | null>>
  onHandleCreate: () => void
  onHandleEdit: () => void
  onHandleDelete: () => void
}) {
  return (
    <>
      {/* Create / Edit Dialog */}
      <Dialog
        open={createOpen || !!editTarget}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false)
            setEditTarget(null)
            setFormData(EMPTY_FORM)
          }
        }}
      >
        <DialogContent className="depth-mixed border-secondary/25 bg-slate-950/95 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editTarget ? 'Editar colección' : 'Nueva colección'}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {editTarget
                ? 'Modifica los detalles de la colección.'
                : 'Crea una colección para organizar tus recursos.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="collection-name" className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary-tint">
                Nombre
              </Label>
              <Input
                id="collection-name"
                value={formData.name}
                onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value.slice(0, MAX_NAME_LENGTH) }))}
                placeholder="Nombre de la colección"
                maxLength={MAX_NAME_LENGTH}
                className="depth-secondary border border-secondary/20 bg-slate-900/70 text-white placeholder:text-slate-500"
              />
              <p className="text-right text-xs text-slate-500">
                {formData.name.length}/{MAX_NAME_LENGTH}
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="collection-desc" className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary-tint">
                Descripción
              </Label>
              <Textarea
                id="collection-desc"
                value={formData.description}
                onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value.slice(0, MAX_DESCRIPTION_LENGTH) }))}
                placeholder="Descripción opcional..."
                maxLength={MAX_DESCRIPTION_LENGTH}
                rows={3}
                className="depth-secondary resize-none border border-secondary/20 bg-slate-900/70 text-white placeholder:text-slate-500"
              />
              <p className="text-right text-xs text-slate-500">
                {formData.description.length}/{MAX_DESCRIPTION_LENGTH}
              </p>
            </div>

            {/* Color */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary-tint">
                Color
              </Label>
              <ColorPicker
                value={formData.color}
                onChange={(color) => setFormData((f) => ({ ...f, color }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setCreateOpen(false)
                setEditTarget(null)
                setFormData(EMPTY_FORM)
              }}
              className="depth-secondary rounded-2xl border border-secondary/15 bg-secondary/10 text-secondary-tint hover:bg-secondary/15 hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              onClick={editTarget ? onHandleEdit : onHandleCreate}
              disabled={!formData.name.trim()}
              className="depth-primary rounded-2xl border border-primary/25 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {editTarget ? 'Guardar cambios' : 'Crear colección'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <DialogContent className="depth-mixed border-secondary/25 bg-slate-950/95 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Eliminar colección</DialogTitle>
            <DialogDescription className="text-slate-400">
              ¿Estás seguro de que deseas eliminar &quot;{deleteTarget?.name}&quot;?
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDeleteTarget(null)}
              className="depth-secondary rounded-2xl border border-secondary/15 bg-secondary/10 text-secondary-tint hover:bg-secondary/15 hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              onClick={onHandleDelete}
              className="rounded-2xl border border-red-500/30 bg-red-600 text-white hover:bg-red-700"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Export Cost Dialog ──────────────────────────────────────────────

function ExportCostDialog({
  open,
  onOpenChange,
  collections: allCollections,
  galleryItems,
  preselectedId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  collections: Collection[]
  galleryItems: GeneratedMedia[]
  preselectedId?: string
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    if (preselectedId) return new Set([preselectedId])
    return new Set()
  })

  // Reset selection when dialog opens with a new preselectedId
  useEffect(() => {
    if (open) {
      setSelectedIds(preselectedId ? new Set([preselectedId]) : new Set())
    }
  }, [open, preselectedId])

  function toggleCollection(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Compute export data
  const selectedCollections = allCollections.filter((c) => selectedIds.has(c.id))
  const allItems = selectedCollections.flatMap((c) => getCollectionItems(galleryItems, c))
  const selectedNames = selectedCollections.map((c) => c.name)
  const result = selectedIds.size > 0 ? exportCollectionCostCSV(allItems, selectedNames) : null

  function handleDownload() {
    if (!result) return
    const filename =
      selectedCollections.length === 1
        ? `costos-${slugify(selectedCollections[0].name)}.csv`
        : 'costos-colecciones.csv'
    downloadCSV(result.csv, filename)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="depth-mixed border-secondary/25 bg-slate-950/95 text-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white">Exportar costos</DialogTitle>
          <DialogDescription className="text-slate-400">
            Selecciona colecciones para ver y descargar el desglose de costos por modelo.
          </DialogDescription>
        </DialogHeader>

        {/* Collection selector */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary-tint">
            Colecciones
          </Label>
          <div className="flex flex-wrap gap-2">
            {allCollections.map((collection) => {
              const colorConfig = COLLECTION_COLORS[collection.color] ?? COLLECTION_COLORS.blue
              const isSelected = selectedIds.has(collection.id)
              return (
                <label
                  key={collection.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-2xl border px-3 py-1.5 text-xs font-medium transition ${
                    isSelected
                      ? `${colorConfig.bg} ${colorConfig.border} text-white`
                      : 'border-secondary/15 bg-secondary/10 text-slate-400 hover:border-secondary/25 hover:text-slate-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={isSelected}
                    onChange={() => toggleCollection(collection.id)}
                  />
                  <span className={`h-2 w-2 shrink-0 rounded-full ${colorConfig.dot}`} />
                  <span>{collection.name}</span>
                  <span className="opacity-50">({collection.itemIds.length})</span>
                </label>
              )
            })}
          </div>
        </div>

        {/* Preview table */}
        {result && result.rows.length > 0 ? (
          <ScrollArea className="flex-1 min-h-0 max-h-[300px]">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-secondary/15 text-left text-slate-400">
                  <th className="pb-2 pr-4 font-medium">Modelo</th>
                  <th className="pb-2 pr-4 text-right font-medium">Ejecuciones</th>
                  <th className="pb-2 text-right font-medium">Costo (USD)</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={row.modelId} className="border-b border-secondary/10">
                    <td className="py-1.5 pr-4 text-white">{row.displayName}</td>
                    <td className="py-1.5 pr-4 text-right text-slate-300">{row.executions}</td>
                    <td className="py-1.5 text-right text-slate-300">${row.cost.toFixed(4)}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="py-2 pr-4 text-white">Total</td>
                  <td className="py-2 pr-4 text-right text-white">{result.totalExecutions}</td>
                  <td className="py-2 text-right text-white">${result.totalCost.toFixed(4)}</td>
                </tr>
              </tbody>
            </table>
          </ScrollArea>
        ) : selectedIds.size > 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">Sin datos de costo</p>
        ) : null}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="depth-secondary rounded-2xl border border-secondary/15 bg-secondary/10 text-secondary-tint hover:bg-secondary/15 hover:text-white"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleDownload}
            disabled={selectedIds.size === 0 || !result || result.rows.length === 0}
            className="depth-primary rounded-2xl border border-primary/25 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Download className="mr-2 h-4 w-4" />
            Descargar CSV
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Main Component ─────────────────────────────────────────────────

export function Collections({ onSwitchTab }: CollectionsProps) {
  // View state
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null)

  // Asset picker state — opens automatically after collection creation
  const [pickerState, setPickerState] = useState<{
    open: boolean
    collectionId: string
    collectionName: string
    collectionColor: CollectionColor
  }>({ open: false, collectionId: '', collectionName: '', collectionColor: 'blue' })

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Collection | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Collection | null>(null)
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM)
  const [searchQuery, setSearchQuery] = useState('')

  // Store
  const collections = useCollections((s) => s.collections)
  const isLoading = useCollections((s) => s.isLoading)
  const createCollection = useCollections((s) => s.create)
  const updateCollection = useCollections((s) => s.update)
  const removeCollection = useCollections((s) => s.remove)
  const initCollections = useCollections((s) => s.init)
  const cleanupCollections = useCollections((s) => s.cleanup)

  // Gallery for cover images and item counts
  const galleryItems = useGallery((s) => s.items)

  // Initialize Convex subscription on mount
  useEffect(() => {
    initCollections()
    return () => cleanupCollections()
  }, [initCollections, cleanupCollections])

  // Filter collections by search
  const filteredCollections = searchQuery.trim()
    ? collections.filter((c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    : collections

  // Helper: find cover URL for a collection
  function getCoverUrl(collection: Collection): string | null {
    if (collection.coverImageId) {
      const item = galleryItems.find((i) => i.id === collection.coverImageId)
      if (item) return item.url
    }
    // Fallback: first item in collection
    const firstItemId = collection.itemIds[0]
    if (firstItemId) {
      const item = galleryItems.find((i) => i.id === firstItemId)
      if (item) return item.url
    }
    return null
  }

  // ── CRUD handlers ──────────────────────────────────────────────

  function handleOpenCreate() {
    setFormData(EMPTY_FORM)
    setCreateOpen(true)
  }

  function handleOpenEdit(collection: Collection) {
    setFormData({
      name: collection.name,
      description: collection.description ?? '',
      color: collection.color,
    })
    setEditTarget(collection)
  }

  function handleCreate() {
    const name = formData.name.trim()
    if (!name) {
      toast.error('El nombre es obligatorio')
      return
    }
    try {
      void createCollection({
        name,
        description: formData.description.trim() || undefined,
        color: formData.color,
      }).then((id) => {
        setCreateOpen(false)
        setFormData(EMPTY_FORM)
        toast.success('Colección creada')

        // Auto-launch asset picker for the new collection
        if (id) {
          setPickerState({
            open: true,
            collectionId: id,
            collectionName: name,
            collectionColor: formData.color,
          })
        }
      })
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error al crear la colección'
      toast.error(msg)
      console.warn('[collections]', msg)
    }
  }

  function handleEdit() {
    if (!editTarget) return
    const name = formData.name.trim()
    if (!name) {
      toast.error('El nombre es obligatorio')
      return
    }
    try {
      updateCollection(editTarget.id, {
        name,
        description: formData.description.trim() || undefined,
        color: formData.color,
      })
      setEditTarget(null)
      setFormData(EMPTY_FORM)
      toast.success('Colección actualizada')
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error al actualizar la colección'
      toast.error(msg)
      console.warn('[collections]', msg)
    }
  }

  function handleDelete() {
    if (!deleteTarget) return
    try {
      removeCollection(deleteTarget.id)
      setDeleteTarget(null)
      // If we were viewing this collection, go back to list
      if (selectedCollectionId === deleteTarget.id) {
        setSelectedCollectionId(null)
      }
      toast.success('Colección eliminada')
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error al eliminar la colección'
      toast.error(msg)
      console.warn('[collections]', msg)
    }
  }

  // ── Selected collection (for detail view) ─────────────────────

  const selectedCollection = selectedCollectionId
    ? collections.find((c) => c.id === selectedCollectionId) ?? null
    : null

  function handleOpenDetail(collection: Collection) {
    setSelectedCollectionId(collection.id)
  }

  function handleBackToList() {
    setSelectedCollectionId(null)
  }

  // ── Render ─────────────────────────────────────────────────────

  // Detail view
  if (selectedCollection) {
    return (
      <>
        <CollectionDetail
          collection={selectedCollection}
          galleryItems={galleryItems}
          onBack={handleBackToList}
          onEdit={() => handleOpenEdit(selectedCollection)}
          onDelete={() => setDeleteTarget(selectedCollection)}
          onOpenPicker={(id, name, color) => {
            setPickerState({ open: true, collectionId: id, collectionName: name, collectionColor: color })
          }}
        />

        {/* Asset Picker — opens from empty state or header button */}
        <AssetPicker
          open={pickerState.open}
          onClose={() => setPickerState((s) => ({ ...s, open: false }))}
          collectionId={pickerState.collectionId}
          collectionName={pickerState.collectionName}
          collectionColor={pickerState.collectionColor}
          onComplete={(addedIds) => {
            // Refresh the detail view to show new items
            if (addedIds.length > 0 && !selectedCollection.coverImageId) {
              // Auto-set first added item as cover
              const updateCollection = useCollections.getState().update
              updateCollection(pickerState.collectionId, { coverImageId: addedIds[0] })
            }
          }}
        />

        {/* Reuse same dialogs */}
        <CollectionDialogs
          createOpen={createOpen}
          editTarget={editTarget}
          deleteTarget={deleteTarget}
          formData={formData}
          setFormData={setFormData}
          setCreateOpen={setCreateOpen}
          setEditTarget={setEditTarget}
          setDeleteTarget={setDeleteTarget}
          onHandleCreate={handleCreate}
          onHandleEdit={handleEdit}
          onHandleDelete={handleDelete}
        />
      </>
    )
  }

  // List view
  return (
    <>
      <div className="flex h-full flex-col">
        {/* Header bar */}
        <div className="surface-secondary flex items-center justify-between gap-3 border-b border-secondary/20 px-5 py-4">
          <div className="flex min-w-0 items-center gap-2">
            <Badge variant="secondary" className="depth-secondary border border-secondary/20 bg-secondary/10 text-secondary-tint">
              Colecciones
            </Badge>
            <Badge variant="secondary" className="depth-primary border border-primary/20 bg-primary/10 text-primary-tint">
              {collections.length}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="depth-secondary relative rounded-2xl border border-secondary/15 bg-secondary/10">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 w-36 bg-transparent pr-3 pl-8 text-xs text-white placeholder:text-slate-500 focus:outline-none"
              />
            </div>
            {/* Tab navigation */}
            {onSwitchTab && (
              <button
                type="button"
                onClick={() => onSwitchTab('gallery')}
                className="depth-secondary rounded-2xl border border-secondary/15 bg-secondary/10 px-3 py-1.5 text-xs font-medium text-secondary-tint transition hover:bg-secondary/15 hover:text-white"
              >
                <ImageIcon className="mr-1.5 inline h-3 w-3" />
                Galería
              </button>
            )}
            {/* Create button */}
            <Button
              onClick={handleOpenCreate}
              className="depth-primary h-8 rounded-2xl border border-primary/25 bg-primary px-4 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Nueva colección
            </Button>
          </div>
        </div>

        {/* Content area */}
        {isLoading && collections.length === 0 ? (
          <div className="flex min-h-[calc(100dvh-10rem)] flex-1 items-center justify-center p-8">
            <div className="depth-mixed max-w-md rounded-[2rem] border border-dashed border-secondary/15 bg-slate-900/70 px-12 py-16 text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 via-primary/10 to-transparent">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
              </div>
              <p className="text-lg font-semibold text-white">Cargando colecciones</p>
              <p className="mt-3 text-sm text-slate-400">
                Sincronizando con el servidor...
              </p>
            </div>
          </div>
        ) : collections.length === 0 ? (
          <div className="flex min-h-[calc(100dvh-10rem)] flex-1 items-center justify-center p-8">
            <div className="depth-mixed max-w-md rounded-[2rem] border border-dashed border-secondary/15 bg-slate-900/70 px-12 py-16 text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 via-primary/10 to-transparent">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
                  <FolderOpen className="h-8 w-8 text-primary-tint" />
                </div>
              </div>
              <p className="text-lg font-semibold text-white">Sin colecciones</p>
              <p className="mt-3 text-sm text-slate-400">
                Crea tu primera colección para organizar tus imágenes y videos.
              </p>
              <button
                type="button"
                onClick={handleOpenCreate}
                className="mt-8 inline-flex items-center gap-2 rounded-2xl border border-primary/30 bg-primary/20 px-6 py-3 text-sm font-semibold text-primary-tint transition hover:bg-primary/30 hover:border-primary/40 active:scale-[0.98]"
              >
                <FolderPlus className="h-4 w-4" />
                Crear colección
              </button>
            </div>
          </div>
        ) : filteredCollections.length === 0 ? (
          <div className="flex min-h-[calc(100dvh-10rem)] flex-1 items-center justify-center p-8">
            <div className="text-center">
              <Search className="mx-auto mb-4 h-10 w-10 text-slate-500" />
              <p className="text-sm text-slate-400">
                No se encontraron colecciones para &quot;{searchQuery}&quot;
              </p>
            </div>
          </div>
        ) : (
          <ScrollArea className="h-[calc(100vh-4.75rem)] h-[calc(100dvh-4.75rem)]">
            <div className="grid auto-rows-auto grid-cols-[repeat(auto-fill,minmax(280px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-4 p-5">
              <AnimatePresence mode="popLayout">
                {filteredCollections.map((collection) => (
                  <CollectionCard
                    key={collection.id}
                    collection={collection}
                    itemCount={collection.itemIds.length}
                    coverUrl={getCoverUrl(collection)}
                    galleryItems={galleryItems}
                    onEdit={() => handleOpenEdit(collection)}
                    onDelete={() => setDeleteTarget(collection)}
                    onClick={() => handleOpenDetail(collection)}
                  />
                ))}
              </AnimatePresence>
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Asset Picker — opens after collection creation */}
      <AssetPicker
        open={pickerState.open}
        onClose={() => setPickerState((s) => ({ ...s, open: false }))}
        collectionId={pickerState.collectionId}
        collectionName={pickerState.collectionName}
        collectionColor={pickerState.collectionColor}
        onComplete={(addedIds) => {
          // Auto-navigate to the collection detail after adding items
          if (addedIds.length > 0) {
            setSelectedCollectionId(pickerState.collectionId)

            // Auto-set first item as cover if collection has no cover
            const collection = useCollections.getState().getById(pickerState.collectionId)
            if (collection && !collection.coverImageId) {
              useCollections.getState().update(pickerState.collectionId, { coverImageId: addedIds[0] })
            }
          }
        }}
      />

      <CollectionDialogs
        createOpen={createOpen}
        editTarget={editTarget}
        deleteTarget={deleteTarget}
        formData={formData}
        setFormData={setFormData}
        setCreateOpen={setCreateOpen}
        setEditTarget={setEditTarget}
        setDeleteTarget={setDeleteTarget}
        onHandleCreate={handleCreate}
        onHandleEdit={handleEdit}
        onHandleDelete={handleDelete}
      />
    </>
  )
}
