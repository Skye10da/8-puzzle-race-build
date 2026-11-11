export const SOLVED_BOARD = '123456780'

export const DIFFICULTY_RANGES = Object.freeze({
  easy: [8, 12],
  medium: [16, 20],
  hard: [22, 26],
  extreme: [27, 31],
})

const POSITION_VALUES = Array.from({ length: 9 }, (_, index) => 16 ** index)
const BLANK_MOVES = Array.from({ length: 9 }, (_, blank) => [
  blank >= 3 ? blank - 3 : -1,
  blank < 6 ? blank + 3 : -1,
  blank % 3 > 0 ? blank - 1 : -1,
  blank % 3 < 2 ? blank + 1 : -1,
].filter(index => index >= 0))

let distanceMap
let statesByDistance

export function mulberry32(seed) {
  return () => {
    let value = seed += 0x6D2B79F5
    value = Math.imul(value ^ value >>> 15, value | 1)
    value ^= value + Math.imul(value ^ value >>> 7, value | 61)
    return ((value ^ value >>> 14) >>> 0) / 4294967296
  }
}

export function getNeighbors(board) {
  if (typeof board !== 'string' || board.length !== 9 || !/^([0-8]){9}$/.test(board) || new Set(board).size !== 9) {
    throw new TypeError('A puzzle board must contain each digit from 0 through 8 exactly once.')
  }
  const blank = board.indexOf('0')
  return BLANK_MOVES[blank].map(index => {
    const next = board.split('')
    ;[next[blank], next[index]] = [next[index], next[blank]]
    return next.join('')
  })
}

function encodeBoard(board) {
  if (typeof board !== 'string' || board.length !== 9 || !/^([0-8]){9}$/.test(board) || new Set(board).size !== 9) {
    throw new TypeError('A puzzle board must contain each digit from 0 through 8 exactly once.')
  }
  let encoded = 0
  for (let index = 0; index < 9; index++) encoded += Number(board[index]) * POSITION_VALUES[index]
  return encoded
}

function decodeBoard(encoded) {
  let board = ''
  for (let index = 0; index < 9; index++) board += Math.floor(encoded / POSITION_VALUES[index]) % 16
  return board
}

export function buildDistanceMap() {
  if (distanceMap) return distanceMap
  const start = encodeBoard(SOLVED_BOARD)
  const distances = new Map([[start, 0]])
  const queue = [start]
  const blankPositions = [8]
  const depthBuckets = [[start]]
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const board = queue[cursor]
    const blank = blankPositions[cursor]
    const nextDistance = distances.get(board) + 1
    for (const index of BLANK_MOVES[blank]) {
      const tile = Math.floor(board / POSITION_VALUES[index]) % 16
      const neighbor = board - tile * POSITION_VALUES[index] + tile * POSITION_VALUES[blank]
      if (distances.has(neighbor)) continue
      distances.set(neighbor, nextDistance)
      queue.push(neighbor)
      blankPositions.push(index)
      ;(depthBuckets[nextDistance] ??= []).push(neighbor)
    }
  }
  distanceMap = distances
  statesByDistance = depthBuckets
  return distanceMap
}

export function getOptimalMoves(board) {
  return buildDistanceMap().get(encodeBoard(board)) ?? null
}

export function createPuzzle(seed, difficulty = 'medium') {
  const range = DIFFICULTY_RANGES[difficulty]
  if (!range) throw new RangeError(`Unknown difficulty: ${difficulty}`)
  buildDistanceMap()
  let candidateCount = 0
  for (let depth = range[0]; depth <= range[1]; depth++) candidateCount += statesByDistance[depth].length
  let target = Math.floor(mulberry32(seed)() * candidateCount)
  for (let depth = range[0]; depth <= range[1]; depth++) {
    const bucket = statesByDistance[depth]
    if (target < bucket.length) return decodeBoard(bucket[target])
    target -= bucket.length
  }
  throw new Error('No puzzle states found for the selected difficulty.')
}
