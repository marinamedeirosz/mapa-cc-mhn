import { Download, Trash2, Upload } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { municipalityInteriorPoint } from '@/lib/municipalityAggregation'
import type { MunicipalityFeatureCollection } from '@/lib/municipalityAggregation'
import { listUnresolvedLocals, parseLocalMappings, upsertLocalMapping, type LocalMapping } from '@/lib/localMappings'
import { downloadBlob } from '@/lib/utils'
import type { OccurrenceRecord } from '@/types'

interface LocalMappingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  records: OccurrenceRecord[]
  mappings: LocalMapping[]
  onChange: (mappings: LocalMapping[]) => void
  geojson: MunicipalityFeatureCollection | null
}

export function LocalMappingsDialog({ open, onOpenChange, records, mappings, onChange, geojson }: LocalMappingsDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileError, setFileError] = useState('')
  const unresolved = useMemo(() => listUnresolvedLocals(records), [records])
  const municipalities = useMemo(
    () => [...(geojson?.features ?? [])].sort((a, b) => a.properties.name.localeCompare(b.properties.name, 'pt-BR')),
    [geojson],
  )

  function assign(local: string, municipalityName: string) {
    const feature = municipalities.find((item) => item.properties.name === municipalityName)
    if (!feature) return

    onChange(upsertLocalMapping(mappings, { local, municipality: municipalityName, ...municipalityInteriorPoint(feature) }))
  }

  function handleExport() {
    const json = JSON.stringify(mappings, null, 2)
    downloadBlob(new Blob([json], { type: 'application/json' }), 'locais-curadoria-mapa-cc-mhn.json')
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      const imported = parseLocalMappings(JSON.parse(await file.text()))
      onChange(imported.reduce(upsertLocalMapping, mappings))
      setFileError('')
    } catch (error) {
      setFileError(
        error instanceof SyntaxError
          ? 'O arquivo não é um JSON válido.'
          : error instanceof Error
            ? error.message
            : 'Não foi possível ler o arquivo.',
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Locais sem posição</DialogTitle>
          <DialogDescription>
            Ligue cada local a um município para que seus lotes entrem no mapa, na posição aproximada do município.
            Fica salvo neste navegador; exporte o arquivo para compartilhar com a equipe.
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[62svh] gap-4 overflow-auto pr-1">
          <section className="grid gap-2">
            <h3 className="text-sm font-medium">Pendentes ({unresolved.length})</h3>
            {!geojson ? (
              <p className="text-sm text-muted-foreground">Carregando a lista de municípios...</p>
            ) : unresolved.length === 0 ? (
              <p className="rounded-md border p-3 text-sm text-muted-foreground">Todos os locais desta planilha têm posição.</p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Local na planilha</TableHead>
                      <TableHead className="w-20">Lotes</TableHead>
                      <TableHead className="w-56">Município</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unresolved.map(({ local, count }) => (
                      <TableRow key={local}>
                        <TableCell>{local}</TableCell>
                        <TableCell>{count}</TableCell>
                        <TableCell>
                          <Select
                            aria-label={`Município de ${local}`}
                            value=""
                            onChange={(event) => assign(local, event.target.value)}
                          >
                            <option value="" disabled>
                              Escolher...
                            </option>
                            {municipalities.map((feature) => (
                              <option key={feature.properties.name} value={feature.properties.name}>
                                {feature.properties.name}
                              </option>
                            ))}
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>

          <section className="grid gap-2">
            <h3 className="text-sm font-medium">Definidos pela curadoria ({mappings.length})</h3>
            {mappings.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum local definido ainda.</p>
            ) : (
              <ul className="grid gap-1 rounded-md border p-2 text-sm">
                {[...mappings]
                  .sort((a, b) => a.local.localeCompare(b.local, 'pt-BR'))
                  .map((mapping) => (
                    <li key={mapping.local} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate">
                        {mapping.local} → <strong>{mapping.municipality}</strong>
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label={`Remover ${mapping.local}`}
                        onClick={() => onChange(mappings.filter((item) => item !== mapping))}
                      >
                        <Trash2 />
                      </Button>
                    </li>
                  ))}
              </ul>
            )}
          </section>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleExport} disabled={mappings.length === 0}>
            <Download />
            Exportar locais (JSON)
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload />
            Importar locais (JSON)
          </Button>
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={handleImport} />
          {fileError ? <span className="text-sm text-destructive">{fileError}</span> : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
