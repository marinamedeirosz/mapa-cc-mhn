import L from 'leaflet'
import { useEffect, useMemo, useState } from 'react'
import { GeoJSON, Marker, Polyline, useMap } from 'react-leaflet'
import { formatMunicipalityLabel, selectMunicipalityLabels } from '@/lib/municipalityMapExport'
import { getMunicipalityColor, getMunicipalityFeatureId } from '@/lib/municipalityAggregation'
import type {
  MunicipalityAggregation,
  MunicipalityFeature,
  MunicipalityFeatureCollection,
} from '@/lib/municipalityAggregation'

interface MunicipalityChoroplethLayerProps {
  geojson: MunicipalityFeatureCollection
  aggregation: MunicipalityAggregation
  onMunicipalityClick: (municipalityId: string) => void
  showLabels: boolean
  accentColor: string
}

export function MunicipalityChoroplethLayer({
  geojson,
  aggregation,
  onMunicipalityClick,
  showLabels,
  accentColor,
}: MunicipalityChoroplethLayerProps) {
  const map = useMap()
  const [mapRevision, setMapRevision] = useState(0)
  // Tooltip e clique só são recriados quando a key muda, então ela precisa refletir cada município.
  const layerKey = useMemo(
    () =>
      [
        aggregation.grouping,
        accentColor,
        ...Array.from(aggregation.counts.values(), (count) => `${count.id}:${count.total}:${count.lotTotal}:${count.missingGroupingLots}`),
      ].join('|'),
    [aggregation, accentColor],
  )

  useEffect(() => {
    const bounds = L.geoJSON(geojson).getBounds()
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [16, 16] })
    }
  }, [geojson, map])

  useEffect(() => {
    const refreshLabels = () => {
      setMapRevision((value) => value + 1)
    }

    map.on('moveend zoomend resize', refreshLabels)

    return () => {
      map.off('moveend zoomend resize', refreshLabels)
    }
  }, [map])

  const labels = useMemo(() => {
    void mapRevision

    if (!showLabels) {
      return []
    }

    const size = map.getSize()

    return selectMunicipalityLabels({
      geojson,
      aggregation,
      bounds: {
        left: 10,
        right: size.x - 10,
        top: 12,
        bottom: size.y - 12,
      },
      project: ({ latitude, longitude }) => {
        const point = map.latLngToContainerPoint([latitude, longitude])
        return { x: point.x, y: point.y }
      },
    })
  }, [aggregation, geojson, map, mapRevision, showLabels])

  return (
    <>
      <GeoJSON
        key={layerKey}
        data={geojson}
        style={(feature) => {
          const municipalityFeature = feature as MunicipalityFeature
          const id = getMunicipalityFeatureId(municipalityFeature)
          const count = aggregation.counts.get(id)?.total ?? 0

          return {
            color: '#65736f',
            fillColor: getMunicipalityColor(count, aggregation.max, accentColor),
            fillOpacity: count > 0 ? 0.82 : 0.45,
            opacity: 0.95,
            weight: count > 0 ? 1.4 : 0.8,
          }
        }}
        onEachFeature={(feature, layer) => {
          const municipalityFeature = feature as MunicipalityFeature
          const id = getMunicipalityFeatureId(municipalityFeature)
          const data = aggregation.counts.get(id)
          const name = municipalityFeature.properties.name
          const total = data?.total ?? 0
          const lotTotal = data?.lotTotal ?? 0
          const unit = aggregation.grouping === 'lot' ? 'lote(s)' : aggregation.grouping === 'family' ? 'família(s)' : 'espécie(s)'
          const missing = data?.missingGroupingLots ?? 0
          const missingText = missing > 0 ? ` · ${missing} lote(s) sem informação` : ''

          layer.bindTooltip(`${name}: ${total} ${unit} · ${lotTotal} lote(s)${missingText}`, { sticky: true })
          // Contorno escuro no município sob o mouse, para saber qual está sendo lido.
          layer.on('mouseover', () => (layer as L.Path).setStyle({ color: '#172021', weight: 2.5 }))
          layer.on('mouseout', () => (layer as L.Path).setStyle({ color: '#65736f', weight: total > 0 ? 1.4 : 0.8 }))
          layer.on('click', () => {
            if (lotTotal > 0) {
              onMunicipalityClick(id)
            }
          })
        }}
      />
      {labels.map((label) => (
        <MunicipalityLabelOverlay key={label.id} label={label} />
      ))}
    </>
  )
}

function MunicipalityLabelOverlay({ label }: { label: ReturnType<typeof selectMunicipalityLabels>[number] }) {
  const map = useMap()
  const markerPosition = map.containerPointToLatLng([label.labelX, label.labelY])
  const linePositions =
    label.lineStart && label.lineEnd
      ? [
          map.containerPointToLatLng([label.lineStart.x, label.lineStart.y]),
          map.containerPointToLatLng([label.lineEnd.x, label.lineEnd.y]),
        ]
      : null

  return (
    <>
      {linePositions ? (
        <Polyline
          positions={linePositions}
          pathOptions={{
            color: '#4b5d5c',
            dashArray: '4 5',
            opacity: 0.88,
            weight: 1.2,
          }}
          interactive={false}
        />
      ) : null}
      <Marker
        position={markerPosition}
        icon={municipalityLabelIcon(label.name, label.total, label.width, label.placement)}
        interactive={false}
        keyboard={false}
      />
    </>
  )
}

function municipalityLabelIcon(
  name: string,
  total: number,
  width: number,
  placement: string,
) {
  return L.divIcon({
    className: `municipality-label-marker ${placement === 'inside' ? 'inside' : 'callout'}`,
    html: `<span>${escapeHtml(formatMunicipalityLabel(name, total))}</span>`,
    iconSize: [width, 24],
    iconAnchor: [width / 2, 12],
  })
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
