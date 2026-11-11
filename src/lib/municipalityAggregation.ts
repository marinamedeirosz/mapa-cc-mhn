import { isCelmmLocal, resolveLocalCoordinates } from '@/data/localCoordinates'
import { normalizeText } from '@/lib/text'
import type { OccurrenceRecord } from '@/types'

export interface MunicipalityFeatureProperties {
  id: string
  codarea?: string
  name: string
}

export interface MunicipalityFeature {
  type: 'Feature'
  properties: MunicipalityFeatureProperties
  geometry: {
    type: 'Polygon' | 'MultiPolygon'
    coordinates: number[][][] | number[][][][]
  }
}

export interface MunicipalityFeatureCollection {
  type: 'FeatureCollection'
  features: MunicipalityFeature[]
}

export type MunicipalityGrouping = 'lot' | 'family' | 'species'

export interface MunicipalityGroup {
  key: string
  label: string
  total: number
  direct: number
  celmm: number
  records: OccurrenceRecord[]
  refs: MunicipalityRecordRef[]
}

export interface MunicipalityCount {
  id: string
  name: string
  direct: number
  celmm: number
  total: number
  lotTotal: number
  missingGroupingLots: number
  records: MunicipalityRecordRef[]
  groups: MunicipalityGroup[]
}

export interface MunicipalityRecordRef {
  record: OccurrenceRecord
  source: 'direct' | 'celmm'
}

export interface MunicipalityGroupAssignment {
  municipalityId: string
  municipalityName: string
  group: MunicipalityGroup
}

export interface MunicipalityAggregation {
  grouping: MunicipalityGrouping
  counts: Map<string, MunicipalityCount>
  max: number
  municipalitiesWithGroups: number
  totalGroups: number
  groupsWithMunicipality: number
  directGroups: number
  celmmGroups: number
  totalAssignments: number
  unresolvedGroups: number
  mappedGroups: MunicipalityGroup[]
  directGroupItems: MunicipalityGroup[]
  celmmGroupItems: MunicipalityGroup[]
  unresolvedGroupItems: MunicipalityGroup[]
  groupAssignments: MunicipalityGroupAssignment[]
  missingGroupingRecords: OccurrenceRecord[]
  unresolvedRecords: OccurrenceRecord[]
  marineRecords: OccurrenceRecord[]
}

const maxNearestMunicipalityDistanceKm = 25

export const celmmMunicipalities = [
  'Maceió',
  'Marechal Deodoro',
  'Coqueiro Seco',
  'Pilar',
  'Rio Largo',
  'Santa Luzia do Norte',
  'Satuba',
]

