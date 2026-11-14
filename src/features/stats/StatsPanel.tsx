import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { normalizeText } from '@/lib/text'
import { cn } from '@/lib/utils'
import type { DistributionItem, Filters, StatsSummary, YearCount } from '@/types'

export type DistributionFilterKey = 'families' | 'species' | 'locals'

interface StatsPanelProps {
  stats: StatsSummary
  filters: Filters
  onSelect: (key: DistributionFilterKey, label: string) => void
}

export function StatsPanel({ stats, filters, onSelect }: StatsPanelProps) {
  return (
    <div className="grid gap-4">
      <DistributionCard title="Registros por família" items={stats.byFamily} selected={filters.families} onSelect={(label) => onSelect('families', label)} />
      <DistributionCard title="Registros por espécie" items={stats.bySpecies} selected={filters.species} onSelect={(label) => onSelect('species', label)} />
      <DistributionCard title="Registros por local" items={stats.byLocal} selected={filters.locals} onSelect={(label) => onSelect('locals', label)} />
    </div>
  )
}

// Um ano está "selecionado" quando o período cobre exatamente 1º/jan a 31/dez dele.
function selectedYear(filters: Filters): number | null {
  const match = filters.dateStart.match(/^(\d{4})-01-01$/)
  return match && filters.dateEnd === `${match[1]}-12-31` ? Number(match[1]) : null
}

export function YearTimelineCard({
  years,
  undated,
  filters,
  onSelect,
}: {
  years: YearCount[]
  undated: number
  filters: Filters
  onSelect: (year: number) => void
}) {
  const selected = selectedYear(filters)
  const max = Math.max(0, ...years.map((item) => item.count))
  const emptyYears = years.filter((item) => item.count === 0).length
  // Uns 8 rótulos no eixo, em anos "redondos" (de 1, 2, 5 ou 10 em 10).
  const step = [1, 2, 5, 10, 20, 50].find((candidate) => years.length / candidate <= 8) ?? 100
  const columns = { gridTemplateColumns: `repeat(${years.length}, minmax(0, 1fr))` }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
          Lotes por ano de coleta
          <span className="font-normal text-muted-foreground">
            {[emptyYears > 0 && `${emptyYears} ano(s) sem coleta`, undated > 0 && `${undated} lote(s) sem data`]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {years.length === 0 ? (
          <span className="text-sm text-muted-foreground">Sem datas para mostrar.</span>
        ) : (
          <div className="grid gap-1">
            <div className="text-xs text-muted-foreground">máx. {max}</div>
            <div className="grid h-16 items-stretch gap-[2px] border-b" style={columns}>
              {years.map(({ year, count }) => {
                const isSelected = year === selected

                return (
                  <button
                    key={year}
                    type="button"
                    aria-pressed={isSelected}
                    aria-label={`${year}: ${count} lote(s)`}
                    className="group relative flex items-end justify-center focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    onClick={() => onSelect(year)}
                  >
                    <span
                      className={cn(
                        'w-full max-w-6 rounded-t-[4px] bg-primary/70 transition-colors group-hover:bg-primary',
                        isSelected && 'bg-primary',
                        selected !== null && !isSelected && 'bg-primary/25',
                      )}
                      style={{ height: count > 0 ? `${Math.max((count / max) * 100, 4)}%` : 0 }}
                    />
                    <span className="pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md group-hover:block group-focus-visible:block">
                      {year}: {count} lote(s)
                    </span>
                  </button>
                )
              })}
            </div>
            <div className="grid text-xs text-muted-foreground" style={columns} aria-hidden="true">
              {years.map(({ year }) => (
                <span key={year} className="flex justify-center overflow-visible whitespace-nowrap">
                  {year % step === 0 ? year : ''}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function DistributionCard({
  title,
  items,
  selected,
  onSelect,
}: {
  title: string
  items: DistributionItem[]
  selected: string[]
  onSelect: (label: string) => void
}) {
  const selectedSet = new Set(selected.map(normalizeText))

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-sm">
          {title}
          {items.length > 0 ? <span className="font-normal text-muted-foreground">{items.length}</span> : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid max-h-64 gap-1 overflow-auto">
        {items.length === 0 ? (
          <span className="text-sm text-muted-foreground">Sem dados.</span>
        ) : (
          items.map((item) => {
            const isSelected = selectedSet.has(normalizeText(item.label))

            return (
              <button
                key={item.label}
                type="button"
                aria-pressed={isSelected}
                title={isSelected ? 'Remover filtro' : 'Filtrar por este item'}
                className={cn(
                  'flex items-center justify-between gap-3 rounded-md px-2 py-1 text-left text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                  isSelected && 'bg-secondary font-medium',
                )}
                onClick={() => onSelect(item.label)}
              >
                <span className="min-w-0 truncate">{item.label}</span>
                <Badge variant={isSelected ? 'default' : 'secondary'}>{item.count}</Badge>
              </button>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
