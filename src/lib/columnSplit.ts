// Fração da largura ocupada pela coluna da esquerda (mapa): nem o mapa nem a listagem ficam espremidos demais.
export const minSplit = 0.3
export const maxSplit = 0.75
export const defaultSplit = 0.6

const storageKey = 'mapa-cc-mhn:divisao-colunas'

export function clampSplit(value: number): number {
  return Math.min(maxSplit, Math.max(minSplit, value))
}

export function loadSplit(): number {
  try {
    const stored = Number(localStorage.getItem(storageKey))
    return stored ? clampSplit(stored) : defaultSplit
  } catch {
    return defaultSplit
  }
}

export function saveSplit(value: number): void {
  try {
    localStorage.setItem(storageKey, String(value))
  } catch {
    // Sem armazenamento, a divisão vale só até recarregar.
  }
}