export function aggregateByMunicipality(
  records: OccurrenceRecord[],
  geojson: MunicipalityFeatureCollection | null,
  grouping: MunicipalityGrouping = 'lot',
): MunicipalityAggregation {
  const counts = new Map<string, MunicipalityCount>()
  const municipalitiesByName = buildMunicipalityNameMap(geojson)
  const unresolvedRecords: OccurrenceRecord[] = []
  const marineRecords: OccurrenceRecord[] = []

  for (const record of records) {
    if (isCelmmLocal(record.local)) {
      let added = false

      for (const municipality of celmmMunicipalities) {
        const feature = municipalitiesByName.get(normalizeText(municipality))
        if (feature) {
          increment(counts, feature, record, 'celmm')
          added = true
        }
      }

      if (!added) {
        unresolvedRecords.push(record)
      }

      continue
    }

    const featureByPoint =
      record.latitude !== null && record.longitude !== null && geojson
        ? findFeatureForPoint(geojson, record.latitude, record.longitude)
        : null

    if (featureByPoint) {
      increment(counts, featureByPoint, record, 'direct')
      continue
    }

    // Coordenada da planilha vale mais que o nome do local: se cai no mar, é marinho.
    if (record.latitude !== null && record.longitude !== null && geojson && isOffshore(geojson, record.latitude, record.longitude)) {
      marineRecords.push(record)
      continue
    }

    const localResolution = resolveLocalCoordinates(record.local)

    if (localResolution?.municipality) {
      const feature = municipalitiesByName.get(normalizeText(localResolution.municipality))
      if (feature) {
        increment(counts, feature, record, 'direct')
        continue
      }
    }

    unresolvedRecords.push(record)
  }

  const values = Array.from(counts.values())
  const groupAssignments: MunicipalityGroupAssignment[] = []

  for (const item of values) {
    item.groups = buildGroupsFromRefs(item.records, grouping)
    item.total = item.groups.length
    item.direct = item.groups.filter((group) => group.direct > 0).length
    item.celmm = item.groups.filter((group) => group.celmm > 0).length
    item.lotTotal = item.records.length
    item.missingGroupingLots = item.records.filter(
      ({ record }) => !getGroupIdentity(record, grouping),
    ).length

    for (const group of item.groups) {
      groupAssignments.push({
        municipalityId: item.id,
        municipalityName: item.name,
        group,
      })
    }
  }

  const allAssignmentRefs = values.flatMap((item) => item.records)
  const groups = buildGroupsFromRecords(records, grouping)
  const mappedGroups = buildGroupsFromRefs(allAssignmentRefs, grouping)
  const directGroupItems = buildGroupsFromRefs(
    allAssignmentRefs.filter((ref) => ref.source === 'direct'),
    grouping,
  )
  const celmmGroupItems = buildGroupsFromRefs(
    allAssignmentRefs.filter((ref) => ref.source === 'celmm'),
    grouping,
  )
  const unresolvedGroupItems = buildGroupsFromRecords(unresolvedRecords, grouping)
  const missingGroupingRecords = records.filter((record) => !getGroupIdentity(record, grouping))

  return {
    grouping,
    counts,
    max: values.reduce((currentMax, item) => Math.max(currentMax, item.total), 0),
    municipalitiesWithGroups: values.filter((item) => item.total > 0).length,
    totalGroups: groups.length,
    groupsWithMunicipality: mappedGroups.length,
    directGroups: directGroupItems.length,
    celmmGroups: celmmGroupItems.length,
    totalAssignments: groupAssignments.length,
    unresolvedGroups: unresolvedGroupItems.length,
    mappedGroups,
    directGroupItems,
    celmmGroupItems,
    unresolvedGroupItems,
    groupAssignments,
    missingGroupingRecords,
    unresolvedRecords,
    marineRecords,
  }
}

function buildGroupsFromRecords(
  records: OccurrenceRecord[],
  grouping: MunicipalityGrouping,
): MunicipalityGroup[] {
  return buildGroups(
    records.map((record) => ({ record, source: null })),
    grouping,
  )
}

function buildGroupsFromRefs(
  refs: MunicipalityRecordRef[],
  grouping: MunicipalityGrouping,
): MunicipalityGroup[] {
  return buildGroups(refs, grouping)
}

function buildGroups(
  items: Array<{ record: OccurrenceRecord; source: MunicipalityRecordRef['source'] | null }>,
  grouping: MunicipalityGrouping,
): MunicipalityGroup[] {
  const groups = new Map<
    string,
    {
      label: string
      records: Map<string, OccurrenceRecord>
      refs: Map<string, MunicipalityRecordRef>
    }
  >()

  for (const { record, source } of items) {
    const identity = getGroupIdentity(record, grouping)

    if (!identity) {
      continue
    }

    const group = groups.get(identity.key) ?? {
      label: identity.label,
      records: new Map<string, OccurrenceRecord>(),
      refs: new Map<string, MunicipalityRecordRef>(),
    }

    group.records.set(record.id, record)
    if (source) {
      group.refs.set(`${record.id}-${source}`, { record, source })
    }
    groups.set(identity.key, group)
  }

  return Array.from(groups.entries())
    .map(([key, group]) => {
      const refs = Array.from(group.refs.values())
      return {
        key,
        label: group.label,
        total: group.records.size,
        direct: new Set(
          refs.filter((ref) => ref.source === 'direct').map((ref) => ref.record.id),
        ).size,
        celmm: new Set(
          refs.filter((ref) => ref.source === 'celmm').map((ref) => ref.record.id),
        ).size,
        records: Array.from(group.records.values()),
        refs,
      }
    })
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'pt-BR'))
}

