import { Eraser, Search, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { MultiSelectFilter } from '@/components/MultiSelectFilter'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { formatDate, parseDateInput } from '@/lib/dates'
import { hasActiveFilters } from '@/lib/filtering'
import type { FilterOptions, Filters } from '@/types'

interface FiltersPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  totalCount: number
  filters: Filters
  options: FilterOptions
  resultCount: number
  undatedOutsidePeriod: number
  onChange: (filters: Filters) => void
  onClear: () => void
}

// Gaveta lateral: o diálogo do app, encostado à esquerda e com a altura da tela.
export function FiltersPanel({
  open,
  onOpenChange,
  totalCount,
  filters,
  options,
  resultCount,
  undatedOutsidePeriod,
  onChange,
  onClear,
}: FiltersPanelProps) {
  const chips = activeChips(filters, onChange)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="left-0 top-0 flex h-svh max-h-svh w-[min(400px,100vw)] translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-y-0 border-l-0 p-0 duration-300 ease-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left">
        <DialogHeader className="gap-2 border-b px-5 py-4">
          <DialogTitle>Filtros</DialogTitle>
          <DialogDescription>
            <strong className="text-foreground">{resultCount}</strong> de {totalCount} lotes
          </DialogDescription>
          {chips.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {chips.map((chip) => (
                <span key={chip.label} className="inline-flex max-w-full items-center gap-1 rounded-full bg-primary/10 py-0.5 pl-2.5 pr-1 text-xs text-foreground">
                  <span className="truncate">{chip.label}</span>
                  <button
                    type="button"
                    className="rounded-full p-0.5 hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    aria-label={`Remover filtro ${chip.label}`}
                    onClick={chip.onRemove}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
        </DialogHeader>

        <div className="grid flex-1 content-start gap-6 overflow-auto px-5 py-5">
          <FilterSection title="Período">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <Input
                type="date"
                value={filters.dateStart}
                onChange={(event) => onChange({ ...filters, dateStart: event.target.value })}
                aria-label="Data inicial"
              />
              <span className="text-xs text-muted-foreground">até</span>
              <Input
                type="date"
                value={filters.dateEnd}
                onChange={(event) => onChange({ ...filters, dateEnd: event.target.value })}
                aria-label="Data final"
              />
            </div>
            {undatedOutsidePeriod > 0 ? (
              <p className="text-xs text-muted-foreground">{undatedOutsidePeriod} lote(s) sem data ficam fora do período.</p>
            ) : null}
          </FilterSection>

          <FilterSection title="Taxonomia">
            <MultiSelectFilter
              label="Família"
              placeholder="Todas as famílias"
              options={options.families}
              selected={filters.families}
              onChange={(families) => onChange({ ...filters, families })}
            />
            <MultiSelectFilter
              label="Espécie"
              placeholder="Todas as espécies"
              options={options.species}
              selected={filters.species}
              onChange={(species) => onChange({ ...filters, species })}
            />
          </FilterSection>

          <FilterSection title="Localização">
            <MultiSelectFilter
              label="Local"
              placeholder="Todos os locais"
              options={options.locals}
              selected={filters.locals}
              onChange={(locals) => onChange({ ...filters, locals })}
            />
            <p className="text-xs text-muted-foreground">Para filtrar por município, clique nele no mapa municipal.</p>
          </FilterSection>

          <FilterSection title="Observação">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Texto na observação"
                className="pl-9"
                value={filters.observation}
                onChange={(event) => onChange({ ...filters, observation: event.target.value })}
                placeholder="Texto na observação"
              />
            </div>
          </FilterSection>
        </div>

        <div className="flex gap-2 border-t px-5 py-4">
          <Button type="button" variant="outline" className="flex-1" onClick={onClear} disabled={!hasActiveFilters(filters)}>
            <Eraser />
            Limpar
          </Button>
          <Button type="button" className="flex-1" onClick={() => onOpenChange(false)}>
            Ver {resultCount} lotes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-2.5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}

function activeChips(filters: Filters, onChange: (filters: Filters) => void): Array<{ label: string; onRemove: () => void }> {
  const chips: Array<{ label: string; onRemove: () => void }> = []
  const start = formatDate(parseDateInput(filters.dateStart))
  const end = formatDate(parseDateInput(filters.dateEnd))

  if (filters.mapSelection) {
    chips.push({ label: `Município: ${filters.mapSelection.label}`, onRemove: () => onChange({ ...filters, mapSelection: null }) })
  }
  if (start || end) {
    chips.push({
      label: `Período: ${start || '…'} – ${end || '…'}`,
      onRemove: () => onChange({ ...filters, dateStart: '', dateEnd: '' }),
    })
  }
  for (const [key, name] of [['families', 'Família'], ['species', 'Espécie'], ['locals', 'Local']] as const) {
    if (filters[key].length > 0) {
      const values = filters[key]
      chips.push({
        label: `${name}: ${values.length === 1 ? values[0] : `${values.length} selecionados`}`,
        onRemove: () => onChange({ ...filters, [key]: [] }),
      })
    }
  }
  if (filters.observation.trim()) {
    chips.push({ label: `Observação: "${filters.observation.trim()}"`, onRemove: () => onChange({ ...filters, observation: '' }) })
  }

  return chips
}
