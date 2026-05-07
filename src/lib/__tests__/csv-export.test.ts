import { describe, expect, it } from 'vitest'
import type { GeneratedMedia } from '@/types'
import {
  getModelDisplayName,
  groupItemsByModel,
  generateCostCSV,
  exportCollectionCostCSV,
} from '@/lib/csv-export'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMedia(overrides: Partial<GeneratedMedia> = {}): GeneratedMedia {
  return {
    id: overrides.id ?? 'item-1',
    type: overrides.type ?? 'image',
    url: overrides.url ?? 'https://example.com/img.png',
    prompt: overrides.prompt ?? 'test',
    model: overrides.model ?? 'flux/dev',
    costTier: overrides.costTier,
    metadata: overrides.metadata,
    createdAt: overrides.createdAt ?? new Date('2025-01-01'),
  }
}

// ---------------------------------------------------------------------------
// getModelDisplayName
// ---------------------------------------------------------------------------

describe('getModelDisplayName', () => {
  it('resolves a known image model', () => {
    expect(getModelDisplayName('flux/dev')).toBe('Dev')
  })

  it('resolves a known video model', () => {
    expect(getModelDisplayName('kling-video/v3/pro/image-to-video')).toBe('v3 Pro')
  })

  it('resolves a known upscale model', () => {
    expect(getModelDisplayName('fal-ai/topaz/upscale/image')).toBe('Topaz (Pro)')
  })

  it('resolves a known bg-removal model', () => {
    expect(getModelDisplayName('fal-ai/bria/background/remove')).toBe('Bria RMBG 2.0 (Pro)')
  })

  it('resolves a known edit model', () => {
    expect(getModelDisplayName('flux/dev/image-to-image')).toBe('Flux I2I')
  })

  it('strips fal-ai/ prefix for unknown models', () => {
    expect(getModelDisplayName('fal-ai/some-new-model')).toBe('some-new-model')
  })

  it('returns raw model ID as fallback for completely unknown models', () => {
    expect(getModelDisplayName('custom-unknown-model')).toBe('custom-unknown-model')
  })

  it('resolves textToVideoModel endpoint IDs', () => {
    // The kling family has a textToVideoModel entry
    expect(getModelDisplayName('kling-video/v3/pro/text-to-video')).toBe('v3 Pro')
  })
})

// ---------------------------------------------------------------------------
// groupItemsByModel
// ---------------------------------------------------------------------------

