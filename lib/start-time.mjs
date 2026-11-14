export function isStartAtInRange(localStartAt, now) {
  return Number.isFinite(localStartAt) && Number.isFinite(now) && localStartAt >= now - 1000 && localStartAt <= now + 15_000
}
