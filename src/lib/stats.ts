import { normalizeText } from '@/lib/text'
import type { DistributionItem, OccurrenceRecord, StatsSummary, YearCount } from '@/types'

export function buildStats(records: OccurrenceRecord[]): StatsSummary {
  const byFamily = distribution(records.map((record) => record.family))
  const bySpecies = distribution(records.map((record) => record.species))
  const byLocal = distribution(records.map((record) => record.local))

  return {
    totalRecords: records.length,
    totalFamilies: byFamily.length,
    totalSpecies: bySpecies.length,
    totalLocals: byLocal.length,
    byFamily,
    bySpecies,
    byLocal,
  }
}

// Anos sem coleta entram com zero: as lacunas no tempo são justamente o que se quer ver.
export function countByYear(records: OccurrenceRecord[]): YearCount[] {
  const counts = new Map<number, number>()

  for (const record of records) {
    if (record.date) {
      const year = record.date.getUTCFullYear()
      counts.set(year, (counts.get(year) ?? 0) + 1)
    }
  }

  if (counts.size === 0) return []

  const years = Array.from(counts.keys())
  const first = Math.min(...years)
  const last = Math.max(...years)

  return Array.from({ length: last - first + 1 }, (_, index) => ({
    year: first + index,
    count: counts.get(first + index) ?? 0,
  }))
}

// Mesma regra dos filtros e do mapa: "PENAEIDAE" e "Penaeidae" são um item só.
function distribution(values: string[]): DistributionItem[] {
  const items = new Map<string, DistributionItem>()

  for (const value of values) {
    const key = normalizeText(value)
    if (!key) continue

    const item = items.get(key) ?? { label: value.trim(), count: 0 }
    item.count += 1
    items.set(key, item)
  }

  return Array.from(items.values()).sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label, 'pt-BR'),
  )
}
