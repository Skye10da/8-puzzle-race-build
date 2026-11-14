import { getNeighbors, getOptimalMoves } from './puzzle-engine.mjs'

export const HINT_PENALTY_MS = 10_000

export function getAdjustedScoreTime(doneMs, hintsUsed = 0) {
  return doneMs + hintsUsed * HINT_PENALTY_MS
}

export function getHintTile(board) {
  const distance = getOptimalMoves(board)
  if (distance === null || distance === 0) return null
  const next = getNeighbors(board).find(candidate => getOptimalMoves(candidate) === distance - 1)
  return next ? board[next.indexOf('0')] : null
}
