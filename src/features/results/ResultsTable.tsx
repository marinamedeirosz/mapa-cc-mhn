import type { ColumnDef, SortingState } from '@tanstack/react-table'
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { ArrowUpDown, Crosshair, Download, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { downloadCsv, recordsToCsv, recordsToDarwinCoreCsv } from '@/lib/exportCsv'
import type { OccurrenceRecord } from '@/types'

interface ResultsTableProps {
  records: OccurrenceRecord[]
  quickSearch: string
  onQuickSearchChange: (value: string) => void
  onLocate: (record: OccurrenceRecord) => void
}

export function ResultsTable({ records, quickSearch, onQuickSearchChange, onLocate }: ResultsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const columns = useMemo<ColumnDef<OccurrenceRecord>[]>(
    () => [
      {
        id: 'locate',
        header: () => <span className="sr-only">Ver no mapa</span>,
        cell: ({ row }) => (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            disabled={row.original.latitude === null}
            onClick={() => onLocate(row.original)}
            aria-label={`Ver ${row.original.code || 'lote'} no mapa`}
            title={row.original.latitude === null ? 'Sem posição' : 'Ver no mapa'}
          >
            <Crosshair />
          </Button>
        ),
      },
      {
        accessorKey: 'code',
        header: ({ column }) => <SortableHeader label="Código" onClick={() => column.toggleSorting()} />,
      },
      {
        accessorKey: 'dateText',
        header: ({ column }) => <SortableHeader label="Data" onClick={() => column.toggleSorting()} />,
        sortingFn: (a, b) => {
          const left = a.original.date?.getTime() ?? 0
          const right = b.original.date?.getTime() ?? 0
          return left - right
        },
      },
      {
        accessorKey: 'family',
        header: ({ column }) => <SortableHeader label="Família" onClick={() => column.toggleSorting()} />,
      },
      {
        accessorKey: 'species',
        header: ({ column }) => <SortableHeader label="Espécie" onClick={() => column.toggleSorting()} />,
        cell: ({ row }) => <span className="block min-w-48">{row.original.species}</span>,
      },
      {
        accessorKey: 'local',
        header: ({ column }) => <SortableHeader label="Local" onClick={() => column.toggleSorting()} />,
      },
      {
        accessorKey: 'coordinatesText',
        header: 'Coordenadas',
        cell: ({ row }) => row.original.coordinatesText || <span className="text-muted-foreground">Por local</span>,
      },
      {
        accessorKey: 'positionSource',
        header: 'Origem',
        cell: ({ row }) => <PositionBadge record={row.original} />,
      },
      {
        accessorKey: 'observation',
        header: 'Observação',
        cell: ({ row }) => <span className="block min-w-56">{row.original.observation}</span>,
      },
    ],
    [onLocate],
  )
  const table = useReactTable({
    data: records,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    // Todos os lotes filtrados numa lista que rola, com o cabeçalho fixo (a planilha já está toda na memória).
    // shortcut: desenha todas as linhas; com milhares de lotes pode ficar lento, aí vale virtualizar a lista.
    <Card className="flex flex-col xl:h-full">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="sr-only">Tabela de resultados</CardTitle>
          <div className="flex flex-1 flex-wrap gap-2">
            <div className="relative min-w-48 flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={quickSearch}
                onChange={(event) => onQuickSearchChange(event.target.value)}
                placeholder="Busca rápida"
                className="pl-9"
              />
            </div>
            <Button type="button" variant="outline" onClick={() => downloadCsv(recordsToCsv(records))} disabled={records.length === 0}>
              <Download />
              CSV
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => downloadCsv(recordsToDarwinCoreCsv(records), 'ocorrencias-darwin-core.csv')}
              disabled={records.length === 0}
              title="Padrão usado por GBIF e SiBBr"
            >
              <Download />
              Darwin Core
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-hidden rounded-md border">
          <Table containerClassName="max-h-[70svh] xl:h-full xl:max-h-none">
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="sticky top-0 z-10 bg-card">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-28 text-center text-muted-foreground">
                    Nenhum registro encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

      </CardContent>
    </Card>
  )
}

function SortableHeader({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" size="sm" className="-ml-3" onClick={onClick}>
      {label}
      <ArrowUpDown />
    </Button>
  )
}

function PositionBadge({ record }: { record: OccurrenceRecord }) {
  if (record.positionSource === 'coordinates') {
    return <Badge variant="secondary">Coordenadas</Badge>
  }

  if (record.positionSource === 'local_fallback') {
    return <Badge variant="warning">{record.positionLabel}</Badge>
  }

  return <Badge variant="outline">Sem posição</Badge>
}
