import { BarChart3, MapPin, Network, Sigma } from 'lucide-react'
import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { DistributionItem, StatsSummary } from '@/types'

interface StatsPanelProps {
  stats: StatsSummary
}

export function StatsPanel({ stats }: StatsPanelProps) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Registros" value={stats.totalRecords} icon={<Sigma />} />
        <StatCard label="Famílias" value={stats.totalFamilies} icon={<Network />} />
        <StatCard label="Espécies" value={stats.totalSpecies} icon={<BarChart3 />} />
        <StatCard label="Locais" value={stats.totalLocals} icon={<MapPin />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <DistributionCard title="Registros por família" items={stats.byFamily} />
        <DistributionCard title="Registros por espécie" items={stats.bySpecies} />
        <DistributionCard title="Registros por local" items={stats.byLocal} />
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

function DistributionCard({ title, items }: { title: string; items: DistributionItem[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid max-h-64 gap-2 overflow-auto">
        {items.length === 0 ? (
          <span className="text-sm text-muted-foreground">Sem dados.</span>
        ) : (
          items.slice(0, 12).map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{item.label}</span>
              <Badge variant="secondary">{item.count}</Badge>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
