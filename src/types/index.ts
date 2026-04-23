export type MediaType = 'image' | 'video'
export type VideoGenerationMode = 'text-to-video' | 'image-to-video'

export interface GenerationMetadata {
  costTier?: CostTier
  estimatedCost?: number
  requestId?: string
  imageSize?: string
  imageAspectRatio?: string
  imageResolution?: string
  imageQuality?: string
  imageBackground?: string
  outputFormat?: string
  seed?: number
  guidanceScale?: number
  numInferenceSteps?: number
  imageStyle?: string
  imageColors?: string[]
  imagePromptStrength?: number
  duration?: string
  aspectRatio?: string
  resolution?: string
  videoMode?: VideoGenerationMode
  videoQuality?: string
  numFrames?: number
  framesPerSecond?: number
  sourceId?: string
  source?: string
  strength?: number
  references?: string[]
  storageId?: string
  persisted?: boolean
  negativePrompt?: string
  userId?: string
}

export interface GeneratedMediaBase {
  type: MediaType
  url: string
  prompt: string
  model: string
  costTier?: CostTier
  metadata?: GenerationMetadata
}

export interface GeneratedMedia extends GeneratedMediaBase {
  id: string
  createdAt: Date
}

export interface PendingMedia {
  id: string
  type: MediaType
  prompt: string
  model: string
  costTier?: CostTier
  metadata?: Pick<
    GenerationMetadata,
    | 'requestId'
    | 'imageSize'
    | 'aspectRatio'
    | 'resolution'
    | 'duration'
    | 'videoMode'
    | 'estimatedCost'
    | 'seed'
    | 'videoQuality'
    | 'numFrames'
    | 'framesPerSecond'
    | 'negativePrompt'
  >
  createdAt: Date
}

export interface PersistedMedia {
  _id: string
  storageId: string
  provider: 'convex' | 'r2'
  type: MediaType
  url: string
  originalUrl?: string
  fileName: string
  contentType?: string
  size?: number
  modelId?: string
  prompt?: string
  negativePrompt?: string
  seed?: number
  duration?: number
  aspectRatio?: string
  resolution?: string
  costTier?: string
  createdAt: number
  userId?: string
}

export interface GenerationConfig {
  model: string
  prompt: string
  negativePrompt?: string
  seed?: number
  aspectRatio?: string
  numImages?: number
  imageUrl?: string
}

export type OperationType = 'text-to-image' | 'image-to-video' | 'edit-image' | 'upscale' | 'remove-background'

export type CostTier = 'free' | 'low' | 'medium' | 'high' | 'premium'

export function getCostTierLabel(costTier?: CostTier): string | null {
  if (!costTier) return null
  if (costTier === 'free') return 'Gratis'
  if (costTier === 'low') return '$'
  if (costTier === 'medium') return '$$'
  if (costTier === 'high') return '$$$'
  return '$$$$'
}

export type ImageModelSupport =
  | 'negative_prompt'
  | 'image_size'
  | 'aspect_ratio'
  | 'resolution'
  | 'num_images'
  | 'output_format'
  | 'quality'
  | 'background'
  | 'guidance_scale'
  | 'num_inference_steps'
  | 'seed'
  | 'reference_image'
  | 'image_prompt_strength'
  | 'style'
  | 'colors'

export interface ModelInfo {
  description: string
  tips?: string[]
  bestFor?: string[]
}

export interface ImageModelConfig {
  name: string
  supports: readonly ImageModelSupport[]
  info?: ModelInfo
  costTier?: CostTier
}

export interface ImageModelFamily {
  name: string
  models: Record<string, ImageModelConfig>
}

