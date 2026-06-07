import type { DistributionItem, OccurrenceRecord, StatsSummary } from '@/types'

export function buildStats(records: OccurrenceRecord[]): StatsSummary {
  return {
    totalRecords: records.length,
    totalFamilies: countUnique(records.map((record) => record.family)),
    totalSpecies: countUnique(records.map((record) => record.species)),
    totalLocals: countUnique(records.map((record) => record.local)),
    byFamily: distribution(records.map((record) => record.family)),
    bySpecies: distribution(records.map((record) => record.species)),
    byLocal: distribution(records.map((record) => record.local)),
  }
}

function countUnique(values: string[]): number {
  return new Set(values.filter(Boolean)).size
}

function distribution(values: string[]): DistributionItem[] {
  const counts = values.filter(Boolean).reduce<Map<string, number>>((acc, value) => {
    acc.set(value, (acc.get(value) ?? 0) + 1)
    return acc
  }, new Map())

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'pt-BR'))
}
