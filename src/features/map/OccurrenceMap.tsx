import L from 'leaflet'
import { ChevronDown, Download, Filter, Layers, Map as MapIcon, MapPin, Palette, RotateCcw, Tags } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  buildMunicipalityReportSvg,
  downloadMunicipalityMapPng,
  getMunicipalityMapFileName,
} from '@/lib/municipalityMapExport'
import {
  aggregateByMunicipality,
  defaultMunicipalityAccentColor,
  municipalityColorScale,
  municipalityEmptyColor,
  getMunicipalityFeatureId,
  isValidHexColor,
} from '@/lib/municipalityAggregation'
import type {
  MunicipalityAggregation,
  MunicipalityCount,
  MunicipalityFeatureCollection,
  MunicipalityGroup,
  MunicipalityGroupAssignment,
  MunicipalityGrouping,
  MunicipalityRecordRef,
} from '@/lib/municipalityAggregation'
import { downloadBlob } from '@/lib/utils'
import type { MapMode, MapSelection, OccurrenceRecord, RecordFocus } from '@/types'
import { HeatLayer } from './HeatLayer'
import { MunicipalityChoroplethLayer } from './MunicipalityChoroplethLayer'

const alagoasCenter: [number, number] = [-9.75, -35.85]
const accentStorageKey = 'mapa-cc-mhn:municipality-accent-color'
const accentPresets = [
  { label: 'Roxo', color: defaultMunicipalityAccentColor },
  { label: 'Azul', color: '#0f4c81' },
  { label: 'Verde', color: '#176b4d' },
  { label: 'Laranja', color: '#a94f0b' },
]

interface OccurrenceMapProps {
  records: OccurrenceRecord[]
  mode: MapMode
  onModeChange: (mode: MapMode) => void
  focus: RecordFocus | null
  onSelectMunicipality: (selection: MapSelection) => void
  municipalityGeojson: MunicipalityFeatureCollection | null
  geojsonError: string
}

