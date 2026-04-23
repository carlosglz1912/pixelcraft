export interface FalImage {
  url: string
  width?: number
  height?: number
  content_type?: string
}

export interface FalVideo {
  url: string
  content_type?: string
}

export interface FalImageOutput {
  images?: FalImage[]
  image?: FalImage
  seed?: number
  timings?: Record<string, number>
}

export interface FalVideoOutput {
  video?: FalVideo
  seed?: number
}

export type KlingVideoDuration =
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | '11'
  | '12'
  | '13'
  | '14'
  | '15'

export interface KlingV3MultiPromptElement {
  prompt: string
  duration?: KlingVideoDuration
}

export interface KlingV3ComboElementInput {
  frontal_image_url?: string
  reference_image_urls?: string[]
  video_url?: string
  voice_id?: string
}

export interface KlingV3VideoInput {
  prompt?: string
  multi_prompt?: KlingV3MultiPromptElement[] | null
  start_image_url: string
  duration?: KlingVideoDuration
  generate_audio?: boolean
  end_image_url?: string
  elements?: KlingV3ComboElementInput[]
  shot_type?: 'customize'
  negative_prompt?: string
  cfg_scale?: number
}

export interface Hailuo23VideoInput {
  prompt: string
  image_url: string
  prompt_optimizer?: boolean
}

export interface Seedance15VideoInput {
  prompt: string
  image_url?: string
  duration?: '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11' | '12'
  aspect_ratio?: string
  resolution?: '480p' | '720p' | '1080p'
  generate_audio?: boolean
  end_image_url?: string
}

export type VideoInput = KlingV3VideoInput | Hailuo23VideoInput | Seedance15VideoInput

export interface FalImageEditOutput {
  image?: FalImage
}
