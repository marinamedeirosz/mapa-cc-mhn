import { describe, expect, it } from 'vitest'
import {
  buildMunicipalityReportSvg,
  getMunicipalityMapFileName,
  layoutMunicipalityLabels,
  selectMunicipalityLabels,
} from './municipalityMapExport'
import type {
  MunicipalityAggregation,
  MunicipalityFeatureCollection,
} from './municipalityAggregation'

const geojson: MunicipalityFeatureCollection = {
  type: 'FeatureCollection',
  features: [
    municipality('a', 'Maceio', -36, -10),
    municipality('b', 'Pilar', -35.8, -9.8),
    municipality('c', 'Roteiro', -34.5, -8.5),
  ],
}

describe('municipalityMapExport', () => {
  it('builds a stable PNG file name', () => {
    expect(getMunicipalityMapFileName(new Date(2026, 5, 7))).toBe(
      'mapa-municipios-alagoas-2026-06-07.png',
    )
  })

  it('selects every municipality label by default', () => {
    const aggregation = aggregationWithCounts([
      ['a', 'Maceio', 10],
      ['b', 'Pilar', 8],
      ['c', 'Roteiro', 2],
    ])
    const labels = selectMunicipalityLabels({
      geojson,
      aggregation,
      project: ({ latitude, longitude }) => ({
        x: longitude < -35 ? 100 : 300,
        y: latitude < -9 ? 100 : 300,
      }),
    })

    expect(labels.map((label) => label.name)).toEqual(['Maceio', 'Pilar', 'Roteiro'])
  })

  it('moves colliding labels to callouts with guide lines', () => {
    const aggregation = aggregationWithCounts([
      ['a', 'Maceio', 10],
      ['b', 'Pilar', 8],
      ['c', 'Roteiro', 2],
    ])
    const labels = layoutMunicipalityLabels({
      geojson,
      aggregation,
      bounds: { left: 0, right: 360, top: 0, bottom: 220 },
      project: ({ latitude, longitude }) => ({
        x: longitude < -35 ? 100 : 300,
        y: latitude < -9 ? 100 : 300,
      }),
    })
    const callouts = labels.filter((label) => label.placement !== 'inside')

    expect(labels).toHaveLength(3)
    expect(callouts.length).toBeGreaterThan(0)
    expect(callouts.every((label) => label.lineStart && label.lineEnd)).toBe(true)
  })

  it('distributes callouts vertically in the same column', () => {
    const aggregation = aggregationWithCounts([
      ['a', 'Maceio', 10],
      ['b', 'Pilar', 8],
      ['c', 'Roteiro', 2],
    ])
    const labels = layoutMunicipalityLabels({
      geojson,
      aggregation,
      bounds: { left: 0, right: 260, top: 0, bottom: 120 },
      project: () => ({ x: 130, y: 60 }),
    })
    const callouts = labels.filter((label) => label.placement !== 'inside')

    for (const placement of ['callout-left', 'callout-right'] as const) {
      const column = callouts
        .filter((label) => label.placement === placement)
        .sort((a, b) => a.labelY - b.labelY)

      for (let index = 1; index < column.length; index += 1) {
        expect(column[index].labelY - column[index - 1].labelY).toBeGreaterThanOrEqual(27)
      }
    }
  })

  it('balances export callouts between left and right columns', () => {
    const aggregation = aggregationWithCounts([
      ['a', 'Maceio', 10],
      ['b', 'Pilar', 8],
      ['c', 'Roteiro', 2],
    ])
    const labels = layoutMunicipalityLabels({
      geojson,
      aggregation,
      balanceCallouts: true,
      bounds: { left: 0, right: 320, top: 0, bottom: 220 },
      project: () => ({ x: 160, y: 80 }),
    })
    const calloutSides = new Set(
      labels.filter((label) => label.placement !== 'inside').map((label) => label.placement),
    )

    expect(calloutSides.has('callout-left')).toBe(true)
    expect(calloutSides.has('callout-right')).toBe(true)
  })

  it('renders a report SVG with map metrics and labels', () => {
    const svg = buildMunicipalityReportSvg({
      geojson,
      aggregation: aggregationWithCounts([
        ['a', 'Maceio', 10],
        ['c', 'Roteiro', 2],
      ]),
      showLabels: true,
    })

    expect(svg).toContain('Mapa municipal de Alagoas')
    expect(svg).toContain('No mapa')
    expect(svg).toContain('Maceio')
    expect(svg).toContain('<path')
  })
})

function aggregationWithCounts(items: Array<[string, string, number]>): MunicipalityAggregation {
  const counts = new Map(
    items.map(([id, name, total]) => [
      id,
      {
        id,
        name,
        direct: total,
        celmm: 0,
        total,
        records: [],
      },
    ]),
  )
  const totalMunicipalized = items.reduce((total, item) => total + item[2], 0)

  return {
    counts,
    max: Math.max(...items.map((item) => item[2])),
    municipalitiesWithRecords: items.length,
    totalRecords: totalMunicipalized,
    recordsWithMunicipality: totalMunicipalized,
    directRecords: totalMunicipalized,
    celmmRecords: 0,
    totalMunicipalized,
    unresolved: 0,
    mappedRecords: [],
    directRecordRefs: [],
    celmmRecordRefs: [],
    assignmentRefs: [],
    unresolvedRecords: [],
  }
}

function municipality(id: string, name: string, longitude: number, latitude: number) {
  return {
    type: 'Feature' as const,
    properties: { id, codarea: id, name },
    geometry: {
      type: 'Polygon' as const,
      coordinates: [
        [
          [longitude, latitude],
          [longitude + 0.1, latitude],
          [longitude + 0.1, latitude + 0.1],
          [longitude, latitude + 0.1],
          [longitude, latitude],
        ],
      ],
    },
  }
}
