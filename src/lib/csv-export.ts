import type { GeneratedMedia } from '@/types'
import {
  getImageModelConfig,
  getVideoModelConfig,
  getUpscaleModelConfig,
  getBgRemovalModelConfig,
  EDIT_MODELS,
  IMAGE_MODEL_FAMILIES,
  VIDEO_MODEL_FAMILIES,
  UPSCALE_MODELS,
  BG_REMOVAL_MODELS,
} from '@/types'
import { getCostTierFallback } from '@/lib/collection-cost'

/** A single row in the cost-per-model breakdown. */
export interface ModelCostRow {
  modelId: string
  displayName: string
  executions: number
  cost: number
}

/**
 * Resolves any model ID to a human-readable display name.
 *
 * Searches all 5 registries in order:
 *   1. Image model families
 *   2. Video model families
 *   3. Upscale models
 *   4. Background removal models
 *   5. Edit models (EDIT_MODELS const)
 *
 * Falls back to stripping `fal-ai/` prefix, then raw model ID.
 */
export function getModelDisplayName(modelId: string): string {
  // 1. Image families
  const imageConfig = getImageModelConfig(modelId)
  if (imageConfig) return imageConfig.name

  // 2. Video families — also check textToVideoModel keys
  const videoConfig = getVideoModelConfig(modelId)
  if (videoConfig) return videoConfig.name

  // Also check if modelId is a textToVideoModel endpoint
  for (const family of Object.values(VIDEO_MODEL_FAMILIES)) {
    for (const [key, config] of Object.entries(family.models)) {
      if (config.textToVideoModel === modelId) {
        return config.name
      }
    }
  }

  // 3. Upscale models
  const upscaleConfig = getUpscaleModelConfig(modelId)
  if (upscaleConfig) return upscaleConfig.name

  // 4. Background removal models
  const bgConfig = getBgRemovalModelConfig(modelId)
  if (bgConfig) return bgConfig.name

  // 5. Edit models
  if (EDIT_MODELS[modelId as keyof typeof EDIT_MODELS]) {
    return EDIT_MODELS[modelId as keyof typeof EDIT_MODELS].name
  }

  // Fallback: strip fal-ai/ prefix
  if (modelId.startsWith('fal-ai/')) {
    return modelId.slice(7)
  }

  return modelId
}

/**
 * Resolves the USD cost for a single gallery item.
 * Uses the same resolution strategy as collection-cost.ts:
 *   estimatedCost from metadata → costTier fallback → 0
 */
function resolveItemCost(item: GeneratedMedia): number {
  const estimatedCost = item.metadata?.estimatedCost
  if (estimatedCost != null && estimatedCost > 0) {
    return estimatedCost
  }
  if (item.costTier) {
    return getCostTierFallback(item.costTier)
  }
  return 0
}

/**
 * Groups gallery items by model, deduplicating by item ID.
 *
 * Items are deduplicated first (critical for multi-collection scenarios
 * where the same item can appear in multiple collections), then grouped
 * by model. Each group gets a count of executions and summed cost.
 *
 * Rows are sorted by cost descending.
 */
export function groupItemsByModel(items: GeneratedMedia[]): ModelCostRow[] {
  // Deduplicate by ID
  const seen = new Set<string>()
  const unique: GeneratedMedia[] = []
  for (const item of items) {
    if (!seen.has(item.id)) {
      seen.add(item.id)
      unique.push(item)
    }
  }

  // Group by model
  const groups = new Map<string, { count: number; cost: number }>()
  for (const item of unique) {
    const modelId = item.model
    const cost = resolveItemCost(item)
    const existing = groups.get(modelId)
    if (existing) {
      existing.count += 1
      existing.cost += cost
    } else {
      groups.set(modelId, { count: 1, cost })
    }
  }

  // Build rows sorted by cost descending
  const rows: ModelCostRow[] = []
  for (const [modelId, data] of groups) {
    rows.push({
      modelId,
      displayName: getModelDisplayName(modelId),
      executions: data.count,
      cost: Math.round(data.cost * 10000) / 10000,
    })
  }

  rows.sort((a, b) => b.cost - a.cost)
  return rows
}

/**
 * Escapes a CSV value by wrapping in double-quotes if it contains
 * commas, double-quotes, or newlines.
 */
function escapeCsvValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * Produces a CSV string from model cost rows.
 *
 * Columns: Model, Executions, Cost (USD)
 * Appends a Total row at the bottom.
 * Costs formatted to 4 decimal places.
 */
export function generateCostCSV(rows: ModelCostRow[]): string {
  const lines: string[] = ['Model,Executions,Cost (USD)']

  let totalCost = 0
  let totalExecutions = 0

  for (const row of rows) {
    lines.push(
      `${escapeCsvValue(row.displayName)},${row.executions},${row.cost.toFixed(4)}`
    )
    totalCost += row.cost
    totalExecutions += row.executions
  }

  lines.push(
    `${escapeCsvValue('Total')},${totalExecutions},${totalCost.toFixed(4)}`
  )

  return lines.join('\n')
}

/**
 * Main entry point for CSV export.
 *
 * Given a set of gallery items (potentially from multiple collections),
 * groups them by model, calculates costs, and returns both the CSV string
 * and structured data for UI preview.
 */
export function exportCollectionCostCSV(
  items: GeneratedMedia[],
  collectionNames?: string[]
): {
  csv: string
  rows: ModelCostRow[]
  totalCost: number
  totalExecutions: number
  collectionNames: string[]
} {
  const rows = groupItemsByModel(items)
  const csv = generateCostCSV(rows)

  const totalCost = Math.round(rows.reduce((sum, r) => sum + r.cost, 0) * 10000) / 10000
  const totalExecutions = rows.reduce((sum, r) => sum + r.executions, 0)

  return {
    csv,
    rows,
    totalCost,
    totalExecutions,
    collectionNames: collectionNames ?? [],
  }
}
