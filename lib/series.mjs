export function getPointsForPlace(place) {
  if (!Number.isSafeInteger(place) || place < 1) return 0
  return place === 1 ? 3 : place === 2 ? 2 : place === 3 ? 1 : 0
}

export function getSeriesWinners(players) {
  const active = Array.isArray(players) ? players.filter(player => player && player.left !== true) : []
  if (active.length === 0) return []
  const highest = Math.max(...active.map(player => Number.isSafeInteger(player.points) ? player.points : 0))
  return active.filter(player => (Number.isSafeInteger(player.points) ? player.points : 0) === highest)
}
