import { useLayoutEffect, useRef, useState } from 'react'
import { Pause, Trophy } from 'lucide-react'
import type { Player, RoundState } from '@/lib/game-types'
import { formatTime } from '@/lib/format-time'
import { getAdjustedScoreTime } from '@/lib/hints.mjs'

type Props = { board: string; round: RoundState; count: number; elapsed: number; moves: number; paused: boolean; player: Player | null; winner: Player | null; newBest: boolean; canUseHints: boolean; hintsUsed: number; hintTile: string | null; onHint: () => void; onMove: (index: number) => void }

export function RaceBoard({ board, round, count, elapsed, moves, paused, player, winner, newBest, canUseHints, hintsUsed, hintTile, onHint, onMove }: Props) {
  const boardRef = useRef<HTMLDivElement>(null)
  const [boardSize, setBoardSize] = useState(0)
  useLayoutEffect(() => {
    const element = boardRef.current
    if (!element) return
    const updateSize = () => setBoardSize(element.clientWidth)
    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const tileSize = Math.max(0, (boardSize - 38) / 3)
  return <>{winner && round !== 'finished' && <div className="first-finisher-banner" role="status" aria-live="polite">{winner.name} finished first in {formatTime(getAdjustedScoreTime(winner.doneMs ?? 0, winner.hintsUsed ?? 0))}</div>}<section className="race-status">{round === 'countdown' ? <><span className="count-number">{count || 'GO'}</span><span>Get your fingers ready</span></> : round === 'finished' ? <><Trophy size={22} /><span>{player?.doneMs ? `Finished in ${formatTime(player.doneMs)}` : 'Race over'}</span></> : <><span className="live-dot" /><span>{formatTime(elapsed)}</span><span className="move-count">{moves} moves</span></>}</section>{paused && <div className="paused-banner"><Pause size={16} /> Game paused</div>}<section className={`puzzle-wrap ${round === 'finished' ? 'winner-celebration' : ''}`}>{round === 'finished' && <div className="winner-burst" aria-live="polite">🏆 You solved it! {newBest && 'New best!'}</div>}{round === 'racing' && canUseHints && <button className="hint-action" disabled={hintsUsed >= moves} onClick={onHint}><span>Hint</span><small>{hintsUsed >= moves ? 'Make a move first' : '+10s penalty'}</small></button>}<div ref={boardRef} className={`board ${boardSize > 0 ? 'board-ready' : ''}`} role="group" aria-label="Sliding puzzle board">{board.split('').map((number, index) => <button key={number} style={{ left: 10, top: 10, width: tileSize, height: tileSize, transform: `translate(${(index % 3) * (tileSize + 9)}px, ${Math.floor(index / 3) * (tileSize + 9)}px)` }} className={`tile ${number === '0' ? 'gap' : number === String(index + 1) ? 'correct' : ''} ${number === hintTile ? 'hinted' : ''}`} onClick={() => onMove(index)} aria-label={number === '0' ? 'Empty space' : `Tile ${number}${number === String(index + 1) ? ', correct position' : ''}`}>{number !== '0' && number}</button>)}</div><p className="hint">Tap a tile next to the gap · Arrow keys work too</p></section></>
}
