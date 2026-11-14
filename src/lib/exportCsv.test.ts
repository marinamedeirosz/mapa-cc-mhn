import { describe, expect, it } from 'vitest'
import { recordsToCsv, recordsToDarwinCoreCsv } from './exportCsv'
import type { OccurrenceRecord } from '@/types'

const base: OccurrenceRecord = {
  id: '2-CC1',
  rowNumber: 2,
  code: 'CC1',
  dateText: '12/04/1998',
  date: new Date(Date.UTC(1998, 3, 12)),
  family: 'PENAEIDAE',
  species: 'Penaeus sp.',
  local: 'Maceió, AL',
  coordinatesText: '',
  observation: 'Coletado "à mão"',
  latitude: -9.6658,
  longitude: -35.7353,
  positionLabel: 'Maceió, AL',
  positionSource: 'local_fallback',
  importIssues: [],
}

describe('recordsToCsv', () => {
  it('starts with a BOM so Excel reads accents correctly', () => {
    expect(recordsToCsv([base]).startsWith('﻿Código;')).toBe(true)
  })
})

describe('recordsToDarwinCoreCsv', () => {
  it('writes Darwin Core terms with ISO dates and quoted commas', () => {
    const [header, row] = recordsToDarwinCoreCsv([base]).split('\r\n')

    expect(header.split(',')).toContain('scientificName')
    expect(row).toBe(
      'CC1,PreservedSpecimen,1998-04-12,12/04/1998,PENAEIDAE,Penaeus sp.,"Maceió, AL",,-9.6658,-35.7353,' +
        '"Posição aproximada pelo local: Maceió, AL","Coletado ""à mão"""',
    )
  })

  it('leaves position fields empty for unresolved records', () => {
    const [, row] = recordsToDarwinCoreCsv([
      { ...base, date: null, latitude: null, longitude: null, positionSource: 'unresolved' },
    ]).split('\r\n')

    expect(row).toContain('CC1,PreservedSpecimen,,12/04/1998,')
    expect(row).toContain(',,,,"Coletado')
  })
})
