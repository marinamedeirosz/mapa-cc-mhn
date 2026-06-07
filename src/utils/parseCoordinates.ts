export type ParseCoordinatesResult =
  | { ok: true; latitude: number; longitude: number }
  | { ok: false; reason: string }

const decimalPairPattern = /(-?\d{1,3}(?:[.,]\d+)?)\s*[,;/]\s*(-?\d{1,3}(?:[.,]\d+)?)/
const dmsPattern =
  /(\d{1,3})(?:\s*[°º]\s*|\s+)(\d{1,2})?(?:\s*['’′]\s*|\s+)?(\d{1,2}(?:[.,]\d+)?)?(?:\s*["”″]\s*)?([NSEW])/gi

export function parseCoordinates(input: string): ParseCoordinatesResult {
  const text = input.trim()
  if (!text) {
    return { ok: false, reason: 'Coordenada vazia' }
  }

  const decimal = parseDecimalPair(text)
  if (decimal.ok) {
    return decimal
  }

  const parts = Array.from(text.matchAll(dmsPattern)).map((match) => {
    const [, degrees, minutes = '0', seconds = '0', hemisphere] = match
    return {
      value: dmsToDecimal(Number(degrees), Number(minutes), Number(seconds.replace(',', '.')), hemisphere),
      hemisphere: hemisphere.toUpperCase(),
    }
  })

  const latitude = parts.find((part) => part.hemisphere === 'N' || part.hemisphere === 'S')
  const longitude = parts.find((part) => part.hemisphere === 'E' || part.hemisphere === 'W')

  if (!latitude || !longitude) {
    return { ok: false, reason: 'Formato DMS inválido ou incompleto' }
  }

  if (!isValidLatitude(latitude.value) || !isValidLongitude(longitude.value)) {
    return { ok: false, reason: 'Latitude ou longitude fora do intervalo válido' }
  }

  return {
    ok: true,
    latitude: roundCoordinate(latitude.value),
    longitude: roundCoordinate(longitude.value),
  }
}

function parseDecimalPair(text: string): ParseCoordinatesResult {
  const match = text.match(decimalPairPattern)
  if (!match) {
    return { ok: false, reason: 'Não é par decimal' }
  }

  const latitude = Number(match[1].replace(',', '.'))
  const longitude = Number(match[2].replace(',', '.'))

  if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) {
    return { ok: false, reason: 'Latitude ou longitude fora do intervalo válido' }
  }

  return {
    ok: true,
    latitude: roundCoordinate(latitude),
    longitude: roundCoordinate(longitude),
  }
}

function dmsToDecimal(degrees: number, minutes: number, seconds: number, hemisphere: string): number {
  const absolute = degrees + minutes / 60 + seconds / 3600
  const sign = hemisphere.toUpperCase() === 'S' || hemisphere.toUpperCase() === 'W' ? -1 : 1

  return absolute * sign
}

function isValidLatitude(value: number): boolean {
  return Number.isFinite(value) && value >= -90 && value <= 90
}

function isValidLongitude(value: number): boolean {
  return Number.isFinite(value) && value >= -180 && value <= 180
}

function roundCoordinate(value: number): number {
  return Number(value.toFixed(6))
}
