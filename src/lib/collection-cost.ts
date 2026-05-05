import type { Collection, CostTier, GeneratedMedia } from '@/types'

const COST_TIER_FALLBACKS: Record<CostTier, number> = {
  free: 0,
  low: 0.01,
  medium: 0.05,
  high: 0.15,
  premium: 0.50,
}

/**
 * Returns a fallback USD cost when an item has no estimatedCost.
 * Maps costTier to a reasonable default.
 */
export function getCostTierFallback(tier: CostTier): number {
  return COST_TIER_FALLBACKS[tier] ?? 0.05
}

/**
 * Filters gallery items that belong to a collection by matching item IDs.
 */
export function getCollectionItems(
  items: GeneratedMedia[],
  collection: Collection
): GeneratedMedia[] {
  const idSet = new Set(collection.itemIds)
  return items.filter((item) => idSet.has(item.id))
}

/**
 * Calculates the total USD cost of a set of gallery items.
 * Uses estimatedCost from metadata when available, falls back to costTier.
 * Returns USD total plus a per-item breakdown.
 */
export function calculateCollectionCost(items: GeneratedMedia[]): {
  totalUsd: number
  breakdown: { itemId: string; cost: number }[]
} {
  if (items.length === 0) {
    return { totalUsd: 0, breakdown: [] }
  }

  const breakdown = items.map((item) => {
    const estimatedCost = item.metadata?.estimatedCost
    const cost =
      estimatedCost != null && estimatedCost > 0
        ? estimatedCost
        : item.costTier
          ? getCostTierFallback(item.costTier)
          : 0

    return { itemId: item.id, cost }
  })

  const totalUsd = breakdown.reduce((sum, entry) => sum + entry.cost, 0)

  return {
    totalUsd: Math.round(totalUsd * 10000) / 10000,
    breakdown,
  }
}
