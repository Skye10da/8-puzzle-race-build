import test from 'node:test'
import assert from 'node:assert/strict'
import { getPointsForPlace, getSeriesWinners } from './series.mjs'

test('series points reward the top three verified places', () => {
  assert.deepEqual([1, 2, 3, 4].map(getPointsForPlace), [3, 2, 1, 0])
  assert.equal(getPointsForPlace(0), 0)
})

test('series winners include all tied players and exclude departed players', () => {
  const players = [{ name: 'A', points: 5 }, { name: 'B', points: 5 }, { name: 'C', points: 4 }, { name: 'D', points: 10, left: true }]
  assert.deepEqual(getSeriesWinners(players).map(player => player.name), ['A', 'B'])
  assert.deepEqual(getSeriesWinners([]), [])
})
