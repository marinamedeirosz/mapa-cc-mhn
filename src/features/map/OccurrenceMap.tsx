import L from 'leaflet'
import { Download, Layers, Map as MapIcon, MapPinned, Palette, RotateCcw, Tags } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
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
import type { MapMode, OccurrenceRecord, PositionSource } from '@/types'
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
}

export function OccurrenceMap({ records, mode, onModeChange }: OccurrenceMapProps) {
  const [municipalityGeojson, setMunicipalityGeojson] =
    useState<MunicipalityFeatureCollection | null>(null)
  const [selectedMunicipalityId, setSelectedMunicipalityId] = useState<string | null>(null)
  const [selectedMetric, setSelectedMetric] = useState<MetricDetail | null>(null)
  const [showMunicipalityLabels, setShowMunicipalityLabels] = useState(true)
  const [isExportingMunicipalityMap, setIsExportingMunicipalityMap] = useState(false)
  const [grouping, setGrouping] = useState<MunicipalityGrouping>('lot')
  const [accentColor, setAccentColor] = useState(loadStoredAccentColor)
  const positionedRecords = records.filter(
    (record) => record.latitude !== null && record.longitude !== null,
  )
  const heatPoints = positionedRecords.map(
    (record) => [record.latitude!, record.longitude!, 1] as [number, number, number],
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

  function handleGroupingChange(value: MunicipalityGrouping) {
    setGrouping(value)
    setSelectedMunicipalityId(null)
    setSelectedMetric(null)
  }

  async function handleExportMunicipalityMap() {
    if (!municipalityGeojson || !municipalityAggregation || isExportingMunicipalityMap) return

    setIsExportingMunicipalityMap(true)
    try {
      const svg = buildMunicipalityReportSvg({
        geojson: municipalityGeojson,
        aggregation: municipalityAggregation,
        showLabels: showMunicipalityLabels,
        accentColor,
      })
      await downloadMunicipalityMapPng(svg, getMunicipalityMapFileName(grouping))
    } finally {
      setIsExportingMunicipalityMap(false)
    }
  }

  useEffect(() => {
    try {
      localStorage.setItem(accentStorageKey, accentColor)
    } catch {
      // O mapa continua funcional quando o navegador bloqueia armazenamento local.
    }
  }, [accentColor])

  useEffect(() => {
    let cancelled = false
    fetch('/data/alagoas-municipios.geojson')
      .then((response) => {
        if (!response.ok) throw new Error('Não foi possível carregar a malha de Alagoas.')
        return response.json() as Promise<MunicipalityFeatureCollection>
      })
      .then((data) => {
        if (!cancelled) setMunicipalityGeojson(data)
      })
      .catch(() => {
        if (!cancelled) setMunicipalityGeojson(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Card className='min-h-[460px] overflow-hidden'>
      <CardHeader className='flex flex-row flex-wrap items-center justify-between gap-3 pb-3'>
        <CardTitle className='flex items-center gap-2 text-base'>
          <MapPinned className='size-4' />
          Mapa
        </CardTitle>
        {mode === 'municipalities' ? (
          <div className='flex flex-wrap items-center justify-end gap-2'>
            <div className='flex h-9 items-center gap-2'>
              <Label htmlFor='municipality-grouping' className='whitespace-nowrap text-sm'>
                Agrupar por
              </Label>
              <Select
                id='municipality-grouping'
                className='w-32'
                value={grouping}
                onChange={(event) => handleGroupingChange(event.target.value as MunicipalityGrouping)}
              >
                <option value='lot'>Lote</option>
                <option value='family'>Família</option>
                <option value='species'>Espécie</option>
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
            <Button
              type='button'
              className='h-9 px-3'
              disabled={!canExportMunicipalityMap || isExportingMunicipalityMap}
              onClick={handleExportMunicipalityMap}
            >
              <Download />
              {isExportingMunicipalityMap ? 'Exportando...' : 'Exportar mapa'}
            </Button>
          </div>
        ) : null}
        <Tabs value={mode} onValueChange={(value) => onModeChange(value as MapMode)}>
          <TabsList>
            <TabsTrigger value='heatmap'><Layers /> Pontos</TabsTrigger>
            <TabsTrigger value='municipalities'><MapIcon /> Municípios</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className='relative h-[520px] p-0'>
        <MapContainer center={alagoasCenter} zoom={8} scrollWheelZoom className='z-0'>
          {mode !== 'municipalities' ? (
            <TileLayer
              attribution='&copy; <a href=https://www.openstreetmap.org/copyright>OpenStreetMap</a>'
              url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
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
          {mode === 'markers'
            ? positionedRecords.map((record) => (
                <Marker
                  key={record.id}
                  position={[record.latitude!, record.longitude!]}
                  icon={markerIcon(record.positionSource)}
                >
                  <Popup>
                    <div className='grid min-w-56 gap-2 text-sm'>
                      <strong>{record.code || 'Sem código'}</strong>
                      <span>{record.species || 'Espécie não informada'}</span>
                      <span>{record.local || 'Local não informado'}</span>
                    </div>
                  </Popup>
                </Marker>
              ))
            : null}
        </MapContainer>
        {mode === 'municipalities' ? (
          <MunicipalityLegend aggregation={municipalityAggregation} onMetricClick={setSelectedMetric} />
        ) : null}
        <MunicipalityDetailDialog
          municipality={selectedMunicipality}
          grouping={grouping}
          open={Boolean(selectedMunicipality)}
          onOpenChange={(open) => !open && setSelectedMunicipalityId(null)}
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

function AccentColorPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type='button'
          variant='outline'
          className='h-9 px-3'
          aria-label='Escolher cor do mapa'
        >
          <Palette />
          <span className='size-3 rounded-full border' style={{ backgroundColor: value }} />
          Cor
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
}: {
  municipality: MunicipalityCount | null
  grouping: MunicipalityGrouping
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const missingRefs = municipality?.records.filter(({ record }) =>
    grouping === 'family' ? !record.family.trim() : grouping === 'species' ? !record.species.trim() : false,
  ) ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-5xl'>
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
      <DialogContent className='sm:max-w-5xl'>
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
  onMetricClick,
}: {
  aggregation: MunicipalityAggregation | null
  onMetricClick: (detail: MetricDetail) => void
}) {
  if (!aggregation) {
    return (
      <div className='pointer-events-none absolute bottom-3 left-3 z-[500] rounded-md border bg-card/95 p-3 text-xs text-muted-foreground shadow-md backdrop-blur'>
        Carregando malha municipal...
      </div>
    )
  }

  const municipalityRows = Array.from(aggregation.counts.values())
    .filter((municipality) => municipality.total > 0)
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'pt-BR'))
  const plural = capitalize(groupLabel(aggregation.grouping, 2))

  return (
    <div className='absolute bottom-3 left-3 z-[500] grid max-w-[calc(100%-1.5rem)] gap-2 rounded-md border bg-card/95 p-3 text-xs shadow-md backdrop-blur'>
      <div className='font-medium text-foreground'>{plural} por município</div>
      <div className='grid grid-cols-2 gap-2 sm:grid-cols-3'>
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
      className='grid min-w-24 gap-0.5 rounded-md border bg-background px-2 py-1.5 text-left shadow-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'
      onClick={onClick}
    >
      <span className='text-base font-semibold leading-none text-foreground'>{value}</span>
      <span className='text-[11px] text-muted-foreground'>{label}</span>
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

function markerIcon(source: PositionSource) {
  return L.divIcon({
    className: `occurrence-marker ${source === 'local_fallback' ? 'local-fallback' : ''}`,
    html: '',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  })
}
