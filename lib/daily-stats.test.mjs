import test from 'node:test'
import assert from 'node:assert/strict'
import { getUtcDateKey, parseDailyStats, recordDailyCompletion } from './daily-stats.mjs'

test('daily stats track one streak increment per consecutive UTC day', () => {
  const first = recordDailyCompletion(null, '2026-11-12', 82_300, 42)
  const repeated = recordDailyCompletion(first, '2026-11-12', 75_200, 39)
  const next = recordDailyCompletion(repeated, '2026-11-13', 71_400, 37)
  assert.equal(first.streak, 1)
  assert.equal(repeated.streak, 1)
  assert.equal(next.streak, 2)
  assert.deepEqual(next.today, { date: '2026-11-13', record: { bestTimeMs: 71_400, bestMoves: 37 } })
})

test('daily streak resets after a missed UTC day and keeps independent bests', () => {
  const previous = recordDailyCompletion(null, '2026-11-10', 60_000, 30)
  const missed = recordDailyCompletion(previous, '2026-11-12', 70_000, 35)
  assert.equal(missed.streak, 1)
  assert.deepEqual(missed.best, { bestTimeMs: 60_000, bestMoves: 30 })
})

test('daily stats reject malformed storage and derive UTC date keys', () => {
  assert.deepEqual(parseDailyStats({ streak: -1, lastCompletedDate: 'not-a-date' }), { best: null, today: null, streak: 0, lastCompletedDate: null })
  assert.equal(getUtcDateKey(Date.UTC(2026, 10, 13, 23, 30)), '2026-11-13')
})
