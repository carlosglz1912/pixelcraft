import {
  USD_TO_MXN_RATE,
  formatCostEstimate,
  formatCostEstimateMxn,
  type CostEstimate,
} from '@/lib/cost-estimate'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Info } from 'lucide-react'

type CostEstimatePreviewProps = {
  estimate: CostEstimate | null
  className?: string
  compact?: boolean
}

export function CostEstimatePreview({
  estimate,
  className,
  compact = false,
}: CostEstimatePreviewProps) {
  const classes = className ? ` ${className}` : ''

  if (!estimate) {
    if (compact) {
      return (
        <div className={`text-center${classes}`}>
          <span className="block text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Est.
          </span>
          <span className="block text-[0.7rem] font-semibold text-slate-400">N/D</span>
        </div>
      )
    }

    return (
      <div className={`rounded-2xl border border-border/60 bg-muted/35 p-3${classes}`}>
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Costo Estimado
        </p>
        <p className="mt-1 text-sm text-muted-foreground">No disponible para este modelo.</p>
      </div>
    )
  }

  if (compact) {
    return (
      <div className={`text-center${classes}`}>
        <span className="block text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Est.
        </span>
        <span className="block text-[0.72rem] font-semibold text-primary-tint">
          {formatCostEstimateMxn(estimate.amount)}
        </span>
      </div>
    )
  }

  return (
    <div className={`rounded-2xl border border-border/60 bg-muted/35 p-3${classes}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Costo Estimado
          </p>
          <p className="mt-1 text-lg font-semibold">{formatCostEstimateMxn(estimate.amount)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatCostEstimate(estimate.amount)} USD
          </p>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="rounded-full border border-border/60 bg-background/70 p-1.5 text-muted-foreground hover:text-foreground">
                <Info className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-[260px] space-y-2">
              <p className="font-semibold">fal</p>
              <p className="text-sm">{estimate.details}</p>
              {estimate.note ? (
                <p className="text-xs opacity-85">{estimate.note}</p>
              ) : null}
              <p className="text-xs opacity-75">
                Tipo de cambio de referencia: 1 USD ~= {formatCostEstimateMxn(1, USD_TO_MXN_RATE)}
              </p>
              <p className="text-xs opacity-75">Estimacion previa y conservadora; el cobro real puede variar.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  )
}
