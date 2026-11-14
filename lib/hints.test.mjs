import test from 'node:test'
import assert from 'node:assert/strict'
import { getAdjustedScoreTime, getHintTile, HINT_PENALTY_MS } from './hints.mjs'
import { createPuzzle, getNeighbors, getOptimalMoves, SOLVED_BOARD } from './puzzle-engine.mjs'

test('each hint adds ten seconds to the final score', () => {
  assert.equal(getAdjustedScoreTime(42_000, 0), 42_000)
  assert.equal(getAdjustedScoreTime(42_000, 1), 42_000 + HINT_PENALTY_MS)
})

test('getHintTile returns an adjacent tile that reduces optimal distance by one', () => {
  const board = createPuzzle(8401, 'easy')
  const tile = getHintTile(board)
  const gap = board.indexOf('0')
  assert.ok(tile)
  const next = getNeighbors(board).find(candidate => candidate[gap] === tile)
  assert.ok(next)
  assert.equal(getOptimalMoves(next), getOptimalMoves(board) - 1)
})

test('getHintTile returns null for the solved board', () => {
  assert.equal(getHintTile(SOLVED_BOARD), null)
})
