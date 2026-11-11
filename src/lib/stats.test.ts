import { describe, expect, it } from 'vitest'
import { buildStats, countByYear } from './stats'
import type { OccurrenceRecord } from '@/types'

const record = (family: string, date: Date | null = null) => ({ family, species: '', local: '', date }) as OccurrenceRecord

describe('buildStats', () => {
  it('counts names that differ only by case, accents or spaces as one item', () => {
    const stats = buildStats([record('PENAEIDAE'), record('Penaeidae '), record('Grapsidae'), record('')])

    expect(stats.totalFamilies).toBe(2)
    expect(stats.byFamily).toEqual([
      { label: 'PENAEIDAE', count: 2 },
      { label: 'Grapsidae', count: 1 },
    ])
  })

  it('counts records per year, filling years without records with zero', () => {
    const years = countByYear([
      record('A', new Date(Date.UTC(1998, 3, 12))),
      record('A', new Date(Date.UTC(2000, 0, 1))),
      record('A', new Date(Date.UTC(2000, 11, 31))),
      record('A'),
    ])

    expect(years).toEqual([
      { year: 1998, count: 1 },
      { year: 1999, count: 0 },
      { year: 2000, count: 2 },
    ])
  })
})
