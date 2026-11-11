import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'
import { parseSpreadsheetFile } from './importSpreadsheet'

const headers = ['Código', 'Data', 'Família', 'Espécie', 'Local', 'Coordenadas', 'Observação']

describe('parseSpreadsheetFile', () => {
  it('imports only rows with data and preserves original row numbers', async () => {
    const file = workbookFile([
      headers,
      ['001', '2026-06-01', 'Família A', 'Espécie A', 'Maceió, AL', '', 'Primeiro registro'],
      ['   ', ' ', '', '', ' ', '', ''],
      ['002', '2026-06-02', 'Família B', 'Espécie B', 'Pilar, AL', '', 'Segundo registro'],
    ])

    const result = await parseSpreadsheetFile(file)

    expect(result.records).toHaveLength(2)
    expect(result.records.map((record) => record.code)).toEqual(['001', '002'])
    expect(result.records.map((record) => record.rowNumber)).toEqual([2, 4])
    expect(result.summary.totalRows).toBe(2)
  })

  it('keeps real row numbers when the spreadsheet has fully empty rows', async () => {
    const file = workbookFile([
      headers,
      ['001', '2026-06-01', 'Família A', 'Espécie A', 'Maceió, AL', '', ''],
      [],
      [],
      ['002', '2026-06-02', 'Família B', 'Espécie B', 'Pilar, AL', '', ''],
    ])

    const result = await parseSpreadsheetFile(file)

    expect(result.records.map((record) => record.rowNumber)).toEqual([2, 5])
  })

  it('reads CSV values as text, keeping Brazilian dates and leading zeros', async () => {
    const csv = `${headers.join(',')}\n007,10/05/2020,Família A,Espécie A,"Maceió, AL",,\n`
    const file = new File([csv], 'teste.csv', { type: 'text/csv' })

    const result = await parseSpreadsheetFile(file)

    expect(result.records[0].code).toBe('007')
    expect(result.records[0].dateText).toBe('10/05/2020')
  })

  it('rejects spreadsheets with headers but no data rows', async () => {
    const file = workbookFile([
      headers,
      [' ', '', '', '', '', '', ''],
    ])

    await expect(parseSpreadsheetFile(file)).rejects.toThrow('A planilha não possui registros.')
  })
  it('accepts US date strings and formats them as Brazilian dates', async () => {
    const file = workbookFile([
      headers,
      ['001', '12/31/2026', 'Familia A', 'Especie A', 'Maceio, AL', '', 'Data americana'],
    ])

    const result = await parseSpreadsheetFile(file)

    expect(result.records[0].dateText).toBe('31/12/2026')
    expect(result.records[0].importIssues).toHaveLength(0)
  })
})

function workbookFile(rows: unknown[][]): File {
  const workbook = XLSX.utils.book_new()
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  XLSX.utils.book_append_sheet(workbook, sheet, 'Página1')
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer

  return new File([buffer], 'teste.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}
