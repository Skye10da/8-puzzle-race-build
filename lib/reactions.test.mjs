import test from 'node:test'
import assert from 'node:assert/strict'
import { canSendReaction, isReactionEmoji, parseReaction, REACTIONS } from './reactions.mjs'

test('reactions accept only the four supported emoji payloads', () => {
  for (const { emoji } of REACTIONS) {
    assert.equal(isReactionEmoji(emoji), true)
    assert.deepEqual(parseReaction({ gid: 'player_1', emoji }), { gid: 'player_1', emoji })
  }
  assert.equal(parseReaction({ gid: 'player_1', emoji: '💥' }), null)
  assert.equal(parseReaction({ gid: '<script>', emoji: '👏' }), null)
})

test('reaction rate limit allows one event per sender per second', () => {
  assert.equal(canSendReaction(null, 500), true)
  assert.equal(canSendReaction(1_000, 1_999), false)
  assert.equal(canSendReaction(1_000, 2_000), true)
  assert.equal(canSendReaction(2_000, 1_999), false)
})
