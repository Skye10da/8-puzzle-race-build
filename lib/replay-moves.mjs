function isValidBoard(board) {
  return typeof board === 'string' && /^[0-8]{9}$/.test(board) && new Set(board).size === 9
}

export function replayMoves(startBoard, moveLog) {
  if (!isValidBoard(startBoard) || typeof moveLog !== 'string' || moveLog.length > 2000 || !/^[1-8]*$/.test(moveLog)) return null
  let board = startBoard
  let previousTile = ''
  for (const tile of moveLog) {
    if (tile === previousTile) return null
    const gap = board.indexOf('0')
    const tileIndex = board.indexOf(tile)
    if (tileIndex < 0 || !(Math.abs(gap - tileIndex) === 3 || (Math.floor(gap / 3) === Math.floor(tileIndex / 3) && Math.abs(gap - tileIndex) === 1))) return null
    const next = board.split('')
    ;[next[gap], next[tileIndex]] = [next[tileIndex], next[gap]]
    board = next.join('')
    previousTile = tile
  }
  return board
}
