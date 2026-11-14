import { RotateCcw, Trophy } from 'lucide-react'
import type { Difficulty } from '@/lib/puzzle-engine.mjs'
import type { Player } from '@/lib/game-types'
import { formatTime } from '@/lib/format-time'
import { HINT_PENALTY_MS, getAdjustedScoreTime } from '@/lib/hints.mjs'

type Props = { ranking: Player[]; difficulty: Difficulty; optimalMoves: number; host: boolean; canChangeDifficulty: boolean; onDifficultyChange: (difficulty: Difficulty) => void; onPlayAgain: () => void }

export function Results({ ranking, difficulty, optimalMoves, host, canChangeDifficulty, onDifficultyChange, onPlayAgain }: Props) {
  return <section className="results panel"><div className="panel-heading"><div><h2>Final ranking</h2><span className="difficulty-badge">{difficulty}</span></div><Trophy size={20} /></div>{ranking.map((player, index) => { const hints = player.hintsUsed ?? 0; const penalty = hints * HINT_PENALTY_MS; const scoreTime = getAdjustedScoreTime(player.doneMs ?? 0, hints); return <div className="rank-row" key={player.gid}><strong>{index + 1}</strong><span>{player.name}</span><span>{formatTime(scoreTime)} · {player.moves} moves · {hints} hints (+{formatTime(penalty)}) · best possible: {optimalMoves}</span></div> })}{host && <div className="results-actions">{canChangeDifficulty && <label className="results-difficulty">Next race<select value={difficulty} onChange={event => onDifficultyChange(event.target.value as Difficulty)}>{(['easy', 'medium', 'hard', 'extreme'] as Difficulty[]).map(level => <option key={level} value={level}>{level}</option>)}</select></label>}<button className={`secondary play-again ${canChangeDifficulty ? '' : 'solo-play-again'}`} onClick={onPlayAgain}><RotateCcw size={16} /> Play again</button></div>}</section>
}
