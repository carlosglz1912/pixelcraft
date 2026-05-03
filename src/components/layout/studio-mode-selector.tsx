'use client'

import { startTransition } from 'react'
import { Clapperboard, Sparkles } from 'lucide-react'
import type { StudioMode } from '@/lib/studio-types'

interface StudioModeSelectorProps {
  studioMode: StudioMode
  onModeChange: (mode: StudioMode) => void
  sidebarCollapsed: boolean
}

export function StudioModeSelector({ studioMode, onModeChange, sidebarCollapsed }: StudioModeSelectorProps) {
  return (
    <div className="border-b border-secondary/20 p-3">
      <div className={`grid gap-2 ${sidebarCollapsed ? 'grid-cols-1' : 'grid-cols-2'}`}>
        <button
          type="button"
          onClick={() => {
            startTransition(() => {
              onModeChange('image')
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
              onModeChange('video')
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
  )
}
