'use server'

import { fal } from '@fal-ai/client'
import { getVideoEndpoint, type VideoGenerationMode } from '@/types'
import type { 
  FalImageOutput, 
  FalVideoOutput,
  FalImageEditOutput,
  KlingV3ComboElementInput,
  KlingV3MultiPromptElement,
} from '@/types/fal'

fal.config({
  credentials: process.env.FAL_KEY!,
})

const LEGACY_MODEL_ALIASES: Record<string, string> = {
  'topaz/upscale/image': 'fal-ai/topaz/upscale/image',
  'seedvr/upscale/image/seamless': 'fal-ai/seedvr/upscale/image/seamless',
  'bria/background/remove': 'fal-ai/bria/background/remove',
  'fal-ai/pixelcut/background-removal': 'pixelcut/background-removal',
}

function normalizeFalModelId(model: string) {
  return LEGACY_MODEL_ALIASES[model] ?? model
}

function normalizeImageInferenceSteps(model: string, steps?: number) {
  if (steps === undefined) return undefined

  if (model === 'fal-ai/flux/schnell') {
    return Math.min(Math.max(steps, 1), 4)
  }

  return steps
}

function isDataUrl(value: string) {
  return value.startsWith('data:')
}

function getExtensionFromMimeType(contentType: string) {
  const [, subtype = 'bin'] = contentType.split('/')
  return subtype.split(/[+;]/)[0] || 'bin'
}

async function uploadDataUrlToFalStorage(dataUrl: string, filenameBase: string) {
  const response = await fetch(dataUrl)

  if (!response.ok) {
    throw new Error(`Failed to read local media input (${response.status})`)
  }

  const blob = await response.blob()
  const contentType = blob.type || 'application/octet-stream'
  const extension = getExtensionFromMimeType(contentType)
  const file = new File([blob], `${filenameBase}.${extension}`, {
    type: contentType,
  })

  return fal.storage.upload(file)
}

type VideoGenerationConfig = {
  prompt: string
  model: string
  mode?: VideoGenerationMode
  imageUrl?: string
  duration?: string
  negativePrompt?: string
  cfgScale?: number
  endImageUrl?: string
  aspectRatio?: string
  generateAudio?: boolean
  promptOptimizer?: boolean
  resolution?: string
  seed?: number
  autoFix?: boolean
  deleteVideo?: boolean
  videoQuality?: string
  numFrames?: number
  framesPerSecond?: number
  numInferenceSteps?: number
  acceleration?: string
  enablePromptExpansion?: boolean
  audioUrl?: string
  guidanceScale?: number
  audioGuidanceScale?: number
  multiPrompt?: KlingV3MultiPromptElement[]
  shotType?: 'customize'
  elements?: KlingV3ComboElementInput[]
}

