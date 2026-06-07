import { resolveLocalCoordinates } from '@/data/localCoordinates'
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

export interface MunicipalityCount {
  id: string
  name: string
  direct: number
  celmm: number
  total: number
  records: MunicipalityRecordRef[]
}

export interface MunicipalityRecordRef {
  record: OccurrenceRecord
  source: 'direct' | 'celmm'
}

export interface MunicipalityAssignmentRef extends MunicipalityRecordRef {
  municipalityId: string
  municipalityName: string
}

export interface MunicipalityAggregation {
  counts: Map<string, MunicipalityCount>
  max: number
  municipalitiesWithRecords: number
  totalRecords: number
  recordsWithMunicipality: number
  directRecords: number
  celmmRecords: number
  totalMunicipalized: number
  unresolved: number
  mappedRecords: OccurrenceRecord[]
  directRecordRefs: MunicipalityRecordRef[]
  celmmRecordRefs: MunicipalityRecordRef[]
  assignmentRefs: MunicipalityAssignmentRef[]
  unresolvedRecords: OccurrenceRecord[]
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
): MunicipalityAggregation {
  const counts = new Map<string, MunicipalityCount>()
  const municipalitiesByName = buildMunicipalityNameMap(geojson)
  const unresolvedRecords: OccurrenceRecord[] = []

  for (const record of records) {
    if (hasExplicitCelmm(record.local)) {
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

    const localResolution = resolveLocalCoordinates(record.local)

    if (localResolution?.isCelmm) {
      unresolvedRecords.push(record)
      continue
    }

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
  const max = values.reduce((currentMax, item) => Math.max(currentMax, item.total), 0)
  const mappedRecords = new Map<string, OccurrenceRecord>()
  const directRecords = new Map<string, MunicipalityRecordRef>()
  const celmmRecords = new Map<string, MunicipalityRecordRef>()
  const assignmentRefs: MunicipalityAssignmentRef[] = []

  for (const item of values) {
    for (const recordRef of item.records) {
      const { record, source } = recordRef
      mappedRecords.set(record.id, record)
      assignmentRefs.push({
        ...recordRef,
        municipalityId: item.id,
        municipalityName: item.name,
      })

      if (source === 'direct') {
        directRecords.set(record.id, recordRef)
      } else {
        celmmRecords.set(record.id, recordRef)
      }
    }
  }

  return {
    counts,
    max,
    municipalitiesWithRecords: values.filter((item) => item.total > 0).length,
    totalRecords: records.length,
    recordsWithMunicipality: mappedRecords.size,
    directRecords: directRecords.size,
    celmmRecords: celmmRecords.size,
    totalMunicipalized: values.reduce((total, item) => total + item.total, 0),
    unresolved: unresolvedRecords.length,
    mappedRecords: Array.from(mappedRecords.values()),
    directRecordRefs: Array.from(directRecords.values()),
    celmmRecordRefs: Array.from(celmmRecords.values()),
    assignmentRefs,
    unresolvedRecords,
  }
}

function hasExplicitCelmm(local: string): boolean {
  const normalizedLocal = normalizeText(local)

  return ['celmm', 'mundau', 'manguaba'].some((term) => normalizedLocal.includes(term))
}

export function getMunicipalityColor(count: number, max: number): string {
  if (count <= 0 || max <= 0) {
    return '#f4f1e8'
  }

  const ratio = count / max

  if (ratio >= 0.8) {
    return '#5b0633'
  }

  if (ratio >= 0.55) {
    return '#893160'
  }

  if (ratio >= 0.3) {
    return '#b24b82'
  }

  return '#f575b9'
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

function increment(
  counts: Map<string, MunicipalityCount>,
  feature: MunicipalityFeature,
  record: OccurrenceRecord,
  kind: 'direct' | 'celmm',
): void {
  const id = feature.properties.id ?? feature.properties.codarea ?? feature.properties.name
  const existing =
    counts.get(id) ??
    ({
      id,
      name: feature.properties.name,
      direct: 0,
      celmm: 0,
      total: 0,
      records: [],
    } satisfies MunicipalityCount)

  existing[kind] += 1
  existing.total += 1
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

function featureContainsPoint(
  feature: MunicipalityFeature,
  latitude: number,
  longitude: number,
): boolean {
  const polygons =
    feature.geometry.type === 'Polygon'
      ? [feature.geometry.coordinates as number[][][]]
      : (feature.geometry.coordinates as number[][][][])

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
  const polygons =
    feature.geometry.type === 'Polygon'
      ? [feature.geometry.coordinates as number[][][]]
      : (feature.geometry.coordinates as number[][][][])

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
