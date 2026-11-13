import test from 'node:test'
import assert from 'node:assert/strict'
import { areAllActivePlayersVerified, estimateClockOffset, isRoomCode, isVerifiedFinisher, parsePause, parsePlayer, parseRoundStart, parseStats } from './game-protocol.mjs'
import { createPuzzle, getOptimalMoves, SOLVED_BOARD } from './puzzle-engine.mjs'

const player = { name: '  Player  ', joinedAt: Date.now(), gid: 'abc123', board: '123456780', moves: 0, doneMs: null }

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
  assert.deepEqual(parseRoundStart({ gid: 'host', seed: 1, difficulty: 'hard', startAt: 1_800_000_000_000 }), { gid: 'host', seed: 1, difficulty: 'hard', startAt: 1_800_000_000_000 })
  assert.equal(parseRoundStart({ gid: 'host', seed: 1, difficulty: 'unknown', startAt: 1_800_000_000_000 }), null)
  assert.equal(parsePause({ gid: 'host', paused: true, elapsed: -10 }), null)
})

test('finish validation enforces solved board, optimal moves, parity, and minimum time', () => {
  const seed = 8401
  const difficulty = 'easy'
  const optimal = getOptimalMoves(createPuzzle(seed, difficulty))
  const winner = { ...player, board: SOLVED_BOARD, moves: optimal, doneMs: optimal * 60, bestPossibleMoves: 0 }
  assert.equal(isVerifiedFinisher(winner, seed, difficulty), true)
  assert.equal(isVerifiedFinisher({ ...winner, board: '123456708' }, seed, difficulty), false)
  assert.equal(isVerifiedFinisher({ ...winner, moves: optimal - 2 }, seed, difficulty), false)
  assert.equal(isVerifiedFinisher({ ...winner, moves: optimal + 1 }, seed, difficulty), false)
  assert.equal(isVerifiedFinisher({ ...winner, doneMs: optimal * 60 - 1 }, seed, difficulty), false)
})

test('rematch safety ignores departed players and requires verified finishers', () => {
  const seed = 8401
  const difficulty = 'easy'
  const optimal = getOptimalMoves(createPuzzle(seed, difficulty))
  const winner = { ...player, board: SOLVED_BOARD, moves: optimal, doneMs: optimal * 60 }
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
