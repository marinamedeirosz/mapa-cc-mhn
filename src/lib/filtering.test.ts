import { describe, expect, it } from 'vitest'
import { applyFilters, applyQuickSearch, initialFilters } from './filtering'
import type { OccurrenceRecord } from '@/types'

const records: OccurrenceRecord[] = [
  makeRecord({
    code: 'CC00019',
    date: new Date(Date.UTC(2025, 3, 12)),
    family: 'PENAEIDAE',
    species: 'Penaeus sp.',
    local: 'Maceió, AL',
    observation: 'Comprado na loja Universo Submerso',
  }),
  makeRecord({
    code: 'CC00020',
    date: new Date(Date.UTC(2024, 4, 1)),
    family: 'PORTUNIDAE',
    species: 'Callinectes danae',
    local: 'Paripueira, AL',
    observation: 'Mercado local',
  }),
]

describe('filtering', () => {
  it('applies date, family and observation filters together', () => {
    const filtered = applyFilters(records, {
      ...initialFilters,
      dateStart: '2025-01-01',
      dateEnd: '2025-12-31',
      families: ['PENAEIDAE'],
      observation: 'universo submerso',
    })

    expect(filtered).toHaveLength(1)
    expect(filtered[0].code).toBe('CC00019')
  })

  it('keeps only the records selected on the map', () => {
    const filtered = applyFilters(records, {
      ...initialFilters,
      mapSelection: { label: 'Maceió', recordIds: ['CC00020'] },
    })

    expect(filtered.map((record) => record.code)).toEqual(['CC00020'])
  })

  it('quick search scans visible row fields', () => {
    expect(applyQuickSearch(records, 'callinectes')).toHaveLength(1)
    expect(applyQuickSearch(records, 'maceio')).toHaveLength(1)
  })
})

function makeRecord(record: Partial<OccurrenceRecord>): OccurrenceRecord {
  return {
    id: record.code ?? 'id',
    rowNumber: 2,
    code: '',
    dateText: '',
    date: null,
    family: '',
    species: '',
    local: '',
    coordinatesText: '',
    observation: '',
    latitude: -9.6,
    longitude: -35.8,
    positionLabel: 'Coordenadas da planilha',
    positionSource: 'coordinates',
    importIssues: [],
    ...record,
  }
}