export const IMAGE_MODEL_FAMILIES: Record<string, ImageModelFamily> = {
  flux: {
    name: 'Flux',
    models: {
      'flux/dev': { 
        name: 'Dev', 
        supports: ['image_size', 'num_images', 'guidance_scale', 'num_inference_steps', 'seed'] as const,
        costTier: 'medium',
        info: {
          description: 'Modelo de alta calidad para uso profesional. Excelente para ilustraciones detalladas y fotorealismo.',
          tips: [
            'Usa guidance_scale 3-7 para mejores resultados',
            '20-30 pasos de inferencia son suficientes',
            'Incluye estilo artístico en el prompt'
          ],
          bestFor: ['Ilustraciones', 'Fotorealismo', 'Arte digital']
        }
      },
      'flux/schnell': { 
        name: 'Schnell', 
        supports: ['image_size', 'num_images', 'guidance_scale', 'num_inference_steps', 'seed'] as const,
        costTier: 'low',
        info: {
          description: 'Modelo rápido optimizado para generación en tiempo real. Ideal para prototipos y previews.',
          tips: [
            'Solo 1-4 pasos necesarios',
            'Ideal para iterar rápido',
            'Menor detalle que Dev'
          ],
          bestFor: ['Prototipos rápidos', 'Previews', 'Testing']
        }
      },
      'flux-pro/v1.1-ultra': { 
        name: 'Pro Ultra', 
        supports: ['image_size', 'num_images', 'reference_image', 'image_prompt_strength'] as const,
        costTier: 'premium',
        info: {
          description: 'El modelo más avanzado de Flux. Máxima calidad y detalle para proyectos profesionales.',
          tips: [
            'Máxima calidad disponible',
            'Ideal para producción final',
            'Mayor tiempo de generación'
          ],
          bestFor: ['Producción', 'Print', 'Alta resolución']
        }
      },
    },
  },
  'stable-diffusion': {
    name: 'Stable Diffusion',
    models: {
      'stable-diffusion-v35-large': { 
        name: '3.5 Large', 
        supports: ['negative_prompt', 'image_size', 'num_images', 'guidance_scale', 'num_inference_steps', 'seed'] as const,
        costTier: 'medium',
        info: {
          description: 'Stable Diffusion 3.5 Large. Excelente balance entre calidad y control.',
          tips: [
            'Negative prompt muy efectivo',
            'Guidance 5-8 recomendado',
            'Bueno para estilos variados'
          ],
          bestFor: ['Estilos artísticos', 'Flexibilidad', 'Control fino']
        }
      },
    },
  },
  recraft: {
    name: 'Recraft',
    models: {
      'recraft/v3': { 
        name: 'V3', 
        supports: ['image_size', 'style', 'colors'] as const,
        costTier: 'medium',
        info: {
          description: 'Especializado en diseño gráfico y vectores. Ideal para logos, iconos y branding.',
          tips: [
            'Excelente para diseño gráfico',
            'Estilos vectoriales limpios',
            'Consistencia en branding'
          ],
          bestFor: ['Logos', 'Iconos', 'Branding', 'Vectores']
        }
      },
    },
  },
  'flux-2': {
    name: 'Flux 2',
    models: {
      'flux-2-flex': {
        name: 'Flex',
        supports: ['image_size', 'num_images', 'guidance_scale', 'num_inference_steps', 'seed'] as const,
        costTier: 'high',
        info: {
          description: 'FLUX.2 Flex con mejor tipografia, mayor fidelidad al prompt y control fino sobre pasos y guia.',
          tips: [
            'Buena opcion si FLUX.1 ya no te esta dando suficiente adherencia',
            'Sube los pasos para composiciones complejas o texto',
            'Mantiene mejor consistencia en layouts y piezas con copy'
          ],
          bestFor: ['Tipografia', 'Mockups', 'Marketing', 'Control fino']
        }
      },
    },
  },
  openai: {
    name: 'OpenAI',
    models: {
      'gpt-image-1.5': {
        name: 'GPT Image 1.5',
        supports: ['image_size', 'num_images', 'output_format', 'quality', 'background'] as const,
        costTier: 'premium',
        info: {
          description: 'Modelo de imagen mas reciente de OpenAI en fal. Destaca por adherencia al prompt, texto legible y acabados limpios.',
          tips: [
            'Usa quality high para piezas finales',
            'Transparent es util para assets recortables',
            'Funciona especialmente bien con prompts muy especificos'
          ],
          bestFor: ['Prompt adherence', 'Texto en imagen', 'Ads', 'Producto']
        }
      },
    },
  },
  google: {
    name: 'Google',
    models: {
      'nano-banana': {
        name: 'Nano Banana',
        supports: ['aspect_ratio', 'num_images', 'output_format', 'seed'] as const,
        costTier: 'medium',
        info: {
          description: 'Version rapida de Google para imagen. Buena calidad con latencia y costo mas contenidos.',
          tips: [
            'Ideal para iteracion rapida',
            'Suele seguir bien escenas naturales y producto',
            'PNG da la salida mas segura para postproceso'
          ],
          bestFor: ['Iteracion', 'Concepts', 'General purpose']
        }
      },
      'nano-banana-2': {
        name: 'Nano Banana 2',
        supports: ['aspect_ratio', 'resolution', 'num_images', 'output_format', 'seed', 'reference_image'] as const,
        costTier: 'high',
        info: {
          description: 'La variante mas fuerte de la familia Nano Banana. Mejora calidad, costo por resultado y detalle frente a la version base.',
          tips: [
            'Empieza con 1K y sube a 2K o 4K cuando la composicion ya este cerrada',
            'Usa auto si quieres que el modelo elija el encuadre',
            'Buen candidato para fotorealismo y escenas complejas'
          ],
          bestFor: ['Alta calidad', 'Fotorealismo', 'Accion', 'Produccion']
        }
      },
    },
  },
  ideogram: {
    name: 'Ideogram',
    models: {
      'ideogram/v3': {
        name: 'V3',
        supports: ['negative_prompt', 'image_size', 'num_images', 'seed'] as const,
        costTier: 'high',
        info: {
          description: 'Ideogram V3 sobresale en posters, logos y texto integrado dentro de la imagen.',
          tips: [
            'Muy fuerte para carteles y titulares',
            'Define el copy exacto entre comillas',
            'Usa negative prompt para limpiar artefactos'
          ],
          bestFor: ['Posters', 'Logos', 'Texto', 'Branding']
        }
      },
    },
  },
  bria: {
    name: 'Bria',
    models: {
      'bria/fibo/generate': {
        name: 'Fibo',
        supports: ['negative_prompt', 'aspect_ratio', 'resolution', 'guidance_scale', 'seed', 'reference_image'] as const,
        costTier: 'high',
        info: {
          description: 'Modelo de alta precision entrenado con datos licenciados. Muy util cuando buscas control y uso comercial seguro.',
          tips: [
            'La imagen de referencia ayuda a fijar composicion o estilo',
            'Usa 4MP solo cuando ya cerraste la direccion visual',
            'Guidance moderado suele dar mejor balance que llevarlo al maximo'
          ],
          bestFor: ['Precision', 'Enterprise', 'Comercial', 'Consistency']
        }
      },
    },
  },
}