function getGroupIdentity(
  record: OccurrenceRecord,
  grouping: MunicipalityGrouping,
): { key: string; label: string } | null {
  if (grouping === 'lot') {
    return {
      key: `lot:${record.id}`,
      label: record.code || `Lote da linha ${record.rowNumber}`,
    }
  }

  const value = grouping === 'family' ? record.family.trim() : record.species.trim()
  const normalized = normalizeText(value)

  return normalized ? { key: `${grouping}:${normalized}`, label: value } : null
}

export const defaultMunicipalityAccentColor = '#5b0633'
export const municipalityEmptyColor = '#f4f1e8'

export function isValidHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value)
}

export function getMunicipalityColor(
  count: number,
  max: number,
  accentColor = defaultMunicipalityAccentColor,
): string {
  if (count <= 0 || max <= 0) {
    return municipalityEmptyColor
  }

  const ratio = count / max
  const validAccent = isValidHexColor(accentColor)
    ? accentColor.toLowerCase()
    : defaultMunicipalityAccentColor

  if (ratio >= 0.8) {
    return validAccent
  }

  if (ratio >= 0.55) {
    return mixWithWhite(validAccent, 0.2)
  }

  if (ratio >= 0.3) {
    return mixWithWhite(validAccent, 0.4)
  }

  return mixWithWhite(validAccent, 0.62)
}

