import { describe, expect, it } from 'vitest'
import { parseCoordinates } from './parseCoordinates'

describe('parseCoordinates', () => {
  it('converts DMS coordinates to decimal coordinates', () => {
    expect(parseCoordinates('9°34\'22"S / 35°46\'40"W')).toEqual({
      ok: true,
      latitude: -9.572778,
      longitude: -35.777778,
    })
  })

  it('supports decimal pairs', () => {
    expect(parseCoordinates('-9.65, -35.84')).toEqual({
      ok: true,
      latitude: -9.65,
      longitude: -35.84,
    })
  })

  it('rejects incomplete coordinates', () => {
    expect(parseCoordinates('9°34\'22"S')).toEqual({
      ok: false,
      reason: 'Formato DMS inválido ou incompleto',
    })
  })
})
