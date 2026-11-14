function validDateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function validRecord(value) {
  return value && typeof value === 'object' && Number.isFinite(value.bestTimeMs) && value.bestTimeMs >= 0 && Number.isSafeInteger(value.bestMoves) && value.bestMoves >= 0 && value.bestMoves <= 1_000_000
}

export function getUtcDateKey(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10)
}

export function parseDailyStats(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { best: null, today: null, streak: 0, lastCompletedDate: null }
  const best = validRecord(value.best) ? { bestTimeMs: value.best.bestTimeMs, bestMoves: value.best.bestMoves } : null
  const today = value.today && validDateKey(value.today.date) && validRecord(value.today.record) ? { date: value.today.date, record: { bestTimeMs: value.today.record.bestTimeMs, bestMoves: value.today.record.bestMoves } } : null
  const streak = Number.isSafeInteger(value.streak) && value.streak >= 0 ? value.streak : 0
  const lastCompletedDate = validDateKey(value.lastCompletedDate) ? value.lastCompletedDate : null
  return { best, today, streak, lastCompletedDate }
}

export function recordDailyCompletion(currentValue, date, elapsedMs, moves) {
  if (!validDateKey(date) || !Number.isFinite(elapsedMs) || elapsedMs < 0 || !Number.isSafeInteger(moves) || moves < 0 || moves > 1_000_000) return parseDailyStats(currentValue)
  const current = parseDailyStats(currentValue)
  const record = { bestTimeMs: elapsedMs, bestMoves: moves }
  const best = current.best ? { bestTimeMs: Math.min(elapsedMs, current.best.bestTimeMs), bestMoves: Math.min(moves, current.best.bestMoves) } : record
  const todayRecord = current.today?.date === date ? current.today.record : null
  const today = { date, record: todayRecord ? { bestTimeMs: Math.min(elapsedMs, todayRecord.bestTimeMs), bestMoves: Math.min(moves, todayRecord.bestMoves) } : record }
  const yesterday = new Date(`${date}T00:00:00.000Z`)
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  const yesterdayKey = yesterday.toISOString().slice(0, 10)
  const streak = current.lastCompletedDate === date ? current.streak : current.lastCompletedDate === yesterdayKey ? current.streak + 1 : 1
  return { best, today, streak, lastCompletedDate: date }
}
