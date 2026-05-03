'use client'

import Image from 'next/image'
import {
  Image as ImageIcon,
  ImagePlus,
  Sparkles,
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
  IMAGE_BACKGROUND_OPTIONS,
  IMAGE_OUTPUT_FORMAT_OPTIONS,
  IMAGE_QUALITY_OPTIONS,
} from '@/lib/image-model-controls'
import {
  getImageSizeCard,
  getImageAspectRatioCard,
  RatioCard,
} from '@/lib/studio-helpers'
import { RECRAFT_STYLES } from '@/lib/studio-types'
import {
  IMAGE_MODEL_FAMILIES,
  getCostTierLabel,
} from '@/types'

export interface ImageStudioPanelProps {
  // State
  prompt: string
  negativePrompt: string
  imageModel: string
  imageSize: string
  imageAspectRatio: string
  imageResolution: string
  imageOutputFormat: string
  imageQuality: string
  imageBackground: string
  seed: number | undefined
  numImages: number
  guidanceScale: number
  numInferenceSteps: number
  referenceImages: string[]
  imagePromptStrength: number
  imageStyle: string
  imageColors: string
  // Setters
  setPrompt: (value: string) => void
  setNegativePrompt: (value: string) => void
  setImageModel: (model: string) => void
  setImageSize: (value: string) => void
  setImageAspectRatio: (value: string) => void
  setImageResolution: (value: string) => void
  setImageOutputFormat: (value: string) => void
  setImageQuality: (value: string) => void
  setImageBackground: (value: string) => void
  setSeed: (value: number | undefined) => void
  setNumImages: (value: number) => void
  setGuidanceScale: (value: number) => void
  setNumInferenceSteps: (value: number) => void
  setReferenceImages: React.Dispatch<React.SetStateAction<string[]>>
  setImagePromptStrength: (value: number) => void
  setImageStyle: (value: string) => void
  setImageColors: (value: string) => void
  // Derived flags
  supportsNegative: boolean
  supportsSize: boolean
  supportsImageAspectRatio: boolean
  supportsImageResolution: boolean
  supportsNumImages: boolean
  supportsImageOutputFormat: boolean
  supportsImageQuality: boolean
  supportsImageBackground: boolean
  supportsGuidance: boolean
  supportsSteps: boolean
  supportsImageSeed: boolean
  supportsImageReference: boolean
  supportsImageReferences: boolean
  maxImageReferences: number
  supportsImagePromptStrength: boolean
  supportsImageStyle: boolean
  supportsImageColors: boolean
  imageSizeOptions: readonly { value: string; label: string }[]
  imageAspectRatioOptions: readonly { value: string; label: string }[]
  imageResolutionOptions: readonly { value: string; label: string }[]
  imageStepSettings: { min: number; max: number; defaultValue: number }
  // Handlers
  handleReferenceFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  openReferenceGalleryPicker: () => void
}

