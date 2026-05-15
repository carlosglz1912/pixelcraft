'use client'

/**
 * Shared pure helpers and small UI components for the studio.
 * Uses .tsx because RatioCard renders JSX.
 */

import type { RatioCardProps } from '@/lib/studio-types'
import { VIDEO_RATIOS } from '@/lib/studio-types'

export function getVideoRatioCard(value: string) {
  if (value === '16:9') return VIDEO_RATIOS[0]
  if (value === '9:16') return VIDEO_RATIOS[1]
  if (value === '1:1') return VIDEO_RATIOS[2]
  return {
    value,
    label: value === 'auto' ? 'Auto' : value,
    frameClass: 'h-7 w-7',
  }
}

export function getResolutionLabel(value: string) {
  if (value === 'auto') return 'Auto'
  if (value === '4k') return '4K'
  return value
}

export function getImageSizeCard(value: string, label: string) {
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

export function getImageAspectRatioCard(value: string) {
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

export function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function getImageStepSettings(model: string) {
  if (model === 'flux/schnell') {
    return { min: 1, max: 4, defaultValue: 4 }
  }

  return { min: 1, max: 50, defaultValue: 20 }
}

export function RatioCard({ active, frameClass, label, onClick }: RatioCardProps) {
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
