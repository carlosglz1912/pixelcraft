import type { VideoGenerationMode } from '@/types'

export interface CostEstimate {
  amount: number
  details: string
  note?: string
}

const DEFAULT_USD_TO_MXN_RATE = 18

function parseUsdToMxnRate(rawRate?: string): number {
  const parsed = Number.parseFloat(rawRate || '')
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_USD_TO_MXN_RATE
}

export const USD_TO_MXN_RATE = parseUsdToMxnRate(process.env.NEXT_PUBLIC_USD_TO_MXN_RATE)

function normalizeModelId(model: string): string {
  return model.replace(/^fal-ai\//, '')
}

function formatSeconds(value?: string): number {
  const parsed = Number.parseInt(value || '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function estimateImageMegapixels(imageSize?: string): number {
  switch (imageSize) {
    case 'square_hd':
      return 2
    case 'square':
      return 2
    case 'landscape_4_3':
      return 2
    case 'portrait_4_3':
      return 2
    case 'landscape_16_9':
      return 1
    case 'portrait_16_9':
      return 1
    default:
      return 1
  }
}

function getSeedanceDimensions(resolution: string, aspectRatio: string): { width: number; height: number } {
  if (resolution === '1080p') {
    if (aspectRatio === '21:9') return { width: 1920, height: 823 }
    if (aspectRatio === '9:16') return { width: 1080, height: 1920 }
    if (aspectRatio === '3:4') return { width: 1080, height: 1440 }
    if (aspectRatio === '4:3') return { width: 1440, height: 1080 }
    if (aspectRatio === '1:1') return { width: 1080, height: 1080 }
    return { width: 1920, height: 1080 }
  }

  if (resolution === '480p') {
    if (aspectRatio === '21:9') return { width: 854, height: 366 }
    if (aspectRatio === '9:16') return { width: 480, height: 854 }
    if (aspectRatio === '3:4') return { width: 480, height: 640 }
    if (aspectRatio === '4:3') return { width: 640, height: 480 }
    if (aspectRatio === '1:1') return { width: 480, height: 480 }
    return { width: 854, height: 480 }
  }

  if (aspectRatio === '21:9') return { width: 1280, height: 549 }
  if (aspectRatio === '9:16') return { width: 720, height: 1280 }
  if (aspectRatio === '3:4') return { width: 720, height: 960 }
  if (aspectRatio === '4:3') return { width: 960, height: 720 }
  if (aspectRatio === '1:1') return { width: 720, height: 720 }
  return { width: 1280, height: 720 }
}

export function formatCostEstimate(amount: number): string {
  if (amount >= 1) return `$${amount.toFixed(2)}`
  if (amount >= 0.1) return `$${amount.toFixed(2)}`
  if (amount >= 0.01) return `$${amount.toFixed(3)}`
  if (amount > 0) return `$${amount.toFixed(4)}`
  return '$0.00'
}

export function formatCostEstimateMxn(amount: number, rate = USD_TO_MXN_RATE): string {
  const converted = amount * rate
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: converted >= 1 ? 2 : 3,
    maximumFractionDigits: converted >= 1 ? 2 : 4,
  }).format(converted)
}

