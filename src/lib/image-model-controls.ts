export interface ImageControlOption {
  value: string
  label: string
}

export const LEGACY_IMAGE_SIZE_OPTIONS: readonly ImageControlOption[] = [
  { value: 'square_hd', label: 'Square HD (1080x1080)' },
  { value: 'square', label: 'Square (1024x1024)' },
  { value: 'landscape_4_3', label: 'Landscape 4:3' },
  { value: 'landscape_16_9', label: 'Landscape 16:9' },
  { value: 'portrait_4_3', label: 'Portrait 4:3' },
  { value: 'portrait_16_9', label: 'Portrait 16:9' },
] as const

export const OPENAI_IMAGE_SIZE_OPTIONS: readonly ImageControlOption[] = [
  { value: '1024x1024', label: 'Square (1024x1024)' },
  { value: '1536x1024', label: 'Landscape (1536x1024)' },
  { value: '1024x1536', label: 'Portrait (1024x1536)' },
] as const

const NANO_BANANA_RATIO_OPTIONS: readonly ImageControlOption[] = [
  { value: '21:9', label: '21:9' },
  { value: '16:9', label: '16:9' },
  { value: '3:2', label: '3:2' },
  { value: '4:3', label: '4:3' },
  { value: '5:4', label: '5:4' },
  { value: '1:1', label: '1:1' },
  { value: '4:5', label: '4:5' },
  { value: '3:4', label: '3:4' },
  { value: '2:3', label: '2:3' },
  { value: '9:16', label: '9:16' },
] as const

const NANO_BANANA_2_RATIO_OPTIONS: readonly ImageControlOption[] = [
  { value: 'auto', label: 'Auto' },
  ...NANO_BANANA_RATIO_OPTIONS,
] as const

const BRIA_RATIO_OPTIONS: readonly ImageControlOption[] = [
  { value: '1:1', label: '1:1' },
  { value: '2:3', label: '2:3' },
  { value: '3:2', label: '3:2' },
  { value: '3:4', label: '3:4' },
  { value: '4:3', label: '4:3' },
  { value: '4:5', label: '4:5' },
  { value: '5:4', label: '5:4' },
  { value: '9:16', label: '9:16' },
  { value: '16:9', label: '16:9' },
] as const

const NANO_BANANA_2_RESOLUTION_OPTIONS: readonly ImageControlOption[] = [
  { value: '0.5K', label: '0.5K (512px)' },
  { value: '1K', label: '1K' },
  { value: '2K', label: '2K' },
  { value: '4K', label: '4K' },
] as const

const BRIA_RESOLUTION_OPTIONS: readonly ImageControlOption[] = [
  { value: '1MP', label: '1 MP' },
  { value: '4MP', label: '4 MP' },
] as const

export const IMAGE_OUTPUT_FORMAT_OPTIONS: readonly ImageControlOption[] = [
  { value: 'png', label: 'PNG' },
  { value: 'jpeg', label: 'JPEG' },
  { value: 'webp', label: 'WebP' },
] as const

export const IMAGE_QUALITY_OPTIONS: readonly ImageControlOption[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
] as const

export const IMAGE_BACKGROUND_OPTIONS: readonly ImageControlOption[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'transparent', label: 'Transparent' },
  { value: 'opaque', label: 'Opaque' },
] as const

export function getImageSizeOptions(model: string): readonly ImageControlOption[] {
  if (model === 'gpt-image-1.5') {
    return OPENAI_IMAGE_SIZE_OPTIONS
  }

  return LEGACY_IMAGE_SIZE_OPTIONS
}

export function getImageAspectRatioOptions(model: string): readonly ImageControlOption[] {
  if (model === 'nano-banana-2') {
    return NANO_BANANA_2_RATIO_OPTIONS
  }

  if (model === 'nano-banana') {
    return NANO_BANANA_RATIO_OPTIONS
  }

  if (model === 'bria/fibo/generate') {
    return BRIA_RATIO_OPTIONS
  }

  return []
}

export function getImageResolutionOptions(model: string): readonly ImageControlOption[] {
  if (model === 'nano-banana-2') {
    return NANO_BANANA_2_RESOLUTION_OPTIONS
  }

  if (model === 'bria/fibo/generate') {
    return BRIA_RESOLUTION_OPTIONS
  }

  return []
}

export function getDefaultImageSize(model: string): string {
  return getImageSizeOptions(model)[0]?.value ?? 'square_hd'
}

export function getDefaultImageAspectRatio(model: string): string {
  return getImageAspectRatioOptions(model)[0]?.value ?? '1:1'
}

export function getDefaultImageResolution(model: string): string {
  return getImageResolutionOptions(model)[0]?.value ?? '1K'
}
