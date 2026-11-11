import { normalizeText } from '@/lib/text'
import type { DistributionItem, OccurrenceRecord, StatsSummary } from '@/types'

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
