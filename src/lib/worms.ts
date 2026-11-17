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

// Medido com a coleção real: cada bloco de 50 nomes leva 5–10 s no WoRMS, e 5 blocos em sequência davam 38 s.
// Por isso 3 blocos em paralelo (gentil com um serviço público) e memória dos nomes já conferidos.
const concurrency = 3
const cache = new Map<string, WormsCheck>()

export async function checkNamesInWorms(
  names: string[],
  fetchFn: typeof fetch = fetch,
  onProgress?: (done: number, total: number) => void,
): Promise<WormsCheck[]> {
  const pending = names.filter((name) => !cache.has(name))
  const batches = Array.from({ length: Math.ceil(pending.length / batchSize) }, (_, index) =>
    pending.slice(index * batchSize, (index + 1) * batchSize),
  )
  let done = names.length - pending.length
  let next = 0
  onProgress?.(done, names.length)

  async function worker() {
    while (next < batches.length) {
      const batch = batches[next++]
      const matches = await fetchBatch(batch, fetchFn)
      batch.forEach((name, index) => cache.set(name, classifyWormsMatch(name, matches[index] ?? null)))
      done += batch.length
      onProgress?.(done, names.length)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, batches.length) }, worker))
  return names.map((name) => cache.get(name)!)
}

async function fetchBatch(batch: string[], fetchFn: typeof fetch, attempt = 1): Promise<Array<WormsRecord[] | null>> {
  const params = new URLSearchParams({ marine_only: 'false' })
  batch.forEach((name) => params.append('scientificnames[]', wormsQueryName(name)))

  const response = await fetchFn(`${endpoint}?${params}`).catch(() => null)
  if (!response?.ok) {
    if (attempt < 2) return fetchBatch(batch, fetchFn, attempt + 1)
    throw new Error(`O WoRMS não respondeu${response ? ` (HTTP ${response.status})` : ''}. Tente de novo; os nomes já conferidos ficam guardados.`)
  }

  // 204: nenhum dos nomes do lote foi encontrado.
  return response.status === 204 ? [] : ((await response.json()) as Array<WormsRecord[] | null>)
}
