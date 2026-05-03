import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import type { Collection, CollectionColor } from '@/types'
import { getUserId } from '@/lib/user'

// ── Storage with QuotaExceededError handling ───────────────────────

const collectionsStorage: StateStorage = {
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
        console.warn('[collections.persist] Local storage quota exceeded; skipping persistence update.', error)
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

// ── Convex API helpers ─────────────────────────────────────────────

function getConvexSiteUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!url) return null
  // Convert wss://xxx.convex.cloud to https://xxx.convex.site
  return url.replace('wss://', 'https://').replace('.convex.cloud', '.convex.site')
}

interface ConvexCollection {
  _id: string
  _creationTime: number
  name: string
  description?: string
  itemIds: string[]
  coverImageId?: string
  color?: string
  createdAt: number
  updatedAt: number
  userId?: string
}

function convexToLocal(cc: ConvexCollection): Collection {
  return {
    id: cc._id,
    name: cc.name,
    description: cc.description,
    itemIds: cc.itemIds ?? [],
    coverImageId: cc.coverImageId,
    color: (cc.color as CollectionColor) || 'blue',
    createdAt: new Date(cc.createdAt),
    updatedAt: new Date(cc.updatedAt),
  }
}

// ── Validation ─────────────────────────────────────────────────────

const MAX_NAME_LENGTH = 100
const MAX_DESCRIPTION_LENGTH = 500

function validateName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('[collections] name must not be empty')
  return trimmed.slice(0, MAX_NAME_LENGTH)
}

function validateDescription(description: string | undefined): string | undefined {
  if (!description) return undefined
  return description.trim().slice(0, MAX_DESCRIPTION_LENGTH) || undefined
}

// ── Store interface ────────────────────────────────────────────────

interface CollectionsState {
  collections: Collection[]
  isSyncing: boolean
  hydratedFromConvex: boolean

  create(data: {
    name: string
    description?: string
    color?: CollectionColor
    coverImageId?: string
  }): string

  update(
    id: string,
    data: Partial<Pick<Collection, 'name' | 'description' | 'coverImageId' | 'color'>>
  ): void

  remove(id: string): void

  addItems(collectionId: string, itemIds: string[]): void

  removeItems(collectionId: string, itemIds: string[]): void

  getById(id: string): Collection | undefined

  getCollectionsForItem(itemId: string): Collection[]

  hydrateFromConvex(): Promise<void>

  syncToConvex(): Promise<void>
}

// ── Store implementation ───────────────────────────────────────────