function resolveVideoModel(config: Pick<VideoGenerationConfig, 'model' | 'mode'>) {
  const requestedModel = (config.model || 'fal-ai/kling-video/v3/pro/image-to-video').replace(/^fal-ai\//, '')
  const mode = config.mode || 'image-to-video'
  const resolvedModel = getVideoEndpoint(requestedModel, mode)

  if (!resolvedModel) {
    throw new Error(`Unsupported video model: ${requestedModel}`)
  }

  return {
    requestedModel,
    mode,
    resolvedModel,
    endpoint: `fal-ai/${resolvedModel}`,
  }
}

function buildVideoInput(config: VideoGenerationConfig, endpoint: string) {
  if ((config.mode || 'image-to-video') === 'image-to-video' && !config.imageUrl) {
    throw new Error(`Model requires an image source: ${config.model}`)
  }

  const input: Record<string, unknown> = {}
  const prompt = config.prompt.trim()
  const multiPrompt = config.multiPrompt
    ?.map((shot) => ({
      prompt: shot.prompt.trim(),
      duration: shot.duration,
    }))
    .filter((shot) => shot.prompt.length > 0)
  const usesMultiPrompt = Boolean(multiPrompt?.length)
  const elements = config.elements?.flatMap<KlingV3ComboElementInput>((element) => {
      const frontalImageUrl = element.frontal_image_url?.trim()
      const referenceImageUrls = element.reference_image_urls
        ?.map((url) => url.trim())
        .filter(Boolean)
      const videoUrl = element.video_url?.trim()
      const voiceId = element.voice_id?.trim()

      if (videoUrl) {
        return [{
          video_url: videoUrl,
          ...(voiceId ? { voice_id: voiceId } : {}),
        }]
      }

      if (!frontalImageUrl || !referenceImageUrls?.length) {
        return []
      }

      return [{
        frontal_image_url: frontalImageUrl,
        reference_image_urls: referenceImageUrls,
      }]
    })

  if (multiPrompt?.length) {
    input.multi_prompt = multiPrompt
    input.shot_type = config.shotType ?? 'customize'
  } else if (prompt) {
    input.prompt = prompt
  }

  if (endpoint === 'fal-ai/kling-video/v3/pro/image-to-video') {
    if (config.imageUrl) input.start_image_url = config.imageUrl
    if (!usesMultiPrompt && config.duration) input.duration = config.duration
    if (config.generateAudio !== undefined) input.generate_audio = config.generateAudio
    if (config.endImageUrl) input.end_image_url = config.endImageUrl
    if (config.negativePrompt) input.negative_prompt = config.negativePrompt
    if (config.cfgScale !== undefined) input.cfg_scale = config.cfgScale
    if (elements?.length) input.elements = elements
  } else if (endpoint === 'fal-ai/kling-video/v3/pro/text-to-video') {
    if (!usesMultiPrompt && config.duration) input.duration = config.duration
    if (config.aspectRatio) input.aspect_ratio = config.aspectRatio
    if (config.generateAudio !== undefined) input.generate_audio = config.generateAudio
    if (config.negativePrompt) input.negative_prompt = config.negativePrompt
    if (config.cfgScale !== undefined) input.cfg_scale = config.cfgScale
  } else if (endpoint === 'fal-ai/kling-video/o3/standard/image-to-video') {
    if (config.imageUrl) input.image_url = config.imageUrl
    if (!usesMultiPrompt && config.duration) input.duration = config.duration
    if (config.generateAudio !== undefined) input.generate_audio = config.generateAudio
    if (config.endImageUrl) input.end_image_url = config.endImageUrl
  } else if (endpoint === 'fal-ai/kling-video/o3/standard/text-to-video') {
    if (!usesMultiPrompt && config.duration) input.duration = config.duration
    if (config.aspectRatio) input.aspect_ratio = config.aspectRatio
    if (config.generateAudio !== undefined) input.generate_audio = config.generateAudio
  } else if (endpoint.includes('hailuo') || endpoint.includes('minimax')) {
    if (prompt) input.prompt = prompt
    if (config.imageUrl) input.image_url = config.imageUrl
    if (config.promptOptimizer !== undefined) input.prompt_optimizer = config.promptOptimizer
  } else if (endpoint.includes('seedance')) {
    if (prompt) input.prompt = prompt
    if (config.imageUrl) input.image_url = config.imageUrl
    if (config.duration) input.duration = config.duration
    if (config.aspectRatio) input.aspect_ratio = config.aspectRatio
    if (config.resolution) input.resolution = config.resolution
    if (config.generateAudio !== undefined) input.generate_audio = config.generateAudio
    if (config.endImageUrl) input.end_image_url = config.endImageUrl
  } else if (endpoint.includes('veo3.1')) {
    if (prompt) input.prompt = prompt
    if (config.imageUrl) input.image_url = config.imageUrl
    if (config.duration) input.duration = `${config.duration}s`
    if (config.aspectRatio) input.aspect_ratio = config.aspectRatio
    if (config.resolution) input.resolution = config.resolution
    if (config.negativePrompt) input.negative_prompt = config.negativePrompt
    if (config.generateAudio !== undefined) input.generate_audio = config.generateAudio
    if (config.seed !== undefined) input.seed = config.seed
    if (config.autoFix !== undefined) input.auto_fix = config.autoFix
  } else if (endpoint.includes('sora-2')) {
    if (prompt) input.prompt = prompt
    if (config.imageUrl) input.image_url = config.imageUrl
    if (config.duration) input.duration = parseInt(config.duration, 10)
    if (config.aspectRatio) input.aspect_ratio = config.aspectRatio
    if (config.resolution) input.resolution = config.resolution
    if (config.deleteVideo !== undefined) input.delete_video = config.deleteVideo
  } else if (endpoint.includes('wan')) {
    if (prompt) input.prompt = prompt
    if (config.imageUrl) input.image_url = config.imageUrl
    if (config.aspectRatio) input.aspect_ratio = config.aspectRatio
    if (config.resolution) input.resolution = config.resolution
    if (config.negativePrompt) input.negative_prompt = config.negativePrompt
    if (config.seed !== undefined) input.seed = config.seed
    if (config.videoQuality) input.video_quality = config.videoQuality
    if (config.numFrames !== undefined) input.num_frames = config.numFrames
    if (config.framesPerSecond !== undefined) input.frames_per_second = config.framesPerSecond
    if (config.numInferenceSteps !== undefined) input.num_inference_steps = config.numInferenceSteps
    if (config.acceleration) input.acceleration = config.acceleration
    if (config.enablePromptExpansion !== undefined) {
        input.enable_prompt_expansion = config.enablePromptExpansion
    }
  } else if (endpoint.includes('creatify/aurora')) {
    if (config.imageUrl) input.image_url = config.imageUrl
    if (config.audioUrl) input.audio_url = config.audioUrl
    if (prompt) input.prompt = prompt
    if (config.resolution) input.resolution = config.resolution
    if (config.guidanceScale !== undefined) input.guidance_scale = config.guidanceScale
    if (config.audioGuidanceScale !== undefined) input.audio_guidance_scale = config.audioGuidanceScale
    console.info('[aurora.buildInput]', {
      hasImage: !!config.imageUrl,
      hasAudio: !!config.audioUrl,
      hasPrompt: !!config.prompt?.trim(),
      promptLength: config.prompt?.length ?? 0,
      resolution: config.resolution,
      guidanceScale: config.guidanceScale,
      audioGuidanceScale: config.audioGuidanceScale,
      inputKeys: Object.keys(input),
    })
  } else if (config.imageUrl) {
    if (prompt) input.prompt = prompt
    input.image_url = config.imageUrl
  }

  return input
}

async function normalizeVideoConfigAssets(config: VideoGenerationConfig): Promise<VideoGenerationConfig> {
  const [
    imageUrl,
    endImageUrl,
    audioUrl,
  ] = await Promise.all([
    config.imageUrl && isDataUrl(config.imageUrl)
      ? uploadDataUrlToFalStorage(config.imageUrl, 'video-start-image')
      : config.imageUrl,
    config.endImageUrl && isDataUrl(config.endImageUrl)
      ? uploadDataUrlToFalStorage(config.endImageUrl, 'video-end-image')
      : config.endImageUrl,
    config.audioUrl && isDataUrl(config.audioUrl)
      ? uploadDataUrlToFalStorage(config.audioUrl, 'video-audio')
      : config.audioUrl,
  ])

  const elements = config.elements
    ? await Promise.all(
        config.elements.map(async (element, index) => {
          if (element.video_url?.trim()) {
            const videoUrl = element.video_url.trim()

            return {
              ...element,
              video_url: isDataUrl(videoUrl)
                ? await uploadDataUrlToFalStorage(videoUrl, `video-element-${index + 1}`)
                : videoUrl,
            }
          }

          const frontalImageUrl = element.frontal_image_url?.trim()
          const referenceImageUrls = element.reference_image_urls?.map((url) => url.trim()) ?? []

          return {
            ...element,
            frontal_image_url: frontalImageUrl
              ? (
                  isDataUrl(frontalImageUrl)
                    ? await uploadDataUrlToFalStorage(frontalImageUrl, `element-${index + 1}-front`)
                    : frontalImageUrl
                )
              : frontalImageUrl,
            reference_image_urls: await Promise.all(
              referenceImageUrls.map((url, referenceIndex) =>
                isDataUrl(url)
                  ? uploadDataUrlToFalStorage(url, `element-${index + 1}-reference-${referenceIndex + 1}`)
                  : url
              )
            ),
          }
        })
      )
    : undefined

  return {
    ...config,
    imageUrl,
    endImageUrl,
    audioUrl,
    elements,
  }
}

function summarizeInputValue(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') {
    return value.length > 100
      ? `${value.substring(0, 50)}... (${value.length} chars, ${Math.round(value.length / 1024)}KB)`
      : value
  }

  if (depth >= 2) return '[Object]'

  if (Array.isArray(value)) {
    return value.map((item) => summarizeInputValue(item, depth + 1))
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, summarizeInputValue(nestedValue, depth + 1)])
    )
  }

  return value
}

