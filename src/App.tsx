import { AlertTriangle, Database, MapPinned } from 'lucide-react'
import { useEffect, useMemo, useReducer, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FiltersPanel } from '@/features/filters/FiltersPanel'
import { ImportPanel } from '@/features/import/ImportPanel'
import { LocalMappingsDialog } from '@/features/locals/LocalMappingsDialog'
import { OccurrenceMap } from '@/features/map/OccurrenceMap'
import { useMunicipalityGeojson } from '@/features/map/useMunicipalityGeojson'
import { ResultsTable } from '@/features/results/ResultsTable'
import { StatsPanel, type DistributionFilterKey } from '@/features/stats/StatsPanel'
import { WormsPanel } from '@/features/taxonomy/WormsPanel'
import {
  applyFilters,
  applyQuickSearch,
  buildFilterOptions,
  initialFilters,
} from '@/lib/filtering'
import { applyLocalMappings, loadLocalMappings, saveLocalMappings, type LocalMapping } from '@/lib/localMappings'
import { buildStats, countByYear } from '@/lib/stats'
import { normalizeText } from '@/lib/text'
import type {
  Filters,
  ImportIssue,
  ImportResult,
  ImportSummary,
  MapMode,
  OccurrenceRecord,
  RecordFocus,
} from '@/types'

interface AppState {
  records: OccurrenceRecord[]
  summary: ImportSummary | null
  filters: Filters
  mapMode: MapMode
  isImporting: boolean
  importError: string
}

type AppAction =
  | { type: 'import:start' }
  | { type: 'import:success'; result: ImportResult }
  | { type: 'import:error'; message: string }
  | { type: 'import:clear' }
  | { type: 'filters:update'; filters: Filters }
  | { type: 'filters:clear' }
  | { type: 'mapMode:set'; mapMode: MapMode }
  | { type: 'quickSearch:set'; quickSearch: string }

const initialState: AppState = {
  records: [],
  summary: null,
  filters: initialFilters,
  mapMode: 'heatmap',
  isImporting: false,
  importError: '',
}

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'import:start':
      return { ...state, isImporting: true, importError: '' }
    case 'import:success':
      return {
        ...state,
        records: action.result.records,
        summary: action.result.summary,
        filters: initialFilters,
        isImporting: false,
        importError: '',
      }
    case 'import:error':
      return { ...state, isImporting: false, importError: action.message }
    case 'import:clear':
      return { ...state, records: [], summary: null, filters: initialFilters, importError: '' }
    case 'filters:update':
      return { ...state, filters: action.filters }
    case 'filters:clear':
      return { ...state, filters: initialFilters }
    case 'mapMode:set':
      return { ...state, mapMode: action.mapMode }
    case 'quickSearch:set':
      return {
        ...state,
        filters: { ...state.filters, quickSearch: action.quickSearch },
      }
  }
}

