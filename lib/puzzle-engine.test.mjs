import test from 'node:test'
import assert from 'node:assert/strict'
import { buildDistanceMap, createPuzzle, DIFFICULTY_RANGES, getNeighbors, getOptimalMoves, SOLVED_BOARD } from './puzzle-engine.mjs'

test('BFS caches all reachable puzzle states with solved distance zero', () => {
  const first = buildDistanceMap()
  assert.equal(first.size, 181440)
  assert.equal(getOptimalMoves(SOLVED_BOARD), 0)
  assert.equal([...first.values()].reduce((maximum, distance) => Math.max(maximum, distance), 0), 31)
  assert.equal(buildDistanceMap(), first)
})

test('neighbors are legal adjacent slides and preserve all tiles', () => {
  assert.deepEqual(getNeighbors(SOLVED_BOARD).sort(), ['123456708', '123450786'].sort())
  for (const neighbor of getNeighbors(SOLVED_BOARD)) assert.equal([...neighbor].sort().join(''), '012345678')
  assert.throws(() => getNeighbors('12345677x'), TypeError)
})

test('seed and difficulty deterministically choose boards in the exact shortest-path range', () => {
  for (const [difficulty, [minimum, maximum]] of Object.entries(DIFFICULTY_RANGES)) {
    const board = createPuzzle(20261111, difficulty)
    assert.equal(board, createPuzzle(20261111, difficulty))
    const distance = getOptimalMoves(board)
    assert.ok(distance >= minimum && distance <= maximum, `${difficulty}: ${distance}`)
    assert.notEqual(board, SOLVED_BOARD)
  }
})

test('puzzle construction rejects unknown difficulty', () => {
  assert.throws(() => createPuzzle(7, 'impossible'), RangeError)
})
