import { SlidersHorizontal } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface SummaryBarProps {
  totalRecords: number
  filteredCount: number
  activeFilterCount: number
  positionedCount: number
  unresolved: number
  issues: number
  families: number
  species: number
  locals: number
  onOpenFilters: () => void
  onOpenLocals: () => void
  onOpenIssues: () => void
}

export function SummaryBar(props: SummaryBarProps) {
  return (
    <section aria-label="Indicadores" className="border-b bg-card">
      <div className="mx-auto flex max-w-[1600px] gap-2 overflow-x-auto px-4 py-3">
        <Kpi
          tone="primary"
          value={
            <span className="flex items-center gap-1.5">
              <SlidersHorizontal className="size-4" />
              Filtros{props.activeFilterCount > 0 ? ` (${props.activeFilterCount})` : ''}
            </span>
          }
          label={`${props.filteredCount} de ${props.totalRecords} lotes`}
          onClick={props.onOpenFilters}
        />
        <Kpi value={props.totalRecords} label="registros" />
        <Kpi value={props.positionedCount} label="no mapa" />
        <Kpi
          tone={props.unresolved > 0 ? 'warning' : 'default'}
          value={props.unresolved}
          label={props.unresolved > 0 ? 'sem posição · resolver' : 'sem posição · locais'}
          onClick={props.onOpenLocals}
        />
        <Kpi
          tone={props.issues > 0 ? 'warning' : 'default'}
          value={props.issues}
          label="avisos da importação"
          onClick={props.issues > 0 ? props.onOpenIssues : undefined}
        />
        <Kpi value={props.families} label="famílias" />
        <Kpi value={props.species} label="espécies" />
        <Kpi value={props.locals} label="locais" />
      </div>
    </section>
  )
}

function Kpi({
  value,
  label,
  tone = 'default',
  onClick,
}: {
  value: ReactNode
  label: string
  tone?: 'default' | 'primary' | 'warning'
  onClick?: () => void
}) {
  const className = cn(
    // Cresce para ocupar a faixa toda; abaixo da largura mínima a faixa rola para o lado.
    'grid min-w-28 flex-1 shrink-0 gap-0.5 rounded-lg border px-3 py-2 text-left',
    tone === 'primary' && 'border-primary bg-primary text-primary-foreground',
    tone === 'warning' && 'border-accent bg-accent/40',
    tone === 'default' && 'bg-muted/40',
    onClick && 'transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
  )
  const content = (
    <>
      <span className="text-lg font-semibold leading-tight">{value}</span>
      <span className={cn('text-xs', tone === 'primary' ? 'text-primary-foreground/80' : 'text-muted-foreground')}>{label}</span>
    </>
  )

  return onClick ? (
    <button type="button" className={className} onClick={onClick}>
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  )
}
