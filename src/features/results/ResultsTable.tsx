import type { ColumnDef, PaginationState, SortingState } from '@tanstack/react-table'
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { ArrowUpDown, ChevronLeft, ChevronRight, Download, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { downloadCsv, recordsToCsv, recordsToDarwinCoreCsv } from '@/lib/exportCsv'
import type { OccurrenceRecord } from '@/types'

interface ResultsTableProps {
  records: OccurrenceRecord[]
  quickSearch: string
  onQuickSearchChange: (value: string) => void
}

export function ResultsTable({ records, quickSearch, onQuickSearchChange }: ResultsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })
  const columns = useMemo<ColumnDef<OccurrenceRecord>[]>(
    () => [
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
    [],
  )
  const table = useReactTable({
    data: records,
    columns,
    state: {
      sorting,
      pagination,
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle className="text-base">Tabela de resultados</CardTitle>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-64">
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
      <CardContent className="grid gap-3">
        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
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

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            Página {table.getState().pagination.pageIndex + 1} de {Math.max(table.getPageCount(), 1)}
          </div>
          <div className="flex items-center gap-2">
            <Select
              aria-label="Registros por página"
              value={String(table.getState().pagination.pageSize)}
              onChange={(event) => table.setPageSize(Number(event.target.value))}
              className="w-24"
            >
              {[10, 25, 50].map((pageSize) => (
                <option key={pageSize} value={pageSize}>
                  {pageSize}
                </option>
              ))}
            </Select>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label="Página anterior"
            >
              <ChevronLeft />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label="Próxima página"
            >
              <ChevronRight />
            </Button>
          </div>
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