export function OccurrenceMap({
  records,
  mode,
  onModeChange,
  focus,
  onSelectMunicipality,
  municipalityGeojson,
  geojsonError,
}: OccurrenceMapProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [selectedMunicipalityId, setSelectedMunicipalityId] = useState<string | null>(null)
  const [selectedMetric, setSelectedMetric] = useState<MetricDetail | null>(null)
  const [showMunicipalityLabels, setShowMunicipalityLabels] = useState(true)
  const [isExportingMunicipalityMap, setIsExportingMunicipalityMap] = useState(false)
  const [exportError, setExportError] = useState('')
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false)
  const mapError = geojsonError || exportError
  const [grouping, setGrouping] = useState<MunicipalityGrouping>('lot')
  const [accentColor, setAccentColor] = useState(loadStoredAccentColor)
  const positionedRecords = useMemo(
    () => records.filter((record) => record.latitude !== null && record.longitude !== null),
    [records],
  )
  // Memorizado: um array novo a cada render faria a camada de calor ser recriada (abrir um diálogo, trocar a cor...).
  const heatPoints = useMemo(
    () => positionedRecords.map((record) => [record.latitude!, record.longitude!, 1] as [number, number, number]),
    [positionedRecords],
  )
  const municipalityAggregation = useMemo(
    () =>
      municipalityGeojson
        ? aggregateByMunicipality(records, municipalityGeojson, grouping)
        : null,
    [grouping, municipalityGeojson, records],
  )
  const selectedMunicipality =
    selectedMunicipalityId && municipalityAggregation
      ? municipalityAggregation.counts.get(selectedMunicipalityId) ?? null
      : null
  const canExportMunicipalityMap = Boolean(municipalityGeojson && municipalityAggregation)
  const emptyMunicipalities = useMemo(
    () =>
      municipalityGeojson && municipalityAggregation
        ? municipalityGeojson.features
            .filter((feature) => !municipalityAggregation.counts.has(getMunicipalityFeatureId(feature)))
            .map((feature) => feature.properties.name)
            .sort((a, b) => a.localeCompare(b, 'pt-BR'))
        : [],
    [municipalityAggregation, municipalityGeojson],
  )

  function handleGroupingChange(value: MunicipalityGrouping) {
    setGrouping(value)
    setSelectedMunicipalityId(null)
    setSelectedMetric(null)
  }

  async function handleExportMunicipalityMap(format: 'png' | 'svg') {
    if (!municipalityGeojson || !municipalityAggregation || isExportingMunicipalityMap) return

    setIsExportingMunicipalityMap(true)
    setExportError('')
    try {
      const svg = buildMunicipalityReportSvg({
        geojson: municipalityGeojson,
        aggregation: municipalityAggregation,
        showLabels: showMunicipalityLabels,
        accentColor,
      })
      const fileName = getMunicipalityMapFileName(grouping, new Date(), format)
      if (format === 'svg') {
        downloadBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), fileName)
      } else {
        await downloadMunicipalityMapPng(svg, fileName)
      }
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Não foi possível exportar o mapa.')
    } finally {
      setIsExportingMunicipalityMap(false)
    }
  }

  useEffect(() => {
    if (focus) cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [focus])

  useEffect(() => {
    try {
      localStorage.setItem(accentStorageKey, accentColor)
    } catch {
      // O mapa continua funcional quando o navegador bloqueia armazenamento local.
    }
  }, [accentColor])

  return (
    <Card ref={cardRef} className='flex min-h-[460px] scroll-mt-4 flex-col overflow-hidden xl:min-h-[360px] xl:flex-1'>
      {/* Uma linha só: as abas de modo já dizem que é o mapa; os controles do modo ficam à direita. */}
      <CardHeader className='flex flex-row flex-wrap items-center justify-between gap-2 px-4 py-3'>
        <CardTitle className='sr-only'>Mapa</CardTitle>
        <Tabs value={mode} onValueChange={(value) => onModeChange(value as MapMode)}>
          <TabsList>
            <TabsTrigger value='heatmap' className='px-2.5'><Layers /> Pontos</TabsTrigger>
            <TabsTrigger value='municipalities' className='px-2.5'><MapIcon /> Municípios</TabsTrigger>
            <TabsTrigger value='markers' className='px-2.5'><MapPin /> Lotes</TabsTrigger>
          </TabsList>
        </Tabs>
        {mode === 'municipalities' ? (
          <div className='flex flex-wrap items-center justify-end gap-2'>
            <div className='flex h-9 items-center gap-2'>
              <Label htmlFor='municipality-grouping' className='sr-only'>
                Agrupar por
              </Label>
              <Select
                id='municipality-grouping'
                className='w-36'
                value={grouping}
                onChange={(event) => handleGroupingChange(event.target.value as MunicipalityGrouping)}
              >
                <option value='lot'>Agrupar: lotes</option>
                <option value='family'>Agrupar: famílias</option>
                <option value='species'>Agrupar: espécies</option>
              </Select>
            </div>
            <AccentColorPicker value={accentColor} onChange={setAccentColor} />
            <Button
              type='button'
              variant={showMunicipalityLabels ? 'secondary' : 'outline'}
              className='h-9 px-3'
              onClick={() => setShowMunicipalityLabels((value) => !value)}
            >
              <Tags /> Nomes
            </Button>
            <Popover open={isExportMenuOpen} onOpenChange={setIsExportMenuOpen}>
              <PopoverTrigger asChild>
                <Button type='button' className='h-9 px-3' disabled={!canExportMunicipalityMap || isExportingMunicipalityMap}>
                  <Download />
                  {isExportingMunicipalityMap ? 'Exportando...' : 'Exportar'}
                  <ChevronDown />
                </Button>
              </PopoverTrigger>
              <PopoverContent align='end' className='w-72 p-1'>
                <ExportOption
                  title='Imagem PNG'
                  description='Para slides, documentos e mensagens. Alta resolução (3200 × 1800).'
                  onClick={() => {
                    setIsExportMenuOpen(false)
                    void handleExportMunicipalityMap('png')
                  }}
                />
                <ExportOption
                  title='Vetorial SVG'
                  description='Para artigos, pôsteres e edição no Illustrator ou Inkscape. Não perde qualidade ao ampliar.'
                  onClick={() => {
                    setIsExportMenuOpen(false)
                    void handleExportMunicipalityMap('svg')
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>
        ) : null}
      </CardHeader>
      {mode === 'municipalities' && (municipalityAggregation || !mapError) ? (
        <MunicipalityLegend
          aggregation={municipalityAggregation}
          emptyMunicipalities={emptyMunicipalities}
          onMetricClick={setSelectedMetric}
        />
      ) : null}
      <CardContent className='relative h-[460px] p-0 xl:h-auto xl:flex-1'>
        <MapContainer center={alagoasCenter} zoom={8} scrollWheelZoom className='z-0'>
          {mode !== 'municipalities' ? (
            <TileLayer
              attribution='&copy; <a href=https://www.openstreetmap.org/copyright>OpenStreetMap</a>'
              url='https://tile.openstreetmap.org/{z}/{x}/{y}.png'
            />
          ) : null}
          {mode === 'heatmap' ? <HeatLayer points={heatPoints} /> : null}
          {mode === 'municipalities' && municipalityGeojson && municipalityAggregation ? (
            <MunicipalityChoroplethLayer
              geojson={municipalityGeojson}
              aggregation={municipalityAggregation}
              accentColor={accentColor}
              onMunicipalityClick={setSelectedMunicipalityId}
              showLabels={showMunicipalityLabels}
            />
          ) : null}
          {mode === 'municipalities'
            ? municipalityAggregation?.marineRecords.map((record) => (
                <CircleMarker
                  key={record.id}
                  center={[record.latitude!, record.longitude!]}
                  radius={5}
                  pathOptions={{ color: '#ffffff', weight: 2, fillColor: accentColor, fillOpacity: 1 }}
                >
                  <Tooltip>{record.code || 'Sem código'} · marinho</Tooltip>
                </CircleMarker>
              ))
            : null}
          {mode === 'markers'
            ? positionedRecords.map((record) => (
                <Marker
                  key={record.id}
                  position={[record.latitude!, record.longitude!]}
                  icon={record.positionSource === 'local_fallback' ? localFallbackIcon : coordinatesIcon}
                >
                  <Popup>
                    <div className='grid min-w-56 gap-1 text-sm'>
                      <strong>{record.code || 'Sem código'}</strong>
                      <span>{record.family || 'Família não informada'} · <em>{record.species || 'Espécie não informada'}</em></span>
                      <span>{record.local || 'Local não informado'}</span>
                      <span>{record.dateText || 'Sem data'}</span>
                      <span className='text-muted-foreground'>
                        {record.positionSource === 'local_fallback'
                          ? `Posição aproximada: ${record.positionLabel}`
                          : 'Coordenadas da planilha'}
                      </span>
                    </div>
                  </Popup>
                </Marker>
              ))
            : null}
          <FocusedRecord focus={focus} />
          <SizeWatcher />
        </MapContainer>
        {mode === 'markers' ? (
          <div className='pointer-events-none absolute bottom-3 left-3 z-[500] grid gap-1 rounded-md border bg-card/95 p-3 text-xs shadow-md backdrop-blur'>
            <span className='flex items-center gap-2'><span className='occurrence-marker !size-3' /> Coordenadas da planilha</span>
            <span className='flex items-center gap-2'><span className='occurrence-marker local-fallback !size-3' /> Aproximada pelo local</span>
          </div>
        ) : null}
        {mode === 'municipalities' && mapError ? (
          <div
            role='alert'
            className='absolute right-3 top-3 z-[500] max-w-sm rounded-md border border-destructive/40 bg-card/95 p-3 text-xs text-destructive shadow-md'
          >
            {mapError}
          </div>
        ) : null}
        {mode === 'municipalities' && municipalityAggregation ? (
          <ColorScaleLegend aggregation={municipalityAggregation} accentColor={accentColor} />
        ) : null}
        <MunicipalityDetailDialog
          municipality={selectedMunicipality}
          grouping={grouping}
          open={Boolean(selectedMunicipality)}
          onOpenChange={(open) => !open && setSelectedMunicipalityId(null)}
          onFilter={(selection) => {
            setSelectedMunicipalityId(null)
            onSelectMunicipality(selection)
          }}
        />
        <MetricDetailDialog
          detail={selectedMetric}
          grouping={grouping}
          onOpenChange={(open) => !open && setSelectedMetric(null)}
        />
      </CardContent>
    </Card>
  )
}

type MetricDetail =
  | { type: 'municipalities'; title: string; description: string; municipalities: MunicipalityCount[] }
  | { type: 'groups'; title: string; description: string; groups: MunicipalityGroup[] }
  | { type: 'assignments'; title: string; description: string; assignments: MunicipalityGroupAssignment[] }
  | { type: 'records'; title: string; description: string; records: OccurrenceRecord[] }
  | { type: 'names'; title: string; description: string; names: string[] }

function AccentColorPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type='button'
          variant='outline'
          className='h-9 px-3'
          aria-label='Escolher cor do mapa'
          title='Cor do mapa'
        >
          <Palette />
          <span className='size-3 rounded-full border' style={{ backgroundColor: value }} />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align='end'
        sideOffset={8}
        collisionPadding={16}
        className='w-64 p-4'
      >
        <div className='grid gap-4'>
          <div className='grid gap-2'>
            <Label>Paletas</Label>
            <div className='flex flex-wrap gap-2'>
              {accentPresets.map((preset) => (
                <button
                  key={preset.color}
                  type='button'
                  className='size-9 rounded-full border-2 shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'
                  style={{
                    backgroundColor: preset.color,
                    borderColor: value === preset.color ? 'var(--foreground)' : 'var(--border)',
                  }}
                  aria-label={`Usar cor ${preset.label}`}
                  title={preset.label}
                  onClick={() => onChange(preset.color)}
                />
              ))}
            </div>
          </div>
          <div className='flex items-center justify-between gap-3'>
            <Label htmlFor='municipality-custom-color'>Cor personalizada</Label>
            <input
              id='municipality-custom-color'
              type='color'
              className='h-9 w-14 cursor-pointer rounded border bg-background p-1'
              value={value}
              onChange={(event) => onChange(event.target.value)}
            />
          </div>
          <Button
            type='button'
            variant='ghost'
            size='sm'
            disabled={value === defaultMunicipalityAccentColor}
            onClick={() => onChange(defaultMunicipalityAccentColor)}
          >
            <RotateCcw /> Restaurar roxo padrão
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function MunicipalityDetailDialog({
  municipality,
  grouping,
  open,
  onOpenChange,
  onFilter,
}: {
  municipality: MunicipalityCount | null
  grouping: MunicipalityGrouping
  open: boolean
  onOpenChange: (open: boolean) => void
  onFilter: (selection: MapSelection) => void
}) {
  const missingRefs = municipality?.records.filter(({ record }) =>
    grouping === 'family' ? !record.family.trim() : grouping === 'species' ? !record.species.trim() : false,
  ) ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='w-[min(1240px,calc(100vw-2rem))]'>
        <DialogHeader>
          <DialogTitle>{municipality?.name ?? 'Município'}</DialogTitle>
          <DialogDescription>
            {municipality
              ? `${municipality.total} ${groupLabel(grouping, municipality.total)} e ${municipality.lotTotal} lote(s) associados.${grouping === 'lot' ? '' : ' Diretos e CELMM podem se sobrepor.'}`
              : 'Dados associados ao município.'}
          </DialogDescription>
        </DialogHeader>
        <div className='flex flex-wrap gap-2'>
          <Badge variant='secondary'>{municipality?.total ?? 0} {groupLabel(grouping, municipality?.total ?? 0)}</Badge>
          <Badge variant='outline'>{municipality?.direct ?? 0} diretos</Badge>
          <Badge variant='warning'>{municipality?.celmm ?? 0} CELMM</Badge>
          <Badge variant='outline'>{municipality?.lotTotal ?? 0} lotes</Badge>
          {municipality ? (
            <Button
              type='button'
              size='sm'
              variant='outline'
              className='ml-auto'
              onClick={() =>
                onFilter({
                  label: municipality.name,
                  recordIds: municipality.records.map(({ record }) => record.id),
                })
              }
            >
              <Filter /> Filtrar por este município
            </Button>
          ) : null}
          {grouping !== 'lot' && (municipality?.missingGroupingLots ?? 0) > 0 ? (
            <Badge variant='warning'>{municipality?.missingGroupingLots} lotes sem {groupLabel(grouping, 1)}</Badge>
          ) : null}
        </div>
        {grouping === 'lot' ? (
          <RecordRefsTable refs={municipality?.records ?? []} />
        ) : (
          <div className='grid max-h-[62svh] gap-2 overflow-auto pr-1'>
            <GroupedDetails groups={municipality?.groups ?? []} grouping={grouping} />
            {missingRefs.length > 0 ? (
              <details className='rounded-md border bg-muted/20 p-3'>
                <summary className='cursor-pointer font-medium'>
                  Sem {groupLabel(grouping, 1)} · {missingRefs.length} lote(s)
                </summary>
                <div className='mt-3'><RecordRefsTable refs={missingRefs} /></div>
              </details>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function MetricDetailDialog({
  detail,
  grouping,
  onOpenChange,
}: {
  detail: MetricDetail | null
  grouping: MunicipalityGrouping
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={Boolean(detail)} onOpenChange={onOpenChange}>
      <DialogContent className='w-[min(1240px,calc(100vw-2rem))]'>
        <DialogHeader>
          <DialogTitle>{detail?.title ?? 'Detalhamento'}</DialogTitle>
          <DialogDescription>{detail?.description ?? 'Itens que compõem a métrica.'}</DialogDescription>
        </DialogHeader>
        {detail?.type === 'municipalities' ? (
          <MunicipalitySummaryTable municipalities={detail.municipalities} grouping={grouping} />
        ) : detail?.type === 'assignments' ? (
          <AssignmentDetails assignments={detail.assignments} grouping={grouping} />
        ) : detail?.type === 'groups' ? (
          grouping === 'lot' ? <RecordsTable records={uniqueRecords(detail.groups)} /> : <GroupedDetails groups={detail.groups} grouping={grouping} />
        ) : detail?.type === 'records' ? (
          <RecordsTable records={detail.records} />
        ) : detail?.type === 'names' ? (
          detail.names.length > 0 ? (
            <ul className='max-h-[62svh] columns-2 gap-6 overflow-auto rounded-md border p-4 text-sm sm:columns-3'>
              {detail.names.map((name) => <li key={name}>{name}</li>)}
            </ul>
          ) : (
            <p className='rounded-md border p-4 text-sm text-muted-foreground'>Todos os municípios têm registros.</p>
          )
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function MunicipalitySummaryTable({
  municipalities,
  grouping,
}: {
  municipalities: MunicipalityCount[]
  grouping: MunicipalityGrouping
}) {
  return (
    <ScrollArea className='max-h-[62svh] rounded-md border'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Município</TableHead>
            <TableHead>{capitalize(groupLabel(grouping, 2))}</TableHead>
            <TableHead>Diretos</TableHead>
            <TableHead>CELMM</TableHead>
            <TableHead>Lotes</TableHead>
            {grouping !== 'lot' ? <TableHead>Sem informação</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {municipalities.map((municipality) => (
            <TableRow key={municipality.id}>
              <TableCell>{municipality.name}</TableCell>
              <TableCell>{municipality.total}</TableCell>
              <TableCell>{municipality.direct}</TableCell>
              <TableCell>{municipality.celmm}</TableCell>
              <TableCell>{municipality.lotTotal}</TableCell>
              {grouping !== 'lot' ? <TableCell>{municipality.missingGroupingLots}</TableCell> : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  )
}

function GroupedDetails({ groups, grouping }: { groups: MunicipalityGroup[]; grouping: MunicipalityGrouping }) {
  return (
    <div className='grid max-h-[62svh] gap-2 overflow-auto pr-1'>
      {groups.map((group) => (
        <details key={group.key} className='rounded-md border bg-muted/20 p-3'>
          <summary className='cursor-pointer'>
            <span className='font-medium'>{group.label}</span>
            <span className='ml-2 text-sm text-muted-foreground'>
              {group.total} lote(s)
              {group.refs.length > 0 ? ` · ${group.direct} direto(s) · ${group.celmm} CELMM` : ''}
            </span>
          </summary>
          <div className='mt-3'>
            {group.refs.length > 0 ? <RecordRefsTable refs={group.refs} /> : <RecordsTable records={group.records} />}
          </div>
        </details>
      ))}
      {groups.length === 0 ? (
        <p className='rounded-md border p-4 text-sm text-muted-foreground'>
          Nenhuma {groupLabel(grouping, 1)} informada nesta seleção.
        </p>
      ) : null}
    </div>
  )
}

function AssignmentDetails({
  assignments,
  grouping,
}: {
  assignments: MunicipalityGroupAssignment[]
  grouping: MunicipalityGrouping
}) {
  return (
    <div className='grid max-h-[62svh] gap-2 overflow-auto pr-1'>
      {assignments.map(({ municipalityId, municipalityName, group }) => (
        <details key={`${municipalityId}-${group.key}`} className='rounded-md border bg-muted/20 p-3'>
          <summary className='cursor-pointer'>
            <span className='font-medium'>{municipalityName} · {group.label}</span>
            <span className='ml-2 text-sm text-muted-foreground'>
              {group.total} lote(s) · {group.direct} direto(s) · {group.celmm} CELMM
            </span>
          </summary>
          <div className='mt-3'><RecordRefsTable refs={group.refs} /></div>
        </details>
      ))}
      {assignments.length === 0 ? <p>Nenhuma atribuição de {groupLabel(grouping, 2)}.</p> : null}
    </div>
  )
}

function RecordsTable({ records }: { records: OccurrenceRecord[] }) {
  return (
    <RecordRowsTable
      rows={records.map((record) => ({ key: record.id, record, source: null }))}
    />
  )
}

function RecordRefsTable({ refs }: { refs: MunicipalityRecordRef[] }) {
  return (
    <RecordRowsTable
      rows={refs.map(({ record, source }, index) => ({
        key: `${record.id}-${source}-${index}`,
        record,
        source,
      }))}
    />
  )
}

function RecordRowsTable({
  rows,
}: {
  rows: Array<{
    key: string
    record: OccurrenceRecord
    source: 'direct' | 'celmm' | null
  }>
}) {
  return (
    <ScrollArea className='max-h-[54svh] rounded-md border'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Família</TableHead>
            <TableHead>Espécie</TableHead>
            <TableHead>Local</TableHead>
            <TableHead>Coordenadas</TableHead>
            <TableHead>Observação</TableHead>
            <TableHead>Origem</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ key, record, source }) => (
            <TableRow key={key}>
              <TableCell className='whitespace-nowrap'>{record.code || '-'}</TableCell>
              <TableCell className='whitespace-nowrap'>{record.dateText || '-'}</TableCell>
              <TableCell>{record.family || '-'}</TableCell>
              <TableCell className='min-w-48'>{record.species || '-'}</TableCell>
              <TableCell className='min-w-40'>{record.local || '-'}</TableCell>
              <TableCell className='min-w-36'>{record.coordinatesText || 'Por local'}</TableCell>
              <TableCell className='min-w-56'>{record.observation || '-'}</TableCell>
              <TableCell>
                {source ? (
                  <Badge variant={source === 'celmm' ? 'warning' : 'secondary'}>
                    {source === 'celmm' ? 'CELMM' : 'Direto'}
                  </Badge>
                ) : (
                  <Badge variant='outline'>Lote</Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  )
}

function MunicipalityLegend({
  aggregation,
  emptyMunicipalities,
  onMetricClick,
}: {
  aggregation: MunicipalityAggregation | null
  emptyMunicipalities: string[]
  onMetricClick: (detail: MetricDetail) => void
}) {
  if (!aggregation) {
    return (
      <div className='border-y px-4 py-2 text-xs text-muted-foreground'>Carregando malha municipal...</div>
    )
  }

  const municipalityRows = Array.from(aggregation.counts.values())
    .filter((municipality) => municipality.total > 0)
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'pt-BR'))
  const plural = capitalize(groupLabel(aggregation.grouping, 2))

  return (
    <div className='flex items-center gap-1.5 overflow-x-auto border-y bg-muted/30 px-4 py-2 text-xs [&>*]:shrink-0 [&>.contents>*]:shrink-0'>
      <div className='contents'>
        <MetricButton
          label='Municípios'
          value={aggregation.municipalitiesWithGroups}
          onClick={() => onMetricClick({
            type: 'municipalities',
            title: 'Municípios coloridos',
            description: `Municípios com pelo menos uma ${groupLabel(aggregation.grouping, 1)}.`,
            municipalities: municipalityRows,
          })}
        />
        <MetricButton
          label='Sem registros'
          value={emptyMunicipalities.length}
          onClick={() => onMetricClick({
            type: 'names',
            title: 'Municípios sem registros',
            description: 'Municípios de Alagoas sem nenhum lote na seleção atual: lacunas de representatividade da coleção.',
            names: emptyMunicipalities,
          })}
        />
        <MetricButton
          label='No mapa'
          value={`${aggregation.groupsWithMunicipality}/${aggregation.totalGroups}`}
          onClick={() => onMetricClick({
            type: 'groups',
            title: `${plural} no mapa municipal`,
            description: `${plural} distintos com pelo menos um lote associado a um município.`,
            groups: aggregation.mappedGroups,
          })}
        />
        <MetricButton
          label='Sem município'
          value={aggregation.unresolvedGroups}
          onClick={() => onMetricClick({
            type: 'groups',
            title: `${plural} com lote sem município`,
            description: `Agrupadores distintos presentes em lotes que não puderam ser associados a um município. Podem também ocorrer no mapa por outros lotes.`,
            groups: aggregation.unresolvedGroupItems,
          })}
        />
        {aggregation.marineRecords.length > 0 ? (
          <MetricButton
            label='Marinhos'
            value={aggregation.marineRecords.length}
            onClick={() => onMetricClick({
              type: 'records',
              title: 'Lotes marinhos',
              description: 'Lotes com coordenadas no mar, a mais de 25 km da costa de Alagoas. Aparecem como pontos no mapa e não entram na contagem dos municípios.',
              records: aggregation.marineRecords,
            })}
          />
        ) : null}
        <MetricButton
          label='Diretos'
          value={aggregation.directGroups}
          onClick={() => onMetricClick({
            type: 'groups',
            title: `${plural} diretos`,
            description: `Agrupadores distintos associados diretamente por local ou coordenada. Diretos e CELMM podem se sobrepor.`,
            groups: aggregation.directGroupItems,
          })}
        />
        <MetricButton
          label='CELMM'
          value={aggregation.celmmGroups}
          onClick={() => onMetricClick({
            type: 'groups',
            title: `${plural} CELMM/Mundaú/Manguaba`,
            description: `Agrupadores distintos distribuídos pelos municípios do CELMM. Diretos e CELMM podem se sobrepor.`,
            groups: aggregation.celmmGroupItems,
          })}
        />
        <MetricButton
          label='Atribuições'
          value={aggregation.totalAssignments}
          onClick={() => onMetricClick({
            type: 'assignments',
            title: 'Atribuições municipais',
            description: `Cada par único município–${groupLabel(aggregation.grouping, 1)}.`,
            assignments: aggregation.groupAssignments,
          })}
        />
        {aggregation.grouping !== 'lot' && aggregation.missingGroupingRecords.length > 0 ? (
          <MetricButton
            label={`Lotes sem ${groupLabel(aggregation.grouping, 1)}`}
            value={aggregation.missingGroupingRecords.length}
            onClick={() => onMetricClick({
              type: 'records',
              title: `Lotes sem ${groupLabel(aggregation.grouping, 1)}`,
              description: `Lotes excluídos da contagem por não possuírem ${groupLabel(aggregation.grouping, 1)} informada.`,
              records: aggregation.missingGroupingRecords,
            })}
          />
        ) : null}
      </div>
    </div>
  )
}

function MetricButton({
  label,
  value,
  onClick,
}: {
  label: string
  value: number | string
  onClick: () => void
}) {
  return (
    <button
      type='button'
      className='inline-flex items-baseline gap-1 rounded-full border bg-background px-2.5 py-1 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'
      onClick={onClick}
    >
      <span className='font-semibold text-foreground'>{value}</span>
      <span className='text-muted-foreground'>{label.toLowerCase()}</span>
    </button>
  )
}

function loadStoredAccentColor(): string {
  try {
    const stored = localStorage.getItem(accentStorageKey)
    return stored && isValidHexColor(stored) ? stored.toLowerCase() : defaultMunicipalityAccentColor
  } catch {
    return defaultMunicipalityAccentColor
  }
}

function groupLabel(grouping: MunicipalityGrouping, count: number): string {
  if (grouping === 'lot') return count === 1 ? 'lote' : 'lotes'
  if (grouping === 'family') return count === 1 ? 'família' : 'famílias'
  return count === 1 ? 'espécie' : 'espécies'
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function uniqueRecords(groups: MunicipalityGroup[]): OccurrenceRecord[] {
  const records = new Map<string, OccurrenceRecord>()
  for (const group of groups) {
    for (const record of group.records) records.set(record.id, record)
  }
  return Array.from(records.values())
}

// No desktop o mapa estica com a tela; o Leaflet só recalcula o tamanho se for avisado.
// Escala de cores do mapa municipal: cada faixa de contagem e sua cor.
function ColorScaleLegend({ aggregation, accentColor }: { aggregation: MunicipalityAggregation; accentColor: string }) {
  const scale = municipalityColorScale(aggregation.max, accentColor)

  return (
    <div className='pointer-events-none absolute bottom-3 left-3 z-[500] grid gap-1.5 rounded-md border bg-card/95 px-3 py-2 text-xs shadow-md backdrop-blur'>
      <span className='font-medium'>{capitalize(groupLabel(aggregation.grouping, 2))}</span>
      <div className='flex flex-wrap items-center gap-x-3 gap-y-1'>
        {scale.map(({ from, to, color }) => (
          <span key={from} className='flex items-center gap-1.5'>
            <span className='size-3 rounded-sm border border-black/10' style={{ backgroundColor: color }} />
            {from === to ? from : `${from}–${to}`}
          </span>
        ))}
        <span className='flex items-center gap-1.5 text-muted-foreground'>
          <span className='size-3 rounded-sm border border-black/10' style={{ backgroundColor: municipalityEmptyColor }} />
          sem registro
        </span>
        {aggregation.marineRecords.length > 0 ? (
          <span className='flex items-center gap-1.5 text-muted-foreground'>
            <span className='size-3 rounded-full border-2 border-white shadow-sm' style={{ backgroundColor: accentColor }} />
            marinho
          </span>
        ) : null}
      </div>
    </div>
  )
}

function ExportOption({ title, description, onClick }: { title: string; description: string; onClick: () => void }) {
  return (
    <button
      type='button'
      className='grid w-full gap-0.5 rounded-md px-3 py-2 text-left hover:bg-accent focus-visible:bg-accent focus-visible:outline-none'
      onClick={onClick}
    >
      <span className='text-sm font-medium'>{title}</span>
      <span className='text-xs text-muted-foreground'>{description}</span>
    </button>
  )
}

function SizeWatcher() {
  const map = useMap()

  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(map.getContainer())
    return () => observer.disconnect()
  }, [map])

  return null
}

function FocusedRecord({ focus }: { focus: RecordFocus | null }) {
  const map = useMap()
  const latitude = focus?.record.latitude
  const longitude = focus?.record.longitude

  useEffect(() => {
    if (latitude != null && longitude != null) map.flyTo([latitude, longitude], Math.max(map.getZoom(), 12))
  }, [focus, latitude, longitude, map])

  if (!focus || latitude == null || longitude == null) return null

  return (
    <CircleMarker
      center={[latitude, longitude]}
      radius={14}
      pathOptions={{ color: '#d1495b', weight: 3, fillOpacity: 0.15 }}
      interactive={false}
    >
      <Tooltip permanent direction='top' offset={[0, -14]}>
        {focus.record.code || 'Sem código'}
        {focus.record.positionSource === 'local_fallback' ? ' (posição aproximada)' : ''}
      </Tooltip>
    </CircleMarker>
  )
}

const coordinatesIcon = L.divIcon({ className: 'occurrence-marker', html: '', iconSize: [18, 18], iconAnchor: [9, 9] })
const localFallbackIcon = L.divIcon({ className: 'occurrence-marker local-fallback', html: '', iconSize: [18, 18], iconAnchor: [9, 9] })
