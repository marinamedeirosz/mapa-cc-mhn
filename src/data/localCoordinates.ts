import { normalizeText } from '@/lib/text'

export interface LocalCoordinate {
  label: string
  latitude: number
  longitude: number
  aliases: string[]
  municipality?: string
}

export interface LocalResolution {
  label: string
  latitude: number
  longitude: number
  municipality: string | null
  isCelmm: boolean
}

const celmm: LocalCoordinate = {
  label: 'CELMM',
  latitude: -9.65,
  longitude: -35.84,
  municipality: 'CELMM',
  aliases: [
    'CELMM',
    'Complexo Estuarino Lagunar Mundaú Manguaba',
    'Lagoa Mundaú',
    'Lagoa Manguaba',
    'Canal da Lagoa Mundaú',
    'Canal da Lagoa Manguaba',
    'Mundaú',
    'Manguaba',
  ],
}

export const localCoordinates: LocalCoordinate[] = [
  celmm,
  {
    label: 'Maceió, AL',
    latitude: -9.6658,
    longitude: -35.7353,
    municipality: 'Maceió',
    aliases: [
      'Maceió',
      'Jaraguá',
      'Pajuçara',
      'Ponta Verde',
      'Praia de Ponta Verde',
      'Praia da Avenida',
      'Lama Grande do Jaraguá',
      'Lama da Galinha',
      'Xanxão',
      'Ilha do Lisboa',
      'Canal do Flexal',
    ],
  },
  {
    label: 'Marechal Deodoro, AL',
    latitude: -9.7103,
    longitude: -35.895,
    municipality: 'Marechal Deodoro',
    aliases: ['Marechal Deodoro', 'Canal Mal Deodoro', 'Mal Deodoro Beira da Costa'],
  },
  {
    label: 'Paripueira, AL',
    latitude: -9.4631,
    longitude: -35.5526,
    municipality: 'Paripueira',
    aliases: ['Paripueira', 'Paripieira'],
  },
  {
    label: 'Barra de São Miguel, AL',
    latitude: -9.8394,
    longitude: -35.9057,
    municipality: 'Barra de São Miguel',
    aliases: ['Barra de São Miguel'],
  },
  {
    label: 'Barra de Santo Antônio, AL',
    latitude: -9.4043,
    longitude: -35.5076,
    municipality: 'Barra de Santo Antônio',
    aliases: ['Barra de Santo Antônio', 'Carro Quebrado'],
  },
  {
    label: 'Japaratinga, AL',
    latitude: -9.0875,
    longitude: -35.2634,
    municipality: 'Japaratinga',
    aliases: ['Japaratinga'],
  },
  {
    label: 'Jequiá da Praia, AL',
    latitude: -10.0133,
    longitude: -36.0267,
    municipality: 'Jequiá da Praia',
    aliases: ['Jequiá da Praia'],
  },
  {
    label: 'Maragogi, AL',
    latitude: -9.0122,
    longitude: -35.222,
    municipality: 'Maragogi',
    aliases: ['Maragogi'],
  },
  {
    label: 'Passo de Camaragibe, AL',
    latitude: -9.2451,
    longitude: -35.4745,
    municipality: 'Passo de Camaragibe',
    aliases: [
      'Passo de Camaragibe',
      'Morro de Camaragibe',
      'Morros de Camaragibe',
      'Morro do Camaragibe',
      'Praia do Morro',
    ],
  },
  {
    label: 'Penedo, AL',
    latitude: -10.2905,
    longitude: -36.5868,
    municipality: 'Penedo',
    aliases: ['Penedo'],
  },
  {
    label: 'Piaçabuçu, AL',
    latitude: -10.4056,
    longitude: -36.4344,
    municipality: 'Piaçabuçu',
    aliases: ['Piaçabuçu', 'Pontal do Peba', 'Pontal de Peba', 'Praia do Pontal do Peba'],
  },
  {
    label: 'Pilar, AL',
    latitude: -9.5973,
    longitude: -35.9566,
    municipality: 'Pilar',
    aliases: ['Pilar'],
  },
  {
    label: 'Piranhas, AL',
    latitude: -9.6236,
    longitude: -37.7566,
    municipality: 'Piranhas',
    aliases: ['Piranhas'],
  },
  {
    label: 'Roteiro, AL',
    latitude: -9.8356,
    longitude: -35.9783,
    municipality: 'Roteiro',
    aliases: ['Roteiro'],
  },
  {
    label: 'São Miguel dos Milagres, AL',
    latitude: -9.2667,
    longitude: -35.3764,
    municipality: 'São Miguel dos Milagres',
    aliases: ['São Miguel dos Milagres', 'Porto da Rua'],
  },
  {
    label: 'Traipu, AL',
    latitude: -9.9706,
    longitude: -37.0033,
    municipality: 'Traipu',
    aliases: ['Traipu'],
  },
  {
    label: 'Coruripe, AL',
    latitude: -10.1256,
    longitude: -36.1756,
    municipality: 'Coruripe',
    aliases: ['Coruripe', 'Lagoa do Pau'],
  },
  {
    label: 'Feliz Deserto, AL',
    latitude: -10.2939,
    longitude: -36.3058,
    municipality: 'Feliz Deserto',
    aliases: ['Feliz Deserto'],
  },
  {
    label: 'Porto de Pedras, AL',
    latitude: -9.1608,
    longitude: -35.295,
    municipality: 'Porto de Pedras',
    aliases: ['Porto de Pedras'],
  },
]

const normalizedEntries = localCoordinates
  .flatMap((entry) =>
    entry.aliases.map((alias) => ({
      key: normalizeLocal(alias),
      entry,
    })),
  )
  .sort((a, b) => b.key.length - a.key.length)

export function resolveLocalCoordinates(local: string): LocalResolution | null {
  const normalizedLocal = normalizeLocal(local)
  if (!normalizedLocal) {
    return null
  }

  if (isCelmm(normalizedLocal)) {
    return toResolution(celmm)
  }

  const match = normalizedEntries.find(({ key }) => includesNormalizedPhrase(normalizedLocal, key))

  return match ? toResolution(match.entry) : null
}

function isCelmm(normalizedLocal: string): boolean {
  return ['mundau', 'manguaba', 'lagoa mundau', 'lagoa manguaba', 'celmm'].some((key) =>
    normalizedLocal.includes(key),
  )
}

function normalizeLocal(value: string): string {
  return normalizeText(value)
    .replace(/\bal\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function includesNormalizedPhrase(normalizedLocal: string, normalizedAlias: string): boolean {
  return (
    normalizedLocal === normalizedAlias ||
    normalizedLocal.startsWith(`${normalizedAlias} `) ||
    normalizedLocal.endsWith(` ${normalizedAlias}`) ||
    normalizedLocal.includes(` ${normalizedAlias} `)
  )
}

function toResolution(entry: LocalCoordinate): LocalResolution {
  return {
    label: entry.label,
    latitude: entry.latitude,
    longitude: entry.longitude,
    municipality: entry.municipality ?? null,
    isCelmm: entry.label === 'CELMM',
  }
}