function logVideoRequest(details: {
  endpoint: string
  requestedModel: string
  resolvedModel: string
  mode: VideoGenerationMode
  input: Record<string, unknown>
}) {
  const inputSummary = Object.fromEntries(
    Object.entries(details.input).map(([key, value]) => [key, summarizeInputValue(value)])
  )
  const multiPromptSummary = Array.isArray(details.input.multi_prompt)
    ? details.input.multi_prompt.map((shot) => {
        if (!shot || typeof shot !== 'object') return shot
        const shotPrompt = 'prompt' in shot && typeof shot.prompt === 'string'
          ? shot.prompt
          : ''

        return {
          duration: 'duration' in shot ? shot.duration : undefined,
          promptPreview: shotPrompt ? summarizeInputValue(shotPrompt) : undefined,
        }
      })
    : undefined
  const elementKinds = Array.isArray(details.input.elements)
    ? details.input.elements.map((element) => {
        if (!element || typeof element !== 'object') return 'unknown'
        if ('video_url' in element) return 'video'
        if ('frontal_image_url' in element) return 'image-set'
        return 'unknown'
      })
    : undefined
  
  console.info('[video.enqueue]', {
    endpoint: details.endpoint,
    requestedModel: details.requestedModel,
    resolvedModel: details.resolvedModel,
    mode: details.mode,
    duration: details.input.duration ?? null,
    aspectRatio: details.input.aspect_ratio ?? null,
    resolution: details.input.resolution ?? null,
    generateAudio: details.input.generate_audio ?? null,
    hasSourceImage:
      typeof details.input.start_image_url === 'string' ||
      typeof details.input.image_url === 'string',
    hasMultiPrompt: Array.isArray(details.input.multi_prompt),
    hasElements: Array.isArray(details.input.elements),
    hasVoiceControl:
      Array.isArray(details.input.elements) &&
      details.input.elements.some(
        (element) => typeof element === 'object' && element !== null && 'voice_id' in element
      ),
    multiPromptCount: Array.isArray(details.input.multi_prompt) ? details.input.multi_prompt.length : 0,
    multiPromptSummary,
    elementKinds,
    hasAudioUrl: typeof details.input.audio_url === 'string',
    inputKeys: Object.keys(details.input),
    inputSummary,
  })
}

