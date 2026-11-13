import type { Difficulty } from '@/lib/puzzle-engine.mjs'
import type { BestRecord, BestStats, GameMode } from '@/lib/game-types'
import { formatTime } from '@/lib/format-time'
import { isRoomCode } from '@/lib/game-protocol.mjs'

type Props = {
  mode: GameMode
  onModeChange: (mode: GameMode) => void
  difficulty: Difficulty
  onDifficultyChange: (difficulty: Difficulty) => void
  name: string
  onNameChange: (name: string) => void
  roomCode: string
  onRoomCodeChange: (code: string) => void
  bestStats: BestStats
  dailyBest: BestRecord | null
  todayDailyResult: BestRecord | null
  dailyStreak: number
  message: string
  onStartSolo: () => void
  onDailyPuzzle: () => void
  onCreateRoom: () => void
  onJoinRoom: () => void
}

export function Lobby({ mode, onModeChange, difficulty, onDifficultyChange, name, onNameChange, roomCode, onRoomCodeChange, bestStats, dailyBest, todayDailyResult, dailyStreak, message, onStartSolo, onDailyPuzzle, onCreateRoom, onJoinRoom }: Props) {
  return <section className="hero-card"><span className="kicker">READY, SET, SLIDE</span><h2>Race your friends<br />to solve the classic.</h2><p>Same shuffle. Same start. One winner.</p><div className="difficulty-picker"><span>Difficulty</span><div className="difficulty-options">{(['easy', 'medium', 'hard', 'extreme'] as Difficulty[]).map(level => <button key={level} className={difficulty === level ? 'selected' : ''} onClick={() => onDifficultyChange(level)}>{level}</button>)}</div></div><div className="mode-toggle"><button className={`mode-choice ${mode === 'single' ? 'active' : ''}`} onClick={() => onModeChange('single')}>Single player</button><button className={`mode-choice ${mode === 'multi' ? 'active' : ''}`} onClick={() => onModeChange('multi')}>Multiplayer</button></div><div className="form-stack"><label>Your name<input value={name} maxLength={12} onChange={event => onNameChange(event.target.value)} placeholder="e.g. Ada" /></label>{mode === 'single' ? <><button className="primary" onClick={onStartSolo}>Start solo race <span>→</span></button><button className="secondary" onClick={onDailyPuzzle}>Daily puzzle</button><div className="daily-summary"><span>{todayDailyResult ? `Today: ${formatTime(todayDailyResult.bestTimeMs)} · ${todayDailyResult.bestMoves} moves` : 'Not completed today'}</span><span>{dailyBest ? `Daily best: ${formatTime(dailyBest.bestTimeMs)} · ${dailyBest.bestMoves} moves` : 'Daily best: —'}</span><span>Streak: {dailyStreak} {dailyStreak === 1 ? 'day' : 'days'}</span></div>{bestStats[difficulty] && <p className="best-stat">Best {difficulty}: {formatTime(bestStats[difficulty].bestTimeMs)} · {bestStats[difficulty].bestMoves} moves</p>}</> : <><button className="primary" onClick={onCreateRoom}>Create room <span>→</span></button><div className="divider"><span>or join a race</span></div><div className="join-row"><input value={roomCode} maxLength={6} onChange={event => onRoomCodeChange(event.target.value.toUpperCase())} placeholder="ROOM CODE" aria-label="Room code" /><button className="secondary" disabled={!isRoomCode(roomCode)} onClick={onJoinRoom}>Join</button></div></>}</div>{message && <p className="notice">{message}</p>}</section>
}
