'use client'

import { useCallback, useEffect, useState, type ChangeEvent } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Loader2, Sparkles, Download, Upload, X, Check, ChevronsUpDown, ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import { generateImage } from '@/lib/actions'
import { estimateImageGenerationCost } from '@/lib/cost-estimate'
import { createDownloadStem, downloadRemoteFile } from '@/lib/download'
import {
  getDefaultImageAspectRatio,
  getDefaultImageResolution,
  getDefaultImageSize,
  getImageAspectRatioOptions,
  getImageResolutionOptions,
  getImageSizeOptions,
  IMAGE_BACKGROUND_OPTIONS,
  IMAGE_OUTPUT_FORMAT_OPTIONS,
  IMAGE_QUALITY_OPTIONS,
} from '@/lib/image-model-controls'
import { useGallery } from '@/stores/gallery'
import {
  IMAGE_MODEL_FAMILIES,
  getCostTierLabel,
  getImageModelConfig,
  type GeneratedMediaBase,
} from '@/types'
import { CostEstimatePreview } from '@/components/cost-estimate-preview'
import { ModelInfoTooltip } from '@/components/model-info-tooltip'
import { TooltipProvider } from '@/components/ui/tooltip'
import { GalleryPicker } from '@/components/gallery-picker'

const RECRAFT_STYLES = [
  { value: 'realistic_image', label: 'Realistic' },
  { value: 'digital_illustration', label: 'Digital Illustration' },
  { value: 'vector_illustration', label: 'Vector Illustration' },
  { value: 'icon', label: 'Icon' },
] as const

function getImageStepSettings(model: string) {
  if (model === 'flux/schnell') {
    return { min: 1, max: 4, defaultValue: 4 }
  }

  return { min: 1, max: 50, defaultValue: 20 }
}

function getModelSupports(modelId: string) {
  return getImageModelConfig(modelId)?.supports ?? []
}

interface GenerationResult {
  url: string
  modelId: string
  modelName: string
}

