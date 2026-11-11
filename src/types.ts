export type PositionSource = 'coordinates' | 'local_fallback' | 'unresolved'

export type MapMode = 'heatmap' | 'municipalities' | 'markers'

export type ImportIssueSeverity = 'warning' | 'error'

export interface ImportIssue {
  rowNumber: number
  code?: string
  field?: string
  message: string
  severity: ImportIssueSeverity
}

export interface OccurrenceRecord {
  id: string
  rowNumber: number
  code: string
  dateText: string
  date: Date | null
  family: string
  species: string
  local: string
  coordinatesText: string
  observation: string
  latitude: number | null
  longitude: number | null
  positionLabel: string
  positionSource: PositionSource
  importIssues: ImportIssue[]
}

export interface ImportSummary {
  fileName: string
  sheetName: string
  sheetNames: string[]
  totalRows: number
  withCoordinates: number
  fromLocal: number
  unresolved: number
  issues: ImportIssue[]
}

export interface ImportResult {
  records: OccurrenceRecord[]
  summary: ImportSummary
}

export interface Filters {
  dateStart: string
  dateEnd: string
  families: string[]
  species: string[]
  locals: string[]
  observation: string
  quickSearch: string
}

export interface FilterOptions {
  families: string[]
  species: string[]
  locals: string[]
}

export interface DistributionItem {
  label: string
  count: number
}

export interface StatsSummary {
  totalRecords: number
  totalFamilies: number
  totalSpecies: number
  totalLocals: number
  byFamily: DistributionItem[]
  bySpecies: DistributionItem[]
  byLocal: DistributionItem[]
}
