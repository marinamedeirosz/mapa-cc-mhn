import type { OccurrenceRecord } from '@/types'

const headers = [
  'Código',
  'Data',
  'Família',
  'Espécie',
  'Local',
  'Coordenadas',
  'Observação',
  'Latitude',
  'Longitude',
  'Origem da posição',
]

export function recordsToCsv(records: OccurrenceRecord[]): string {
  const rows = records.map((record) => [
    record.code,
    record.dateText,
    record.family,
    record.species,
    record.local,
    record.coordinatesText,
    record.observation,
    record.latitude ?? '',
    record.longitude ?? '',
    positionSourceLabel(record),
  ])

  return [headers, ...rows].map((row) => row.map(escapeCsvCell).join(';')).join('\r\n')
}

export function downloadCsv(records: OccurrenceRecord[], fileName = 'ocorrencias-filtradas.csv'): void {
  const blob = new Blob([recordsToCsv(records)], {
    type: 'text/csv;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

function escapeCsvCell(value: unknown): string {
  const text = String(value ?? '')
  if (/[;"\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }

  return text
}

function positionSourceLabel(record: OccurrenceRecord): string {
  if (record.positionSource === 'coordinates') {
    return 'Coordenadas'
  }

  if (record.positionSource === 'local_fallback') {
    return `Local: ${record.positionLabel}`
  }

  return 'Sem posição'
}
