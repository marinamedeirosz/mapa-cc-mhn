import { describe, expect, it } from 'vitest'
import { formatDate, parseDateCell } from './dates'

describe('parseDateCell', () => {
  it('parses Brazilian date strings first', () => {
    expect(formatDate(parseDateCell('31/12/2026'))).toBe('31/12/2026')
  })

  it('parses US date strings when the Brazilian format is not valid', () => {
    expect(formatDate(parseDateCell('12/31/2026'))).toBe('31/12/2026')
  })

  it('keeps invalid US-style dates invalid', () => {
    expect(parseDateCell('02/31/2026')).toBeNull()
  })
})
