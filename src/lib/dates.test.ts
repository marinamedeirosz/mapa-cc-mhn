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

  it('rejects implausible years and free-text dates instead of guessing', () => {
    for (const text of ['3/30/0200', 'Julho/199 4', 'Maio de 94', 'V/2026', 'j ulho/2003', '01/01/2999']) {
      expect(parseDateCell(text)).toBeNull()
    }
    expect(parseDateCell(new Date(Date.UTC(1899, 11, 31, 2, 22)))).toBeNull()
    expect(formatDate(parseDateCell(new Date(Date.UTC(1950, 0, 2))))).toBe('02/01/1950')
    expect(formatDate(parseDateCell('15/03/1885'))).toBe('15/03/1885')
  })

  it('keeps invalid US-style dates invalid', () => {
    expect(parseDateCell('02/31/2026')).toBeNull()
  })
})
