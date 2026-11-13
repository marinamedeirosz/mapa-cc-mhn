import { getMunicipalityColor, getMunicipalityFeatureId } from '@/lib/municipalityAggregation'
import type {
  MunicipalityAggregation,
  MunicipalityFeature,
  MunicipalityFeatureCollection,
  MunicipalityGrouping,
} from '@/lib/municipalityAggregation'

export interface ProjectedPoint {
  x: number
  y: number
}

export interface MunicipalityLabel {
  id: string
  name: string
  total: number
  projectedArea: number
  latitude: number
  longitude: number
  anchorX: number
  anchorY: number
  labelX: number
  labelY: number
  x: number
  y: number
  width: number
  height: number
  placement: 'inside' | 'callout-left' | 'callout-right'
  lineStart: ProjectedPoint | null
  lineEnd: ProjectedPoint | null
}

interface LayoutLabelOptions {
  geojson: MunicipalityFeatureCollection
  aggregation: MunicipalityAggregation
  project: (position: { latitude: number; longitude: number }) => ProjectedPoint
  maxLabels?: number
  bounds?: LabelLayoutBounds
  balanceCallouts?: boolean
}

interface ReportSvgOptions {
  geojson: MunicipalityFeatureCollection
  aggregation: MunicipalityAggregation
  showLabels: boolean
  accentColor?: string
  width?: number
  height?: number
}

const reportWidth = 1600
const reportHeight = 900
const mapWidth = 1540
const mapHeight = 840
const mapX = 30
const mapY = 30
const mapPadding = 18
const reportCalloutPadding = 12
const smallMunicipalityAreaThreshold = 1800
const calloutColumnWidth = 240
const calloutColumnGap = 24

export function getMunicipalityMapFileName(
  grouping: MunicipalityGrouping = 'lot',
  date = new Date(),
  extension: 'png' | 'svg' = 'png',
): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const groupingSlug = grouping === 'lot' ? 'lotes' : grouping === 'family' ? 'familias' : 'especies'

  return `mapa-municipios-alagoas-por-${groupingSlug}-${year}-${month}-${day}.${extension}`
}

export function formatMunicipalityLabel(name: string, total: number): string {
  return `${name} (${total})`
}

export function layoutMunicipalityLabels({
  geojson,
  aggregation,
  project,
  maxLabels = Number.POSITIVE_INFINITY,
  bounds,
  balanceCallouts = false,
}: LayoutLabelOptions): MunicipalityLabel[] {
  const occupied: LabelBox[] = []
  const callouts: MunicipalityLabel[] = []
  const candidates = geojson.features
    .map<MunicipalityLabel | null>((feature) => {
      const id = getMunicipalityFeatureId(feature)
      const count = aggregation.counts.get(id)

      if (!count || count.total <= 0) {
        return null
      }

      const center = getMunicipalityCenter(feature)
      const point = project(center)
      const width = estimateLabelWidth(formatMunicipalityLabel(count.name, count.total))
      const height = 22
      const projectedArea = getProjectedFeatureArea(feature, project)

      const label: MunicipalityLabel = {
        id,
        name: count.name,
        total: count.total,
        projectedArea,
        latitude: center.latitude,
        longitude: center.longitude,
        anchorX: point.x,
        anchorY: point.y,
        labelX: point.x,
        labelY: point.y,
        x: point.x,
        y: point.y,
        width,
        height,
        placement: 'inside',
        lineStart: null,
        lineEnd: null,
      }

      return label
    })
    .filter((label): label is MunicipalityLabel => Boolean(label))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'pt-BR'))

  const selected: MunicipalityLabel[] = []
  const layoutBounds = bounds ?? inferLabelBounds(candidates)
  const insideBounds = {
    left: layoutBounds.left + calloutColumnWidth + calloutColumnGap,
    right: layoutBounds.right - calloutColumnWidth - calloutColumnGap,
    top: layoutBounds.top,
    bottom: layoutBounds.bottom,
  }

  for (const label of candidates) {
    if (selected.length >= maxLabels) {
      break
    }

    const box = labelBox(label)
    const collides = occupied.some((existing) => boxesCollide(existing, box))

    if (!isSmallMunicipalityLabel(label) && !collides && boxFits(box, insideBounds)) {
      selected.push(label)
      occupied.push(box)
    } else {
      callouts.push(label)
    }
  }

  return selected.concat(distributeCallouts(callouts, layoutBounds, balanceCallouts))
}

