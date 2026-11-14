export const REACTIONS = Object.freeze([
  { emoji: '👏', label: 'Applause' },
  { emoji: '😅', label: 'Nervous laugh' },
  { emoji: '🔥', label: 'Fire' },
  { emoji: '😂', label: 'Laugh' },
])

const ALLOWED_EMOJIS = new Set(REACTIONS.map(reaction => reaction.emoji))
const SAFE_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/

export function isReactionEmoji(value) {
  return typeof value === 'string' && ALLOWED_EMOJIS.has(value)
}

export function parseReaction(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  if (typeof value.gid !== 'string' || !SAFE_ID_PATTERN.test(value.gid) || !isReactionEmoji(value.emoji)) return null
  return { gid: value.gid, emoji: value.emoji }
}

export function canSendReaction(lastSentAt, now) {
  return Number.isFinite(now) && (lastSentAt === null || Number.isFinite(lastSentAt) && now >= lastSentAt + 1000)
}
