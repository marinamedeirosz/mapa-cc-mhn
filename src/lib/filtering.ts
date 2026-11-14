import { parseDateInput } from '@/lib/dates'
import { includesNormalized, normalizeText, uniqueSorted } from '@/lib/text'
import type { FilterOptions, Filters, OccurrenceRecord } from '@/types'

export const initialFilters: Filters = {
  mapSelection: null,
  dateStart: '',
  dateEnd: '',
  families: [],
  species: [],
  locals: [],
  observation: '',
  quickSearch: '',
}

export function buildFilterOptions(records: OccurrenceRecord[]): FilterOptions {
  return {
    families: uniqueSorted(records.map((record) => record.family)),
    species: uniqueSorted(records.map((record) => record.species)),
    locals: uniqueSorted(records.map((record) => record.local)),
  }
}

export function applyFilters(records: OccurrenceRecord[], filters: Filters): OccurrenceRecord[] {
  const dateStart = parseDateInput(filters.dateStart)
  const dateEnd = parseDateInput(filters.dateEnd)
  const families = toNormalizedSet(filters.families)
  const species = toNormalizedSet(filters.species)
  const locals = toNormalizedSet(filters.locals)
  const observation = normalizeText(filters.observation)
  const mapSelection = filters.mapSelection ? new Set(filters.mapSelection.recordIds) : null

  return records.filter((record) => {
    if (mapSelection && !mapSelection.has(record.id)) {
      return false
    }

    if (dateStart && (!record.date || record.date < dateStart)) {
      return false
    }

    if (dateEnd && (!record.date || record.date > dateEnd)) {
      return false
    }

    if (families.size > 0 && !families.has(normalizeText(record.family))) {
      return false
    }

    if (species.size > 0 && !species.has(normalizeText(record.species))) {
      return false
    }

    if (locals.size > 0 && !locals.has(normalizeText(record.local))) {
      return false
    }

    if (observation && !includesNormalized(record.observation, observation)) {
      return false
    }

    return true
  })
}

export function applyQuickSearch(records: OccurrenceRecord[], query: string): OccurrenceRecord[] {
  const normalizedQuery = normalizeText(query)
  if (!normalizedQuery) {
    return records
  }

  return records.filter((record) =>
    [
      record.code,
      record.dateText,
      record.family,
      record.species,
      record.local,
      record.coordinatesText,
      record.observation,
      record.positionLabel,
    ].some((value) => includesNormalized(value, normalizedQuery)),
  )
}

export function hasActiveFilters(filters: Filters): boolean {
  return (
    Boolean(filters.mapSelection) ||
    Boolean(filters.dateStart) ||
    Boolean(filters.dateEnd) ||
    filters.families.length > 0 ||
    filters.species.length > 0 ||
    filters.locals.length > 0 ||
    Boolean(filters.observation.trim()) ||
    Boolean(filters.quickSearch.trim())
  )
}

function toNormalizedSet(values: string[]): Set<string> {
  return new Set(values.map((value) => normalizeText(value)).filter(Boolean))
}
