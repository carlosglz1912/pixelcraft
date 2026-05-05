'use client'

import { useState, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useModelConfig } from '@/stores/model-config'
import { IMAGE_MODEL_FAMILIES, VIDEO_MODEL_FAMILIES, type CostTier } from '@/types'
import type { StudioMode } from '@/lib/studio-types'
import {
  Settings2,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Sparkles,
  Save,
  Trash2,
  Download,
  Image as ImageIcon,
  Video,
  AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'

// ── Types ──────────────────────────────────────────────────────────

interface ModelConfigProps {
  onSwitchTab?: (tab: string) => void
}

// ── Cost tier badge colors ─────────────────────────────────────────

const COST_TIER_STYLES: Record<CostTier, string> = {
  free: 'bg-green-500/15 text-green-400 border-green-500/30',
  low: 'bg-green-500/15 text-green-400 border-green-500/30',
  medium: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  high: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  premium: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
}

const COST_TIER_LABELS: Record<CostTier, string> = {
  free: 'Gratis',
  low: '$',
  medium: '$$',
  high: '$$$',
  premium: '$$$$',
}

// ── Toggle Switch ──────────────────────────────────────────────────

function ToggleSwitch({
  pressed,
  onPressedChange,
  label,
  size = 'default',
}: {
  pressed: boolean
  onPressedChange: () => void
  label: string
  size?: 'default' | 'sm'
}) {
  const trackSize = size === 'sm' ? 'h-5 w-9' : 'h-6 w-11'
  const thumbSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'
  const thumbTranslate = pressed
    ? size === 'sm'
      ? 'translate-x-4'
      : 'translate-x-5'
    : 'translate-x-0.5'

  return (
    <button
      type="button"
      role="switch"
      aria-checked={pressed}
      aria-label={label}
      onClick={onPressedChange}
      className={`inline-flex shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
        pressed ? 'bg-primary/60' : 'bg-secondary/30'
      } ${trackSize}`}
    >
      <span
        className={`rounded-full bg-white shadow-sm transition-transform duration-200 ${thumbSize} ${thumbTranslate}`}
      />
    </button>
  )
}

// ── Family Card ────────────────────────────────────────────────────

function FamilyCard({
  mode,
  familyId,
  familyName,
  models,
}: {
  mode: StudioMode
  familyId: string
  familyName: string
  models: Record<string, { name: string; costTier?: CostTier }>
}) {
  const [expanded, setExpanded] = useState(true)
  const isFamilyVisible = useModelConfig((s) => s.isFamilyVisible)
  const isModelVisible = useModelConfig((s) => s.isModelVisible)
  const toggleFamily = useModelConfig((s) => s.toggleFamily)
  const toggleModel = useModelConfig((s) => s.toggleModel)

  const familyVisible = isFamilyVisible(mode, familyId)
  const modelIds = Object.keys(models)
  const visibleCount = modelIds.filter((id) => isModelVisible(mode, id)).length

  return (
    <div className="depth-mixed rounded-2xl border border-secondary/15 bg-slate-900/70 overflow-hidden">
      {/* Family header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex h-5 w-5 items-center justify-center rounded-md text-slate-400 transition hover:bg-secondary/15 hover:text-white"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
          <span className="text-sm font-medium text-white truncate">
            {familyName}
          </span>
          <Badge
            variant="secondary"
            className="depth-secondary border border-secondary/20 bg-secondary/10 text-[10px] text-secondary-tint"
          >
            {visibleCount}/{modelIds.length}
          </Badge>
        </div>
        <ToggleSwitch
          pressed={familyVisible}
          onPressedChange={() => toggleFamily(mode, familyId)}
          label={`${familyVisible ? 'Ocultar' : 'Mostrar'} familia ${familyName}`}
        />
      </div>

      {/* Model list (collapsible) */}
      {expanded && (
        <div className="border-t border-secondary/10 px-4 py-2 space-y-1">
          {modelIds.map((modelId) => {
            const modelConfig = models[modelId]
            const visible = isModelVisible(mode, modelId)
            return (
              <div
                key={modelId}
                className="flex items-center justify-between gap-3 rounded-xl px-2 py-1.5 transition hover:bg-secondary/5"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {visible ? (
                    <Eye className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                  )}
                  <span
                    className={`text-xs truncate ${
                      visible ? 'text-slate-300' : 'text-slate-500 line-through'
                    }`}
                  >
                    {modelConfig.name}
                  </span>
                  {modelConfig.costTier && (
                    <span
                      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${
                        COST_TIER_STYLES[modelConfig.costTier]
                      }`}
                    >
                      {COST_TIER_LABELS[modelConfig.costTier]}
                    </span>
                  )}
                </div>
                <ToggleSwitch
                  pressed={visible}
                  onPressedChange={() => toggleModel(mode, modelId)}
                  label={`${visible ? 'Ocultar' : 'Mostrar'} modelo ${modelConfig.name}`}
                  size="sm"
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Mode Section ───────────────────────────────────────────────────

function ModeSection({
  mode,
  families,
}: {
  mode: StudioMode
  families: Record<string, { name: string; models: Record<string, { name: string; costTier?: CostTier }> }>
}) {
  const isFamilyVisible = useModelConfig((s) => s.isFamilyVisible)

  const familyIds = Object.keys(families)
  const allHidden = familyIds.length > 0 && familyIds.every((id) => !isFamilyVisible(mode, id))

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center gap-2 px-1">
        {mode === 'image' ? (
          <ImageIcon className="h-4 w-4 text-primary-tint" />
        ) : (
          <Video className="h-4 w-4 text-primary-tint" />
        )}
        <h3 className="text-sm font-semibold text-white">
          {mode === 'image' ? 'Modelos de Imagen' : 'Modelos de Video'}
        </h3>
        <Badge
          variant="secondary"
          className="depth-secondary border border-secondary/20 bg-secondary/10 text-[10px] text-secondary-tint"
        >
          {familyIds.length} familias
        </Badge>
      </div>

      {/* All hidden warning */}
      {allHidden && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-950/20 px-3 py-2 text-xs text-amber-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          Todas las familias están ocultas. Habilita al menos una para ver modelos en este modo.
        </div>
      )}

      {/* Family cards */}
      <div className="space-y-2">
        {familyIds.map((familyId) => (
          <FamilyCard
            key={familyId}
            mode={mode}
            familyId={familyId}
            familyName={families[familyId].name}
            models={families[familyId].models as Record<string, { name: string; costTier?: CostTier }>}
          />
        ))}
      </div>
    </div>
  )
}

// ── Preset Manager ─────────────────────────────────────────────────

function PresetManager() {
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const presets = useModelConfig((s) => s.presets)
  const activePreset = useModelConfig((s) => s.activePreset)
  const savePreset = useModelConfig((s) => s.savePreset)
  const loadPreset = useModelConfig((s) => s.loadPreset)
  const deletePreset = useModelConfig((s) => s.deletePreset)

  const handleSave = () => {
    const name = presetName.trim()
    if (!name) return
    try {
      savePreset(name)
      toast.success(`Preset "${name}" guardado`)
      setShowSaveDialog(false)
      setPresetName('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar preset')
    }
  }

  const handleDelete = (name: string) => {
    deletePreset(name)
    toast.success(`Preset "${name}" eliminado`)
    setDeleteConfirm(null)
  }

  return (
    <div className="depth-mixed rounded-2xl border border-secondary/15 bg-slate-900/70 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary-tint" />
          <h3 className="text-sm font-semibold text-white">Presets</h3>
          {presets.length > 0 && (
            <Badge
              variant="secondary"
              className="depth-secondary border border-secondary/20 bg-secondary/10 text-[10px] text-secondary-tint"
            >
              {presets.length}
            </Badge>
          )}
        </div>
        <Button
          onClick={() => setShowSaveDialog(true)}
          className="depth-primary h-7 rounded-xl border border-primary/25 bg-primary px-3 text-[11px] font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Save className="mr-1 h-3 w-3" />
          Guardar
        </Button>
      </div>

      {activePreset && (
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <span>Activo:</span>
          <Badge
            variant="secondary"
            className="depth-primary border border-primary/20 bg-primary/10 text-primary-tint text-[10px]"
          >
            {activePreset}
          </Badge>
        </div>
      )}

      {presets.length === 0 ? (
        <p className="text-xs text-slate-500 px-1">
          No hay presets guardados. Configura la visibilidad y guarda un preset para reutilizarlo.
        </p>
      ) : (
        <div className="space-y-1.5">
          {presets.map((preset) => (
            <div
              key={preset.name}
              className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 transition ${
                activePreset === preset.name
                  ? 'border border-primary/20 bg-primary/5'
                  : 'border border-secondary/10 bg-slate-900/40 hover:bg-secondary/5'
              }`}
            >
              <button
                type="button"
                onClick={() => loadPreset(preset.name)}
                className="flex items-center gap-2 min-w-0 text-left"
              >
                <Download className="h-3 w-3 text-slate-400 shrink-0" />
                <span className="text-xs text-slate-300 truncate">
                  {preset.name}
                </span>
              </button>
              {deleteConfirm === preset.name ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleDelete(preset.name)}
                    className="rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] text-red-400 hover:bg-red-500/20"
                  >
                    Eliminar
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(null)}
                    className="rounded-lg border border-secondary/15 bg-secondary/10 px-2 py-0.5 text-[10px] text-slate-400 hover:bg-secondary/15"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(preset.name)}
                  className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-500 transition hover:bg-red-500/10 hover:text-red-400"
                  aria-label={`Eliminar preset ${preset.name}`}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Save preset dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="depth-mixed border-secondary/25 bg-slate-950/95 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Guardar Preset</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Nombre del preset"
              className="depth-secondary border border-secondary/20 bg-slate-900/70 text-white placeholder:text-slate-500"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave()
              }}
            />
          </div>
          <DialogFooter>
            <Button
              onClick={() => setShowSaveDialog(false)}
              className="depth-secondary rounded-2xl border border-secondary/15 bg-secondary/10 text-secondary-tint hover:bg-secondary/15 hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={!presetName.trim()}
              className="depth-primary rounded-2xl border border-primary/25 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────

export function ModelConfig({ onSwitchTab }: ModelConfigProps) {
  const [activeMode, setActiveMode] = useState<StudioMode>('image')

  const imageFamilyCount = Object.keys(IMAGE_MODEL_FAMILIES).length
  const videoFamilyCount = Object.keys(VIDEO_MODEL_FAMILIES).length
  const totalModels =
    Object.values(IMAGE_MODEL_FAMILIES).reduce((acc, f) => acc + Object.keys(f.models).length, 0) +
    Object.values(VIDEO_MODEL_FAMILIES).reduce((acc, f) => acc + Object.keys(f.models).length, 0)

  return (
    <div className="flex h-full flex-col">
      {/* Header bar */}
      <div className="surface-secondary flex items-center justify-between gap-3 border-b border-secondary/20 px-5 py-4">
        <div className="flex min-w-0 items-center gap-2">
          <Badge
            variant="secondary"
            className="depth-secondary border border-secondary/20 bg-secondary/10 text-secondary-tint"
          >
            <Settings2 className="mr-1 h-3 w-3" />
            Configuración
          </Badge>
          <Badge
            variant="secondary"
            className="depth-primary border border-primary/20 bg-primary/10 text-primary-tint"
          >
            {totalModels} modelos
          </Badge>
        </div>

        {/* Mode tabs */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveMode('image')}
            className={`rounded-2xl px-3 py-1.5 text-xs font-medium transition ${
              activeMode === 'image'
                ? 'depth-primary border border-primary/25 bg-primary/20 text-primary-tint hover:bg-primary/30'
                : 'depth-secondary border border-secondary/15 bg-secondary/10 text-secondary-tint hover:bg-secondary/15 hover:text-white'
            }`}
          >
            <ImageIcon className="mr-1.5 inline h-3 w-3" />
            Imagen
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('video')}
            className={`rounded-2xl px-3 py-1.5 text-xs font-medium transition ${
              activeMode === 'video'
                ? 'depth-primary border border-primary/25 bg-primary/20 text-primary-tint hover:bg-primary/30'
                : 'depth-secondary border border-secondary/15 bg-secondary/10 text-secondary-tint hover:bg-secondary/15 hover:text-white'
            }`}
          >
            <Video className="mr-1.5 inline h-3 w-3" />
            Video
          </button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="h-[calc(100vh-4.75rem)] h-[calc(100dvh-4.75rem)]">
        <div className="space-y-5 p-5">
          {/* Preset manager */}
          <PresetManager />

          {/* Mode sections — only show the active tab */}
          {activeMode === 'image' ? (
            <ModeSection mode="image" families={IMAGE_MODEL_FAMILIES} />
          ) : (
            <ModeSection mode="video" families={VIDEO_MODEL_FAMILIES} />
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