export function TextToImage() {
  const [prompt, setPrompt] = useState('')
  const [negativePrompt, setNegativePrompt] = useState('')
  const [selectedModels, setSelectedModels] = useState<string[]>(['flux/schnell'])
  const [imageSize, setImageSize] = useState(() => getDefaultImageSize('flux/schnell'))
  const [imageAspectRatio, setImageAspectRatio] = useState(() => getDefaultImageAspectRatio('flux/schnell'))
  const [imageResolution, setImageResolution] = useState(() => getDefaultImageResolution('flux/schnell'))
  const [imageOutputFormat, setImageOutputFormat] = useState('png')
  const [imageQuality, setImageQuality] = useState('high')
  const [imageBackground, setImageBackground] = useState('auto')
  const [seed, setSeed] = useState<number | undefined>()
  const [numImages, setNumImages] = useState(1)
  const [guidanceScale, setGuidanceScale] = useState(5)
  const [numInferenceSteps, setNumInferenceSteps] = useState(20)
  const [referenceImage, setReferenceImage] = useState('')
  const [referenceImages, setReferenceImages] = useState<string[]>([])
  const [imagePromptStrength, setImagePromptStrength] = useState(0.2)
  const [imageStyle, setImageStyle] = useState('realistic_image')
  const [imageColors, setImageColors] = useState('')
  const [inflightCount, setInflightCount] = useState(0)
  const [results, setResults] = useState<GenerationResult[]>([])
  const [modelPickerOpen, setModelPickerOpen] = useState(false)
  const [galleryPickerOpen, setGalleryPickerOpen] = useState(false)
  const [galleryMultiPickerOpen, setGalleryMultiPickerOpen] = useState(false)
  
  const addToGallery = useGallery((s) => s.addWithPersistence)
  const addPending = useGallery((s) => s.addPending)
  const removePending = useGallery((s) => s.removePending)

  const primaryModel = selectedModels[0] ?? 'flux/schnell'
  const modelConfig = getImageModelConfig(primaryModel)
  const supports = modelConfig?.supports ?? []
  
  const supportsNegative = supports.includes('negative_prompt')
  const supportsSize = supports.includes('image_size')
  const supportsAspectRatio = supports.includes('aspect_ratio')
  const supportsResolution = supports.includes('resolution')
  const supportsNumImages = supports.includes('num_images')
  const supportsOutputFormat = supports.includes('output_format')
  const supportsQuality = supports.includes('quality')
  const supportsBackground = supports.includes('background')
  const supportsGuidance = supports.includes('guidance_scale')
  const supportsSteps = supports.includes('num_inference_steps')
  const supportsSeed = supports.includes('seed')
  const supportsReference = supports.includes('reference_image') || supports.includes('reference_images')
  const supportsMultiReference = supports.includes('reference_images')
  const supportsImagePromptStrength = supports.includes('image_prompt_strength')
  const supportsStyle = supports.includes('style')
  const supportsColors = supports.includes('colors')
  const imageSizeOptions = getImageSizeOptions(primaryModel)
  const imageAspectRatioOptions = getImageAspectRatioOptions(primaryModel)
  const imageResolutionOptions = getImageResolutionOptions(primaryModel)
  const stepSettings = getImageStepSettings(primaryModel)
  const costEstimate = estimateImageGenerationCost({
    model: primaryModel,
    imageSize: supportsSize ? imageSize : undefined,
    resolution: supportsResolution ? imageResolution : undefined,
    numImages: supportsNumImages ? numImages : 1,
    style: supportsStyle ? imageStyle : undefined,
    quality: supportsQuality ? imageQuality : undefined,
  })

  useEffect(() => {
    if (!supportsSteps) return
    if (numInferenceSteps >= stepSettings.min && numInferenceSteps <= stepSettings.max) {
      return
    }

    setNumInferenceSteps(stepSettings.defaultValue)
  }, [primaryModel, numInferenceSteps, stepSettings.defaultValue, stepSettings.max, stepSettings.min, supportsSteps])

  useEffect(() => {
    if (!supportsSize) return
    if (imageSizeOptions.some((option) => option.value === imageSize)) return
    setImageSize(getDefaultImageSize(primaryModel))
  }, [imageSize, imageSizeOptions, primaryModel, supportsSize])

  useEffect(() => {
    if (!supportsAspectRatio) return
    if (imageAspectRatioOptions.some((option) => option.value === imageAspectRatio)) return
    setImageAspectRatio(getDefaultImageAspectRatio(primaryModel))
  }, [imageAspectRatio, imageAspectRatioOptions, primaryModel, supportsAspectRatio])

  useEffect(() => {
    if (!supportsResolution) return
    if (imageResolutionOptions.some((option) => option.value === imageResolution)) return
    setImageResolution(getDefaultImageResolution(primaryModel))
  }, [imageResolution, imageResolutionOptions, primaryModel, supportsResolution])

  useEffect(() => {
    if (selectedModels.length > 0) return
    setSelectedModels(['flux/schnell'])
  }, [selectedModels.length])

  const toggleModel = useCallback((modelId: string) => {
    setSelectedModels((prev) => {
      if (prev.includes(modelId)) {
        const next = prev.filter((m) => m !== modelId)
        return next.length > 0 ? next : prev
      }
      return [...prev, modelId]
    })
  }, [])

  async function handleDownloadResult(url: string, index: number) {
    try {
      downloadRemoteFile(
        url,
        createDownloadStem({
          type: 'image',
          prompt,
          model: results[index]?.modelId ?? primaryModel,
          fallback: `generated-image-${index + 1}`,
          index,
        })
      )
    } catch (error) {
      console.error('Failed to download generated image:', error)
      toast.error('No se pudo descargar la imagen')
    }
  }

  async function handleReferenceFileChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return

    if (supportsMultiReference) {
      const maxRefs = 14
      const remaining = maxRefs - referenceImages.length
      if (remaining <= 0) return
      const urls = await Promise.all(
        files.slice(0, remaining).map(async (f) => {
          const reader = new FileReader()
          return new Promise<string>((resolve) => {
            reader.onload = () => resolve(reader.result as string)
            reader.readAsDataURL(f)
          })
        })
      )
      setReferenceImages((prev) => [...prev, ...urls].slice(0, maxRefs))
    } else {
      const file = files[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        setReferenceImage(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
    e.target.value = ''
  }

  function buildModelInput(modelId: string) {
    const s = getModelSupports(modelId)
    const ms = getImageStepSettings(modelId)

    return {
      prompt,
      model: `fal-ai/${modelId}`,
      negativePrompt: s.includes('negative_prompt') ? (negativePrompt || undefined) : undefined,
      imageSize: s.includes('image_size') ? imageSize : undefined,
      aspectRatio: s.includes('aspect_ratio') ? imageAspectRatio : undefined,
      resolution: s.includes('resolution') ? imageResolution : undefined,
      seed: s.includes('seed') ? seed : undefined,
      numImages: s.includes('num_images') ? numImages : 1,
      outputFormat: s.includes('output_format') ? imageOutputFormat : undefined,
      quality: s.includes('quality') ? imageQuality : undefined,
      background: s.includes('background') ? imageBackground : undefined,
      guidanceScale: s.includes('guidance_scale') ? guidanceScale : undefined,
      numInferenceSteps: s.includes('num_inference_steps')
        ? Math.min(Math.max(numInferenceSteps, ms.min), ms.max)
        : undefined,
      imageUrl: s.includes('reference_image') ? (referenceImage || undefined) : undefined,
      imageUrlsJson: s.includes('reference_images') && referenceImages.length > 0 ? JSON.stringify(referenceImages) : undefined,
      imagePromptStrength: s.includes('image_prompt_strength') ? imagePromptStrength : undefined,
      style: s.includes('style') ? imageStyle : undefined,
      colors: s.includes('colors')
        ? imageColors.split(',').map((c) => c.trim()).filter(Boolean)
        : undefined,
    }
  }

  async function runSingleModel(modelId: string) {
    const config = getImageModelConfig(modelId)
    const s = getModelSupports(modelId)
    const skeletonCount = s.includes('num_images') ? numImages : 1
    const ms = getImageStepSettings(modelId)

    const costEst = estimateImageGenerationCost({
      model: modelId,
      imageSize: s.includes('image_size') ? imageSize : undefined,
      resolution: s.includes('resolution') ? imageResolution : undefined,
      numImages: s.includes('num_images') ? numImages : 1,
      style: s.includes('style') ? imageStyle : undefined,
      quality: s.includes('quality') ? imageQuality : undefined,
    })

    let pendingIds = addPending(
      {
        type: 'image',
        prompt,
        model: `fal-ai/${modelId}`,
        costTier: config?.costTier,
        metadata: {
          imageSize: s.includes('image_size') ? imageSize : undefined,
          aspectRatio: s.includes('aspect_ratio') ? imageAspectRatio : undefined,
        },
      },
      skeletonCount
    )

    setInflightCount((c) => c + 1)

    try {
      const data = await generateImage(buildModelInput(modelId))

      const urls = data.images?.map(img => img.url).filter(Boolean) || 
                   (data.image?.url ? [data.image.url] : [])
      
      if (urls.length > 0) {
        removePending(pendingIds)
        pendingIds = []

        urls.forEach(url => {
          const item: GeneratedMediaBase = {
            type: 'image',
            url,
            prompt,
            model: `fal-ai/${modelId}`,
            costTier: config?.costTier,
            metadata: {
              imageSize: s.includes('image_size') ? imageSize : undefined,
              aspectRatio: s.includes('aspect_ratio') ? imageAspectRatio : undefined,
              imageAspectRatio: s.includes('aspect_ratio') ? imageAspectRatio : undefined,
              imageResolution: s.includes('resolution') ? imageResolution : undefined,
              imageQuality: s.includes('quality') ? imageQuality : undefined,
              imageBackground: s.includes('background') ? imageBackground : undefined,
              outputFormat: s.includes('output_format') ? imageOutputFormat : undefined,
              estimatedCost: costEst?.amount,
              seed: s.includes('seed') ? seed : undefined,
              guidanceScale: s.includes('guidance_scale') ? guidanceScale : undefined,
              numInferenceSteps: s.includes('num_inference_steps') ? numInferenceSteps : undefined,
              imageStyle: s.includes('style') ? imageStyle : undefined,
              imageColors: s.includes('colors')
                ? imageColors.split(',').map((c) => c.trim()).filter(Boolean)
                : undefined,
              imagePromptStrength: s.includes('image_prompt_strength') ? imagePromptStrength : undefined,
              costTier: config?.costTier,
            },
          }
          void addToGallery(item)
        })

        setResults((prev) => [
          ...urls.map((url) => ({
            url,
            modelId,
            modelName: config?.name ?? modelId,
          })),
          ...prev,
        ])
      } else {
        removePending(pendingIds)
        pendingIds = []
        toast.error(`${config?.name ?? modelId}: sin imagen`)
      }
    } catch (error) {
      removePending(pendingIds)
      pendingIds = []
      toast.error(`Error en ${config?.name ?? modelId}`)
      console.error(error)
    } finally {
      if (pendingIds.length > 0) {
        removePending(pendingIds)
      }
      setInflightCount((c) => c - 1)
    }
  }

  async function handleGenerate() {
    if (!prompt.trim()) {
      toast.error('Ingresa un prompt')
      return
    }

    const models = selectedModels.length > 0 ? selectedModels : [primaryModel]

    void Promise.allSettled(models.map(runSingleModel))

    toast.success(`Generando con ${models.length} modelo(s)`)
  }

  const previewGridColumns = results.length === 1
    ? '1fr'
    : results.length <= 4
      ? 'repeat(2, 1fr)'
      : 'repeat(3, 1fr)'

  return (
    <>
    <TooltipProvider>
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Prompt</Label>
          <Textarea
            placeholder="Describe la imagen que quieres crear..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
          />
        </div>

        {supportsNegative && (
          <div className="space-y-2">
            <Label>Prompt negativo (opcional)</Label>
            <Textarea
              placeholder="Qué evitar en la imagen..."
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              rows={2}
            />
          </div>
        )}

        {supportsReference && !supportsMultiReference && (
          <div className="space-y-2">
            <Label>Imagen de referencia</Label>
            {referenceImage ? (
              <Card className="relative aspect-video overflow-hidden bg-muted/50">
                <Image
                  src={referenceImage}
                  alt="Reference"
                  fill
                  className="object-contain"
                  unoptimized
                />
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute right-2 top-2"
                  onClick={() => setReferenceImage('')}
                >
                  <X className="h-4 w-4" />
                </Button>
              </Card>
            ) : (
              <div className="flex gap-2">
                <label className="flex flex-1 aspect-video cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50 hover:border-muted-foreground/50">
                  <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Sube una imagen</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleReferenceFileChange}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setGalleryPickerOpen(true)}
                  className="flex flex-1 aspect-video cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-primary/25 bg-primary/5 hover:border-primary/50 hover:bg-primary/10 transition"
                >
                  <ImageIcon className="mb-2 h-8 w-8 text-primary/60" />
                  <span className="text-sm text-primary/80">De la galería</span>
                </button>
              </div>
            )}
          </div>
        )}

        {supportsMultiReference && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Imagenes de referencia</Label>
              <Badge variant="secondary" className="text-xs">
                {referenceImages.length}/14
              </Badge>
            </div>
            {referenceImages.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {referenceImages.map((img, i) => (
                  <div key={i} className="relative h-16 w-16 rounded-lg overflow-hidden border border-muted">
                    <Image src={img} alt={`Ref ${i + 1}`} fill className="object-cover" unoptimized />
                    <Button
                      size="icon"
                      variant="secondary"
                      className="absolute -right-1 -top-1 h-5 w-5 rounded-full"
                      onClick={() => setReferenceImages((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {referenceImages.length < 14 && (
              <div className="flex gap-2">
                <label className="flex flex-1 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50 p-4 hover:border-muted-foreground/50">
                  <Upload className="mb-1 h-6 w-6 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    Agregar{referenceImages.length > 0 ? ' mas' : ''} ({14 - referenceImages.length} restantes)
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleReferenceFileChange}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setGalleryMultiPickerOpen(true)}
                  className="flex flex-1 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-primary/25 bg-primary/5 p-4 hover:border-primary/50 hover:bg-primary/10 transition"
                >
                  <ImageIcon className="mb-1 h-6 w-6 text-primary/60" />
                  <span className="text-xs text-primary/80">
                    De la galería
                  </span>
                </button>
              </div>
            )}
          </div>
        )}

        {supportsImagePromptStrength && (
          <div className="space-y-2">
            <Label>Fuerza de referencia: {imagePromptStrength.toFixed(2)}</Label>
            <Slider
              value={[imagePromptStrength]}
              onValueChange={([v]) => setImagePromptStrength(v)}
              min={0}
              max={1}
              step={0.05}
            />
          </div>
        )}

        {supportsStyle && (
          <div className="space-y-2">
            <Label>Estilo</Label>
            <Select value={imageStyle} onValueChange={setImageStyle}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RECRAFT_STYLES.map((style) => (
                  <SelectItem key={style.value} value={style.value}>
                    {style.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {supportsColors && (
          <div className="space-y-2">
            <Label>Colores (hex, separados por coma)</Label>
            <Textarea
              placeholder="#FF6B6B, #1A73E8"
              value={imageColors}
              onChange={(e) => setImageColors(e.target.value)}
              rows={2}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Modelo{selectedModels.length > 1 ? ` (${selectedModels.length})` : ''}</Label>
              <ModelInfoTooltip 
                info={modelConfig?.info} 
                costTier={modelConfig?.costTier} 
                modelName={modelConfig?.name || primaryModel}
              />
            </div>
            <Popover open={modelPickerOpen} onOpenChange={setModelPickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between font-normal">
                  <span className="truncate">
                    {selectedModels.length === 1
                      ? modelConfig?.name ?? primaryModel
                      : `${selectedModels.length} modelos`}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[320px] p-0" align="start">
                <div className="border-b px-3 py-2">
                  <p className="text-xs text-muted-foreground">
                    Selecciona modelos para comparar. Los controles usan el primero.
                  </p>
                </div>
                <ScrollArea className="h-[300px]">
                  <div className="p-2">
                    {Object.entries(IMAGE_MODEL_FAMILIES).map(([familyId, family]) => (
                      <div key={familyId} className="mb-1">
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                          {family.name}
                        </div>
                        {Object.entries(family.models).map(([modelId, config]) => {
                          const isSelected = selectedModels.includes(modelId)
                          const isPrimary = selectedModels[0] === modelId
                          return (
                            <button
                              key={modelId}
                              type="button"
                              onClick={() => toggleModel(modelId)}
                              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent ${
                                isSelected ? 'bg-accent/50' : ''
                              }`}
                            >
                              <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                isSelected
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'border-muted-foreground/30'
                              }`}>
                                {isSelected && <Check className="h-3 w-3" />}
                              </div>
                              <span className="flex-1 text-left">{config.name}</span>
                              <div className="flex items-center gap-1.5">
                                {isPrimary && (
                                  <Badge variant="secondary" className="text-[0.6rem] px-1 py-0">
                                    primario
                                  </Badge>
                                )}
                                {getCostTierLabel(config.costTier) && (
                                  <span className="text-[0.65rem] text-muted-foreground">
                                    {getCostTierLabel(config.costTier)}
                                  </span>
                                )}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                {selectedModels.length > 1 && (
                  <div className="border-t px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {selectedModels.map((id) => {
                        const c = getImageModelConfig(id)
                        return (
                          <Badge key={id} variant="secondary" className="text-[0.65rem]">
                            {c?.name ?? id}
                            <button
                              type="button"
                              onClick={() => toggleModel(id)}
                              className="ml-0.5 rounded-full hover:bg-foreground/10"
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </Badge>
                        )
                      })}
                    </div>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>

          {supportsSize && (
            <div className="space-y-2">
              <Label>Tamaño</Label>
              <Select value={imageSize} onValueChange={setImageSize}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {imageSizeOptions.map((size) => (
                    <SelectItem key={size.value} value={size.value}>
                      {size.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {supportsAspectRatio && (
          <div className="space-y-2">
            <Label>Aspect Ratio</Label>
            <Select value={imageAspectRatio} onValueChange={setImageAspectRatio}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {imageAspectRatioOptions.map((ratio) => (
                  <SelectItem key={ratio.value} value={ratio.value}>
                    {ratio.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {supportsResolution && (
          <div className="space-y-2">
            <Label>Resolución</Label>
            <Select value={imageResolution} onValueChange={setImageResolution}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {imageResolutionOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {supportsSeed && (
          <div className="space-y-2">
            <Label>Seed (opcional)</Label>
            <div className="flex gap-2">
              <Slider
                value={seed ? [seed] : [0]}
                onValueChange={([v]) => setSeed(v || undefined)}
                max={999999}
                step={1}
                className="flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSeed(Math.floor(Math.random() * 999999))}
              >
                Random
              </Button>
            </div>
          </div>
        )}

        {supportsOutputFormat && (
          <div className="space-y-2">
            <Label>Formato de salida</Label>
            <Select value={imageOutputFormat} onValueChange={setImageOutputFormat}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {IMAGE_OUTPUT_FORMAT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {supportsQuality && (
          <div className="space-y-2">
            <Label>Calidad</Label>
            <Select value={imageQuality} onValueChange={setImageQuality}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {IMAGE_QUALITY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {supportsBackground && (
          <div className="space-y-2">
            <Label>Fondo</Label>
            <Select value={imageBackground} onValueChange={setImageBackground}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {IMAGE_BACKGROUND_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {supportsNumImages && (
          <div className="space-y-2">
            <Label>Número de imágenes: {numImages}</Label>
            <Slider
              value={[numImages]}
              onValueChange={([v]) => setNumImages(v)}
              min={1}
              max={4}
              step={1}
            />
          </div>
        )}

        {supportsGuidance && (
          <div className="space-y-2">
            <Label>Guidance Scale (CFG): {guidanceScale}</Label>
            <Slider
              value={[guidanceScale]}
              onValueChange={([v]) => setGuidanceScale(v)}
              min={1}
              max={20}
              step={0.5}
            />
          </div>
        )}

        {supportsSteps && (
          <div className="space-y-2">
            <Label>Pasos de inferencia: {numInferenceSteps}</Label>
            <Slider
              value={[numInferenceSteps]}
              onValueChange={([v]) => setNumInferenceSteps(v)}
              min={stepSettings.min}
              max={stepSettings.max}
              step={1}
            />
          </div>
        )}

        <CostEstimatePreview estimate={costEstimate} />

        <Button
          onClick={handleGenerate}
          disabled={!prompt.trim()}
          className="w-full"
        >
          {inflightCount > 0 ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {inflightCount} en curso... Generar más
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Generar{selectedModels.length > 1 ? ` (${selectedModels.length} modelos)` : ''}
            </>
          )}
        </Button>
      </div>

      <div className="flex items-center justify-center">
        <Card className="relative w-full max-w-md overflow-hidden bg-muted/50" style={{ minHeight: 400 }}>
          {inflightCount > 0 && results.length === 0 ? (
            <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-foreground" />
              <p className="text-sm font-medium text-foreground">
                Generando con {inflightCount} modelo(s)...
              </p>
            </div>
          ) : results.length > 0 ? (
            <div className="grid h-full w-full gap-1 p-1" style={{
              gridTemplateColumns: previewGridColumns,
            }}>
              {results.map((result, i) => (
                <div key={`${result.url}-${i}`} className="relative aspect-square">
                  <Image
                    src={result.url}
                    alt={`${result.modelName} ${i + 1}`}
                    fill
                    className="object-contain rounded-sm"
                    loading="lazy"
                    unoptimized
                  />
                  <div className="absolute bottom-1 left-1 flex items-center gap-1">
                    <Badge variant="secondary" className="text-[0.55rem] px-1 py-0 backdrop-blur-sm bg-background/70">
                      {result.modelName}
                    </Badge>
                  </div>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute right-1 top-1 h-6 w-6"
                    onClick={() => void handleDownloadResult(result.url, i)}
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-full min-h-[400px] items-center justify-center text-muted-foreground">
              <Sparkles className="h-12 w-12 opacity-50" />
            </div>
          )}
        </Card>
      </div>
    </div>
    </TooltipProvider>
    <GalleryPicker
      open={galleryPickerOpen}
      onOpenChange={setGalleryPickerOpen}
      mediaType="image"
      onSelect={(url) => setReferenceImage(url)}
    />
    <GalleryPicker
      open={galleryMultiPickerOpen}
      onOpenChange={setGalleryMultiPickerOpen}
      mediaType="image"
      multiple
      maxSelection={14 - referenceImages.length}
      onSelect={(url) => {
        setReferenceImages((prev) => [...prev, url].slice(0, 14))
      }}
    />
    </>
  )
}
