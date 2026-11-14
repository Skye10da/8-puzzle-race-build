import { createPuzzle, getOptimalMoves, SOLVED_BOARD } from './puzzle-engine.mjs'
import { replayMoves } from './replay-moves.mjs'

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const DIFFICULTIES = new Set(['easy', 'medium', 'hard', 'extreme'])
const BOARD_PATTERN = /^[0-8]{9}$/
const SAFE_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/

export function isDifficulty(value) {
  return typeof value === 'string' && DIFFICULTIES.has(value)
}

export function isSeriesLength(value) {
  return value === 1 || value === 3 || value === 5
}

export function isRoomCode(value) {
  if (typeof value !== 'string') return false
  const code = value.toUpperCase()
  return code.length === 6 && [...code].every(character => ROOM_ALPHABET.includes(character))
}

export function isValidBoard(board) {
  return typeof board === 'string' && BOARD_PATTERN.test(board) && new Set(board).size === 9
}

export function parsePlayer(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const { name, joinedAt, gid, board, moves, doneMs } = value
  if (typeof name !== 'string' || !name.trim() || name.length > 64) return null
  if (!Number.isFinite(joinedAt) || joinedAt < 0) return null
  if (typeof gid !== 'string' || !SAFE_ID_PATTERN.test(gid) || !isValidBoard(board)) return null
  if (!Number.isSafeInteger(moves) || moves < 0 || moves > 1_000_000) return null
  if (doneMs !== null && (!Number.isFinite(doneMs) || doneMs < 0 || doneMs > 24 * 60 * 60 * 1000)) return null
  if (value.hostGid !== undefined && (typeof value.hostGid !== 'string' || !SAFE_ID_PATTERN.test(value.hostGid))) return null
  if (value.difficulty !== undefined && !isDifficulty(value.difficulty)) return null
  if (value.bestPossibleMoves !== undefined && (!Number.isInteger(value.bestPossibleMoves) || value.bestPossibleMoves < 0 || value.bestPossibleMoves > 31)) return null
  if (value.left !== undefined && typeof value.left !== 'boolean') return null
  if (value.moveLog !== undefined && (typeof value.moveLog !== 'string' || value.moveLog.length > 2000 || !/^[1-8]*$/.test(value.moveLog))) return null
  if (value.hintsUsed !== undefined && (!Number.isSafeInteger(value.hintsUsed) || value.hintsUsed < 0 || value.hintsUsed > moves)) return null
  if (value.points !== undefined && (!Number.isSafeInteger(value.points) || value.points < 0 || value.points > 100)) return null
  if (value.raceNumber !== undefined && (!Number.isSafeInteger(value.raceNumber) || value.raceNumber < 1 || value.raceNumber > 6)) return null
  return {
    name: name.trim().slice(0, 12),
    joinedAt,
    gid,
    board,
    moves,
    doneMs,
    ...(value.hostGid ? { hostGid: value.hostGid } : {}),
    ...(value.difficulty ? { difficulty: value.difficulty } : {}),
    ...(value.bestPossibleMoves !== undefined ? { bestPossibleMoves: value.bestPossibleMoves } : {}),
    ...(value.left !== undefined ? { left: value.left } : {}),
    ...(value.moveLog !== undefined ? { moveLog: value.moveLog } : {}),
    ...(value.hintsUsed !== undefined ? { hintsUsed: value.hintsUsed } : {}),
    ...(value.points !== undefined ? { points: value.points } : {}),
    ...(value.raceNumber !== undefined ? { raceNumber: value.raceNumber } : {}),
  }
}

export function parseRoundStart(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  if (typeof value.gid !== 'string' || !SAFE_ID_PATTERN.test(value.gid)) return null
  if (!Number.isSafeInteger(value.seed) || value.seed < 0 || value.seed > 0x7fffffff) return null
  if (!isDifficulty(value.difficulty)) return null
  if (!Number.isSafeInteger(value.startAt) || value.startAt < 0) return null
  if (value.hints !== undefined && typeof value.hints !== 'boolean') return null
  if (value.seriesLength !== undefined && !isSeriesLength(value.seriesLength)) return null
  return { gid: value.gid, seed: value.seed, difficulty: value.difficulty, startAt: value.startAt, hints: value.hints ?? false, seriesLength: value.seriesLength ?? 1 }
}

export function estimateClockOffset(samples) {
  if (!Array.isArray(samples)) return null
  const valid = samples.filter(sample => sample && Number.isFinite(sample.rttMs) && sample.rttMs >= 0 && Number.isFinite(sample.offsetMs))
  if (valid.length < 3) return null
  valid.sort((a, b) => a.rttMs - b.rttMs)
  return valid[Math.floor(valid.length / 2)].offsetMs
}

export function areAllActivePlayersVerified(players, seed, difficulty) {
  if (!Array.isArray(players) || !Number.isSafeInteger(seed) || !isDifficulty(difficulty)) return false
  const active = players.filter(player => player && player.left !== true)
  return active.length > 0 && active.every(player => isVerifiedFinisher(player, seed, difficulty))
}

export function isVerifiedFinisher(player, seed, difficulty) {
  const parsed = parsePlayer(player)
  if (!parsed || parsed.doneMs === null || parsed.board !== SOLVED_BOARD || typeof parsed.moveLog !== 'string' || parsed.moveLog.length !== parsed.moves || !Number.isSafeInteger(seed) || !isDifficulty(difficulty)) return false
  const startBoard = createPuzzle(seed, difficulty)
  const optimal = getOptimalMoves(startBoard)
  return optimal !== null && parsed.moves >= optimal && (parsed.moves - optimal) % 2 === 0 && parsed.doneMs >= parsed.moves * 60 && replayMoves(startBoard, parsed.moveLog) === SOLVED_BOARD
}

export function parsePause(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  if (typeof value.gid !== 'string' || !SAFE_ID_PATTERN.test(value.gid)) return null
  if (typeof value.paused !== 'boolean') return null
  if (!Number.isFinite(value.elapsed) || value.elapsed < 0 || value.elapsed > 24 * 60 * 60 * 1000) return null
  return { gid: value.gid, paused: value.paused, elapsed: value.elapsed }
}

export function parseStats(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const result = {}
  for (const difficulty of DIFFICULTIES) {
    const record = value[difficulty]
    if (!record || typeof record !== 'object') continue
    const bestTimeMs = record.bestTimeMs ?? record.time
    const bestMoves = record.bestMoves ?? record.moves
    if (Number.isFinite(bestTimeMs) && bestTimeMs >= 0 && Number.isSafeInteger(bestMoves) && bestMoves >= 0 && bestMoves <= 1_000_000) {
      result[difficulty] = { bestTimeMs, bestMoves }
    }
  }
  return result
}
