import type { Player } from '@/lib/game-types'
import { formatTime } from '@/lib/format-time'
import type { ReactionEmoji } from '@/lib/reactions.mjs'

type Props = { player: Player; color: string; verified: boolean; reaction?: ReactionEmoji }


function MiniBoard({ board }: { board: string }) {
  return <div className="mini-board">{board.split('').map((number, index) => <span key={index} className={number === '0' ? 'gap' : ''}>{number === '0' ? '' : number}</span>)}</div>
}

export function PlayerCard({ player, color, verified, reaction }: Props) {
  const status = player.left ? 'Left the race' : player.doneMs !== null ? verified ? `Finished · ${formatTime(player.doneMs)}` : 'Unverified' : `${player.moves} moves`
  return <div className="player-card" style={{ borderLeftColor: color }}><div className="player-info"><span className="avatar" style={{ background: color }}>{player.name.slice(0, 1).toUpperCase()}</span>{reaction && <span className="reaction-bubble" role="status">{reaction}</span>}<div><strong>{player.name}</strong><small>{status}</small></div></div><MiniBoard board={player.board} /></div>
}
