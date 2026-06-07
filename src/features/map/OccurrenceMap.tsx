import L from 'leaflet'
import { Layers, Map, MapPinned } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { MunicipalityAggregation } from '@/lib/municipalityAggregation'
import type { MunicipalityAssignmentRef, MunicipalityRecordRef } from '@/lib/municipalityAggregation'
import type { MunicipalityCount } from '@/lib/municipalityAggregation'
import type { MunicipalityFeatureCollection } from '@/lib/municipalityAggregation'
import { aggregateByMunicipality } from '@/lib/municipalityAggregation'
import type { MapMode, OccurrenceRecord, PositionSource } from '@/types'
import { HeatLayer } from './HeatLayer'
import { MunicipalityChoroplethLayer } from './MunicipalityChoroplethLayer'

const alagoasCenter: [number, number] = [-9.75, -35.85]

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
  const positionedRecords = records.filter(
    (record) => record.latitude !== null && record.longitude !== null,
  )
  const heatPoints = positionedRecords.map(
    (record) => [record.latitude!, record.longitude!, 1] as [number, number, number],
  )
  const municipalityAggregation = useMemo(
    () => (municipalityGeojson ? aggregateByMunicipality(records, municipalityGeojson) : null),
    [municipalityGeojson, records],
  )
  const selectedMunicipality =
    selectedMunicipalityId && municipalityAggregation
      ? municipalityAggregation.counts.get(selectedMunicipalityId) ?? null
      : null

  useEffect(() => {
    let cancelled = false

    fetch('/data/alagoas-municipios.geojson')
      .then((response) => {
        if (!response.ok) {
          throw new Error('Não foi possível carregar a malha de Alagoas.')
        }

        return response.json() as Promise<MunicipalityFeatureCollection>
      })
      .then((data) => {
        if (!cancelled) {
          setMunicipalityGeojson(data)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMunicipalityGeojson(null)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Card className="min-h-[460px] overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPinned className="size-4" />
          Mapa
        </CardTitle>
        <Tabs value={mode} onValueChange={(value) => onModeChange(value as MapMode)}>
          <TabsList>
            <TabsTrigger value="heatmap">
              <Layers />
              Pontos
            </TabsTrigger>
            <TabsTrigger value="municipalities">
              <Map />
              Municípios
            </TabsTrigger>
            {/* <TabsTrigger value="markers">
              <MapPinned />
              Marcadores
            </TabsTrigger> */}
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="relative h-[520px] p-0">
        <MapContainer center={alagoasCenter} zoom={8} scrollWheelZoom className="z-0">
          {mode !== 'municipalities' ? (
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          ) : null}
          {mode === 'heatmap' ? <HeatLayer points={heatPoints} /> : null}
          {mode === 'municipalities' ? (
            municipalityGeojson && municipalityAggregation ? (
              <MunicipalityChoroplethLayer
                geojson={municipalityGeojson}
                aggregation={municipalityAggregation}
                onMunicipalityClick={setSelectedMunicipalityId}
              />
            ) : null
          ) : null}
          {mode === 'markers'
            ? positionedRecords.map((record) => (
                <Marker
                  key={record.id}
                  position={[record.latitude!, record.longitude!]}
                  icon={markerIcon(record.positionSource)}
                >
                  <Popup>
                    <div className="grid min-w-56 gap-2 text-sm">
                      <strong>{record.code || 'Sem código'}</strong>
                      <span>{record.species || 'Espécie não informada'}</span>
                      <span>{record.local || 'Local não informado'}</span>
                      <Badge variant={record.positionSource === 'coordinates' ? 'secondary' : 'warning'}>
                        {record.positionSource === 'coordinates'
                          ? 'Coordenadas'
                          : `Local: ${record.positionLabel}`}
                      </Badge>
                    </div>
                  </Popup>
                </Marker>
              ))
            : null}
        </MapContainer>
        {mode === 'municipalities' ? (
          <MunicipalityLegend
            aggregation={municipalityAggregation}
            onMetricClick={setSelectedMetric}
          />
        ) : null}
        <MunicipalityRecordsDialog
          municipality={selectedMunicipality}
          open={Boolean(selectedMunicipality)}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedMunicipalityId(null)
            }
          }}
        />
        <MetricDetailDialog
          detail={selectedMetric}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedMetric(null)
            }
          }}
        />
      </CardContent>
    </Card>
  )
}

