export type ReactionEmoji = '👏' | '😅' | '🔥' | '😂'
export const REACTIONS: readonly { emoji: ReactionEmoji; label: string }[]
export function isReactionEmoji(value: unknown): value is ReactionEmoji
export function parseReaction(value: unknown): { gid: string; emoji: ReactionEmoji } | null
export function canSendReaction(lastSentAt: number | null, now: number): boolean