describe('groupItemsByModel', () => {
  it('handles an empty array', () => {
    expect(groupItemsByModel([])).toEqual([])
  })

  it('returns a single row for a single item', () => {
    const items = [makeMedia({ id: 'a', model: 'flux/dev', metadata: { estimatedCost: 0.05 } })]

    const rows = groupItemsByModel(items)
    expect(rows).toHaveLength(1)
    expect(rows[0].modelId).toBe('flux/dev')
    expect(rows[0].executions).toBe(1)
    expect(rows[0].cost).toBe(0.05)
  })

  it('aggregates count for multiple items of the same model', () => {
    const items = [
      makeMedia({ id: 'a', model: 'flux/dev', metadata: { estimatedCost: 0.05 } }),
      makeMedia({ id: 'b', model: 'flux/dev', metadata: { estimatedCost: 0.03 } }),
      makeMedia({ id: 'c', model: 'flux/dev', metadata: { estimatedCost: 0.02 } }),
    ]

    const rows = groupItemsByModel(items)
    expect(rows).toHaveLength(1)
    expect(rows[0].executions).toBe(3)
    expect(rows[0].cost).toBe(0.10)
  })

  it('produces separate rows for different models', () => {
    const items = [
      makeMedia({ id: 'a', model: 'flux/dev', metadata: { estimatedCost: 0.05 } }),
      makeMedia({ id: 'b', model: 'flux/schnell', metadata: { estimatedCost: 0.01 } }),
    ]

    const rows = groupItemsByModel(items)
    expect(rows).toHaveLength(2)
    const ids = rows.map((r) => r.modelId)
    expect(ids).toContain('flux/dev')
    expect(ids).toContain('flux/schnell')
  })

  it('deduplicates items with the same ID', () => {
    const items = [
      makeMedia({ id: 'a', model: 'flux/dev', metadata: { estimatedCost: 0.05 } }),
      makeMedia({ id: 'a', model: 'flux/dev', metadata: { estimatedCost: 0.05 } }),
    ]

    const rows = groupItemsByModel(items)
    expect(rows).toHaveLength(1)
    expect(rows[0].executions).toBe(1)
    expect(rows[0].cost).toBe(0.05)
  })

  it('uses costTier fallback when estimatedCost is absent', () => {
    const items = [makeMedia({ id: 'a', model: 'flux/dev', costTier: 'high' })]

    const rows = groupItemsByModel(items)
    expect(rows[0].cost).toBe(0.15) // high tier fallback
  })

  it('returns cost 0 when neither estimatedCost nor costTier is present', () => {
    const items = [makeMedia({ id: 'a', model: 'flux/dev' })]

    const rows = groupItemsByModel(items)
    expect(rows[0].cost).toBe(0)
  })

  it('prefers estimatedCost over costTier when both are present', () => {
    const items = [
      makeMedia({
        id: 'a',
        model: 'flux/dev',
        costTier: 'high',
        metadata: { estimatedCost: 0.07 },
      }),
    ]

    const rows = groupItemsByModel(items)
    expect(rows[0].cost).toBe(0.07)
  })

  it('sorts rows by cost descending', () => {
    const items = [
      makeMedia({ id: 'a', model: 'flux/schnell', metadata: { estimatedCost: 0.01 } }),
      makeMedia({ id: 'b', model: 'flux/dev', metadata: { estimatedCost: 0.05 } }),
      makeMedia({ id: 'c', model: 'flux-pro/v1.1-ultra', metadata: { estimatedCost: 0.50 } }),
    ]

    const rows = groupItemsByModel(items)
    expect(rows[0].modelId).toBe('flux-pro/v1.1-ultra')
    expect(rows[1].modelId).toBe('flux/dev')
    expect(rows[2].modelId).toBe('flux/schnell')
  })

  it('rounds costs to 4 decimal places', () => {
    const items = [
      makeMedia({ id: 'a', model: 'flux/dev', metadata: { estimatedCost: 0.00333 } }),
      makeMedia({ id: 'b', model: 'flux/dev', metadata: { estimatedCost: 0.00333 } }),
      makeMedia({ id: 'c', model: 'flux/dev', metadata: { estimatedCost: 0.00333 } }),
    ]

    const rows = groupItemsByModel(items)
    // 0.00333 * 3 = 0.00999, rounded to 4 decimals = 0.01 (via Math.round(x*10000)/10000)
    expect(rows[0].cost).toBe(0.01)
  })
})

// ---------------------------------------------------------------------------
// generateCostCSV
// ---------------------------------------------------------------------------

describe('generateCostCSV', () => {
  it('produces headers only for empty rows', () => {
    const csv = generateCostCSV([])
    const lines = csv.split('\n')
    expect(lines).toHaveLength(2) // header + Total row
    expect(lines[0]).toBe('Model,Executions,Cost (USD)')
    expect(lines[1]).toBe('Total,0,0.0000')
  })

  it('produces correct number of rows', () => {
    const rows = [
      { modelId: 'm1', displayName: 'Model A', executions: 3, cost: 0.15 },
      { modelId: 'm2', displayName: 'Model B', executions: 1, cost: 0.05 },
    ]

    const csv = generateCostCSV(rows)
    const lines = csv.split('\n')
    // header + 2 data rows + total
    expect(lines).toHaveLength(4)
  })

  it('computes correct totals in the Total row', () => {
    const rows = [
      { modelId: 'm1', displayName: 'Model A', executions: 3, cost: 0.15 },
      { modelId: 'm2', displayName: 'Model B', executions: 2, cost: 0.07 },
    ]

    const csv = generateCostCSV(rows)
    const lines = csv.split('\n')
    const totalLine = lines[lines.length - 1]
    expect(totalLine).toBe('Total,5,0.2200')
  })

  it('escapes display names containing commas', () => {
    const rows = [
      { modelId: 'm1', displayName: 'Model, Inc.', executions: 1, cost: 0.01 },
    ]

    const csv = generateCostCSV(rows)
    const lines = csv.split('\n')
    expect(lines[1]).toBe('"Model, Inc.",1,0.0100')
  })

  it('escapes display names containing double quotes', () => {
    const rows = [
      { modelId: 'm1', displayName: 'Model "Pro"', executions: 1, cost: 0.01 },
    ]

    const csv = generateCostCSV(rows)
    const lines = csv.split('\n')
    expect(lines[1]).toBe('"Model ""Pro""",1,0.0100')
  })

  it('formats costs to 4 decimal places', () => {
    const rows = [
      { modelId: 'm1', displayName: 'Test', executions: 1, cost: 0.1 },
    ]

    const csv = generateCostCSV(rows)
    const lines = csv.split('\n')
    expect(lines[1]).toContain('0.1000')
  })
})