export type ImageModelFamilyId = keyof typeof IMAGE_MODEL_FAMILIES

export function getImageModelConfig(modelId: string): ImageModelConfig | undefined {
  for (const family of Object.values(IMAGE_MODEL_FAMILIES)) {
    if (family.models[modelId]) {
      return family.models[modelId]
    }
  }
  return undefined
}

export type VideoModelSupport =
  | 'duration'
  | 'cfg_scale'
  | 'negative_prompt'
  | 'multi_prompt'
  | 'elements'
  | 'tail_image'
  | 'aspect_ratio'
  | 'loop'
  | 'end_image'
  | 'audio'
  | 'audio_url'
  | 'resolution'
  | 'prompt_optimizer'
  | 'seed'
  | 'auto_fix'
  | 'delete_video'
  | 'video_quality'
  | 'frames_per_second'
  | 'num_frames'
  | 'num_inference_steps'
  | 'prompt_expansion'
  | 'acceleration'
  | 'guidance_scale'
  | 'audio_guidance_scale'

export interface VideoModelConfig {
  name: string
  supports: readonly VideoModelSupport[]
  textToVideoModel?: string
  info?: ModelInfo
  costTier?: CostTier
}

export interface VideoModelFamily {
  name: string
  models: Record<string, VideoModelConfig>
}

