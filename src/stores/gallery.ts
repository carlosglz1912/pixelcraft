import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import type { GeneratedMediaBase, GeneratedMedia, PendingMedia } from '@/types'
import { persistMedia, type PersistedMediaResult } from '@/lib/persistence'
import { isFalUrl } from '@/lib/utils/url'
import { getUserId } from '@/lib/user'

interface GalleryState {
  items: GeneratedMedia[]
  pendingItems: PendingMedia[]
  isPersisting: boolean
  add: (item: GeneratedMediaBase) => string
  addWithPersistence: (item: GeneratedMediaBase) => Promise<string>
  addPending: (item: Omit<PendingMedia, 'id' | 'createdAt'>, count?: number) => string[]
  removePending: (ids?: string[]) => void
  remove: (id: string) => void
  clear: () => void
  getById: (id: string) => GeneratedMedia | undefined
  updateItem: (id: string, updates: Partial<GeneratedMedia>) => void
  migrateItemToR2: (id: string) => Promise<boolean>
}

const MAX_PERSISTED_ITEMS = 100
const MAX_PERSISTED_PENDING_ITEMS = 25

function isEphemeralUrl(url?: string) {
  return Boolean(url && (url.startsWith('data:') || url.startsWith('blob:')))
}

function sanitizeItemForPersistence(item: GeneratedMedia): GeneratedMedia | null {
  if (isEphemeralUrl(item.url)) {
    return null
  }

  const filteredReferences = item.metadata?.references?.filter((reference) => !isEphemeralUrl(reference))

  return {
    ...item,
    metadata: item.metadata
      ? {
          ...item.metadata,
          source: isEphemeralUrl(item.metadata.source) ? undefined : item.metadata.source,
          references: filteredReferences?.length ? filteredReferences : undefined,
        }
      : undefined,
  }
}

const galleryStorage: StateStorage = {
  getItem: (name) => {
    if (typeof window === 'undefined') return null
    return window.localStorage.getItem(name)
  },
  setItem: (name, value) => {
    if (typeof window === 'undefined') return

    try {
      window.localStorage.setItem(name, value)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.warn('[gallery.persist] Local storage quota exceeded; skipping persistence update.', error)
        return
      }

      throw error
    }
  },
  removeItem: (name) => {
    if (typeof window === 'undefined') return
    window.localStorage.removeItem(name)
  },
}

export const useGallery = create<GalleryState>()(
  persist(
    (set, get) => ({
      items: [],
      pendingItems: [],
      isPersisting: false,
      
      add: (item) => {
        const id = crypto.randomUUID()
        const newItem: GeneratedMedia = {
          ...item,
          id,
          createdAt: new Date(),
        }
        set((state) => ({ items: [newItem, ...state.items] }))
        return id
      },

      addPending: (item, count = 1) => {
        const safeCount = Math.max(1, count)
        const nextPending = Array.from({ length: safeCount }, () => ({
          ...item,
          id: crypto.randomUUID(),
          createdAt: new Date(),
        }))

        set((state) => ({ pendingItems: [...nextPending, ...state.pendingItems] }))

        return nextPending.map((pending) => pending.id)
      },

      removePending: (ids) => {
        if (!ids?.length) {
          set({ pendingItems: [] })
          return
        }

        const pendingIds = new Set(ids)
        set((state) => ({
          pendingItems: state.pendingItems.filter((item) => !pendingIds.has(item.id)),
        }))
      },
      
      addWithPersistence: async (item) => {
        const id = get().add(item)
        const userId = getUserId()
        
        set({ isPersisting: true })
        
        try {
          const result: PersistedMediaResult = await persistMedia({
            url: item.url,
            type: item.type,
            prompt: item.prompt,
            model: item.model,
            costTier: item.costTier,
            userId,
            metadata: {
              seed: item.metadata?.seed,
              duration: item.metadata?.duration ? parseFloat(item.metadata.duration) : undefined,
              aspectRatio: item.metadata?.aspectRatio,
              resolution: item.metadata?.resolution,
              negativePrompt: item.metadata?.negativePrompt,
            },
          })
          
          if (result.persisted) {
            get().updateItem(id, {
              url: result.url,
              metadata: {
                ...item.metadata,
                storageId: result.storageId,
                persisted: true,
                userId,
              },
            })
          }
        } catch (error) {
          console.error('Failed to persist media:', error)
        } finally {
          set({ isPersisting: false })
        }
        
        return id
      },
      
      remove: (id) => {
        set((state) => ({ items: state.items.filter((i) => i.id !== id) }))
      },
      
      clear: () => set({ items: [] }),
      
      getById: (id) => get().items.find((i) => i.id === id),
      
      updateItem: (id, updates) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, ...updates } : item
          ),
        }))
      },

      migrateItemToR2: async (id) => {
        const item = get().getById(id)
        if (!item) return false
        
        if (item.metadata?.persisted) return true
        
        if (!isFalUrl(item.url)) return false
        
        const userId = getUserId()
        set({ isPersisting: true })
        
        try {
          const result: PersistedMediaResult = await persistMedia({
            url: item.url,
            type: item.type,
            prompt: item.prompt,
            model: item.model,
            costTier: item.costTier,
            userId,
            metadata: {
              seed: item.metadata?.seed,
              duration: item.metadata?.duration ? parseFloat(item.metadata.duration) : undefined,
              aspectRatio: item.metadata?.aspectRatio,
              resolution: item.metadata?.resolution,
              negativePrompt: item.metadata?.negativePrompt,
            },
          })
          
          if (result.persisted) {
            get().updateItem(id, {
              url: result.url,
              metadata: {
                ...item.metadata,
                storageId: result.storageId,
                persisted: true,
                userId,
              },
            })
            return true
          }
          
          return false
        } catch (error) {
          console.error('Failed to migrate item to R2:', error)
          return false
        } finally {
          set({ isPersisting: false })
        }
      },
    }),
    {
      name: 'pixelcraft-gallery',
      storage: createJSONStorage(() => galleryStorage),
      partialize: (state) => ({
        items: state.items
          .map(sanitizeItemForPersistence)
          .filter((item): item is GeneratedMedia => item !== null)
          .slice(0, MAX_PERSISTED_ITEMS),
        pendingItems: state.pendingItems.slice(0, MAX_PERSISTED_PENDING_ITEMS),
      }),
    }
  )
)
