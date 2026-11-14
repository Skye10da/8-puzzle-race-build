import test from 'node:test'
import assert from 'node:assert/strict'
import { prefetchPuzzleEngine } from './prefetch-puzzle.mjs'

test('prefetchPuzzleEngine safely does nothing outside the browser', () => {
  const originalWindow = globalThis.window
  try {
    delete globalThis.window
    assert.doesNotThrow(() => prefetchPuzzleEngine())
  } finally {
    if (originalWindow !== undefined) globalThis.window = originalWindow
  }
})

test('prefetchPuzzleEngine prefers requestIdleCallback and falls back to setTimeout', () => {
  const originalWindow = globalThis.window
  let idleCallback
  let timeoutCallback
  try {
    globalThis.window = { requestIdleCallback(callback) { idleCallback = callback }, setTimeout(callback) { timeoutCallback = callback } }
    prefetchPuzzleEngine()
    assert.equal(typeof idleCallback, 'function')
    assert.equal(timeoutCallback, undefined)
    delete globalThis.window.requestIdleCallback
    prefetchPuzzleEngine()
    assert.equal(typeof timeoutCallback, 'function')
  } finally {
    if (originalWindow !== undefined) globalThis.window = originalWindow
    else delete globalThis.window
  }
})
