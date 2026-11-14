import { describe, expect, it } from 'vitest'
import { formatDate, parseDateCell } from './dates'

describe('parseDateCell', () => {
  it('parses Brazilian date strings first', () => {
    expect(formatDate(parseDateCell('31/12/2026'))).toBe('31/12/2026')
  })

  it('parses US date strings when the Brazilian format is not valid', () => {
    expect(formatDate(parseDateCell('12/31/2026'))).toBe('31/12/2026')
  })

  it('expands two-digit years without going into the future', () => {
    expect(formatDate(parseDateCell('12/04/98'))).toBe('12/04/1998')
    expect(formatDate(parseDateCell('12/04/05'))).toBe('12/04/2005')
  })

  it('keeps invalid US-style dates invalid', () => {
    expect(parseDateCell('02/31/2026')).toBeNull()
  })
})
