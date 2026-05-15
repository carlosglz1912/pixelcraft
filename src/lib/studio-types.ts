/**
 * Shared types and constants for the studio UI.
 * This module has zero React dependencies — pure TypeScript types and constants.
 */

export type StudioMode = 'image' | 'video'
export type MainTab = 'gallery' | 'storage' | 'collections'

export const RECRAFT_STYLES = [
  { value: 'realistic_image', label: 'Realistic' },
  { value: 'digital_illustration', label: 'Digital Illustration' },
  { value: 'vector_illustration', label: 'Vector Illustration' },
  { value: 'icon', label: 'Icon' },
] as const

export const VIDEO_RATIOS = [
  { value: '16:9', label: '16:9', frameClass: 'h-5 w-9' },
  { value: '9:16', label: '9:16', frameClass: 'h-9 w-5' },
  { value: '1:1', label: '1:1', frameClass: 'h-7 w-7' },
] as const

export type KlingElementDraftType = 'image' | 'video'

export type KlingMultiPromptDraft = {
  id: string
  prompt: string
  duration: string
}

export type KlingElementDraft = {
  id: string
  type: KlingElementDraftType
  frontalImageUrl: string
  referenceImageUrls: string[]
  videoUrl: string
  voiceId: string
}

export type RatioCardProps = {
  active: boolean
  frameClass: string
  label: string
  onClick: () => void
}
