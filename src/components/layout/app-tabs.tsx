'use client'

import { startTransition, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CostEstimatePreview } from '@/components/cost-estimate-preview'
import { Gallery } from '@/components/features/gallery'
import { GalleryPicker } from '@/components/gallery-picker'
import { R2Manager } from '@/components/features/r2-manager'
import { useGallery } from '@/stores/gallery'
import type { StudioMode, MainTab } from '@/lib/studio-types'
import { useImageStudio } from '@/hooks/use-image-studio'
import { useVideoStudio } from '@/hooks/use-video-studio'
import { ImageStudioPanel } from '@/components/layout/image-studio-panel'
import { VideoStudioPanel } from '@/components/layout/video-studio-panel'

export function AppTabs() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [studioMode, setStudioMode] = useState<StudioMode>('image')
  const [mainTab, setMainTab] = useState<MainTab>('gallery')

  const addToGallery = useGallery((state) => state.addWithPersistence)
  const addPending = useGallery((state) => state.addPending)
  const removePending = useGallery((state) => state.removePending)

  const [loading, setLoading] = useState(false)

  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerTarget, setPickerTarget] = useState<{ setter: (url: string) => void; mediaType: 'image' | 'video' } | null>(null)

  const imageStudio = useImageStudio({
    addToGallery,
    addPending,
    removePending,
    setLoading,
    openPicker: (setter, mediaType) => {
      setPickerTarget({ setter, mediaType })
      setPickerOpen(true)
    },
    openMultiPicker: () => {}, // Handled internally by the hook
  })

  const videoStudio = useVideoStudio({
    addToGallery,
    addPending,
    removePending: (id: string) => removePending([id]),
    setLoading,
    openPicker: (setter, mediaType) => {
      setPickerTarget({ setter, mediaType })
      setPickerOpen(true)
    },
  })

  const activeEstimate = studioMode === 'image' ? imageStudio.imageEstimate : videoStudio.videoEstimate

  const layoutClass = sidebarCollapsed
    ? 'grid-cols-[84px_minmax(0,1fr)]'
    : 'grid-cols-[18.5rem_minmax(0,1fr)] min-[1440px]:grid-cols-[20rem_minmax(0,1fr)] min-[1680px]:grid-cols-[22rem_minmax(0,1fr)] min-[1920px]:grid-cols-[24rem_minmax(0,1fr)]'

  const mainActionLabel =
    studioMode === 'image' 
      ? (loading ? 'Generando...' : 'Generar') 
      : videoStudio.isAuroraModel 
        ? (loading ? 'Generando avatar...' : 'Generar Avatar')
        : (loading ? 'Generando...' : 'Renderizar Video')

  return (
    <>
    <div className={`grid min-h-screen ${layoutClass}`}>
      <aside className="depth-secondary relative h-screen border-r border-secondary/30 bg-slate-950/96">
        <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-secondary/0 via-secondary/80 to-secondary/0" />

        <div className="flex h-full flex-col">
          <div className="surface-secondary border-b border-secondary/25 px-3 py-3">
            <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} gap-2`}>
              {!sidebarCollapsed ? (
                <div>
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-secondary-tint">
                    PixelCraft
                  </p>
                  <p className="mt-1 font-display text-3xl leading-none text-white">Studio</p>
                </div>
              ) : null}

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setSidebarCollapsed((current) => !current)}
                className="depth-secondary h-10 w-10 rounded-2xl border border-secondary/25 bg-secondary/10 text-secondary-tint hover:bg-secondary/15 hover:text-white"
              >
                {sidebarCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="border-b border-secondary/20 p-3">
            <div className={`grid gap-2 ${sidebarCollapsed ? 'grid-cols-1' : 'grid-cols-2'}`}>
               <button
                 type="button"
                 onClick={() => {
                   startTransition(() => {
                     setStudioMode('image')
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
                     setStudioMode('video')
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

          {sidebarCollapsed ? (
            <div className="flex flex-1 flex-col items-center justify-between px-3 py-4">
              <div className="flex flex-col gap-3">
                <div className="depth-primary flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary-tint">
                  {studioMode === 'image' ? (
                    <Sparkles className="h-4 w-4" />
                  ) : (
                    <Clapperboard className="h-4 w-4" />
                  )}
                </div>
              </div>

              <div className="flex flex-col items-center gap-3">
                <CostEstimatePreview estimate={activeEstimate} compact />
                <Button
                  onClick={studioMode === 'image' ? imageStudio.handleGenerateImage : videoStudio.handleGenerateVideo}
                  disabled={
                    loading ||
                    (studioMode === 'image'
                      ? !imageStudio.prompt.trim()
                      : videoStudio.isAuroraModel
                        ? !videoStudio.videoSource || !videoStudio.videoAudioUrl
                        : (videoStudio.requiresVideoSource && !videoStudio.videoSource) || !videoStudio.hasVideoPromptInput)
                  }
                  className="depth-primary h-11 w-11 rounded-2xl border border-primary/30 bg-primary/90 p-0 text-primary-foreground hover:bg-primary"
                >
                  {studioMode === 'image' ? (
                    <Sparkles className="h-4 w-4" />
                  ) : (
                    <Clapperboard className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <ScrollArea className="min-h-0 flex-1">
                <div className="space-y-4 p-4">
                  {studioMode === 'image' ? (
                    <ImageStudioPanel {...imageStudio} />
                  ) : (
                    <VideoStudioPanel {...videoStudio} />
                  )}
                </div>
              </ScrollArea>

              <div className="surface-primary border-t border-primary/20 p-4">
                <CostEstimatePreview
                  estimate={activeEstimate}
                  className="mb-3 border-primary/15 bg-slate-950/60"
                />
                <Button
                  onClick={studioMode === 'image' ? imageStudio.handleGenerateImage : videoStudio.handleGenerateVideo}
                  disabled={
                    loading ||
                    (studioMode === 'image'
                      ? !imageStudio.prompt.trim()
                      : videoStudio.isAuroraModel
                        ? !videoStudio.videoSource || !videoStudio.videoAudioUrl
                        : (videoStudio.requiresVideoSource && !videoStudio.videoSource) || !videoStudio.hasVideoPromptInput)
                  }
                  className="depth-primary h-12 w-full rounded-3xl border border-primary/30 bg-primary/90 text-primary-foreground hover:bg-primary"
                >
                  {studioMode === 'image' ? (
                    <Sparkles className="mr-2 h-4 w-4" />
                  ) : (
                    <Clapperboard className="mr-2 h-4 w-4" />
                  )}
                  {mainActionLabel}
                </Button>
              </div>
            </>
          )}
        </div>
      </aside>

      <section className="depth-mixed relative min-w-0 bg-slate-950/72">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-primary/0 via-primary/65 to-secondary/65" />
        
        {mainTab === 'gallery' ? <Gallery onSwitchTab={setMainTab} /> : <R2Manager onSwitchTab={setMainTab} />}
      </section>
    </div>
    <GalleryPicker
      open={pickerOpen}
      onOpenChange={setPickerOpen}
      mediaType={pickerTarget?.mediaType ?? 'image'}
      onSelect={(url) => {
        if (pickerTarget) pickerTarget.setter(url)
      }}
    />
    <GalleryPicker
      open={imageStudio.multiPickerOpen}
      onOpenChange={imageStudio.setMultiPickerOpen}
      mediaType="image"
      multiple
      maxSelection={imageStudio.multiPickerTarget ? imageStudio.multiPickerTarget.max - imageStudio.multiPickerTarget.current.length : 3}
      onSelect={(url, _item) => {
        if (imageStudio.multiPickerTarget) {
          const remaining = imageStudio.multiPickerTarget.max - imageStudio.multiPickerTarget.current.length
          if (remaining <= 0) {
            toast.error(`Máximo ${imageStudio.multiPickerTarget.max} referencias`)
            return
          }
          imageStudio.multiPickerTarget.setter([...imageStudio.multiPickerTarget.current, url].slice(0, imageStudio.multiPickerTarget.max))
        }
      }}
    />
    </>
  )
}