function App() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const [focus, setFocus] = useState<RecordFocus | null>(null)
  const [localMappings, setLocalMappings] = useState<LocalMapping[]>(loadLocalMappings)
  const [isLocalsOpen, setIsLocalsOpen] = useState(false)
  const { geojson, error: geojsonError } = useMunicipalityGeojson()
  // Locais definidos pela curadoria posicionam lotes que a planilha e a base fixa não resolveram.
  const imported = useMemo(
    () => (state.summary ? applyLocalMappings({ records: state.records, summary: state.summary }, localMappings) : null),
    [state.records, state.summary, localMappings],
  )
  const records = imported?.records ?? state.records
  const summary = imported?.summary ?? null

  useEffect(() => saveLocalMappings(localMappings), [localMappings])

  const filterOptions = useMemo(() => buildFilterOptions(records), [records])
  const filteredRecords = useMemo(
    () => applyFilters(records, state.filters),
    [records, state.filters],
  )
  const tableRecords = useMemo(
    () => applyQuickSearch(filteredRecords, state.filters.quickSearch),
    [filteredRecords, state.filters.quickSearch],
  )
  const stats = useMemo(() => buildStats(filteredRecords), [filteredRecords])
  // A linha do tempo e o aviso de lotes sem data olham os demais filtros, mas não o período.
  const recordsIgnoringPeriod = useMemo(
    () => applyFilters(records, { ...state.filters, dateStart: '', dateEnd: '' }),
    [records, state.filters],
  )
  const years = useMemo(() => countByYear(recordsIgnoringPeriod), [recordsIgnoringPeriod])
  const undatedRecords = recordsIgnoringPeriod.filter((record) => !record.date).length
  const undatedOutsidePeriod = state.filters.dateStart || state.filters.dateEnd ? undatedRecords : 0
  const positionedCount = filteredRecords.filter((record) => record.positionSource !== 'unresolved').length

  return (
    <main className="min-h-svh">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid gap-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPinned className="size-4 text-primary" />
              Ocorrências biológicas georreferenciadas
            </div>
            <h1 className="text-2xl font-semibold tracking-normal">Mapa CC MHN</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{records.length} registros importados</Badge>
            <Badge variant="outline">{positionedCount} no mapa</Badge>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1600px] gap-4 px-4 py-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="grid content-start gap-4">
          <ImportPanel
            isImporting={state.isImporting}
            importError={state.importError}
            summary={summary}
            onImportStart={() => dispatch({ type: 'import:start' })}
            onImportSuccess={(result) => dispatch({ type: 'import:success', result })}
            onImportError={(message) => dispatch({ type: 'import:error', message })}
            onDiscard={() => dispatch({ type: 'import:clear' })}
            localMappingsCount={localMappings.length}
            onOpenLocals={() => setIsLocalsOpen(true)}
          />
          <LocalMappingsDialog
            open={isLocalsOpen}
            onOpenChange={setIsLocalsOpen}
            records={records}
            mappings={localMappings}
            onChange={setLocalMappings}
            geojson={geojson}
          />
          <FiltersPanel
            filters={state.filters}
            options={filterOptions}
            resultCount={filteredRecords.length}
            undatedOutsidePeriod={undatedOutsidePeriod}
            onChange={(filters) => dispatch({ type: 'filters:update', filters })}
            onClear={() => dispatch({ type: 'filters:clear' })}
          />
        </aside>

        <section className="grid min-w-0 gap-4">
          {records.length === 0 ? <EmptyState /> : null}

          {summary?.issues.length ? <ImportIssuesDialog issues={summary.issues} /> : null}

          <OccurrenceMap
            records={filteredRecords}
            mode={state.mapMode}
            onModeChange={(mapMode) => dispatch({ type: 'mapMode:set', mapMode })}
            focus={focus}
            municipalityGeojson={geojson}
            geojsonError={geojsonError}
            onSelectMunicipality={(mapSelection) =>
              dispatch({ type: 'filters:update', filters: { ...state.filters, mapSelection } })
            }
          />
          <StatsPanel
            stats={stats}
            filters={state.filters}
            onSelect={(key, label) =>
              dispatch({ type: 'filters:update', filters: toggleFilterValue(state.filters, key, label) })
            }
            years={years}
            undatedRecords={undatedRecords}
            onSelectYear={(year) => dispatch({ type: 'filters:update', filters: toggleYear(state.filters, year) })}
          />
          <WormsPanel records={records} />
          <ResultsTable
            records={tableRecords}
            quickSearch={state.filters.quickSearch}
            onQuickSearchChange={(quickSearch) => dispatch({ type: 'quickSearch:set', quickSearch })}
            onLocate={(record) => setFocus({ record, requestedAt: Date.now() })}
          />
        </section>
      </div>
    </main>
  )
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2 font-medium text-foreground">
          <Database className="size-4" />
          Nenhuma planilha carregada
        </div>
        <p>
          Importe um arquivo com as colunas Código, Data, Família, Espécie, Local,
          Coordenadas e Observação para iniciar a análise.
        </p>
      </CardContent>
    </Card>
  )
}

function ImportIssuesDialog({ issues }: { issues: ImportIssue[] }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Alert
          asChild
          className="border-accent bg-accent/30 text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <button type="button" aria-label="Ver avisos da importação">
            <AlertTriangle className="absolute left-3 top-3 size-4" />
            <div className="pl-6">
              <AlertTitle>{issues.length} aviso(s) na importação</AlertTitle>
              <AlertDescription>
                Registros sem posição seguem na tabela e nas estatísticas; apenas ficam fora do mapa.
              </AlertDescription>
            </div>
          </button>
        </Alert>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Problemas encontrados na importação</DialogTitle>
          <DialogDescription>
            Confira as linhas da planilha que geraram avisos ou erros durante a importação.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[65svh] overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Linha</TableHead>
                <TableHead className="w-32">Código</TableHead>
                <TableHead className="w-36">Campo</TableHead>
                <TableHead className="w-28">Tipo</TableHead>
                <TableHead>Mensagem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {issues.map((issue, index) => (
                <TableRow key={`${issue.rowNumber}-${issue.field ?? 'campo'}-${index}`}>
                  <TableCell>{issue.rowNumber}</TableCell>
                  <TableCell>{issue.code || '-'}</TableCell>
                  <TableCell>{issue.field || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={issue.severity === 'error' ? 'destructive' : 'warning'}>
                      {formatIssueSeverity(issue.severity)}
                    </Badge>
                  </TableCell>
                  <TableCell className="min-w-80">{issue.message}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function toggleFilterValue(filters: Filters, key: DistributionFilterKey, label: string): Filters {
  const normalized = normalizeText(label)
  const current = filters[key]
  const isSelected = current.some((value) => normalizeText(value) === normalized)

  return {
    ...filters,
    [key]: isSelected ? current.filter((value) => normalizeText(value) !== normalized) : [...current, label],
  }
}

function toggleYear(filters: Filters, year: number): Filters {
  const dateStart = `${year}-01-01`
  const dateEnd = `${year}-12-31`
  const isSelected = filters.dateStart === dateStart && filters.dateEnd === dateEnd

  return isSelected ? { ...filters, dateStart: '', dateEnd: '' } : { ...filters, dateStart, dateEnd }
}

function formatIssueSeverity(severity: ImportIssue['severity']) {
  return severity === 'error' ? 'Erro' : 'Aviso'
}

export default App