export const VIDEO_MODEL_FAMILIES: Record<string, VideoModelFamily> = {
  creatify: {
    name: 'Creatify',
    models: {
      'creatify/aurora': { 
        name: 'Aurora (Avatar)', 
        supports: ['audio_url', 'resolution', 'guidance_scale', 'audio_guidance_scale'] as const,
        costTier: 'high',
        info: {
          description: 'Genera videos de estudio de alta fidelidad con tu avatar hablando o cantando. Sincronización labial automática con el audio.',
          tips: [
            'Usa fotos con rostro visible y fondo claro',
            'Audio de alta calidad mejora resultados',
            '720p recomendado para mejor calidad',
            'Lip-sync controla la precisión de sincronización',
            'Visual guidance ajusta adherencia al estilo'
          ],
          bestFor: ['Avatares parlantes', 'Presentaciones', 'Narración', 'Videos musicales', 'Tutoriales']
        }
      },
    },
  },
  kling: {
    name: 'Kling',
    models: {
      'kling-video/v3/pro/image-to-video': { 
        name: 'v3 Pro', 
        supports: ['duration', 'cfg_scale', 'negative_prompt', 'end_image', 'aspect_ratio', 'audio', 'multi_prompt', 'elements'] as const,
        textToVideoModel: 'kling-video/v3/pro/text-to-video',
        costTier: 'high',
        info: {
          description: 'Modelo premium con look cinematográfico, multi-shot, audio nativo y soporte de elementos personalizados.',
          tips: [
            'Hasta 15s de duración',
            'Audio generado automáticamente',
            'CFG 0.5-0.7 para balance',
            'Puedes referenciar elementos como @Element1',
            'Usa end_image para transiciones'
          ],
          bestFor: ['Videos realistas', 'Contenido social', 'Audio integrado', 'Escenas con personajes/props']
        }
      },
      'kling-video/o3/standard/image-to-video': { 
        name: 'O3 Standard', 
        supports: ['duration', 'aspect_ratio', 'end_image', 'audio', 'multi_prompt'] as const,
        textToVideoModel: 'kling-video/o3/standard/text-to-video',
        costTier: 'medium',
        info: {
          description: 'Versión optimizada para velocidad. Buen balance calidad/costo.',
          tips: [
            'Más rápido que Pro',
            'Audio nativo opcional',
            'Multi-shot disponible',
            'Ideal para testing'
          ],
          bestFor: ['Prototipos', 'Testing', 'Volumen alto']
        }
      },
    },
  },
  minimax: {
    name: 'MiniMax',
    models: {
      'minimax/hailuo-2.3/pro/image-to-video': { 
        name: 'Hailuo 2.3 Pro', 
        supports: ['prompt_optimizer'] as const,
        textToVideoModel: 'minimax/hailuo-2.3/pro/text-to-video',
        costTier: 'high',
        info: {
          description: 'Video-01 Pro con optimizador de prompts automático. Alta calidad de movimiento.',
          tips: [
            'Prompt optimizer mejora resultados',
            'Excelente para movimientos complejos',
            'Prompts simples funcionan bien'
          ],
          bestFor: ['Movimiento natural', 'Prompts simples', 'Calidad alta']
        }
      },
      'minimax/hailuo-02/standard/image-to-video': { 
        name: 'Hailuo 02 Standard', 
        supports: ['prompt_optimizer'] as const,
        textToVideoModel: 'minimax/hailuo-02/standard/text-to-video',
        costTier: 'medium',
        info: {
          description: 'Versión estándar con optimizador. Buen balance para uso general.',
          tips: [
            'Más económico que Pro',
            'Optimizador incluido',
            'Ideal para iterar'
          ],
          bestFor: ['Uso general', 'Volumen', 'Testing']
        }
      },
    },
  },
  bytedance: {
    name: 'ByteDance',
    models: {
      'bytedance/seedance/v1.5/pro/image-to-video': { 
        name: 'Seedance 1.5 Pro', 
        supports: ['duration', 'aspect_ratio', 'resolution', 'end_image', 'audio'] as const,
        textToVideoModel: 'bytedance/seedance/v1.5/pro/text-to-video',
        costTier: 'high',
        info: {
          description: 'Modelo de ByteDance con control de resolución y audio. Excelente para contenido profesional.',
          tips: [
            'Control de resolución (480p-1080p)',
            'Audio generado opcional',
            'Hasta 12s de duración',
            'End frame para transiciones'
          ],
          bestFor: ['Contenido profesional', 'Control fino', 'Calidad']
        }
      },
    },
  },
  google: {
    name: 'Google',
    models: {
      'veo3.1/image-to-video': { 
        name: 'Veo 3.1', 
        supports: ['duration', 'aspect_ratio', 'resolution', 'negative_prompt', 'audio', 'seed', 'auto_fix'] as const,
        textToVideoModel: 'veo3.1',
        costTier: 'premium',
        info: {
          description: 'Google Veo 3.1 - Estado del arte en generación de video. Máxima calidad disponible.',
          tips: [
            'Máxima calidad de Google',
            'Audio generado opcional',
            'Negative prompt disponible',
            '720p o 1080p'
          ],
          bestFor: ['Producción premium', 'Calidad máxima', 'Cine']
        }
      },
      'veo3.1/fast/image-to-video': { 
        name: 'Veo 3.1 Fast', 
        supports: ['duration', 'aspect_ratio', 'resolution', 'seed', 'auto_fix'] as const,
        textToVideoModel: 'veo3.1/fast',
        costTier: 'high',
        info: {
          description: 'Veo 3.1 optimizado para velocidad. Misma calidad base, menor tiempo de espera.',
          tips: [
            'Más rápido que Veo estándar',
            'Sin audio generado',
            'Ideal para iterar'
          ],
          bestFor: ['Prototipos premium', 'Iteración', 'Speed']
        }
      },
    },
  },
  openai: {
    name: 'OpenAI',
    models: {
      'sora-2/image-to-video': { 
        name: 'Sora 2', 
        supports: ['duration', 'aspect_ratio', 'resolution', 'delete_video'] as const,
        textToVideoModel: 'sora-2/text-to-video',
        costTier: 'premium',
        info: {
          description: 'Sora 2 de OpenAI. Generación de video de alta calidad con comprensión avanzada del mundo.',
          tips: [
            'Excelente física y movimiento',
            'Duración 4-12s',
            '480p-1080p disponible'
          ],
          bestFor: ['Física realista', 'Coherencia temporal', 'Narrativa']
        }
      },
      'sora-2/image-to-video/pro': { 
        name: 'Sora 2 Pro', 
        supports: ['duration', 'aspect_ratio', 'resolution', 'delete_video'] as const,
        textToVideoModel: 'sora-2/text-to-video/pro',
        costTier: 'premium',
        info: {
          description: 'Sora 2 Pro - Versión más avanzada de Sora. Máxima calidad y detalle.',
          tips: [
            'Máxima calidad Sora',
            'Mayor coherencia',
            'Ideal para producción final'
          ],
          bestFor: ['Producción final', 'Calidad máxima', 'Narrativa compleja']
        }
      },
    },
  },
  wan: {
    name: 'Wan (Alibaba)',
    models: {
      'wan/v2.2-a14b/image-to-video': { 
        name: 'Wan 2.2', 
        supports: ['negative_prompt', 'aspect_ratio', 'resolution', 'seed', 'video_quality', 'frames_per_second', 'num_frames', 'num_inference_steps', 'prompt_expansion', 'acceleration'] as const,
        textToVideoModel: 'wan/v2.2-a14b/text-to-video',
        costTier: 'low',
        info: {
          description: 'Modelo de Alibaba, eficiente y accesible. Buena calidad para uso general.',
          tips: [
            'Económico y eficiente',
            'Configuración simple',
            'Ideal para empezar'
          ],
          bestFor: ['Uso general', 'Economía', 'Volumen']
        }
      },
    },
  },
}