type MetricDetail =
  | {
      type: 'municipalities'
      title: string
      description: string
      municipalities: MunicipalityCount[]
    }
  | {
      type: 'records'
      title: string
      description: string
      records: OccurrenceRecord[]
    }
  | {
      type: 'recordRefs'
      title: string
      description: string
      refs: MunicipalityRecordRef[]
    }
  | {
      type: 'assignments'
      title: string
      description: string
      assignments: MunicipalityAssignmentRef[]
    }

function MunicipalityRecordsDialog({
  municipality,
  open,
  onOpenChange,
}: {
  municipality: MunicipalityCount | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{municipality?.name ?? 'Município'}</DialogTitle>
          <DialogDescription>
            {municipality
              ? `${municipality.total} registros: ${municipality.direct} diretos e ${municipality.celmm} CELMM/Mundaú/Manguaba.`
              : 'Registros associados ao município.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{municipality?.total ?? 0} total</Badge>
          <Badge variant="outline">{municipality?.direct ?? 0} diretos</Badge>
          <Badge variant="warning">{municipality?.celmm ?? 0} CELMM</Badge>
        </div>

        <ScrollArea className="max-h-[62svh] rounded-md border">
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
              {municipality?.records.map(({ record, source }, index) => (
                <TableRow key={`${record.id}-${source}-${index}`}>
                  <TableCell className="whitespace-nowrap">{record.code || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap">{record.dateText || '-'}</TableCell>
                  <TableCell>{record.family || '-'}</TableCell>
                  <TableCell className="min-w-48">{record.species || '-'}</TableCell>
                  <TableCell className="min-w-40">{record.local || '-'}</TableCell>
                  <TableCell className="min-w-36">{record.coordinatesText || 'Por local'}</TableCell>
                  <TableCell className="min-w-56">{record.observation || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={source === 'celmm' ? 'warning' : 'secondary'}>
                      {source === 'celmm' ? 'CELMM' : 'Direto'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

function MetricDetailDialog({
  detail,
  onOpenChange,
}: {
  detail: MetricDetail | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={Boolean(detail)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{detail?.title ?? 'Detalhamento'}</DialogTitle>
          <DialogDescription>{detail?.description ?? 'Itens que compõem a métrica.'}</DialogDescription>
        </DialogHeader>
        {detail?.type === 'municipalities' ? (
          <MunicipalitySummaryTable municipalities={detail.municipalities} />
        ) : detail?.type === 'assignments' ? (
          <AssignmentTable assignments={detail.assignments} />
        ) : detail?.type === 'recordRefs' ? (
          <RecordRefsTable refs={detail.refs} />
        ) : detail?.type === 'records' ? (
          <RecordsTable records={detail.records} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function MunicipalitySummaryTable({ municipalities }: { municipalities: MunicipalityCount[] }) {
  return (
    <ScrollArea className="max-h-[62svh] rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Município</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Diretos</TableHead>
            <TableHead>CELMM</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {municipalities.map((municipality) => (
            <TableRow key={municipality.id}>
              <TableCell>{municipality.name}</TableCell>
              <TableCell>{municipality.total}</TableCell>
              <TableCell>{municipality.direct}</TableCell>
              <TableCell>{municipality.celmm}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  )
}

function RecordsTable({ records }: { records: OccurrenceRecord[] }) {
  return (
    <RecordRowsTable
      rows={records.map((record) => ({
        key: record.id,
        record,
        source: null,
        municipalityName: null,
      }))}
    />
  )
}

function RecordRefsTable({ refs }: { refs: MunicipalityRecordRef[] }) {
  return (
    <RecordRowsTable
      rows={refs.map(({ record, source }) => ({
        key: `${record.id}-${source}`,
        record,
        source,
        municipalityName: null,
      }))}
    />
  )
}

function AssignmentTable({ assignments }: { assignments: MunicipalityAssignmentRef[] }) {
  return (
    <RecordRowsTable
      rows={assignments.map(({ record, source, municipalityId, municipalityName }, index) => ({
        key: `${record.id}-${source}-${municipalityId}-${index}`,
        record,
        source,
        municipalityName,
      }))}
      showMunicipality
    />
  )
}

function RecordRowsTable({
  rows,
  showMunicipality = false,
}: {
  rows: Array<{
    key: string
    record: OccurrenceRecord
    source: 'direct' | 'celmm' | null
    municipalityName: string | null
  }>
  showMunicipality?: boolean
}) {
  return (
    <ScrollArea className="max-h-[62svh] rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {showMunicipality ? <TableHead>Município</TableHead> : null}
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
          {rows.map(({ key, record, source, municipalityName }) => (
            <TableRow key={key}>
              {showMunicipality ? <TableCell>{municipalityName ?? '-'}</TableCell> : null}
              <TableCell className="whitespace-nowrap">{record.code || '-'}</TableCell>
              <TableCell className="whitespace-nowrap">{record.dateText || '-'}</TableCell>
              <TableCell>{record.family || '-'}</TableCell>
              <TableCell className="min-w-48">{record.species || '-'}</TableCell>
              <TableCell className="min-w-40">{record.local || '-'}</TableCell>
              <TableCell className="min-w-36">{record.coordinatesText || 'Por local'}</TableCell>
              <TableCell className="min-w-56">{record.observation || '-'}</TableCell>
              <TableCell>
                {source ? (
                  <Badge variant={source === 'celmm' ? 'warning' : 'secondary'}>
                    {source === 'celmm' ? 'CELMM' : 'Direto'}
                  </Badge>
                ) : (
                  <Badge variant="outline">Registro</Badge>
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
      <div className="pointer-events-none absolute bottom-3 left-3 z-[500] rounded-md border bg-card/95 p-3 text-xs text-muted-foreground shadow-md backdrop-blur">
        Carregando malha municipal...
      </div>
    )
  }

  const assignments = aggregation.totalMunicipalized
  const municipalities = aggregation.municipalitiesWithRecords
  const unresolved = aggregation.unresolved
  const mappedRecords = aggregation.recordsWithMunicipality
  const totalRecords = aggregation.totalRecords
  const directRecords = aggregation.directRecords
  const celmmRecords = aggregation.celmmRecords
  const hasDistributedRecords = assignments !== mappedRecords
  const municipalityRows = Array.from(aggregation.counts.values()).sort(
    (a, b) => b.total - a.total || a.name.localeCompare(b.name, 'pt-BR'),
  )

  return (
    <div className="absolute bottom-3 left-3 z-[500] grid max-w-[calc(100%-1.5rem)] gap-2 rounded-md border bg-card/95 p-3 text-xs shadow-md backdrop-blur">
      <div className="font-medium text-foreground">Registros por município</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <MetricButton
          label="Municípios"
          value={municipalities}
          onClick={() =>
            onMetricClick({
              type: 'municipalities',
              title: 'Municípios coloridos',
              description: 'Municípios com pelo menos uma atribuição no mapa.',
              municipalities: municipalityRows,
            })
          }
        />
        <MetricButton
          label="No mapa"
          value={`${mappedRecords}/${totalRecords}`}
          onClick={() =>
            onMetricClick({
              type: 'records',
              title: 'Registros no mapa municipal',
              description: 'Linhas únicas que foram associadas a pelo menos um município.',
              records: aggregation.mappedRecords,
            })
          }
        />
        <MetricButton
          label="Sem município"
          value={unresolved}
          onClick={() =>
            onMetricClick({
              type: 'records',
              title: 'Registros sem município',
              description: 'Linhas que não foram associadas a nenhum município no mapa.',
              records: aggregation.unresolvedRecords,
            })
          }
        />
        <MetricButton
          label="Diretos"
          value={directRecords}
          onClick={() =>
            onMetricClick({
              type: 'recordRefs',
              title: 'Registros diretos',
              description: 'Linhas associadas diretamente por local ou coordenada.',
              refs: aggregation.directRecordRefs,
            })
          }
        />
        <MetricButton
          label="CELMM"
          value={celmmRecords}
          onClick={() =>
            onMetricClick({
              type: 'recordRefs',
              title: 'Registros CELMM/Mundaú/Manguaba',
              description: 'Linhas distribuídas pelos municípios do CELMM.',
              refs: aggregation.celmmRecordRefs,
            })
          }
        />
        {hasDistributedRecords ? (
          <MetricButton
            label="Atribuições"
            value={assignments}
            onClick={() =>
              onMetricClick({
                type: 'assignments',
                title: 'Atribuições municipais',
                description: 'Cada linha associada a cada município. CELMM pode aparecer em mais de um município.',
                assignments: aggregation.assignmentRefs,
              })
            }
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
      type="button"
      className="grid min-w-24 gap-0.5 rounded-md border bg-background px-2 py-1.5 text-left shadow-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      onClick={onClick}
    >
      <span className="text-base font-semibold leading-none text-foreground">{value}</span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </button>
  )
}

function markerIcon(source: PositionSource) {
  return L.divIcon({
    className: `occurrence-marker ${source === 'local_fallback' ? 'local-fallback' : ''}`,
    html: '',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  })
}
