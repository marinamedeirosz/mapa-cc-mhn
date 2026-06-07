import L from 'leaflet'
import { useEffect } from 'react'
import { GeoJSON, useMap } from 'react-leaflet'
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
}

export function MunicipalityChoroplethLayer({
  geojson,
  aggregation,
  onMunicipalityClick,
}: MunicipalityChoroplethLayerProps) {
  const map = useMap()

  useEffect(() => {
    const bounds = L.geoJSON(geojson).getBounds()
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [16, 16] })
    }
  }, [geojson, map])

  return (
    <GeoJSON
      key={`${aggregation.max}-${aggregation.totalMunicipalized}-${aggregation.unresolved}`}
      data={geojson}
      style={(feature) => {
        const municipalityFeature = feature as MunicipalityFeature
        const id = municipalityFeature.properties.id ?? municipalityFeature.properties.codarea ?? ''
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
        const id = municipalityFeature.properties.id ?? municipalityFeature.properties.codarea ?? ''
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
  )
}
