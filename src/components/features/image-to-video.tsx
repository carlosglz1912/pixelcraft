'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Loader2, Video, Upload, X, ChevronDown, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { enqueueVideoGeneration } from '@/lib/actions'
import { estimateVideoGenerationCost } from '@/lib/cost-estimate'
import { useGallery } from '@/stores/gallery'
import {
  VIDEO_MODEL_FAMILIES,
  getCostTierLabel,
  getVideoAspectRatios,
  getVideoDurations,
  getVideoEffectiveSupports,
  getVideoModes,
  getVideoModelConfig,
  getVideoResolutions,
  type VideoGenerationMode,
} from '@/types'
import { CostEstimatePreview } from '@/components/cost-estimate-preview'
import { ModelInfoTooltip } from '@/components/model-info-tooltip'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { KlingV3ComboElementInput, KlingV3MultiPromptElement } from '@/types/fal'

function getAspectRatioLabel(value: string): string {
  if (value === 'auto') return 'Auto'
  if (value === '16:9') return '16:9 (Landscape)'
  if (value === '9:16') return '9:16 (Portrait)'
  if (value === '1:1') return '1:1 (Square)'
  return value
}

function getResolutionLabel(value: string): string {
  if (value === 'auto') return 'Auto'
  if (value === '480p') return '480p (Fast)'
  if (value === '580p') return '580p (Balanced)'
  if (value === '720p') return '720p (Balanced)'
  if (value === '1080p') return '1080p (Quality)'
  if (value === '4k') return '4K (Ultra)'
  return value
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
  return {
    id: createDraftId(),
    prompt: '',
    duration,
  }
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

function getMultiPromptMaxDuration(model: string) {
  if (model.includes('kling-video/')) return 15
  return undefined
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function ImageToVideo() {
  const [imageUrl, setImageUrl] = useState('')
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState('kling-video/v3/pro/image-to-video')
  const [mode, setMode] = useState<VideoGenerationMode>('image-to-video')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [openFamily, setOpenFamily] = useState<string | null>(null)
  
  const [duration, setDurationState] = useState('5')
  const durationRef = useRef('5')
  const [negativePrompt, setNegativePrompt] = useState('')
  const [cfgScale, setCfgScale] = useState(0.5)
  const [endImageUrl, setEndImageUrl] = useState('')
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [generateAudio, setGenerateAudio] = useState(true)
  const [promptOptimizer, setPromptOptimizer] = useState(true)
  const [resolution, setResolution] = useState('720p')
  const [seed, setSeed] = useState('')
  const [autoFix, setAutoFix] = useState(true)
  const [deleteVideo, setDeleteVideo] = useState(true)
  const [videoQuality, setVideoQuality] = useState('medium')
  const [numFrames, setNumFrames] = useState(81)
  const [framesPerSecond, setFramesPerSecond] = useState(16)
  const [numInferenceSteps, setNumInferenceSteps] = useState(30)
  const [acceleration, setAcceleration] = useState('none')
  const [enablePromptExpansion, setEnablePromptExpansion] = useState(true)
  const [audioUrl, setAudioUrl] = useState('')
  const [guidanceScale, setGuidanceScale] = useState(1)
  const [audioGuidanceScale, setAudioGuidanceScale] = useState(2)
  const [useMultiPrompt, setUseMultiPrompt] = useState(false)
  const [multiPromptShots, setMultiPromptShots] = useState<KlingMultiPromptDraft[]>([createShotDraft()])
  const [elements, setElements] = useState<KlingElementDraft[]>([])
  
  const addPending = useGallery((s) => s.addPending)
  
  const modelConfig = getVideoModelConfig(model)
  const supports = getVideoEffectiveSupports(model, mode)
  const modeOptions = getVideoModes(model)
  const durationOptions = getVideoDurations(model)
  const aspectRatioOptions = getVideoAspectRatios(model, mode)
  const resolutionOptions = getVideoResolutions(model, mode)
  const requiresSourceImage = mode === 'image-to-video'
  const isUsingMultiPrompt = hasSupport('multi_prompt') && useMultiPrompt
  const totalMultiPromptDuration = isUsingMultiPrompt
    ? getTotalMultiPromptDuration(multiPromptShots)
    : 0
  const multiPromptMaxDuration = isUsingMultiPrompt ? getMultiPromptMaxDuration(model) : undefined
  const isMultiPromptDurationOverLimit = Boolean(
    multiPromptMaxDuration !== undefined && totalMultiPromptDuration > multiPromptMaxDuration
  )
  const hasVoiceControl = elements.some(
    (element) => element.type === 'video' && element.voiceId.trim().length > 0
  )
  const costEstimate = estimateVideoGenerationCost({
    model,
    mode,
    duration: hasSupport('duration')
      ? (isUsingMultiPrompt ? String(totalMultiPromptDuration) : duration)
      : undefined,
    resolution: hasSupport('resolution') ? resolution : undefined,
    aspectRatio: hasSupport('aspect_ratio') ? aspectRatio : undefined,
    generateAudio: hasSupport('audio') ? generateAudio : undefined,
    numFrames: hasSupport('num_frames') ? numFrames : undefined,
    hasVoiceControl: hasSupport('elements') ? hasVoiceControl : undefined,
  })
  
  function hasSupport(feature: string): boolean {
    return supports.includes(feature as never)
  }

  function setDuration(value: string) {
    durationRef.current = value
    setDurationState(value)
  }

  useEffect(() => {
    if (modeOptions.includes(mode)) return
    const nextMode = modeOptions[0]
    if (nextMode) setMode(nextMode)
  }, [mode, model, modeOptions])

  useEffect(() => {
    if (!hasSupport('duration')) return
    if (durationOptions.length === 0) return
    if (durationOptions.includes(duration)) return
    const nextDuration = durationOptions[0]
    if (!nextDuration) return
    durationRef.current = nextDuration
    setDurationState(nextDuration)
  }, [duration, model, mode, supports])

  useEffect(() => {
    if (!hasSupport('aspect_ratio')) return
    if (aspectRatioOptions.includes(aspectRatio)) return
    setAspectRatio(aspectRatioOptions[0] || '16:9')
  }, [aspectRatio, model, mode, supports])

  useEffect(() => {
    if (!hasSupport('resolution')) return
    if (resolutionOptions.includes(resolution)) return
    setResolution(resolutionOptions[0] || '720p')
  }, [model, mode, resolution, supports])

  useEffect(() => {
    if (hasSupport('multi_prompt')) return
    if (useMultiPrompt) setUseMultiPrompt(false)
  }, [mode, model, supports, useMultiPrompt])

  async function handleFileChange(
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (url: string) => void
  ) {
    const file = e.target.files?.[0]
    if (!file) return

    const dataUrl = await readFileAsDataUrl(file)
    setter(dataUrl)
    e.target.value = ''
  }

  async function handleMultiFileChange(
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (urls: string[]) => void
  ) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return

    const dataUrls = await Promise.all(files.map(readFileAsDataUrl))
    setter(dataUrls)
    e.target.value = ''
  }

  function updateShot(id: string, patch: Partial<Omit<KlingMultiPromptDraft, 'id'>>) {
    setMultiPromptShots((current) =>
      current.map((shot) => (shot.id === id ? { ...shot, ...patch } : shot))
    )
  }

  function removeShot(id: string) {
    setMultiPromptShots((current) => {
      if (current.length === 1) return [createShotDraft(durationRef.current)]
      return current.filter((shot) => shot.id !== id)
    })
  }

  function addShot() {
    const maxDuration = getMultiPromptMaxDuration(model)

    if (maxDuration !== undefined) {
      const remainingDuration = maxDuration - getTotalMultiPromptDuration(multiPromptShots)
      const nextDuration = [...durationOptions]
        .map((option) => Number.parseInt(option, 10))
        .filter((option) => Number.isFinite(option) && option <= remainingDuration)
        .sort((a, b) => b - a)[0]

      if (!nextDuration || remainingDuration < 3) {
        toast.error(`Kling permite máximo ${maxDuration}s en total para multi-shot`)
        return
      }

      setMultiPromptShots((current) => [...current, createShotDraft(String(nextDuration))])
      return
    }

    setMultiPromptShots((current) => [...current, createShotDraft(durationRef.current)])
  }

  function updateElement(id: string, patch: Partial<Omit<KlingElementDraft, 'id'>>) {
    setElements((current) =>
      current.map((element) => (element.id === id ? { ...element, ...patch } : element))
    )
  }

  function setElementType(id: string, type: KlingElementDraftType) {
    setElements((current) =>
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

  function addElement(type: KlingElementDraftType) {
    if (type === 'video' && elements.some((element) => element.type === 'video')) {
      toast.error('Kling permite solo un elemento basado en video por generación')
      return
    }

    setElements((current) => [...current, createElementDraft(type)])
  }

  function removeElement(id: string) {
    setElements((current) => current.filter((element) => element.id !== id))
  }

  function buildMultiPromptPayload(): KlingV3MultiPromptElement[] {
    return multiPromptShots.map((shot) => ({
      prompt: shot.prompt.trim(),
      duration: shot.duration as KlingV3MultiPromptElement['duration'],
    }))
  }

  function buildElementsPayload(): KlingV3ComboElementInput[] {
    return elements.map((element) => {
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

  function getAvailableShotDurations(shotDuration: string) {
    const currentDuration = Number.parseInt(shotDuration, 10) || 0

    return durationOptions.filter((option) => {
      const candidateDuration = Number.parseInt(option, 10)
      if (!Number.isFinite(candidateDuration)) return false
      if (multiPromptMaxDuration === undefined) return true

      const nextTotal = totalMultiPromptDuration - currentDuration + candidateDuration
      return nextTotal <= multiPromptMaxDuration || option === shotDuration
    })
  }

  async function handleGenerate() {
    const trimmedPrompt = prompt.trim()
    const multiPromptPayload = isUsingMultiPrompt ? buildMultiPromptPayload() : undefined
    const elementsPayload = hasSupport('elements') ? buildElementsPayload() : undefined

    if (model.includes('aurora')) {
      if (!imageUrl) {
        toast.error('Sube una foto del avatar')
        return
      }
      if (!audioUrl) {
        toast.error('Sube un archivo de audio')
        return
      }
    } else {
      if (requiresSourceImage && !imageUrl) {
        toast.error('Sube una imagen para este modelo')
        return
      }

      if (hasSupport('audio_url') && !audioUrl) {
        toast.error('Sube un archivo de audio para este modelo')
        return
      }

      if (isUsingMultiPrompt) {
        for (const [index, shot] of multiPromptShots.entries()) {
          if (!shot.prompt.trim()) {
            toast.error(`Completa el prompt del shot ${index + 1}`)
            return
          }
        }

        if (multiPromptMaxDuration !== undefined && totalMultiPromptDuration > multiPromptMaxDuration) {
          toast.error(`Kling permite máximo ${multiPromptMaxDuration}s en total para multi-shot`)
          return
        }
      } else if (!trimmedPrompt) {
        toast.error('Ingresa un prompt para el video')
        return
      }

      if (hasSupport('elements')) {
        let videoElementCount = 0

        for (const [index, element] of elements.entries()) {
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

        if (hasVoiceControl && !generateAudio) {
          toast.error('Activa audio nativo para usar voice ID en elementos de video')
          return
        }
      }
    }

    setLoading(true)
    setResult(null)

    try {
      const selectedDuration = hasSupport('duration')
        ? (isUsingMultiPrompt ? String(totalMultiPromptDuration) : durationRef.current)
        : undefined
      const galleryPrompt = isUsingMultiPrompt
        ? multiPromptShots
            .map((shot, index) => `Shot ${index + 1}: ${shot.prompt.trim()}`)
            .join(' | ')
        : trimmedPrompt

      const requestConfig = {
        prompt: trimmedPrompt,
        model,
        mode,
        imageUrl: requiresSourceImage ? imageUrl : undefined,
        duration: selectedDuration,
        negativePrompt: hasSupport('negative_prompt') ? (negativePrompt || undefined) : undefined,
        cfgScale: hasSupport('cfg_scale') ? cfgScale : undefined,
        endImageUrl: requiresSourceImage && hasSupport('end_image') ? (endImageUrl || undefined) : undefined,
        aspectRatio: hasSupport('aspect_ratio') ? aspectRatio : undefined,
        generateAudio: hasSupport('audio') ? generateAudio : undefined,
        promptOptimizer: hasSupport('prompt_optimizer') ? promptOptimizer : undefined,
        resolution: hasSupport('resolution') ? resolution : undefined,
        seed: hasSupport('seed') && seed ? parseInt(seed, 10) : undefined,
        autoFix: hasSupport('auto_fix') ? autoFix : undefined,
        deleteVideo: hasSupport('delete_video') ? deleteVideo : undefined,
        videoQuality: hasSupport('video_quality') ? videoQuality : undefined,
        numFrames: hasSupport('num_frames') ? numFrames : undefined,
        framesPerSecond: hasSupport('frames_per_second') ? framesPerSecond : undefined,
        numInferenceSteps: hasSupport('num_inference_steps') ? numInferenceSteps : undefined,
        acceleration: hasSupport('acceleration') ? acceleration : undefined,
        enablePromptExpansion: hasSupport('prompt_expansion') ? enablePromptExpansion : undefined,
        audioUrl: hasSupport('audio_url') ? audioUrl : undefined,
        guidanceScale: hasSupport('guidance_scale') ? guidanceScale : undefined,
        audioGuidanceScale: hasSupport('audio_guidance_scale') ? audioGuidanceScale : undefined,
        multiPrompt: isUsingMultiPrompt ? multiPromptPayload : undefined,
        shotType: isUsingMultiPrompt ? ('customize' as const) : undefined,
        elements: hasSupport('elements') ? elementsPayload : undefined,
      }
      const job = await enqueueVideoGeneration(requestConfig)

      addPending({
        type: 'video',
        prompt: galleryPrompt,
        model,
        costTier: modelConfig?.costTier,
        metadata: {
          requestId: job.requestId,
          videoMode: mode,
          estimatedCost: costEstimate?.amount,
          duration: selectedDuration,
          aspectRatio: hasSupport('aspect_ratio') ? aspectRatio : undefined,
          resolution: hasSupport('resolution') ? resolution : undefined,
          seed: hasSupport('seed') && seed ? parseInt(seed, 10) : undefined,
          videoQuality: hasSupport('video_quality') ? videoQuality : undefined,
          numFrames: hasSupport('num_frames') ? numFrames : undefined,
          framesPerSecond: hasSupport('frames_per_second') ? framesPerSecond : undefined,
          negativePrompt: hasSupport('negative_prompt') ? (negativePrompt || undefined) : undefined,
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

  function ImageUploader({ 
    value, 
    onChange, 
    label 
  }: { 
    value: string
    onChange: (url: string) => void
    label: string 
  }) {
    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <div className="relative">
          {value ? (
            <Card className="relative aspect-video overflow-hidden bg-muted/50">
              <Image
                src={value}
                alt={label}
                fill
                className="object-contain"
                unoptimized
              />
              <Button
                size="icon"
                variant="secondary"
                className="absolute right-2 top-2"
                onClick={() => onChange('')}
              >
                <X className="h-4 w-4" />
              </Button>
            </Card>
          ) : (
            <label className="flex aspect-video cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50 hover:border-muted-foreground/50">
              <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Sube una imagen
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileChange(e, onChange)}
              />
            </label>
          )}
        </div>
      </div>
    )
  }

  function VideoUploader({
    value,
    onChange,
    label,
  }: {
    value: string
    onChange: (url: string) => void
    label: string
  }) {
    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <div className="relative">
          {value ? (
            <Card className="relative aspect-video overflow-hidden bg-muted/50 p-3">
              <video src={value} controls className="h-full w-full rounded-md object-contain" />
              <Button
                size="icon"
                variant="secondary"
                className="absolute right-2 top-2"
                onClick={() => onChange('')}
              >
                <X className="h-4 w-4" />
              </Button>
            </Card>
          ) : (
            <label className="flex aspect-video cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50 hover:border-muted-foreground/50">
              <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Sube un video
              </span>
              <span className="mt-1 text-xs text-muted-foreground">
                720px+ y 24-60 FPS
              </span>
              <input
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => handleFileChange(e, onChange)}
              />
            </label>
          )}
        </div>
      </div>
    )
  }

  function ReferenceImagesUploader({
    value,
    onChange,
  }: {
    value: string[]
    onChange: (urls: string[]) => void
  }) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Referencias adicionales</Label>
          <span className="text-xs text-muted-foreground">
            {value.length}/3
          </span>
        </div>
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50 p-4 hover:border-muted-foreground/50">
          <Upload className="mb-2 h-6 w-6 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Sube 1-3 referencias
          </span>
          <span className="mt-1 text-xs text-muted-foreground">
            Diferentes ángulos ayudan a fijar identidad
          </span>
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={async (e) => {
              await handleMultiFileChange(e, (urls) => {
                const nextUrls = [...value, ...urls].slice(0, 3)
                if (value.length + urls.length > 3) {
                  toast.error('Kling acepta máximo 3 referencias por elemento')
                }
                onChange(nextUrls)
              })
            }}
          />
        </label>
        {value.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {value.map((url, index) => (
              <Card key={`${url.slice(0, 20)}-${index}`} className="relative aspect-square overflow-hidden bg-muted/50">
                <Image
                  src={url}
                  alt={`Referencia ${index + 1}`}
                  fill
                  className="object-cover"
                  unoptimized
                />
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute right-1 top-1 h-7 w-7"
                  onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    )
  }

  function ModelAccordion() {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label>Modelo</Label>
          <ModelInfoTooltip 
            info={modelConfig?.info} 
            costTier={modelConfig?.costTier} 
            modelName={modelConfig?.name || model}
          />
        </div>
        <div className="rounded-lg border">
          {Object.entries(VIDEO_MODEL_FAMILIES).map(([familyId, family]) => {
            const isOpen = openFamily === familyId
            const models = Object.entries(family.models)
            const isSelected = models.some(([m]) => m === model)
            
            return (
              <div key={familyId} className="border-b last:border-b-0">
                <button
                  type="button"
                  onClick={() => setOpenFamily(isOpen ? null : familyId)}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted/50 ${isSelected ? 'bg-muted/30' : ''}`}
                >
                  <span className="font-medium">{family.name}</span>
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
                {isOpen && (
                  <div className="border-t bg-muted/20">
                    {models.map(([modelId, config]) => (
                      <button
                        key={modelId}
                        type="button"
                        onClick={() => {
                          setModel(modelId)
                          setOpenFamily(null)
                        }}
                        className={`flex w-full items-center justify-between gap-3 px-6 py-2 text-sm hover:bg-muted/50 ${model === modelId ? 'bg-muted/50 font-medium' : ''}`}
                      >
                        <span>{config.name}</span>
                        {getCostTierLabel(config.costTier) && (
                          <span className="text-xs text-muted-foreground">
                            {getCostTierLabel(config.costTier)}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const hasPromptInput = isUsingMultiPrompt
    ? multiPromptShots.some((shot) => shot.prompt.trim().length > 0)
    : prompt.trim().length > 0

  return (
    <TooltipProvider>
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        {!model.includes('aurora') && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Label>{isUsingMultiPrompt ? 'Multi-shot' : 'Prompt del video'}</Label>
              {hasSupport('multi_prompt') && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="multi-prompt"
                    checked={useMultiPrompt}
                    onChange={(e) => setUseMultiPrompt(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="multi-prompt" className="cursor-pointer text-sm">
                    Multi-shot
                  </Label>
                </div>
              )}
            </div>

            {isUsingMultiPrompt ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Cada shot se manda en `multi_prompt` y el payload fija `shot_type=customize`.
                </p>
                {multiPromptShots.map((shot, index) => (
                  <Card key={shot.id} className="space-y-3 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">Shot {index + 1}</p>
                      <div className="flex items-center gap-2">
                        <div className="w-24">
                          <Select
                            value={shot.duration}
                            onValueChange={(value) => updateShot(shot.id, { duration: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {getAvailableShotDurations(shot.duration).map((option) => (
                                <SelectItem key={option} value={option}>
                                  {option}s
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeShot(shot.id)}
                        >
                          Quitar
                        </Button>
                      </div>
                    </div>
                    <Textarea
                      placeholder="Describe este shot..."
                      value={shot.prompt}
                      onChange={(e) => updateShot(shot.id, { prompt: e.target.value })}
                      rows={3}
                    />
                  </Card>
                ))}
                <div className="flex items-center justify-between gap-3">
                  <p
                    className={`text-xs ${
                      isMultiPromptDurationOverLimit ? 'text-destructive' : 'text-muted-foreground'
                    }`}
                  >
                    Duración estimada: {totalMultiPromptDuration}s
                    {multiPromptMaxDuration !== undefined ? ` / máximo ${multiPromptMaxDuration}s` : ''}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addShot}
                    disabled={
                      multiPromptMaxDuration !== undefined &&
                      totalMultiPromptDuration >= multiPromptMaxDuration
                    }
                  >
                    Agregar shot
                  </Button>
                </div>
              </div>
            ) : (
              <Textarea
                placeholder="Describe el movimiento que quieres..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
              />
            )}
          </div>
        )}

        {modeOptions.length > 1 && (
          <div className="space-y-2">
            <Label>Modo</Label>
            <div className="grid grid-cols-2 gap-2">
              {modeOptions.map((option) => (
                <Button
                  key={option}
                  type="button"
                  variant={mode === option ? 'default' : 'outline'}
                  onClick={() => setMode(option)}
                >
                  {option === 'text-to-video' ? 'Solo Prompt' : 'Con Imagen'}
                </Button>
              ))}
            </div>
          </div>
        )}

        {model.includes('aurora') ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 space-y-2">
              <h3 className="font-semibold text-sm text-blue-600 dark:text-blue-400">
                Aurora - Avatar Video Generator
              </h3>
              <p className="text-xs text-muted-foreground">
                Crea videos de alta fidelidad de tu avatar hablando o cantando. 
                Sube una foto del rostro + un archivo de audio.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <ImageUploader 
                value={imageUrl} 
                onChange={setImageUrl} 
                label="Foto del Avatar"
              />
              <div className="space-y-2">
                <Label>Audio (habla o canto)</Label>
                <div className="relative">
                  {audioUrl ? (
                    <Card className="relative p-4 bg-muted/50 aspect-video flex flex-col justify-center">
                      <audio src={audioUrl} controls className="w-full h-8" />
                      <Button
                        size="sm"
                        variant="secondary"
                        className="mt-2"
                        onClick={() => setAudioUrl('')}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Cambiar audio
                      </Button>
                    </Card>
                  ) : (
                    <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50 aspect-video hover:border-muted-foreground/50">
                      <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground text-center px-4">
                        Sube audio
                      </span>
                      <span className="text-xs text-muted-foreground mt-1">
                        WAV, MP3, M4A
                      </span>
                      <input
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        onChange={(e) => handleFileChange(e, setAudioUrl)}
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Estilo del video (opcional)</Label>
              <Textarea
                placeholder="Ej: 4K studio interview, medium close-up, soft lighting, professional backdrop..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                Describe el estilo visual. La sincronización labial es automática.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Resolución</Label>
                <Select value={resolution} onValueChange={setResolution}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="480p">480p (Rápido)</SelectItem>
                    <SelectItem value="720p">720p (Calidad)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Visual: {guidanceScale.toFixed(1)}</Label>
                <Slider
                  value={[guidanceScale]}
                  onValueChange={([v]) => setGuidanceScale(v)}
                  min={0}
                  max={5}
                  step={0.5}
                />
                <p className="text-xs text-muted-foreground">Estilo visual</p>
              </div>

              <div className="space-y-2">
                <Label>Lip-sync: {audioGuidanceScale.toFixed(1)}</Label>
                <Slider
                  value={[audioGuidanceScale]}
                  onValueChange={([v]) => setAudioGuidanceScale(v)}
                  min={0}
                  max={5}
                  step={0.5}
                />
                <p className="text-xs text-muted-foreground">Sincronización</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {requiresSourceImage && (
              <ImageUploader 
                value={imageUrl} 
                onChange={setImageUrl} 
                label="Imagen de origen"
              />
            )}

            {hasSupport('elements') && requiresSourceImage && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <Label>Elementos personalizados</Label>
                    <p className="text-xs text-muted-foreground">
                      Refiérelos en tu prompt como `@Element1`, `@Element2`, etc.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addElement('image')}
                    >
                      Imagen
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addElement('video')}
                      disabled={elements.some((element) => element.type === 'video')}
                    >
                      Video
                    </Button>
                  </div>
                </div>

                {elements.length === 0 ? (
                  <Card className="border-dashed p-4 text-sm text-muted-foreground">
                    Agrega elementos si necesitas fijar personajes, props o un voice binding sobre un video de referencia.
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {elements.map((element, index) => (
                      <Card key={element.id} className="space-y-4 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">Element{index + 1}</p>
                            <p className="text-xs text-muted-foreground">
                              {element.type === 'image' ? 'Image set' : 'Video reference'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-32">
                              <Select
                                value={element.type}
                                onValueChange={(value) =>
                                  setElementType(element.id, value as KlingElementDraftType)
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="image">Imagen</SelectItem>
                                  <SelectItem
                                    value="video"
                                    disabled={
                                      element.type !== 'video' &&
                                      elements.some((item) => item.type === 'video')
                                    }
                                  >
                                    Video
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeElement(element.id)}
                            >
                              Quitar
                            </Button>
                          </div>
                        </div>

                        {element.type === 'image' ? (
                          <div className="grid gap-4 md:grid-cols-2">
                            <ImageUploader
                              value={element.frontalImageUrl}
                              onChange={(url) => updateElement(element.id, { frontalImageUrl: url })}
                              label="Imagen frontal"
                            />
                            <ReferenceImagesUploader
                              value={element.referenceImageUrls}
                              onChange={(urls) => updateElement(element.id, { referenceImageUrls: urls })}
                            />
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <VideoUploader
                              value={element.videoUrl}
                              onChange={(url) => updateElement(element.id, { videoUrl: url })}
                              label="Video del elemento"
                            />
                            <div className="space-y-2">
                              <Label>Voice ID (opcional)</Label>
                              <Input
                                value={element.voiceId}
                                onChange={(e) => updateElement(element.id, { voiceId: e.target.value })}
                                placeholder="voice_..."
                                disabled={!generateAudio}
                              />
                              <p className="text-xs text-muted-foreground">
                                Sólo aplica a elementos de video y requiere audio nativo activado.
                              </p>
                            </div>
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {hasSupport('audio_url') && (
              <div className="space-y-2">
                <Label>Audio para el avatar</Label>
                <div className="relative">
                  {audioUrl ? (
                    <Card className="relative p-4 bg-muted/50">
                      <div className="flex items-center gap-3">
                        <audio src={audioUrl} controls className="flex-1 h-8" />
                        <Button
                          size="icon"
                          variant="secondary"
                          onClick={() => setAudioUrl('')}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </Card>
                  ) : (
                    <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50 p-6 hover:border-muted-foreground/50">
                      <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        Sube un archivo de audio
                      </span>
                      <span className="text-xs text-muted-foreground mt-1">
                        MP3, WAV, M4A, OGG, AAC
                      </span>
                      <input
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        onChange={(e) => handleFileChange(e, setAudioUrl)}
                      />
                    </label>
                  )}
                </div>
              </div>
            )}

            {hasSupport('guidance_scale') && (
              <div className="space-y-2">
                <Label>Guidance Scale: {guidanceScale.toFixed(1)}</Label>
                <Slider
                  value={[guidanceScale]}
                  onValueChange={([v]) => setGuidanceScale(v)}
                  min={0}
                  max={5}
                  step={0.5}
                />
                <p className="text-xs text-muted-foreground">
                  Adherencia al prompt visual (0 = libre, 5 = estricto)
                </p>
              </div>
            )}

            {hasSupport('audio_guidance_scale') && (
              <div className="space-y-2">
                <Label>Audio Guidance: {audioGuidanceScale.toFixed(1)}</Label>
                <Slider
                  value={[audioGuidanceScale]}
                  onValueChange={([v]) => setAudioGuidanceScale(v)}
                  min={0}
                  max={5}
                  step={0.5}
                />
                <p className="text-xs text-muted-foreground">
                  Sincronización con audio (0 = libre, 5 = estricto)
                </p>
              </div>
            )}
          </>
        )}

        {!model.includes('aurora') && (
          <>
            <ModelAccordion />

            <div className="flex flex-wrap gap-4">
          {hasSupport('duration') && !isUsingMultiPrompt && (
            <div className="space-y-2">
              <Label>Duración</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {durationOptions.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}s
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {hasSupport('aspect_ratio') && (
            <div className="min-w-32 space-y-2">
              <Label>Aspect Ratio</Label>
              <Select value={aspectRatio} onValueChange={setAspectRatio}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {aspectRatioOptions.map((ar) => (
                    <SelectItem key={ar} value={ar}>
                      {getAspectRatioLabel(ar)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {hasSupport('resolution') && (
            <div className="min-w-32 space-y-2">
              <Label>Resolución</Label>
              <Select value={resolution} onValueChange={setResolution}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {resolutionOptions.map((r) => (
                    <SelectItem key={r} value={r}>
                      {getResolutionLabel(r)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {hasSupport('negative_prompt') && (
          <div className="space-y-2">
            <Label>Prompt negativo</Label>
            <Textarea
              placeholder="Qué evitar en el video..."
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              rows={2}
            />
          </div>
        )}

        {hasSupport('cfg_scale') && (
          <div className="space-y-2">
            <Label>CFG Scale: {cfgScale.toFixed(1)}</Label>
            <Slider
              value={[cfgScale]}
              onValueChange={([v]) => setCfgScale(v)}
              min={0}
              max={1}
              step={0.1}
            />
            <p className="text-xs text-muted-foreground">
              Qué tanto seguir el prompt (0 = libre, 1 = estricto)
            </p>
          </div>
        )}

        {hasSupport('prompt_optimizer') && (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="optimizer"
              checked={promptOptimizer}
              onChange={(e) => setPromptOptimizer(e.target.checked)}
              className="h-4 w-4"
            />
            <Label htmlFor="optimizer" className="cursor-pointer">
              Optimizar prompt
            </Label>
          </div>
        )}

        {hasSupport('seed') && (
          <div className="space-y-2">
            <Label>Seed (opcional)</Label>
            <input
              type="number"
              inputMode="numeric"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              placeholder="Auto"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        )}

        {hasSupport('video_quality') && (
          <div className="space-y-2">
            <Label>Calidad</Label>
            <Select value={videoQuality} onValueChange={setVideoQuality}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="maximum">Maximum</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {hasSupport('num_frames') && (
          <div className="space-y-2">
            <Label>Frames</Label>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={241}
              value={numFrames}
              onChange={(e) => setNumFrames(parseInt(e.target.value || '1', 10))}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        )}

        {hasSupport('frames_per_second') && (
          <div className="space-y-2">
            <Label>FPS</Label>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={60}
              value={framesPerSecond}
              onChange={(e) => setFramesPerSecond(parseInt(e.target.value || '1', 10))}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        )}

        {hasSupport('num_inference_steps') && (
          <div className="space-y-2">
            <Label>Inference Steps</Label>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={100}
              value={numInferenceSteps}
              onChange={(e) => setNumInferenceSteps(parseInt(e.target.value || '1', 10))}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        )}

        {hasSupport('acceleration') && (
          <div className="space-y-2">
            <Label>Aceleración</Label>
            <Select value={acceleration} onValueChange={setAcceleration}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="regular">Regular</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {hasSupport('auto_fix') && (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="auto-fix"
              checked={autoFix}
              onChange={(e) => setAutoFix(e.target.checked)}
              className="h-4 w-4"
            />
            <Label htmlFor="auto-fix" className="cursor-pointer">
              Auto-fix prompt
            </Label>
          </div>
        )}

        {hasSupport('delete_video') && (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="delete-video"
              checked={deleteVideo}
              onChange={(e) => setDeleteVideo(e.target.checked)}
              className="h-4 w-4"
            />
            <Label htmlFor="delete-video" className="cursor-pointer">
              Eliminar video remoto al terminar
            </Label>
          </div>
        )}

        {hasSupport('prompt_expansion') && (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="prompt-expansion"
              checked={enablePromptExpansion}
              onChange={(e) => setEnablePromptExpansion(e.target.checked)}
              className="h-4 w-4"
            />
            <Label htmlFor="prompt-expansion" className="cursor-pointer">
              Expandir prompt
            </Label>
          </div>
        )}

        {hasSupport('audio') && (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="audio"
              checked={generateAudio}
              onChange={(e) => setGenerateAudio(e.target.checked)}
              className="h-4 w-4"
            />
            <Label htmlFor="audio" className="cursor-pointer">
              Generar audio
            </Label>
          </div>
        )}

        {requiresSourceImage && hasSupport('end_image') && (
          <ImageUploader 
            value={endImageUrl} 
            onChange={setEndImageUrl} 
            label="Imagen final (opcional)" 
          />
        )}
          </>
        )}

        <CostEstimatePreview estimate={costEstimate} />

        <Button
          onClick={handleGenerate}
          disabled={
            loading ||
            (model.includes('aurora')
              ? (!imageUrl || !audioUrl)
              : ((requiresSourceImage && !imageUrl) || (hasSupport('audio_url') && !audioUrl) || !hasPromptInput))
          }
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {model.includes('aurora') ? 'Generando avatar...' : 'Generando video...'}
            </>
          ) : (
            <>
              <Video className="mr-2 h-4 w-4" />
              {model.includes('aurora') ? 'Generar Avatar Video' : 'Generar Video'}
            </>
          )}
        </Button>
      </div>

      <div className="flex items-center justify-center">
        <Card className="aspect-video w-full max-w-md overflow-hidden bg-muted/50">
          {loading ? (
            <div className="relative h-full w-full">
              <Skeleton className="h-full w-full rounded-none" />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/45">
                <Loader2 className="h-8 w-8 animate-spin text-foreground" />
                <p className="text-sm font-medium text-foreground">Generando video...</p>
              </div>
            </div>
          ) : result ? (
            <video
              src={result}
              controls
              autoPlay
              loop
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <Video className="h-12 w-12 opacity-50" />
            </div>
          )}
        </Card>
      </div>
    </div>
    </TooltipProvider>
  )
}