export const useCollections = create<CollectionsState>()(
  persist(
    (set, get) => ({
      collections: [],
      isSyncing: false,
      hydratedFromConvex: false,

      create: (data) => {
        const id = crypto.randomUUID()
        const now = new Date()
        const collection: Collection = {
          id,
          name: validateName(data.name),
          description: validateDescription(data.description),
          itemIds: [],
          coverImageId: data.coverImageId,
          color: data.color ?? 'blue',
          createdAt: now,
          updatedAt: now,
        }

        set((state) => ({
          collections: [collection, ...state.collections],
        }))

        // Fire-and-forget sync to Convex
        void get().syncToConvex()

        return id
      },

      update: (id, data) => {
        set((state) => ({
          collections: state.collections.map((c) => {
            if (c.id !== id) return c
            return {
              ...c,
              ...(data.name !== undefined ? { name: validateName(data.name) } : {}),
              ...(data.description !== undefined ? { description: validateDescription(data.description) } : {}),
              ...(data.coverImageId !== undefined ? { coverImageId: data.coverImageId } : {}),
              ...(data.color !== undefined ? { color: data.color } : {}),
              updatedAt: new Date(),
            }
          }),
        }))

        void get().syncToConvex()
      },

      remove: (id) => {
        set((state) => ({
          collections: state.collections.filter((c) => c.id !== id),
        }))

        void get().syncToConvex()
      },

      addItems: (collectionId, itemIds) => {
        const itemIdSet = new Set(itemIds)
        if (itemIdSet.size === 0) return

        set((state) => ({
          collections: state.collections.map((c) => {
            if (c.id !== collectionId) return c
            const existing = new Set(c.itemIds)
            const toAdd = itemIds.filter((id) => !existing.has(id))
            if (toAdd.length === 0) return c
            return {
              ...c,
              itemIds: [...c.itemIds, ...toAdd],
              updatedAt: new Date(),
            }
          }),
        }))

        void get().syncToConvex()
      },

      removeItems: (collectionId, itemIds) => {
        const toRemove = new Set(itemIds)
        if (toRemove.size === 0) return

        set((state) => ({
          collections: state.collections.map((c) => {
            if (c.id !== collectionId) return c
            const remaining = c.itemIds.filter((id) => !toRemove.has(id))
            if (remaining.length === c.itemIds.length) return c
            return {
              ...c,
              itemIds: remaining,
              updatedAt: new Date(),
            }
          }),
        }))

        void get().syncToConvex()
      },

      getById: (id) => get().collections.find((c) => c.id === id),

      getCollectionsForItem: (itemId) =>
        get().collections.filter((c) => c.itemIds.includes(itemId)),

      hydrateFromConvex: async () => {
        if (get().hydratedFromConvex) return

        const siteUrl = getConvexSiteUrl()
        if (!siteUrl) {
          // Convex not configured — local-only mode
          set({ hydratedFromConvex: true })
          return
        }

        try {
          const userId = getUserId()
          const response = await fetch(`${siteUrl}/api/collections/list?userId=${encodeURIComponent(userId)}`)

          if (!response.ok) {
            console.warn('[collections] Convex hydration failed with status:', response.status)
            set({ hydratedFromConvex: true })
            return
          }

          const remoteCollections = (await response.json()) as ConvexCollection[]
          if (!Array.isArray(remoteCollections) || remoteCollections.length === 0) {
            set({ hydratedFromConvex: true })
            return
          }

          const remoteMap = new Map<string, Collection>()
          for (const rc of remoteCollections) {
            try {
              remoteMap.set(rc._id, convexToLocal(rc))
            } catch {
              // Skip malformed entries
            }
          }

          set((state) => {
            // Merge: local data wins when updatedAt is more recent
            const localMap = new Map<string, Collection>()
            for (const c of state.collections) {
              localMap.set(c.id, c)
            }

            const merged = new Map<string, Collection>()

            // Add all remote collections first
            for (const [id, rc] of remoteMap) {
              const local = localMap.get(id)
              if (!local) {
                merged.set(id, rc)
              } else {
                // Keep whichever has the more recent updatedAt
                const localTime = new Date(local.updatedAt).getTime()
                const remoteTime = new Date(rc.updatedAt).getTime()
                merged.set(id, localTime >= remoteTime ? local : rc)
              }
            }

            // Add local-only collections (not in remote)
            for (const [id, c] of localMap) {
              if (!merged.has(id)) {
                merged.set(id, c)
              }
            }

            // Sort by updatedAt descending
            const sorted = Array.from(merged.values()).sort(
              (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
            )

            return {
              collections: sorted,
              hydratedFromConvex: true,
            }
          })
        } catch (error) {
          console.error('[collections] Failed to hydrate from Convex:', error)
          set({ hydratedFromConvex: true })
        }
      },

      syncToConvex: async () => {
        const siteUrl = getConvexSiteUrl()
        if (!siteUrl) return // Local-only mode

        set({ isSyncing: true })

        try {
          const userId = getUserId()
          const collections = get().collections

          for (const collection of collections) {
            try {
              // Try to create — if it already exists (has a Convex _id format), update instead
              const isConvexId = collection.id.includes('|') || collection.id.length > 30

              if (isConvexId) {
                // Update existing
                await fetch(`${siteUrl}/api/collections/update`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    id: collection.id,
                    name: collection.name,
                    description: collection.description,
                    coverImageId: collection.coverImageId,
                    color: collection.color,
                  }),
                })
              } else {
                // Create new
                const response = await fetch(`${siteUrl}/api/collections/create`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    name: collection.name,
                    description: collection.description,
                    color: collection.color,
                    itemIds: collection.itemIds,
                    coverImageId: collection.coverImageId,
                    userId,
                  }),
                })

                if (response.ok) {
                  const result = await response.json()
                  if (result.id && result.id !== collection.id) {
                    // Update local state with Convex ID
                    set((state) => ({
                      collections: state.collections.map((c) =>
                        c.id === collection.id ? { ...c, id: result.id } : c
                      ),
                    }))
                  }
                }
              }
            } catch (error) {
              console.error('[collections] Failed to sync collection:', collection.id, error)
              // Continue syncing other collections
            }
          }
        } catch (error) {
          console.error('[collections] syncToConvex failed:', error)
        } finally {
          set({ isSyncing: false })
        }
      },
    }),
    {
      name: 'pixelcraft-collections',
      storage: createJSONStorage(() => collectionsStorage),
      partialize: (state) => ({
        collections: state.collections,
      }),
    }
  )
)
