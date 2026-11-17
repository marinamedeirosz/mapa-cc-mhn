const excelEpoch = Date.UTC(1899, 11, 30)
const dayInMs = 24 * 60 * 60 * 1000

// Ano fora disso é erro de digitação (ex.: "3/30/0200"). Células de data do Excel não existem antes de 1900:
// abaixo disso é a "data zero" (1899-12-30/31) de uma célula só com horário.
const minTextYear = 1800
const minExcelYear = 1900

export function parseDateCell(value: unknown): Date | null {
  const date = readDate(value)
  const minYear = value instanceof Date || typeof value === 'number' ? minExcelYear : minTextYear
  const year = date?.getUTCFullYear() ?? 0

  return date && year >= minYear && year <= new Date().getFullYear() ? date : null
}

function readDate(value: unknown): Date | null {
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
    const fullYear = year.length === 2 ? expandTwoDigitYear(Number(year)) : Number(year)
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

  // Sem "chute" com new Date(texto): ele lia "Maio de 94" como 01/01/1994 e "Julho/199 4" como o ano 199,
  // sem aviso. Formatos desconhecidos viram aviso de data não reconhecida para a curadoria corrigir.
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

// Coletas não ficam no futuro: "98" é 1998 e "25" é 2025.
function expandTwoDigitYear(year: number): number {
  return year > new Date().getFullYear() % 100 ? 1900 + year : 2000 + year
}

function toDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}
