import { downloadBlob } from '@/lib/utils'
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

// Termos Darwin Core (https://dwc.tdwg.org/terms/) usados por GBIF e SiBBr.
const darwinCoreHeaders = [
  'catalogNumber',
  'basisOfRecord',
  'eventDate',
  'verbatimEventDate',
  'family',
  'scientificName',
  'locality',
  'verbatimCoordinates',
  'decimalLatitude',
  'decimalLongitude',
  'georeferenceRemarks',
  'occurrenceRemarks',
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

  return toCsv([headers, ...rows], ';')
}

export function recordsToDarwinCoreCsv(records: OccurrenceRecord[]): string {
  const rows = records.map((record) => [
    record.code,
    'PreservedSpecimen',
    record.date ? record.date.toISOString().slice(0, 10) : '',
    record.dateText,
    record.family,
    record.species,
    record.local,
    record.coordinatesText,
    record.latitude ?? '',
    record.longitude ?? '',
    georeferenceRemarks(record),
    record.observation,
  ])

  return toCsv([darwinCoreHeaders, ...rows], ',')
}

export function downloadCsv(csv: string, fileName = 'ocorrencias-filtradas.csv'): void {
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), fileName)
}

function toCsv(rows: unknown[][], separator: string): string {
  return rows.map((row) => row.map((value) => escapeCsvCell(value, separator)).join(separator)).join('\r\n')
}

function escapeCsvCell(value: unknown, separator: string): string {
  const text = String(value ?? '')
  if (/["\n\r]/.test(text) || text.includes(separator)) {
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

function georeferenceRemarks(record: OccurrenceRecord): string {
  if (record.positionSource === 'coordinates') {
    return 'Coordenadas informadas na planilha'
  }

  if (record.positionSource === 'local_fallback') {
    return `Posição aproximada pelo local: ${record.positionLabel}`
  }

  return ''
}
