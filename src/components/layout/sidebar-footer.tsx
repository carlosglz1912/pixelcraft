'use client'

import { Clapperboard, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CostEstimatePreview } from '@/components/cost-estimate-preview'
import type { StudioMode } from '@/lib/studio-types'
import type { CostEstimate } from '@/lib/cost-estimate'

interface SidebarFooterBaseProps {
  studioMode: StudioMode
  loading: boolean
  disabled: boolean
  onGenerate: () => void
  estimate: CostEstimate | null
  actionLabel: string
}

export function SidebarFooterExpanded({
  studioMode,
  loading,
  disabled,
  onGenerate,
  estimate,
  actionLabel,
}: SidebarFooterBaseProps) {
  return (
    <div className="surface-primary border-t border-primary/20 p-4">
      <CostEstimatePreview
        estimate={estimate}
        className="mb-3 border-primary/15 bg-slate-950/60"
      />
      <Button
        onClick={onGenerate}
        disabled={disabled}
        className="depth-primary h-12 w-full rounded-3xl border border-primary/30 bg-primary/90 text-primary-foreground hover:bg-primary"
      >
        {studioMode === 'image' ? (
          <Sparkles className="mr-2 h-4 w-4" />
        ) : (
          <Clapperboard className="mr-2 h-4 w-4" />
        )}
        {actionLabel}
      </Button>
    </div>
  )
}

export function SidebarFooterCollapsed({
  studioMode,
  loading,
  disabled,
  onGenerate,
  estimate,
}: SidebarFooterBaseProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      <CostEstimatePreview estimate={estimate} compact />
      <Button
        onClick={onGenerate}
        disabled={disabled}
        className="depth-primary h-11 w-11 rounded-2xl border border-primary/30 bg-primary/90 p-0 text-primary-foreground hover:bg-primary"
      >
        {studioMode === 'image' ? (
          <Sparkles className="h-4 w-4" />
        ) : (
          <Clapperboard className="h-4 w-4" />
        )}
      </Button>
    </div>
  )
}