export function estimateImageGenerationCost(config: {
  model: string
  imageSize?: string
  resolution?: string
  numImages?: number
  style?: string
  quality?: string
  enableWebSearch?: boolean
  thinkingLevel?: 'minimal' | 'high'
}): CostEstimate | null {
  const model = normalizeModelId(config.model)
  const numImages = config.numImages && config.numImages > 0 ? config.numImages : 1
  const megapixels = estimateImageMegapixels(config.imageSize)

  if (model === 'flux/schnell') {
    const amount = 0.003 * megapixels * numImages
    return {
      amount,
      details: `${numImages} imagen(es) x ${megapixels} MP x $0.003/MP`,
      note: 'fal factura redondeando hacia arriba al siguiente megapixel.',
    }
  }

  if (model === 'flux/dev') {
    const amount = 0.025 * megapixels * numImages
    return {
      amount,
      details: `${numImages} imagen(es) x ${megapixels} MP x $0.025/MP`,
      note: 'fal factura redondeando hacia arriba al siguiente megapixel.',
    }
  }

  if (model === 'stable-diffusion-v35-large') {
    const amount = 0.065 * megapixels * numImages
    return {
      amount,
      details: `${numImages} imagen(es) x ${megapixels} MP x $0.065/MP`,
      note: 'fal factura redondeando hacia arriba al siguiente megapixel.',
    }
  }

  if (model === 'flux-pro/v1.1-ultra') {
    const amount = 0.06 * numImages
    return {
      amount,
      details: `${numImages} imagen(es) x $0.06`,
    }
  }

  if (model === 'recraft-v3') {
    const isVectorStyle = config.style === 'vector_illustration'
    const rate = isVectorStyle ? 0.08 : 0.04
    const amount = rate * numImages
    return {
      amount,
      details: `${numImages} imagen(es) x $${rate.toFixed(2)}`,
      note: isVectorStyle ? 'Se estima tarifa vectorial para el estilo seleccionado.' : undefined,
    }
  }

  if (
    model === 'nano-banana-2' ||
    model === 'nano-banana-2/edit' ||
    model === 'gemini-3.1-flash-image-preview'
  ) {
    const resolution = config.resolution || '1K'
    const multiplier =
      resolution === '4K'
        ? 2
        : resolution === '2K'
          ? 1.5
          : resolution === '0.5K'
            ? 0.75
            : 1
    const baseRate = 0.08
    const amount = baseRate * multiplier * numImages
    const modeLabel = model.endsWith('/edit') ? 'edicion' : 'generacion'
    const details =
      multiplier === 1
        ? `${numImages} imagen(es) x $${baseRate.toFixed(2)} (${resolution}, ${modeLabel})`
        : `${numImages} imagen(es) x $${baseRate.toFixed(2)} x ${multiplier} (${resolution}, ${modeLabel})`

    const noteParts = [
      'Incluye la tarifa base oficial de Nano Banana 2 en fal.ai.',
      'Multiplicadores soportados: 0.5K x0.75, 2K x1.5, 4K x2.',
    ]

    if (config.enableWebSearch) {
      noteParts.push('Incluye el recargo de web search de $0.015 por solicitud.')
    } else {
      noteParts.push('No incluye el recargo opcional de web search de $0.015 por solicitud.')
    }

    if (config.thinkingLevel === 'high') {
      noteParts.push('Incluye el recargo de thinking high de $0.002 por solicitud.')
    } else if (config.thinkingLevel === 'minimal') {
      noteParts.push('Thinking minimal no agrega costo en esta estimacion.')
    } else {
      noteParts.push('No incluye recargos opcionales de thinking.')
    }

    return {
      amount:
        amount +
        (config.enableWebSearch ? 0.015 : 0) +
        (config.thinkingLevel === 'high' ? 0.002 : 0),
      details,
      note: noteParts.join(' '),
    }
  }

  if (model === 'openai/gpt-image-2' || model === 'openai/gpt-image-2/edit') {
    const sizeCosts: Record<string, Record<string, number>> = {
      'square_hd': { low: 0.01, medium: 0.06, high: 0.22 },
      'square': { low: 0.01, medium: 0.03, high: 0.10 },
      'landscape_4_3': { low: 0.01, medium: 0.04, high: 0.15 },
      'landscape_16_9': { low: 0.01, medium: 0.03, high: 0.12 },
      'portrait_4_3': { low: 0.01, medium: 0.04, high: 0.15 },
      'portrait_16_9': { low: 0.01, medium: 0.03, high: 0.12 },
    }
    const quality = config.quality || 'high'
    const size = config.imageSize || 'landscape_4_3'
    const baseCost = sizeCosts[size]?.[quality] ?? 0.15
    const amount = baseCost * numImages
    const modeLabel = model.endsWith('/edit') ? 'edicion' : 'generacion'
    return {
      amount,
      details: `${numImages} imagen(es) x $${baseCost.toFixed(2)} (${quality}, ${size}, ${modeLabel})`,
      note: 'Precios oficiales de fal.ai por tamano y calidad. Calidad alta por defecto.',
    }
  }

  return null
}

export function estimateImageTransformCost(config: {
  model: string
  width?: number
  height?: number
}): CostEstimate | null {
  const model = normalizeModelId(config.model)

  if (!config.width || !config.height) {
    return null
  }

  const rawMegapixels = (config.width * config.height) / 1_000_000
  const billedMegapixels = Math.max(1, Math.ceil(rawMegapixels))

  if (model === 'seedvr/upscale/image/seamless') {
    const rate = 0.0025
    const amount = billedMegapixels * rate
    return {
      amount,
      details: `${billedMegapixels} MP facturados x $${rate.toFixed(4)}/MP`,
      note: `Resolucion detectada: ${config.width}x${config.height} (~${rawMegapixels.toFixed(2)} MP). fal factura redondeando hacia arriba al siguiente megapixel.`,
    }
  }

  return null
}

