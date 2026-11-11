import test from 'node:test'
import assert from 'node:assert/strict'
import { isRoomCode, parsePause, parsePlayer, parseRoundStart, parseStats } from './game-protocol.mjs'

const player = { name: '  Player  ', joinedAt: Date.now(), gid: 'abc123', board: '123456780', moves: 0, doneMs: null }

test('room codes accept legacy codes and high-entropy codes only', () => {
  assert.equal(isRoomCode('ABCD'), true)
  assert.equal(isRoomCode('ABCDEFGH23'), true)
  assert.equal(isRoomCode('ABC!'), false)
  assert.equal(isRoomCode('ABCDEFGHIJ'), false)
})

test('player payloads are bounded, normalized and reject malformed boards', () => {
  assert.equal(parsePlayer(player).name, 'Player')
  assert.equal(parsePlayer({ ...player, board: '<img src=x>' }), null)
  assert.equal(parsePlayer({ ...player, moves: Infinity }), null)
  assert.equal(parsePlayer({ ...player, name: null }), null)
})

test('round start and pause events reject malformed or out-of-range values', () => {
  assert.deepEqual(parseRoundStart({ gid: 'host', seed: 1, difficulty: 'hard', countdownMs: 3000 }), { gid: 'host', seed: 1, difficulty: 'hard', countdownMs: 3000 })
  assert.equal(parseRoundStart({ gid: 'host', seed: 1, difficulty: 'unknown', countdownMs: 3000 }), null)
  assert.equal(parsePause({ gid: 'host', paused: true, elapsed: -10 }), null)
})

test('malformed saved stats safely fall back to validated independent records', () => {
  assert.deepEqual(parseStats(null), {})
  assert.deepEqual(parseStats({ easy: { time: 1250, moves: 12 }, hard: { bestTimeMs: 'bad', bestMoves: 10 } }), { easy: { bestTimeMs: 1250, bestMoves: 12 } })
})
