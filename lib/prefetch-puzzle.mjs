import { buildDistanceMap } from './puzzle-engine.mjs'

export function prefetchPuzzleEngine() {
  if (typeof window === 'undefined') return
  const idleWindow = window
  if (typeof idleWindow.requestIdleCallback === 'function') {
    idleWindow.requestIdleCallback(() => buildDistanceMap())
    return
  }
  window.setTimeout(() => buildDistanceMap(), 0)
}
