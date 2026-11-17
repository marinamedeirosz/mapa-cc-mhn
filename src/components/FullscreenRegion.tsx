import { Maximize2, Minimize2 } from 'lucide-react'
import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const FullscreenContext = createContext<{ title: string; expanded: boolean; toggle: () => void } | null>(null)

// A própria região "salta" para ocupar quase toda a tela, como um modal, em vez de ser recriada dentro de um:
// assim mapa, tabela e abas mantêm zoom, ordenação, rolagem e filtros. Os filhos ajustam o tamanho com a
// variante group-data-[expanded=true]/fullscreen: do Tailwind.
export function FullscreenRegion({ title, className, children }: { title: string; className?: string; children: ReactNode }) {
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!expanded) return

    const onKeyDown = (event: KeyboardEvent) => {
      // Esc fecha primeiro um diálogo ou menu aberto por cima (eles também têm role="dialog").
      if (event.key === 'Escape' && !document.querySelector('[role=dialog][data-state=open]')) setExpanded(false)
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.removeProperty('overflow')
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [expanded])

  return (
    <FullscreenContext.Provider value={{ title, expanded, toggle: () => setExpanded((value) => !value) }}>
      {expanded ? (
        <div className="fixed inset-0 z-[800] bg-black/40 animate-in fade-in-0" onClick={() => setExpanded(false)} aria-hidden="true" />
      ) : null}
      <div
        data-expanded={expanded}
        role={expanded ? 'dialog' : undefined}
        aria-modal={expanded || undefined}
        aria-label={expanded ? title : undefined}
        className={cn(
          'group/fullscreen min-w-0',
          className,
          expanded && 'fixed inset-3 z-[810] flex flex-col overflow-auto rounded-xl bg-background p-3 shadow-2xl animate-in fade-in-0 zoom-in-95 sm:inset-6',
        )}
      >
        {children}
      </div>
    </FullscreenContext.Provider>
  )
}

export function FullscreenButton({ className }: { className?: string }) {
  const context = useContext(FullscreenContext)
  if (!context) return null

  const label = context.expanded ? `Sair da tela cheia: ${context.title}` : `Tela cheia: ${context.title}`
  return (
    <Button type="button" variant="ghost" size="icon" className={cn('size-8 shrink-0', className)} aria-label={label} title={label} onClick={context.toggle}>
      {context.expanded ? <Minimize2 /> : <Maximize2 />}
    </Button>
  )
}
