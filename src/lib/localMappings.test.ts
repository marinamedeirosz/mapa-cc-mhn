import { describe, expect, it } from 'vitest'
import { applyLocalMappings, listUnresolvedLocals, parseLocalMappings, upsertLocalMapping } from './localMappings'
import type { ImportResult, OccurrenceRecord } from '@/types'

const mapping = { local: 'Praia do Francês', municipality: 'Marechal Deodoro', latitude: -9.75, longitude: -35.85 }

describe('applyLocalMappings', () => {
  it('positions unresolved lots by the curated local and updates the summary', () => {
    const result = importResult([
      record(2, 'praia do frances', 'unresolved'),
      record(3, 'Praia do Francês', 'coordinates'),
      record(4, 'Outro lugar', 'unresolved'),
    ])

    const applied = applyLocalMappings(result, [mapping])

    expect(applied.records[0]).toMatchObject({
      positionSource: 'local_fallback',
      latitude: -9.75,
      positionLabel: 'Marechal Deodoro, AL (curadoria)',
      importIssues: [],
    })
    expect(applied.records[1].positionSource).toBe('coordinates')
    expect(applied.records[2].positionSource).toBe('unresolved')
    expect(applied.summary).toMatchObject({ fromLocal: 1, unresolved: 1 })
    expect(applied.summary.issues.map((issue) => issue.rowNumber)).toEqual([4])
  })
})

describe('listUnresolvedLocals', () => {
  it('groups unresolved locals ignoring case and accents, most frequent first', () => {
    expect(
      listUnresolvedLocals([
        record(2, 'Praia do Francês', 'unresolved'),
        record(3, 'praia do frances', 'unresolved'),
        record(4, 'Outro', 'unresolved'),
        record(5, '', 'unresolved'),
        record(6, 'Maceió', 'local_fallback'),
      ]),
    ).toEqual([
      { local: 'Praia do Francês', count: 2 },
      { local: 'Outro', count: 1 },
    ])
  })
})

describe('upsertLocalMapping', () => {
  it('replaces the mapping of the same local', () => {
    const updated = upsertLocalMapping([mapping], { ...mapping, local: 'PRAIA DO FRANCES', municipality: 'Barra de São Miguel' })
    expect(updated).toHaveLength(1)
    expect(updated[0].municipality).toBe('Barra de São Miguel')
  })
})

describe('parseLocalMappings', () => {
  it('accepts a valid list and rejects anything else', () => {
    expect(parseLocalMappings([{ ...mapping, local: ' Praia do Francês ' }])).toEqual([mapping])
    expect(() => parseLocalMappings({ local: 'x' })).toThrow('lista')
    expect(() => parseLocalMappings([{ ...mapping, latitude: 'x' }])).toThrow('Item 1')
    expect(() => parseLocalMappings([{ ...mapping, longitude: 500 }])).toThrow('Item 1')
  })
})

function importResult(records: OccurrenceRecord[]): ImportResult {
  return {
    records,
    summary: {
      fileName: 't.csv',
      sheetName: 'S',
      sheetNames: ['S'],
      totalRows: records.length,
      withCoordinates: 0,
      fromLocal: 0,
      unresolved: 0,
      issues: records.flatMap((item) => item.importIssues),
    },
  }
}

function record(rowNumber: number, local: string, positionSource: OccurrenceRecord['positionSource']): OccurrenceRecord {
  return {
    id: `${rowNumber}`,
    rowNumber,
    code: '',
    dateText: '',
    date: null,
    family: '',
    species: '',
    local,
    coordinatesText: '',
    observation: '',
    latitude: null,
    longitude: null,
    positionLabel: '',
    positionSource,
    importIssues:
      positionSource === 'unresolved'
        ? [{ rowNumber, field: 'Local', message: 'Sem coordenada e local não encontrado na base offline.', severity: 'warning' }]
        : [],
  }
}
