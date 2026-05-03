'use client'

import { useState, useEffect, useCallback } from 'react'
import { Clapperboard, Sparkles, Menu } from 'lucide-react'
import { toast } from 'sonner'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Gallery } from '@/components/features/gallery'
import { GalleryPicker } from '@/components/gallery-picker'
import { R2Manager } from '@/components/features/r2-manager'
import { Collections } from '@/components/features/collections'
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
import { Dialog, DialogContent, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog'
import { useMediaQuery } from '@/hooks/use-media-query'

export function AppTabs() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [studioMode, setStudioMode] = useState<StudioMode>('image')
  const [mainTab, setMainTab] = useState<MainTab>('gallery')
  const [sidebarOverlayOpen, setSidebarOverlayOpen] = useState(false)

  // Responsive breakpoints — default to false for SSR hydration consistency
  // Each hook must be called unconditionally to satisfy Rules of Hooks
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const isMobile = !useMediaQuery('(min-width: 640px)')
  const isTablet = !isMobile && !isDesktop

  // Sync responsive state on viewport changes
  useEffect(() => {
    if (isMobile) {
      // Close overlay when switching away from mobile
      setSidebarOverlayOpen(false)
    }
  }, [isMobile])

  useEffect(() => {
    if (isTablet) {
      setSidebarCollapsed(true)
    }
  }, [isTablet])

  const closeOverlay = useCallback(() => setSidebarOverlayOpen(false), [])

  const addToGallery = useGallery((state) => state.addWithPersistence)
  const addPending = useGallery((state) => state.addPending)
  const removePending = useGallery((state) => state.removePending)
  const markPendingFailed = useGallery((state) => state.markPendingFailed)

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
    markPendingFailed,
    setLoading,
    openPicker,
    openMultiPicker: () => {},
  })

  const videoStudio = useVideoStudio({
    addToGallery,
    addPending,
    removePending: (id: string) => removePending([id]),
    markPendingFailed,
    setLoading,
    openPicker,
  })

  // Responsive layout class
  const layoutClass = isMobile
    ? 'grid-cols-[minmax(0,1fr)]'
    : (isTablet || sidebarCollapsed)
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

  // Shared sidebar content — rendered inline (desktop/tablet) or in overlay drawer (mobile)
  const sidebarContent = (
    <>
      <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-secondary/0 via-secondary/80 to-secondary/0" />
      <div className="flex min-h-0 h-full flex-col">
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
              className="flex min-h-0 flex-1 flex-col"
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
    </>
  )

  return (
    <>
    <LayoutGroup id={layoutGroupId}>
      <div className={`grid min-h-screen ${layoutClass}`}>
        {/* Inline sidebar — hidden on mobile (rendered as overlay drawer instead) */}
        {!isMobile && (
          <motion.aside layout transition={{ ...SIDEBAR_SPRING }} className="depth-secondary relative h-screen h-[100dvh] overflow-hidden border-r border-secondary/30 bg-slate-950/96">
            {sidebarContent}
          </motion.aside>
        )}

        <section className="depth-mixed relative min-w-0 bg-slate-950/72">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-primary/0 via-primary/65 to-secondary/65" />
          {/* Mobile hamburger button — 44px touch target, top-left corner */}
          {isMobile && (
            <button
              type="button"
              onClick={() => setSidebarOverlayOpen(true)}
              aria-label="Abrir panel del studio"
              className="absolute left-3 top-3 z-30 flex h-11 w-11 items-center justify-center rounded-2xl border border-secondary/25 bg-slate-950/90 text-secondary-tint backdrop-blur-sm transition-colors hover:bg-secondary/15 hover:text-white sm:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
          {mainTab === 'gallery' ? <Gallery onSwitchTab={setMainTab} /> : mainTab === 'collections' ? <Collections onSwitchTab={setMainTab} /> : <R2Manager onSwitchTab={setMainTab} />}
        </section>
      </div>
    </LayoutGroup>

      {/* Mobile sidebar overlay drawer */}
      {isMobile && (
        <Dialog open={sidebarOverlayOpen} onOpenChange={setSidebarOverlayOpen}>
          <DialogPortal>
            <DialogOverlay className="bg-black/60 backdrop-blur-sm" />
            <DialogContent
              showCloseButton={false}
              className="fixed inset-y-0 left-0 z-50 flex w-[18.5rem] translate-x-0 translate-y-0 flex-col rounded-none border-r border-secondary/30 bg-slate-950/96 p-0 shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-none"
              aria-describedby={undefined}
            >
              <DialogTitle className="sr-only">Panel del Studio</DialogTitle>
              <div className="relative flex h-full flex-col">
                <SidebarHeader
                  sidebarCollapsed={false}
                  onToggleCollapse={() => {}}
                  onClose={closeOverlay}
                />
                <StudioModeSelector
                  studioMode={studioMode}
                  onModeChange={setStudioMode}
                  sidebarCollapsed={false}
                />
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
              </div>
            </DialogContent>
          </DialogPortal>
        </Dialog>
      )}

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
