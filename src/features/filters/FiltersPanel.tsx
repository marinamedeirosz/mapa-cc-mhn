import { CalendarDays, Eraser, Search } from 'lucide-react'
import { MultiSelectFilter } from '@/components/MultiSelectFilter'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { hasActiveFilters } from '@/lib/filtering'
import type { FilterOptions, Filters } from '@/types'

interface FiltersPanelProps {
  filters: Filters
  options: FilterOptions
  resultCount: number
  undatedOutsidePeriod: number
  onChange: (filters: Filters) => void
  onClear: () => void
}

export function FiltersPanel({
  filters,
  options,
  resultCount,
  undatedOutsidePeriod,
  onChange,
  onClear,
}: FiltersPanelProps) {
  const active = hasActiveFilters(filters)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3 text-base">
          <span className="flex items-center gap-2">
            <Search className="size-4" />
            Filtros
          </span>
          <span className="text-xs font-normal text-muted-foreground">{resultCount} encontrados</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <Label className="flex items-center gap-2">
            <CalendarDays className="size-4" />
            Período
          </Label>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="date"
              value={filters.dateStart}
              onChange={(event) => onChange({ ...filters, dateStart: event.target.value })}
              aria-label="Data inicial"
            />
            <Input
              type="date"
              value={filters.dateEnd}
              onChange={(event) => onChange({ ...filters, dateEnd: event.target.value })}
              aria-label="Data final"
            />
          </div>
          {undatedOutsidePeriod > 0 ? (
            <p className="text-xs text-muted-foreground">
              {undatedOutsidePeriod} lote(s) sem data ficam fora do período.
            </p>
          ) : null}
        </div>

        <MultiSelectFilter
          label="Família"
          options={options.families}
          selected={filters.families}
          onChange={(families) => onChange({ ...filters, families })}
        />
        <MultiSelectFilter
          label="Espécie"
          options={options.species}
          selected={filters.species}
          onChange={(species) => onChange({ ...filters, species })}
        />
        <MultiSelectFilter
          label="Local"
          options={options.locals}
          selected={filters.locals}
          onChange={(locals) => onChange({ ...filters, locals })}
        />

        <div className="grid gap-2">
          <Label htmlFor="observation-filter">Observação</Label>
          <Input
            id="observation-filter"
            value={filters.observation}
            onChange={(event) => onChange({ ...filters, observation: event.target.value })}
            placeholder="Ponto x"
          />
        </div>

        <Button type="button" variant="outline" onClick={onClear} disabled={!active}>
          <Eraser />
          Limpar filtros
        </Button>
      </CardContent>
    </Card>
  )
}
