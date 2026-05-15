import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useModelConfig, type ModelConfigState } from '../model-config'

// ---------------------------------------------------------------------------
// LocalStorage mock
// ---------------------------------------------------------------------------

const localStorageStore: Record<string, string> = {}

beforeEach(() => {
  // Clear mock localStorage
  Object.keys(localStorageStore).forEach((k) => delete localStorageStore[k])

  // Reset the Zustand store to its default state before each test.
  // We re-create the initial state to avoid stale closures.
  useModelConfig.setState({
    visibility: {
      hiddenFamilies: { image: {}, video: {} },
      hiddenModels: { image: {}, video: {} },
    },
    presets: [],
    activePreset: null,
  })
})

// Mock localStorage for the persist middleware (vitest runs in node)
vi.stubGlobal('localStorage', {
  getItem: (name: string) => localStorageStore[name] ?? null,
  setItem: (name: string, value: string) => {
    localStorageStore[name] = value
  },
  removeItem: (name: string) => {
    delete localStorageStore[name]
  },
  clear: () => {
    Object.keys(localStorageStore).forEach((k) => delete localStorageStore[k])
  },
  get length() {
    return Object.keys(localStorageStore).length
  },
  key: (index: number) => Object.keys(localStorageStore)[index] ?? null,
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('model-config store', () => {
  // ---------------------------------------------------------------------------
  // Default state
  // ---------------------------------------------------------------------------

  describe('default state', () => {
    it('should have no hidden families by default', () => {
      const { visibility } = useModelConfig.getState()
      expect(visibility.hiddenFamilies.image).toEqual({})
      expect(visibility.hiddenFamilies.video).toEqual({})
    })

    it('should have no hidden models by default', () => {
      const { visibility } = useModelConfig.getState()
      expect(visibility.hiddenModels.image).toEqual({})
      expect(visibility.hiddenModels.video).toEqual({})
    })

    it('should have empty presets and null activePreset', () => {
      const { presets, activePreset } = useModelConfig.getState()
      expect(presets).toEqual([])
      expect(activePreset).toBeNull()
    })
  })

  // ---------------------------------------------------------------------------
  // Family visibility
  // ---------------------------------------------------------------------------

  describe('toggleFamily', () => {
    it('should hide a family on first toggle', () => {
      useModelConfig.getState().toggleFamily('image', 'flux')
      expect(useModelConfig.getState().visibility.hiddenFamilies.image.flux).toBe(true)
    })

    it('should show a family on second toggle (key removed)', () => {
      useModelConfig.getState().toggleFamily('image', 'flux')
      useModelConfig.getState().toggleFamily('image', 'flux')
      expect(useModelConfig.getState().visibility.hiddenFamilies.image.flux).toBeUndefined()
    })

    it('should clear activePreset when toggling', () => {
      // Save a preset so we have an active one
      useModelConfig.getState().savePreset('my-preset')
      expect(useModelConfig.getState().activePreset).toBe('my-preset')

      useModelConfig.getState().toggleFamily('image', 'flux')
      expect(useModelConfig.getState().activePreset).toBeNull()
    })
  })

  describe('isFamilyVisible', () => {
    it('should return true for unknown families (default visible)', () => {
      expect(useModelConfig.getState().isFamilyVisible('image', 'nonexistent')).toBe(true)
    })

    it('should return false for hidden families', () => {
      useModelConfig.getState().toggleFamily('image', 'flux')
      expect(useModelConfig.getState().isFamilyVisible('image', 'flux')).toBe(false)
    })

    it('should return true for visible families', () => {
      expect(useModelConfig.getState().isFamilyVisible('image', 'flux')).toBe(true)
    })
  })

  // ---------------------------------------------------------------------------
  // Model visibility
  // ---------------------------------------------------------------------------

  describe('toggleModel', () => {
    it('should hide a model on first toggle', () => {
      useModelConfig.getState().toggleModel('image', 'flux/dev')
      expect(useModelConfig.getState().visibility.hiddenModels.image['flux/dev']).toBe(true)
    })

    it('should show a model on second toggle (key removed)', () => {
      useModelConfig.getState().toggleModel('image', 'flux/dev')
      useModelConfig.getState().toggleModel('image', 'flux/dev')
      expect(useModelConfig.getState().visibility.hiddenModels.image['flux/dev']).toBeUndefined()
    })

    it('should clear activePreset when toggling', () => {
      useModelConfig.getState().savePreset('test-preset')
      useModelConfig.getState().toggleModel('video', 'kling/v3-pro')
      expect(useModelConfig.getState().activePreset).toBeNull()
    })
  })

  describe('isModelVisible', () => {
    it('should return true for unknown models (default visible)', () => {
      expect(useModelConfig.getState().isModelVisible('image', 'nonexistent-model')).toBe(true)
    })

    it('should return false for hidden models', () => {
      useModelConfig.getState().toggleModel('image', 'flux/dev')
      expect(useModelConfig.getState().isModelVisible('image', 'flux/dev')).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // getVisibleFamilies
  // ---------------------------------------------------------------------------

  describe('getVisibleFamilies', () => {
    it('should return all families when none are hidden', () => {
      const visible = useModelConfig.getState().getVisibleFamilies('image')
      // Should include known image family keys
      expect(visible).toContain('flux')
      expect(visible).toContain('recraft')
      expect(visible).toContain('openai')
    })

    it('should exclude hidden families', () => {
      useModelConfig.getState().toggleFamily('image', 'flux')
      const visible = useModelConfig.getState().getVisibleFamilies('image')
      expect(visible).not.toContain('flux')
      expect(visible).toContain('recraft')
    })

    it('should return video families for video mode', () => {
      const visible = useModelConfig.getState().getVisibleFamilies('video')
      expect(visible).toContain('kling')
      expect(visible).toContain('minimax')
    })
  })

  // ---------------------------------------------------------------------------
  // Cross-mode isolation
  // ---------------------------------------------------------------------------

  describe('cross-mode isolation', () => {
    it('should not affect video families when hiding an image family', () => {
      useModelConfig.getState().toggleFamily('image', 'flux')
      expect(useModelConfig.getState().isFamilyVisible('image', 'flux')).toBe(false)
      // Video mode should be unaffected
      expect(useModelConfig.getState().visibility.hiddenFamilies.video).toEqual({})
    })

    it('should not affect image models when hiding a video model', () => {
      useModelConfig.getState().toggleModel('video', 'kling/v3-pro')
      expect(useModelConfig.getState().isModelVisible('video', 'kling/v3-pro')).toBe(false)
      expect(useModelConfig.getState().visibility.hiddenModels.image).toEqual({})
    })
  })

  // ---------------------------------------------------------------------------
  // Preset CRUD
  // ---------------------------------------------------------------------------

  describe('savePreset', () => {
    it('should create a preset with current visibility snapshot', () => {
      // Hide a family before saving
      useModelConfig.getState().toggleFamily('image', 'flux')

      useModelConfig.getState().savePreset('my-preset')

      const { presets, activePreset } = useModelConfig.getState()
      expect(presets).toHaveLength(1)
      expect(presets[0].name).toBe('my-preset')
      expect(presets[0].config.hiddenFamilies.image.flux).toBe(true)
      expect(presets[0].createdAt).toBeTypeOf('number')
      expect(activePreset).toBe('my-preset')
    })

    it('should throw on duplicate preset name', () => {
      useModelConfig.getState().savePreset('dupe')
      expect(() => useModelConfig.getState().savePreset('dupe')).toThrow(/already exists/)
    })
  })

  describe('loadPreset', () => {
    it('should restore saved visibility state and set activePreset', () => {
      useModelConfig.getState().toggleFamily('image', 'flux')
      useModelConfig.getState().savePreset('hidden-flux')

      // Reset state manually
      useModelConfig.setState({
        visibility: {
          hiddenFamilies: { image: {}, video: {} },
          hiddenModels: { image: {}, video: {} },
        },
        activePreset: null,
      })

      expect(useModelConfig.getState().isFamilyVisible('image', 'flux')).toBe(true)

      useModelConfig.getState().loadPreset('hidden-flux')

      expect(useModelConfig.getState().isFamilyVisible('image', 'flux')).toBe(false)
      expect(useModelConfig.getState().activePreset).toBe('hidden-flux')
    })

    it('should warn and do nothing for missing preset', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      useModelConfig.getState().loadPreset('nonexistent')
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('not found'))
      warnSpy.mockRestore()
    })
  })

  describe('deletePreset', () => {
    it('should remove the preset', () => {
      useModelConfig.getState().savePreset('to-delete')
      useModelConfig.getState().deletePreset('to-delete')
      expect(useModelConfig.getState().presets).toHaveLength(0)
    })

    it('should clear activePreset if the deleted preset was active', () => {
      useModelConfig.getState().savePreset('active-one')
      expect(useModelConfig.getState().activePreset).toBe('active-one')

      useModelConfig.getState().deletePreset('active-one')
      expect(useModelConfig.getState().activePreset).toBeNull()
    })

    it('should keep activePreset if a different preset was deleted', () => {
      useModelConfig.getState().savePreset('keep')
      useModelConfig.getState().savePreset('remove')

      // "keep" is active since it was the last saved, but savePreset sets
      // activePreset to the name just saved. After savePreset('remove'),
      // activePreset = 'remove'. Let's re-load 'keep' to make it active.
      useModelConfig.getState().loadPreset('keep')
      useModelConfig.getState().deletePreset('remove')

      expect(useModelConfig.getState().activePreset).toBe('keep')
    })
  })

  describe('renamePreset', () => {
    it('should change the preset name and preserve config', () => {
      useModelConfig.getState().toggleFamily('video', 'kling')
      useModelConfig.getState().savePreset('old-name')

      const originalConfig = useModelConfig.getState().presets[0].config

      useModelConfig.getState().renamePreset('old-name', 'new-name')

      const preset = useModelConfig.getState().presets[0]
      expect(preset.name).toBe('new-name')
      expect(preset.config).toEqual(originalConfig)
    })

    it('should update activePreset if the renamed preset was active', () => {
      useModelConfig.getState().savePreset('before-rename')
      expect(useModelConfig.getState().activePreset).toBe('before-rename')

      useModelConfig.getState().renamePreset('before-rename', 'after-rename')
      expect(useModelConfig.getState().activePreset).toBe('after-rename')
    })

    it('should throw if new name already exists', () => {
      useModelConfig.getState().savePreset('first')
      useModelConfig.getState().savePreset('second')
      // Both presets saved; activePreset is 'second'. Need 'first' in presets too.
      // Both are there since we didn't delete.
      expect(() =>
        useModelConfig.getState().renamePreset('first', 'second'),
      ).toThrow(/already exists/)
    })
  })
})