export const selectMunicipalityLabels = layoutMunicipalityLabels

export function buildMunicipalityReportSvg({
  geojson,
  aggregation,
  showLabels,
  accentColor,
  width = reportWidth,
  height = reportHeight,
}: ReportSvgOptions): string {
  const projection = createSvgProjection(geojson, mapX + 110, mapY, mapWidth - 220, mapHeight, mapPadding)
  const labels = showLabels
    ? layoutMunicipalityLabels({
        geojson,
        aggregation,
        project: ({ latitude, longitude }) => projection.project(latitude, longitude),
        bounds: {
          left: mapX + reportCalloutPadding,
          right: mapX + mapWidth - reportCalloutPadding,
          top: mapY + 12,
          bottom: mapY + mapHeight - 12,
        },
        balanceCallouts: true,
      })
    : []
  const marine = marineToSvg(aggregation, projection, getMunicipalityColor(1, 1, accentColor))
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#f8faf8"/>
  <rect x="${mapX}" y="${mapY}" width="${mapWidth}" height="${mapHeight}" rx="10" fill="#dcecef" stroke="#c6d6d8"/>
  <g>
    ${geojson.features.map((feature) => featureToSvg(feature, aggregation, projection, accentColor)).join('\n    ')}
  </g>
  ${labels.map(labelToSvg).join('\n  ')}
  ${marine}
</svg>`
}

// Lotes marinhos viram pontos; os que caem fora do recorte do mapa só entram na contagem da legenda.
function marineToSvg(aggregation: MunicipalityAggregation, projection: SvgProjection, color: string): string {
  const total = aggregation.marineRecords.length
  if (total === 0) return ''

  const points = aggregation.marineRecords
    .map((record) => projection.project(record.latitude!, record.longitude!))
    .filter(({ x, y }) => x >= mapX && x <= mapX + mapWidth && y >= mapY && y <= mapY + mapHeight)
  const outside = total - points.length
  const legendY = mapY + mapHeight - 20

  return [
    ...points.map(({ x, y }) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" fill="${color}" stroke="#ffffff" stroke-width="2"/>`),
    `<circle cx="${mapX + 22}" cy="${legendY - 4}" r="6" fill="${color}" stroke="#ffffff" stroke-width="2"/>`,
    `<text x="${mapX + 34}" y="${legendY}" font-family="Inter, Arial, sans-serif" font-size="13" fill="#172021">${escapeXml(
      `Lotes marinhos: ${total}${outside > 0 ? ` (${outside} fora do recorte)` : ''}`,
    )}</text>`,
  ].join('\n  ')
}

export async function downloadMunicipalityMapPng(svg: string, fileName: string): Promise<void> {
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  try {
    const image = await loadImage(url)
    const canvas = document.createElement('canvas')
    // 2x: o PNG sai com 3200 x 1800 px, nítido em impressão e apresentações.
    const scale = 2
    canvas.width = reportWidth * scale
    canvas.height = reportHeight * scale
    const context = canvas.getContext('2d')

    if (!context) {
      throw new Error('Não foi possível preparar a imagem do mapa.')
    }

    context.fillStyle = '#f8faf8'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)

    const pngUrl = canvas.toDataURL('image/png')
    const link = document.createElement('a')
    link.href = pngUrl
    link.download = fileName
    link.click()
  } finally {
    URL.revokeObjectURL(url)
  }
}

function featureToSvg(
  feature: MunicipalityFeature,
  aggregation: MunicipalityAggregation,
  projection: SvgProjection,
  accentColor?: string,
): string {
  const id = getMunicipalityFeatureId(feature)
  const count = aggregation.counts.get(id)?.total ?? 0
  const fillColor = getMunicipalityColor(count, aggregation.max, accentColor)
  const fillOpacity = count > 0 ? 0.84 : 0.5
  const weight = count > 0 ? 1.35 : 0.8

  return `<path d="${featureToPath(feature, projection)}" fill="${fillColor}" fill-opacity="${fillOpacity}" stroke="#65736f" stroke-width="${weight}" stroke-linejoin="round"/>`
}

