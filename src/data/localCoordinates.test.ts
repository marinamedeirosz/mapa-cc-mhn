import { describe, expect, it } from 'vitest'
import { localCoordinates, resolveLocalCoordinates } from './localCoordinates'

function normalizeLocal(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\bal\b/g, '')
    .trim()
    .replace(/\s+/g, ' ')
}

describe('resolveLocalCoordinates', () => {
  it('resolves locations with accents and state suffix', () => {
    expect(resolveLocalCoordinates('Maceió, AL')).toMatchObject({
      label: 'Maceió, AL',
      latitude: -9.6658,
      longitude: -35.7353,
    })
  })

  it('resolves CELMM aliases from Mundaú and Manguaba', () => {
    expect(resolveLocalCoordinates('Lagoa Mundaú')).toMatchObject({
      label: 'CELMM',
      latitude: -9.65,
      longitude: -35.84,
    })
    expect(resolveLocalCoordinates('Complexo Estuarino-Lagunar Mundaú-Manguaba')).toMatchObject({
      label: 'CELMM',
    })
  })

  it('resolves known locality aliases from the spreadsheet', () => {
    expect(resolveLocalCoordinates('Pontal do Peba')).toMatchObject({
      municipality: 'Piaçabuçu',
    })
    expect(resolveLocalCoordinates('Jaraguá')).toMatchObject({
      municipality: 'Maceió',
    })
    expect(resolveLocalCoordinates('Morro de Camaragibe - Praia')).toMatchObject({
      municipality: 'Passo de Camaragibe',
    })
    expect(resolveLocalCoordinates('Pajuçara')).toMatchObject({
      municipality: 'Maceió',
    })
    expect(resolveLocalCoordinates('Paripieira')).toMatchObject({
      municipality: 'Paripueira',
    })
  })

  it('does not duplicate aliases after normalization', () => {
    const normalizedAliases = localCoordinates.flatMap((entry) =>
      entry.aliases.map((alias) => normalizeLocal(alias)),
    )

    expect(new Set(normalizedAliases).size).toBe(normalizedAliases.length)
  })

  it('does not match aliases inside longer unrelated words', () => {
    expect(resolveLocalCoordinates('PROAMB-BA/Maragogipe')).toBeNull()
  })

  it('returns null for unknown locations', () => {
    expect(resolveLocalCoordinates('Localidade imaginária')).toBeNull()
  })
})
