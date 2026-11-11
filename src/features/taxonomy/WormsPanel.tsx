import { BookCheck, ExternalLink } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { uniqueSorted } from '@/lib/text'
import { checkNamesInWorms, type WormsCheck, type WormsStatus } from '@/lib/worms'
import type { OccurrenceRecord } from '@/types'

const statusInfo: Record<WormsStatus, { label: string; variant: 'secondary' | 'warning' | 'outline'; order: number }> = {
  spelling: { label: 'Grafia diferente', variant: 'warning', order: 0 },
  synonym: { label: 'Nome não aceito', variant: 'warning', order: 1 },
  not_found: { label: 'Não encontrado', variant: 'outline', order: 2 },
  accepted: { label: 'Aceito', variant: 'secondary', order: 3 },
}

export function WormsPanel({ records }: { records: OccurrenceRecord[] }) {
  const names = useMemo(() => uniqueSorted(records.map((record) => record.species)), [records])
  const namesKey = names.join('|')
  const [checked, setChecked] = useState<{ key: string; results: WormsCheck[] } | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [error, setError] = useState('')
  // Resultado de outra planilha (ou de outra lista de nomes) não vale para a atual.
  const results = checked?.key === namesKey ? checked.results : null

  async function handleCheck() {
    setIsChecking(true)
    setError('')
    try {
      const checks = await checkNamesInWorms(names)
      setChecked({
        key: namesKey,
        results: checks.sort((a, b) => statusInfo[a.status].order - statusInfo[b.status].order || a.name.localeCompare(b.name, 'pt-BR')),
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível consultar o WoRMS.')
    } finally {
      setIsChecking(false)
    }
  }

  if (names.length === 0) return null

  const counts = (results ?? []).reduce<Partial<Record<WormsStatus, number>>>((acc, result) => {
    acc[result.status] = (acc[result.status] ?? 0) + 1
    return acc
  }, {})

  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookCheck className="size-4" />
            Nomes científicos no WoRMS
          </CardTitle>
          <Button type="button" variant="outline" onClick={handleCheck} disabled={isChecking}>
            {isChecking ? 'Consultando...' : `Conferir ${names.length} nome(s)`}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Compara as espécies da planilha com o World Register of Marine Species. Só os nomes das espécies são
          enviados ao site marinespecies.org, e só quando você clica em conferir. Nomes com "sp." são conferidos
          pelo gênero.
        </p>
      </CardHeader>
      {error || results ? (
        <CardContent className="grid gap-3">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {results ? (
            <>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(statusInfo) as WormsStatus[]).map((status) =>
                  counts[status] ? (
                    <Badge key={status} variant={statusInfo[status].variant}>
                      {statusInfo[status].label}: {counts[status]}
                    </Badge>
                  ) : null,
                )}
              </div>
              <div className="max-h-96 overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome na planilha</TableHead>
                      <TableHead>Situação</TableHead>
                      <TableHead>Sugestão do WoRMS</TableHead>
                      <TableHead className="w-12">
                        <span className="sr-only">Link</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((result) => (
                      <TableRow key={result.name}>
                        <TableCell className="italic">{result.name}</TableCell>
                        <TableCell>
                          <Badge variant={statusInfo[result.status].variant}>{statusInfo[result.status].label}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{suggestion(result)}</TableCell>
                        <TableCell>
                          {result.url ? (
                            <a
                              href={result.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex text-muted-foreground hover:text-foreground"
                              aria-label={`Abrir ${result.matchedName ?? result.name} no WoRMS`}
                            >
                              <ExternalLink className="size-4" />
                            </a>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  )
}

function suggestion(result: WormsCheck): string {
  if (result.status === 'spelling') {
    const valid = result.validName && result.validName !== result.matchedName ? ` (nome aceito: ${result.validName})` : ''
    return `Você quis dizer ${result.matchedName}?${valid}`
  }

  if (result.status === 'synonym') {
    return `Use ${result.validName ?? '-'} (${result.wormsStatus})`
  }

  return result.status === 'not_found' ? 'Confira a grafia ou se é espécie marinha' : '-'
}