function featureToPath(feature: MunicipalityFeature, projection: SvgProjection): string {
  const polygons = getPolygons(feature)

  return polygons
    .map((polygon) =>
      polygon
        .map((ring) =>
          ring
            .map(([longitude, latitude], index) => {
              const point = projection.project(latitude, longitude)
              return `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`
            })
            .join(' ')
            .concat(' Z'),
        )
        .join(' '),
    )
    .join(' ')
}

function getProjectedFeatureArea(
  feature: MunicipalityFeature,
  project: (position: { latitude: number; longitude: number }) => ProjectedPoint,
): number {
  return getPolygons(feature).reduce((featureArea, polygon) => {
    const [outerRing] = polygon

    if (!outerRing) {
      return featureArea
    }

    const projectedRing = outerRing.map(([longitude, latitude]) => {
      const point = project({ latitude, longitude })
      return [point.x, point.y] as Coordinate
    })

    return featureArea + Math.abs(ringArea(projectedRing))
  }, 0)
}

function getMunicipalityCenter(feature: MunicipalityFeature): { latitude: number; longitude: number } {
  const largestRing = getPolygons(feature)
    .map((polygon) => polygon[0])
    .filter((ring): ring is RingCoordinates => Boolean(ring))
    .sort((a, b) => Math.abs(ringArea(b)) - Math.abs(ringArea(a)))[0]

  if (!largestRing) {
    return { latitude: 0, longitude: 0 }
  }

  const area = ringArea(largestRing)
  if (area === 0) {
    const totals = largestRing.reduce(
      (acc, [longitude, latitude]) => ({
        latitude: acc.latitude + latitude,
        longitude: acc.longitude + longitude,
      }),
      { latitude: 0, longitude: 0 },
    )

    return {
      latitude: totals.latitude / largestRing.length,
      longitude: totals.longitude / largestRing.length,
    }
  }

  let longitudeSum = 0
  let latitudeSum = 0

  for (let index = 0; index < largestRing.length - 1; index += 1) {
    const [x0, y0] = largestRing[index]
    const [x1, y1] = largestRing[index + 1]
    const cross = x0 * y1 - x1 * y0
    longitudeSum += (x0 + x1) * cross
    latitudeSum += (y0 + y1) * cross
  }

  return {
    latitude: latitudeSum / (6 * area),
    longitude: longitudeSum / (6 * area),
  }
}

function createSvgProjection(
  geojson: MunicipalityFeatureCollection,
  x: number,
  y: number,
  width: number,
  height: number,
  padding: number,
): SvgProjection {
  const bounds = getGeoBounds(geojson)
  const drawableWidth = width - padding * 2
  const drawableHeight = height - padding * 2
  const scale = Math.min(
    drawableWidth / (bounds.maxLongitude - bounds.minLongitude),
    drawableHeight / (bounds.maxLatitude - bounds.minLatitude),
  )
  const renderedWidth = (bounds.maxLongitude - bounds.minLongitude) * scale
  const renderedHeight = (bounds.maxLatitude - bounds.minLatitude) * scale
  const offsetX = x + padding + (drawableWidth - renderedWidth) / 2
  const offsetY = y + padding + (drawableHeight - renderedHeight) / 2

  return {
    project(latitude, longitude) {
      return {
        x: offsetX + (longitude - bounds.minLongitude) * scale,
        y: offsetY + (bounds.maxLatitude - latitude) * scale,
      }
    },
  }
}

function getGeoBounds(geojson: MunicipalityFeatureCollection) {
  const coordinates = geojson.features.flatMap((feature) =>
    getPolygons(feature).flatMap((polygon) => polygon.flat()),
  )
  const longitudes = coordinates.map(([longitude]) => longitude)
  const latitudes = coordinates.map(([, latitude]) => latitude)

  return {
    minLongitude: Math.min(...longitudes),
    maxLongitude: Math.max(...longitudes),
    minLatitude: Math.min(...latitudes),
    maxLatitude: Math.max(...latitudes),
  }
}