// ---------------------------------------------------------------------------
// exportCollectionCostCSV
// ---------------------------------------------------------------------------

describe('exportCollectionCostCSV', () => {
  it('returns the expected shape with all fields', () => {
    const result = exportCollectionCostCSV([])

    expect(result).toHaveProperty('csv')
    expect(result).toHaveProperty('rows')
    expect(result).toHaveProperty('totalCost')
    expect(result).toHaveProperty('totalExecutions')
    expect(result).toHaveProperty('collectionNames')
  })

  it('computes totalCost as sum of row costs', () => {
    const items = [
      makeMedia({ id: 'a', model: 'flux/dev', metadata: { estimatedCost: 0.05 } }),
      makeMedia({ id: 'b', model: 'flux/schnell', metadata: { estimatedCost: 0.01 } }),
      makeMedia({ id: 'c', model: 'flux-pro/v1.1-ultra', metadata: { estimatedCost: 0.50 } }),
    ]

    const result = exportCollectionCostCSV(items)
    expect(result.totalCost).toBe(0.56)
  })

  it('computes totalExecutions as sum of row executions', () => {
    const items = [
      makeMedia({ id: 'a', model: 'flux/dev', metadata: { estimatedCost: 0.05 } }),
      makeMedia({ id: 'b', model: 'flux/dev', metadata: { estimatedCost: 0.03 } }),
      makeMedia({ id: 'c', model: 'flux/schnell', metadata: { estimatedCost: 0.01 } }),
    ]

    const result = exportCollectionCostCSV(items)
    expect(result.totalExecutions).toBe(3)
  })

  it('passes collectionNames through', () => {
    const result = exportCollectionCostCSV([], ['Collection A', 'Collection B'])
    expect(result.collectionNames).toEqual(['Collection A', 'Collection B'])
  })

  it('defaults collectionNames to empty array when omitted', () => {
    const result = exportCollectionCostCSV([])
    expect(result.collectionNames).toEqual([])
  })

  it('returns valid but zero result for empty items', () => {
    const result = exportCollectionCostCSV([])

    expect(result.csv).toContain('Model,Executions,Cost (USD)')
    expect(result.rows).toEqual([])
    expect(result.totalCost).toBe(0)
    expect(result.totalExecutions).toBe(0)
  })

  it('produces CSV consistent with rows data', () => {
    const items = [
      makeMedia({ id: 'a', model: 'flux/dev', metadata: { estimatedCost: 0.05 } }),
      makeMedia({ id: 'b', model: 'flux/schnell', metadata: { estimatedCost: 0.01 } }),
    ]

    const result = exportCollectionCostCSV(items)

    // CSV should contain display names from rows
    for (const row of result.rows) {
      expect(result.csv).toContain(row.displayName)
    }

    // CSV total should match totalCost
    const csvLines = result.csv.split('\n')
    const totalLine = csvLines[csvLines.length - 1]
    expect(totalLine).toContain(result.totalCost.toFixed(4))
  })
})
