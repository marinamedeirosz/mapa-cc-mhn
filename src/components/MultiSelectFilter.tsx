import { Check, ChevronDown, Eraser, ListChecks } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { normalizeText } from '@/lib/text'
import { cn } from '@/lib/utils'

interface MultiSelectFilterProps {
  label: string
  placeholder?: string
  options: string[]
  selected: string[]
  onChange: (values: string[]) => void
}

export function MultiSelectFilter({ label, placeholder = 'Todos', options, selected, onChange }: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false)
  const selectedSet = useMemo(() => new Set(selected.map((value) => normalizeText(value))), [selected])
  const visible = selected.slice(0, 2)
  const hidden = selected.length - visible.length

  function toggleOption(option: string) {
    const normalizedOption = normalizeText(option)

    if (selectedSet.has(normalizedOption)) {
      onChange(selected.filter((value) => normalizeText(value) !== normalizedOption))
      return
    }

    onChange([...selected, option])
  }

  return (
    <div className="grid gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            aria-label={`${label}: ${selected.length === 0 ? placeholder : selected.join(', ')}`}
            className={cn('h-auto min-h-9 w-full justify-between px-3 py-1.5 font-normal', selected.length > 0 && 'border-primary/60')}
          >
            {selected.length === 0 ? (
              <span className="truncate text-muted-foreground">{placeholder}</span>
            ) : (
              <span className="flex min-w-0 flex-wrap gap-1">
                {visible.map((value) => (
                  <span key={value} className="max-w-40 truncate rounded bg-primary/10 px-1.5 py-0.5 text-xs">
                    {value}
                  </span>
                ))}
                {hidden > 0 ? <span className="rounded bg-muted px-1.5 py-0.5 text-xs">+{hidden}</span> : null}
              </span>
            )}
            <ChevronDown className="ml-2 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-64">
          <Command>
            <CommandInput placeholder={`Buscar ${label.toLowerCase()}`} />
            <div className="flex gap-2 border-b p-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="flex-1"
                onClick={() => onChange(options)}
                disabled={options.length === 0}
              >
                <ListChecks />
                Todos
              </Button>
              <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => onChange([])}>
                <Eraser />
                Limpar
              </Button>
            </div>
            <CommandList>
              <CommandEmpty>Nenhuma opção encontrada.</CommandEmpty>
              <CommandGroup>
                {options.map((option) => {
                  const checked = selectedSet.has(normalizeText(option))

                  return (
                    <CommandItem key={option} value={option} onSelect={() => toggleOption(option)}>
                      <Checkbox checked={checked} aria-label={option} />
                      <span className="min-w-0 flex-1 truncate">{option}</span>
                      <Check className={cn('opacity-0', checked && 'opacity-100')} />
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