function getPolygons(feature: MunicipalityFeature): PolygonCoordinates[] {
  return feature.geometry.type === 'Polygon'
    ? [feature.geometry.coordinates as PolygonCoordinates]
    : (feature.geometry.coordinates as PolygonCoordinates[])
}

function ringArea(ring: RingCoordinates): number {
  let area = 0

  for (let index = 0; index < ring.length - 1; index += 1) {
    const [x0, y0] = ring[index]
    const [x1, y1] = ring[index + 1]
    area += x0 * y1 - x1 * y0
  }

  return area / 2
}

type Coordinate = [number, number]
type RingCoordinates = Coordinate[]
type PolygonCoordinates = RingCoordinates[]

function estimateLabelWidth(name: string): number {
  return Math.min(Math.max(name.length * 7 + 42, 78), 220)
}

function labelBox(label: MunicipalityLabel): LabelBox {
  return {
    left: label.labelX - label.width / 2,
    right: label.labelX + label.width / 2,
    top: label.labelY - label.height / 2,
    bottom: label.labelY + label.height / 2,
  }
}

function isSmallMunicipalityLabel(label: MunicipalityLabel): boolean {
  return label.projectedArea < smallMunicipalityAreaThreshold
}

function boxesCollide(a: LabelBox, b: LabelBox): boolean {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom)
}

function boxFits(box: LabelBox, bounds: LabelLayoutBounds): boolean {
  return (
    box.left >= bounds.left &&
    box.right <= bounds.right &&
    box.top >= bounds.top &&
    box.bottom <= bounds.bottom
  )
}

function labelToSvg(label: MunicipalityLabel): string {
  const text = formatMunicipalityLabel(label.name, label.total)
  const line =
    label.lineStart && label.lineEnd
      ? `<polyline points="${label.lineStart.x.toFixed(1)},${label.lineStart.y.toFixed(1)} ${label.lineEnd.x.toFixed(1)},${label.lineEnd.y.toFixed(1)}" fill="none" stroke="#4b5d5c" stroke-width="1.2" stroke-dasharray="4 4" stroke-linecap="round"/>`
      : ''

  return `${line}
  <g transform="translate(${label.labelX.toFixed(1)} ${label.labelY.toFixed(1)})">
    <rect x="${(-label.width / 2).toFixed(1)}" y="-12" width="${label.width}" height="24" rx="12" fill="#ffffff" fill-opacity="0.88" stroke="#c6d6d8"/>
    <text x="0" y="4" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="12" font-weight="700" fill="#172021">${escapeXml(text)}</text>
  </g>`
}

function inferLabelBounds(labels: MunicipalityLabel[]): LabelLayoutBounds {
  const xs = labels.map((label) => label.anchorX)
  const ys = labels.map((label) => label.anchorY)

  return {
    left: Math.min(...xs) - 120,
    right: Math.max(...xs) + 120,
    top: Math.min(...ys) - 40,
    bottom: Math.max(...ys) + 40,
  }
}

function toCalloutLabel(
  label: MunicipalityLabel,
  bounds: LabelLayoutBounds,
  forcedPlacement?: 'callout-left' | 'callout-right',
): MunicipalityLabel {
  const center = (bounds.left + bounds.right) / 2
  const placement = forcedPlacement ?? (label.anchorX < center ? 'callout-left' : 'callout-right')
  const labelX =
    placement === 'callout-left' ? bounds.left + label.width / 2 : bounds.right - label.width / 2
  const lineEndX =
    placement === 'callout-left' ? labelX + label.width / 2 : labelX - label.width / 2

  return {
    ...label,
    placement,
    labelX,
    labelY: clamp(label.anchorY, bounds.top + label.height / 2, bounds.bottom - label.height / 2),
    x: labelX,
    y: label.anchorY,
    lineStart: { x: label.anchorX, y: label.anchorY },
    lineEnd: { x: lineEndX, y: label.anchorY },
  }
}

function distributeCallouts(
  callouts: MunicipalityLabel[],
  bounds: LabelLayoutBounds,
  balanceCallouts: boolean,
): MunicipalityLabel[] {
  const preparedCallouts = balanceCallouts ? balanceCalloutSides(callouts, bounds) : callouts.map((label) => toCalloutLabel(label, bounds))
  const left = distributeCalloutColumn(
    preparedCallouts.filter((label) => label.placement === 'callout-left'),
    bounds,
  )
  const right = distributeCalloutColumn(
    preparedCallouts.filter((label) => label.placement === 'callout-right'),
    bounds,
  )

  return left.concat(right)
}

