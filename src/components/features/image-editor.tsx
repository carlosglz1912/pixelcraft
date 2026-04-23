'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Loader2, Upload, X, Maximize2, Eraser } from 'lucide-react'
import { toast } from 'sonner'
import { upscaleImage, removeBackground } from '@/lib/actions'
import { estimateImageTransformCostFromUrl } from '@/lib/image-dimensions'
import { useGallery } from '@/stores/gallery'
import { 
  UPSCALE_MODELS, 
  BG_REMOVAL_MODELS,
  getCostTierLabel,
  getUpscaleModelConfig,
  getBgRemovalModelConfig,
  type UpscaleModelId,
  type BgRemovalModelId
} from '@/types'
import type { GeneratedMediaBase } from '@/types'
import { ModelInfoTooltip } from '@/components/model-info-tooltip'
import { TooltipProvider } from '@/components/ui/tooltip'

type EditMode = 'upscale' | 'remove-bg'

export function ImageEditor() {
  const [imageUrl, setImageUrl] = useState('')
  const [mode, setMode] = useState<EditMode>('upscale')
  const [upscaleModel, setUpscaleModel] = useState<UpscaleModelId>('fal-ai/imageutils/super-resolution')
  const [bgRemovalModel, setBgRemovalModel] = useState<BgRemovalModelId>('fal-ai/imageutils/rembg')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  
  const addToGallery = useGallery((s) => s.addWithPersistence)
  const addPending = useGallery((s) => s.addPending)
  const removePending = useGallery((s) => s.removePending)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      setImageUrl(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  async function handleProcess() {
    if (!imageUrl) {
      toast.error('Sube una imagen primero')
      return
    }

    const modelUsed = mode === 'upscale' ? upscaleModel : bgRemovalModel
    const config = mode === 'upscale'
      ? getUpscaleModelConfig(upscaleModel)
      : getBgRemovalModelConfig(bgRemovalModel)
    let estimatedCost: number | undefined

    if (mode === 'upscale') {
      try {
        estimatedCost = (
          await estimateImageTransformCostFromUrl({
            model: upscaleModel,
            imageUrl,
          })
        )?.amount
      } catch (error) {
        console.warn('Failed to estimate upscale cost:', error)
      }
    }

    let pendingIds = addPending({
      type: 'image',
      prompt: mode === 'upscale' ? 'Upscalado' : 'Fondo eliminado',
      model: modelUsed,
      costTier: config?.costTier,
      metadata: {
        estimatedCost,
      },
    })

    setLoading(true)
    setResult(null)

    try {
      let data
      
      if (mode === 'upscale') {
        data = await upscaleImage({ 
          imageUrl,
          model: upscaleModel 
        })
      } else {
        data = await removeBackground({ 
          imageUrl,
          model: bgRemovalModel 
        })
      }

      const resultUrl = data.image?.url
      
      if (resultUrl) {
        removePending(pendingIds)
        pendingIds = []

        const item: GeneratedMediaBase = {
          type: 'image',
          url: resultUrl,
          prompt: mode === 'upscale' ? 'Upscalado' : 'Fondo eliminado',
          model: modelUsed,
          costTier: config?.costTier,
          metadata: {
            costTier: config?.costTier,
            estimatedCost,
          },
        }
        void addToGallery(item)
        setResult(resultUrl)
        toast.success('Imagen procesada')
      } else {
        removePending(pendingIds)
        pendingIds = []
        toast.error('No se recibió imagen procesada')
      }
    } catch (error) {
      removePending(pendingIds)
      pendingIds = []
      toast.error('Error al procesar imagen')
      console.error(error)
    } finally {
      if (pendingIds.length > 0) {
        removePending(pendingIds)
      }
      setLoading(false)
    }
  }

  return (
    <TooltipProvider>
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Imagen</Label>
          <div className="relative">
            {imageUrl ? (
              <Card className="relative aspect-square overflow-hidden bg-muted/50">
                <Image
                  src={imageUrl}
                   alt="Origen"
                  fill
                  className="object-contain"
                  unoptimized
                />
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute right-2 top-2"
                  onClick={() => setImageUrl('')}
                >
                  <X className="h-4 w-4" />
                </Button>
              </Card>
            ) : (
              <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50 hover:border-muted-foreground/50">
                <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Sube una imagen
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Operación</Label>
          <Select value={mode} onValueChange={(v) => setMode(v as EditMode)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="upscale">
                <div className="flex items-center gap-2">
                  <Maximize2 className="h-4 w-4" />
                  Upscale
                </div>
              </SelectItem>
              <SelectItem value="remove-bg">
                <div className="flex items-center gap-2">
                  <Eraser className="h-4 w-4" />
                  Remove Background
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {mode === 'upscale' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Modelo</Label>
              <ModelInfoTooltip 
                info={getUpscaleModelConfig(upscaleModel)?.info} 
                costTier={getUpscaleModelConfig(upscaleModel)?.costTier} 
                modelName={getUpscaleModelConfig(upscaleModel)?.name || upscaleModel}
              />
            </div>
            <Select value={upscaleModel} onValueChange={(v) => setUpscaleModel(v as UpscaleModelId)}>
              <SelectTrigger>
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
          </div>
        )}

        {mode === 'remove-bg' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Modelo</Label>
              <ModelInfoTooltip 
                info={getBgRemovalModelConfig(bgRemovalModel)?.info} 
                costTier={getBgRemovalModelConfig(bgRemovalModel)?.costTier} 
                modelName={getBgRemovalModelConfig(bgRemovalModel)?.name || bgRemovalModel}
              />
            </div>
            <Select value={bgRemovalModel} onValueChange={(v) => setBgRemovalModel(v as BgRemovalModelId)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(BG_REMOVAL_MODELS).map(([id, config]) => (
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
          </div>
        )}

        <Button
          onClick={handleProcess}
          disabled={loading || !imageUrl}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Procesando...
            </>
          ) : (
            <>
              {mode === 'upscale' ? (
                <Maximize2 className="mr-2 h-4 w-4" />
              ) : (
                <Eraser className="mr-2 h-4 w-4" />
              )}
              Procesar
            </>
          )}
        </Button>
      </div>

      <div className="flex items-center justify-center">
        <Card className="relative aspect-square w-full max-w-md overflow-hidden bg-muted/50">
          {loading ? (
            <>
              <Skeleton className="h-full w-full rounded-none" />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/45">
                <Loader2 className="h-8 w-8 animate-spin text-foreground" />
                <p className="text-sm font-medium text-foreground">Procesando imagen...</p>
              </div>
            </>
          ) : result ? (
            <Image
              src={result}
               alt="Resultado"
              fill
              className="object-contain"
              unoptimized
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              {mode === 'upscale' ? (
                <Maximize2 className="h-12 w-12 opacity-50" />
              ) : (
                <Eraser className="h-12 w-12 opacity-50" />
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
    </TooltipProvider>
  )
}
