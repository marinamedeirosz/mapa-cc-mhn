import { describe, expect, it } from 'vitest'
import { buildStats } from './stats'
import type { OccurrenceRecord } from '@/types'

const record = (family: string) => ({ family, species: '', local: '' }) as OccurrenceRecord

describe('buildStats', () => {
  it('counts names that differ only by case, accents or spaces as one item', () => {
    const stats = buildStats([record('PENAEIDAE'), record('Penaeidae '), record('Grapsidae'), record('')])

    expect(stats.totalFamilies).toBe(2)
    expect(stats.byFamily).toEqual([
      { label: 'PENAEIDAE', count: 2 },
      { label: 'Grapsidae', count: 1 },
    ])
  })
})
