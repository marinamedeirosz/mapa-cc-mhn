import type { KeyboardEvent, PointerEvent, RefObject } from 'react'
import { clampSplit, defaultSplit, maxSplit, minSplit } from '@/lib/columnSplit'

interface ColumnSplitterProps {
  containerRef: RefObject<HTMLElement | null>
  value: number
  onChange: (value: number) => void
}

// Alça entre duas colunas, como a divisória de colunas do Excel: arrastar, setas do teclado ou dois cliques.
export function ColumnSplitter({ containerRef, value, onChange }: ColumnSplitterProps) {
  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    const container = containerRef.current
    if (!container) return

    event.preventDefault()
    // Mede só a área de conteúdo da grade (sem o padding), que é a base das porcentagens das colunas.
    const box = container.getBoundingClientRect()
    const style = getComputedStyle(container)
    const left = box.left + parseFloat(style.paddingLeft)
    const width = box.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
    const separator = event.currentTarget
    let current = value
    let frame = 0

    // Durante o arrasto só a variável CSS da grade muda (um quadro por vez): atualizar o estado do app a cada
    // pixel redesenhava mapa, tabela e gráficos e travava (medido: ~270 ms por quadro no modo Pontos).
    const move = (moveEvent: globalThis.PointerEvent) => {
      current = clampSplit((moveEvent.clientX - left) / width)
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        container.style.setProperty('--split', `${current * 100}%`)
        separator.setAttribute('aria-valuenow', String(Math.round(current * 100)))
      })
    }
    const stop = () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      document.body.style.removeProperty('user-select')
      onChange(current)
    }

    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 0.1 : 0.02
    if (event.key === 'ArrowLeft') onChange(clampSplit(value - step))
    else if (event.key === 'ArrowRight') onChange(clampSplit(value + step))
    else if (event.key === 'Home') onChange(minSplit)
    else if (event.key === 'End') onChange(maxSplit)
    else return
    event.preventDefault()
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Ajustar a largura do mapa e da listagem"
      aria-valuemin={Math.round(minSplit * 100)}
      aria-valuemax={Math.round(maxSplit * 100)}
      aria-valuenow={Math.round(value * 100)}
      title="Arraste para ajustar a largura. Dois cliques voltam ao padrão."
      tabIndex={0}
      className="group hidden w-3 cursor-col-resize touch-none justify-center rounded focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 xl:flex"
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
      onDoubleClick={() => onChange(defaultSplit)}
    >
      <span className="w-0.5 rounded-full bg-border transition-colors group-hover:bg-primary group-active:bg-primary" />
    </div>
  )
}
