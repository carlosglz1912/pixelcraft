import { create } from 'zustand'
import type { Id } from '../../convex/_generated/dataModel'
import type { Collection, CollectionColor } from '@/types'
import { getConvexClient } from '@/lib/convex-client'
import { getUserId } from '@/lib/user'
import { api } from '../../convex/_generated/api'

// ── Convex document → local Collection mapping ─────────────────────

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

function convexDocToCollection(cc: ConvexCollection): Collection {
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

// ── Module-scoped subscription handle ──────────────────────────────

let _unsubscribe: (() => void) | null = null

// ── Store interface ────────────────────────────────────────────────

interface CollectionsState {
  collections: Collection[]
  isLoading: boolean
  error: string | null

  create(data: {
    name: string
    description?: string
    color?: CollectionColor
    coverImageId?: string
  }): Promise<string>

  update(
    id: string,
    data: Partial<Pick<Collection, 'name' | 'description' | 'coverImageId' | 'color'>>
  ): void

  remove(id: string): void

  addItems(collectionId: string, itemIds: string[]): void

  removeItems(collectionId: string, itemIds: string[]): void

  getById(id: string): Collection | undefined

  getCollectionsForItem(itemId: string): Collection[]

  init(): void

  cleanup(): void
}

// ── Migration helper ───────────────────────────────────────────────

const MIGRATION_FLAG = 'pixelcraft-collections-migrated'
const OLD_STORAGE_KEY = 'pixelcraft-collections'

interface LegacyPersistedCollection {
  id: string
  name: string
  description?: string
  itemIds: string[]
  coverImageId?: string
  color: CollectionColor
  createdAt: string
  updatedAt: string
}

async function runMigrationIfNeeded(client: NonNullable<ReturnType<typeof getConvexClient>>): Promise<void> {
  if (typeof window === 'undefined') return

  const alreadyMigrated = localStorage.getItem(MIGRATION_FLAG)
  if (alreadyMigrated) return

  const raw = localStorage.getItem(OLD_STORAGE_KEY)
  if (!raw) {
    // No old data — just mark as migrated
    localStorage.setItem(MIGRATION_FLAG, 'true')
    return
  }

  try {
    const parsed = JSON.parse(raw) as { state?: { collections?: LegacyPersistedCollection[] } }
    const oldCollections = parsed?.state?.collections ?? []

    if (!Array.isArray(oldCollections) || oldCollections.length === 0) {
      localStorage.setItem(MIGRATION_FLAG, 'true')
      return
    }

    const userId = getUserId()

    for (const c of oldCollections) {
      try {
        await client.mutation(api.collections.create, {
          name: c.name,
          description: c.description,
          color: c.color,
          itemIds: c.itemIds ?? [],
          coverImageId: c.coverImageId,
          userId,
        })
      } catch (err) {
        console.warn('[collections] Migration: failed to migrate collection', c.id, err)
      }
    }

    localStorage.setItem(MIGRATION_FLAG, 'true')
    // Clear old localStorage data — Convex is now the source of truth
    localStorage.removeItem(OLD_STORAGE_KEY)
  } catch (err) {
    console.error('[collections] Migration failed:', err)
    // Mark as migrated anyway to prevent retrying on every load
    localStorage.setItem(MIGRATION_FLAG, 'true')
  }
}

// ── Store implementation ───────────────────────────────────────────

export const useCollections = create<CollectionsState>()((set, get) => ({
  collections: [],
  isLoading: false,
  error: null,

  init: () => {
    const client = getConvexClient()
    if (!client) {
      console.warn('[collections] Convex client not available — running in local-only mode')
      set({ isLoading: false })
      return
    }

    set({ isLoading: true })

    // Run migration before starting subscription
    void (async () => {
      try {
        await runMigrationIfNeeded(client)
      } catch (err) {
        console.error('[collections] Migration error:', err)
      }

      // Start watchQuery subscription
      const userId = getUserId()

      try {
        const watch = client.watchQuery(api.collections.listByUser, { userId })

        _unsubscribe = watch.onUpdate(() => {
          const docs = watch.localQueryResult() as ConvexCollection[] | undefined
          if (!docs) {
            // Still loading — keep current state
            return
          }

          const collections = docs.map(convexDocToCollection)
          // Sort by updatedAt descending
          collections.sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          )

          set({ collections, isLoading: false, error: null })
        })
      } catch (err) {
        console.error('[collections] Subscription error:', err)
        set({ isLoading: false, error: 'Failed to subscribe to collections' })
      }
    })()
  },

  cleanup: () => {
    if (_unsubscribe) {
      _unsubscribe()
      _unsubscribe = null
    }
  },

  create: async (data) => {
    const client = getConvexClient()
    if (!client) {
      throw new Error('[collections] Convex client not available')
    }

    const name = validateName(data.name)
    const description = validateDescription(data.description)
    const userId = getUserId()

    try {
      const id = await client.mutation(api.collections.create, {
        name,
        description,
        color: data.color,
        itemIds: [],
        coverImageId: data.coverImageId,
        userId,
      })
      // No local state update needed — watchQuery subscription will push the new collection
      return id as string
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create collection'
      console.warn('[collections] Create error:', msg)
      set({ error: msg })
      throw err
    }
  },

  update: (id, data) => {
    const client = getConvexClient()
    if (!client) return

    const mutationArgs: { id: Id<"collections">; name?: string; description?: string; coverImageId?: string; color?: string } = {
      id: id as Id<"collections">,
    }
    if (data.name !== undefined) mutationArgs.name = validateName(data.name)
    if (data.description !== undefined) mutationArgs.description = validateDescription(data.description)
    if (data.coverImageId !== undefined) mutationArgs.coverImageId = data.coverImageId
    if (data.color !== undefined) mutationArgs.color = data.color

    void client.mutation(api.collections.update, mutationArgs).catch((err) => {
      const msg = err instanceof Error ? err.message : 'Failed to update collection'
      console.warn('[collections] Update error:', msg)
      set({ error: msg })
    })
    // No local state update — watchQuery will push the update
  },

  remove: (id) => {
    const client = getConvexClient()
    if (!client) return

    void client.mutation(api.collections.remove, { id: id as Id<"collections"> }).catch((err) => {
      const msg = err instanceof Error ? err.message : 'Failed to remove collection'
      console.warn('[collections] Remove error:', msg)
      set({ error: msg })
    })
  },

  addItems: (collectionId, itemIds) => {
    const itemIdSet = new Set(itemIds)
    if (itemIdSet.size === 0) return

    const client = getConvexClient()
    if (!client) return

    void client.mutation(api.collections.addItems, {
      id: collectionId as Id<"collections">,
      itemIds,
    }).catch((err) => {
      const msg = err instanceof Error ? err.message : 'Failed to add items to collection'
      console.warn('[collections] AddItems error:', msg)
      set({ error: msg })
    })
  },

  removeItems: (collectionId, itemIds) => {
    const toRemove = new Set(itemIds)
    if (toRemove.size === 0) return

    const client = getConvexClient()
    if (!client) return

    void client.mutation(api.collections.removeItems, {
      id: collectionId as Id<"collections">,
      itemIds,
    }).catch((err) => {
      const msg = err instanceof Error ? err.message : 'Failed to remove items from collection'
      console.warn('[collections] RemoveItems error:', msg)
      set({ error: msg })
    })
  },

  getById: (id) => get().collections.find((c) => c.id === id),

  getCollectionsForItem: (itemId) =>
    get().collections.filter((c) => c.itemIds.includes(itemId)),
}))
