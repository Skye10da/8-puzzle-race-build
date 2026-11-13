import { useLayoutEffect, useRef } from 'react'
import { Pause, Trophy } from 'lucide-react'
import type { Player, RoundState } from '@/lib/game-types'
import { formatTime } from '@/lib/format-time'

type Props = { board: string; round: RoundState; count: number; elapsed: number; moves: number; paused: boolean; player: Player | null; winner: Player | null; newBest: boolean; onMove: (index: number) => void }

export function RaceBoard({ board, round, count, elapsed, moves, paused, player, winner, newBest, onMove }: Props) {
  const tileElements = useRef(new Map<string, HTMLButtonElement>())
  const previousPositions = useRef(new Map<string, { left: number; top: number }>())
  useLayoutEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const positions = new Map<string, { left: number; top: number }>()
    for (const number of board) {
      const element = tileElements.current.get(number)
      if (!element) continue
      const left = element.offsetLeft
      const top = element.offsetTop
      const previous = previousPositions.current.get(number)
      if (previous && !reduceMotion && (previous.left !== left || previous.top !== top)) {
        element.style.transition = 'none'
        element.style.transform = `translate(${previous.left - left}px, ${previous.top - top}px)`
        void element.offsetWidth
        requestAnimationFrame(() => {
          element.style.transition = 'transform 150ms ease'
          element.style.transform = 'translate(0, 0)'
        })
      }
      positions.set(number, { left, top })
    }
    previousPositions.current = positions
  }, [board])
  return <>{winner && round !== 'finished' && <div className="first-finisher-banner" role="status" aria-live="polite">{winner.name} finished first in {formatTime(winner.doneMs ?? 0)}</div>}<section className="race-status">{round === 'countdown' ? <><span className="count-number">{count || 'GO'}</span><span>Get your fingers ready</span></> : round === 'finished' ? <><Trophy size={22} /><span>{player?.doneMs ? `Finished in ${formatTime(player.doneMs)}` : 'Race over'}</span></> : <><span className="live-dot" /><span>{formatTime(elapsed)}</span><span className="move-count">{moves} moves</span></>}</section>{paused && <div className="paused-banner"><Pause size={16} /> Game paused</div>}<section className={`puzzle-wrap ${round === 'finished' ? 'winner-celebration' : ''}`}>{round === 'finished' && <div className="winner-burst" aria-live="polite">🏆 You solved it! {newBest && 'New best!'}</div>}<div className="board" role="group" aria-label="Sliding puzzle board">{board.split('').map((number, index) => <button key={number} ref={element => { if (element) tileElements.current.set(number, element); else tileElements.current.delete(number) }} className={`tile ${number === '0' ? 'gap' : number === String(index + 1) ? 'correct' : ''}`} onClick={() => onMove(index)} aria-label={number === '0' ? 'Empty space' : `Tile ${number}${number === String(index + 1) ? ', correct position' : ''}`}>{number !== '0' && number}</button>)}</div><p className="hint">Tap a tile next to the gap · Arrow keys work too</p></section></>
}
