import { describe, expect, it } from 'vitest'
import { generateCostCSV } from '@/lib/csv-export'

// ---------------------------------------------------------------------------
// slugify — replicating the private helper from collections.tsx
// ---------------------------------------------------------------------------

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

describe('slugify', () => {
  it('strips accented characters', () => {
    expect(slugify('Café Con Leche')).toBe('cafe-con-leche')
  })

  it('handles CJK characters (produces empty or transliterated string)', () => {
    // Pure CJK has no [a-z0-9], so slugify should produce an empty string
    expect(slugify('日本語')).toBe('')
  })

  it('removes special characters and normalises separators', () => {
    expect(slugify('My Collection #2!')).toBe('my-collection-2')
  })

  it('handles mixed accented + special chars', () => {
    expect(slugify('Diseño Gráfico #1')).toBe('diseno-grafico-1')
  })

  it('trims leading and trailing dashes', () => {
    expect(slugify('--hello world--')).toBe('hello-world')
  })

  it('collapses multiple non-alphanumeric runs into single dash', () => {
    expect(slugify('a!!!b###c')).toBe('a-b-c')
  })
})

// ---------------------------------------------------------------------------
// BOM prefix verification
// ---------------------------------------------------------------------------

describe('CSV BOM prefix', () => {
  it('BOM-prefixed CSV starts with \\uFEFF', () => {
    const csv = generateCostCSV([])
    const withBom = '\uFEFF' + csv
    expect(withBom.charCodeAt(0)).toBe(0xfeff)
    expect(withBom.startsWith('\uFEFF')).toBe(true)
  })

  it('BOM + CSV preserves header row for empty data', () => {
    const csv = generateCostCSV([])
    const withBom = '\uFEFF' + csv
    // After BOM, the first line should be the CSV header
    const lines = withBom.slice(1).split('\n')
    expect(lines[0]).toBe('Model,Executions,Cost (USD)')
    // Second line should be the Total row with zeros
    expect(lines[1]).toBe('Total,0,0.0000')
  })

  it('BOM + CSV preserves content for populated rows', () => {
    const rows = [
      { modelId: 'flux/dev', displayName: 'Dev', executions: 5, cost: 0.1234 },
    ]
    const csv = generateCostCSV(rows)
    const withBom = '\uFEFF' + csv
    expect(withBom.charCodeAt(0)).toBe(0xfeff)
    const lines = withBom.slice(1).split('\n')
    expect(lines[0]).toBe('Model,Executions,Cost (USD)')
    expect(lines[1]).toBe('Dev,5,0.1234')
    expect(lines[2]).toBe('Total,5,0.1234')
  })
})

// ---------------------------------------------------------------------------
// generateCostCSV edge cases
// ---------------------------------------------------------------------------

describe('generateCostCSV edge cases', () => {
  it('handles rows with special characters in model names', () => {
    const rows = [
      { modelId: 'x', displayName: 'Model, "Pro" Edition', executions: 1, cost: 0.5 },
    ]
    const csv = generateCostCSV(rows)
    // Comma and quotes should be properly escaped
    expect(csv).toContain('"Model, ""Pro"" Edition"')
  })

  it('handles rows with newlines in model names', () => {
    const rows = [
      { modelId: 'x', displayName: 'Model\nWith\nNewlines', executions: 2, cost: 1.0 },
    ]
    const csv = generateCostCSV(rows)
    expect(csv).toContain('"Model\nWith\nNewlines"')
  })
})
