import { REACTIONS, type ReactionEmoji } from '@/lib/reactions.mjs'

type Props = { onReact: (emoji: ReactionEmoji) => void }

export function ReactionBar({ onReact }: Props) {
  return <div className="reaction-bar" role="group" aria-label="Send a race reaction">{REACTIONS.map(({ emoji, label }) => <button key={emoji} type="button" aria-label={`React: ${label}`} title={label} onClick={() => onReact(emoji)}>{emoji}</button>)}</div>
}
