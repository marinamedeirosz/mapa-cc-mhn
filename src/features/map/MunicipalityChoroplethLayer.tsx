import L from 'leaflet'
import { useEffect, useMemo, useState } from 'react'
import { GeoJSON, Marker, Polyline, useMap } from 'react-leaflet'
import {
  getMunicipalityFeatureId,
  selectMunicipalityLabels,
} from '@/lib/municipalityMapExport'
import { getMunicipalityColor } from '@/lib/municipalityAggregation'
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
}

export function MunicipalityChoroplethLayer({
  geojson,
  aggregation,
  onMunicipalityClick,
  showLabels,
}: MunicipalityChoroplethLayerProps) {
  const map = useMap()
  const [mapRevision, setMapRevision] = useState(0)

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
        key={`${aggregation.max}-${aggregation.totalMunicipalized}-${aggregation.unresolved}`}
        data={geojson}
        style={(feature) => {
          const municipalityFeature = feature as MunicipalityFeature
          const id = getMunicipalityFeatureId(municipalityFeature)
          const count = aggregation.counts.get(id)?.total ?? 0

          return {
            color: '#65736f',
            fillColor: getMunicipalityColor(count, aggregation.max),
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

          layer.bindTooltip(`${name}: ${total}`, { sticky: true })
          layer.on('click', () => {
            if (total > 0) {
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
    html: `<span>${escapeHtml(name)} <strong>${total}</strong></span>`,
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
