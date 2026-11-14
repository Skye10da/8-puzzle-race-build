import test from 'node:test'
import assert from 'node:assert/strict'
import { isStartAtInRange } from './start-time.mjs'

test('isStartAtInRange accepts the lower and upper bounds', () => {
  assert.equal(isStartAtInRange(9_000, 10_000), true)
  assert.equal(isStartAtInRange(25_000, 10_000), true)
})

test('isStartAtInRange rejects values outside the window and non-finite timestamps', () => {
  assert.equal(isStartAtInRange(8_999, 10_000), false)
  assert.equal(isStartAtInRange(25_001, 10_000), false)
  assert.equal(isStartAtInRange(Number.NaN, 10_000), false)
  assert.equal(isStartAtInRange(10_000, Number.POSITIVE_INFINITY), false)
})
