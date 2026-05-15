'use client'

import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { GeneratedMedia } from '@/types'
import type { EditHistoryEntry } from '@/stores/gallery'
import {
  ImageIcon,
  Sparkles,
  Maximize2,
  Eraser,
  Clock,
  GitBranch,
} from 'lucide-react'

const OPERATION_CONFIG: Record<EditHistoryEntry['operation'], { label: string; icon: React.ElementType; color: string }> = {
  original: { label: 'Original', icon: ImageIcon, color: 'text-slate-300' },
  edit: { label: 'Edición', icon: Sparkles, color: 'text-primary-tint' },
  upscale: { label: 'Upscale', icon: Maximize2, color: 'text-blue-400' },
  'remove-bg': { label: 'Sin fondo', icon: Eraser, color: 'text-purple-400' },
}

interface EditHistoryProps {
  history: EditHistoryEntry[]
  currentItemId: string
  onSelectItem: (item: GeneratedMedia) => void
}

export function EditHistory({ history, currentItemId, onSelectItem }: EditHistoryProps) {
  if (history.length <= 1) return null

  return (
    <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70">
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <GitBranch className="h-4 w-4 text-primary-tint" />
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-tint">
          Historial de cambios
        </p>
        <Badge variant="secondary" className="depth-secondary ml-auto border border-secondary/20 bg-secondary/10 text-secondary-tint">
          {history.length} versiones
        </Badge>
      </div>

      <ScrollArea className="max-h-[280px]">
        <div className="space-y-0 px-4 pb-4">
          {history.map((entry, index) => {
            const config = OPERATION_CONFIG[entry.operation]
            const Icon = config.icon
            const isCurrent = entry.item.id === currentItemId
            const isLast = index === history.length - 1

            return (
              <div key={entry.item.id} className="relative">
                <button
                  type="button"
                  onClick={() => onSelectItem(entry.item)}
                  className={`group flex w-full items-start gap-3 rounded-2xl border p-2.5 text-left transition ${
                    isCurrent
                      ? 'depth-primary border-primary/30 bg-primary/10'
                      : 'depth-secondary border-transparent hover:border-secondary/15 hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex flex-col items-center gap-1">
                    <div className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border ${
                      isCurrent ? 'border-primary/30' : 'border-secondary/15'
                    }`}>
                      <Image
                        src={entry.item.url}
                        alt={entry.item.prompt}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                    {!isLast && (
                      <div className="h-3 w-px bg-secondary/20" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1 py-0.5">
                    <div className="flex items-center gap-1.5">
                      <Icon className={`h-3.5 w-3.5 ${config.color}`} />
                      <span className="text-xs font-semibold text-white">{config.label}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-300">{entry.item.prompt}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="flex items-center gap-1 text-[10px] text-slate-500">
                        <Clock className="h-2.5 w-2.5" />
                        {new Date(entry.item.createdAt).toLocaleString('es-MX', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {entry.item.model && entry.item.model !== 'upload' && (
                        <span className="truncate text-[10px] text-slate-500">
                          {entry.item.model.replace(/^fal-ai\//, '')}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}
