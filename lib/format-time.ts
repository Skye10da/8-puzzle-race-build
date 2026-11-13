export function formatTime(milliseconds: number) {
  if (milliseconds < 60_000) return `${(Math.floor(milliseconds / 10) / 100).toFixed(2)}s`
  const wholeSeconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(wholeSeconds / 60)
  const seconds = wholeSeconds % 60
  const centiseconds = Math.floor((milliseconds % 1000) / 10)
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`
}
