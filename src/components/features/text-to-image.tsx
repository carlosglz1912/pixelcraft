'use client'

import { useEffect, useState, type ChangeEvent } from 'react'
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
import { Loader2, Sparkles, Download, Upload, X } from 'lucide-react'
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

export function TextToImage() {
  const [prompt, setPrompt] = useState('')
  const [negativePrompt, setNegativePrompt] = useState('')
  const [model, setModel] = useState('flux/schnell')
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
  const [imagePromptStrength, setImagePromptStrength] = useState(0.2)
  const [imageStyle, setImageStyle] = useState('realistic_image')
  const [imageColors, setImageColors] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<string[]>([])
  
  const addToGallery = useGallery((s) => s.addWithPersistence)
  const addPending = useGallery((s) => s.addPending)
  const removePending = useGallery((s) => s.removePending)

  const modelConfig = getImageModelConfig(model)
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
  const supportsReference = supports.includes('reference_image')
  const supportsImagePromptStrength = supports.includes('image_prompt_strength')
  const supportsStyle = supports.includes('style')
  const supportsColors = supports.includes('colors')
  const imageSizeOptions = getImageSizeOptions(model)
  const imageAspectRatioOptions = getImageAspectRatioOptions(model)
  const imageResolutionOptions = getImageResolutionOptions(model)
  const stepSettings = getImageStepSettings(model)
  const previewSkeletonCount = supportsNumImages ? numImages : 1
  const previewGridColumns = previewSkeletonCount === 1 ? '1fr' : 'repeat(2, 1fr)'
  const costEstimate = estimateImageGenerationCost({
    model,
    imageSize: supportsSize ? imageSize : undefined,
    resolution: supportsResolution ? imageResolution : undefined,
    numImages: supportsNumImages ? numImages : 1,
    style: supportsStyle ? imageStyle : undefined,
  })

  useEffect(() => {
    if (!supportsSteps) return
    if (numInferenceSteps >= stepSettings.min && numInferenceSteps <= stepSettings.max) {
      return
    }

    setNumInferenceSteps(stepSettings.defaultValue)
  }, [model, numInferenceSteps, stepSettings.defaultValue, stepSettings.max, stepSettings.min, supportsSteps])

  useEffect(() => {
    if (!supportsSize) return
    if (imageSizeOptions.some((option) => option.value === imageSize)) return
    setImageSize(getDefaultImageSize(model))
  }, [imageSize, imageSizeOptions, model, supportsSize])

  useEffect(() => {
    if (!supportsAspectRatio) return
    if (imageAspectRatioOptions.some((option) => option.value === imageAspectRatio)) return
    setImageAspectRatio(getDefaultImageAspectRatio(model))
  }, [imageAspectRatio, imageAspectRatioOptions, model, supportsAspectRatio])

  useEffect(() => {
    if (!supportsResolution) return
    if (imageResolutionOptions.some((option) => option.value === imageResolution)) return
    setImageResolution(getDefaultImageResolution(model))
  }, [imageResolution, imageResolutionOptions, model, supportsResolution])

  async function handleDownloadResult(url: string, index: number) {
    try {
      downloadRemoteFile(
        url,
        createDownloadStem({
          type: 'image',
          prompt,
          model,
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
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      setReferenceImage(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  async function handleGenerate() {
    if (!prompt.trim()) {
      toast.error('Ingresa un prompt')
      return
    }

    let pendingIds = addPending(
      {
        type: 'image',
        prompt,
        model: `fal-ai/${model}`,
        costTier: modelConfig?.costTier,
        metadata: {
          imageSize: supportsSize ? imageSize : undefined,
          aspectRatio: supportsAspectRatio ? imageAspectRatio : undefined,
        },
      },
      previewSkeletonCount
    )

    setLoading(true)
    setResults([])

    try {
      const data = await generateImage({
        prompt,
        model: `fal-ai/${model}`,
        negativePrompt: supportsNegative ? (negativePrompt || undefined) : undefined,
        imageSize: supportsSize ? imageSize : undefined,
        aspectRatio: supportsAspectRatio ? imageAspectRatio : undefined,
        resolution: supportsResolution ? imageResolution : undefined,
        seed: supportsSeed ? seed : undefined,
        numImages: supportsNumImages ? numImages : 1,
        outputFormat: supportsOutputFormat ? imageOutputFormat : undefined,
        quality: supportsQuality ? imageQuality : undefined,
        background: supportsBackground ? imageBackground : undefined,
        guidanceScale: supportsGuidance ? guidanceScale : undefined,
        numInferenceSteps: supportsSteps
          ? Math.min(Math.max(numInferenceSteps, stepSettings.min), stepSettings.max)
          : undefined,
        imageUrl: supportsReference ? (referenceImage || undefined) : undefined,
        imagePromptStrength: supportsImagePromptStrength ? imagePromptStrength : undefined,
        style: supportsStyle ? imageStyle : undefined,
        colors: supportsColors
          ? imageColors
              .split(',')
              .map((color) => color.trim())
              .filter(Boolean)
          : undefined,
      })

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
            model: `fal-ai/${model}`,
            costTier: modelConfig?.costTier,
            metadata: {
              imageSize: supportsSize ? imageSize : undefined,
              aspectRatio: supportsAspectRatio ? imageAspectRatio : undefined,
              imageAspectRatio: supportsAspectRatio ? imageAspectRatio : undefined,
              imageResolution: supportsResolution ? imageResolution : undefined,
              imageQuality: supportsQuality ? imageQuality : undefined,
              imageBackground: supportsBackground ? imageBackground : undefined,
              outputFormat: supportsOutputFormat ? imageOutputFormat : undefined,
              estimatedCost: costEstimate?.amount,
              seed: supportsSeed ? seed : undefined,
              guidanceScale: supportsGuidance ? guidanceScale : undefined,
              numInferenceSteps: supportsSteps ? numInferenceSteps : undefined,
              imageStyle: supportsStyle ? imageStyle : undefined,
              imageColors: supportsColors
                ? imageColors
                    .split(',')
                    .map((color) => color.trim())
                    .filter(Boolean)
                : undefined,
              imagePromptStrength: supportsImagePromptStrength ? imagePromptStrength : undefined,
              costTier: modelConfig?.costTier,
            },
          }
          void addToGallery(item)
        })
        setResults(urls)
        toast.success(`${urls.length} imagen(es) generada(s)`)
      } else {
        removePending(pendingIds)
        pendingIds = []
        toast.error('No se recibió imagen')
      }
    } catch (error) {
      removePending(pendingIds)
      pendingIds = []
      toast.error('Error al generar imagen')
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

        {supportsReference && (
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
              <label className="flex aspect-video cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50 hover:border-muted-foreground/50">
                <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Sube una imagen</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleReferenceFileChange}
                />
              </label>
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
              <Label>Modelo</Label>
              <ModelInfoTooltip 
                info={modelConfig?.info} 
                costTier={modelConfig?.costTier} 
                modelName={modelConfig?.name || model}
              />
            </div>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(IMAGE_MODEL_FAMILIES).map(([familyId, family]) => (
                  <SelectGroup key={familyId}>
                    <SelectLabel>{family.name}</SelectLabel>
                    {Object.entries(family.models).map(([modelId, config]) => (
                      <SelectItem key={modelId} value={modelId}>
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
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
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
          disabled={loading || !prompt.trim()}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generando...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Generar Imagen
            </>
          )}
        </Button>
      </div>

      <div className="flex items-center justify-center">
        <Card className="relative aspect-square w-full max-w-md overflow-hidden bg-muted/50">
          {loading ? (
            <>
              <div
                className="grid h-full w-full gap-1 p-1"
                style={{ gridTemplateColumns: previewGridColumns }}
              >
                {Array.from({ length: previewSkeletonCount }).map((_, index) => (
                  <Skeleton key={index} className="h-full w-full rounded-sm" />
                ))}
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/45">
                <Loader2 className="h-8 w-8 animate-spin text-foreground" />
                <p className="text-sm font-medium text-foreground">Generando imagen...</p>
              </div>
            </>
          ) : results.length > 0 ? (
            <div className="grid h-full w-full gap-1 p-1" style={{
              gridTemplateColumns: results.length === 1 ? '1fr' : results.length <= 2 ? 'repeat(2, 1fr)' : 'repeat(2, 1fr)'
            }}>
              {results.map((url, i) => (
                <div key={i} className="relative h-full">
                  <Image
                    src={url}
                    alt={`Generated ${i + 1}`}
                    fill
                    className="object-contain"
                    loading="eager"
                    unoptimized
                  />
                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute right-1 top-1 h-6 w-6"
                    onClick={() => void handleDownloadResult(url, i)}
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <Sparkles className="h-12 w-12 opacity-50" />
            </div>
          )}
        </Card>
      </div>
    </div>
    </TooltipProvider>
  )
}
