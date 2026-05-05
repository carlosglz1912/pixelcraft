'use client'

import { useState, useMemo, useCallback } from 'react'
import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useGallery } from '@/stores/gallery'
import { useCollections } from '@/stores/collections'
import {
  type GeneratedMedia,
  type CostTier,
  COLLECTION_COLORS,
  type CollectionColor,
} from '@/types'
import {
  Image as ImageIcon,
  Video,
  Check,
  ArrowRight,
  X,
  ArrowLeft,
  Maximize2,
  Download,
  FolderOpen,
} from 'lucide-react'
import { toast } from 'sonner'
import { AnimatePresence, motion, galleryItemVariants } from '@/lib/motion'
import { createDownloadStem, downloadRemoteFile } from '@/lib/download'

// ── Types ──────────────────────────────────────────────────────────

interface AssetPickerProps {
  open: boolean
  onClose: () => void
  collectionId: string
  collectionName: string
  collectionColor: CollectionColor
  /** Called after items are added, with the list of added item IDs */
  onComplete?: (addedItemIds: string[]) => void
}

const COST_TIER_COLORS: Record<CostTier, string> = {
  free: 'bg-green-500',
  low: 'bg-green-400',
  medium: 'bg-yellow-500',
  high: 'bg-orange-500',
  premium: 'bg-red-500',
}

const COST_TIER_LABELS: Record<CostTier, string> = {
  free: 'Gratis',
  low: '$',
  medium: '$$',
  high: '$$$',
  premium: '$$$$',
}

type SortMode = 'newest' | 'oldest' | 'type'

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

// ── Main Component ─────────────────────────────────────────────────

