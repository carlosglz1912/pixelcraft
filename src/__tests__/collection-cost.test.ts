import { describe, expect, it } from 'bun:test'
import type { Collection, GeneratedMedia } from '@/types'
import {
  calculateCollectionCost,
  getCollectionItems,
  getCostTierFallback,
} from '@/lib/collection-cost'

function makeMedia(overrides: Partial<GeneratedMedia> = {}): GeneratedMedia {
  return {
    id: overrides.id ?? 'item-1',
    type: 'image',
    url: 'https://example.com/img.png',
    prompt: 'test',
    model: 'flux/dev',
    createdAt: new Date(),
    ...overrides,
  }
}

describe('getCostTierFallback', () => {
  it('returns 0 for free tier', () => {
    expect(getCostTierFallback('free')).toBe(0)
  })

  it('returns increasing amounts for higher tiers', () => {
    expect(getCostTierFallback('low')).toBeLessThan(getCostTierFallback('medium'))
    expect(getCostTierFallback('medium')).toBeLessThan(getCostTierFallback('high'))
    expect(getCostTierFallback('high')).toBeLessThan(getCostTierFallback('premium'))
  })
})

describe('getCollectionItems', () => {
  it('filters gallery items that belong to the collection', () => {
    const collection: Collection = {
      id: 'col-1',
      name: 'Test',
      itemIds: ['a', 'c'],
      color: 'blue',
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const items: GeneratedMedia[] = [
      makeMedia({ id: 'a' }),
      makeMedia({ id: 'b' }),
      makeMedia({ id: 'c' }),
    ]

    const result = getCollectionItems(items, collection)
    expect(result).toHaveLength(2)
    expect(result.map((i) => i.id)).toEqual(['a', 'c'])
  })

  it('returns empty array when no items match', () => {
    const collection: Collection = {
      id: 'col-1',
      name: 'Test',
      itemIds: ['x', 'y'],
      color: 'green',
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const items: GeneratedMedia[] = [makeMedia({ id: 'a' }), makeMedia({ id: 'b' })]

    expect(getCollectionItems(items, collection)).toEqual([])
  })

  it('returns empty array for empty gallery', () => {
    const collection: Collection = {
      id: 'col-1',
      name: 'Test',
      itemIds: ['a'],
      color: 'red',
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    expect(getCollectionItems([], collection)).toEqual([])
  })
})

describe('calculateCollectionCost', () => {
  it('returns zeros and empty breakdown for empty list', () => {
    const result = calculateCollectionCost([])
    expect(result).toEqual({ totalUsd: 0, breakdown: [] })
  })

  it('sums estimatedCost from metadata', () => {
    const items: GeneratedMedia[] = [
      makeMedia({
        id: 'item-1',
        metadata: { estimatedCost: 0.05 },
      }),
      makeMedia({
        id: 'item-2',
        metadata: { estimatedCost: 0.10 },
      }),
    ]

    const result = calculateCollectionCost(items)
    expect(result.totalUsd).toBe(0.15)
    expect(result.breakdown).toHaveLength(2)
    expect(result.breakdown[0].cost).toBe(0.05)
    expect(result.breakdown[1].cost).toBe(0.10)
  })

  it('recalculates cost from model when estimatedCost is missing', () => {
    // flux/dev model → estimateImageGenerationCost → $0.025/MP × 1 MP (default) = $0.025
    const items: GeneratedMedia[] = [
      makeMedia({
        id: 'item-1',
        model: 'flux/dev',
        costTier: 'high',
      }),
    ]

    const result = calculateCollectionCost(items)
    expect(result.totalUsd).toBe(0.025)
    expect(result.breakdown).toHaveLength(1)
  })

  it('recalculates cost from model when estimatedCost is 0', () => {
    // flux/dev with estimatedCost=0 triggers recalculation → $0.025
    const items: GeneratedMedia[] = [
      makeMedia({
        id: 'item-1',
        model: 'flux/dev',
        costTier: 'medium',
        metadata: { estimatedCost: 0 },
      }),
    ]

    const result = calculateCollectionCost(items)
    expect(result.totalUsd).toBe(0.025)
  })

  it('returns 0 cost when model is unknown and no estimatedCost', () => {
    // 'upload' model has no estimate function → returns null → 0
    const items: GeneratedMedia[] = [makeMedia({ id: 'item-1', model: 'upload' })]

    const result = calculateCollectionCost(items)
    expect(result.totalUsd).toBe(0)
    expect(result.breakdown[0].cost).toBe(0)
  })

  it('handles mixed items with estimatedCost, recalculation, and costTier fallback', () => {
    const items: GeneratedMedia[] = [
      makeMedia({
        id: 'item-1',
        metadata: { estimatedCost: 0.03 },
      }),
      makeMedia({
        id: 'item-2',
        model: 'flux/dev',
        costTier: 'low',
      }),
      makeMedia({
        id: 'item-3',
        costTier: 'premium',
        metadata: { estimatedCost: 0.50 },
      }),
    ]

    const result = calculateCollectionCost(items)
    // item-1: 0.03 (stored), item-2: recalculated flux/dev = 0.025, item-3: 0.50 (stored)
    expect(result.totalUsd).toBe(0.555)
    expect(result.breakdown).toHaveLength(3)
  })
})