function balanceCalloutSides(
  labels: MunicipalityLabel[],
  bounds: LabelLayoutBounds,
): MunicipalityLabel[] {
  const left: MunicipalityLabel[] = []
  const right: MunicipalityLabel[] = []
  const sorted = labels
    .slice()
    .sort((a, b) => a.anchorY - b.anchorY || b.total - a.total || a.name.localeCompare(b.name, 'pt-BR'))

  for (const label of sorted) {
    const naturalSide = label.anchorX < (bounds.left + bounds.right) / 2 ? 'left' : 'right'
    const leftCost = sideCost(left, label, naturalSide === 'left')
    const rightCost = sideCost(right, label, naturalSide === 'right')

    if (leftCost <= rightCost) {
      left.push(toCalloutLabel(label, bounds, 'callout-left'))
    } else {
      right.push(toCalloutLabel(label, bounds, 'callout-right'))
    }
  }

  return left.concat(right)
}

function sideCost(side: MunicipalityLabel[], label: MunicipalityLabel, isNaturalSide: boolean): number {
  const densityCost = side.length * 140
  const proximityCost = side.reduce((total, existing) => {
    const distance = Math.abs(existing.anchorY - label.anchorY)
    return total + Math.max(0, 90 - distance)
  }, 0)
  const crossingPenalty = isNaturalSide ? 0 : 260

  return densityCost + proximityCost + crossingPenalty
}

function distributeCalloutColumn(
  labels: MunicipalityLabel[],
  bounds: LabelLayoutBounds,
): MunicipalityLabel[] {
  const sorted = labels
    .slice()
    .sort((a, b) => a.anchorY - b.anchorY || b.total - a.total || a.name.localeCompare(b.name, 'pt-BR'))

  if (sorted.length === 0) {
    return []
  }

  const availableHeight = bounds.bottom - bounds.top
  const labelsHeight = sorted.reduce((total, label) => total + label.height, 0)
  const gap =
    sorted.length > 1 ? Math.max(0, Math.min(5, (availableHeight - labelsHeight) / (sorted.length - 1))) : 0
  const centers = sorted.reduce<number[]>((acc, label, index) => {
    const previous = sorted[index - 1]
    const previousCenter = acc[index - 1]
    const minY =
      index === 0
        ? bounds.top + label.height / 2
        : previousCenter + previous.height / 2 + gap + label.height / 2
    const maxY = bounds.bottom - label.height / 2
    acc.push(clamp(label.anchorY, minY, maxY))
    return acc
  }, [])
  const last = sorted[sorted.length - 1]
  const overflow = centers[centers.length - 1] + last.height / 2 - bounds.bottom
  const shifted = overflow > 0 ? centers.map((center) => center - overflow) : centers
  const underflow = bounds.top - (shifted[0] - sorted[0].height / 2)
  const normalized = underflow > 0 ? shifted.map((center) => center + underflow) : shifted
  let previousCenter = Number.NEGATIVE_INFINITY

  return sorted.map((label, index) => {
    const previous = sorted[index - 1]
    const minY =
      index === 0
        ? bounds.top + label.height / 2
        : previousCenter + previous.height / 2 + gap + label.height / 2
    const labelY = Math.max(normalized[index], minY)
    previousCenter = labelY

    return withCalloutY(label, labelY)
  })
}

function withCalloutY(label: MunicipalityLabel, labelY: number): MunicipalityLabel {
  return {
    ...label,
    labelY,
    y: labelY,
    lineEnd: label.lineEnd ? { ...label.lineEnd, y: labelY } : null,
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Não foi possível gerar a imagem do mapa.'))
    image.src = url
  })
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

interface SvgProjection {
  project: (latitude: number, longitude: number) => ProjectedPoint
}

interface LabelLayoutBounds {
  left: number
  right: number
  top: number
  bottom: number
}

interface LabelBox {
  left: number
  right: number
  top: number
  bottom: number
}
