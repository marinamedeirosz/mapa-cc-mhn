import { describe, expect, it } from 'vitest'
import { aggregateByMunicipality, celmmMunicipalities } from './municipalityAggregation'
import type { MunicipalityFeatureCollection } from './municipalityAggregation'
import type { OccurrenceRecord } from '@/types'

const geojson: MunicipalityFeatureCollection = {
  type: 'FeatureCollection',
  features: [
    municipality('2704302', 'Maceió', [
      [
        [-36, -10],
        [-35, -10],
        [-35, -9],
        [-36, -9],
        [-36, -10],
      ],
    ]),
    ...celmmMunicipalities
      .filter((name) => name !== 'Maceió')
      .map((name, index) =>
        municipality(`celmm-${index}`, name, [
          [
            [-40 - index, -10],
            [-39 - index, -10],
            [-39 - index, -9],
            [-40 - index, -9],
            [-40 - index, -10],
          ],
        ]),
      ),
  ],
}

describe('aggregateByMunicipality', () => {
  it('counts direct municipalities using normalized local names', () => {
    const aggregation = aggregateByMunicipality([record({ local: 'maceio, al' })], geojson)
    const maceio = Array.from(aggregation.counts.values()).find((item) => item.name === 'Maceió')

    expect(maceio).toMatchObject({ direct: 1, celmm: 0, total: 1 })
    expect(maceio?.records).toHaveLength(1)
    expect(maceio?.records[0].source).toBe('direct')
    expect(aggregation.totalRecords).toBe(1)
    expect(aggregation.recordsWithMunicipality).toBe(1)
    expect(aggregation.directRecords).toBe(1)
    expect(aggregation.celmmRecords).toBe(0)
    expect(aggregation.unresolved).toBe(0)
  })

  it('distributes explicit CELMM records to all configured municipalities', () => {
    const aggregation = aggregateByMunicipality([record({ local: 'CELMM' })], geojson)

    expect(aggregation.municipalitiesWithRecords).toBe(celmmMunicipalities.length)
    expect(aggregation.totalMunicipalized).toBe(celmmMunicipalities.length)
    expect(aggregation.totalRecords).toBe(1)
    expect(aggregation.recordsWithMunicipality).toBe(1)
    expect(aggregation.directRecords).toBe(0)
    expect(aggregation.celmmRecords).toBe(1)
    expect(Array.from(aggregation.counts.values()).every((item) => item.celmm === 1)).toBe(true)
    expect(Array.from(aggregation.counts.values()).every((item) => item.records[0].source === 'celmm')).toBe(true)
  })

  it('distributes Mundaú and Manguaba aliases as CELMM', () => {
    const aggregation = aggregateByMunicipality([record({ local: 'Lagoa Mundaú' })], geojson)

    expect(aggregation.municipalitiesWithRecords).toBe(celmmMunicipalities.length)
    expect(aggregation.totalMunicipalized).toBe(celmmMunicipalities.length)
    expect(aggregation.recordsWithMunicipality).toBe(1)
    expect(aggregation.unresolved).toBe(0)
    expect(Array.from(aggregation.counts.values()).every((item) => item.records.length === item.total)).toBe(true)
  })

  it('uses point-in-polygon when local is unresolved but coordinates are present', () => {
    const aggregation = aggregateByMunicipality(
      [record({ local: 'Ponto sem município', latitude: -9.5, longitude: -35.5 })],
      geojson,
    )
    const maceio = Array.from(aggregation.counts.values()).find((item) => item.name === 'Maceió')

    expect(maceio).toMatchObject({ direct: 1, total: 1 })
    expect(maceio?.records[0].record.local).toBe('Ponto sem município')
  })

  it('prioritizes coordinates over local when resolving the municipality', () => {
    const aggregation = aggregateByMunicipality(
      [record({ local: 'Paripueira, AL', latitude: -9.5, longitude: -35.5 })],
      geojson,
    )
    const maceio = Array.from(aggregation.counts.values()).find((item) => item.name === 'Maceió')

    expect(maceio).toMatchObject({ direct: 1, total: 1 })
    expect(Array.from(aggregation.counts.values())).toHaveLength(1)
  })

  it('uses the nearest municipality for coordinates just outside the polygon', () => {
    const aggregation = aggregateByMunicipality(
      [record({ local: 'Ponto costeiro', latitude: -9.5, longitude: -34.98 })],
      geojson,
    )
    const maceio = Array.from(aggregation.counts.values()).find((item) => item.name === 'Maceió')

    expect(maceio).toMatchObject({ direct: 1, total: 1 })
    expect(aggregation.unresolved).toBe(0)
  })
})

function municipality(id: string, name: string, coordinates: number[][][]) {
  return {
    type: 'Feature' as const,
    properties: { id, codarea: id, name },
    geometry: {
      type: 'Polygon' as const,
      coordinates,
    },
  }
}

function record(overrides: Partial<OccurrenceRecord>): OccurrenceRecord {
  return {
    id: 'record',
    rowNumber: 2,
    code: 'CC0001',
    dateText: '01/01/2025',
    date: new Date(Date.UTC(2025, 0, 1)),
    family: 'PENAEIDAE',
    species: 'Penaeus sp.',
    local: 'Maceió, AL',
    coordinatesText: '',
    observation: '',
    latitude: null,
    longitude: null,
    positionLabel: 'Sem posição',
    positionSource: 'unresolved',
    importIssues: [],
    ...overrides,
  }
}
