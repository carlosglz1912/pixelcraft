'use client'

import { useEffect, useState, useMemo } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton, SkeletonShimmer } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  getVideoGenerationResultIfReady,
  getVideoGenerationStatus,
  removeBackground,
  upscaleImage,
} from '@/lib/actions'
import { formatCostEstimate, formatCostEstimateMxn } from '@/lib/cost-estimate'
import { createDownloadStem, downloadRemoteFile } from '@/lib/download'
import { estimateImageTransformCostFromUrl } from '@/lib/image-dimensions'
import { useGallery } from '@/stores/gallery'
import {
  BG_REMOVAL_MODELS,
  UPSCALE_MODELS,
  getCostTierLabel,
  getUpscaleModelConfig,
  getBgRemovalModelConfig,
  getVideoEndpoint,
  type BgRemovalModelId,
  type GeneratedMedia,
  type GeneratedMediaBase,
  type UpscaleModelId,
  type CostTier,
  type PendingMedia,
} from '@/types'
import { EditHistory } from '@/components/features/edit-history'
import {
  ArrowDownUp,
  ArrowRight,
  Database,
  Download,
  Eraser,
  Expand,
  Image as ImageIcon,
  Sparkles,
  Trash2,
  Video,
  Clock,
  Maximize2,
  Ratio,
  Cloud,
  CloudOff,
  Upload,
  AlertCircle,
  RotateCcw,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { AnimatePresence, motion, galleryItemVariants } from '@/lib/motion'

const COST_TIER_CONFIG: Record<CostTier, { label: string; color: string }> = {
  free: { label: 'Gratis', color: 'bg-green-500' },
  low: { label: '$', color: 'bg-green-400' },
  medium: { label: '$$', color: 'bg-yellow-500' },
  high: { label: '$$$', color: 'bg-orange-500' },
  premium: { label: '$$$$', color: 'bg-red-500' },
}

const activeVideoSyncRequests = new Set<string>()

function CostBadge({ tier }: { tier?: CostTier }) {
  if (!tier) return null
  const config = COST_TIER_CONFIG[tier]
  return (
    <Badge className={`text-xs text-white ${config.color}`}>
      {config.label}
    </Badge>
  )
}

function EstimatedCostBadge({ amount }: { amount?: number }) {
  if (typeof amount !== 'number' || Number.isNaN(amount)) return null
  return (
    <Badge variant="secondary" className="depth-secondary border border-primary/20 bg-primary/10 text-primary-tint">
      Est. {formatCostEstimateMxn(amount)}
    </Badge>
  )
}

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
    case 'landscape_4_3':
      return 'aspect-[4/3]'
    case 'portrait_4_3':
      return 'aspect-[3/4]'
    case 'landscape_16_9':
      return 'aspect-video'
    case 'portrait_16_9':
      return 'aspect-[9/16]'
    case 'square':
    case 'square_hd':
      return 'aspect-square'
    default:
      return 'aspect-square'
  }
}

