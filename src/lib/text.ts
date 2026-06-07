export function normalizeText(value: unknown): string {
  return repairMojibake(String(value ?? ''))
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

export function repairMojibake(value: string): string {
  if (!/[ÃÂ]/.test(value)) {
    return value
  }

  try {
    return decodeURIComponent(
      Array.from(value, (character) => {
        const code = character.charCodeAt(0)

        if (code > 255) {
          throw new Error('Not a latin-1 mojibake string')
        }

        return `%${code.toString(16).padStart(2, '0')}`
      }).join(''),
    )
  } catch {
    return value
  }
}

export function normalizeHeader(value: unknown): string {
  return normalizeText(value)
}

export function includesNormalized(haystack: string, needle: string): boolean {
  const normalizedNeedle = normalizeText(needle)

  return normalizedNeedle.length > 0 && normalizeText(haystack).includes(normalizedNeedle)
}

export function uniqueSorted(values: string[]): string[] {
  const byNormalizedValue = values.reduce<Map<string, string>>((acc, value) => {
    const trimmed = value.trim()
    const normalized = normalizeText(trimmed)

    if (trimmed && !acc.has(normalized)) {
      acc.set(normalized, trimmed)
    }

    return acc
  }, new Map())

  return Array.from(byNormalizedValue.values()).sort((a, b) =>
    a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }),
  )
}