export type VideoModelFamilyId = keyof typeof VIDEO_MODEL_FAMILIES

export function getVideoModelConfig(modelId: string): VideoModelConfig | undefined {
  for (const family of Object.values(VIDEO_MODEL_FAMILIES)) {
    if (family.models[modelId]) {
      return family.models[modelId]
    }
  }
  return undefined
}

export function getVideoModes(modelId: string): readonly VideoGenerationMode[] {
  if (getVideoModelConfig(modelId)?.textToVideoModel) {
    return ['text-to-video', 'image-to-video']
  }
  return ['image-to-video']
}

export function getVideoEndpoint(modelId: string, mode: VideoGenerationMode): string | undefined {
  const config = getVideoModelConfig(modelId)
  if (!config) return undefined
  if (mode === 'text-to-video') return config.textToVideoModel
  return modelId
}

export function getVideoEffectiveSupports(
  modelId: string,
  mode: VideoGenerationMode
): readonly VideoModelSupport[] {
  if (modelId === 'kling-video/v3/pro/image-to-video') {
    return mode === 'image-to-video'
      ? (['duration', 'cfg_scale', 'negative_prompt', 'end_image', 'audio', 'multi_prompt', 'elements'] as const)
      : (['duration', 'cfg_scale', 'negative_prompt', 'aspect_ratio', 'audio', 'multi_prompt'] as const)
  }

  if (modelId === 'kling-video/o3/standard/image-to-video') {
    return mode === 'image-to-video'
      ? (['duration', 'end_image', 'audio', 'multi_prompt'] as const)
      : (['duration', 'aspect_ratio', 'audio', 'multi_prompt'] as const)
  }

  return getVideoModelConfig(modelId)?.supports ?? []
}

