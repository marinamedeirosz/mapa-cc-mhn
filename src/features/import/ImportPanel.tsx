import { AlertCircle, FileDown, FileSpreadsheet, MapPin, MapPinPlus, Trash2, Upload } from 'lucide-react'
import type { ChangeEvent } from 'react'
import { useEffect, useEffectEvent, useRef } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
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
  localMappingsCount: number
  onOpenLocals: () => void
}

export function ImportPanel({
  isImporting,
  importError,
  summary,
  onImportStart,
  onImportSuccess,
  onImportError,
  onDiscard,
  localMappingsCount,
  onOpenLocals,
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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileSpreadsheet className="size-4" />
          Planilha
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button type="button" onClick={() => inputRef.current?.click()} disabled={isImporting}>
          <Upload />
          {isImporting ? 'Importando...' : 'Importar .xlsx, .xls ou .csv'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={downloadSpreadsheetTemplate}>
          <FileDown />
          Baixar planilha modelo
        </Button>

        {summary ? (
          <div className="grid gap-2 text-sm">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <span className="min-w-0 truncate text-muted-foreground" title={summary.fileName}>
                {summary.fileName}
              </span>
              <Badge variant="secondary">{summary.totalRows} registros</Badge>
            </div>
            {summary.sheetNames.length > 1 ? (
              <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
                <Label htmlFor="import-sheet">Aba</Label>
                <Select
                  id="import-sheet"
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
              </div>
            ) : null}
            <div className="grid grid-cols-3 gap-2">
              <ImportMetric label="Coordenadas" value={summary.withCoordinates} />
              <ImportMetric label="Por local" value={summary.fromLocal} />
              <ImportMetric label="Sem posição" value={summary.unresolved} tone={summary.unresolved > 0 ? 'warning' : 'default'} />
            </div>
            {summary.unresolved > 0 || localMappingsCount > 0 ? (
              <Button type="button" variant="outline" size="sm" onClick={onOpenLocals}>
                <MapPinPlus />
                {summary.unresolved > 0 ? `Resolver locais sem posição (${summary.unresolved} lote(s))` : 'Locais definidos pela curadoria'}
              </Button>
            ) : null}
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>Salva só neste navegador, para não se perder ao recarregar.</span>
              <Button type="button" variant="ghost" size="sm" onClick={handleDiscard}>
                <Trash2 />
                Descartar
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
            <MapPin className="mt-0.5 size-4 shrink-0" />
            <span>Registros sem coordenadas serão resolvidos pela base local offline.</span>
          </div>
        )}

        {importError ? (
          <Alert className="border-destructive/40 bg-destructive/5">
            <AlertCircle className="absolute left-3 top-3 size-4 text-destructive" />
            <div className="pl-6">
              <AlertTitle>Importação interrompida</AlertTitle>
              <AlertDescription>{importError}</AlertDescription>
            </div>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  )
}

function ImportMetric({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: number
  tone?: 'default' | 'warning'
}) {
  return (
    <div className="rounded-md border bg-background px-2 py-2">
      <div className="text-lg font-semibold">{value}</div>
      <div className={tone === 'warning' ? 'text-xs text-accent-foreground' : 'text-xs text-muted-foreground'}>
        {label}
      </div>
    </div>
  )
}
