import { describe, expect, it } from 'vitest'
import {
  buildMunicipalityReportSvg,
  formatMunicipalityLabel,
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
    expect(getMunicipalityMapFileName('family', new Date(2026, 5, 7))).toBe(
      'mapa-municipios-alagoas-por-familias-2026-06-07.png',
    )
    expect(getMunicipalityMapFileName('lot', new Date(2026, 5, 7), 'svg')).toBe(
      'mapa-municipios-alagoas-por-lotes-2026-06-07.svg',
    )
  })

  it('formats municipality labels with the total in parentheses', () => {
    expect(formatMunicipalityLabel('Maceio', 10)).toBe('Maceio (10)')
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

  it('keeps nearby callouts on their natural side before balancing columns', () => {
    const aggregation = aggregationWithCounts([
      ['a', 'Maceio', 10],
      ['b', 'Pilar', 8],
    ])
    const labels = layoutMunicipalityLabels({
      geojson,
      aggregation,
      balanceCallouts: true,
      bounds: { left: 0, right: 400, top: 0, bottom: 220 },
      project: () => ({ x: 95, y: 90 }),
    })

    expect(labels.map((label) => label.placement)).toEqual(['callout-left', 'callout-left'])
  })

  it('places very small municipalities outside the map as callouts', () => {
    const tinyGeojson: MunicipalityFeatureCollection = {
      type: 'FeatureCollection',
      features: [municipality('tiny', 'Coqueiro Seco', -36, -10, 0.01)],
    }
    const labels = layoutMunicipalityLabels({
      geojson: tinyGeojson,
      aggregation: aggregationWithCounts([['tiny', 'Coqueiro Seco', 4]]),
      bounds: { left: 0, right: 400, top: 0, bottom: 260 },
      project: ({ latitude, longitude }) => ({
        x: (longitude + 36.1) * 1000,
        y: (latitude + 10.1) * 1000,
      }),
    })

    expect(labels).toHaveLength(1)
    expect(labels[0].placement).not.toBe('inside')
  })

  it('keeps an inner gap between callout labels and inside labels', () => {
    const mixedGeojson: MunicipalityFeatureCollection = {
      type: 'FeatureCollection',
      features: [
        municipality('tiny', 'Coqueiro Seco', -36, -10, 0.01),
        municipality('large', 'Maceio', -35.77, -10, 0.1),
      ],
    }
    const labels = layoutMunicipalityLabels({
      geojson: mixedGeojson,
      aggregation: aggregationWithCounts([
        ['tiny', 'Coqueiro Seco', 4],
        ['large', 'Maceio', 10],
      ]),
      bounds: { left: 0, right: 720, top: 0, bottom: 260 },
      project: ({ latitude, longitude }) => ({
        x: (longitude + 36.1) * 1000,
        y: (latitude + 10.1) * 1000,
      }),
    })
    const callout = labels.find((label) => label.id === 'tiny')
    const inside = labels.find((label) => label.id === 'large')

    expect(callout?.placement).toBe('callout-left')
    expect(inside?.placement).toBe('inside')
    expect(callout && inside ? callout.labelX + callout.width / 2 : 0).toBeLessThan(
      inside ? inside.labelX - inside.width / 2 : 0,
    )
  })

  it('renders a map-only export SVG with municipality labels', () => {
    const svg = buildMunicipalityReportSvg({
      geojson,
      aggregation: aggregationWithCounts([
        ['a', 'Maceio', 10],
        ['c', 'Roteiro', 2],
      ]),
      showLabels: true,
    })

    expect(svg).toContain('Maceio (10)')
    expect(svg).toContain('<path')
    expect(svg).not.toContain('Mapa municipal de Alagoas')
    expect(svg).not.toContain('No mapa')
    expect(svg).not.toContain('Top municipios')
  })

  it('draws marine lots as points and counts the ones outside the map', () => {
    const svg = buildMunicipalityReportSvg({
      geojson,
      aggregation: {
        ...aggregationWithCounts([['a', 'Maceio', 1]]),
        marineRecords: [
          { latitude: -9, longitude: -35 },
          { latitude: -9, longitude: -20 },
        ] as MunicipalityAggregation['marineRecords'],
      },
      showLabels: false,
    })

    expect(svg.match(/<circle/g)).toHaveLength(2)
    expect(svg).toContain('Lotes marinhos: 2 (1 fora do recorte)')
  })

  it('uses the selected accent color in the exported map', () => {
    const svg = buildMunicipalityReportSvg({
      geojson,
      aggregation: aggregationWithCounts([['a', 'Maceio', 10]]),
      showLabels: false,
      accentColor: '#0f4c81',
    })

    expect(svg).toContain('#0f4c81')
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
        lotTotal: total,
        missingGroupingLots: 0,
        records: [],
        groups: [],
      },
    ]),
  )
  const totalMunicipalized = items.reduce((total, item) => total + item[2], 0)

  return {
    grouping: 'lot',
    counts,
    max: Math.max(...items.map((item) => item[2])),
    municipalitiesWithGroups: items.length,
    totalGroups: totalMunicipalized,
    groupsWithMunicipality: totalMunicipalized,
    directGroups: totalMunicipalized,
    celmmGroups: 0,
    totalAssignments: totalMunicipalized,
    unresolvedGroups: 0,
    mappedGroups: [],
    directGroupItems: [],
    celmmGroupItems: [],
    unresolvedGroupItems: [],
    groupAssignments: [],
    missingGroupingRecords: [],
    unresolvedRecords: [],
    marineRecords: [],
  }
}

function municipality(
  id: string,
  name: string,
  longitude: number,
  latitude: number,
  size = 0.1,
) {
  return {
    type: 'Feature' as const,
    properties: { id, codarea: id, name },
    geometry: {
      type: 'Polygon' as const,
      coordinates: [
        [
          [longitude, latitude],
          [longitude + size, latitude],
          [longitude + size, latitude + size],
          [longitude, latitude + size],
          [longitude, latitude],
        ],
      ],
    },
  }
}
