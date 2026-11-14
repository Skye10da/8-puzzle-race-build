import test from 'node:test'
import assert from 'node:assert/strict'
import { areAllActivePlayersVerified, estimateClockOffset, isRoomCode, isSeriesLength, isVerifiedFinisher, parsePause, parsePlayer, parseRoundStart, parseStats } from './game-protocol.mjs'
import { createPuzzle, getNeighbors, getOptimalMoves, SOLVED_BOARD } from './puzzle-engine.mjs'
import { replayMoves } from './replay-moves.mjs'

const player = { name: '  Player  ', joinedAt: Date.now(), gid: 'abc123', board: '123456780', moves: 0, doneMs: null }

function solutionLog(board) {
  let current = board
  let moveLog = ''
  while (current !== SOLVED_BOARD) {
    const distance = getOptimalMoves(current)
    const next = getNeighbors(current).find(candidate => getOptimalMoves(candidate) === distance - 1)
    moveLog += next[current.indexOf('0')]
    current = next
  }
  return moveLog
}

test('room codes accept only six characters from the safe alphabet', () => {
  assert.equal(isRoomCode('ABCD'), false)
  assert.equal(isRoomCode('ABCD23'), true)
  assert.equal(isRoomCode('ABCDEFGHIJ'), false)
  assert.equal(isRoomCode('ABCD!2'), false)
})

test('player payloads are bounded, normalized and reject malformed boards', () => {
  assert.equal(parsePlayer(player).name, 'Player')
  assert.equal(parsePlayer({ ...player, board: '<img src=x>' }), null)
  assert.equal(parsePlayer({ ...player, moves: Infinity }), null)
  assert.equal(parsePlayer({ ...player, name: null }), null)
})

test('round start and pause events reject malformed or out-of-range values', () => {
  assert.deepEqual(parseRoundStart({ gid: 'host', seed: 1, difficulty: 'hard', startAt: 1_800_000_000_000, hints: true, seriesLength: 3 }), { gid: 'host', seed: 1, difficulty: 'hard', startAt: 1_800_000_000_000, hints: true, seriesLength: 3 })
  assert.deepEqual(parseRoundStart({ gid: 'host', seed: 1, difficulty: 'easy', startAt: Number.MAX_SAFE_INTEGER }), { gid: 'host', seed: 1, difficulty: 'easy', startAt: Number.MAX_SAFE_INTEGER, hints: false, seriesLength: 1 })
  assert.equal(parseRoundStart({ gid: 'host', seed: 1, difficulty: 'easy', startAt: 1, hints: 'yes' }), null)
  assert.equal(parseRoundStart({ gid: 'host', seed: 1, difficulty: 'easy', startAt: 1, seriesLength: 2 }), null)
  assert.equal(isSeriesLength(1), true)
  assert.equal(isSeriesLength(3), true)
  assert.equal(isSeriesLength(5), true)
  assert.equal(isSeriesLength(2), false)
  assert.equal(parseRoundStart({ gid: 'host', seed: 1, difficulty: 'unknown', startAt: 1_800_000_000_000 }), null)
  assert.equal(parsePause({ gid: 'host', paused: true, elapsed: -10 }), null)
})

test('finish validation requires a legal replay matching the optimal move constraints', () => {
  const seed = 8401
  const difficulty = 'easy'
  const startBoard = createPuzzle(seed, difficulty)
  const optimal = getOptimalMoves(startBoard)
  const moveLog = solutionLog(startBoard)
  const winner = { ...player, board: SOLVED_BOARD, moves: optimal, moveLog, doneMs: optimal * 60, bestPossibleMoves: 0 }
  assert.equal(replayMoves(startBoard, moveLog), SOLVED_BOARD)
  assert.equal(isVerifiedFinisher(winner, seed, difficulty), true)
  assert.equal(isVerifiedFinisher({ ...winner, board: '123456708' }, seed, difficulty), false)
  assert.equal(isVerifiedFinisher({ ...winner, moves: optimal - 2 }, seed, difficulty), false)
  assert.equal(isVerifiedFinisher({ ...winner, moves: optimal + 1 }, seed, difficulty), false)
  assert.equal(isVerifiedFinisher({ ...winner, moveLog: moveLog.slice(0, -1) }, seed, difficulty), false)
  assert.equal(isVerifiedFinisher({ ...winner, moveLog: '' }, seed, difficulty), false)
  assert.equal(isVerifiedFinisher({ ...winner, doneMs: optimal * 60 - 1 }, seed, difficulty), false)
})

test('replayMoves rejects an illegal tile, incomplete solving path, undo pairs, and oversized logs', () => {
  const startBoard = createPuzzle(8401, 'easy')
  const gap = startBoard.indexOf('0')
  const legalTiles = getNeighbors(startBoard).map(board => board[gap])
  const illegalTile = [...'12345678'].find(tile => !legalTiles.includes(tile))
  const log = solutionLog(startBoard)
  assert.equal(replayMoves(startBoard, illegalTile), null)
  assert.notEqual(replayMoves(startBoard, ''), SOLVED_BOARD)
  assert.equal(replayMoves(startBoard, `${log.slice(0, 2)}${log[1]}${log.slice(2)}`), null)
  assert.equal(replayMoves(startBoard, '1'.repeat(2001)), null)
})

test('parsePlayer rejects malformed or oversized move logs', () => {
  assert.equal(parsePlayer({ ...player, moveLog: '123abc' }), null)
  assert.equal(parsePlayer({ ...player, moveLog: '1'.repeat(2001) }), null)
  assert.equal(parsePlayer({ ...player, moves: 2, hintsUsed: 2 }).hintsUsed, 2)
  assert.equal(parsePlayer({ ...player, moves: 1, hintsUsed: 2 }), null)
  assert.equal(parsePlayer({ ...player, hintsUsed: -1 }), null)
  assert.equal(parsePlayer({ ...player, points: 101 }), null)
  assert.equal(parsePlayer({ ...player, raceNumber: 7 }), null)
  assert.equal(parsePlayer({ ...player, points: 10, raceNumber: 5 }).points, 10)
})

test('rematch safety ignores departed players and requires verified finishers', () => {
  const seed = 8401
  const difficulty = 'easy'
  const startBoard = createPuzzle(seed, difficulty)
  const optimal = getOptimalMoves(startBoard)
  const winner = { ...player, board: SOLVED_BOARD, moves: optimal, moveLog: solutionLog(startBoard), doneMs: optimal * 60 }
  assert.equal(areAllActivePlayersVerified([winner, { ...winner, gid: 'gone', left: true }], seed, difficulty), true)
  assert.equal(areAllActivePlayersVerified([winner, { ...player, gid: 'still-racing' }], seed, difficulty), false)
  assert.equal(areAllActivePlayersVerified([], seed, difficulty), false)
})

test('clock offset uses the sample with median round trip time', () => {
  assert.equal(estimateClockOffset([{ rttMs: 40, offsetMs: 100 }, { rttMs: 10, offsetMs: 25 }, { rttMs: 20, offsetMs: 60 }]), 60)
  assert.equal(estimateClockOffset([{ rttMs: 10, offsetMs: -40 }]), null)
  assert.equal(estimateClockOffset([]), null)
})

test('malformed saved stats safely fall back to validated independent records', () => {
  assert.deepEqual(parseStats(null), {})
  assert.deepEqual(parseStats({ easy: { time: 1250, moves: 12 }, hard: { bestTimeMs: 'bad', bestMoves: 10 } }), { easy: { bestTimeMs: 1250, bestMoves: 12 } })
})
