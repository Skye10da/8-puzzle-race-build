import type { Difficulty } from './puzzle-engine.mjs'

export type GameMode = 'select' | 'single' | 'multi'
export type RoundState = 'lobby' | 'countdown' | 'racing' | 'finished'
export type Player = {
  name: string
  joinedAt: number
  gid: string
  board: string
  moves: number
  doneMs: number | null
  hostGid?: string
  difficulty?: Difficulty
  bestPossibleMoves?: number
  left?: boolean
  moveLog?: string
  hintsUsed?: number
  points?: number
  raceNumber?: number
}
export type BestRecord = { bestTimeMs: number; bestMoves: number }
export type BestStats = Record<string, BestRecord>
