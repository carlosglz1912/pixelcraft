'use client'

import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { motion } from '@/lib/motion'

interface SidebarHeaderProps {
  sidebarCollapsed: boolean
  onToggleCollapse: () => void
  /** When provided (mobile overlay mode), shows an X button instead of the collapse chevron. */
  onClose?: () => void
}

export function SidebarHeader({ sidebarCollapsed, onToggleCollapse, onClose }: SidebarHeaderProps) {
  return (
    <div className="surface-secondary border-b border-secondary/25 px-3 py-3">
      <div className={`flex items-center ${sidebarCollapsed && !onClose ? 'justify-center' : 'justify-between'} gap-2`}>
        {(!sidebarCollapsed || onClose) ? (
          <motion.div layout>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-secondary-tint">
              PixelCraft
            </p>
            <p className="mt-1 font-display text-3xl leading-none text-white">Studio</p>
          </motion.div>
        ) : null}

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClose ?? onToggleCollapse}
          className="depth-secondary h-10 w-10 rounded-2xl border border-secondary/25 bg-secondary/10 text-secondary-tint hover:bg-secondary/15 hover:text-white"
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
    </div>
  )
}
