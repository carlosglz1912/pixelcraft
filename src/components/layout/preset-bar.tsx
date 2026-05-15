'use client'

import { useModelConfig } from '@/stores/model-config'

export function PresetBar() {
  const presets = useModelConfig((s) => s.presets)
  const activePreset = useModelConfig((s) => s.activePreset)
  const loadPreset = useModelConfig((s) => s.loadPreset)

  if (presets.length === 0) return null

  return (
    <div
      className="flex items-center gap-1.5 overflow-x-auto px-4 py-2 [&::-webkit-scrollbar]:hidden"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      {presets.map((preset) => {
        const isActive = activePreset === preset.name

        return (
          <button
            key={preset.name}
            onClick={() => loadPreset(preset.name)}
            className={`shrink-0 rounded-xl px-3 py-1 text-[11px] font-medium transition ${
              isActive
                ? 'depth-primary border border-primary/25 bg-primary/20 text-primary-tint'
                : 'depth-secondary border border-secondary/15 bg-secondary/10 text-secondary-tint hover:bg-secondary/15 hover:text-white'
            }`}
          >
            {preset.name}
          </button>
        )
      })}
    </div>
  )
}