function mixWithWhite(color: string, amount: number): string {
  const channels = [1, 3, 5].map((start) => Number.parseInt(color.slice(start, start + 2), 16))
  const mixed = channels.map((channel) => Math.round(channel + (255 - channel) * amount))

  return `#${mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

function buildMunicipalityNameMap(
  geojson: MunicipalityFeatureCollection | null,
): Map<string, MunicipalityFeature> {
  const map = new Map<string, MunicipalityFeature>()

  for (const feature of geojson?.features ?? []) {
    map.set(normalizeText(feature.properties.name), feature)
  }

  return map
}

export function getMunicipalityFeatureId(feature: MunicipalityFeature): string {
  return feature.properties.id ?? feature.properties.codarea ?? feature.properties.name
}

function increment(
  counts: Map<string, MunicipalityCount>,
  feature: MunicipalityFeature,
  record: OccurrenceRecord,
  kind: 'direct' | 'celmm',
): void {
  const id = getMunicipalityFeatureId(feature)
  const existing =
    counts.get(id) ??
    ({
      id,
      name: feature.properties.name,
      direct: 0,
      celmm: 0,
      total: 0,
      lotTotal: 0,
      missingGroupingLots: 0,
      records: [],
      groups: [],
    } satisfies MunicipalityCount)

  existing.records.push({ record, source: kind })
  counts.set(id, existing)
}

function findFeatureForPoint(
  geojson: MunicipalityFeatureCollection,
  latitude: number,
  longitude: number,
): MunicipalityFeature | null {
  const containingFeature =
    geojson.features.find((feature) => featureContainsPoint(feature, latitude, longitude)) ?? null

  if (containingFeature) {
    return containingFeature
  }

  return findNearestFeature(geojson, latitude, longitude)
}

function featurePolygons(feature: MunicipalityFeature): number[][][][] {
  return feature.geometry.type === 'Polygon'
    ? [feature.geometry.coordinates as number[][][]]
    : (feature.geometry.coordinates as number[][][][])
}

// No mar ao largo de Alagoas: na mesma latitude há terra do estado só a oeste.
// Nessas latitudes o leste de Alagoas é só oceano; PE, SE e BA ficam ao norte, sul ou oeste.
function isOffshore(geojson: MunicipalityFeatureCollection, latitude: number, longitude: number): boolean {
  let landToWest = false

  for (const feature of geojson.features) {
    for (const polygon of featurePolygons(feature)) {
      for (const ring of polygon) {
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const [xi, yi] = ring[i]
          const [xj, yj] = ring[j]
          if (yi > latitude === yj > latitude) continue

          const crossingLongitude = ((xj - xi) * (latitude - yi)) / (yj - yi) + xi
          if (crossingLongitude > longitude) return false
          landToWest = true
        }
      }
    }
  }

  return landToWest
}

function featureContainsPoint(
  feature: MunicipalityFeature,
  latitude: number,
  longitude: number,
): boolean {
  const polygons = featurePolygons(feature)

  return polygons.some((polygon) => {
    const outerRing = polygon[0]
    return outerRing ? pointInRing(longitude, latitude, outerRing) : false
  })
}

function pointInRing(longitude: number, latitude: number, ring: number[][]): boolean {
  let inside = false

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0]
    const yi = ring[i][1]
    const xj = ring[j][0]
    const yj = ring[j][1]
    const intersects =
      yi > latitude !== yj > latitude &&
      longitude < ((xj - xi) * (latitude - yi)) / (yj - yi) + xi

    if (intersects) {
      inside = !inside
    }
  }

  return inside
}

function findNearestFeature(
  geojson: MunicipalityFeatureCollection,
  latitude: number,
  longitude: number,
): MunicipalityFeature | null {
  let nearestFeature: MunicipalityFeature | null = null
  let nearestDistance = Number.POSITIVE_INFINITY

  for (const feature of geojson.features) {
    const distance = distanceToFeatureKm(feature, latitude, longitude)

    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestFeature = feature
    }
  }

  return nearestDistance <= maxNearestMunicipalityDistanceKm ? nearestFeature : null
}

function distanceToFeatureKm(
  feature: MunicipalityFeature,
  latitude: number,
  longitude: number,
): number {
  const polygons = featurePolygons(feature)

  return polygons.reduce((featureMin, polygon) => {
    const ringMin = polygon.reduce((polygonMin, ring) => {
      return Math.min(polygonMin, distanceToRingKm(latitude, longitude, ring))
    }, Number.POSITIVE_INFINITY)

    return Math.min(featureMin, ringMin)
  }, Number.POSITIVE_INFINITY)
}

function distanceToRingKm(latitude: number, longitude: number, ring: number[][]): number {
  let minDistance = Number.POSITIVE_INFINITY

  for (let index = 0; index < ring.length - 1; index += 1) {
    const start = ring[index]
    const end = ring[index + 1]
    minDistance = Math.min(
      minDistance,
      distanceToSegmentKm(longitude, latitude, start[0], start[1], end[0], end[1]),
    )
  }

  return minDistance
}

function distanceToSegmentKm(
  pointLongitude: number,
  pointLatitude: number,
  startLongitude: number,
  startLatitude: number,
  endLongitude: number,
  endLatitude: number,
): number {
  const referenceLatitude = toRadians(pointLatitude)
  const x = (longitude: number) => longitude * Math.cos(referenceLatitude)
  const point = { x: x(pointLongitude), y: pointLatitude }
  const start = { x: x(startLongitude), y: startLatitude }
  const end = { x: x(endLongitude), y: endLatitude }
  const dx = end.x - start.x
  const dy = end.y - start.y
  const segmentLengthSquared = dx * dx + dy * dy
  const t =
    segmentLengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / segmentLengthSquared),
        )
  const projected = {
    x: start.x + t * dx,
    y: start.y + t * dy,
  }
  const distanceDegrees = Math.hypot(point.x - projected.x, point.y - projected.y)

  return distanceDegrees * 111.32
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180
}
