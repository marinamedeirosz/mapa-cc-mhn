import { AlertCircle, FileDown, FileSpreadsheet, Trash2, Upload } from 'lucide-react'
import type { ChangeEvent } from 'react'
import { useEffect, useEffectEvent, useRef } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { downloadSpreadsheetTemplate, parseSpreadsheetFile } from '@/lib/importSpreadsheet'
import { clearStoredSpreadsheet, loadStoredSpreadsheet, saveStoredSpreadsheet } from '@/lib/storedSpreadsheet'
import type { ImportResult, ImportSummary } from '@/types'

interface ImportPanelProps {
  isImporting: boolean
  importError: string
  summary: ImportSummary | null
  onImportStart: () => void
  onImportSuccess: (result: ImportResult) => void
  onImportError: (message: string) => void
  onDiscard: () => void
}

export function ImportPanel({
  isImporting,
  importError,
  summary,
  onImportStart,
  onImportSuccess,
  onImportError,
  onDiscard,
}: ImportPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<File | null>(null)

  async function importFile(file: File, sheetName?: string): Promise<boolean> {
    onImportStart()

    try {
      const result = await parseSpreadsheetFile(file, sheetName)
      fileRef.current = file
      onImportSuccess(result)
      await saveStoredSpreadsheet({ file, sheetName: result.summary.sheetName })
      return true
    } catch (error) {
      onImportError(error instanceof Error ? error.message : 'Não foi possível importar a planilha.')
      return false
    }
  }

  const restoreStoredSpreadsheet = useEffectEvent(async () => {
    const stored = await loadStoredSpreadsheet()
    // Uma planilha salva que não abre mais só geraria o mesmo erro a cada recarga.
    if (stored && !(await importFile(stored.file, stored.sheetName))) await clearStoredSpreadsheet()
  })

  useEffect(() => {
    void restoreStoredSpreadsheet()
  }, [])

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (file) {
      await importFile(file)
    }
  }

  async function handleSheetChange(sheetName: string) {
    if (fileRef.current) await importFile(fileRef.current, sheetName)
  }

  async function handleDiscard() {
    await clearStoredSpreadsheet()
    onDiscard()
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
      {summary ? (
        <span className="flex min-w-0 items-center gap-1.5 rounded-full border px-3 py-1 text-sm">
          <FileSpreadsheet className="size-4 shrink-0 text-muted-foreground" />
          <span className="max-w-56 truncate" title={summary.fileName}>
            {summary.fileName}
          </span>
        </span>
      ) : null}
      {summary && summary.sheetNames.length > 1 ? (
        <label className="flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground">Aba</span>
          <Select
            id="import-sheet"
            className="h-8 w-auto"
            value={summary.sheetName}
            disabled={isImporting}
            onChange={(event) => handleSheetChange(event.target.value)}
          >
            {summary.sheetNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        </label>
      ) : null}
      <Button
        type="button"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={isImporting}
        title="Aceita .xlsx, .xls ou .csv"
      >
        <Upload />
        {isImporting ? 'Importando...' : summary ? 'Importar outra' : 'Importar planilha'}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={downloadSpreadsheetTemplate}>
        <FileDown />
        Modelo
      </Button>
      {summary ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleDiscard}
          title="A planilha fica salva só neste navegador para não se perder ao recarregar. Descartar apaga essa cópia."
        >
          <Trash2 />
          Descartar
        </Button>
      ) : null}
      {importError ? (
        <Alert className="basis-full border-destructive/40 bg-destructive/5">
          <AlertCircle className="absolute left-3 top-3 size-4 text-destructive" />
          <div className="pl-6">
            <AlertTitle>Importação interrompida</AlertTitle>
            <AlertDescription>{importError}</AlertDescription>
          </div>
        </Alert>
      ) : null}
    </div>
  )
}