export function AssetPicker({
  open,
  onClose,
  collectionId,
  collectionName,
  collectionColor,
  onComplete,
}: AssetPickerProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [previewItem, setPreviewItem] = useState<GeneratedMedia | null>(null)
  const [sortMode, setSortMode] = useState<SortMode>('newest')

  const items = useGallery((s) => s.items)
  const addItemsToCollection = useCollections((s) => s.addItems)
  const colorConfig = COLLECTION_COLORS[collectionColor] ?? COLLECTION_COLORS.blue

  // Filter out data/blob URLs (unpersisted local uploads)
  const availableItems = useMemo(() => {
    const filtered = items.filter(
      (item) => !item.url.startsWith('data:') && !item.url.startsWith('blob:')
    )

    switch (sortMode) {
      case 'newest':
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        break
      case 'oldest':
        filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        break
      case 'type':
        filtered.sort((a, b) => {
          if (a.type !== b.type) return a.type === 'video' ? -1 : 1
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        })
        break
    }

    return filtered
  }, [items, sortMode])

  const toggleItem = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  function handleConfirm() {
    if (selectedIds.size === 0) {
      onClose()
      return
    }

    const ids = Array.from(selectedIds)
    addItemsToCollection(collectionId, ids)
    toast.success(
      `${ids.length} elemento${ids.length !== 1 ? 's' : ''} añadido${ids.length !== 1 ? 's' : ''} a "${collectionName}"`
    )
    onComplete?.(ids)
    setSelectedIds(new Set())
    setPreviewItem(null)
    onClose()
  }

  function handleSkip() {
    setSelectedIds(new Set())
    setPreviewItem(null)
    onClose()
  }

  function handleDownloadItem(item: GeneratedMedia) {
    try {
      downloadRemoteFile(
        item.url,
        createDownloadStem({
          type: item.type,
          prompt: item.prompt,
          model: item.model,
          fallback: `${item.type}-${item.id}`,
        })
      )
    } catch {
      toast.error('No se pudo descargar')
    }
  }

  // ── Render ─────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleSkip() }}>
      <DialogContent
        className="depth-mixed flex max-h-[92vh] max-h-[92dvh] flex-col gap-0 overflow-hidden border-secondary/25 bg-slate-950/95 p-0 text-white sm:max-w-4xl"
        showCloseButton={false}
      >
        {/* Header — fixed, never scrolls */}
        <div className="shrink-0 border-b border-secondary/20 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${colorConfig.bg} ${colorConfig.border} border`}>
                <FolderOpen className={`h-4 w-4 ${colorConfig.dot}`} />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-white text-base">
                  Añadir assets a <span className={colorConfig.dot.replace('bg-', 'text-')}>{collectionName}</span>
                </DialogTitle>
                <DialogDescription className="text-slate-400 text-xs mt-0.5">
                  Selecciona elementos de tu galería para añadir a la colección
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {selectedIds.size > 0 && (
                <Badge className={`text-xs text-white ${colorConfig.dot}`}>
                  {selectedIds.size} seleccionado{selectedIds.size !== 1 ? 's' : ''}
                </Badge>
              )}
              <Badge variant="secondary" className="depth-secondary border border-secondary/20 bg-secondary/10 text-xs text-secondary-tint">
                {availableItems.length} disponible{availableItems.length !== 1 ? 's' : ''}
              </Badge>
            </div>
          </div>
        </div>

        {/* Sort controls — fixed */}
        <div className="shrink-0 border-b border-secondary/15 px-6 py-2.5">
          <div className="depth-secondary flex items-center gap-1 rounded-2xl border border-secondary/15 bg-secondary/10 px-1 py-0.5">
            {(['newest', 'oldest', 'type'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setSortMode(mode)}
                className={`rounded-xl px-2.5 py-1 text-xs font-medium transition ${
                  sortMode === mode
                    ? 'bg-primary/20 text-primary-tint'
                    : 'text-secondary-tint hover:text-white'
                }`}
              >
                {mode === 'newest' ? 'Recientes' : mode === 'oldest' ? 'Antiguos' : 'Tipo'}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable content area — this is the only part that scrolls */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {previewItem ? (
            /* ── Preview view ── */
            <div className="flex flex-col">
              {/* Preview toolbar */}
              <div className="flex items-center gap-3 border-b border-secondary/15 px-6 py-3">
                <button
                  type="button"
                  onClick={() => setPreviewItem(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-secondary/15 bg-secondary/10 text-secondary-tint transition hover:bg-secondary/15 hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <span className="text-sm font-medium text-white">Vista previa</span>
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={() => handleDownloadItem(previewItem)}
                  className="flex h-8 items-center gap-1.5 rounded-xl border border-secondary/15 bg-secondary/10 px-3 text-xs font-medium text-secondary-tint transition hover:bg-secondary/15 hover:text-white"
                >
                  <Download className="h-3.5 w-3.5" />
                  Descargar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    toggleItem(previewItem.id)
                    setPreviewItem(null)
                  }}
                  className={`flex h-8 items-center gap-1.5 rounded-xl px-3 text-xs font-medium transition ${
                    selectedIds.has(previewItem.id)
                      ? `${colorConfig.bg} ${colorConfig.border} border text-white`
                      : `border ${colorConfig.border} bg-transparent text-white hover:${colorConfig.bg}`
                  }`}
                >
                  <Check className="h-3.5 w-3.5" />
                  {selectedIds.has(previewItem.id) ? 'Seleccionado' : 'Seleccionar'}
                </button>
              </div>

              {/* Preview image + metadata */}
              <div className="p-6">
                <div className="depth-mixed mx-auto max-w-2xl overflow-hidden rounded-[1.5rem] border border-secondary/20 bg-black">
                  {previewItem.type === 'video' ? (
                    <video
                      src={previewItem.url}
                      controls
                      autoPlay
                      className="max-h-[55vh] max-h-[55dvh] w-full object-contain"
                    />
                  ) : (
                    <Image
                      src={previewItem.url}
                      alt={previewItem.prompt}
                      width={1200}
                      height={1200}
                      className="max-h-[55vh] max-h-[55dvh] h-auto w-full object-contain"
                      unoptimized
                    />
                  )}
                </div>

                <div className="mx-auto mt-4 max-w-2xl space-y-3">
                  <p className="text-sm text-slate-300">{previewItem.prompt}</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="depth-secondary border border-secondary/20 bg-secondary/10 text-secondary-tint">
                      {getDisplayModel(previewItem.model)}
                    </Badge>
                    {previewItem.costTier && (
                      <Badge className={`text-xs text-white ${COST_TIER_COLORS[previewItem.costTier]}`}>
                        {COST_TIER_LABELS[previewItem.costTier]}
                      </Badge>
                    )}
                    <Badge variant="secondary" className="depth-primary border border-primary/20 bg-primary/10 text-primary-tint">
                      {new Date(previewItem.createdAt).toLocaleString()}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          ) : availableItems.length === 0 ? (
            /* ── Empty state ── */
            <div className="flex items-center justify-center p-12">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-secondary/20 bg-secondary/10">
                  <ImageIcon className="h-7 w-7 text-secondary-tint" />
                </div>
                <p className="text-sm font-medium text-white">Sin assets disponibles</p>
                <p className="mt-2 text-xs text-slate-400">
                  Genera contenido primero para poder añadirlo a tus colecciones.
                </p>
                <Button
                  onClick={handleSkip}
                  className="depth-primary mt-6 rounded-2xl border border-primary/25 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Entendido
                </Button>
              </div>
            </div>
          ) : (
            /* ── Asset grid ── */
            <div className="grid auto-rows-auto grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3 p-6">
              <AnimatePresence mode="popLayout">
                {availableItems.map((item, index) => {
                  const isSelected = selectedIds.has(item.id)
                  return (
                    <motion.div
                      key={item.id}
                      layout
                      variants={galleryItemVariants}
                      initial="initial"
                      animate={{ opacity: 1, scale: 1 }}
                      exit="exit"
                      className="group relative animate-in fade-in slide-in-from-bottom-4 fill-mode-both"
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      <button
                        type="button"
                        onClick={() => toggleItem(item.id)}
                        className={`depth-mixed block w-full overflow-hidden rounded-2xl border text-left transition ${
                          isSelected
                            ? `${colorConfig.border} ring-2 ring-offset-2 ring-offset-slate-950 ${colorConfig.dot.replace('bg-', 'ring-')}`
                            : 'border-secondary/15 hover:border-secondary/30'
                        }`}
                      >
                        <div className={`relative w-full bg-black/40 ${getMediaFrameClass(item.type, item.metadata)}`}>
                          {item.type === 'video' ? (
                            <video
                              src={item.url}
                              className="absolute inset-0 h-full w-full object-cover"
                              muted
                              playsInline
                            />
                          ) : (
                            <Image
                              src={item.url}
                              alt={item.prompt}
                              fill
                              className="object-cover"
                              loading={index < 12 ? 'eager' : 'lazy'}
                              unoptimized
                            />
                          )}

                          {/* Selection overlay */}
                          <div className={`absolute inset-0 flex items-center justify-center transition-colors ${
                            isSelected ? `${colorConfig.bg}` : 'bg-transparent group-hover:bg-black/20'
                          }`}>
                            {isSelected && (
                              <div className={`flex h-8 w-8 items-center justify-center rounded-full ${colorConfig.dot}`}>
                                <Check className="h-4 w-4 text-white" />
                              </div>
                            )}
                          </div>

                          {/* Type badge */}
                          {item.type === 'video' && (
                            <div className="absolute top-1.5 left-1.5">
                              <span className="flex items-center gap-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[0.6rem] text-white backdrop-blur-sm">
                                <Video className="h-2.5 w-2.5" />
                                Video
                              </span>
                            </div>
                          )}

                          {/* Cost badge */}
                          {item.costTier && (
                            <div className="absolute top-1.5 right-1.5">
                              <span className={`inline-block rounded-full px-1.5 py-0.5 text-[0.55rem] text-white ${COST_TIER_COLORS[item.costTier]}`}>
                                {COST_TIER_LABELS[item.costTier]}
                              </span>
                            </div>
                          )}

                          {/* Preview button */}
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={(e) => { e.stopPropagation(); setPreviewItem(item) }}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setPreviewItem(item) } }}
                            className="absolute bottom-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-lg border border-white/20 bg-black/50 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 hover:bg-black/70"
                          >
                            <Maximize2 className="h-3 w-3" />
                          </div>
                        </div>

                        <div className="px-2.5 py-2">
                          <p className="truncate text-[0.65rem] text-slate-300">
                            {getDisplayModel(item.model)}
                          </p>
                        </div>
                      </button>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Footer — fixed, never scrolls */}
        <div className="shrink-0 border-t border-secondary/20 px-6 py-4">
          <div className="flex w-full items-center justify-between">
            <Button
              variant="ghost"
              onClick={handleSkip}
              className="depth-secondary rounded-2xl border border-secondary/15 bg-secondary/10 text-secondary-tint hover:bg-secondary/15 hover:text-white"
            >
              <X className="mr-1.5 h-3.5 w-3.5" />
              Omitir
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={selectedIds.size === 0}
              className="depth-primary rounded-2xl border border-primary/25 bg-primary px-6 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {selectedIds.size > 0
                ? `Añadir ${selectedIds.size} elemento${selectedIds.size !== 1 ? 's' : ''}`
                : 'Selecciona assets'}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