export function ImageStudioPanel({
  prompt,
  negativePrompt,
  imageModel,
  imageSize,
  imageAspectRatio,
  imageResolution,
  imageOutputFormat,
  imageQuality,
  imageBackground,
  seed,
  numImages,
  guidanceScale,
  numInferenceSteps,
  referenceImages,
  imagePromptStrength,
  imageStyle,
  imageColors,
  setPrompt,
  setNegativePrompt,
  setImageModel,
  setImageSize,
  setImageAspectRatio,
  setImageResolution,
  setImageOutputFormat,
  setImageQuality,
  setImageBackground,
  setSeed,
  setNumImages,
  setGuidanceScale,
  setNumInferenceSteps,
  setReferenceImages,
  setImagePromptStrength,
  setImageStyle,
  setImageColors,
  supportsNegative,
  supportsSize,
  supportsImageAspectRatio,
  supportsImageResolution,
  supportsNumImages,
  supportsImageOutputFormat,
  supportsImageQuality,
  supportsImageBackground,
  supportsGuidance,
  supportsSteps,
  supportsImageSeed,
  supportsImageReference,
  supportsImageReferences,
  maxImageReferences,
  supportsImagePromptStrength,
  supportsImageStyle,
  supportsImageColors,
  imageSizeOptions,
  imageAspectRatioOptions,
  imageResolutionOptions,
  imageStepSettings,
  handleReferenceFileChange,
  openReferenceGalleryPicker,
}: ImageStudioPanelProps) {
  return (
    <>
      <div className="depth-mixed rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
        <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
          Prompt
        </Label>
        <Textarea
          className="mt-3 min-h-36 rounded-3xl border border-secondary/20 bg-slate-950/80 text-white shadow-none"
          placeholder="Describe your image..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        {supportsNegative ? (
          <Textarea
            className="mt-3 min-h-20 rounded-3xl border border-primary/20 bg-slate-950/80 text-white shadow-none"
             placeholder="Prompt negativo..."
            value={negativePrompt}
            onChange={(e) => setNegativePrompt(e.target.value)}
          />
        ) : null}
      </div>

      {supportsImageReference ? (
        <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
          <div className="mb-3 flex items-center justify-between">
            <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
              {supportsImageReferences ? 'Referencias' : 'Referencia'}
            </Label>
            <Badge variant="secondary" className="depth-secondary border border-secondary/25 bg-secondary/10 text-secondary-tint">
              {Math.min(referenceImages.length, maxImageReferences)}/{maxImageReferences}
            </Badge>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="depth-secondary flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-secondary/25 bg-slate-950/75 px-4 py-4 text-sm text-slate-300">
              <ImagePlus className="h-4 w-4 text-secondary-tint" />
              {supportsImageReferences ? 'Add references' : 'Add reference'}
              <input
                type="file"
                accept="image/*"
                multiple={supportsImageReferences}
                className="hidden"
                onChange={handleReferenceFileChange}
              />
            </label>
            <button
              type="button"
              onClick={openReferenceGalleryPicker}
              className="depth-secondary flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/25 bg-primary/5 px-4 py-4 text-sm text-primary/80 transition hover:border-primary/50 hover:bg-primary/10"
            >
              <ImageIcon className="h-4 w-4 text-primary/60" />
              De la galería
            </button>
          </div>

          {referenceImages.length > 0 ? (
            <div className={`mt-3 ${supportsImageReferences ? 'grid grid-cols-3 gap-2' : ''}`}>
              {referenceImages.slice(0, maxImageReferences).map((url, index) => (
                <div
                  key={`ref-${index}`}
                  className="depth-mixed relative overflow-hidden rounded-2xl border border-secondary/20 bg-slate-950/80"
                >
                  <div className={supportsImageReferences ? 'relative aspect-square' : 'relative aspect-video'}>
                    <Image
                      src={url}
                      alt={`Reference ${index + 1}`}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setReferenceImages((current) => current.filter((_, i) => i !== index))}
                    className="depth-primary absolute right-2 top-2 rounded-full border border-primary/20 bg-primary/15 px-2 py-1 text-[0.65rem] font-semibold text-primary-tint"
                  >
                    Eliminar
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {supportsImagePromptStrength ? (
        <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between">
            <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
              Fuerza de referencia
            </Label>
            <span className="text-sm text-primary-tint">{imagePromptStrength.toFixed(2)}</span>
          </div>
          <Slider
            className="mt-4"
            value={[imagePromptStrength]}
            onValueChange={([value]) => setImagePromptStrength(value)}
            min={0}
            max={1}
            step={0.05}
          />
        </div>
      ) : null}

      <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
        <div className="mb-3 flex items-center justify-between">
          <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
            Models
          </Label>
          <Badge variant="secondary" className="depth-secondary border border-secondary/25 bg-secondary/10 text-secondary-tint">
            {Object.keys(IMAGE_MODEL_FAMILIES).length} familias
          </Badge>
        </div>
        <div className="space-y-3">
          {Object.entries(IMAGE_MODEL_FAMILIES).map(([familyId, family]) => (
            <div key={familyId} className="rounded-2xl border border-secondary/15 bg-slate-950/55 p-2">
              <div className="mb-2 flex items-center justify-between px-2">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  {family.name}
                </span>
                <span className="text-xs text-secondary-tint">{Object.keys(family.models).length}</span>
              </div>
              <div className="space-y-2">
                {Object.entries(family.models).map(([modelId, config]) => (
                  <button
                    key={modelId}
                    type="button"
                    onClick={() => setImageModel(modelId)}
                    className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                      imageModel === modelId
                        ? 'depth-primary border-primary/35 bg-primary/10 text-white'
                        : 'depth-secondary border-secondary/15 bg-slate-950/70 text-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="block text-sm font-semibold">{config.name}</span>
                        <span className="block text-xs text-slate-400">{family.name}</span>
                      </div>
                      {getCostTierLabel(config.costTier) && (
                        <span className="text-xs text-slate-400">
                          {getCostTierLabel(config.costTier)}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {supportsSize ? (
        <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
          <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
            Aspect Ratio
          </Label>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {imageSizeOptions.map((size) => {
              const card = getImageSizeCard(size.value, size.label)
              return (
                <RatioCard
                  key={size.value}
                  active={imageSize === size.value}
                  frameClass={card.frameClass}
                  label={card.label}
                  onClick={() => setImageSize(size.value)}
                />
              )
            })}
          </div>
        </div>
      ) : null}

      {supportsImageAspectRatio ? (
        <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
          <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
            Frame
          </Label>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {imageAspectRatioOptions.map((ratio) => {
              const card = getImageAspectRatioCard(ratio.value)
              return (
                <RatioCard
                  key={ratio.value}
                  active={imageAspectRatio === ratio.value}
                  frameClass={card.frameClass}
                  label={card.label}
                  onClick={() => setImageAspectRatio(ratio.value)}
                />
              )
            })}
          </div>
        </div>
      ) : null}

      {supportsImageResolution ? (
        <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
          <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
            Resolution
          </Label>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {imageResolutionOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setImageResolution(option.value)}
                className={`rounded-2xl border px-3 py-2 text-sm transition ${
                  imageResolution === option.value
                    ? 'depth-primary border-primary/35 bg-primary/10 text-white'
                    : 'border-secondary/15 bg-slate-950/70 text-slate-300'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {supportsImageStyle ? (
        <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
          <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
            Estilo
          </Label>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {RECRAFT_STYLES.map((style) => (
              <button
                key={style.value}
                type="button"
                onClick={() => setImageStyle(style.value)}
                className={`rounded-2xl border px-3 py-2 text-sm transition ${
                  imageStyle === style.value
                    ? 'depth-primary border-primary/35 bg-primary/10 text-white'
                    : 'border-secondary/15 bg-slate-950/70 text-slate-300'
                }`}
              >
                {style.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {supportsImageColors ? (
        <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
          <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
            Colores
          </Label>
          <Textarea
            className="mt-3 min-h-20 rounded-3xl border border-secondary/20 bg-slate-950/80 text-white shadow-none"
            placeholder="#FF6B6B, #1A73E8"
            value={imageColors}
            onChange={(e) => setImageColors(e.target.value)}
          />
        </div>
      ) : null}

      {supportsImageOutputFormat ? (
        <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
          <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
            Output
          </Label>
          <Select value={imageOutputFormat} onValueChange={setImageOutputFormat}>
            <SelectTrigger className="depth-secondary mt-3 border border-secondary/20 bg-slate-900/70 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {IMAGE_OUTPUT_FORMAT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {supportsImageQuality ? (
        <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
          <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
            Quality
          </Label>
          <Select value={imageQuality} onValueChange={setImageQuality}>
            <SelectTrigger className="depth-secondary mt-3 border border-secondary/20 bg-slate-900/70 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {IMAGE_QUALITY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {supportsImageBackground ? (
        <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
          <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
            Background
          </Label>
          <Select value={imageBackground} onValueChange={setImageBackground}>
            <SelectTrigger className="depth-secondary mt-3 border border-secondary/20 bg-slate-900/70 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {IMAGE_BACKGROUND_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {supportsNumImages ? (
        <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between">
            <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
               Lote
            </Label>
            <span className="text-sm text-primary-tint">{numImages}</span>
          </div>
          <Slider
            className="mt-4"
            value={[numImages]}
            onValueChange={([value]) => setNumImages(value)}
            min={1}
            max={4}
            step={1}
          />
        </div>
      ) : null}

      {supportsGuidance ? (
        <div className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between">
            <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
               Guía
            </Label>
            <span className="text-sm text-primary-tint">{guidanceScale}</span>
          </div>
          <Slider
            className="mt-4"
            value={[guidanceScale]}
            onValueChange={([value]) => setGuidanceScale(value)}
            min={1}
            max={20}
            step={0.5}
          />
        </div>
      ) : null}

      <details className="depth-secondary rounded-3xl border border-secondary/20 bg-slate-900/70 p-4">
        <summary className="cursor-pointer list-none text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-secondary-tint">
           Avanzado
        </summary>
        <div className="mt-4 space-y-4">
          {supportsImageSeed ? (
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-slate-400">
                                 Semilla
                              </Label>
                <button
                  type="button"
                  className="text-xs font-semibold text-primary-tint"
                  onClick={() => setSeed(Math.floor(Math.random() * 999999))}
                >
                                 Aleatorio
                              </button>
              </div>
              <div className="depth-mixed mt-3 rounded-2xl border border-primary/20 bg-slate-950/80 px-3 py-2 text-sm text-white">
                {seed ?? 'Auto'}
              </div>
            </div>
          ) : null}

          {supportsSteps ? (
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-slate-400">
                                   Pasos
                                </Label>
                <span className="text-sm text-primary-tint">{numInferenceSteps}</span>
              </div>
              <Slider
                className="mt-4"
                value={[numInferenceSteps]}
                onValueChange={([value]) => setNumInferenceSteps(value)}
                min={imageStepSettings.min}
                max={imageStepSettings.max}
                step={1}
              />
            </div>
          ) : null}
        </div>
      </details>
    </>
  )
}
