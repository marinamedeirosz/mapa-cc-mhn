// Locais que a curadoria ligou a um município, complementando a base fixa de src/data/localCoordinates.ts.
// Ficam no localStorage deste navegador e podem ser exportados/importados como JSON para a equipe.
import { normalizeText } from '@/lib/text'
import type { ImportResult, OccurrenceRecord } from '@/types'

export interface LocalMapping {
  local: string
  municipality: string
  latitude: number
  longitude: number
}

export interface UnresolvedLocal {
  local: string
  count: number
}

const storageKey = 'mapa-cc-mhn:locais-curadoria'

// Só mexe em lotes "Sem posição": coordenadas válidas e locais da base fixa continuam valendo.
export function applyLocalMappings(result: ImportResult, mappings: LocalMapping[]): ImportResult {
  if (mappings.length === 0) return result

  const byLocal = new Map(mappings.map((mapping) => [normalizeText(mapping.local), mapping]))
  const resolvedRows = new Set<number>()
  const records = result.records.map((record): OccurrenceRecord => {
    const mapping = record.positionSource === 'unresolved' ? byLocal.get(normalizeText(record.local)) : undefined
    if (!mapping) return record

    resolvedRows.add(record.rowNumber)
    return {
      ...record,
      latitude: mapping.latitude,
      longitude: mapping.longitude,
      positionLabel: `${mapping.municipality}, AL (curadoria)`,
      positionSource: 'local_fallback',
      importIssues: record.importIssues.filter((issue) => issue.field !== 'Local'),
    }
  })

  return {
    records,
    summary: {
      ...result.summary,
      fromLocal: records.filter((record) => record.positionSource === 'local_fallback').length,
      unresolved: records.filter((record) => record.positionSource === 'unresolved').length,
      issues: result.summary.issues.filter((issue) => !(issue.field === 'Local' && resolvedRows.has(issue.rowNumber))),
    },
  }
}

export function listUnresolvedLocals(records: OccurrenceRecord[]): UnresolvedLocal[] {
  const locals = new Map<string, UnresolvedLocal>()

  for (const record of records) {
    const key = normalizeText(record.local)
    if (record.positionSource !== 'unresolved' || !key) continue

    const item = locals.get(key) ?? { local: record.local.trim(), count: 0 }
    item.count += 1
    locals.set(key, item)
  }

  return Array.from(locals.values()).sort((a, b) => b.count - a.count || a.local.localeCompare(b.local, 'pt-BR'))
}

// Adiciona ou substitui o mapeamento do mesmo local (comparação sem acento/caixa).
export function upsertLocalMapping(mappings: LocalMapping[], mapping: LocalMapping): LocalMapping[] {
  const key = normalizeText(mapping.local)
  return [...mappings.filter((item) => normalizeText(item.local) !== key), mapping]
}

// Fronteira de confiança: o JSON vem de um arquivo qualquer escolhido pela pessoa.
export function parseLocalMappings(value: unknown): LocalMapping[] {
  if (!Array.isArray(value)) {
    throw new Error('O arquivo precisa ser uma lista de locais.')
  }

  return value.map((item, index) => {
    const entry = item as Partial<LocalMapping> | null
    const valid =
      typeof entry?.local === 'string' &&
      entry.local.trim() !== '' &&
      typeof entry.municipality === 'string' &&
      entry.municipality.trim() !== '' &&
      isCoordinate(entry.latitude, 90) &&
      isCoordinate(entry.longitude, 180)

    if (!valid) {
      throw new Error(`Item ${index + 1} do arquivo não tem local, município, latitude e longitude válidos.`)
    }

    return {
      local: entry.local!.trim(),
      municipality: entry.municipality!.trim(),
      latitude: entry.latitude!,
      longitude: entry.longitude!,
    }
  })
}

export function loadLocalMappings(): LocalMapping[] {
  try {
    return parseLocalMappings(JSON.parse(localStorage.getItem(storageKey) ?? '[]'))
  } catch {
    return []
  }
}

export function saveLocalMappings(mappings: LocalMapping[]): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(mappings))
  } catch {
    // Sem armazenamento (modo privado), os locais valem só até recarregar a página.
  }
}

function isCoordinate(value: unknown, limit: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit
}
