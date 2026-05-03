'use client'

import { useEffect, useState, type ChangeEvent } from 'react'
import { toast } from 'sonner'
import { generateImage } from '@/lib/actions'
import { optimizeImageIfLarge } from '@/lib/image-optimize'
import { estimateImageGenerationCost } from '@/lib/cost-estimate'
import {
  getDefaultImageAspectRatio,
  getDefaultImageResolution,
  getDefaultImageSize,
  getImageAspectRatioOptions,
  getImageResolutionOptions,
  getImageSizeOptions,
} from '@/lib/image-model-controls'
import { fileToDataUrl, getImageStepSettings } from '@/lib/studio-helpers'
import { getImageModelConfig, type GeneratedMediaBase, type PendingMedia } from '@/types'

export interface UseImageStudioParams {
  addToGallery: (item: GeneratedMediaBase) => void
  addPending: (item: Omit<PendingMedia, 'id' | 'createdAt'>, count?: number) => string[]
  removePending: (ids: string[]) => void
  setLoading: (loading: boolean) => void
  openPicker: (setter: (url: string) => void, mediaType: 'image' | 'video') => void
  openMultiPicker: (setter: (urls: string[]) => void, current: string[], max: number) => void
}

export function useImageStudio({
  addToGallery,
  addPending,
  removePending,
  setLoading,
  openPicker,
  openMultiPicker,
}: UseImageStudioParams) {
  const [prompt, setPrompt] = useState('')
  const [negativePrompt, setNegativePrompt] = useState('')
  const [imageModel, setImageModelState] = useState('flux/schnell')
  const setImageModel = (model: string) => {
    setImageModelState(model)
    const supports = getImageModelConfig(model)?.supports ?? []
    const isMulti = supports.includes('reference_images')
    const hasRef = supports.includes('reference_image') || isMulti
    if (!hasRef) {
      setReferenceImages([])
    } else if (!isMulti && referenceImages.length > 1) {
      setReferenceImages((current) => current.slice(0, 1))
    }
  }
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
  const [referenceImages, setReferenceImages] = useState<string[]>([])
  const [imagePromptStrength, setImagePromptStrength] = useState(0.2)
  const [imageStyle, setImageStyle] = useState('realistic_image')
  const [imageColors, setImageColors] = useState('')

  // Derived support flags
  const imageSupports = getImageModelConfig(imageModel)?.supports ?? []
  const supportsNegative = imageSupports.includes('negative_prompt')
  const supportsSize = imageSupports.includes('image_size')
  const supportsImageAspectRatio = imageSupports.includes('aspect_ratio')
  const supportsImageResolution = imageSupports.includes('resolution')
  const supportsNumImages = imageSupports.includes('num_images')
  const supportsImageOutputFormat = imageSupports.includes('output_format')
  const supportsImageQuality = imageSupports.includes('quality')
  const supportsImageBackground = imageSupports.includes('background')
  const supportsGuidance = imageSupports.includes('guidance_scale')
  const supportsSteps = imageSupports.includes('num_inference_steps')
  const supportsImageSeed = imageSupports.includes('seed')
  const supportsImageReference = imageSupports.includes('reference_image') || imageSupports.includes('reference_images')
  const supportsImageReferences = imageSupports.includes('reference_images')
  const maxImageReferences = supportsImageReferences ? 3 : 1
  const supportsImagePromptStrength = imageSupports.includes('image_prompt_strength')
  const supportsImageStyle = imageSupports.includes('style')
  const supportsImageColors = imageSupports.includes('colors')
  const imageSizeOptions = getImageSizeOptions(imageModel)
  const imageAspectRatioOptions = getImageAspectRatioOptions(imageModel)
  const imageResolutionOptions = getImageResolutionOptions(imageModel)

  const imageEstimate = estimateImageGenerationCost({
    model: imageModel,
    imageSize: supportsSize ? imageSize : undefined,
    resolution: supportsImageResolution ? imageResolution : undefined,
    numImages: supportsNumImages ? numImages : 1,
    style: supportsImageStyle ? imageStyle : undefined,
  })
  const imageStepSettings = getImageStepSettings(imageModel)

  // Sync effects on model change
  useEffect(() => {
    if (!supportsSteps) return
    if (
      numInferenceSteps >= imageStepSettings.min &&
      numInferenceSteps <= imageStepSettings.max
    ) {
      return
    }
    setNumInferenceSteps(imageStepSettings.defaultValue)
  }, [
    imageModel,
    imageStepSettings.defaultValue,
    imageStepSettings.max,
    imageStepSettings.min,
    numInferenceSteps,
    supportsSteps,
  ])

  useEffect(() => {
    if (!supportsSize) return
    if (imageSizeOptions.some((option) => option.value === imageSize)) return
    setImageSize(getDefaultImageSize(imageModel))
  }, [imageModel, imageSize, imageSizeOptions, supportsSize])

  useEffect(() => {
    if (!supportsImageAspectRatio) return
    if (imageAspectRatioOptions.some((option) => option.value === imageAspectRatio)) return
    setImageAspectRatio(getDefaultImageAspectRatio(imageModel))
  }, [imageAspectRatio, imageAspectRatioOptions, imageModel, supportsImageAspectRatio])

  useEffect(() => {
    if (!supportsImageResolution) return
    if (imageResolutionOptions.some((option) => option.value === imageResolution)) return
    setImageResolution(getDefaultImageResolution(imageModel))
  }, [imageModel, imageResolution, imageResolutionOptions, supportsImageResolution])

  // Reference file handler
  async function handleReferenceFileChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return

    const remaining = Math.max(0, maxImageReferences - referenceImages.length)
    if (remaining === 0) {
      toast.error(`Max ${maxImageReferences} referencia(s)`)
      e.target.value = ''
      return
    }

    try {
      const nextUrls = await Promise.all(
        files.slice(0, remaining).map(async (file) => optimizeImageIfLarge(await fileToDataUrl(file), 800))
      )
      setReferenceImages((current) => [...current, ...nextUrls].slice(0, maxImageReferences))
    } catch (error) {
      toast.error('No se pudieron cargar las referencias')
      console.error(error)
    } finally {
      e.target.value = ''
    }
  }

  // Generate handler
  async function handleGenerateImage() {
    if (!prompt.trim()) {
      toast.error('Ingresa un prompt')
      return
    }

    const imageConfig = getImageModelConfig(imageModel)
    let pendingIds = addPending(
      {
        type: 'image',
        prompt,
        model: `fal-ai/${imageModel}`,
        costTier: imageConfig?.costTier,
        metadata: {
          imageSize: supportsSize ? imageSize : undefined,
          aspectRatio: supportsImageAspectRatio ? imageAspectRatio : undefined,
        },
      },
      supportsNumImages ? numImages : 1
    )

    setLoading(true)

    try {
      const data = await generateImage({
        prompt,
        model: `fal-ai/${imageModel}`,
        negativePrompt: supportsNegative ? (negativePrompt || undefined) : undefined,
        imageSize: supportsSize ? imageSize : undefined,
        aspectRatio: supportsImageAspectRatio ? imageAspectRatio : undefined,
        resolution: supportsImageResolution ? imageResolution : undefined,
        seed: supportsImageSeed ? seed : undefined,
        numImages: supportsNumImages ? numImages : 1,
        outputFormat: supportsImageOutputFormat ? imageOutputFormat : undefined,
        quality: supportsImageQuality ? imageQuality : undefined,
        background: supportsImageBackground ? imageBackground : undefined,
        guidanceScale: supportsGuidance ? guidanceScale : undefined,
        numInferenceSteps: supportsSteps
          ? Math.min(Math.max(numInferenceSteps, imageStepSettings.min), imageStepSettings.max)
          : undefined,
        imageUrl: supportsImageReference && !supportsImageReferences ? referenceImages[0] : undefined,
        imageUrlsJson: supportsImageReferences && referenceImages.length > 0 ? JSON.stringify(referenceImages) : undefined,
        imagePromptStrength:
          supportsImagePromptStrength && referenceImages[0] ? imagePromptStrength : undefined,
        style: supportsImageStyle ? imageStyle : undefined,
        colors: supportsImageColors
          ? imageColors
              .split(',')
              .map((color) => color.trim())
              .filter(Boolean)
          : undefined,
      })

      const urls =
        data.images?.map((image) => image.url).filter(Boolean) ||
        (data.image?.url ? [data.image.url] : [])

      if (urls.length === 0) {
        removePending(pendingIds)
        pendingIds = []
        toast.error('No se recibió imagen')
        return
      }

      removePending(pendingIds)
      pendingIds = []

      urls.forEach((url) => {
        const item: GeneratedMediaBase = {
          type: 'image',
          url,
          prompt,
          model: `fal-ai/${imageModel}`,
          costTier: imageConfig?.costTier,
          metadata: {
            estimatedCost: imageEstimate?.amount,
            imageSize: supportsSize ? imageSize : undefined,
            aspectRatio: supportsImageAspectRatio ? imageAspectRatio : undefined,
            imageAspectRatio: supportsImageAspectRatio ? imageAspectRatio : undefined,
            imageResolution: supportsImageResolution ? imageResolution : undefined,
            imageQuality: supportsImageQuality ? imageQuality : undefined,
            imageBackground: supportsImageBackground ? imageBackground : undefined,
            outputFormat: supportsImageOutputFormat ? imageOutputFormat : undefined,
            seed: supportsImageSeed ? seed : undefined,
            guidanceScale: supportsGuidance ? guidanceScale : undefined,
            numInferenceSteps: supportsSteps
              ? Math.min(Math.max(numInferenceSteps, imageStepSettings.min), imageStepSettings.max)
              : undefined,
            referenceCount: supportsImageReference ? Math.min(referenceImages.length, maxImageReferences) : undefined,
            imagePromptStrength: supportsImagePromptStrength ? imagePromptStrength : undefined,
            imageStyle: supportsImageStyle ? imageStyle : undefined,
            imageColors: supportsImageColors
              ? imageColors
                  .split(',')
                  .map((color) => color.trim())
                  .filter(Boolean)
              : undefined,
            costTier: imageConfig?.costTier,
          },
        }
        void addToGallery(item)
      })

      toast.success(`${urls.length} imagen(es) generada(s)`)
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

  // Gallery picker helpers (wrapping openPicker/openMultiPicker for reference images)
  function openReferenceGalleryPicker() {
    setMultiPickerTarget({
      setter: (urls) => setReferenceImages((current) => [...current, ...urls].slice(0, maxImageReferences)),
      current: referenceImages,
      max: maxImageReferences,
    })
    setMultiPickerOpen(true)
  }

  // These manage picker state locally so the panel doesn't need to know about it
  const [multiPickerOpen, setMultiPickerOpen] = useState(false)
  const [multiPickerTarget, setMultiPickerTarget] = useState<{
    setter: (urls: string[]) => void
    current: string[]
    max: number
  } | null>(null)

  return {
    // State
    prompt,
    negativePrompt,
    imageModel,
    imageSize,
    imageAspectRatio,
    imageResolution,
    imageOutputFormat,
    imageQuality,
    imageBackground,
    seed,
    numImages,
    guidanceScale,
    numInferenceSteps,
    referenceImages,
    imagePromptStrength,
    imageStyle,
    imageColors,
    // Setters
    setPrompt,
    setNegativePrompt,
    setImageModel,
    setImageSize,
    setImageAspectRatio,
    setImageResolution,
    setImageOutputFormat,
    setImageQuality,
    setImageBackground,
    setSeed,
    setNumImages,
    setGuidanceScale,
    setNumInferenceSteps,
    setReferenceImages,
    setImagePromptStrength,
    setImageStyle,
    setImageColors,
    // Derived
    imageSupports,
    supportsNegative,
    supportsSize,
    supportsImageAspectRatio,
    supportsImageResolution,
    supportsNumImages,
    supportsImageOutputFormat,
    supportsImageQuality,
    supportsImageBackground,
    supportsGuidance,
    supportsSteps,
    supportsImageSeed,
    supportsImageReference,
    supportsImageReferences,
    maxImageReferences,
    supportsImagePromptStrength,
    supportsImageStyle,
    supportsImageColors,
    imageSizeOptions,
    imageAspectRatioOptions,
    imageResolutionOptions,
    imageEstimate,
    imageStepSettings,
    // Handlers
    handleReferenceFileChange,
    handleGenerateImage,
    openReferenceGalleryPicker,
    // Picker state (consumed by the panel's GalleryPicker rendering)
    multiPickerOpen,
    setMultiPickerOpen,
    multiPickerTarget,
  }
}
