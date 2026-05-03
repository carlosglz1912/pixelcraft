'use client'

import { useState } from 'react'
import { Clapperboard, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Gallery } from '@/components/features/gallery'
import { GalleryPicker } from '@/components/gallery-picker'
import { R2Manager } from '@/components/features/r2-manager'
import { useGallery } from '@/stores/gallery'
import type { StudioMode, MainTab } from '@/lib/studio-types'
import { useImageStudio } from '@/hooks/use-image-studio'
import { useVideoStudio } from '@/hooks/use-video-studio'
import { ImageStudioPanel } from '@/components/layout/image-studio-panel'
import { VideoStudioPanel } from '@/components/layout/video-studio-panel'
import { SidebarHeader } from '@/components/layout/sidebar-header'
import { StudioModeSelector } from '@/components/layout/studio-mode-selector'
import { SidebarFooterExpanded, SidebarFooterCollapsed } from '@/components/layout/sidebar-footer'
import { LayoutGroup, motion, AnimatePresence } from '@/lib/motion'
import { SIDEBAR_SPRING, SIDEBAR_EXIT_VARIANTS, layoutGroupId } from '@/lib/motion'

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

  const openPicker = (setter: (url: string) => void, mediaType: 'image' | 'video') => {
    setPickerTarget({ setter, mediaType })
    setPickerOpen(true)
  }

  const imageStudio = useImageStudio({
    addToGallery,
    addPending,
    removePending,
    setLoading,
    openPicker,
    openMultiPicker: () => {},
  })

  const videoStudio = useVideoStudio({
    addToGallery,
    addPending,
    removePending: (id: string) => removePending([id]),
    setLoading,
    openPicker,
  })

  // Derived values
  const layoutClass = sidebarCollapsed
    ? 'grid-cols-[84px_minmax(0,1fr)]'
    : 'grid-cols-[18.5rem_minmax(0,1fr)] min-[1440px]:grid-cols-[20rem_minmax(0,1fr)] min-[1680px]:grid-cols-[22rem_minmax(0,1fr)] min-[1920px]:grid-cols-[24rem_minmax(0,1fr)]'

  const activeEstimate = studioMode === 'image' ? imageStudio.imageEstimate : videoStudio.videoEstimate

  const mainActionLabel =
    studioMode === 'image'
      ? (loading ? 'Generando...' : 'Generar')
      : videoStudio.isAuroraModel
        ? (loading ? 'Generando avatar...' : 'Generar Avatar')
        : (loading ? 'Generando...' : 'Renderizar Video')

  const onGenerate = studioMode === 'image' ? imageStudio.handleGenerateImage : videoStudio.handleGenerateVideo

  const generateDisabled =
    loading ||
    (studioMode === 'image'
      ? !imageStudio.prompt.trim()
      : videoStudio.isAuroraModel
        ? !videoStudio.videoSource || !videoStudio.videoAudioUrl
        : (videoStudio.requiresVideoSource && !videoStudio.videoSource) || !videoStudio.hasVideoPromptInput)

  const footerProps = {
    studioMode,
    loading,
    disabled: generateDisabled,
    onGenerate,
    estimate: activeEstimate,
    actionLabel: mainActionLabel,
  }

  return (
    <>
    <LayoutGroup id={layoutGroupId}>
      <div className={`grid min-h-screen ${layoutClass}`}>
        <motion.aside layout transition={{ ...SIDEBAR_SPRING }} className="depth-secondary relative h-screen border-r border-secondary/30 bg-slate-950/96">
          <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-secondary/0 via-secondary/80 to-secondary/0" />
          <div className="flex h-full flex-col">
            <SidebarHeader
              sidebarCollapsed={sidebarCollapsed}
              onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
            />
            <StudioModeSelector
              studioMode={studioMode}
              onModeChange={setStudioMode}
              sidebarCollapsed={sidebarCollapsed}
            />

            <AnimatePresence mode="wait">
              {sidebarCollapsed ? (
                <motion.div
                  key="collapsed"
                  variants={SIDEBAR_EXIT_VARIANTS}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit="exit"
                  className="flex flex-1 flex-col items-center justify-between px-3 py-4"
                >
                  <div className="flex flex-col gap-3">
                    <div className="depth-primary flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary-tint">
                      {studioMode === 'image' ? <Sparkles className="h-4 w-4" /> : <Clapperboard className="h-4 w-4" />}
                    </div>
                  </div>
                  <SidebarFooterCollapsed {...footerProps} />
                </motion.div>
              ) : (
                <motion.div
                  key="expanded"
                  variants={SIDEBAR_EXIT_VARIANTS}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit="exit"
                  className="flex flex-1 flex-col"
                >
                  <ScrollArea className="min-h-0 flex-1">
                    <div className="space-y-4 p-4">
                      {studioMode === 'image' ? (
                        <ImageStudioPanel {...imageStudio} />
                      ) : (
                        <VideoStudioPanel {...videoStudio} />
                      )}
                    </div>
                  </ScrollArea>
                  <SidebarFooterExpanded {...footerProps} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.aside>

        <section className="depth-mixed relative min-w-0 bg-slate-950/72">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-primary/0 via-primary/65 to-secondary/65" />
          {mainTab === 'gallery' ? <Gallery onSwitchTab={setMainTab} /> : <R2Manager onSwitchTab={setMainTab} />}
        </section>
      </div>
    </LayoutGroup>

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
