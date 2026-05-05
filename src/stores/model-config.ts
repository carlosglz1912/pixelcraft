import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import type { StudioMode } from '@/lib/studio-types'
import { IMAGE_MODEL_FAMILIES, VIDEO_MODEL_FAMILIES } from '@/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Per-mode visibility maps. Only hidden items are stored (opt-out model).
 * A missing key means the item is visible (default).
 */
export type VisibilityMap = Record<string, Record<string, boolean>>

export interface ModelVisibilityConfig {
  hiddenFamilies: VisibilityMap
  hiddenModels: VisibilityMap
}

export interface Preset {
  name: string
  config: ModelVisibilityConfig
  createdAt: number
}

// ---------------------------------------------------------------------------
// Custom storage adapter (SSR-safe, QuotaExceededError handling)
// ---------------------------------------------------------------------------

const modelConfigStorage: StateStorage = {
  getItem: (name: string) => {
    if (typeof window === 'undefined') return null
    return window.localStorage.getItem(name)
  },
  setItem: (name: string, value: string) => {
    if (typeof window === 'undefined') return

    try {
      window.localStorage.setItem(name, value)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.warn('[model-config] Local storage quota exceeded; skipping persistence update.', error)
        return
      }

      throw error
    }
  },
  removeItem: (name: string) => {
    if (typeof window === 'undefined') return
    window.localStorage.removeItem(name)
  },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create an empty visibility config with no hidden items. */
function emptyConfig(): ModelVisibilityConfig {
  return {
    hiddenFamilies: { image: {}, video: {} },
    hiddenModels: { image: {}, video: {} },
  }
}

/** Remove a key from a visibility map when toggling back to visible. */
function toggleVisibilityKey(
  map: VisibilityMap,
  mode: StudioMode,
  key: string,
): VisibilityMap {
  const modeMap = { ...map[mode] }

  if (modeMap[key]) {
    // Currently hidden → make visible (delete key)
    delete modeMap[key]
  } else {
    // Currently visible → hide
    modeMap[key] = true
  }

  return { ...map, [mode]: modeMap }
}

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

export interface ModelConfigState {
  visibility: ModelVisibilityConfig
  presets: Preset[]
  activePreset: string | null

  // Visibility queries
  isFamilyVisible: (mode: StudioMode, familyId: string) => boolean
  isModelVisible: (mode: StudioMode, modelId: string) => boolean
  getVisibleFamilies: (mode: StudioMode) => string[]

  // Visibility mutations
  toggleFamily: (mode: StudioMode, familyId: string) => void
  toggleModel: (mode: StudioMode, modelId: string) => void

  // Preset CRUD
  savePreset: (name: string) => void
  loadPreset: (name: string) => void
  deletePreset: (name: string) => void
  renamePreset: (oldName: string, newName: string) => void
}

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

export const useModelConfig = create<ModelConfigState>()(
  persist(
    (set, get) => ({
      visibility: emptyConfig(),
      presets: [],
      activePreset: null,

      // ---- Visibility queries ------------------------------------------------

      isFamilyVisible: (mode, familyId) => {
        return !get().visibility.hiddenFamilies[mode]?.[familyId]
      },

      isModelVisible: (mode, modelId) => {
        return !get().visibility.hiddenModels[mode]?.[modelId]
      },

      getVisibleFamilies: (mode) => {
        const families = mode === 'image' ? IMAGE_MODEL_FAMILIES : VIDEO_MODEL_FAMILIES
        const hiddenFamilies = get().visibility.hiddenFamilies[mode] ?? {}
        return Object.keys(families).filter((id) => !hiddenFamilies[id])
      },

      // ---- Visibility mutations ----------------------------------------------

      toggleFamily: (mode, familyId) => {
        set((state) => ({
          visibility: {
            ...state.visibility,
            hiddenFamilies: toggleVisibilityKey(state.visibility.hiddenFamilies, mode, familyId),
          },
          activePreset: null,
        }))
      },

      toggleModel: (mode, modelId) => {
        set((state) => ({
          visibility: {
            ...state.visibility,
            hiddenModels: toggleVisibilityKey(state.visibility.hiddenModels, mode, modelId),
          },
          activePreset: null,
        }))
      },

      // ---- Preset CRUD -------------------------------------------------------

      savePreset: (name) => {
        const { presets, visibility } = get()

        if (presets.some((p) => p.name === name)) {
          throw new Error(`[model-config] Preset "${name}" already exists`)
        }

        set({
          presets: [...presets, { name, config: visibility, createdAt: Date.now() }],
          activePreset: name,
        })
      },

      loadPreset: (name) => {
        const preset = get().presets.find((p) => p.name === name)
        if (!preset) {
          console.warn(`[model-config] Preset "${name}" not found`)
          return
        }

        set({
          visibility: { ...preset.config },
          activePreset: name,
        })
      },

      deletePreset: (name) => {
        set((state) => {
          const filtered = state.presets.filter((p) => p.name !== name)
          return {
            presets: filtered,
            activePreset: state.activePreset === name ? null : state.activePreset,
          }
        })
      },

      renamePreset: (oldName, newName) => {
        const { presets } = get()

        if (presets.some((p) => p.name === newName)) {
          throw new Error(`[model-config] Preset "${newName}" already exists`)
        }

        set((state) => ({
          presets: state.presets.map((p) =>
            p.name === oldName ? { ...p, name: newName } : p,
          ),
          activePreset: state.activePreset === oldName ? newName : state.activePreset,
        }))
      },
    }),
    {
      name: 'pixelcraft-model-config',
      storage: createJSONStorage(() => modelConfigStorage),
      partialize: (state) => ({
        visibility: state.visibility,
        presets: state.presets,
        activePreset: state.activePreset,
      }),
    },
  ),
)