function getFalErrorStatus(error: unknown) {
  if (!error || typeof error !== 'object' || !('status' in error)) {
    return undefined
  }

  const status = error.status
  return typeof status === 'number' ? status : undefined
}

function isPendingQueueResultError(error: unknown) {
  const status = getFalErrorStatus(error)
  return status !== undefined && [400, 404, 409].includes(status)
}

function getFalErrorMessage(error: unknown) {
  if (!error || typeof error !== 'object') {
    return 'Unknown Fal API error'
  }

  const message = 'message' in error && typeof error.message === 'string'
    ? error.message
    : 'Fal API error'

  if (!('body' in error) || !error.body || typeof error.body !== 'object' || !('detail' in error.body)) {
    return message
  }

  const detail = error.body.detail

  if (typeof detail === 'string' && detail.trim()) {
    return detail
  }

  if (Array.isArray(detail) && detail.length > 0) {
    const formatted = detail
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null
        const field = Array.isArray(entry.loc) ? entry.loc.join('.') : 'input'
        const entryMessage = typeof entry.msg === 'string' ? entry.msg : null
        return entryMessage ? `${field}: ${entryMessage}` : null
      })
      .filter((entry): entry is string => Boolean(entry))

    if (formatted.length > 0) {
      return formatted.join('; ')
    }
  }

  return message
}

