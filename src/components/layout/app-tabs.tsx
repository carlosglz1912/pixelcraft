'use client'

import { startTransition, useEffect, useRef, useState, type ChangeEvent } from 'react'
import Image from 'next/image'
import {
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Cloud,
  Database,
  ImagePlus,
  Music,
  Sparkles,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { enqueueVideoGeneration, generateImage } from '@/lib/actions'
import { optimizeImageIfLarge } from '@/lib/image-optimize'
import {
  estimateImageGenerationCost,
  estimateVideoGenerationCost,
} from '@/lib/cost-estimate'
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
  VIDEO_MODEL_FAMILIES,
  getCostTierLabel,
  getVideoAspectRatios,
  getVideoDurations,
  getVideoEffectiveSupports,
  getVideoModes,
  getImageModelConfig,
  getVideoModelConfig,
  getVideoResolutions,
  type GeneratedMediaBase,
  type VideoGenerationMode,
} from '@/types'
import { CostEstimatePreview } from '@/components/cost-estimate-preview'
import { Gallery } from '@/components/features/gallery'
import { R2Manager } from '@/components/features/r2-manager'
import type { KlingV3ComboElementInput, KlingV3MultiPromptElement } from '@/types/fal'

type StudioMode = 'image' | 'video'
type MainTab = 'gallery' | 'storage'

const RECRAFT_STYLES = [
  { value: 'realistic_image', label: 'Realistic' },
  { value: 'digital_illustration', label: 'Digital Illustration' },
  { value: 'vector_illustration', label: 'Vector Illustration' },
  { value: 'icon', label: 'Icon' },
] as const

const VIDEO_RATIOS = [
  { value: '16:9', label: '16:9', frameClass: 'h-5 w-9' },
  { value: '9:16', label: '9:16', frameClass: 'h-9 w-5' },
  { value: '1:1', label: '1:1', frameClass: 'h-7 w-7' },
] as const

function getVideoRatioCard(value: string) {
  if (value === '16:9') return VIDEO_RATIOS[0]
  if (value === '9:16') return VIDEO_RATIOS[1]
  if (value === '1:1') return VIDEO_RATIOS[2]
  return {
    value,
    label: value === 'auto' ? 'Auto' : value,
    frameClass: 'h-7 w-7',
  }
}

function getResolutionLabel(value: string) {
  if (value === 'auto') return 'Auto'
  if (value === '4k') return '4K'
  return value
}

function getImageSizeCard(value: string, label: string) {
  if (value === 'landscape_16_9' || value === '1536x1024') {
    return { frameClass: 'h-5 w-9', label }
  }

  if (value === 'portrait_16_9' || value === '1024x1536') {
    return { frameClass: 'h-9 w-5', label }
  }

  if (value === 'landscape_4_3') {
    return { frameClass: 'h-6 w-8', label }
  }

  if (value === 'portrait_4_3') {
    return { frameClass: 'h-8 w-6', label }
  }

  return { frameClass: 'h-7 w-7', label }
}

