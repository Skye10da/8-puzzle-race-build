'use client'

import { useCallback, useEffect, useState } from 'react'
import { parseStats } from '@/lib/game-protocol.mjs'
import type { BestRecord, BestStats } from '@/lib/game-types'
import { getUtcDateKey, parseDailyStats, recordDailyCompletion } from '@/lib/daily-stats.mjs'

type DailyStats = { best: BestRecord | null; today: { date: string; record: BestRecord } | null; streak: number; lastCompletedDate: string | null }
import type { Difficulty } from '@/lib/puzzle-engine.mjs'

export function useStats() {
  const [bestStats, setBestStats] = useState<BestStats>({})
  const [newBest, setNewBest] = useState(false)
  const [dailyStats, setDailyStats] = useState<DailyStats>({ best: null, today: null, streak: 0, lastCompletedDate: null })

  useEffect(() => {
    try { setBestStats(parseStats(JSON.parse(localStorage.getItem('puzzle-race-stats') || '{}'))) } catch { setBestStats({}) }
    try { setDailyStats(parseDailyStats(JSON.parse(localStorage.getItem('puzzle-race-daily-stats') || '{}'))) } catch { setDailyStats(parseDailyStats(null)) }
  }, [])

  const recordSoloResult = useCallback((difficulty: Difficulty, elapsedMs: number, moves: number) => {
    try {
      const current = parseStats(JSON.parse(localStorage.getItem('puzzle-race-stats') || '{}'))
      const previous = current[difficulty]
      const previousTime = previous?.bestTimeMs ?? Infinity
      const previousMoves = previous?.bestMoves ?? Infinity
      if (elapsedMs < previousTime || moves < previousMoves) {
        const updated = { ...current, [difficulty]: { bestTimeMs: Math.min(elapsedMs, previousTime), bestMoves: Math.min(moves, previousMoves) } }
        localStorage.setItem('puzzle-race-stats', JSON.stringify(updated))
        setBestStats(updated)
        setNewBest(true)
      }
    } catch { /* ignore unavailable storage */ }
  }, [])

  const recordDailyResult = useCallback((elapsedMs: number, moves: number) => {
    try {
      const current = parseDailyStats(JSON.parse(localStorage.getItem('puzzle-race-daily-stats') || '{}'))
      const updated = recordDailyCompletion(current, getUtcDateKey(), elapsedMs, moves)
      localStorage.setItem('puzzle-race-daily-stats', JSON.stringify(updated))
      setDailyStats(updated)
    } catch { /* ignore unavailable storage */ }
  }, [])

  const todayDailyResult = dailyStats.today?.date === getUtcDateKey() ? dailyStats.today.record : null
  return { bestStats, newBest, setNewBest, recordSoloResult, dailyBest: dailyStats.best, dailyStreak: dailyStats.streak, todayDailyResult, recordDailyResult }
}
