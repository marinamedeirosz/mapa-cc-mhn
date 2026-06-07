import L from 'leaflet'
import 'leaflet.heat'
import { useEffect } from 'react'
import { useMap } from 'react-leaflet'

interface HeatLayerProps {
  points: [number, number, number][]
}

export function HeatLayer({ points }: HeatLayerProps) {
  const map = useMap()

  useEffect(() => {
    const layer = L.heatLayer(points, {
      radius: 28,
      blur: 22,
      maxZoom: 12,
      minOpacity: 0.28,
      gradient: {
        0.25: '#2a9d8f',
        0.55: '#e9c46a',
        0.85: '#e76f51',
      },
    }).addTo(map)

    return () => {
      layer.remove()
    }
  }, [map, points])

  return null
}