const VIDEO_DURATIONS_KLING = ['3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'] as const
const VIDEO_DURATIONS_SEEDANCE = ['4', '5', '6', '7', '8', '9', '10', '11', '12'] as const
const VIDEO_DURATIONS_VEO = ['4', '6', '8'] as const
const VIDEO_DURATIONS_SORA = ['4', '8', '12'] as const
const VIDEO_DURATIONS_NONE = [] as const

export function canGenerateVideoFromPromptOnly(modelId: string): boolean {
  return Boolean(getVideoModelConfig(modelId)?.textToVideoModel)
}

export function getVideoDurations(modelId: string): readonly string[] {
  if (modelId.includes('kling')) return VIDEO_DURATIONS_KLING
  if (modelId.includes('seedance')) return VIDEO_DURATIONS_SEEDANCE
  if (modelId.includes('veo')) return VIDEO_DURATIONS_VEO
  if (modelId.includes('sora')) return VIDEO_DURATIONS_SORA
  return VIDEO_DURATIONS_NONE
}

const VIDEO_ASPECT_RATIOS_DEFAULT = ['16:9', '9:16', '1:1'] as const
const VIDEO_ASPECT_RATIOS_AUTO_WIDE = ['auto', '16:9', '9:16'] as const
const VIDEO_ASPECT_RATIOS_AUTO_DEFAULT = ['auto', '16:9', '9:16', '1:1'] as const

export function getVideoAspectRatios(
  modelId: string,
  mode: VideoGenerationMode
): readonly string[] {
  if (modelId.includes('veo')) {
    return mode === 'image-to-video' ? VIDEO_ASPECT_RATIOS_AUTO_WIDE : ['16:9', '9:16']
  }
  if (modelId.includes('sora')) {
    return mode === 'image-to-video' ? VIDEO_ASPECT_RATIOS_AUTO_WIDE : ['16:9', '9:16']
  }
  if (modelId.includes('wan')) {
    return mode === 'image-to-video' ? VIDEO_ASPECT_RATIOS_AUTO_DEFAULT : VIDEO_ASPECT_RATIOS_DEFAULT
  }
  return VIDEO_ASPECT_RATIOS_DEFAULT
}

export function getVideoResolutions(
  modelId: string,
  mode: VideoGenerationMode
): readonly string[] {
  if (modelId.includes('veo')) return ['720p', '1080p', '4k']
  if (modelId.includes('sora')) {
    return mode === 'image-to-video' ? ['auto', '720p'] : ['720p']
  }
  if (modelId.includes('wan')) return ['480p', '580p', '720p']
  if (modelId.includes('aurora')) return ['480p', '720p']
  return ['480p', '720p', '1080p']
}

