'use client'

import Image from 'next/image'
import {
  ChevronRight,
  Clapperboard,
  Image as ImageIcon,
  ImagePlus,
  Music,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  VIDEO_MODEL_FAMILIES,
  getCostTierLabel,
} from '@/types'
import {
  getVideoRatioCard,
  getResolutionLabel,
  RatioCard,
} from '@/lib/studio-helpers'
import type {
  KlingElementDraftType,
  KlingMultiPromptDraft,
  KlingElementDraft,
} from '@/lib/studio-types'
import type { VideoGenerationMode } from '@/types'

export interface VideoStudioPanelProps {
  // State
  videoSource: string
  videoPrompt: string
  videoNegativePrompt: string
  videoModel: string
  videoMode: string
  videoDuration: string
  videoAspectRatio: string
  videoResolution: string
  videoGenerateAudio: boolean
  videoCfgScale: number
  videoPromptOptimizer: boolean
  videoSeed: string
  videoAutoFix: boolean
  videoDeleteRemote: boolean
  videoQuality: string
  videoNumFrames: number
  videoFps: number
  videoSteps: number
  videoAcceleration: string
  videoPromptExpansion: boolean
  videoAudioUrl: string
  videoGuidanceScale: number
  videoAudioGuidanceScale: number
  videoUseMultiPrompt: boolean
  videoMultiPromptShots: KlingMultiPromptDraft[]
  videoElements: KlingElementDraft[]
  // Setters
  setVideoSource: (value: string) => void
  setVideoPrompt: (value: string) => void
  setVideoNegativePrompt: (value: string) => void
  setVideoModel: (value: string) => void
  setVideoMode: (value: VideoGenerationMode) => void
  setVideoDuration: (value: string) => void
  setVideoAspectRatio: (value: string) => void
  setVideoResolution: (value: string) => void
  setVideoGenerateAudio: React.Dispatch<React.SetStateAction<boolean>>
  setVideoCfgScale: (value: number) => void
  setVideoPromptOptimizer: React.Dispatch<React.SetStateAction<boolean>>
  setVideoSeed: (value: string) => void
  setVideoAutoFix: React.Dispatch<React.SetStateAction<boolean>>
  setVideoDeleteRemote: React.Dispatch<React.SetStateAction<boolean>>
  setVideoQuality: (value: string) => void
  setVideoNumFrames: (value: number) => void
  setVideoFps: (value: number) => void
  setVideoSteps: (value: number) => void
  setVideoAcceleration: (value: string) => void
  setVideoPromptExpansion: React.Dispatch<React.SetStateAction<boolean>>
  setVideoAudioUrl: (value: string) => void
  setVideoGuidanceScale: (value: number) => void
  setVideoAudioGuidanceScale: (value: number) => void
  setVideoUseMultiPrompt: React.Dispatch<React.SetStateAction<boolean>>
  // Derived flags
  supportsVideoDuration: boolean
  supportsVideoRatio: boolean
  supportsVideoResolution: boolean
  supportsVideoAudio: boolean
  supportsVideoNegative: boolean
  supportsVideoCfg: boolean
  supportsVideoOptimizer: boolean
  supportsVideoSeed: boolean
  supportsVideoAutoFix: boolean
  supportsVideoDelete: boolean
  supportsVideoQuality: boolean
  supportsVideoFrames: boolean
  supportsVideoFps: boolean
  supportsVideoStepsExtra: boolean
  supportsVideoAcceleration: boolean
  supportsVideoPromptExpansion: boolean
  supportsVideoGuidanceScale: boolean
  supportsVideoAudioGuidanceScale: boolean
  supportsVideoMultiPrompt: boolean
  supportsVideoElements: boolean
  isAuroraModel: boolean
  videoModeOptions: readonly VideoGenerationMode[]
  videoDurationOptions: readonly string[]
  videoAspectRatioOptions: readonly string[]
  videoResolutionOptions: readonly string[]
  requiresVideoSource: boolean
  isUsingVideoMultiPrompt: boolean
  videoMultiPromptDuration: number
  // Handlers
  handleVideoFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleVideoAudioFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleVideoElementImageChange: (e: React.ChangeEvent<HTMLInputElement>, elementId: string, field: 'frontalImageUrl') => void
  handleVideoElementReferenceChange: (e: React.ChangeEvent<HTMLInputElement>, elementId: string) => void
  handleVideoElementVideoChange: (e: React.ChangeEvent<HTMLInputElement>, elementId: string) => void
  updateVideoShot: (id: string, patch: Partial<Omit<KlingMultiPromptDraft, 'id'>>) => void
  removeVideoShot: (id: string) => void
  addVideoShot: () => void
  updateVideoElement: (id: string, patch: Partial<Omit<KlingElementDraft, 'id'>>) => void
  setVideoElementType: (id: string, type: KlingElementDraftType) => void
  addVideoElement: (type: KlingElementDraftType) => void
  removeVideoElement: (id: string) => void
  openVideoSourcePicker: () => void
}

