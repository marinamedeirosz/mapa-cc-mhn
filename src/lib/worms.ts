// Conferência de nomes científicos no WoRMS (World Register of Marine Species), API pública:
// https://www.marinespecies.org/rest/
const endpoint = 'https://www.marinespecies.org/rest/AphiaRecordsByMatchNames'
const batchSize = 50

export type WormsStatus = 'accepted' | 'synonym' | 'spelling' | 'not_found'

export interface WormsCheck {
  name: string
  status: WormsStatus
  matchedName?: string
  validName?: string
  wormsStatus?: string
  url?: string
}

interface WormsRecord {
  scientificname: string
  status: string
  match_type: string
  valid_name: string | null
  url: string
}

// "Penaeus sp." e "Uca cf. thayeri" não existem como nome: confere o gênero ou o nome sem o "cf.".
export function wormsQueryName(name: string): string {
  return name
    .replace(/\s+spp?\.?(\s*\d+)?$/i, '')
    .replace(/\s+(cf|aff)\.?\s+/i, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function classifyWormsMatch(name: string, matches: WormsRecord[] | null): WormsCheck {
  const match = matches?.[0]

  if (!match) {
    return { name, status: 'not_found' }
  }

  const details = {
    name,
    matchedName: match.scientificname,
    validName: match.valid_name ?? undefined,
    wormsStatus: match.status,
    url: match.url,
  }

  if (match.match_type !== 'exact') {
    return { ...details, status: 'spelling' }
  }

  return { ...details, status: match.status === 'accepted' ? 'accepted' : 'synonym' }
}

export async function checkNamesInWorms(names: string[], fetchFn: typeof fetch = fetch): Promise<WormsCheck[]> {
  const results: WormsCheck[] = []

  for (let start = 0; start < names.length; start += batchSize) {
    const batch = names.slice(start, start + batchSize)
    const params = new URLSearchParams({ marine_only: 'false' })
    batch.forEach((name) => params.append('scientificnames[]', wormsQueryName(name)))

    const response = await fetchFn(`${endpoint}?${params}`)
    if (!response.ok) {
      throw new Error(`O WoRMS não respondeu (HTTP ${response.status}). Tente de novo mais tarde.`)
    }

    // 204: nenhum dos nomes do lote foi encontrado.
    const matches = response.status === 204 ? [] : ((await response.json()) as Array<WormsRecord[] | null>)
    batch.forEach((name, index) => results.push(classifyWormsMatch(name, matches[index] ?? null)))
  }

  return results
}