function getDisplayModel(model: string, type: 'image' | 'video', videoMode?: string) {
  if (model === 'upload') return 'Subida por usuario'
  
  const normalizedModel = model.replace(/^fal-ai\//, '')

  if (type === 'video' && (videoMode === 'text-to-video' || videoMode === 'image-to-video')) {
    return getVideoEndpoint(normalizedModel, videoMode) ?? normalizedModel
  }

  return normalizedModel
}

function PendingGalleryCard({ item }: { item: PendingMedia }) {
  const frameClass = getMediaFrameClass(item.type, item.metadata)
  const displayModel = getDisplayModel(item.model, item.type, item.metadata?.videoMode)

  return (
    <div className="depth-mixed overflow-hidden rounded-2xl border border-secondary/15 bg-slate-900/78 text-left">
      <div className="relative overflow-hidden">
        <SkeletonShimmer
          className={`${frameClass} w-full rounded-none`}
        />
        <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-2">
          <span className="rounded-full border border-secondary/20 bg-slate-950/80 px-3 py-1 text-xs font-medium text-white">
            Generando...
          </span>
        </div>
      </div>
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          {item.type === 'video' ? (
            <Video className="h-3.5 w-3.5 shrink-0 text-secondary-tint" />
          ) : (
            <ImageIcon className="h-3.5 w-3.5 shrink-0 text-primary-tint" />
          )}
          <p className="truncate text-xs font-medium text-white">{displayModel}</p>
          <CostBadge tier={item.costTier} />
        </div>
      </div>
    </div>
  )
}

function FailedGalleryCard({ item }: { item: PendingMedia }) {
  const displayModel = getDisplayModel(item.model, item.type, item.metadata?.videoMode)
  const dismissPending = useGallery((state) => state.dismissPending)

  function handleRetry() {
    dismissPending(item.id)
    toast.info('Genera nuevamente con los mismos parámetros desde el panel lateral')
  }

  function handleDismiss() {
    dismissPending(item.id)
  }

  return (
    <div className="depth-mixed overflow-hidden rounded-2xl border border-red-500/20 bg-slate-900/78 text-left">
      <div className="flex min-h-[120px] flex-col items-center justify-center gap-2 bg-red-950/30 px-4 py-6">
        <AlertCircle className="h-8 w-8 text-red-400" />
        <p className="max-w-full text-center text-xs text-red-400">
          {item.error ?? 'Error desconocido'}
        </p>
      </div>
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          {item.type === 'video' ? (
            <Video className="h-3.5 w-3.5 shrink-0 text-secondary-tint" />
          ) : (
            <ImageIcon className="h-3.5 w-3.5 shrink-0 text-primary-tint" />
          )}
          <p className="truncate text-xs font-medium text-white">{displayModel}</p>
          <CostBadge tier={item.costTier} />
        </div>
      </div>
      <div className="flex items-center gap-1 border-t border-secondary/15 px-3 py-2">
        <button
          type="button"
          onClick={handleRetry}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-primary-tint transition hover:bg-primary/10"
        >
          <RotateCcw className="h-3 w-3" />
          Reintentar
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 transition hover:text-white"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

interface GalleryProps {
  onSwitchTab?: (tab: 'gallery' | 'storage') => void
}

export function Gallery({ onSwitchTab }: GalleryProps) {
  const [selected, setSelected] = useState<GeneratedMedia | null>(null)
  const [upscaleModel, setUpscaleModel] = useState<UpscaleModelId>('fal-ai/imageutils/super-resolution')
  const [bgRemovalModel, setBgRemovalModel] = useState<BgRemovalModelId>('fal-ai/imageutils/rembg')
  const [loadingAction, setLoadingAction] = useState<'upscale' | 'remove-bg' | null>(null)
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'type'>('newest')

  const router = useRouter()
  const items = useGallery((state) => state.items)
  const pendingItems = useGallery((state) => state.pendingItems)
  const add = useGallery((state) => state.add)
  const addWithPersistence = useGallery((state) => state.addWithPersistence)
  const addPending = useGallery((state) => state.addPending)
  const removePending = useGallery((state) => state.removePending)
  const markPendingFailed = useGallery((state) => state.markPendingFailed)
  const dismissPending = useGallery((state) => state.dismissPending)
  const remove = useGallery((state) => state.remove)
  const clear = useGallery((state) => state.clear)
  const getById = useGallery((state) => state.getById)
  const isPersisting = useGallery((state) => state.isPersisting)
  const hydrateFromR2 = useGallery((state) => state.hydrateFromR2)
  const migrateUnpersistedItems = useGallery((state) => state.migrateUnpersistedItems)
  const getEditHistory = useGallery((state) => state.getEditHistory)

  const sortedItems = useMemo(() => {
    const sorted = [...items]
    switch (sortBy) {
      case 'newest':
        sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        break
      case 'oldest':
        sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        break
      case 'type':
        sorted.sort((a, b) => {
          if (a.type !== b.type) return a.type === 'video' ? -1 : 1
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        })
        break
    }
    return sorted
  }, [items, sortBy])

  useEffect(() => {
    const staleIds = pendingItems
      .filter((item) => item.type === 'video' && !item.metadata?.requestId)
      .map((item) => item.id)

    if (staleIds.length > 0) {
      console.info('[gallery.cleanup]', { staleIds })
      removePending(staleIds)
    }

    console.info('[gallery.pending]', {
      total: pendingItems.length,
      videos: pendingItems.filter(i => i.type === 'video').length,
      images: pendingItems.filter(i => i.type === 'image').length,
    })

    for (const item of pendingItems) {
      if (item.type !== 'video') continue

      const requestId = item.metadata?.requestId

      if (!requestId || activeVideoSyncRequests.has(requestId)) {
        continue
      }

      activeVideoSyncRequests.add(requestId)

      console.info('[video.polling.start]', {
        requestId,
        model: item.model,
        mode: item.metadata?.videoMode,
        prompt: item.prompt.substring(0, 50),
      })

      void (async () => {
        let failures = 0

        const persistCompletedVideo = async (videoUrl: string) => {
          const { requestId: _requestId, ...metadata } = item.metadata ?? {}

          await addWithPersistence({
            type: 'video',
            url: videoUrl,
            prompt: item.prompt,
            model: item.model,
            costTier: item.costTier,
            metadata,
          })
        }

        while (failures < 5) {
          try {
            const status = await getVideoGenerationStatus({
              model: item.model,
              mode: item.metadata?.videoMode,
              requestId,
            })

            console.info('[video.polling.check]', {
              requestId,
              failures,
              status: status.status,
            })

            if (status.status === 'COMPLETED') {
              let result

              try {
                result = await getVideoGenerationResultIfReady({
                  model: item.model,
                  mode: item.metadata?.videoMode,
                  requestId,
                })
              } catch (error) {
                console.error('[video.polling.failed]', {
                  requestId,
                  error,
                })
                const errorMsg = error instanceof Error && error.message
                  ? error.message
                  : 'Falló la generación del video'
                markPendingFailed(item.id, errorMsg)
                toast.error(errorMsg)
                return
              }

              if (!result) {
                failures += 1
                console.info('[video.polling.result.pending]', { requestId, failures })
                await new Promise((resolve) => window.setTimeout(resolve, 4000))
                continue
              }

              const videoUrl = result.data.video?.url

              if (!videoUrl) {
                markPendingFailed(item.id, 'No se recibió video')
                toast.error('No se recibió video')
                return
              }

              await persistCompletedVideo(videoUrl)
              console.info('[video.polling.complete]', { requestId })
              removePending([item.id])
              toast.success('Video generado')
              return
            }

            if ((status.status as string) === 'FAILED' || (status.status as string) === 'CANCELLED') {
              console.error('[video.polling.terminal]', {
                requestId,
                status: status.status,
                logs: status.logs,
              })
              markPendingFailed(item.id, 'Falló la generación del video')
              toast.error('Falló la generación del video')
              return
            }

            failures = 0
          } catch (error) {
            failures += 1
            console.error('Failed to sync pending video:', error)
          }

          await new Promise((resolve) => window.setTimeout(resolve, 4000))
        }

        markPendingFailed(item.id, 'No se pudo recuperar el video en cola')
        toast.error('No se pudo recuperar el video en cola')
      })().finally(() => {
        activeVideoSyncRequests.delete(requestId)
      })
    }
  }, [addWithPersistence, pendingItems, removePending, markPendingFailed])

  useEffect(() => {
    void hydrateFromR2()
  }, [hydrateFromR2])

  useEffect(() => {
    migrateUnpersistedItems()
  }, [items, migrateUnpersistedItems])

  async function handleCreateVariant(
    variant: Omit<GeneratedMediaBase, 'url'>,
    nextUrl: string | undefined,
    successMessage: string
  ) {
    if (!nextUrl) {
      toast.error('No se recibió resultado')
      return
    }

    const id = add({
      ...variant,
      url: nextUrl,
    })

    const nextItem = getById(id)
    if (nextItem) {
      setSelected(nextItem)
    }

    toast.success(successMessage)
  }

  async function handleUpscaleSelected() {
    if (!selected || selected.type !== 'image') return

    setLoadingAction('upscale')
    const config = getUpscaleModelConfig(upscaleModel)
    let estimatedCost: number | undefined

    try {
      estimatedCost = (
        await estimateImageTransformCostFromUrl({
          model: upscaleModel,
          imageUrl: selected.url,
        })
      )?.amount
    } catch (error) {
      console.warn('Failed to estimate upscale cost:', error)
    }

    let pendingIds = addPending({
      type: 'image',
      prompt: `${selected.prompt} (upscaled)`,
      model: upscaleModel,
      costTier: config?.costTier,
      metadata: {
        estimatedCost,
      },
    })

    try {
      const data = await upscaleImage({
        imageUrl: selected.url,
        model: upscaleModel,
      })

      removePending(pendingIds)
      pendingIds = []

      await handleCreateVariant(
        {
          type: 'image',
          prompt: `${selected.prompt} (upscaled)`,
          model: upscaleModel,
          costTier: config?.costTier,
          metadata: {
            sourceId: selected.id,
            costTier: config?.costTier,
            estimatedCost,
          },
        },
        data.image?.url,
        'Upscale completado'
      )
    } catch (error) {
      removePending(pendingIds)
      pendingIds = []
      toast.error('Error al hacer upscale')
      console.error(error)
    } finally {
      if (pendingIds.length > 0) {
        removePending(pendingIds)
      }
      setLoadingAction(null)
    }
  }

  async function handleRemoveBgSelected() {
    if (!selected || selected.type !== 'image') return

    setLoadingAction('remove-bg')
    const config = getBgRemovalModelConfig(bgRemovalModel)
    let pendingIds = addPending({
      type: 'image',
      prompt: `${selected.prompt} (background removed)`,
      model: bgRemovalModel,
      costTier: config?.costTier,
    })

    try {
      const data = await removeBackground({
        imageUrl: selected.url,
        model: bgRemovalModel,
      })

      removePending(pendingIds)
      pendingIds = []

      await handleCreateVariant(
        {
          type: 'image',
          prompt: `${selected.prompt} (background removed)`,
          model: bgRemovalModel,
          costTier: config?.costTier,
          metadata: { sourceId: selected.id, costTier: config?.costTier },
        },
        data.image?.url,
        'Fondo eliminado'
      )
    } catch (error) {
      removePending(pendingIds)
      pendingIds = []
      toast.error('Error al eliminar fondo')
      console.error(error)
    } finally {
      if (pendingIds.length > 0) {
        removePending(pendingIds)
      }
      setLoadingAction(null)
    }
  }

  function handleOpenConversation() {
    if (!selected || selected.type !== 'image') return
    router.push(`/conversation/${encodeURIComponent(selected.url)}`)
    setSelected(null)
  }

  async function handleDownloadItem(item: GeneratedMedia) {
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
    } catch (error) {
      console.error('Failed to download gallery item:', error)
      toast.error('No se pudo descargar el recurso')
    }
  }

  const canTransform = selected?.type === 'image'

  async function handleUploadImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      add({
        type: 'image',
        url: dataUrl,
        prompt: 'Imagen subida',
        model: 'upload',
        costTier: 'free',
        metadata: { source: 'upload' },
      })
      toast.success('Imagen añadida a la galería')
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  return (
    <>
      <div className="flex h-full flex-col">
        <div className="surface-secondary flex items-center justify-between gap-3 border-b border-secondary/20 px-5 py-4">
           <div className="flex min-w-0 items-center gap-2">
             <Badge variant="secondary" className="depth-secondary border border-secondary/20 bg-secondary/10 text-secondary-tint">
               Gallery
             </Badge>
             <Badge variant="secondary" className="depth-primary border border-primary/20 bg-primary/10 text-primary-tint">
               {items.length}
             </Badge>
             {pendingItems.length > 0 && (
               <Badge variant="secondary" className="depth-secondary border border-secondary/20 bg-secondary/10 text-secondary-tint">
                 <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-secondary-tint animate-pulse" />
                 {pendingItems.length} en cola
               </Badge>
             )}
             {isPersisting && (
               <Badge variant="secondary" className="depth-primary border border-green-500/20 bg-green-500/10 text-green-400">
                 <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                 Guardando...
               </Badge>
             )}
           </div>
            <div className="flex items-center gap-2">
              <div className="depth-secondary flex items-center gap-1 rounded-2xl border border-secondary/15 bg-secondary/10 px-1 py-0.5">
                <button
                  type="button"
                  onClick={() => setSortBy('newest')}
                  className={`rounded-xl px-2.5 py-1 text-xs font-medium transition ${sortBy === 'newest' ? 'bg-primary/20 text-primary-tint' : 'text-secondary-tint hover:text-white'}`}
                >
                  Recientes
                </button>
                <button
                  type="button"
                  onClick={() => setSortBy('oldest')}
                  className={`rounded-xl px-2.5 py-1 text-xs font-medium transition ${sortBy === 'oldest' ? 'bg-primary/20 text-primary-tint' : 'text-secondary-tint hover:text-white'}`}
                >
                  Antiguos
                </button>
                <button
                  type="button"
                  onClick={() => setSortBy('type')}
                  className={`rounded-xl px-2.5 py-1 text-xs font-medium transition ${sortBy === 'type' ? 'bg-primary/20 text-primary-tint' : 'text-secondary-tint hover:text-white'}`}
                >
                  Tipo
                </button>
              </div>
              {onSwitchTab && (
               <button
                 type="button"
                 onClick={() => onSwitchTab('storage')}
                 className="depth-secondary rounded-2xl border border-secondary/15 bg-secondary/10 px-3 py-1.5 text-xs font-medium text-secondary-tint transition hover:bg-secondary/15 hover:text-white"
               >
                 <Database className="mr-1.5 inline h-3 w-3" />
                 R2 Storage
               </button>
             )}
             <label className="depth-secondary cursor-pointer rounded-2xl border border-secondary/15 bg-secondary/10 px-3 py-1.5 text-sm text-secondary-tint transition hover:bg-secondary/15 hover:text-white">
               <Upload className="mr-2 inline h-4 w-4" />
               Subir imagen
               <input
                 type="file"
                 accept="image/*"
                 className="hidden"
                 onChange={handleUploadImage}
               />
             </label>
             <Button
               variant="ghost"
               size="sm"
               onClick={clear}
               className="depth-secondary rounded-2xl border border-secondary/15 bg-secondary/10 text-secondary-tint hover:bg-secondary/15 hover:text-white"
             >
               <Trash2 className="mr-2 h-4 w-4" />
               Limpiar
             </Button>
           </div>
        </div>

        {items.length === 0 && pendingItems.length === 0 ? (
          <div className="flex min-h-[calc(100dvh-10rem)] flex-1 items-center justify-center p-8">
            <div className="depth-mixed max-w-md rounded-[2rem] border border-dashed border-secondary/15 bg-slate-900/70 px-12 py-16 text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 via-primary/10 to-transparent">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
                  <Sparkles className="h-8 w-8 text-primary-tint" />
                </div>
              </div>
              <p className="text-lg font-semibold text-white">Tu galería está vacía</p>
              <p className="mt-3 text-sm text-slate-400">
                Genera tu primera imagen o video para comenzar a crear.
              </p>
              <button
                type="button"
                className="mt-8 inline-flex items-center gap-2 rounded-2xl border border-primary/30 bg-primary/20 px-6 py-3 text-sm font-semibold text-primary-tint transition hover:bg-primary/30 hover:border-primary/40 active:scale-[0.98]"
              >
                <Sparkles className="h-4 w-4" />
                Comenzar a crear
              </button>
            </div>
          </div>
        ) : (
          <ScrollArea className="h-[calc(100vh-4.75rem)] h-[calc(100dvh-4.75rem)]">
            <div className="grid auto-rows-auto grid-cols-[repeat(auto-fill,minmax(280px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(360px,1fr))] gap-4 p-5">
              {pendingItems.map((item) =>
                item.status === 'failed' ? (
                  <FailedGalleryCard key={item.id} item={item} />
                ) : (
                  <PendingGalleryCard key={item.id} item={item} />
                )
              )}
              <AnimatePresence mode="popLayout">
              {sortedItems.map((item, index) => (
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
                  <button
                    type="button"
                    onClick={() => setSelected(item)}
                    className="depth-mixed card-hover block w-full overflow-hidden rounded-2xl border border-secondary/15 bg-slate-900/78 text-left transition"
                  >
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
                            priority={index === 0}
                            loading={index < 8 ? 'eager' : 'lazy'}
                            fetchPriority={index === 0 ? 'high' : undefined}
                            unoptimized
                          />
                        )}
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                      <div className="absolute right-2.5 top-2.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <span className="depth-primary rounded-full border border-primary/20 bg-primary/15 p-1.5 text-primary-tint">
                          <Expand className="h-3.5 w-3.5" />
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
                          {getDisplayModel(item.model, item.type, item.metadata?.videoMode)}
                        </p>
                        <CostBadge tier={item.costTier} />
                      </div>
                    </div>
                  </button>

                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    aria-label="Descargar recurso"
                    className="absolute right-1.5 top-1.5 z-10 h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() => void handleDownloadItem(item)}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </motion.div>
              ))}
              </AnimatePresence>
            </div>
          </ScrollArea>
        )}
      </div>

      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
      >
        <DialogContent className="depth-mixed max-h-[90vh] max-h-[90dvh] overflow-hidden border-secondary/25 bg-slate-950/95 p-0 text-white sm:max-w-6xl">
          {selected ? (
            <div className="grid max-h-[90vh] max-h-[90dvh] grid-cols-1 min-[1280px]:grid-cols-[minmax(0,1fr)_360px]">
              <div className="min-w-0 border-b border-secondary/20 min-[1280px]:border-b-0 min-[1280px]:border-r">
                <DialogHeader className="surface-secondary border-b border-secondary/20 px-5 py-4">
                  <DialogTitle className="flex items-center gap-2 text-white">
                    {selected.type === 'video' ? (
                      <Video className="h-5 w-5 text-secondary-tint" />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-primary-tint" />
                    )}
                     Vista previa
                   </DialogTitle>
                  <DialogDescription className="sr-only">
                    Vista previa del recurso seleccionado y acciones disponibles para editarlo o abrirlo.
                  </DialogDescription>
                </DialogHeader>

                <div className="p-5">
                  <div className="depth-mixed overflow-hidden rounded-[1.5rem] border border-secondary/20 bg-black">
                    {selected.type === 'video' ? (
                      <video
                        src={selected.url}
                        controls
                        autoPlay
                        className="max-h-[60vh] max-h-[60dvh] w-full object-contain"
                      />
                    ) : (
                      <Image
                        src={selected.url}
                        alt={selected.prompt}
                        width={1200}
                        height={1200}
                        className="max-h-[60vh] max-h-[60dvh] h-auto w-full object-contain"
                        unoptimized
                      />
                    )}
                  </div>

                  <div className="mt-4 space-y-3">
                    <p className="text-sm text-slate-300">{selected.prompt}</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary" className="depth-secondary border border-secondary/20 bg-secondary/10 text-secondary-tint">
                        {getDisplayModel(selected.model, selected.type, selected.metadata?.videoMode)}
                      </Badge>
                      <CostBadge tier={selected.costTier} />
                      <EstimatedCostBadge amount={selected.metadata?.estimatedCost} />
                      <Badge variant="secondary" className="depth-primary border border-primary/20 bg-primary/10 text-primary-tint">
                        {new Date(selected.createdAt).toLocaleString()}
                      </Badge>
                    </div>
                    {selected.metadata && (
                      <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                        {selected.metadata.persisted ? (
                          <span className="flex items-center gap-1 text-green-400">
                            <Cloud className="h-3 w-3" />
                            Persistido en R2
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-amber-400">
                            <CloudOff className="h-3 w-3" />
                            URL temporal
                          </span>
                        )}
                        {selected.metadata.duration && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {selected.metadata.duration}s
                          </span>
                        )}
                        {selected.metadata.aspectRatio && (
                          <span className="flex items-center gap-1">
                            <Ratio className="h-3 w-3" />
                            {selected.metadata.aspectRatio}
                          </span>
                        )}
                        {selected.metadata.resolution && (
                          <span className="flex items-center gap-1">
                            <Maximize2 className="h-3 w-3" />
                            {selected.metadata.resolution}
                          </span>
                        )}
                        {selected.metadata.imageSize && (
                          <span className="flex items-center gap-1">
                            <Maximize2 className="h-3 w-3" />
                            {selected.metadata.imageSize}
                          </span>
                        )}
                        {selected.metadata.seed && (
                          <span>Seed: {selected.metadata.seed}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex max-h-[90vh] max-h-[90dvh] flex-col">
                <div className="surface-secondary border-b border-secondary/20 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-secondary-tint">
                     Acciones de imagen
                   </p>
                </div>

                <ScrollArea className="flex-1">
                  <div className="space-y-4 p-4">
                    <div className="depth-primary rounded-3xl border border-primary/20 bg-primary/10 p-4">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary-tint" />
                         <p className="text-sm font-semibold text-white">Editar en conversación</p>
                       </div>
                       <p className="mt-2 text-sm text-slate-200">
                         Abre una ruta dedicada para iterar ediciones sobre esta imagen.
                       </p>
                       <Button
                         onClick={handleOpenConversation}
                         disabled={!canTransform}
                         className="depth-primary mt-4 h-11 w-full rounded-2xl border border-primary/25 bg-primary text-primary-foreground hover:bg-primary/90"
                       >
                         Abrir editor
                         <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>

                    <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
                      <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary-tint">
                        Upscale
                      </Label>
                      <Select value={upscaleModel} onValueChange={(value) => setUpscaleModel(value as UpscaleModelId)}>
                        <SelectTrigger className="depth-secondary mt-3 border border-secondary/20 bg-slate-900/70 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(UPSCALE_MODELS).map(([id, config]) => (
                            <SelectItem key={id} value={id}>
                              <div className="flex w-full items-center justify-between gap-3">
                                <span>{config.name}</span>
                                {getCostTierLabel(config.costTier) && (
                                  <span className="text-xs text-muted-foreground">
                                    {getCostTierLabel(config.costTier)}
                                  </span>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        onClick={handleUpscaleSelected}
                        disabled={!canTransform || loadingAction !== null}
                        className="depth-primary mt-4 h-11 w-full rounded-2xl border border-primary/25 bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        {loadingAction === 'upscale' ? (
                          <span className="mr-2 h-1.5 w-1.5 rounded-full bg-primary-foreground animate-pulse" />
                        ) : null}
                         Ejecutar upscale
                       </Button>
                     </div>

                     <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
                       <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-secondary-tint">
                         Eliminar fondo
                       </Label>
                      <Select value={bgRemovalModel} onValueChange={(value) => setBgRemovalModel(value as BgRemovalModelId)}>
                        <SelectTrigger className="depth-secondary mt-3 border border-secondary/20 bg-slate-900/70 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(BG_REMOVAL_MODELS).map(([id, config]) => (
                            <SelectItem key={id} value={id}>
                              {config.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        onClick={handleRemoveBgSelected}
                        disabled={!canTransform || loadingAction !== null}
                        className="depth-primary mt-4 h-11 w-full rounded-2xl border border-primary/25 bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        {loadingAction === 'remove-bg' ? (
                          <span className="mr-2 h-1.5 w-1.5 rounded-full bg-primary-foreground animate-pulse" />
                        ) : (
                          <Eraser className="mr-2 h-4 w-4" />
                        )}
                         Eliminar fondo
                       </Button>
                     </div>

                    {!canTransform ? (
                      <div className="depth-secondary rounded-3xl border border-secondary/20 bg-secondary/10 p-4 text-sm text-slate-200">
                        Las acciones de edición solo están disponibles para imágenes.
                      </div>
                    ) : null}

                    {selected && (() => {
                      const history = getEditHistory(selected.id)
                      return history.length > 1 ? (
                        <EditHistory
                          history={history}
                          currentItemId={selected.id}
                          onSelectItem={(item) => setSelected(item)}
                        />
                      ) : null
                    })()}

                    <Button
                      onClick={() => void handleDownloadItem(selected)}
                      className="depth-primary h-11 w-full rounded-2xl border border-primary/25 bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      <Download className="mr-2 h-4 w-4" />
                       Descargar recurso
                     </Button>

                     <Button
                       variant="ghost"
                       onClick={() => {
                         remove(selected.id)
                         setSelected(null)
                       }}
                       className="depth-secondary h-11 w-full rounded-2xl border border-secondary/15 bg-secondary/10 text-secondary-tint hover:bg-secondary/15 hover:text-white"
                     >
                       Eliminar de la galería
                     </Button>
                  </div>
                </ScrollArea>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
