import { BarChart3, MapPin, Network, Sigma } from 'lucide-react'
import type { ReactNode } from 'react'
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
  years: YearCount[]
  undatedRecords: number
  onSelectYear: (year: number) => void
}

export function StatsPanel({ stats, filters, onSelect, years, undatedRecords, onSelectYear }: StatsPanelProps) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Registros" value={stats.totalRecords} icon={<Sigma />} />
        <StatCard label="Famílias" value={stats.totalFamilies} icon={<Network />} />
        <StatCard label="Espécies" value={stats.totalSpecies} icon={<BarChart3 />} />
        <StatCard label="Locais" value={stats.totalLocals} icon={<MapPin />} />
      </div>

      <YearTimelineCard
        years={years}
        undated={undatedRecords}
        selectedYear={selectedYear(filters)}
        onSelect={onSelectYear}
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <DistributionCard title="Registros por família" items={stats.byFamily} selected={filters.families} onSelect={(label) => onSelect('families', label)} />
        <DistributionCard title="Registros por espécie" items={stats.bySpecies} selected={filters.species} onSelect={(label) => onSelect('species', label)} />
        <DistributionCard title="Registros por local" items={stats.byLocal} selected={filters.locals} onSelect={(label) => onSelect('locals', label)} />
      </div>
    </div>
  )
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <div className="text-2xl font-semibold">{value}</div>
          <div className="text-sm text-muted-foreground">{label}</div>
        </div>
        <div className="rounded-md bg-secondary p-2 text-primary [&_svg]:size-5">{icon}</div>
      </CardContent>
    </Card>
  )
}

// Um ano está "selecionado" quando o período cobre exatamente 1º/jan a 31/dez dele.
function selectedYear(filters: Filters): number | null {
  const match = filters.dateStart.match(/^(\d{4})-01-01$/)
  return match && filters.dateEnd === `${match[1]}-12-31` ? Number(match[1]) : null
}

function YearTimelineCard({
  years,
  undated,
  selectedYear,
  onSelect,
}: {
  years: YearCount[]
  undated: number
  selectedYear: number | null
  onSelect: (year: number) => void
}) {
  const max = Math.max(0, ...years.map((item) => item.count))
  const emptyYears = years.filter((item) => item.count === 0).length

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
            <div className="flex h-28 items-stretch gap-[2px] border-b">
              {years.map(({ year, count }) => {
                const isSelected = year === selectedYear

                return (
                  <button
                    key={year}
                    type="button"
                    aria-pressed={isSelected}
                    aria-label={`${year}: ${count} lote(s)`}
                    className="group relative flex min-w-[3px] max-w-6 flex-1 items-end justify-center focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    onClick={() => onSelect(year)}
                  >
                    <span
                      className={cn(
                        'w-full rounded-t-[4px] bg-primary/70 transition-colors group-hover:bg-primary',
                        isSelected && 'bg-primary',
                        selectedYear !== null && !isSelected && 'bg-primary/25',
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
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{years[0].year}</span>
              <span>{years[years.length - 1].year}</span>
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
