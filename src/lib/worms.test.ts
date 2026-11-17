import { describe, expect, it } from 'vitest'
import { checkNamesInWorms, wormsQueryName } from './worms'

const record = (scientificname: string, status: string, match_type: string, valid_name = scientificname) => ({
  scientificname,
  status,
  match_type,
  valid_name,
  url: `https://www.marinespecies.org/${scientificname}`,
})

describe('wormsQueryName', () => {
  it('drops sp./spp. and cf./aff. so WoRMS can match the name', () => {
    expect(wormsQueryName('Penaeus sp.')).toBe('Penaeus')
    expect(wormsQueryName('Penaeus spp')).toBe('Penaeus')
    expect(wormsQueryName('Uca cf. thayeri')).toBe('Uca thayeri')
    expect(wormsQueryName('Goniopsis cruentata')).toBe('Goniopsis cruentata')
  })
})

describe('checkNamesInWorms', () => {
  it('classifies accepted, synonym, spelling and missing names in one request', async () => {
    const urls: string[] = []
    const fakeFetch = (async (url: string) => {
      urls.push(url)
      return new Response(
        JSON.stringify([
          [record('Goniopsis cruentata', 'accepted', 'exact')],
          [record('Penaeus schmitti', 'superseded combination', 'exact', 'Penaeus (Litopenaeus) schmitti')],
          [record('Ocypode quadrata', 'accepted', 'phonetic')],
          [],
        ]),
      )
    }) as typeof fetch

    const results = await checkNamesInWorms(
      ['Goniopsis cruentata', 'Penaeus schmitti', 'Ocypode quadratta', 'Xyz foo'],
      fakeFetch,
    )

    expect(urls).toHaveLength(1)
    expect(new URL(urls[0]).searchParams.getAll('scientificnames[]')).toEqual([
      'Goniopsis cruentata',
      'Penaeus schmitti',
      'Ocypode quadratta',
      'Xyz foo',
    ])
    expect(results.map((result) => result.status)).toEqual(['accepted', 'synonym', 'spelling', 'not_found'])
    expect(results[1].validName).toBe('Penaeus (Litopenaeus) schmitti')
    expect(results[2].matchedName).toBe('Ocypode quadrata')
  })

  it('runs up to 3 batches at a time, reports progress and remembers checked names', async () => {
    let inFlight = 0
    let maxInFlight = 0
    let calls = 0
    const slowFetch = (async () => {
      calls += 1
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise((resolve) => setTimeout(resolve, 5))
      inFlight -= 1
      return new Response(null, { status: 204 })
    }) as typeof fetch
    const names = Array.from({ length: 220 }, (_, index) => `Paralelo ${index}`)
    const progress: number[] = []

    await checkNamesInWorms(names, slowFetch, (done) => progress.push(done))
    await checkNamesInWorms(names, slowFetch)

    expect(maxInFlight).toBe(3)
    expect(calls).toBe(5)
    expect(progress.at(-1)).toBe(220)
  })

  it('retries a failed batch once before giving up', async () => {
    let calls = 0
    const flakyFetch = (async () => {
      calls += 1
      return calls === 1 ? new Response(null, { status: 503 }) : new Response(null, { status: 204 })
    }) as typeof fetch

    const results = await checkNamesInWorms(['Tentativa 1'], flakyFetch)

    expect(calls).toBe(2)
    expect(results[0].status).toBe('not_found')
  })

  it('splits long lists into batches of 50 names', async () => {
    let calls = 0
    const fakeFetch = (async () => {
      calls += 1
      return new Response(null, { status: 204 })
    }) as typeof fetch

    const results = await checkNamesInWorms(Array.from({ length: 120 }, (_, index) => `Nome ${index}`), fakeFetch)

    expect(calls).toBe(3)
    expect(results.every((result) => result.status === 'not_found')).toBe(true)
  })
})