export async function generateImage(config: {
  prompt: string
  model?: string
  negativePrompt?: string
  aspectRatio?: string
  resolution?: string
  seed?: number
  imageSize?: string
  numImages?: number
  outputFormat?: string
  quality?: string
  background?: string
  guidanceScale?: number
  numInferenceSteps?: number
  imageUrl?: string
  imagePromptStrength?: number
  style?: string
  colors?: string[]
}) {
  const model = normalizeFalModelId(config.model || 'fal-ai/flux/schnell')
  const normalizedModel = model.replace(/^fal-ai\//, '')
  const normalizedSteps = normalizeImageInferenceSteps(model, config.numInferenceSteps)

  if (normalizedModel === 'nano-banana-2' && config.imageUrl) {
    const input: Record<string, unknown> = {
      prompt: config.prompt,
      image_urls: [config.imageUrl],
    }

    if (config.aspectRatio) input.aspect_ratio = config.aspectRatio
    if (config.resolution) input.resolution = config.resolution
    if (config.seed !== undefined) input.seed = config.seed
    if (config.numImages !== undefined) input.num_images = config.numImages
    if (config.outputFormat) input.output_format = config.outputFormat

    const result = await fal.subscribe('fal-ai/nano-banana-2/edit', { input })
    return result.data as FalImageOutput
  }
  
  const input: Record<string, unknown> = {
    prompt: config.prompt,
  }

  if (config.negativePrompt) input.negative_prompt = config.negativePrompt
  if (config.aspectRatio) input.aspect_ratio = config.aspectRatio
  if (config.resolution) input.resolution = config.resolution
  if (config.seed !== undefined) input.seed = config.seed
  if (config.imageSize) input.image_size = config.imageSize
  if (config.numImages !== undefined) input.num_images = config.numImages
  if (config.outputFormat) input.output_format = config.outputFormat
  if (config.quality) input.quality = config.quality
  if (config.background) input.background = config.background
  if (config.guidanceScale !== undefined) input.guidance_scale = config.guidanceScale
  if (normalizedSteps !== undefined) input.num_inference_steps = normalizedSteps
  if (config.imageUrl) input.image_url = config.imageUrl
  if (config.imagePromptStrength !== undefined) {
    input.image_prompt_strength = config.imagePromptStrength
  }
  if (config.style) input.style = config.style
  if (config.colors?.length) input.colors = config.colors

  const result = await fal.subscribe(model, { input })
  
  return result.data as FalImageOutput
}

export async function generateVideo(config: VideoGenerationConfig) {
  const normalizedConfig = await normalizeVideoConfigAssets(config)
  const { endpoint, requestedModel, resolvedModel, mode } = resolveVideoModel(normalizedConfig)
  const input = buildVideoInput(normalizedConfig, endpoint)

  logVideoRequest({
    endpoint,
    requestedModel,
    resolvedModel,
    mode,
    input,
  })

  const result = await fal.subscribe(endpoint, { input })
  return result.data as FalVideoOutput
}

export async function enqueueVideoGeneration(config: VideoGenerationConfig) {
  const normalizedConfig = await normalizeVideoConfigAssets(config)
  const { endpoint, requestedModel, resolvedModel, mode } = resolveVideoModel(normalizedConfig)
  const input = buildVideoInput(normalizedConfig, endpoint)

  logVideoRequest({
    endpoint,
    requestedModel,
    resolvedModel,
    mode,
    input,
  })

  try {
    const job = await fal.queue.submit(endpoint, { input })

    return {
      requestId: job.request_id,
      status: job.status,
    }
  } catch (error) {
    console.error('[video.enqueue.error]', {
      endpoint,
      requestedModel,
      mode,
      message: getFalErrorMessage(error),
      status: getFalErrorStatus(error),
      error,
    })

    throw new Error(getFalErrorMessage(error))
  }
}

export async function getVideoGenerationStatus(config: {
  model: string
  mode?: VideoGenerationMode
  requestId: string
}) {
  const { endpoint } = resolveVideoModel(config)
  const status = await fal.queue.status(endpoint, {
    requestId: config.requestId,
    logs: true,
  })

  return {
    requestId: status.request_id,
    status: status.status,
    logs: 'logs' in status ? status.logs : [],
  }
}

export async function getVideoGenerationResult(config: {
  model: string
  mode?: VideoGenerationMode
  requestId: string
}) {
  const { endpoint } = resolveVideoModel(config)
  const result = await fal.queue.result(endpoint, {
    requestId: config.requestId,
  })

  return {
    data: result.data as FalVideoOutput,
    requestId: result.requestId,
  }
}

export async function getVideoGenerationResultIfReady(config: {
  model: string
  mode?: VideoGenerationMode
  requestId: string
}) {
  const { endpoint } = resolveVideoModel(config)

  try {
    const result = await fal.queue.result(endpoint, {
      requestId: config.requestId,
    })

    return {
      data: result.data as FalVideoOutput,
      requestId: result.requestId,
    }
  } catch (error) {
    if (isPendingQueueResultError(error)) {
      return null
    }

    throw error
  }
}

export async function editImage(config: {
  imageUrl: string
  prompt: string
  strength?: number
  model?: string
  referenceImageUrls?: string[]
}) {
  const rawModel = config.model || 'fal-ai/flux/dev/image-to-image'
  
  if (
    rawModel === 'nano-banana-2' ||
    rawModel === 'fal-ai/nano-banana-2' ||
    rawModel === 'nano-banana-2/edit' ||
    rawModel === 'fal-ai/nano-banana-2/edit'
  ) {
    const result = await fal.subscribe('fal-ai/nano-banana-2/edit', {
      input: {
        image_urls: [config.imageUrl, ...(config.referenceImageUrls ?? [])],
        prompt: config.prompt,
      },
    })
    return result.data as FalImageOutput
  }

  if (
    rawModel === 'gpt-image-1.5' ||
    rawModel === 'fal-ai/gpt-image-1.5' ||
    rawModel === 'gpt-image-1.5/edit' ||
    rawModel === 'fal-ai/gpt-image-1.5/edit'
  ) {
    const result = await fal.subscribe('fal-ai/gpt-image-1.5/edit', {
      input: {
        image_urls: [config.imageUrl],
        prompt: config.prompt,
      },
    })
    return result.data as FalImageOutput
  }

  const model = normalizeFalModelId(rawModel)

  const input: Record<string, unknown> = {
    image_url: config.imageUrl,
    prompt: config.prompt,
  }

  if (config.strength !== undefined) input.strength = config.strength

  const result = await fal.subscribe(model, { input })
  return result.data as FalImageOutput
}

export async function upscaleImage(config: {
  imageUrl: string
  model?: string
}) {
  const model = normalizeFalModelId(config.model || 'fal-ai/imageutils/super-resolution')
  
  const result = await fal.subscribe(model, {
    input: {
      image_url: config.imageUrl,
    },
  })
  
  return result.data as FalImageEditOutput
}

export async function removeBackground(config: {
  imageUrl: string
  model?: string
}) {
  const model = normalizeFalModelId(config.model || 'fal-ai/imageutils/rembg')

  const input: Record<string, unknown> = {
    image_url: config.imageUrl,
  }

  // Keep Pixelcut on hosted output so gallery persistence can fetch and store the result.
  if (model === 'pixelcut/background-removal') {
    input.output_format = 'rgba'
    input.sync_mode = false
  }

  const result = await fal.subscribe(model, { input })
  
  return result.data as FalImageEditOutput
}
