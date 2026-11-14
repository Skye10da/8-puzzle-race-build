import type { Player } from '@/lib/game-types'
import { getSeriesWinners } from '@/lib/series.mjs'

type Props = { players: Player[]; raceNumber: number; seriesLength: number; final: boolean; host: boolean; onNextRace: () => void; onNewSeries: () => void }

export function SeriesPanel({ players, raceNumber, seriesLength, final, host, onNextRace, onNewSeries }: Props) {
  const standings = [...players].filter(player => !player.left).sort((a, b) => (b.points ?? 0) - (a.points ?? 0) || a.joinedAt - b.joinedAt || a.gid.localeCompare(b.gid))
  const winners = getSeriesWinners(standings)
  return <section className="series-panel panel"><div className="panel-heading"><div><span className="kicker">{final ? 'SERIES COMPLETE' : `RACE ${raceNumber - 1} OF ${seriesLength} COMPLETE`}</span><h2>{final ? 'Series winner' : 'Series standings'}</h2></div></div>{final && <p className="series-winner-copy">{winners.map(player => player.name).join(' & ')} {winners.length === 1 ? 'wins the series.' : 'share the series win.'}</p>}<div className="series-table" role="table" aria-label={final ? 'Final series standings' : 'Series standings'}>{standings.map((player, index) => <div className="series-row" role="row" key={player.gid}><strong role="cell">{index + 1}</strong><span role="cell">{player.name}</span><span role="cell">{player.points ?? 0} pts</span></div>)}</div>{host ? <button className="primary full" onClick={final ? onNewSeries : onNextRace}>{final ? 'New series' : 'Next race'}</button> : <p className="host-note">Waiting for the host to {final ? 'start a new series' : 'start the next race'}.</p>}</section>
}
