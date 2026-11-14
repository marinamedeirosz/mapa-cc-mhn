import type { WorkSheet } from 'xlsx'
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

export async function parseSpreadsheetFile(file: File, requestedSheet?: string): Promise<ImportResult> {
  // Carregado só aqui: a biblioteca tem centenas de kB e só é usada ao importar.
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(await file.arrayBuffer(), {
    type: 'array',
    cellDates: true,
    // Em CSV, mantém o texto: sem isso o SheetJS lê datas como mês/dia e apaga zeros de códigos.
    raw: true,
  })
  const sheetNames = workbook.SheetNames

  if (sheetNames.length === 0) {
    throw new Error('A planilha não possui abas para importar.')
  }

  // Sem aba pedida, usa a primeira com as colunas esperadas (pula abas de instruções, por exemplo).
  const sheetName =
    requestedSheet && sheetNames.includes(requestedSheet)
      ? requestedSheet
      : (sheetNames.find((name) => hasRequiredColumns(XLSX, workbook.Sheets[name])) ?? sheetNames[0])

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
    // SheetJS nomeia cabeçalhos vazios como __EMPTY.
    const foundColumns = Object.keys(rows[0]).filter((header) => !header.startsWith('__EMPTY'))
    throw new Error(
      `Colunas obrigatórias ausentes: ${missingColumns
        .map((column) => columnLabels[column])
        .join(', ')}. Colunas encontradas: ${foundColumns.join(', ') || 'nenhuma'}.`,
    )
  }

  const dataRows = rows
    // sheet_to_json pula linhas vazias; __rowNum__ (base 0) guarda a linha real da planilha.
    .map((row) => ({ row, rowNumber: (row.__rowNum__ as number) + 1 }))
    .filter(({ row }) => rowHasData(row))

  if (dataRows.length === 0) {
    throw new Error('A planilha não possui registros.')
  }

  const issues: ImportIssue[] = []
  const records = dataRows.map(({ row, rowNumber }) => normalizeRow(row, rowNumber, columnMap, issues))
  const withCoordinates = records.filter((record) => record.positionSource === 'coordinates').length
  const fromLocal = records.filter((record) => record.positionSource === 'local_fallback').length
  const unresolved = records.filter((record) => record.positionSource === 'unresolved').length

  return {
    records,
    summary: {
      fileName: file.name,
      sheetName,
      sheetNames,
      totalRows: records.length,
      withCoordinates,
      fromLocal,
      unresolved,
      issues,
    },
  }
}

export async function downloadSpreadsheetTemplate(): Promise<void> {
  const XLSX = await import('xlsx')
  const sheet = XLSX.utils.aoa_to_sheet([
    requiredColumns.map((column) => columnLabels[column]),
    ['CC00019', '12/04/2025', 'PENAEIDAE', 'Penaeus sp.', 'Maceió, AL', `9°34'22"S / 35°46'40"W`, 'Linha de exemplo: substitua pelos seus registros'],
  ])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Registros')
  XLSX.writeFile(workbook, 'modelo-mapa-cc-mhn.xlsx')
}

function hasRequiredColumns(XLSX: typeof import('xlsx'), sheet: WorkSheet): boolean {
  const [header = []] = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })
  const headers = new Set(header.map(normalizeHeader))

  return requiredColumns.every((column) => headers.has(column))
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

function rowHasData(row: RawRow): boolean {
  return Object.values(row).some((value) => cellText(value) !== '')
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
