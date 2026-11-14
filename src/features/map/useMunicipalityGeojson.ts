import { useEffect, useState } from 'react'
import type { MunicipalityFeatureCollection } from '@/lib/municipalityAggregation'

export function useMunicipalityGeojson() {
  const [geojson, setGeojson] = useState<MunicipalityFeatureCollection | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch(`${import.meta.env.BASE_URL}data/alagoas-municipios.geojson`)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json() as Promise<MunicipalityFeatureCollection>
      })
      .then((data) => {
        if (!cancelled) setGeojson(data)
      })
      .catch(() => {
        if (!cancelled) setError('Não foi possível carregar a malha municipal de Alagoas. Recarregue a página para tentar de novo.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { geojson, error }
}
