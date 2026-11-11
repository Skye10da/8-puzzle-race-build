export type Difficulty = 'easy' | 'medium' | 'hard' | 'extreme'
export const SOLVED_BOARD: string
export const DIFFICULTY_RANGES: Readonly<Record<Difficulty, readonly [number, number]>>
export function mulberry32(seed: number): () => number
export function getNeighbors(board: string): string[]
export function buildDistanceMap(): Map<number, number>
export function getOptimalMoves(board: string): number | null
export function createPuzzle(seed: number, difficulty?: Difficulty): string
