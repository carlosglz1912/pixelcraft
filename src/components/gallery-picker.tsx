'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useGallery } from '@/stores/gallery'
import { getCostTierLabel, type CostTier, type GeneratedMedia } from '@/types'
import { Image as ImageIcon, Video, Check, Loader2 } from 'lucide-react'

type MediaTypeFilter = 'image' | 'video' | 'all'

interface GalleryPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (url: string, item: GeneratedMedia) => void
  mediaType?: MediaTypeFilter
  multiple?: boolean
  maxSelection?: number
  title?: string
}

const COST_TIER_COLORS: Record<CostTier, string> = {
  free: 'bg-green-500',
  low: 'bg-green-400',
  medium: 'bg-yellow-500',
  high: 'bg-orange-500',
  premium: 'bg-red-500',
}

export function GalleryPicker({
  open,
  onOpenChange,
  onSelect,
  mediaType = 'image',
  multiple = false,
  maxSelection = 1,
  title = 'Seleccionar de la galería',
}: GalleryPickerProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest')
  const items = useGallery((s) => s.items)

  const filteredItems = useMemo(() => {
    const filtered = items.filter((item) => {
      if (mediaType !== 'all' && item.type !== mediaType) return false
      if (item.url.startsWith('data:') || item.url.startsWith('blob:')) return false
      return true
    })

    filtered.sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    })

    return filtered
  }, [items, mediaType, sortBy])

  function toggleItem(item: GeneratedMedia) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(item.id)) {
        next.delete(item.id)
      } else if (multiple && next.size < maxSelection) {
        next.add(item.id)
      } else if (!multiple) {
        next.clear()
        next.add(item.id)
      }
      return next
    })
  }

  function handleConfirm() {
    const selectedItems = filteredItems.filter((item) => selectedIds.has(item.id))
    for (const item of selectedItems) {
      onSelect(item.url, item)
    }
    setSelectedIds(new Set())
    onOpenChange(false)
  }

  function handleClose() {
    setSelectedIds(new Set())
    onOpenChange(false)
  }

  const isOverLimit = multiple && selectedIds.size > maxSelection
  const canConfirm = selectedIds.size > 0 && !isOverLimit

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[80vh] bg-slate-950/95 border-secondary/25 text-white sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <ImageIcon className="h-5 w-5 text-primary-tint" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {multiple
              ? `Selecciona hasta ${maxSelection} elementos`
              : 'Selecciona un elemento de tu galería'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center gap-1 rounded-2xl border border-secondary/15 bg-secondary/10 px-1 py-0.5">
            <button
              type="button"
              onClick={() => setSortBy('newest')}
              className={`rounded-xl px-2.5 py-1 text-xs font-medium transition ${sortBy === 'newest' ? 'bg-primary/20 text-primary-tint' : 'text-secondary-tint hover:text-white'}`}
            >
              Recientes
            </button>
            <button
              type="button"
              onClick={() => setSortBy('oldest')}
              className={`rounded-xl px-2.5 py-1 text-xs font-medium transition ${sortBy === 'oldest' ? 'bg-primary/20 text-primary-tint' : 'text-secondary-tint hover:text-white'}`}
            >
              Antiguos
            </button>
          </div>
          <Badge variant="secondary" className="text-xs">
            {filteredItems.length} disponible{filteredItems.length !== 1 ? 's' : ''}
          </Badge>
          {selectedIds.size > 0 && (
            <Badge className="text-xs text-white bg-primary">
              {selectedIds.size} seleccionado{selectedIds.size !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <ImageIcon className="h-10 w-10 mb-3 opacity-50" />
            <p className="text-sm">No hay assets en tu galería</p>
            <p className="text-xs mt-1">Genera contenido primero para poder reutilizarlo</p>
          </div>
        ) : (
          <ScrollArea className="h-[50vh]">
            <div className="grid grid-cols-3 gap-3 pr-3">
              {filteredItems.map((item) => {
                const isSelected = selectedIds.has(item.id)
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleItem(item)}
                    className={`group relative aspect-square overflow-hidden rounded-xl border-2 transition ${
                      isSelected
                        ? 'border-primary ring-2 ring-primary/30'
                        : 'border-transparent hover:border-muted-foreground/30'
                    }`}
                  >
                    {item.type === 'video' ? (
                      <video
                        src={item.url}
                        className="absolute inset-0 h-full w-full object-cover"
                        muted
                        playsInline
                      />
                    ) : (
                      <Image
                        src={item.url}
                        alt={item.prompt}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

                    <div className="absolute bottom-0 left-0 right-0 p-2">
                      <p className="text-[0.65rem] text-white line-clamp-1">{item.prompt}</p>
                    </div>

                    {item.costTier && (
                      <div className="absolute top-1.5 left-1.5">
                        <span className={`inline-block rounded-full px-1.5 py-0.5 text-[0.55rem] text-white ${COST_TIER_COLORS[item.costTier]}`}>
                          {getCostTierLabel(item.costTier)}
                        </span>
                      </div>
                    )}

                    <div className="absolute top-1.5 right-1.5">
                      {item.type === 'video' ? (
                        <Video className="h-3.5 w-3.5 text-white drop-shadow" />
                      ) : null}
                    </div>

                    {isSelected && (
                      <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
                          <Check className="h-4 w-4 text-primary-foreground" />
                        </div>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t border-secondary/20">
          <Button variant="ghost" onClick={handleClose} className="text-secondary-tint">
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {selectedIds.size > 0
              ? `Usar ${selectedIds.size} elemento${selectedIds.size !== 1 ? 's' : ''}`
              : 'Seleccionar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
