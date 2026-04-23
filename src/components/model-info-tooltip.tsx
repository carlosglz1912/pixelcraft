'use client'

import { Info, Zap, Target, Coins } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { getCostTierLabel, type CostTier, type ModelInfo } from '@/types'

const COST_TIER_CONFIG: Record<CostTier, { label: string; color: string }> = {
  free: { label: 'Gratis', color: 'bg-green-500' },
  low: { label: '$', color: 'bg-green-400' },
  medium: { label: '$$', color: 'bg-yellow-500' },
  high: { label: '$$$', color: 'bg-orange-500' },
  premium: { label: '$$$$', color: 'bg-red-500' },
}

interface ModelInfoTooltipProps {
  info?: ModelInfo
  costTier?: CostTier
  modelName: string
}

export function ModelInfoTooltip({ info, costTier, modelName }: ModelInfoTooltipProps) {
  if (!info && !costTier) return null

  const costLabel = getCostTierLabel(costTier)
  const costConfig = costTier ? COST_TIER_CONFIG[costTier] : null

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
          <Info className="h-4 w-4" />
          {costConfig && (
            <Badge variant="secondary" className={`text-xs text-white ${costConfig.color}`}>
              {costConfig.label}
            </Badge>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-80 p-3 text-left">
        <div className="space-y-2">
          <p className="font-medium">{modelName}</p>
          {info?.description && (
            <p className="text-xs text-muted-foreground">{info.description}</p>
          )}
          {info?.tips && info.tips.length > 0 && (
            <div className="space-y-1">
              <p className="flex items-center gap-1 text-xs font-medium">
                <Zap className="h-3 w-3" /> Tips
              </p>
              <ul className="space-y-0.5 pl-4 text-xs text-muted-foreground">
                {info.tips.map((tip, i) => (
                  <li key={i}>• {tip}</li>
                ))}
              </ul>
            </div>
          )}
          {info?.bestFor && info.bestFor.length > 0 && (
            <div className="space-y-1">
              <p className="flex items-center gap-1 text-xs font-medium">
                <Target className="h-3 w-3" /> Ideal para
              </p>
              <div className="flex flex-wrap gap-1">
                {info.bestFor.map((use, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {use}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {costConfig && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Coins className="h-3 w-3" /> Costo: {costLabel}
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
