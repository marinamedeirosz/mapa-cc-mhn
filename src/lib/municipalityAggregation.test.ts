import { describe, expect, it } from 'vitest'
import {
  aggregateByMunicipality,
  celmmMunicipalities,
  defaultMunicipalityAccentColor,
  getMunicipalityColor,
} from './municipalityAggregation'
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
    expect(aggregation.totalGroups).toBe(1)
    expect(aggregation.groupsWithMunicipality).toBe(1)
    expect(aggregation.directGroups).toBe(1)
    expect(aggregation.celmmGroups).toBe(0)
    expect(aggregation.unresolvedGroups).toBe(0)
  })

  it('distributes explicit CELMM records to all configured municipalities', () => {
    const aggregation = aggregateByMunicipality([record({ local: 'CELMM' })], geojson)

    expect(aggregation.municipalitiesWithGroups).toBe(celmmMunicipalities.length)
    expect(aggregation.totalAssignments).toBe(celmmMunicipalities.length)
    expect(aggregation.totalGroups).toBe(1)
    expect(aggregation.groupsWithMunicipality).toBe(1)
    expect(aggregation.directGroups).toBe(0)
    expect(aggregation.celmmGroups).toBe(1)
    expect(Array.from(aggregation.counts.values()).every((item) => item.celmm === 1)).toBe(true)
    expect(Array.from(aggregation.counts.values()).every((item) => item.records[0].source === 'celmm')).toBe(true)
  })

  it('distributes Mundaú and Manguaba aliases as CELMM', () => {
    const aggregation = aggregateByMunicipality([record({ local: 'Lagoa Mundaú' })], geojson)

    expect(aggregation.municipalitiesWithGroups).toBe(celmmMunicipalities.length)
    expect(aggregation.totalAssignments).toBe(celmmMunicipalities.length)
    expect(aggregation.groupsWithMunicipality).toBe(1)
    expect(aggregation.unresolvedGroups).toBe(0)
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
    expect(aggregation.unresolvedGroups).toBe(0)
  })

  it('deduplicates normalized families within each municipality and keeps their lots', () => {
    const aggregation = aggregateByMunicipality(
      [
        record({ id: 'a', family: 'PENAEIDAE' }),
        record({ id: 'b', family: 'Penaeidae' }),
      ],
      geojson,
      'family',
    )
    const maceio = Array.from(aggregation.counts.values()).find((item) => item.name === 'Maceió')

    expect(maceio).toMatchObject({ total: 1, lotTotal: 2, direct: 1, celmm: 0 })
    expect(maceio?.groups[0]).toMatchObject({ label: 'PENAEIDAE', total: 2 })
    expect(aggregation.totalGroups).toBe(1)
    expect(aggregation.totalAssignments).toBe(1)
  })

  it('excludes missing taxa from groups and retains the affected lots', () => {
    const aggregation = aggregateByMunicipality(
      [record({ id: 'missing', family: '' })],
      geojson,
      'family',
    )
    const maceio = Array.from(aggregation.counts.values()).find((item) => item.name === 'Maceió')

    expect(maceio).toMatchObject({ total: 0, lotTotal: 1, missingGroupingLots: 1 })
    expect(aggregation.totalGroups).toBe(0)
    expect(aggregation.missingGroupingRecords.map((item) => item.id)).toEqual(['missing'])
  })

  it('counts a taxon once when direct and CELMM lots overlap in a municipality', () => {
    const aggregation = aggregateByMunicipality(
      [
        record({ id: 'direct', species: 'Penaeus sp.' }),
        record({ id: 'celmm', local: 'CELMM', species: 'Penaeus sp' }),
      ],
      geojson,
      'species',
    )
    const maceio = Array.from(aggregation.counts.values()).find((item) => item.name === 'Maceió')

    expect(maceio).toMatchObject({ total: 1, direct: 1, celmm: 1, lotTotal: 2 })
    expect(aggregation.directGroups).toBe(1)
    expect(aggregation.celmmGroups).toBe(1)
    expect(aggregation.totalAssignments).toBe(celmmMunicipalities.length)
  })
})

describe('getMunicipalityColor', () => {
  it('builds lighter intensity bands from the selected accent', () => {
    expect(getMunicipalityColor(10, 10, '#0f4c81')).toBe('#0f4c81')
    expect(getMunicipalityColor(6, 10, '#0f4c81')).toBe('#3f709a')
    expect(getMunicipalityColor(1, 10, '#0f4c81')).toBe('#a4bbcf')
  })

  it('falls back to the default accent when a persisted color is invalid', () => {
    expect(getMunicipalityColor(10, 10, 'invalid')).toBe(defaultMunicipalityAccentColor)
    expect(getMunicipalityColor(0, 10, '#0f4c81')).toBe('#f4f1e8')
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