function getImageAspectRatioCard(value: string) {
  if (value === '21:9') return { frameClass: 'h-4 w-10', label: '21:9' }
  if (value === '16:9') return { frameClass: 'h-5 w-9', label: '16:9' }
  if (value === '3:2') return { frameClass: 'h-6 w-9', label: '3:2' }
  if (value === '4:3') return { frameClass: 'h-6 w-8', label: '4:3' }
  if (value === '5:4') return { frameClass: 'h-7 w-8', label: '5:4' }
  if (value === '4:5') return { frameClass: 'h-8 w-7', label: '4:5' }
  if (value === '3:4') return { frameClass: 'h-8 w-6', label: '3:4' }
  if (value === '2:3') return { frameClass: 'h-9 w-6', label: '2:3' }
  if (value === '9:16') return { frameClass: 'h-9 w-5', label: '9:16' }
  return { frameClass: 'h-7 w-7', label: value === 'auto' ? 'Auto' : value }
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

type KlingElementDraftType = 'image' | 'video'

type KlingMultiPromptDraft = {
  id: string
  prompt: string
  duration: string
}

type KlingElementDraft = {
  id: string
  type: KlingElementDraftType
  frontalImageUrl: string
  referenceImageUrls: string[]
  videoUrl: string
  voiceId: string
}

function createDraftId() {
  return Math.random().toString(36).slice(2, 10)
}

function createShotDraft(duration = '5'): KlingMultiPromptDraft {
  return { id: createDraftId(), prompt: '', duration }
}

function createElementDraft(type: KlingElementDraftType): KlingElementDraft {
  return {
    id: createDraftId(),
    type,
    frontalImageUrl: '',
    referenceImageUrls: [],
    videoUrl: '',
    voiceId: '',
  }
}

function getTotalMultiPromptDuration(shots: KlingMultiPromptDraft[]) {
  return shots.reduce((total, shot) => total + Number.parseInt(shot.duration || '0', 10), 0)
}

function getImageStepSettings(model: string) {
  if (model === 'flux/schnell') {
    return { min: 1, max: 4, defaultValue: 4 }
  }

  return { min: 1, max: 50, defaultValue: 20 }
}

type RatioCardProps = {
  active: boolean
  frameClass: string
  label: string
  onClick: () => void
}

function RatioCard({ active, frameClass, label, onClick }: RatioCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-2.5 py-2.5 text-left transition ${
        active
          ? 'depth-primary border-primary/45 bg-primary/16 text-white'
          : 'depth-secondary border-secondary/20 bg-slate-950/72 text-slate-300'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <div
          className={`flex h-9 w-11 shrink-0 items-center justify-center rounded-xl border ${
            active ? 'border-primary/25 bg-primary/10' : 'border-secondary/20 bg-secondary/8'
          }`}
        >
          <div
            className={`rounded-sm border ${
              active ? 'border-primary/55 bg-primary/22' : 'border-primary/40 bg-primary/14'
            } ${frameClass}`}
          />
        </div>
        <div>
          <span className={`block text-xs font-semibold ${active ? 'text-primary-tint' : 'text-white'}`}>{label}</span>
          <span className="block text-[0.65rem] text-slate-400">Vista previa</span>
        </div>
      </div>
    </button>
  )
}

export function AppTabs() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [studioMode, setStudioMode] = useState<StudioMode>('image')
  const [mainTab, setMainTab] = useState<MainTab>('gallery')

  const [prompt, setPrompt] = useState('')
  const [negativePrompt, setNegativePrompt] = useState('')
  const [imageModel, setImageModel] = useState('flux/schnell')
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

  const [videoSource, setVideoSource] = useState('')
  const [videoPrompt, setVideoPrompt] = useState('')
  const [videoNegativePrompt, setVideoNegativePrompt] = useState('')
  const [videoModel, setVideoModel] = useState('kling-video/v3/pro/image-to-video')
  const [videoMode, setVideoMode] = useState<VideoGenerationMode>('text-to-video')
  const [videoDuration, setVideoDurationState] = useState('5')
  const videoDurationRef = useRef('5')
  const [videoAspectRatio, setVideoAspectRatio] = useState('16:9')
  const [videoResolution, setVideoResolution] = useState('720p')
  const [videoGenerateAudio, setVideoGenerateAudio] = useState(true)
  const [videoCfgScale, setVideoCfgScale] = useState(0.5)
  const [videoPromptOptimizer, setVideoPromptOptimizer] = useState(true)
  const [videoSeed, setVideoSeed] = useState('')
  const [videoAutoFix, setVideoAutoFix] = useState(true)
  const [videoDeleteRemote, setVideoDeleteRemote] = useState(true)
  const [videoQuality, setVideoQuality] = useState('medium')
  const [videoNumFrames, setVideoNumFrames] = useState(81)
  const [videoFps, setVideoFps] = useState(16)
  const [videoSteps, setVideoSteps] = useState(30)
  const [videoAcceleration, setVideoAcceleration] = useState('none')
  const [videoPromptExpansion, setVideoPromptExpansion] = useState(true)
  const [videoAudioUrl, setVideoAudioUrl] = useState('')
  const [videoGuidanceScale, setVideoGuidanceScale] = useState(1)
  const [videoAudioGuidanceScale, setVideoAudioGuidanceScale] = useState(2)
  const [videoUseMultiPrompt, setVideoUseMultiPrompt] = useState(false)
  const [videoMultiPromptShots, setVideoMultiPromptShots] = useState<KlingMultiPromptDraft[]>([
    createShotDraft(),
  ])
  const [videoElements, setVideoElements] = useState<KlingElementDraft[]>([])

  const [loading, setLoading] = useState(false)

  const addToGallery = useGallery((state) => state.addWithPersistence)
  const addPending = useGallery((state) => state.addPending)
  const removePending = useGallery((state) => state.removePending)

  function setVideoDuration(value: string) {
    videoDurationRef.current = value
    setVideoDurationState(value)
  }

  const imageSupports = getImageModelConfig(imageModel)?.supports ?? []
  const videoSupports = getVideoEffectiveSupports(videoModel, videoMode)

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
  const supportsImageReference = imageSupports.includes('reference_image')
  const supportsImagePromptStrength = imageSupports.includes('image_prompt_strength')
  const supportsImageStyle = imageSupports.includes('style')
  const supportsImageColors = imageSupports.includes('colors')
  const imageSizeOptions = getImageSizeOptions(imageModel)
  const imageAspectRatioOptions = getImageAspectRatioOptions(imageModel)
  const imageResolutionOptions = getImageResolutionOptions(imageModel)

  const supportsVideoDuration = videoSupports.includes('duration')
  const supportsVideoRatio = videoSupports.includes('aspect_ratio')
  const supportsVideoResolution = videoSupports.includes('resolution')
  const supportsVideoAudio = videoSupports.includes('audio')
  const supportsVideoNegative = videoSupports.includes('negative_prompt')
  const supportsVideoCfg = videoSupports.includes('cfg_scale')
  const supportsVideoOptimizer = videoSupports.includes('prompt_optimizer')
  const supportsVideoSeed = videoSupports.includes('seed')
  const supportsVideoAutoFix = videoSupports.includes('auto_fix')
  const supportsVideoDelete = videoSupports.includes('delete_video')
  const supportsVideoQuality = videoSupports.includes('video_quality')
  const supportsVideoFrames = videoSupports.includes('num_frames')
  const supportsVideoFps = videoSupports.includes('frames_per_second')
  const supportsVideoStepsExtra = videoSupports.includes('num_inference_steps')
  const supportsVideoAcceleration = videoSupports.includes('acceleration')
  const supportsVideoPromptExpansion = videoSupports.includes('prompt_expansion')
  const supportsVideoAudioUrl = videoSupports.includes('audio_url')
  const supportsVideoGuidanceScale = videoSupports.includes('guidance_scale')
  const supportsVideoAudioGuidanceScale = videoSupports.includes('audio_guidance_scale')
  const supportsVideoMultiPrompt = videoSupports.includes('multi_prompt')
  const supportsVideoElements = videoSupports.includes('elements')
  const isAuroraModel = videoModel.includes('aurora')
  const videoModeOptions = getVideoModes(videoModel)
  const videoDurationOptions = getVideoDurations(videoModel)
  const videoAspectRatioOptions = getVideoAspectRatios(videoModel, videoMode)
  const videoResolutionOptions = getVideoResolutions(videoModel, videoMode)
  const requiresVideoSource = videoMode === 'image-to-video'
  const isUsingVideoMultiPrompt = supportsVideoMultiPrompt && videoUseMultiPrompt
  const videoMultiPromptDuration = isUsingVideoMultiPrompt
    ? getTotalMultiPromptDuration(videoMultiPromptShots)
    : 0
  const hasVideoVoiceControl = videoElements.some(
    (element) => element.type === 'video' && element.voiceId.trim().length > 0
  )
  const imageEstimate = estimateImageGenerationCost({
    model: imageModel,
    imageSize: supportsSize ? imageSize : undefined,
    resolution: supportsImageResolution ? imageResolution : undefined,
    numImages: supportsNumImages ? numImages : 1,
    style: supportsImageStyle ? imageStyle : undefined,
  })
  const imageStepSettings = getImageStepSettings(imageModel)
  const videoEstimate = estimateVideoGenerationCost({
    model: videoModel,
    mode: videoMode,
    duration: supportsVideoDuration
      ? (isUsingVideoMultiPrompt ? String(videoMultiPromptDuration) : videoDuration)
      : undefined,
    resolution: supportsVideoResolution ? videoResolution : undefined,
    aspectRatio: supportsVideoRatio ? videoAspectRatio : undefined,
    generateAudio: supportsVideoAudio ? videoGenerateAudio : undefined,
    numFrames: supportsVideoFrames ? videoNumFrames : undefined,
    hasVoiceControl: supportsVideoElements ? hasVideoVoiceControl : undefined,
  })
  const activeEstimate = studioMode === 'image' ? imageEstimate : videoEstimate
  const hasVideoPromptInput = isUsingVideoMultiPrompt
    ? videoMultiPromptShots.some((shot) => shot.prompt.trim().length > 0)
    : videoPrompt.trim().length > 0

  useEffect(() => {
    if (videoModeOptions.includes(videoMode)) return
    const nextMode = videoModeOptions[0]
    if (nextMode) setVideoMode(nextMode)
  }, [videoMode, videoModeOptions])

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

  useEffect(() => {
    if (!supportsVideoDuration) return
    if (videoDurationOptions.length === 0) return
    if (videoDurationOptions.includes(videoDuration)) return
    const nextDuration = videoDurationOptions[0]
    if (!nextDuration) return
    videoDurationRef.current = nextDuration
    setVideoDurationState(nextDuration)
  }, [supportsVideoDuration, videoDuration, videoModel])

  useEffect(() => {
    if (!supportsVideoRatio) return
    if (videoAspectRatioOptions.includes(videoAspectRatio)) return
    setVideoAspectRatio(videoAspectRatioOptions[0] || '16:9')
  }, [supportsVideoRatio, videoAspectRatio, videoModel, videoMode])

  useEffect(() => {
    if (!supportsVideoResolution) return
    if (videoResolutionOptions.includes(videoResolution)) return
    setVideoResolution(videoResolutionOptions[0] || '720p')
  }, [supportsVideoResolution, videoModel, videoMode, videoResolution])

  useEffect(() => {
    if (supportsVideoMultiPrompt) return
    if (videoUseMultiPrompt) setVideoUseMultiPrompt(false)
  }, [supportsVideoMultiPrompt, videoUseMultiPrompt])

  async function handleVideoFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const dataUrl = await fileToDataUrl(file)
      const optimizedUrl = await optimizeImageIfLarge(dataUrl, 800)
      setVideoSource(optimizedUrl)
    } catch (error) {
      toast.error('Error al cargar imagen')
      console.error(error)
    }
  }

  async function handleVideoAudioFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      setVideoAudioUrl(reader.result as string)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  async function handleVideoElementImageChange(
    e: ChangeEvent<HTMLInputElement>,
    elementId: string,
    field: 'frontalImageUrl'
  ) {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const dataUrl = await fileToDataUrl(file)
      const optimizedUrl = await optimizeImageIfLarge(dataUrl, 800)
      setVideoElements((current) =>
        current.map((element) =>
          element.id === elementId ? { ...element, [field]: optimizedUrl } : element
        )
      )
    } catch (error) {
      toast.error('Error al cargar la imagen del elemento')
      console.error(error)
    } finally {
      e.target.value = ''
    }
  }

  async function handleVideoElementReferenceChange(
    e: ChangeEvent<HTMLInputElement>,
    elementId: string
  ) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return

    try {
      const nextUrls = await Promise.all(
        files.slice(0, 3).map(async (file) => optimizeImageIfLarge(await fileToDataUrl(file), 800))
      )
      setVideoElements((current) =>
        current.map((element) =>
          element.id === elementId
            ? {
                ...element,
                referenceImageUrls: [...element.referenceImageUrls, ...nextUrls].slice(0, 3),
              }
            : element
        )
      )
      if (files.length > 3) {
        toast.error('Kling acepta máximo 3 referencias por elemento')
      }
    } catch (error) {
      toast.error('Error al cargar las referencias')
      console.error(error)
    } finally {
      e.target.value = ''
    }
  }

  async function handleVideoElementVideoChange(e: ChangeEvent<HTMLInputElement>, elementId: string) {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const dataUrl = await fileToDataUrl(file)
      setVideoElements((current) =>
        current.map((element) =>
          element.id === elementId ? { ...element, videoUrl: dataUrl } : element
        )
      )
    } catch (error) {
      toast.error('Error al cargar el video del elemento')
      console.error(error)
    } finally {
      e.target.value = ''
    }
  }

  function updateVideoShot(id: string, patch: Partial<Omit<KlingMultiPromptDraft, 'id'>>) {
    setVideoMultiPromptShots((current) =>
      current.map((shot) => (shot.id === id ? { ...shot, ...patch } : shot))
    )
  }

  function removeVideoShot(id: string) {
    setVideoMultiPromptShots((current) => {
      if (current.length === 1) return [createShotDraft(videoDurationRef.current)]
      return current.filter((shot) => shot.id !== id)
    })
  }

  function addVideoShot() {
    setVideoMultiPromptShots((current) => [...current, createShotDraft(videoDurationRef.current)])
  }

  function updateVideoElement(id: string, patch: Partial<Omit<KlingElementDraft, 'id'>>) {
    setVideoElements((current) =>
      current.map((element) => (element.id === id ? { ...element, ...patch } : element))
    )
  }

  function setVideoElementType(id: string, type: KlingElementDraftType) {
    setVideoElements((current) =>
      current.map((element) =>
        element.id === id
          ? {
              ...createElementDraft(type),
              id: element.id,
            }
          : element
      )
    )
  }

  function addVideoElement(type: KlingElementDraftType) {
    if (type === 'video' && videoElements.some((element) => element.type === 'video')) {
      toast.error('Kling permite solo un elemento basado en video por generación')
      return
    }

    setVideoElements((current) => [...current, createElementDraft(type)])
  }

  function removeVideoElement(id: string) {
    setVideoElements((current) => current.filter((element) => element.id !== id))
  }

  function buildVideoMultiPromptPayload(): KlingV3MultiPromptElement[] {
    return videoMultiPromptShots.map((shot) => ({
      prompt: shot.prompt.trim(),
      duration: shot.duration as KlingV3MultiPromptElement['duration'],
    }))
  }

  function buildVideoElementsPayload(): KlingV3ComboElementInput[] {
    return videoElements.map((element) => {
      if (element.type === 'video') {
        return {
          video_url: element.videoUrl.trim(),
          voice_id: element.voiceId.trim() || undefined,
        }
      }

      return {
        frontal_image_url: element.frontalImageUrl.trim(),
        reference_image_urls: element.referenceImageUrls,
      }
    })
  }

  async function handleReferenceFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const dataUrl = await fileToDataUrl(file)
      const optimizedUrl = await optimizeImageIfLarge(dataUrl, 800)
      setReferenceImages([optimizedUrl])
    } catch (error) {
      toast.error('No se pudieron cargar las referencias')
      console.error(error)
    }
  }

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
        imageUrl: supportsImageReference ? referenceImages[0] : undefined,
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
            references: supportsImageReference ? referenceImages.slice(0, 1) : undefined,
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

  async function handleGenerateVideo() {
    const trimmedVideoPrompt = videoPrompt.trim()
    const multiPromptPayload = isUsingVideoMultiPrompt ? buildVideoMultiPromptPayload() : undefined
    const elementsPayload = supportsVideoElements ? buildVideoElementsPayload() : undefined

    if (isAuroraModel) {
      if (!videoSource) {
        toast.error('Sube una foto del avatar')
        return
      }
      if (!videoAudioUrl) {
        toast.error('Sube un archivo de audio')
        return
      }
    } else {
      if (requiresVideoSource && !videoSource) {
        toast.error('Sube una imagen base para este modelo')
        return
      }
      if (isUsingVideoMultiPrompt) {
        for (const [index, shot] of videoMultiPromptShots.entries()) {
          if (!shot.prompt.trim()) {
            toast.error(`Completa el prompt del shot ${index + 1}`)
            return
          }
        }
      } else if (!trimmedVideoPrompt) {
        toast.error('Ingresa un prompt')
        return
      }

      if (supportsVideoElements) {
        let videoElementCount = 0

        for (const [index, element] of videoElements.entries()) {
          if (element.type === 'video') {
            videoElementCount += 1

            if (!element.videoUrl.trim()) {
              toast.error(`Sube el video para Element${index + 1}`)
              return
            }
          } else {
            if (!element.frontalImageUrl.trim()) {
              toast.error(`Sube la imagen frontal para Element${index + 1}`)
              return
            }

            if (element.referenceImageUrls.length === 0) {
              toast.error(`Agrega al menos una referencia para Element${index + 1}`)
              return
            }
          }
        }

        if (videoElementCount > 1) {
          toast.error('Kling permite solo un elemento de video por generación')
          return
        }

        if (hasVideoVoiceControl && !videoGenerateAudio) {
          toast.error('Activa audio nativo para usar voice ID en elementos de video')
          return
        }
      }
    }

    const videoConfig = getVideoModelConfig(videoModel)
    setLoading(true)

    try {
      const selectedDuration = supportsVideoDuration
        ? (isUsingVideoMultiPrompt ? String(videoMultiPromptDuration) : videoDurationRef.current)
        : undefined
      const galleryPrompt = isUsingVideoMultiPrompt
        ? videoMultiPromptShots
            .map((shot, index) => `Shot ${index + 1}: ${shot.prompt.trim()}`)
            .join(' | ')
        : trimmedVideoPrompt

      const requestConfig = {
        prompt: trimmedVideoPrompt,
        model: videoModel,
        mode: videoMode,
        imageUrl: requiresVideoSource ? videoSource : undefined,
        duration: selectedDuration,
        negativePrompt: supportsVideoNegative ? (videoNegativePrompt || undefined) : undefined,
        cfgScale: supportsVideoCfg ? videoCfgScale : undefined,
        aspectRatio: supportsVideoRatio ? videoAspectRatio : undefined,
        resolution: supportsVideoResolution ? videoResolution : undefined,
        generateAudio: supportsVideoAudio ? videoGenerateAudio : undefined,
        promptOptimizer: supportsVideoOptimizer ? videoPromptOptimizer : undefined,
        seed: supportsVideoSeed && videoSeed ? parseInt(videoSeed, 10) : undefined,
        autoFix: supportsVideoAutoFix ? videoAutoFix : undefined,
        deleteVideo: supportsVideoDelete ? videoDeleteRemote : undefined,
        videoQuality: supportsVideoQuality ? videoQuality : undefined,
        numFrames: supportsVideoFrames ? videoNumFrames : undefined,
        framesPerSecond: supportsVideoFps ? videoFps : undefined,
        numInferenceSteps: supportsVideoStepsExtra ? videoSteps : undefined,
        acceleration: supportsVideoAcceleration ? videoAcceleration : undefined,
        enablePromptExpansion: supportsVideoPromptExpansion ? videoPromptExpansion : undefined,
        audioUrl: supportsVideoAudioUrl ? videoAudioUrl : undefined,
        guidanceScale: supportsVideoGuidanceScale ? videoGuidanceScale : undefined,
        audioGuidanceScale: supportsVideoAudioGuidanceScale ? videoAudioGuidanceScale : undefined,
        multiPrompt: isUsingVideoMultiPrompt ? multiPromptPayload : undefined,
        shotType: isUsingVideoMultiPrompt ? ('customize' as const) : undefined,
        elements: supportsVideoElements ? elementsPayload : undefined,
      }
      const job = await enqueueVideoGeneration(requestConfig)
      
      console.info('[aurora.request]', {
        model: videoModel,
        hasImage: !!videoSource,
        imageSize: videoSource?.length ?? 0,
        hasAudio: !!videoAudioUrl,
        audioSize: videoAudioUrl?.length ?? 0,
        audioSizeMB: videoAudioUrl ? Math.round(videoAudioUrl.length / 1024 / 1024 * 100) / 100 : 0,
        hasPrompt: !!videoPrompt.trim(),
        promptLength: videoPrompt.length,
        resolution: videoResolution,
        guidanceScale: videoGuidanceScale,
        audioGuidanceScale: videoAudioGuidanceScale,
      })

      addPending({
        type: 'video',
        prompt: galleryPrompt,
        model: videoModel,
        costTier: videoConfig?.costTier,
        metadata: {
          requestId: job.requestId,
          videoMode,
          estimatedCost: videoEstimate?.amount,
          duration: selectedDuration,
          aspectRatio: supportsVideoRatio ? videoAspectRatio : undefined,
          resolution: supportsVideoResolution ? videoResolution : undefined,
          seed: supportsVideoSeed && videoSeed ? parseInt(videoSeed, 10) : undefined,
          videoQuality: supportsVideoQuality ? videoQuality : undefined,
          numFrames: supportsVideoFrames ? videoNumFrames : undefined,
          framesPerSecond: supportsVideoFps ? videoFps : undefined,
          negativePrompt: supportsVideoNegative ? (videoNegativePrompt || undefined) : undefined,
        },
      })

      toast.success(`Video en cola (${selectedDuration ? `${selectedDuration}s` : 'duración por defecto'})`)
    } catch (error) {
      toast.error('Error al encolar video')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const layoutClass = sidebarCollapsed
    ? 'grid-cols-[84px_minmax(0,1fr)]'
    : 'grid-cols-[18.5rem_minmax(0,1fr)] min-[1440px]:grid-cols-[20rem_minmax(0,1fr)] min-[1680px]:grid-cols-[22rem_minmax(0,1fr)] min-[1920px]:grid-cols-[24rem_minmax(0,1fr)]'

  const mainActionLabel =
    studioMode === 'image' 
      ? (loading ? 'Generando...' : 'Generar') 
      : isAuroraModel 
        ? (loading ? 'Generando avatar...' : 'Generar Avatar')
        : (loading ? 'Generando...' : 'Renderizar Video')

  return (
    <div className={`grid min-h-screen ${layoutClass}`}>
      <aside className="depth-secondary relative h-screen border-r border-secondary/30 bg-slate-950/96">
        <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-secondary/0 via-secondary/80 to-secondary/0" />

        <div className="flex h-full flex-col">
          <div className="surface-secondary border-b border-secondary/25 px-3 py-3">
            <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} gap-2`}>
              {!sidebarCollapsed ? (
                <div>
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-secondary-tint">
                    PixelCraft
                  </p>
                  <p className="mt-1 font-display text-3xl leading-none text-white">Studio</p>
                </div>
              ) : null}

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setSidebarCollapsed((current) => !current)}
                className="depth-secondary h-10 w-10 rounded-2xl border border-secondary/25 bg-secondary/10 text-secondary-tint hover:bg-secondary/15 hover:text-white"
              >
                {sidebarCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="border-b border-secondary/20 p-3">
            <div className={`grid gap-2 ${sidebarCollapsed ? 'grid-cols-1' : 'grid-cols-2'}`}>
               <button
                 type="button"
                 onClick={() => {
                   startTransition(() => {
                     setStudioMode('image')
                   })
                 }}
                 className={`rounded-2xl border px-3 py-3 text-left transition ${
                   studioMode === 'image'
                     ? 'depth-primary border-primary/40 bg-primary/12 text-white'
                     : 'depth-secondary border-secondary/20 bg-secondary/5 text-slate-300'
                 }`}
               >
                 <Sparkles className={`h-4 w-4 ${studioMode === 'image' ? 'text-primary-tint' : 'text-secondary-tint'}`} />
                 {!sidebarCollapsed ? (
                   <>
                     <span className="mt-2 block text-sm font-semibold">Imagen</span>
                     <span className="block text-xs text-slate-400">Generar</span>
                   </>
                 ) : null}
               </button>

               <button
                 type="button"
                 onClick={() => {
                   startTransition(() => {
                     setStudioMode('video')
                   })
                 }}
                 className={`rounded-2xl border px-3 py-3 text-left transition ${
                   studioMode === 'video'
                     ? 'depth-primary border-primary/40 bg-primary/12 text-white'
                     : 'depth-secondary border-secondary/20 bg-secondary/5 text-slate-300'
                 }`}
               >
                 <Clapperboard className={`h-4 w-4 ${studioMode === 'video' ? 'text-primary-tint' : 'text-secondary-tint'}`} />
                 {!sidebarCollapsed ? (
                   <>
                     <span className="mt-2 block text-sm font-semibold">Video</span>
                     <span className="block text-xs text-slate-400">Animar</span>
                   </>
                 ) : null}
               </button>
            </div>
          </div>

          {sidebarCollapsed ? (
            <div className="flex flex-1 flex-col items-center justify-between px-3 py-4">
              <div className="flex flex-col gap-3">
                <div className="depth-primary flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary-tint">
                  {studioMode === 'image' ? (
                    <Sparkles className="h-4 w-4" />
                  ) : (
                    <Clapperboard className="h-4 w-4" />
                  )}
                </div>
              </div>

              <div className="flex flex-col items-center gap-3">
                <CostEstimatePreview estimate={activeEstimate} compact />
                <Button
                  onClick={studioMode === 'image' ? handleGenerateImage : handleGenerateVideo}
                  disabled={
                    loading ||
                    (studioMode === 'image'
                      ? !prompt.trim()
                      : isAuroraModel
                        ? !videoSource || !videoAudioUrl
                        : (requiresVideoSource && !videoSource) || !hasVideoPromptInput)
                  }
                  className="depth-primary h-11 w-11 rounded-2xl border border-primary/30 bg-primary/90 p-0 text-primary-foreground hover:bg-primary"
                >
                  {studioMode === 'image' ? (
                    <Sparkles className="h-4 w-4" />
                  ) : (
                    <Clapperboard className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <ScrollArea className="min-h-0 flex-1">
                <div className="space-y-4 p-4">
                  {studioMode === 'image' ? (
                    <>
                      <div className="depth-mixed rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
                        <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
                          Prompt
                        </Label>
                        <Textarea
                          className="mt-3 min-h-36 rounded-3xl border border-secondary/20 bg-slate-950/80 text-white shadow-none"
                          placeholder="Describe your image..."
                          value={prompt}
                          onChange={(e) => setPrompt(e.target.value)}
                        />
                        {supportsNegative ? (
                          <Textarea
                            className="mt-3 min-h-20 rounded-3xl border border-primary/20 bg-slate-950/80 text-white shadow-none"
                             placeholder="Prompt negativo..."
                            value={negativePrompt}
                            onChange={(e) => setNegativePrompt(e.target.value)}
                          />
                        ) : null}
                      </div>

                      {supportsImageReference ? (
                        <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
                          <div className="mb-3 flex items-center justify-between">
                            <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
                              Referencia
                            </Label>
                            <Badge variant="secondary" className="depth-secondary border border-secondary/25 bg-secondary/10 text-secondary-tint">
                              {referenceImages.length > 0 ? '1/1' : '0/1'}
                            </Badge>
                          </div>

                          <label className="depth-secondary flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-secondary/25 bg-slate-950/75 px-4 py-4 text-sm text-slate-300">
                            <ImagePlus className="h-4 w-4 text-secondary-tint" />
                            Add reference
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleReferenceFileChange}
                            />
                          </label>

                          {referenceImages[0] ? (
                            <div className="mt-3">
                              <div className="depth-mixed relative overflow-hidden rounded-2xl border border-secondary/20 bg-slate-950/80">
                                <div className="relative aspect-video">
                                  <Image
                                    src={referenceImages[0]}
                                    alt="Reference"
                                    fill
                                    className="object-cover"
                                    unoptimized
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setReferenceImages([])}
                                  className="depth-primary absolute right-2 top-2 rounded-full border border-primary/20 bg-primary/15 px-2 py-1 text-[0.65rem] font-semibold text-primary-tint"
                                >
                                  Eliminar
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {supportsImagePromptStrength ? (
                        <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
                          <div className="flex items-center justify-between">
                            <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
                              Fuerza de referencia
                            </Label>
                            <span className="text-sm text-primary-tint">{imagePromptStrength.toFixed(2)}</span>
                          </div>
                          <Slider
                            className="mt-4"
                            value={[imagePromptStrength]}
                            onValueChange={([value]) => setImagePromptStrength(value)}
                            min={0}
                            max={1}
                            step={0.05}
                          />
                        </div>
                      ) : null}

                      <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
                            Models
                          </Label>
                          <Badge variant="secondary" className="depth-secondary border border-secondary/25 bg-secondary/10 text-secondary-tint">
                            {Object.keys(IMAGE_MODEL_FAMILIES).length} familias
                          </Badge>
                        </div>
                        <div className="space-y-3">
                          {Object.entries(IMAGE_MODEL_FAMILIES).map(([familyId, family]) => (
                            <div key={familyId} className="rounded-2xl border border-secondary/15 bg-slate-950/55 p-2">
                              <div className="mb-2 flex items-center justify-between px-2">
                                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                                  {family.name}
                                </span>
                                <span className="text-xs text-secondary-tint">{Object.keys(family.models).length}</span>
                              </div>
                              <div className="space-y-2">
                                {Object.entries(family.models).map(([modelId, config]) => (
                                  <button
                                    key={modelId}
                                    type="button"
                                    onClick={() => setImageModel(modelId)}
                                    className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                                      imageModel === modelId
                                        ? 'depth-primary border-primary/35 bg-primary/10 text-white'
                                        : 'depth-secondary border-secondary/15 bg-slate-950/70 text-slate-300'
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <span className="block text-sm font-semibold">{config.name}</span>
                                        <span className="block text-xs text-slate-400">{family.name}</span>
                                      </div>
                                      {getCostTierLabel(config.costTier) && (
                                        <span className="text-xs text-slate-400">
                                          {getCostTierLabel(config.costTier)}
                                        </span>
                                      )}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {supportsSize ? (
                        <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
                          <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
                            Aspect Ratio
                          </Label>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            {imageSizeOptions.map((size) => {
                              const card = getImageSizeCard(size.value, size.label)
                              return (
                                <RatioCard
                                  key={size.value}
                                  active={imageSize === size.value}
                                  frameClass={card.frameClass}
                                  label={card.label}
                                  onClick={() => setImageSize(size.value)}
                                />
                              )
                            })}
                          </div>
                        </div>
                      ) : null}

                      {supportsImageAspectRatio ? (
                        <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
                          <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
                            Frame
                          </Label>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            {imageAspectRatioOptions.map((ratio) => {
                              const card = getImageAspectRatioCard(ratio.value)
                              return (
                                <RatioCard
                                  key={ratio.value}
                                  active={imageAspectRatio === ratio.value}
                                  frameClass={card.frameClass}
                                  label={card.label}
                                  onClick={() => setImageAspectRatio(ratio.value)}
                                />
                              )
                            })}
                          </div>
                        </div>
                      ) : null}

                      {supportsImageResolution ? (
                        <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
                          <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
                            Resolution
                          </Label>
                          <div className="mt-3 grid grid-cols-3 gap-2">
                            {imageResolutionOptions.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => setImageResolution(option.value)}
                                className={`rounded-2xl border px-3 py-2 text-sm transition ${
                                  imageResolution === option.value
                                    ? 'depth-primary border-primary/35 bg-primary/10 text-white'
                                    : 'border-secondary/15 bg-slate-950/70 text-slate-300'
                                }`}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {supportsImageStyle ? (
                        <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
                          <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
                            Estilo
                          </Label>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            {RECRAFT_STYLES.map((style) => (
                              <button
                                key={style.value}
                                type="button"
                                onClick={() => setImageStyle(style.value)}
                                className={`rounded-2xl border px-3 py-2 text-sm transition ${
                                  imageStyle === style.value
                                    ? 'depth-primary border-primary/35 bg-primary/10 text-white'
                                    : 'border-secondary/15 bg-slate-950/70 text-slate-300'
                                }`}
                              >
                                {style.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {supportsImageColors ? (
                        <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
                          <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
                            Colores
                          </Label>
                          <Textarea
                            className="mt-3 min-h-20 rounded-3xl border border-secondary/20 bg-slate-950/80 text-white shadow-none"
                            placeholder="#FF6B6B, #1A73E8"
                            value={imageColors}
                            onChange={(e) => setImageColors(e.target.value)}
                          />
                        </div>
                      ) : null}

                      {supportsImageOutputFormat ? (
                        <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
                          <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
                            Output
                          </Label>
                          <Select value={imageOutputFormat} onValueChange={setImageOutputFormat}>
                            <SelectTrigger className="depth-secondary mt-3 border border-secondary/20 bg-slate-900/70 text-white">
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
                      ) : null}

                      {supportsImageQuality ? (
                        <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
                          <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
                            Quality
                          </Label>
                          <Select value={imageQuality} onValueChange={setImageQuality}>
                            <SelectTrigger className="depth-secondary mt-3 border border-secondary/20 bg-slate-900/70 text-white">
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
                      ) : null}

                      {supportsImageBackground ? (
                        <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
                          <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
                            Background
                          </Label>
                          <Select value={imageBackground} onValueChange={setImageBackground}>
                            <SelectTrigger className="depth-secondary mt-3 border border-secondary/20 bg-slate-900/70 text-white">
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
                      ) : null}

                      {supportsNumImages ? (
                        <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
                          <div className="flex items-center justify-between">
                            <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
                               Lote
                            </Label>
                            <span className="text-sm text-primary-tint">{numImages}</span>
                          </div>
                          <Slider
                            className="mt-4"
                            value={[numImages]}
                            onValueChange={([value]) => setNumImages(value)}
                            min={1}
                            max={4}
                            step={1}
                          />
                        </div>
                      ) : null}

                      {supportsGuidance ? (
                        <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
                          <div className="flex items-center justify-between">
                            <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
                               Guía
                            </Label>
                            <span className="text-sm text-primary-tint">{guidanceScale}</span>
                          </div>
                          <Slider
                            className="mt-4"
                            value={[guidanceScale]}
                            onValueChange={([value]) => setGuidanceScale(value)}
                            min={1}
                            max={20}
                            step={0.5}
                          />
                        </div>
                      ) : null}

                      <details className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
                        <summary className="cursor-pointer list-none text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
                           Avanzado
                        </summary>
                        <div className="mt-4 space-y-4">
                          {supportsImageSeed ? (
                            <div>
                              <div className="flex items-center justify-between">
                                <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-slate-400">
                                 Semilla
                              </Label>
                              <button
                                type="button"
                                className="text-xs font-semibold text-primary-tint"
                                onClick={() => setSeed(Math.floor(Math.random() * 999999))}
                              >
                                 Aleatorio
                              </button>
                            </div>
                              <div className="depth-mixed mt-3 rounded-2xl border border-primary/20 bg-slate-950/80 px-3 py-2 text-sm text-white">
                                {seed ?? 'Auto'}
                              </div>
                            </div>
                          ) : null}

                          {supportsSteps ? (
                            <div>
                              <div className="flex items-center justify-between">
                                <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-slate-400">
                                   Pasos
                                </Label>
                                <span className="text-sm text-primary-tint">{numInferenceSteps}</span>
                              </div>
                              <Slider
                                className="mt-4"
                                value={[numInferenceSteps]}
                                onValueChange={([value]) => setNumInferenceSteps(value)}
                                min={imageStepSettings.min}
                                max={imageStepSettings.max}
                                step={1}
                              />
                            </div>
                          ) : null}
                        </div>
                      </details>
                    </>
                  ) : (
                    <>
                      {isAuroraModel ? (
                        <>
                          <div className="rounded-3xl border border-blue-500/30 bg-blue-500/8 p-4 space-y-3">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
                              <h3 className="font-semibold text-sm text-blue-300">
                                Aurora - Avatar Video
                              </h3>
                            </div>
                            <p className="text-xs text-slate-400">
                              Crea videos de alta fidelidad de tu avatar hablando o cantando. 
                              Sincronización labial automática con el audio.
                            </p>
                          </div>

                          <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
                            <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
                              Foto del Avatar
                            </Label>
                            {videoSource ? (
                              <div className="depth-mixed mt-3 overflow-hidden rounded-3xl border border-secondary/20 bg-slate-950/80">
                                <div className="relative aspect-video">
                                  <Image
                                    src={videoSource}
                                    alt="Avatar"
                                    fill
                                    className="object-cover"
                                    unoptimized
                                  />
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="secondary"
                                    className="absolute right-3 top-3 h-8 w-8"
                                    onClick={() => setVideoSource('')}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <label className="depth-secondary mt-3 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-secondary/25 bg-slate-950/80 px-4 py-8 text-sm text-slate-300">
                                <ImagePlus className="h-6 w-6 text-secondary-tint" />
                                <span>Sube una foto</span>
                                <span className="text-xs text-slate-500">Rostro visible, fondo claro</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={handleVideoFileChange}
                                />
                              </label>
                            )}
                          </div>

                          <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
                            <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
                              Audio (habla o canto)
                            </Label>
                            {videoAudioUrl ? (
                              <div className="depth-mixed mt-3 rounded-2xl border border-secondary/20 bg-slate-950/80 p-3">
                                <audio src={videoAudioUrl} controls className="w-full h-8" />
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  className="mt-2 w-full"
                                  onClick={() => setVideoAudioUrl('')}
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Cambiar audio
                                </Button>
                              </div>
                            ) : (
                              <label className="depth-secondary mt-3 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-secondary/25 bg-slate-950/80 px-4 py-6 text-sm text-slate-300">
                                <Music className="h-6 w-6 text-secondary-tint" />
                                <span>Sube un audio</span>
                                <span className="text-xs text-slate-500">WAV, MP3, M4A</span>
                                <input
                                  type="file"
                                  accept="audio/*"
                                  className="hidden"
                                  onChange={handleVideoAudioFileChange}
                                />
                              </label>
                            )}
                          </div>

                          <div className="depth-mixed rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
                            <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
                              Estilo del video (opcional)
                            </Label>
                            <Textarea
                              className="mt-3 min-h-20 rounded-3xl border border-secondary/20 bg-slate-950/80 text-white shadow-none"
                              placeholder="4K studio interview, soft lighting, professional backdrop..."
                              value={videoPrompt}
                              onChange={(e) => setVideoPrompt(e.target.value)}
                            />
                            <p className="mt-2 text-xs text-slate-500">
                              Describe el estilo visual. La sincronización labial es automática.
                            </p>
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <div className="depth-secondary rounded-2xl border border-secondary/20 bg-slate-900/70 p-3">
                              <Label className="text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-secondary-tint">
                                Resolución
                              </Label>
                              <div className="mt-2 grid grid-cols-1 gap-1">
                                {['480p', '720p'].map((res) => (
                                  <button
                                    key={res}
                                    type="button"
                                    onClick={() => setVideoResolution(res)}
                                    className={`rounded-xl border px-2 py-1.5 text-xs transition ${
                                      videoResolution === res
                                        ? 'depth-primary border-primary/35 bg-primary/10 text-white'
                                        : 'border-secondary/15 bg-slate-950/70 text-slate-300'
                                    }`}
                                  >
                                    {res}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="depth-secondary rounded-2xl border border-secondary/20 bg-slate-900/70 p-3">
                              <div className="flex items-center justify-between">
                                <Label className="text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-secondary-tint">
                                  Visual
                                </Label>
                                <span className="text-xs text-primary-tint">{videoGuidanceScale.toFixed(1)}</span>
                              </div>
                              <Slider
                                className="mt-3"
                                value={[videoGuidanceScale]}
                                onValueChange={([v]) => setVideoGuidanceScale(v)}
                                min={0}
                                max={5}
                                step={0.5}
                              />
                              <p className="mt-1 text-[0.6rem] text-slate-500">Estilo</p>
                            </div>

                            <div className="depth-secondary rounded-2xl border border-secondary/20 bg-slate-900/70 p-3">
                              <div className="flex items-center justify-between">
                                <Label className="text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-secondary-tint">
                                  Lip-sync
                                </Label>
                                <span className="text-xs text-primary-tint">{videoAudioGuidanceScale.toFixed(1)}</span>
                              </div>
                              <Slider
                                className="mt-3"
                                value={[videoAudioGuidanceScale]}
                                onValueChange={([v]) => setVideoAudioGuidanceScale(v)}
                                min={0}
                                max={5}
                                step={0.5}
                              />
                              <p className="mt-1 text-[0.6rem] text-slate-500">Sincronización</p>
                            </div>
                          </div>

                          <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
                            <details className="group">
                              <summary className="flex cursor-pointer list-none items-center justify-between">
                                <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
                                  Cambiar modelo
                                </Label>
                                <ChevronRight className="h-4 w-4 text-slate-400 transition group-open:rotate-90" />
                              </summary>
                              <div className="mt-3 space-y-2">
                                {Object.entries(VIDEO_MODEL_FAMILIES).map(([familyId, family]) => (
                                  <details key={familyId} className="group/family rounded-2xl border border-secondary/15 bg-slate-950/55">
                                    <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                                          {family.name}
                                        </span>
                                        <span className="text-xs text-secondary-tint">{Object.keys(family.models).length}</span>
                                      </div>
                                      <ChevronRight className="h-3.5 w-3.5 text-slate-400 transition group-open/family:rotate-90" />
                                    </summary>
                                    <div className="space-y-2 p-2 pt-0">
                                      {Object.entries(family.models).map(([modelId, config]) => (
                                        <button
                                          key={modelId}
                                          type="button"
                                          onClick={() => setVideoModel(modelId)}
                                          className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                                            videoModel === modelId
                                              ? 'depth-primary border-primary/35 bg-primary/10 text-white'
                                              : 'depth-secondary border-secondary/15 bg-slate-950/70 text-slate-300'
                                          }`}
                                        >
                                          <div className="flex items-center justify-between gap-3">
                                            <span className="block text-sm font-semibold">{config.name}</span>
                                            {getCostTierLabel(config.costTier) && (
                                              <span className="text-xs text-slate-400">
                                                {getCostTierLabel(config.costTier)}
                                              </span>
                                            )}
                                          </div>
                                        </button>
                                      ))}
                                    </div>
                                  </details>
                                ))}
                              </div>
                            </details>
                          </div>
                        </>
                      ) : (
                        <>
                       <div className="depth-mixed rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
                            {isUsingVideoMultiPrompt ? 'Multi-shot' : 'Prompt'}
                          </Label>
                          {supportsVideoMultiPrompt ? (
                            <button
                              type="button"
                              onClick={() => setVideoUseMultiPrompt((current) => !current)}
                              className={`rounded-full px-2 py-0.5 text-[0.6rem] font-semibold uppercase transition ${
                                videoUseMultiPrompt
                                  ? 'bg-primary/20 text-primary-tint'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              Multi-shot {videoUseMultiPrompt ? 'ON' : 'OFF'}
                            </button>
                          ) : null}
                        </div>

                        {isUsingVideoMultiPrompt ? (
                          <div className="mt-3 space-y-3">
                            {videoMultiPromptShots.map((shot, index) => (
                              <div
                                key={shot.id}
                                className="rounded-3xl border border-secondary/20 bg-slate-950/80 p-3"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-sm font-semibold text-white">Shot {index + 1}</span>
                                  <div className="flex items-center gap-2">
                                    <Select
                                      value={shot.duration}
                                      onValueChange={(value) => updateVideoShot(shot.id, { duration: value })}
                                    >
                                      <SelectTrigger className="h-9 w-24 border border-secondary/20 bg-slate-900/70 text-white">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {videoDurationOptions.map((duration) => (
                                          <SelectItem key={duration} value={duration}>
                                            {duration}s
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="text-slate-300"
                                      onClick={() => removeVideoShot(shot.id)}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                                <Textarea
                                  className="mt-3 min-h-24 rounded-3xl border border-secondary/20 bg-slate-950/80 text-white shadow-none"
                                  placeholder="Describe este shot..."
                                  value={shot.prompt}
                                  onChange={(e) => updateVideoShot(shot.id, { prompt: e.target.value })}
                                />
                              </div>
                            ))}
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-xs text-slate-400">
                                Duración estimada: {videoMultiPromptDuration}s
                              </span>
                              <Button type="button" variant="outline" size="sm" onClick={addVideoShot}>
                                Agregar shot
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Textarea
                            className="mt-3 min-h-32 rounded-3xl border border-secondary/20 bg-slate-950/80 text-white shadow-none"
                            placeholder="Describe el movimiento..."
                            value={videoPrompt}
                            onChange={(e) => setVideoPrompt(e.target.value)}
                          />
                        )}

                        {supportsVideoNegative ? (
                          <Textarea
                            className="mt-3 min-h-20 rounded-3xl border border-primary/20 bg-slate-950/80 text-white shadow-none"
                            placeholder="Prompt negativo..."
                            value={videoNegativePrompt}
                            onChange={(e) => setVideoNegativePrompt(e.target.value)}
                          />
                        ) : null}
                      </div>

                      {videoModeOptions.length > 1 ? (
                        <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
                          <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
                            Modo
                          </Label>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            {videoModeOptions.map((option) => (
                              <button
                                key={option}
                                type="button"
                                onClick={() => setVideoMode(option)}
                                className={`rounded-2xl border px-3 py-2 text-sm transition ${
                                  videoMode === option
                                    ? 'depth-primary border-primary/35 bg-primary/10 text-white'
                                    : 'border-secondary/15 bg-slate-950/70 text-slate-300'
                                }`}
                              >
                                {option === 'text-to-video' ? 'Solo prompt' : 'Con imagen'}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {requiresVideoSource ? (
                        <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
                          <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
                            Origen
                          </Label>
                          {videoSource ? (
                            <div className="depth-mixed mt-3 overflow-hidden rounded-3xl border border-secondary/20 bg-slate-950/80">
                              <div className="relative aspect-video">
                                <Image
                                  src={videoSource}
                                  alt="Origen del video"
                                  fill
                                  className="object-cover"
                                  unoptimized
                                />
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="secondary"
                                  className="absolute right-3 top-3 h-8 w-8"
                                  onClick={() => setVideoSource('')}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <label className="depth-secondary mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-3xl border border-dashed border-secondary/25 bg-slate-950/80 px-4 py-8 text-sm text-slate-300">
                              <ImagePlus className="h-4 w-4 text-secondary-tint" />
                              Sube una imagen
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleVideoFileChange}
                              />
                            </label>
                          )}
                        </div>
                      ) : null}

                      {supportsVideoElements && requiresVideoSource ? (
                        <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
                                Elementos
                              </Label>
                              <p className="mt-1 text-xs text-slate-400">
                                Úsalos como `@Element1`, `@Element2`, etc.
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button type="button" variant="outline" size="sm" onClick={() => addVideoElement('image')}>
                                Imagen
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => addVideoElement('video')}
                                disabled={videoElements.some((element) => element.type === 'video')}
                              >
                                Video
                              </Button>
                            </div>
                          </div>

                          <div className="mt-3 space-y-3">
                            {videoElements.length === 0 ? (
                              <div className="rounded-3xl border border-dashed border-secondary/20 bg-slate-950/60 px-4 py-5 text-sm text-slate-400">
                                Agrega elementos si quieres fijar personajes, props o voice binding.
                              </div>
                            ) : (
                              videoElements.map((element, index) => (
                                <div
                                  key={element.id}
                                  className="rounded-3xl border border-secondary/20 bg-slate-950/80 p-3"
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold text-white">Element{index + 1}</p>
                                      <p className="text-xs text-slate-400">
                                        {element.type === 'image' ? 'Image set' : 'Video reference'}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Select
                                        value={element.type}
                                        onValueChange={(value) =>
                                          setVideoElementType(element.id, value as KlingElementDraftType)
                                        }
                                      >
                                        <SelectTrigger className="h-9 w-28 border border-secondary/20 bg-slate-900/70 text-white">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="image">Imagen</SelectItem>
                                          <SelectItem
                                            value="video"
                                            disabled={
                                              element.type !== 'video' &&
                                              videoElements.some((item) => item.type === 'video')
                                            }
                                          >
                                            Video
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <Button type="button" variant="ghost" size="sm" onClick={() => removeVideoElement(element.id)}>
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>

                                  {element.type === 'image' ? (
                                    <div className="mt-3 space-y-3">
                                      <div>
                                        <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
                                          Imagen frontal
                                        </Label>
                                        {element.frontalImageUrl ? (
                                          <div className="mt-2 relative aspect-video overflow-hidden rounded-3xl border border-secondary/20">
                                            <Image
                                              src={element.frontalImageUrl}
                                              alt={`Element${index + 1} frontal`}
                                              fill
                                              className="object-cover"
                                              unoptimized
                                            />
                                            <Button
                                              type="button"
                                              size="icon"
                                              variant="secondary"
                                              className="absolute right-3 top-3 h-8 w-8"
                                              onClick={() => updateVideoElement(element.id, { frontalImageUrl: '' })}
                                            >
                                              <X className="h-4 w-4" />
                                            </Button>
                                          </div>
                                        ) : (
                                          <label className="depth-secondary mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-3xl border border-dashed border-secondary/25 bg-slate-950/80 px-4 py-6 text-sm text-slate-300">
                                            <ImagePlus className="h-4 w-4 text-secondary-tint" />
                                            Sube imagen frontal
                                            <input
                                              type="file"
                                              accept="image/*"
                                              className="hidden"
                                              onChange={(e) => void handleVideoElementImageChange(e, element.id, 'frontalImageUrl')}
                                            />
                                          </label>
                                        )}
                                      </div>

                                      <div>
                                        <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
                                          Referencias
                                        </Label>
                                        <label className="depth-secondary mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-3xl border border-dashed border-secondary/25 bg-slate-950/80 px-4 py-4 text-sm text-slate-300">
                                          <ImagePlus className="h-4 w-4 text-secondary-tint" />
                                          Agregar referencias
                                          <input
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            className="hidden"
                                            onChange={(e) => void handleVideoElementReferenceChange(e, element.id)}
                                          />
                                        </label>
                                        {element.referenceImageUrls.length > 0 ? (
                                          <div className="mt-2 grid grid-cols-3 gap-2">
                                            {element.referenceImageUrls.map((url, refIndex) => (
                                              <div
                                                key={`${element.id}-${refIndex}`}
                                                className="relative aspect-square overflow-hidden rounded-2xl border border-secondary/20"
                                              >
                                                <Image
                                                  src={url}
                                                  alt={`Element${index + 1} referencia ${refIndex + 1}`}
                                                  fill
                                                  className="object-cover"
                                                  unoptimized
                                                />
                                                <Button
                                                  type="button"
                                                  size="icon"
                                                  variant="secondary"
                                                  className="absolute right-1 top-1 h-7 w-7"
                                                  onClick={() =>
                                                    updateVideoElement(element.id, {
                                                      referenceImageUrls: element.referenceImageUrls.filter(
                                                        (_, currentIndex) => currentIndex !== refIndex
                                                      ),
                                                    })
                                                  }
                                                >
                                                  <X className="h-3.5 w-3.5" />
                                                </Button>
                                              </div>
                                            ))}
                                          </div>
                                        ) : null}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="mt-3 space-y-3">
                                      <div>
                                        <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
                                          Video del elemento
                                        </Label>
                                        {element.videoUrl ? (
                                          <div className="mt-2 relative overflow-hidden rounded-3xl border border-secondary/20 bg-slate-950/80 p-2">
                                            <video src={element.videoUrl} controls className="aspect-video w-full rounded-2xl object-contain" />
                                            <Button
                                              type="button"
                                              size="icon"
                                              variant="secondary"
                                              className="absolute right-3 top-3 h-8 w-8"
                                              onClick={() => updateVideoElement(element.id, { videoUrl: '' })}
                                            >
                                              <X className="h-4 w-4" />
                                            </Button>
                                          </div>
                                        ) : (
                                          <label className="depth-secondary mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-3xl border border-dashed border-secondary/25 bg-slate-950/80 px-4 py-6 text-sm text-slate-300">
                                            <Clapperboard className="h-4 w-4 text-secondary-tint" />
                                            Sube video de referencia
                                            <input
                                              type="file"
                                              accept="video/*"
                                              className="hidden"
                                              onChange={(e) => void handleVideoElementVideoChange(e, element.id)}
                                            />
                                          </label>
                                        )}
                                      </div>
                                      <div>
                                        <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
                                          Voice ID
                                        </Label>
                                        <Input
                                          className="mt-2 border-secondary/20 bg-slate-950/80 text-white"
                                          placeholder="voice_..."
                                          value={element.voiceId}
                                          onChange={(e) => updateVideoElement(element.id, { voiceId: e.target.value })}
                                          disabled={!videoGenerateAudio}
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      ) : null}

                      <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
                        <details className="group">
                          <summary className="flex cursor-pointer list-none items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
                                Modelos
                              </Label>
                              {supportsVideoAudio && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setVideoGenerateAudio((current) => !current)
                                  }}
                                  className={`rounded-full px-2 py-0.5 text-[0.6rem] font-semibold uppercase transition ${
                                    videoGenerateAudio
                                      ? 'bg-primary/20 text-primary-tint'
                                      : 'bg-slate-800 text-slate-400'
                                  }`}
                                >
                                  Audio {videoGenerateAudio ? 'ON' : 'OFF'}
                                </button>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="depth-secondary border border-secondary/25 bg-secondary/10 text-secondary-tint">
                                {Object.keys(VIDEO_MODEL_FAMILIES).length} familias
                              </Badge>
                              <ChevronRight className="h-4 w-4 text-slate-400 transition group-open:rotate-90" />
                            </div>
                          </summary>
                          <div className="mt-3 space-y-2">
                            {Object.entries(VIDEO_MODEL_FAMILIES).map(([familyId, family]) => (
                              <details key={familyId} className="group/family rounded-2xl border border-secondary/15 bg-slate-950/55">
                                <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                                      {family.name}
                                    </span>
                                    <span className="text-xs text-secondary-tint">{Object.keys(family.models).length}</span>
                                  </div>
                                  <ChevronRight className="h-3.5 w-3.5 text-slate-400 transition group-open/family:rotate-90" />
                                </summary>
                                <div className="space-y-2 p-2 pt-0">
                                  {Object.entries(family.models).map(([modelId, config]) => (
                                    <button
                                      key={modelId}
                                      type="button"
                                      onClick={() => setVideoModel(modelId)}
                                      className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                                        videoModel === modelId
                                          ? 'depth-primary border-primary/35 bg-primary/10 text-white'
                                          : 'depth-secondary border-secondary/15 bg-slate-950/70 text-slate-300'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between gap-3">
                                        <span className="block text-sm font-semibold">{config.name}</span>
                                        {getCostTierLabel(config.costTier) && (
                                          <span className="text-xs text-slate-400">
                                            {getCostTierLabel(config.costTier)}
                                          </span>
                                        )}
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              </details>
                            ))}
                          </div>
                        </details>
                      </div>

                      {supportsVideoDuration && !isUsingVideoMultiPrompt ? (
                        <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
                          <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
                             Duración
                          </Label>
                          <Select value={videoDuration} onValueChange={setVideoDuration}>
                            <SelectTrigger className="depth-secondary mt-3 border border-secondary/20 bg-slate-900/70 text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {videoDurationOptions.map((duration) => (
                                <SelectItem key={duration} value={duration}>
                                  {duration}s
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : null}

                      {supportsVideoCfg ? (
                        <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
                          <div className="flex items-center justify-between">
                            <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
                              CFG
                            </Label>
                            <span className="text-sm text-primary-tint">{videoCfgScale.toFixed(1)}</span>
                          </div>
                          <Slider
                            className="mt-4"
                            value={[videoCfgScale]}
                            onValueChange={([value]) => setVideoCfgScale(value)}
                            min={0}
                            max={1}
                            step={0.1}
                          />
                        </div>
                      ) : null}

                      {supportsVideoOptimizer ? (
                        <button
                          type="button"
                          onClick={() => setVideoPromptOptimizer((current) => !current)}
                          className={`depth-secondary rounded-3xl border border-secondary/20 px-4 py-3 text-left text-sm transition ${
                            videoPromptOptimizer ? 'bg-primary/10 text-white' : 'bg-slate-900/70 text-slate-300'
                          }`}
                        >
                          Optimizador de prompt: {videoPromptOptimizer ? 'ON' : 'OFF'}
                        </button>
                      ) : null}

                      {supportsVideoRatio ? (
                        <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
                          <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
                            Aspect Ratio
                          </Label>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            {videoAspectRatioOptions.map((ratioValue) => {
                              const ratio = getVideoRatioCard(ratioValue)
                              return (
                                <RatioCard
                                  key={ratioValue}
                                  active={videoAspectRatio === ratioValue}
                                  frameClass={ratio.frameClass}
                                  label={ratio.label}
                                  onClick={() => setVideoAspectRatio(ratioValue)}
                                />
                              )
                            })}
                          </div>
                        </div>
                      ) : null}

                      {supportsVideoResolution ? (
                        <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
                          <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
                            Resolution
                          </Label>
                          <div className="mt-3 grid grid-cols-3 gap-2">
                            {videoResolutionOptions.map((resolution) => (
                              <button
                                key={resolution}
                                type="button"
                                onClick={() => setVideoResolution(resolution)}
                                className={`rounded-2xl border px-3 py-2 text-sm transition ${
                                  videoResolution === resolution
                                    ? 'depth-primary border-primary/35 bg-primary/10 text-white'
                                    : 'border-secondary/15 bg-slate-950/70 text-slate-300'
                                }`}
                              >
                                {getResolutionLabel(resolution)}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {supportsVideoSeed ? (
                        <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
                          <div className="flex items-center justify-between">
                            <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
                              Seed
                            </Label>
                            <button
                              type="button"
                              className="text-xs font-semibold text-primary-tint"
                              onClick={() => setVideoSeed(String(Math.floor(Math.random() * 999999)))}
                            >
                              Aleatorio
                            </button>
                          </div>
                          <input
                            type="number"
                            inputMode="numeric"
                            value={videoSeed}
                            onChange={(e) => setVideoSeed(e.target.value)}
                            placeholder="Auto"
                            className="depth-mixed mt-3 flex h-11 w-full rounded-2xl border border-secondary/15 bg-slate-950/80 px-3 py-2 text-sm text-white"
                          />
                        </div>
                      ) : null}

                      {supportsVideoQuality ? (
                        <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
                          <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
                            Calidad
                          </Label>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            {['low', 'medium', 'high', 'maximum'].map((option) => (
                              <button
                                key={option}
                                type="button"
                                onClick={() => setVideoQuality(option)}
                                className={`rounded-2xl border px-3 py-2 text-sm capitalize transition ${
                                  videoQuality === option
                                    ? 'depth-primary border-primary/35 bg-primary/10 text-white'
                                    : 'border-secondary/15 bg-slate-950/70 text-slate-300'
                                }`}
                              >
                                {option}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {supportsVideoFrames ? (
                        <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
                          <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
                            Frames
                          </Label>
                          <input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={241}
                            value={videoNumFrames}
                            onChange={(e) => setVideoNumFrames(parseInt(e.target.value || '1', 10))}
                            className="depth-mixed mt-3 flex h-11 w-full rounded-2xl border border-secondary/15 bg-slate-950/80 px-3 py-2 text-sm text-white"
                          />
                        </div>
                      ) : null}

                      {supportsVideoFps ? (
                        <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
                          <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
                            FPS
                          </Label>
                          <input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={60}
                            value={videoFps}
                            onChange={(e) => setVideoFps(parseInt(e.target.value || '1', 10))}
                            className="depth-mixed mt-3 flex h-11 w-full rounded-2xl border border-secondary/15 bg-slate-950/80 px-3 py-2 text-sm text-white"
                          />
                        </div>
                      ) : null}

                      {supportsVideoStepsExtra ? (
                        <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
                          <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
                            Steps
                          </Label>
                          <input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={100}
                            value={videoSteps}
                            onChange={(e) => setVideoSteps(parseInt(e.target.value || '1', 10))}
                            className="depth-mixed mt-3 flex h-11 w-full rounded-2xl border border-secondary/15 bg-slate-950/80 px-3 py-2 text-sm text-white"
                          />
                        </div>
                      ) : null}

                      {supportsVideoAcceleration ? (
                        <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
                          <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
                            Aceleración
                          </Label>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            {['none', 'regular'].map((option) => (
                              <button
                                key={option}
                                type="button"
                                onClick={() => setVideoAcceleration(option)}
                                className={`rounded-2xl border px-3 py-2 text-sm capitalize transition ${
                                  videoAcceleration === option
                                    ? 'depth-primary border-primary/35 bg-primary/10 text-white'
                                    : 'border-secondary/15 bg-slate-950/70 text-slate-300'
                                }`}
                              >
                                {option}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {supportsVideoAutoFix ? (
                        <button
                          type="button"
                          onClick={() => setVideoAutoFix((current) => !current)}
                          className={`depth-secondary rounded-3xl border border-secondary/20 px-4 py-3 text-left text-sm transition ${
                            videoAutoFix ? 'bg-primary/10 text-white' : 'bg-slate-900/70 text-slate-300'
                          }`}
                        >
                          Auto-fix prompt: {videoAutoFix ? 'ON' : 'OFF'}
                        </button>
                      ) : null}

                      {supportsVideoDelete ? (
                        <button
                          type="button"
                          onClick={() => setVideoDeleteRemote((current) => !current)}
                          className={`depth-secondary rounded-3xl border border-secondary/20 px-4 py-3 text-left text-sm transition ${
                            videoDeleteRemote ? 'bg-primary/10 text-white' : 'bg-slate-900/70 text-slate-300'
                          }`}
                        >
                          Borrar archivo remoto: {videoDeleteRemote ? 'ON' : 'OFF'}
                        </button>
                      ) : null}

                        {supportsVideoPromptExpansion ? (
                          <button
                            type="button"
                            onClick={() => setVideoPromptExpansion((current) => !current)}
                            className={`depth-secondary rounded-3xl border border-secondary/20 px-4 py-3 text-left text-sm transition ${
                              videoPromptExpansion ? 'bg-primary/10 text-white' : 'bg-slate-900/70 text-slate-300'
                            }`}
                          >
                            Expansión de prompt: {videoPromptExpansion ? 'ON' : 'OFF'}
                          </button>
                        ) : null}
                        </>
                      )}
                    </>
                  )}
                </div>
              </ScrollArea>

              <div className="surface-primary border-t border-primary/20 p-4">
                <CostEstimatePreview
                  estimate={activeEstimate}
                  className="mb-3 border-primary/15 bg-slate-950/60"
                />
                <Button
                  onClick={studioMode === 'image' ? handleGenerateImage : handleGenerateVideo}
                  disabled={
                    loading ||
                    (studioMode === 'image'
                      ? !prompt.trim()
                      : isAuroraModel
                        ? !videoSource || !videoAudioUrl
                        : (requiresVideoSource && !videoSource) || !hasVideoPromptInput)
                  }
                  className="depth-primary h-12 w-full rounded-3xl border border-primary/30 bg-primary/90 text-primary-foreground hover:bg-primary"
                >
                  {studioMode === 'image' ? (
                    <Sparkles className="mr-2 h-4 w-4" />
                  ) : (
                    <Clapperboard className="mr-2 h-4 w-4" />
                  )}
                  {mainActionLabel}
                </Button>
              </div>
            </>
          )}
        </div>
      </aside>

      <section className="depth-mixed relative min-w-0 bg-slate-950/72">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-primary/0 via-primary/65 to-secondary/65" />
        
        {mainTab === 'gallery' ? <Gallery onSwitchTab={setMainTab} /> : <R2Manager onSwitchTab={setMainTab} />}
      </section>
    </div>
  )
}
