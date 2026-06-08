const excelEpoch = Date.UTC(1899, 11, 30)
const dayInMs = 24 * 60 * 60 * 1000

export function parseDateCell(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toDateOnly(value)
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return toDateOnly(new Date(excelEpoch + value * dayInMs))
  }

  const text = String(value ?? '').trim()
  if (!text) {
    return null
  }

  const brMatch = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (brMatch) {
    const [, first, second, year] = brMatch
    const fullYear = Number(year.length === 2 ? `20${year}` : year)
    const brazilianDate = safeDate(fullYear, Number(second), Number(first))

    if (brazilianDate) {
      return brazilianDate
    }

    return safeDate(fullYear, Number(first), Number(second))
  }

  const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (isoMatch) {
    const [, year, month, day] = isoMatch
    return safeDate(Number(year), Number(month), Number(day))
  }

  const parsed = new Date(text)
  if (!Number.isNaN(parsed.getTime())) {
    return toDateOnly(parsed)
  }

  return null
}

export function formatDate(date: Date | null, fallback = ''): string {
  if (!date) {
    return fallback
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

export function parseDateInput(value: string): Date | null {
  if (!value) {
    return null
  }

  const [year, month, day] = value.split('-').map(Number)
  return safeDate(year, month, day)
}

function safeDate(year: number, month: number, day: number): Date | null {
  if (!year || !month || !day) {
    return null
  }

  const date = new Date(Date.UTC(year, month - 1, day))
  const valid =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day

  return valid ? date : null
}

function toDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}
