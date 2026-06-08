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

  it('rejects spreadsheets with headers but no data rows', async () => {
    const file = workbookFile([
      headers,
      [' ', '', '', '', '', '', ''],
    ])

    await expect(parseSpreadsheetFile(file)).rejects.toThrow('A planilha não possui registros.')
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
