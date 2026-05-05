'use client'

import { ChevronLeft, ChevronRight, Settings2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { motion } from '@/lib/motion'

interface SidebarHeaderProps {
  sidebarCollapsed: boolean
  onToggleCollapse: () => void
  /** When provided (mobile overlay mode), shows an X button instead of the collapse chevron. */
  onClose?: () => void
  /** Opens the model config dialog. */
  onOpenConfig?: () => void
}

export function SidebarHeader({ sidebarCollapsed, onToggleCollapse, onClose, onOpenConfig }: SidebarHeaderProps) {
  return (
    <div className="surface-secondary border-b border-secondary/25 px-3 py-3">
      <div className={`flex items-center ${sidebarCollapsed && !onClose ? 'justify-center' : 'justify-between'} gap-2`}>
        {(!sidebarCollapsed || onClose) ? (
          <motion.div layout className="flex items-center gap-2 min-w-0">
            <div>
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-secondary-tint">
                PixelCraft
              </p>
              <p className="mt-1 font-display text-3xl leading-none text-white">Studio</p>
            </div>
            {onOpenConfig && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onOpenConfig}
                className="depth-secondary ml-1 h-8 w-8 rounded-2xl border border-secondary/25 bg-secondary/10 text-secondary-tint hover:bg-secondary/15 hover:text-white active:scale-[0.98] transition-transform"
                aria-label="Configuración de modelos"
              >
                <Settings2 className="h-4 w-4" />
              </Button>
            )}
          </motion.div>
        ) : null}

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClose ?? onToggleCollapse}
          className={`depth-secondary rounded-2xl border border-secondary/25 bg-secondary/10 text-secondary-tint hover:bg-secondary/15 hover:text-white active:scale-[0.98] transition-transform ${onClose ? 'h-11 w-11' : 'h-10 w-10'}`}
        >
          {onClose ? (
            <X className="h-4 w-4" />
          ) : sidebarCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Collapsed desktop: gear icon below chevron */}
      {sidebarCollapsed && !onClose && onOpenConfig && (
        <div className="mt-2 flex justify-center">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onOpenConfig}
            className="depth-secondary h-8 w-8 rounded-2xl border border-secondary/25 bg-secondary/10 text-secondary-tint hover:bg-secondary/15 hover:text-white active:scale-[0.98] transition-transform"
            aria-label="Configuración de modelos"
          >
            <Settings2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  )
}
