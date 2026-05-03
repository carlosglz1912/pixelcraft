'use client'

import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { toast } from 'sonner'
import { enqueueVideoGeneration } from '@/lib/actions'
import { optimizeImageIfLarge } from '@/lib/image-optimize'
import {
  estimateVideoGenerationCost,
} from '@/lib/cost-estimate'
import {
  getCostTierLabel,
  getVideoAspectRatios,
  getVideoDurations,
  getVideoEffectiveSupports,
  getVideoModes,
  getVideoModelConfig,
  getVideoResolutions,
  type VideoGenerationMode,
} from '@/types'
import type { KlingV3ComboElementInput, KlingV3MultiPromptElement } from '@/types/fal'
import type {
  KlingElementDraftType,
  KlingMultiPromptDraft,
  KlingElementDraft,
} from '@/lib/studio-types'
import { fileToDataUrl } from '@/lib/studio-helpers'
import type { GeneratedMediaBase, PendingMedia } from '@/types'

// --- Draft helpers (local to this hook) ---

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

// --- Hook interface ---

export interface UseVideoStudioParams {
  addToGallery: (item: GeneratedMediaBase) => void
  addPending: (item: Omit<PendingMedia, 'id' | 'createdAt'>) => void
  removePending: (id: string) => void
  setLoading: (loading: boolean) => void
  openPicker: (setter: (url: string) => void, mediaType: 'image' | 'video') => void
}

export function useVideoStudio({
  addToGallery,
  addPending,
  removePending,
  setLoading,
  openPicker,
}: UseVideoStudioParams) {
  // --- State ---
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

  // Duration wrapper: keeps ref in sync
  function setVideoDuration(value: string) {
    videoDurationRef.current = value
    setVideoDurationState(value)
  }

  // --- Derived support flags ---
  const videoSupports = getVideoEffectiveSupports(videoModel, videoMode)

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

  const hasVideoPromptInput = isUsingVideoMultiPrompt
    ? videoMultiPromptShots.some((shot) => shot.prompt.trim().length > 0)
    : videoPrompt.trim().length > 0

  // --- Sync effects on model change ---

  useEffect(() => {
    if (videoModeOptions.includes(videoMode)) return
    const nextMode = videoModeOptions[0]
    if (nextMode) setVideoMode(nextMode)
  }, [videoMode, videoModeOptions])

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

  // --- File change handlers ---

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

  // --- Multi-prompt CRUD ---

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

  // --- Element CRUD ---

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

  // --- Payload builders ---

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

  // --- Generate handler ---

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

  // --- Picker helper ---

  function openVideoSourcePicker() {
    openPicker(setVideoSource, 'image')
  }

  return {
    // State
    videoSource,
    videoPrompt,
    videoNegativePrompt,
    videoModel,
    videoMode,
    videoDuration,
    videoAspectRatio,
    videoResolution,
    videoGenerateAudio,
    videoCfgScale,
    videoPromptOptimizer,
    videoSeed,
    videoAutoFix,
    videoDeleteRemote,
    videoQuality,
    videoNumFrames,
    videoFps,
    videoSteps,
    videoAcceleration,
    videoPromptExpansion,
    videoAudioUrl,
    videoGuidanceScale,
    videoAudioGuidanceScale,
    videoUseMultiPrompt,
    videoMultiPromptShots,
    videoElements,
    // Setters
    setVideoSource,
    setVideoPrompt,
    setVideoNegativePrompt,
    setVideoModel,
    setVideoMode,
    setVideoDuration,
    setVideoAspectRatio,
    setVideoResolution,
    setVideoGenerateAudio,
    setVideoCfgScale,
    setVideoPromptOptimizer,
    setVideoSeed,
    setVideoAutoFix,
    setVideoDeleteRemote,
    setVideoQuality,
    setVideoNumFrames,
    setVideoFps,
    setVideoSteps,
    setVideoAcceleration,
    setVideoPromptExpansion,
    setVideoAudioUrl,
    setVideoGuidanceScale,
    setVideoAudioGuidanceScale,
    setVideoUseMultiPrompt,
    setVideoMultiPromptShots,
    setVideoElements,
    // Derived flags
    videoSupports,
    supportsVideoDuration,
    supportsVideoRatio,
    supportsVideoResolution,
    supportsVideoAudio,
    supportsVideoNegative,
    supportsVideoCfg,
    supportsVideoOptimizer,
    supportsVideoSeed,
    supportsVideoAutoFix,
    supportsVideoDelete,
    supportsVideoQuality,
    supportsVideoFrames,
    supportsVideoFps,
    supportsVideoStepsExtra,
    supportsVideoAcceleration,
    supportsVideoPromptExpansion,
    supportsVideoAudioUrl,
    supportsVideoGuidanceScale,
    supportsVideoAudioGuidanceScale,
    supportsVideoMultiPrompt,
    supportsVideoElements,
    isAuroraModel,
    videoModeOptions,
    videoDurationOptions,
    videoAspectRatioOptions,
    videoResolutionOptions,
    requiresVideoSource,
    isUsingVideoMultiPrompt,
    videoMultiPromptDuration,
    hasVideoVoiceControl,
    videoEstimate,
    hasVideoPromptInput,
    // Handlers
    handleVideoFileChange,
    handleVideoAudioFileChange,
    handleVideoElementImageChange,
    handleVideoElementReferenceChange,
    handleVideoElementVideoChange,
    updateVideoShot,
    removeVideoShot,
    addVideoShot,
    updateVideoElement,
    setVideoElementType,
    addVideoElement,
    removeVideoElement,
    buildVideoMultiPromptPayload,
    buildVideoElementsPayload,
    handleGenerateVideo,
    openVideoSourcePicker,
  }
}