export function VideoStudioPanel({
  videoSource,
  videoPrompt,
  videoNegativePrompt,
  videoModel,
  videoMode,
  videoDuration,
  videoAspectRatio,
  videoResolution,
  videoGenerateAudio,
  videoCfgScale,
  videoPromptOptimizer,
  videoSeed,
  videoAutoFix,
  videoDeleteRemote,
  videoQuality,
  videoNumFrames,
  videoFps,
  videoSteps,
  videoAcceleration,
  videoPromptExpansion,
  videoAudioUrl,
  videoGuidanceScale,
  videoAudioGuidanceScale,
  videoUseMultiPrompt,
  videoMultiPromptShots,
  videoElements,
  setVideoSource,
  setVideoPrompt,
  setVideoNegativePrompt,
  setVideoModel,
  setVideoMode,
  setVideoDuration,
  setVideoAspectRatio,
  setVideoResolution,
  setVideoGenerateAudio,
  setVideoCfgScale,
  setVideoPromptOptimizer,
  setVideoSeed,
  setVideoAutoFix,
  setVideoDeleteRemote,
  setVideoQuality,
  setVideoNumFrames,
  setVideoFps,
  setVideoSteps,
  setVideoAcceleration,
  setVideoPromptExpansion,
  setVideoAudioUrl,
  setVideoGuidanceScale,
  setVideoAudioGuidanceScale,
  setVideoUseMultiPrompt,
  supportsVideoDuration,
  supportsVideoRatio,
  supportsVideoResolution,
  supportsVideoAudio,
  supportsVideoNegative,
  supportsVideoCfg,
  supportsVideoOptimizer,
  supportsVideoSeed,
  supportsVideoAutoFix,
  supportsVideoDelete,
  supportsVideoQuality,
  supportsVideoFrames,
  supportsVideoFps,
  supportsVideoStepsExtra,
  supportsVideoAcceleration,
  supportsVideoPromptExpansion,
  supportsVideoGuidanceScale,
  supportsVideoAudioGuidanceScale,
  supportsVideoMultiPrompt,
  supportsVideoElements,
  isAuroraModel,
  videoModeOptions,
  videoDurationOptions,
  videoAspectRatioOptions,
  videoResolutionOptions,
  requiresVideoSource,
  isUsingVideoMultiPrompt,
  videoMultiPromptDuration,
  handleVideoFileChange,
  handleVideoAudioFileChange,
  handleVideoElementImageChange,
  handleVideoElementReferenceChange,
  handleVideoElementVideoChange,
  updateVideoShot,
  removeVideoShot,
  addVideoShot,
  updateVideoElement,
  setVideoElementType,
  addVideoElement,
  removeVideoElement,
  openVideoSourcePicker,
}: VideoStudioPanelProps) {
  if (isAuroraModel) {
    return (
      <>
        <div className="rounded-3xl border border-blue-500/30 bg-blue-500/8 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
            <h3 className="font-semibold text-sm text-blue-300">
              Aurora - Avatar Video
            </h3>
          </div>
          <p className="text-xs text-slate-400">
            Crea videos de alta fidelidad de tu avatar hablando o cantando. 
            Sincronización labial automática con el audio.
          </p>
        </div>

        <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
          <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
            Foto del Avatar
          </Label>
          {videoSource ? (
            <div className="depth-mixed mt-3 overflow-hidden rounded-3xl border border-secondary/20 bg-slate-950/80">
              <div className="relative aspect-video">
                <Image
                  src={videoSource}
                  alt="Avatar"
                  fill
                  className="object-cover"
                  unoptimized
                />
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="absolute right-3 top-3 h-8 w-8"
                  onClick={() => setVideoSource('')}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="depth-secondary flex cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-secondary/25 bg-slate-950/80 px-4 py-8 text-sm text-slate-300">
                <ImagePlus className="h-6 w-6 text-secondary-tint" />
                <span>Sube una foto</span>
                <span className="text-xs text-slate-500">Rostro visible, fondo claro</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleVideoFileChange}
                />
              </label>
              <button
                type="button"
                onClick={openVideoSourcePicker}
                className="depth-secondary flex cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-primary/25 bg-primary/5 px-4 py-8 text-sm text-primary/80 transition hover:border-primary/50 hover:bg-primary/10"
              >
                <ImageIcon className="h-6 w-6 text-primary/60" />
                <span>De la galería</span>
              </button>
            </div>
          )}
        </div>

        <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
          <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
            Audio (habla o canto)
          </Label>
          {videoAudioUrl ? (
            <div className="depth-mixed mt-3 rounded-2xl border border-secondary/20 bg-slate-950/80 p-3">
              <audio src={videoAudioUrl} controls className="w-full h-8" />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="mt-2 w-full"
                onClick={() => setVideoAudioUrl('')}
              >
                <X className="h-4 w-4 mr-1" />
                Cambiar audio
              </Button>
            </div>
          ) : (
            <label className="depth-secondary mt-3 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-secondary/25 bg-slate-950/80 px-4 py-6 text-sm text-slate-300">
              <Music className="h-6 w-6 text-secondary-tint" />
              <span>Sube un audio</span>
              <span className="text-xs text-slate-500">WAV, MP3, M4A</span>
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={handleVideoAudioFileChange}
              />
            </label>
          )}
        </div>

        <div className="depth-mixed rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
          <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
            Estilo del video (opcional)
          </Label>
          <Textarea
            className="mt-3 min-h-20 rounded-3xl border border-secondary/20 bg-slate-950/80 text-white shadow-none"
            placeholder="4K studio interview, soft lighting, professional backdrop..."
            value={videoPrompt}
            onChange={(e) => setVideoPrompt(e.target.value)}
          />
          <p className="mt-2 text-xs text-slate-500">
            Describe el estilo visual. La sincronización labial es automática.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="depth-secondary rounded-2xl border border-secondary/20 bg-slate-900/70 p-3">
            <Label className="text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-secondary-tint">
              Resolución
            </Label>
            <div className="mt-2 grid grid-cols-1 gap-1">
              {['480p', '720p'].map((res) => (
                <button
                  key={res}
                  type="button"
                  onClick={() => setVideoResolution(res)}
                  className={`rounded-xl border px-2 py-1.5 text-xs transition ${
                    videoResolution === res
                      ? 'depth-primary border-primary/35 bg-primary/10 text-white'
                      : 'border-secondary/15 bg-slate-950/70 text-slate-300'
                  }`}
                >
                  {res}
                </button>
              ))}
            </div>
          </div>

          <div className="depth-secondary rounded-2xl border border-secondary/20 bg-slate-900/70 p-3">
            <div className="flex items-center justify-between">
              <Label className="text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-secondary-tint">
                Visual
              </Label>
              <span className="text-xs text-primary-tint">{videoGuidanceScale.toFixed(1)}</span>
            </div>
            <Slider
              className="mt-3"
              value={[videoGuidanceScale]}
              onValueChange={([v]) => setVideoGuidanceScale(v)}
              min={0}
              max={5}
              step={0.5}
            />
            <p className="mt-1 text-[0.6rem] text-slate-500">Estilo</p>
          </div>

          <div className="depth-secondary rounded-2xl border border-secondary/20 bg-slate-900/70 p-3">
            <div className="flex items-center justify-between">
              <Label className="text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-secondary-tint">
                Lip-sync
              </Label>
              <span className="text-xs text-primary-tint">{videoAudioGuidanceScale.toFixed(1)}</span>
            </div>
            <Slider
              className="mt-3"
              value={[videoAudioGuidanceScale]}
              onValueChange={([v]) => setVideoAudioGuidanceScale(v)}
              min={0}
              max={5}
              step={0.5}
            />
            <p className="mt-1 text-[0.6rem] text-slate-500">Sincronización</p>
          </div>
        </div>

        <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between">
              <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
                Cambiar modelo
              </Label>
              <ChevronRight className="h-4 w-4 text-slate-400 transition group-open:rotate-90" />
            </summary>
            <div className="mt-3 space-y-2">
              {Object.entries(VIDEO_MODEL_FAMILIES).map(([familyId, family]) => (
                <details key={familyId} className="group/family rounded-2xl border border-secondary/15 bg-slate-950/55">
                  <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                        {family.name}
                      </span>
                      <span className="text-xs text-secondary-tint">{Object.keys(family.models).length}</span>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400 transition group-open/family:rotate-90" />
                  </summary>
                  <div className="space-y-2 p-2 pt-0">
                    {Object.entries(family.models).map(([modelId, config]) => (
                      <button
                        key={modelId}
                        type="button"
                        onClick={() => setVideoModel(modelId)}
                        className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                          videoModel === modelId
                            ? 'depth-primary border-primary/35 bg-primary/10 text-white'
                            : 'depth-secondary border-secondary/15 bg-slate-950/70 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="block text-sm font-semibold">{config.name}</span>
                          {getCostTierLabel(config.costTier) && (
                            <span className="text-xs text-slate-400">
                              {getCostTierLabel(config.costTier)}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </details>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="depth-mixed rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
        <div className="flex items-center justify-between gap-3">
          <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
            {isUsingVideoMultiPrompt ? 'Multi-shot' : 'Prompt'}
          </Label>
          {supportsVideoMultiPrompt ? (
            <button
              type="button"
              onClick={() => setVideoUseMultiPrompt((current) => !current)}
              className={`rounded-full px-2 py-0.5 text-[0.6rem] font-semibold uppercase transition ${
                videoUseMultiPrompt
                  ? 'bg-primary/20 text-primary-tint'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              Multi-shot {videoUseMultiPrompt ? 'ON' : 'OFF'}
            </button>
          ) : null}
        </div>

        {isUsingVideoMultiPrompt ? (
          <div className="mt-3 space-y-3">
            {videoMultiPromptShots.map((shot, index) => (
              <div
                key={shot.id}
                className="rounded-3xl border border-secondary/20 bg-slate-950/80 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-white">Shot {index + 1}</span>
                  <div className="flex items-center gap-2">
                    <Select
                      value={shot.duration}
                      onValueChange={(value) => updateVideoShot(shot.id, { duration: value })}
                    >
                      <SelectTrigger className="h-9 w-24 border border-secondary/20 bg-slate-900/70 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {videoDurationOptions.map((duration) => (
                          <SelectItem key={duration} value={duration}>
                            {duration}s
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-slate-300"
                      onClick={() => removeVideoShot(shot.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Textarea
                  className="mt-3 min-h-24 rounded-3xl border border-secondary/20 bg-slate-950/80 text-white shadow-none"
                  placeholder="Describe este shot..."
                  value={shot.prompt}
                  onChange={(e) => updateVideoShot(shot.id, { prompt: e.target.value })}
                />
              </div>
            ))}
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-slate-400">
                Duración estimada: {videoMultiPromptDuration}s
              </span>
              <Button type="button" variant="outline" size="sm" onClick={addVideoShot}>
                Agregar shot
              </Button>
            </div>
          </div>
        ) : (
          <Textarea
            className="mt-3 min-h-32 rounded-3xl border border-secondary/20 bg-slate-950/80 text-white shadow-none"
            placeholder="Describe el movimiento..."
            value={videoPrompt}
            onChange={(e) => setVideoPrompt(e.target.value)}
          />
        )}

        {supportsVideoNegative ? (
          <Textarea
            className="mt-3 min-h-20 rounded-3xl border border-primary/20 bg-slate-950/80 text-white shadow-none"
            placeholder="Prompt negativo..."
            value={videoNegativePrompt}
            onChange={(e) => setVideoNegativePrompt(e.target.value)}
          />
        ) : null}
      </div>

      {videoModeOptions.length > 1 ? (
        <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
          <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
            Modo
          </Label>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {videoModeOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setVideoMode(option)}
                className={`rounded-2xl border px-3 py-2 text-sm transition ${
                  videoMode === option
                    ? 'depth-primary border-primary/35 bg-primary/10 text-white'
                    : 'border-secondary/15 bg-slate-950/70 text-slate-300'
                }`}
              >
                {option === 'text-to-video' ? 'Solo prompt' : 'Con imagen'}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {requiresVideoSource ? (
        <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
          <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
            Origen
          </Label>
          {videoModel.includes('seedance-2.0') && (
            <div className="mt-2 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 px-3 py-2">
              <p className="text-xs text-yellow-600 dark:text-yellow-400">
                Este modelo no funciona bien con fotos de personas. Usa paisajes, objetos o escenas sin rostros.
              </p>
            </div>
          )}
          {videoSource ? (
            <div className="depth-mixed mt-3 overflow-hidden rounded-3xl border border-secondary/20 bg-slate-950/80">
              <div className="relative aspect-video">
                <Image
                  src={videoSource}
                  alt="Origen del video"
                  fill
                  className="object-cover"
                  unoptimized
                />
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="absolute right-3 top-3 h-8 w-8"
                  onClick={() => setVideoSource('')}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="depth-secondary flex cursor-pointer items-center justify-center gap-2 rounded-3xl border border-dashed border-secondary/25 bg-slate-950/80 px-4 py-8 text-sm text-slate-300">
                <ImagePlus className="h-4 w-4 text-secondary-tint" />
                Sube una imagen
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleVideoFileChange}
                />
              </label>
              <button
                type="button"
                onClick={openVideoSourcePicker}
                className="depth-secondary flex cursor-pointer items-center justify-center gap-2 rounded-3xl border border-dashed border-primary/25 bg-primary/5 px-4 py-8 text-sm text-primary/80 transition hover:border-primary/50 hover:bg-primary/10"
              >
                <ImageIcon className="h-4 w-4 text-primary/60" />
                De la galería
              </button>
            </div>
          )}
        </div>
      ) : null}

      {supportsVideoElements && requiresVideoSource ? (
        <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
                Elementos
              </Label>
              <p className="mt-1 text-xs text-slate-400">
                Úsalos como `@Element1`, `@Element2`, etc.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => addVideoElement('image')}>
                Imagen
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addVideoElement('video')}
                disabled={videoElements.some((element) => element.type === 'video')}
              >
                Video
              </Button>
            </div>
          </div>

          <div className="mt-3 space-y-3">
            {videoElements.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-secondary/20 bg-slate-950/60 px-4 py-5 text-sm text-slate-400">
                Agrega elementos si quieres fijar personajes, props o voice binding.
              </div>
            ) : (
              videoElements.map((element, index) => (
                <div
                  key={element.id}
                  className="rounded-3xl border border-secondary/20 bg-slate-950/80 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">Element{index + 1}</p>
                      <p className="text-xs text-slate-400">
                        {element.type === 'image' ? 'Image set' : 'Video reference'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={element.type}
                        onValueChange={(value) =>
                          setVideoElementType(element.id, value as KlingElementDraftType)
                        }
                      >
                        <SelectTrigger className="h-9 w-28 border border-secondary/20 bg-slate-900/70 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="image">Imagen</SelectItem>
                          <SelectItem
                            value="video"
                            disabled={
                              element.type !== 'video' &&
                              videoElements.some((item) => item.type === 'video')
                            }
                          >
                            Video
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeVideoElement(element.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {element.type === 'image' ? (
                    <div className="mt-3 space-y-3">
                      <div>
                        <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
                          Imagen frontal
                        </Label>
                        {element.frontalImageUrl ? (
                          <div className="mt-2 relative aspect-video overflow-hidden rounded-3xl border border-secondary/20">
                            <Image
                              src={element.frontalImageUrl}
                              alt={`Element${index + 1} frontal`}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                            <Button
                              type="button"
                              size="icon"
                              variant="secondary"
                              className="absolute right-3 top-3 h-8 w-8"
                              onClick={() => updateVideoElement(element.id, { frontalImageUrl: '' })}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <label className="depth-secondary mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-3xl border border-dashed border-secondary/25 bg-slate-950/80 px-4 py-6 text-sm text-slate-300">
                            <ImagePlus className="h-4 w-4 text-secondary-tint" />
                            Sube imagen frontal
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => void handleVideoElementImageChange(e, element.id, 'frontalImageUrl')}
                            />
                          </label>
                        )}
                      </div>

                      <div>
                        <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
                          Referencias
                        </Label>
                        <label className="depth-secondary mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-3xl border border-dashed border-secondary/25 bg-slate-950/80 px-4 py-4 text-sm text-slate-300">
                          <ImagePlus className="h-4 w-4 text-secondary-tint" />
                          Agregar referencias
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => void handleVideoElementReferenceChange(e, element.id)}
                          />
                        </label>
                        {element.referenceImageUrls.length > 0 ? (
                          <div className="mt-2 grid grid-cols-3 gap-2">
                            {element.referenceImageUrls.map((url, refIndex) => (
                              <div
                                key={`${element.id}-${refIndex}`}
                                className="relative aspect-square overflow-hidden rounded-2xl border border-secondary/20"
                              >
                                <Image
                                  src={url}
                                  alt={`Element${index + 1} referencia ${refIndex + 1}`}
                                  fill
                                  className="object-cover"
                                  unoptimized
                                />
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="secondary"
                                  className="absolute right-1 top-1 h-7 w-7"
                                  onClick={() =>
                                    updateVideoElement(element.id, {
                                      referenceImageUrls: element.referenceImageUrls.filter(
                                        (_, currentIndex) => currentIndex !== refIndex
                                      ),
                                    })
                                  }
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 space-y-3">
                      <div>
                        <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
                          Video del elemento
                        </Label>
                        {element.videoUrl ? (
                          <div className="mt-2 relative overflow-hidden rounded-3xl border border-secondary/20 bg-slate-950/80 p-2">
                            <video src={element.videoUrl} controls className="aspect-video w-full rounded-2xl object-contain" />
                            <Button
                              type="button"
                              size="icon"
                              variant="secondary"
                              className="absolute right-3 top-3 h-8 w-8"
                              onClick={() => updateVideoElement(element.id, { videoUrl: '' })}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <label className="depth-secondary mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-3xl border border-dashed border-secondary/25 bg-slate-950/80 px-4 py-6 text-sm text-slate-300">
                            <Clapperboard className="h-4 w-4 text-secondary-tint" />
                            Sube video de referencia
                            <input
                              type="file"
                              accept="video/*"
                              className="hidden"
                              onChange={(e) => void handleVideoElementVideoChange(e, element.id)}
                            />
                          </label>
                        )}
                      </div>
                      <div>
                        <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
                          Voice ID
                        </Label>
                        <Input
                          className="mt-2 border-secondary/20 bg-slate-950/80 text-white"
                          placeholder="voice_..."
                          value={element.voiceId}
                          onChange={(e) => updateVideoElement(element.id, { voiceId: e.target.value })}
                          disabled={!videoGenerateAudio}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between">
            <div className="flex items-center gap-3">
              <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
                Modelos
              </Label>
              {supportsVideoAudio && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setVideoGenerateAudio((current) => !current)
                  }}
                  className={`rounded-full px-2 py-0.5 text-[0.6rem] font-semibold uppercase transition ${
                    videoGenerateAudio
                      ? 'bg-primary/20 text-primary-tint'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  Audio {videoGenerateAudio ? 'ON' : 'OFF'}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="depth-secondary border border-secondary/25 bg-secondary/10 text-secondary-tint">
                {Object.keys(VIDEO_MODEL_FAMILIES).length} familias
              </Badge>
              <ChevronRight className="h-4 w-4 text-slate-400 transition group-open:rotate-90" />
            </div>
          </summary>
          <div className="mt-3 space-y-2">
            {Object.entries(VIDEO_MODEL_FAMILIES).map(([familyId, family]) => (
              <details key={familyId} className="group/family rounded-2xl border border-secondary/15 bg-slate-950/55">
                <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                      {family.name}
                    </span>
                    <span className="text-xs text-secondary-tint">{Object.keys(family.models).length}</span>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-400 transition group-open/family:rotate-90" />
                </summary>
                <div className="space-y-2 p-2 pt-0">
                  {Object.entries(family.models).map(([modelId, config]) => (
                    <button
                      key={modelId}
                      type="button"
                      onClick={() => setVideoModel(modelId)}
                      className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                        videoModel === modelId
                          ? 'depth-primary border-primary/35 bg-primary/10 text-white'
                          : 'depth-secondary border-secondary/15 bg-slate-950/70 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="block text-sm font-semibold">{config.name}</span>
                        {getCostTierLabel(config.costTier) && (
                          <span className="text-xs text-slate-400">
                            {getCostTierLabel(config.costTier)}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </details>
      </div>

      {supportsVideoDuration && !isUsingVideoMultiPrompt ? (
        <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
          <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
             Duración
          </Label>
          <Select value={videoDuration} onValueChange={setVideoDuration}>
            <SelectTrigger className="depth-secondary mt-3 border border-secondary/20 bg-slate-900/70 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {videoDurationOptions.map((duration) => (
                <SelectItem key={duration} value={duration}>
                  {duration}s
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {supportsVideoCfg ? (
        <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between">
            <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
              CFG
            </Label>
            <span className="text-sm text-primary-tint">{videoCfgScale.toFixed(1)}</span>
          </div>
          <Slider
            className="mt-4"
            value={[videoCfgScale]}
            onValueChange={([value]) => setVideoCfgScale(value)}
            min={0}
            max={1}
            step={0.1}
          />
        </div>
      ) : null}

      {supportsVideoOptimizer ? (
        <button
          type="button"
          onClick={() => setVideoPromptOptimizer((current) => !current)}
          className={`depth-secondary rounded-3xl border border-secondary/20 px-4 py-3 text-left text-sm transition ${
            videoPromptOptimizer ? 'bg-primary/10 text-white' : 'bg-slate-900/70 text-slate-300'
          }`}
        >
          Optimizador de prompt: {videoPromptOptimizer ? 'ON' : 'OFF'}
        </button>
      ) : null}

      {supportsVideoRatio ? (
        <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
          <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
            Aspect Ratio
          </Label>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {videoAspectRatioOptions.map((ratioValue) => {
              const ratio = getVideoRatioCard(ratioValue)
              return (
                <RatioCard
                  key={ratioValue}
                  active={videoAspectRatio === ratioValue}
                  frameClass={ratio.frameClass}
                  label={ratio.label}
                  onClick={() => setVideoAspectRatio(ratioValue)}
                />
              )
            })}
          </div>
        </div>
      ) : null}

      {supportsVideoResolution ? (
        <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
          <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
            Resolution
          </Label>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {videoResolutionOptions.map((resolution) => (
              <button
                key={resolution}
                type="button"
                onClick={() => setVideoResolution(resolution)}
                className={`rounded-2xl border px-3 py-2 text-sm transition ${
                  videoResolution === resolution
                    ? 'depth-primary border-primary/35 bg-primary/10 text-white'
                    : 'border-secondary/15 bg-slate-950/70 text-slate-300'
                }`}
              >
                {getResolutionLabel(resolution)}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {supportsVideoSeed ? (
        <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between">
            <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
              Seed
            </Label>
            <button
              type="button"
              className="text-xs font-semibold text-primary-tint"
              onClick={() => setVideoSeed(String(Math.floor(Math.random() * 999999)))}
            >
              Aleatorio
            </button>
          </div>
          <input
            type="number"
            inputMode="numeric"
            value={videoSeed}
            onChange={(e) => setVideoSeed(e.target.value)}
            placeholder="Auto"
            className="depth-mixed mt-3 flex h-11 w-full rounded-2xl border border-secondary/15 bg-slate-950/80 px-3 py-2 text-sm text-white"
          />
        </div>
      ) : null}

      {supportsVideoQuality ? (
        <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
          <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
            Calidad
          </Label>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {['low', 'medium', 'high', 'maximum'].map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setVideoQuality(option)}
                className={`rounded-2xl border px-3 py-2 text-sm capitalize transition ${
                  videoQuality === option
                    ? 'depth-primary border-primary/35 bg-primary/10 text-white'
                    : 'border-secondary/15 bg-slate-950/70 text-slate-300'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {supportsVideoFrames ? (
        <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
          <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
            Frames
          </Label>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={241}
            value={videoNumFrames}
            onChange={(e) => setVideoNumFrames(parseInt(e.target.value || '1', 10))}
            className="depth-mixed mt-3 flex h-11 w-full rounded-2xl border border-secondary/15 bg-slate-950/80 px-3 py-2 text-sm text-white"
          />
        </div>
      ) : null}

      {supportsVideoFps ? (
        <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
          <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
            FPS
          </Label>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={60}
            value={videoFps}
            onChange={(e) => setVideoFps(parseInt(e.target.value || '1', 10))}
            className="depth-mixed mt-3 flex h-11 w-full rounded-2xl border border-secondary/15 bg-slate-950/80 px-3 py-2 text-sm text-white"
          />
        </div>
      ) : null}

      {supportsVideoStepsExtra ? (
        <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
          <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
            Steps
          </Label>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={100}
            value={videoSteps}
            onChange={(e) => setVideoSteps(parseInt(e.target.value || '1', 10))}
            className="depth-mixed mt-3 flex h-11 w-full rounded-2xl border border-secondary/15 bg-slate-950/80 px-3 py-2 text-sm text-white"
          />
        </div>
      ) : null}

      {supportsVideoAcceleration ? (
        <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
          <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
            Aceleración
          </Label>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {['none', 'regular'].map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setVideoAcceleration(option)}
                className={`rounded-2xl border px-3 py-2 text-sm capitalize transition ${
                  videoAcceleration === option
                    ? 'depth-primary border-primary/35 bg-primary/10 text-white'
                    : 'border-secondary/15 bg-slate-950/70 text-slate-300'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {supportsVideoAutoFix ? (
        <button
          type="button"
          onClick={() => setVideoAutoFix((current) => !current)}
          className={`depth-secondary rounded-3xl border border-secondary/20 px-4 py-3 text-left text-sm transition ${
            videoAutoFix ? 'bg-primary/10 text-white' : 'bg-slate-900/70 text-slate-300'
          }`}
        >
          Auto-fix prompt: {videoAutoFix ? 'ON' : 'OFF'}
        </button>
      ) : null}

      {supportsVideoDelete ? (
        <button
          type="button"
          onClick={() => setVideoDeleteRemote((current) => !current)}
          className={`depth-secondary rounded-3xl border border-secondary/20 px-4 py-3 text-left text-sm transition ${
            videoDeleteRemote ? 'bg-primary/10 text-white' : 'bg-slate-900/70 text-slate-300'
          }`}
        >
          Borrar archivo remoto: {videoDeleteRemote ? 'ON' : 'OFF'}
        </button>
      ) : null}

      {supportsVideoPromptExpansion ? (
        <button
          type="button"
          onClick={() => setVideoPromptExpansion((current) => !current)}
          className={`depth-secondary rounded-3xl border border-secondary/20 px-4 py-3 text-left text-sm transition ${
            videoPromptExpansion ? 'bg-primary/10 text-white' : 'bg-slate-900/70 text-slate-300'
          }`}
        >
          Expansión de prompt: {videoPromptExpansion ? 'ON' : 'OFF'}
        </button>
      ) : null}
    </>
  )
}