export function estimateVideoGenerationCost(config: {
  model: string
  mode: VideoGenerationMode
  duration?: string
  resolution?: string
  aspectRatio?: string
  generateAudio?: boolean
  numFrames?: number
  hasVoiceControl?: boolean
}): CostEstimate | null {
  const model = normalizeModelId(config.model)
  const seconds = formatSeconds(config.duration)
  const resolution = config.resolution || '720p'
  const aspectRatio = config.aspectRatio || '16:9'
  const generateAudio = Boolean(config.generateAudio)
  const hasVoiceControl = Boolean(config.hasVoiceControl)

  if (model === 'kling-video/v3/pro/image-to-video' || model === 'kling-video/v3/pro/text-to-video') {
    const rate = generateAudio ? (hasVoiceControl ? 0.196 : 0.168) : 0.112
    const amount = rate * seconds
    return {
      amount,
      details: `${seconds}s x $${rate.toFixed(3)}/s`,
      note: hasVoiceControl ? 'Incluye la tarifa documentada para audio con voice control.' : undefined,
    }
  }

  if (model === 'kling-video/o3/standard/image-to-video' || model === 'kling-video/o3/standard/text-to-video') {
    const rate = generateAudio ? 0.224 : 0.168
    const amount = rate * seconds
    return {
      amount,
      details: `${seconds}s x $${rate.toFixed(3)}/s`,
    }
  }

  if (model === 'minimax/hailuo-2.3/pro/image-to-video' || model === 'minimax/hailuo-2.3/pro/text-to-video') {
    return {
      amount: 0.49,
      details: '$0.49 por generación',
    }
  }

  if (model === 'minimax/hailuo-02/standard/image-to-video' || model === 'minimax/hailuo-02/standard/text-to-video') {
    return {
      amount: 0.27,
      details: 'Estimado con el default documentado de 6s a 768p',
      note: 'El endpoint expone múltiples resoluciones, pero la UI actual no las controla.',
    }
  }

  if (model === 'bytedance/seedance/v1.5/pro/image-to-video' || model === 'bytedance/seedance/v1.5/pro/text-to-video') {
    const { width, height } = getSeedanceDimensions(resolution, aspectRatio)
    const tokens = (width * height * 24 * seconds) / 1024
    const ratePerMillion = generateAudio ? 2.4 : 1.2
    const amount = (tokens / 1_000_000) * ratePerMillion
    return {
      amount,
      details: `${seconds}s x ${resolution} x ${generateAudio ? 'audio' : 'sin audio'}`,
      note: 'Estimado con la formula oficial de video tokens de Seedance.',
    }
  }

  if (model === 'bytedance/seedance-2.0/image-to-video') {
    const effectiveSeconds = seconds > 0 ? seconds : 5
    const { width, height } = getSeedanceDimensions(resolution, aspectRatio)
    const tokens = (width * height * 24 * effectiveSeconds) / 1024
    const amount = (tokens / 1000) * 0.014
    return {
      amount,
      details: `${effectiveSeconds}s x ${resolution} (~$${(amount / effectiveSeconds).toFixed(3)}/s)`,
      note: seconds === 0 ? 'Duración "auto" estimada como 5s.' : 'Estimado con la fórmula de tokens oficial de Seedance 2.0.',
    }
  }

  if (model === 'veo3.1' || model === 'veo3.1/image-to-video') {
    const rate =
      resolution === '4k'
        ? generateAudio
          ? 0.6
          : 0.4
        : generateAudio
          ? 0.4
          : 0.2
    const amount = rate * seconds
    return {
      amount,
      details: `${seconds}s x $${rate.toFixed(2)}/s`,
    }
  }

  if (model === 'veo3.1/fast' || model === 'veo3.1/fast/image-to-video') {
    const rate =
      resolution === '4k'
        ? generateAudio
          ? 0.35
          : 0.3
        : generateAudio
          ? 0.15
          : 0.1
    const amount = rate * seconds
    return {
      amount,
      details: `${seconds}s x $${rate.toFixed(2)}/s`,
    }
  }

  if (model === 'sora-2/text-to-video' || model === 'sora-2/image-to-video') {
    const amount = 0.1 * seconds
    return {
      amount,
      details: `${seconds}s x $0.10/s`,
    }
  }

  if (model === 'sora-2/text-to-video/pro' || model === 'sora-2/image-to-video/pro') {
    const rate = resolution === '720p' ? 0.3 : 0.5
    const amount = rate * seconds
    return {
      amount,
      details: `${seconds}s x $${rate.toFixed(2)}/s`,
      note: resolution === 'auto' ? 'Se estima "auto" como tarifa de 1080p.' : undefined,
    }
  }

  if (model === 'wan/v2.2-a14b/text-to-video' || model === 'wan/v2.2-a14b/image-to-video') {
    const billedSeconds = (config.numFrames && config.numFrames > 0 ? config.numFrames : 81) / 16
    const rate = resolution === '720p' ? 0.08 : resolution === '580p' ? 0.06 : 0.04
    const amount = billedSeconds * rate
    return {
      amount,
      details: `${billedSeconds.toFixed(2)}s facturados x $${rate.toFixed(2)}/s`,
      note: 'Wan factura segundos usando 16 FPS para el cobro.',
    }
  }

  if (model === 'creatify/aurora') {
    const rate = resolution === '720p' ? 0.14 : 0.10
    return {
      amount: 0.5,
      details: `~$0.10/s (480p) o $0.14/s (720p)`,
      note: 'El costo depende de la duración del audio proporcionado.',
    }
  }

  return null
}
