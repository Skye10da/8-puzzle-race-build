import type { Difficulty } from './puzzle-engine.mjs'

export type ValidatedPlayer = {
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
}
export type RoundStart = { gid: string; seed: number; difficulty: Difficulty; startAt: number }
export type PauseState = { gid: string; paused: boolean; elapsed: number }
export function isDifficulty(value: unknown): value is Difficulty
export function isRoomCode(value: unknown): value is string
export function isValidBoard(value: unknown): value is string
export function parsePlayer(value: unknown): ValidatedPlayer | null
export function parseRoundStart(value: unknown): RoundStart | null
export function estimateClockOffset(samples: Array<{ rttMs: number; offsetMs: number }>): number | null
export function isVerifiedFinisher(player: unknown, seed: number, difficulty: Difficulty): boolean
export function areAllActivePlayersVerified(players: unknown, seed: number | null, difficulty: Difficulty): boolean
export function parsePause(value: unknown): PauseState | null
export function parseStats(value: unknown): Record<string, { bestTimeMs: number; bestMoves: number }>
