import type { Collection, CostTier, GeneratedMedia } from '@/types'
import { estimateImageGenerationCost, estimateVideoGenerationCost } from '@/lib/cost-estimate'

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
 * Attempts to recalculate cost from model + metadata.
 * Returns null when insufficient information is available.
 */
function recalculateCost(item: GeneratedMedia): number | null {
  const model = item.model ?? ''
  const meta = item.metadata

  const imageEstimate = estimateImageGenerationCost({
    model,
    imageSize: meta?.imageSize,
    resolution: meta?.imageResolution ?? meta?.resolution,
    numImages: 1,
    style: meta?.imageStyle,
    quality: meta?.imageQuality,
  })
  if (imageEstimate != null) return imageEstimate.amount

  const videoEstimate = estimateVideoGenerationCost({
    model,
    mode: meta?.videoMode ?? 'image-to-video',
    duration: meta?.duration,
    resolution: meta?.resolution,
    aspectRatio: meta?.aspectRatio,
    generateAudio: false,
    numFrames: meta?.numFrames,
  })
  if (videoEstimate != null) return videoEstimate.amount

  return null
}

/**
 * Calculates the total USD cost of a set of gallery items.
 * Uses estimatedCost from metadata when available, then tries to recalculate
 * from model + metadata, then falls back to costTier.
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
    // 1. Stored estimatedCost
    const estimatedCost = item.metadata?.estimatedCost
    if (estimatedCost != null && estimatedCost > 0) {
      return { itemId: item.id, cost: estimatedCost }
    }

    // 2. Recalculate from model + metadata
    const recalculated = recalculateCost(item)
    if (recalculated != null && recalculated > 0) {
      return { itemId: item.id, cost: recalculated }
    }

    // 3. costTier fallback
    if (item.costTier) {
      return { itemId: item.id, cost: getCostTierFallback(item.costTier) }
    }

    return { itemId: item.id, cost: 0 }
  })

  const totalUsd = breakdown.reduce((sum, entry) => sum + entry.cost, 0)

  return {
    totalUsd: Math.round(totalUsd * 10000) / 10000,
    breakdown,
  }
}
