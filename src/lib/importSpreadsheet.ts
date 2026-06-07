import * as XLSX from 'xlsx'
import { resolveLocalCoordinates } from '@/data/localCoordinates'
import { formatDate, parseDateCell } from '@/lib/dates'
import { normalizeHeader, repairMojibake } from '@/lib/text'
import type { ImportIssue, ImportResult, OccurrenceRecord } from '@/types'
import { parseCoordinates } from '@/utils/parseCoordinates'

const requiredColumns = ['codigo', 'data', 'familia', 'especie', 'local', 'coordenadas', 'observacao'] as const

type RequiredColumn = (typeof requiredColumns)[number]

const columnLabels: Record<RequiredColumn, string> = {
  codigo: 'Código',
  data: 'Data',
  familia: 'Família',
  especie: 'Espécie',
  local: 'Local',
  coordenadas: 'Coordenadas',
  observacao: 'Observação',
}

type RawRow = Record<string, unknown>

export async function parseSpreadsheetFile(file: File): Promise<ImportResult> {
  const workbook = XLSX.read(await file.arrayBuffer(), {
    type: 'array',
    cellDates: true,
  })
  const sheetName = workbook.SheetNames[0]

  if (!sheetName) {
    throw new Error('A planilha não possui abas para importar.')
  }

  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<RawRow>(sheet, {
    defval: '',
    raw: true,
  })

  if (rows.length === 0) {
    throw new Error('A planilha não possui registros.')
  }

  const columnMap = buildColumnMap(rows[0])
  const missingColumns = requiredColumns.filter((column) => !columnMap[column])

  if (missingColumns.length > 0) {
    throw new Error(
      `Colunas obrigatórias ausentes: ${missingColumns
        .map((column) => columnLabels[column])
        .join(', ')}.`,
    )
  }

  const issues: ImportIssue[] = []
  const records = rows.map((row, index) => normalizeRow(row, index + 2, columnMap, issues))
  const withCoordinates = records.filter((record) => record.positionSource === 'coordinates').length
  const fromLocal = records.filter((record) => record.positionSource === 'local_fallback').length
  const unresolved = records.filter((record) => record.positionSource === 'unresolved').length

  return {
    records,
    summary: {
      fileName: file.name,
      totalRows: records.length,
      withCoordinates,
      fromLocal,
      unresolved,
      issues,
    },
  }
}

function buildColumnMap(firstRow: RawRow): Record<RequiredColumn, string> {
  const normalizedHeaders = Object.keys(firstRow).reduce<Record<string, string>>((acc, header) => {
    acc[normalizeHeader(header)] = header
    return acc
  }, {})

  return requiredColumns.reduce<Record<RequiredColumn, string>>((acc, column) => {
    acc[column] = normalizedHeaders[column] ?? ''
    return acc
  }, {} as Record<RequiredColumn, string>)
}

function normalizeRow(
  row: RawRow,
  rowNumber: number,
  columnMap: Record<RequiredColumn, string>,
  globalIssues: ImportIssue[],
): OccurrenceRecord {
  const code = cellText(row[columnMap.codigo])
  const rawDate = row[columnMap.data]
  const parsedDate = parseDateCell(rawDate)
  const family = cellText(row[columnMap.familia])
  const species = cellText(row[columnMap.especie])
  const local = cellText(row[columnMap.local])
  const coordinatesText = cellText(row[columnMap.coordenadas])
  const observation = cellText(row[columnMap.observacao])
  const importIssues: ImportIssue[] = []
  const dateText = parsedDate ? formatDate(parsedDate) : cellText(rawDate)

  if (!parsedDate && cellText(rawDate)) {
    pushIssue(importIssues, globalIssues, {
      rowNumber,
      code,
      field: 'Data',
      message: 'Data não reconhecida.',
      severity: 'warning',
    })
  }

  const coordinates = coordinatesText ? parseCoordinates(coordinatesText) : null
  if (coordinates?.ok) {
    return {
      id: `${rowNumber}-${code || 'sem-codigo'}`,
      rowNumber,
      code,
      dateText,
      date: parsedDate,
      family,
      species,
      local,
      coordinatesText,
      observation,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      positionLabel: 'Coordenadas da planilha',
      positionSource: 'coordinates',
      importIssues,
    }
  }

  if (coordinates && !coordinates.ok) {
    pushIssue(importIssues, globalIssues, {
      rowNumber,
      code,
      field: 'Coordenadas',
      message: coordinates.reason,
      severity: 'warning',
    })
  }

  const localPosition = resolveLocalCoordinates(local)
  if (localPosition) {
    return {
      id: `${rowNumber}-${code || 'sem-codigo'}`,
      rowNumber,
      code,
      dateText,
      date: parsedDate,
      family,
      species,
      local,
      coordinatesText,
      observation,
      latitude: localPosition.latitude,
      longitude: localPosition.longitude,
      positionLabel: localPosition.label,
      positionSource: 'local_fallback',
      importIssues,
    }
  }

  pushIssue(importIssues, globalIssues, {
    rowNumber,
    code,
    field: 'Local',
    message: 'Sem coordenada e local não encontrado na base offline.',
    severity: 'warning',
  })

  return {
    id: `${rowNumber}-${code || 'sem-codigo'}`,
    rowNumber,
    code,
    dateText,
    date: parsedDate,
    family,
    species,
    local,
    coordinatesText,
    observation,
    latitude: null,
    longitude: null,
    positionLabel: 'Sem posição',
    positionSource: 'unresolved',
    importIssues,
  }
}

function cellText(value: unknown): string {
  if (value instanceof Date) {
    return formatDate(value)
  }

  return repairMojibake(String(value ?? '')).trim()
}

function pushIssue(
  rowIssues: ImportIssue[],
  globalIssues: ImportIssue[],
  issue: ImportIssue,
): void {
  rowIssues.push(issue)
  globalIssues.push(issue)
}
