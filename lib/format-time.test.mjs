import test from 'node:test'
import assert from 'node:assert/strict'
import { formatTime } from './format-time.ts'

test('formatTime uses seconds below a minute', () => {
  assert.equal(formatTime(0), '0.00s')
  assert.equal(formatTime(59999), '59.99s')
})

test('formatTime uses minutes and centiseconds at one minute or more', () => {
  assert.equal(formatTime(60000), '1:00.00')
  assert.equal(formatTime(73450), '1:13.45')
})