export type UpscaleModelSupport = 'scale'

export interface UpscaleModelConfig {
  name: string
  supports?: readonly UpscaleModelSupport[]
  info?: ModelInfo
  costTier?: CostTier
}

export const UPSCALE_MODELS: Record<string, UpscaleModelConfig> = {
  'fal-ai/imageutils/super-resolution': { 
    name: 'Super Resolution (Basic)',
    costTier: 'low',
    info: {
      description: 'Upscale básico 2x-4x. Rápido y económico.',
      tips: ['2x-4x aumento', 'Ideal para imágenes pequeñas', 'Rápido']
    }
  },
  'bria/upscale/creative': { 
    name: 'Bria Creative (4MP)',
    costTier: 'medium',
    info: {
      description: 'Upscale creativo hasta 4MP. Añade detalles y mejora texturas.',
      tips: ['Hasta 4MP', 'Mejora texturas', 'Añade detalles']
    }
  },
  'fal-ai/topaz/upscale/image': { 
    name: 'Topaz (Pro)',
    costTier: 'high',
    info: {
      description: 'Topaz Gigapixel - El mejor upscale del mercado. Restauración de detalles.',
      tips: ['Máxima calidad', 'Restaura detalles', 'Hasta 16x']
    }
  },
  'fal-ai/seedvr/upscale/image/seamless': {
    name: 'SeedVR2 (Seamless)',
    costTier: 'low',
    info: {
      description: 'Upscale enfocado en texturas y patrones tileables, conservando seams limpios para tiling continuo.',
      tips: ['Ideal para seamless tiling', 'Precio oficial: $0.0025/MP', 'Funciona bien con texturas y materiales'],
      bestFor: ['Texturas repetibles', 'Patrones', 'Assets 2D/3D']
    }
  },
}

export type UpscaleModelId = keyof typeof UPSCALE_MODELS

export function getUpscaleModelConfig(modelId: string): UpscaleModelConfig | undefined {
  return UPSCALE_MODELS[modelId]
}

export interface BackgroundRemovalModelConfig {
  name: string
  info?: ModelInfo
  costTier?: CostTier
}

export const BG_REMOVAL_MODELS: Record<string, BackgroundRemovalModelConfig> = {
  'fal-ai/imageutils/rembg': { 
    name: 'Rembg (Basic)',
    costTier: 'low',
    info: {
      description: 'Remoción de fondo básica. Rápido y efectivo para la mayoría de casos.',
      tips: ['Rápido', 'Efectivo', 'Económico']
    }
  },
  'fal-ai/bria/background/remove': { 
    name: 'Bria RMBG 2.0 (Pro)',
    costTier: 'medium',
    info: {
      description: 'Bria RMBG 2.0 - Detección precisa de bordes y cabello. Profesional.',
      tips: ['Bordes precisos', 'Cabello/fino', 'Calidad pro']
    }
  },
  'pixelcut/background-removal': {
    name: 'Pixelcut Background Removal',
    costTier: 'medium',
    info: {
      description: 'Recorte de fondo de alta calidad para e-commerce y edición, con bordes limpios y sujetos complejos.',
      tips: ['Alta calidad', 'Buen detalle en bordes', 'Ideal para producto y retrato'],
      bestFor: ['E-commerce', 'Retratos', 'Recortes limpios para edición']
    }
  },
}

export type BgRemovalModelId = keyof typeof BG_REMOVAL_MODELS

export function getBgRemovalModelConfig(modelId: string): BackgroundRemovalModelConfig | undefined {
  return BG_REMOVAL_MODELS[modelId]
}

export const EDIT_MODELS = {
  'flux/dev/image-to-image': { name: 'Flux I2I', type: 'edit-image' as const },
  'upscaler': { name: 'Upscaler', type: 'upscale' as const },
  'rembg': { name: 'Remove BG', type: 'remove-background' as const },
} as const
