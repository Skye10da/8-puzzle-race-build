'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { Player, GameMode, RoundState } from '@/lib/game-types'
import { createPuzzle, getOptimalMoves, SOLVED_BOARD, type Difficulty } from '@/lib/puzzle-engine.mjs'
import { prefetchPuzzleEngine } from '@/lib/prefetch-puzzle.mjs'
import { isStartAtInRange } from '@/lib/start-time.mjs'
import { canSendReaction, isReactionEmoji, parseReaction, type ReactionEmoji } from '@/lib/reactions.mjs'
import { estimateClockOffset, isDifficulty, isRoomCode, isSeriesLength, isValidBoard, parsePause, parsePlayer, parseRoundStart } from '@/lib/game-protocol.mjs'

type RoomSnapshot = {
  room: string
  name: string
  mode: GameMode
  board: string
  startBoard: string
  roundSeed: number | null
  roundDifficulty: Difficulty
  round: RoundState
  startedAt: number
  elapsed: number
  moves: number
  moveLog: string
  hintsEnabled: boolean
  hintsUsed: number
  seriesLength: 1 | 3 | 5
  seriesScored: boolean
  paused: boolean
  difficulty: Difficulty
  dailyMode: boolean
  dark: boolean
  gid: string
  joinedAt: number
  me: Player
}

type Options = {
  name: string
  difficulty: Difficulty
  room: string | null
  mode: GameMode
  board: string
  round: RoundState
  startedAt: number
  elapsed: number
  paused: boolean
  me: Player | null
  movesRef: MutableRefObject<number>
  moveLogRef: MutableRefObject<string>
  hintsEnabled: boolean
  hintsUsedRef: MutableRefObject<number>
  setHintsEnabled: Dispatch<SetStateAction<boolean>>
  setHintsUsed: Dispatch<SetStateAction<number>>
  seriesLength: 1 | 3 | 5
  setSeriesLength: Dispatch<SetStateAction<1 | 3 | 5>>
  seriesScoredRef: MutableRefObject<boolean>
  onReaction: (gid: string, emoji: ReactionEmoji) => void
  optimalMovesRef: MutableRefObject<number>
  initialBoardRef: MutableRefObject<string>
  roundSeedRef: MutableRefObject<number | null>
  roundDifficultyRef: MutableRefObject<Difficulty>
  reconnectSnapshotRef: MutableRefObject<RoomSnapshot | null>
  setRoom: Dispatch<SetStateAction<string | null>>
  setMode: Dispatch<SetStateAction<GameMode>>
  setDifficulty: Dispatch<SetStateAction<Difficulty>>
  setMe: Dispatch<SetStateAction<Player | null>>
  setBoard: Dispatch<SetStateAction<string>>
  setRound: Dispatch<SetStateAction<RoundState>>
  setStartedAt: Dispatch<SetStateAction<number>>
  setElapsed: Dispatch<SetStateAction<number>>
  setPaused: Dispatch<SetStateAction<boolean>>
  setMessage: Dispatch<SetStateAction<string>>
  setClockSyncWarning: Dispatch<SetStateAction<boolean>>
  beginRound: (seed: number, difficulty: Difficulty, startAt: number) => void
  unlockAudio: () => void
  startMusic: () => void
}

export function useRoom(options: Options) {
  const supabase = useMemo(() => getSupabaseClient(), [])
  const [players, setPlayers] = useState<Player[]>([])
  const [hostGid, setHostGid] = useState('')
  const playersRef = useRef<Player[]>([])
  const leftPlayersRef = useRef<Player[]>([])
  const channelRef = useRef<any>(null)
  const gidRef = useRef(Math.random().toString(36).slice(2, 10))
  const joinedAtRef = useRef(Date.now())
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const clockOffsetRef = useRef<number | null>(null)
  const clockPongWaitersRef = useRef(new Map<string, (hostAt: number) => void>())
  const clockHostRef = useRef('')
  const reactionReceivedAtRef = useRef(new Map<string, number>())
  const lastReactionSentAtRef = useRef<number | null>(null)
  const clockSyncRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const host = hostGid === gidRef.current

  const synchronizeClock: (channel: any, participantGid: string, currentHostGid: string, retrying?: boolean) => Promise<void> = async (channel, participantGid, currentHostGid, retrying = false) => {
    if (!retrying && clockSyncRetryRef.current) { clearTimeout(clockSyncRetryRef.current); clockSyncRetryRef.current = null }
    if (participantGid === currentHostGid) { clockOffsetRef.current = 0; options.setClockSyncWarning(false); return }
    const samples: Array<{ rttMs: number; offsetMs: number }> = []
    for (let index = 0; index < 3; index++) {
      const pingId = crypto.randomUUID()
      const sentAt = Date.now()
      const response = new Promise<{ hostAt: number; receivedAt: number } | null>(resolve => {
        const timeout = setTimeout(() => { clockPongWaitersRef.current.delete(pingId); resolve(null) }, 700)
        clockPongWaitersRef.current.set(pingId, hostAt => { clockPongWaitersRef.current.delete(pingId); clearTimeout(timeout); resolve({ hostAt, receivedAt: Date.now() }) })
      })
      try { await channel.send({ type: 'broadcast', event: 'clock-ping', payload: { fromGid: participantGid, pingId, sentAt } }) } catch { clockPongWaitersRef.current.delete(pingId); continue }
      const pong = await response
      if (pong) samples.push({ rttMs: pong.receivedAt - sentAt, offsetMs: pong.hostAt - (sentAt + pong.receivedAt) / 2 })
      if (index < 2) await new Promise(resolve => setTimeout(resolve, 80))
    }
    const offset = estimateClockOffset(samples)
    if (offset !== null) {
      clockOffsetRef.current = offset
      options.setClockSyncWarning(false)
      if (clockSyncRetryRef.current) clearTimeout(clockSyncRetryRef.current)
      clockSyncRetryRef.current = null
      return
    }
    clockOffsetRef.current = null
    if (!retrying) {
      clockSyncRetryRef.current = setTimeout(() => {
        clockSyncRetryRef.current = null
        if (channelRef.current === channel && clockHostRef.current === currentHostGid) void synchronizeClock(channel, participantGid, currentHostGid, true)
      }, 2000)
      return
    }
    if (channelRef.current === channel && clockHostRef.current === currentHostGid) options.setClockSyncWarning(true)
  }

  const updateSelfData = useCallback(async (update: Partial<Player>) => {
    const me = options.me
    if (!me) return
    const next = { ...me, ...update }
    options.setMe(next)
    playersRef.current = playersRef.current.map(player => player.gid === next.gid ? next : player)
    setPlayers(current => current.map(player => player.gid === next.gid ? next : player))
    if (channelRef.current) {
      try { await channelRef.current.track(next); await channelRef.current.send({ type: 'broadcast', event: 'move', payload: next }) }
      catch { options.setMessage('Series score is saved on this device; reconnecting to sync it with the room.') }
    }
  }, [options.me, options.setMe, options.setMessage])

  const resetSeriesState = (seriesLength: number) => {
    if (!isSeriesLength(seriesLength)) return
    options.setSeriesLength(seriesLength)
    options.seriesScoredRef.current = false
    options.movesRef.current = 0
    options.moveLogRef.current = ''
    options.hintsUsedRef.current = 0
    options.roundSeedRef.current = null
    options.initialBoardRef.current = SOLVED_BOARD
    options.optimalMovesRef.current = 0
    options.setHintsUsed(0)
    options.setBoard(SOLVED_BOARD)
    options.setRound('lobby')
    options.setStartedAt(0)
    options.setElapsed(0)
    options.setPaused(false)
    const current = playersRef.current.find(player => player.gid === gidRef.current)
    if (!current) return
    const next: Player = { ...current, board: SOLVED_BOARD, moves: 0, doneMs: null, hintsUsed: 0, points: 0, raceNumber: 1 }
    delete next.moveLog
    options.setMe(next)
    playersRef.current = playersRef.current.map(player => player.gid === next.gid ? next : player)
    setPlayers(all => all.map(player => player.gid === next.gid ? next : player))
    if (channelRef.current) void channelRef.current.track(next)
  }

  const publish = useCallback(async (nextBoard = options.board, doneMs = options.me?.doneMs ?? null, finishMoveLog?: string) => {
    const me = options.me
    if (!me) return
    const next: Player = { ...me, board: nextBoard, moves: options.movesRef.current, doneMs, bestPossibleMoves: options.optimalMovesRef.current, hostGid, difficulty: options.difficulty }
    if (doneMs !== null && typeof finishMoveLog === 'string') next.moveLog = finishMoveLog
    else delete next.moveLog
    next.hintsUsed = options.hintsUsedRef.current
    options.setMe(next)
    playersRef.current = playersRef.current.map(player => player.gid === next.gid ? next : player)
    setPlayers(current => current.map(player => player.gid === next.gid ? next : player))
    if (channelRef.current) {
      try { await channelRef.current.track(next); await channelRef.current.send({ type: 'broadcast', event: 'move', payload: next }) }
      catch { options.setMessage('Move is saved on this device; reconnecting to sync it with the room.') }
    }
  }, [options.board, options.me, options.difficulty, options.movesRef, options.moveLogRef, options.hintsUsedRef, options.optimalMovesRef, options.setMe, options.setMessage, hostGid])

  const enterRoom = async (requestedCode: string, restoredName = options.name, resumeData?: unknown, createRoom = false) => {
    const cleanName = restoredName.trim().slice(0, 12)
    if (!cleanName) return options.setMessage('Choose a name first.')
    if (!isRoomCode(requestedCode)) return options.setMessage('Enter a valid room code.')
    if (!supabase) return options.setMessage('Supabase is not configured. Add the two NEXT_PUBLIC environment variables to connect.')
    prefetchPuzzleEngine()
    const normalized = requestedCode.toUpperCase()
    clockOffsetRef.current = null
    clockHostRef.current = ''
    options.setClockSyncWarning(false)
    const saved = resumeData && typeof resumeData === 'object' ? resumeData as Record<string, any> : null
    if (!saved || saved.room !== normalized) { playersRef.current = []; leftPlayersRef.current = []; setPlayers([]) }
    const restoredPlayer = saved ? parsePlayer(saved.me) : null
    const activeSnapshotValid = saved?.round === 'lobby' || saved && ['countdown', 'racing', 'finished'].includes(saved.round) && isValidBoard(saved.board) && isValidBoard(saved.startBoard ?? saved.board) && Number.isFinite(saved.startedAt) && Number.isFinite(saved.elapsed) && saved.elapsed >= 0 && Number.isSafeInteger(saved.moves) && saved.moves >= 0
    if (saved && (!restoredPlayer || saved.gid && saved.gid !== restoredPlayer.gid || !activeSnapshotValid)) return options.setMessage('Saved race data is invalid. Rejoin the room to continue.')
    if (channelRef.current) await channelRef.current.unsubscribe()
    const gid = restoredPlayer?.gid ?? gidRef.current
    gidRef.current = gid
    if (restoredPlayer?.joinedAt) joinedAtRef.current = restoredPlayer.joinedAt
    const channel = supabase!.channel(`p8-${normalized}`, { config: { presence: { key: gid } } })
    let resolveSync!: () => void
    const presenceReady = new Promise<void>(resolve => { resolveSync = resolve })
    channel.on('presence', { event: 'sync' }, () => {
      const uniquePlayers = new Map<string, Player>()
      for (const [presenceKey, values] of Object.entries(channel.presenceState() as Record<string, unknown[]>)) {
        for (const value of values) {
          const player = parsePlayer(value)
          if (player && player.gid === presenceKey) uniquePlayers.set(presenceKey, player)
        }
      }
      const all = [...uniquePlayers.values()].sort((a, b) => a.joinedAt - b.joinedAt || a.gid.localeCompare(b.gid))
      const gone = playersRef.current.filter(previous => !all.some(player => player.gid === previous.gid) && previous.gid !== gid).map(player => ({ ...player, left: true }))
      leftPlayersRef.current = [...leftPlayersRef.current.filter(player => !all.some(active => active.gid === player.gid)), ...gone.filter(player => !leftPlayersRef.current.some(old => old.gid === player.gid))]
      playersRef.current = all
      if (all.length > 0) options.setMessage('')
      setPlayers([...all, ...leftPlayersRef.current])
      const nextHost = all[0]?.gid ?? ''
      if (all[0]?.difficulty) options.setDifficulty(all[0].difficulty)
      setHostGid(nextHost)
      if (nextHost === gid) clockOffsetRef.current = 0
      else if (nextHost && all.some(player => player.gid === gid) && nextHost !== clockHostRef.current) void synchronizeClock(channel, gid, nextHost)
      clockHostRef.current = nextHost
      resolveSync()
    }).on('broadcast', { event: 'move' }, ({ payload }: { payload: unknown }) => {
      const player = parsePlayer(payload)
      if (!player || player.gid === gid || !playersRef.current.some(active => active.gid === player.gid)) return
      playersRef.current = playersRef.current.map(current => current.gid === player.gid ? player : current)
      setPlayers(current => current.map(existing => existing.gid === player.gid ? player : existing))
    }).on('broadcast', { event: 'reaction' }, ({ payload }: { payload: unknown }) => {
      const reaction = parseReaction(payload)
      if (!reaction || reaction.gid === gid || !playersRef.current.some(player => player.gid === reaction.gid && player.left !== true)) return
      const now = Date.now()
      const previous = reactionReceivedAtRef.current.get(reaction.gid) ?? null
      if (!canSendReaction(previous, now)) return
      reactionReceivedAtRef.current.set(reaction.gid, now)
      options.onReaction(reaction.gid, reaction.emoji)
    }).on('broadcast', { event: 'clock-ping' }, ({ payload }: { payload: unknown }) => {
      if (!payload || typeof payload !== 'object') return
      const ping = payload as { fromGid?: unknown; pingId?: unknown; sentAt?: unknown }
      if (playersRef.current[0]?.gid !== gid || typeof ping.fromGid !== 'string' || typeof ping.pingId !== 'string' || !Number.isFinite(ping.sentAt) || !playersRef.current.some(player => player.gid === ping.fromGid)) return
      void channel.send({ type: 'broadcast', event: 'clock-pong', payload: { toGid: ping.fromGid, pingId: ping.pingId, hostAt: Date.now() } }).catch(() => {})
    }).on('broadcast', { event: 'clock-pong' }, ({ payload }: { payload: unknown }) => {
      if (!payload || typeof payload !== 'object') return
      const pong = payload as { toGid?: unknown; pingId?: unknown; hostAt?: unknown }
      if (pong.toGid !== gid || typeof pong.pingId !== 'string' || !Number.isFinite(pong.hostAt)) return
      const resolve = clockPongWaitersRef.current.get(pong.pingId)
      if (resolve) resolve(pong.hostAt as number)
    }).on('broadcast', { event: 'start' }, ({ payload }: { payload: unknown }) => {
      const start = parseRoundStart(payload)
      if (!start || start.gid !== playersRef.current[0]?.gid || start.gid === gid) return
      options.setDifficulty(start.difficulty)
      options.setHintsEnabled(start.hints)
      options.setSeriesLength(start.seriesLength)
      const now = Date.now()
      const localStartAt = clockOffsetRef.current === null ? now + 3000 : start.startAt - clockOffsetRef.current
      if (!isStartAtInRange(localStartAt, now)) { options.setMessage('Ignored an invalid start time from the host.'); return }
      options.beginRound(start.seed, start.difficulty, localStartAt)
    }).on('broadcast', { event: 'restart' }, ({ payload }: { payload: unknown }) => {
      const start = parseRoundStart(payload)
      if (!start || start.gid !== playersRef.current[0]?.gid || start.gid === gid) return
      options.setDifficulty(start.difficulty)
      options.setHintsEnabled(start.hints)
      options.setSeriesLength(start.seriesLength)
      const now = Date.now()
      const localStartAt = clockOffsetRef.current === null ? now + 3000 : start.startAt - clockOffsetRef.current
      if (!isStartAtInRange(localStartAt, now)) { options.setMessage('Ignored an invalid start time from the host.'); return }
      options.beginRound(start.seed, start.difficulty, localStartAt)
    }).on('broadcast', { event: 'series-reset' }, ({ payload }: { payload: unknown }) => {
      if (!payload || typeof payload !== 'object') return
      const reset = payload as { gid?: unknown; seriesLength?: unknown }
      if (reset.gid !== playersRef.current[0]?.gid || !isSeriesLength(reset.seriesLength)) return
      resetSeriesState(reset.seriesLength)
    }).on('broadcast', { event: 'pause' }, ({ payload }: { payload: unknown }) => {
      const pause = parsePause(payload)
      if (!pause || pause.gid !== playersRef.current[0]?.gid || pause.gid === gid) return
      options.setElapsed(pause.elapsed)
      if (!pause.paused) options.setStartedAt(Date.now() - pause.elapsed)
      options.setPaused(pause.paused)
    })
    channel.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') { reconnectAttemptsRef.current = 0; options.setMessage('') }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        if (channelRef.current && channelRef.current !== channel) return
        options.setMessage('Connection lost. Reconnecting…')
        if (reconnectAttemptsRef.current < 3 && !reconnectTimerRef.current) {
          reconnectAttemptsRef.current += 1
          const savedGame = options.reconnectSnapshotRef.current ?? saved
          reconnectTimerRef.current = setTimeout(() => { reconnectTimerRef.current = null; void enterRoom(normalized, cleanName, savedGame, createRoom) }, reconnectAttemptsRef.current * 1000)
        } else if (reconnectAttemptsRef.current >= 3) options.setMessage('Unable to reconnect. Check your connection, then rejoin the room.')
      }
    })
    const synced = await Promise.race([presenceReady.then(() => true), new Promise<boolean>(resolve => setTimeout(() => resolve(false), 2500))])
    if (!synced) { await channel.unsubscribe(); options.setMessage('Could not reach this room. It may have expired or the room code is invalid.'); return }
    const occupied = [...new Set(playersRef.current.map(player => player.gid).filter(playerGid => playerGid !== gid))]
    if (occupied.length >= 4) { await channel.unsubscribe(); options.setMessage('Room is full. This race already has four players.'); return }
    if (!createRoom && !saved && occupied.length === 0) { await channel.unsubscribe(); options.setMessage('No active room found with that code. Check the code or ask the host for a fresh link.'); return }
    const player: Player = restoredPlayer ? { ...restoredPlayer, name: cleanName, gid, joinedAt: joinedAtRef.current } : { name: cleanName, joinedAt: joinedAtRef.current, gid, board: SOLVED_BOARD, moves: 0, doneMs: null, hintsUsed: 0, points: 0, raceNumber: playersRef.current[0]?.raceNumber ?? 1 }
    const roomHostGid = playersRef.current[0]?.gid ?? gid
    const joinedPlayer = { ...player, hostGid: roomHostGid, difficulty: options.difficulty, hintsUsed: player.hintsUsed ?? 0, points: player.points ?? 0, raceNumber: player.raceNumber ?? playersRef.current[0]?.raceNumber ?? 1 }
    channelRef.current = channel
    options.setRoom(normalized)
    options.setMode('multi')
    setHostGid(roomHostGid)
    options.setMe(joinedPlayer)
    playersRef.current = [...playersRef.current, joinedPlayer]
    options.unlockAudio()
    options.startMusic()
    await channel.track(joinedPlayer)
    if (roomHostGid !== gid) void synchronizeClock(channel, gid, roomHostGid)
    if (saved?.round && saved.round !== 'lobby') {
      options.setBoard(saved.board)
      options.roundSeedRef.current = Number.isSafeInteger(saved.roundSeed) ? saved.roundSeed : null
      options.roundDifficultyRef.current = isDifficulty(saved.roundDifficulty) ? saved.roundDifficulty : options.difficulty
      options.initialBoardRef.current = saved.startBoard ?? saved.board
      options.optimalMovesRef.current = getOptimalMoves(options.initialBoardRef.current) ?? 0
      options.movesRef.current = saved.moves ?? 0
      options.moveLogRef.current = typeof saved.moveLog === 'string' ? saved.moveLog : ''
      options.hintsUsedRef.current = Number.isSafeInteger(saved.hintsUsed) ? saved.hintsUsed : restoredPlayer?.hintsUsed ?? 0
      options.setHintsUsed(options.hintsUsedRef.current)
      options.setHintsEnabled(Boolean(saved.hintsEnabled))
      options.setSeriesLength(isSeriesLength(saved.seriesLength) ? saved.seriesLength : 1)
      options.seriesScoredRef.current = Boolean(saved.seriesScored)
      options.setRound(saved.round)
      options.setStartedAt(saved.startedAt)
      options.setElapsed(saved.elapsed ?? 0)
      options.setPaused(Boolean(saved.paused))
    }
  }

  useEffect(() => { if (options.mode === 'multi' && (options.round === 'lobby' || options.round === 'finished') && host && options.me && channelRef.current) void channelRef.current.track({ ...options.me, hostGid, difficulty: options.difficulty }) }, [options.difficulty, options.me, options.mode, options.round, hostGid, host])

  const createLocalPlayer = (player: Player) => {
    playersRef.current = [player]
    setPlayers([player])
    setHostGid(player.gid)
    gidRef.current = player.gid
    joinedAtRef.current = player.joinedAt
  }

  const leaveRoom = () => {
    channelRef.current?.unsubscribe()
    channelRef.current = null
    if (clockSyncRetryRef.current) clearTimeout(clockSyncRetryRef.current)
    clockSyncRetryRef.current = null
    options.setClockSyncWarning(false)
    reactionReceivedAtRef.current.clear()
    lastReactionSentAtRef.current = null
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
    reconnectTimerRef.current = null
    playersRef.current = []
    leftPlayersRef.current = []
    setPlayers([])
    setHostGid('')
  }

  const sendRound = async (event: 'start' | 'restart', seed: number, difficulty: Difficulty, hints = options.hintsEnabled, seriesLength = options.seriesLength) => {
    const startAt = Date.now() + 3000
    if (channelRef.current) await channelRef.current.send({ type: 'broadcast', event, payload: { gid: gidRef.current, seed, difficulty, startAt, hints, seriesLength } })
    return startAt
  }

  const startNewSeries = async (seriesLength: number) => {
    if (!host || !isSeriesLength(seriesLength)) return
    if (channelRef.current) await channelRef.current.send({ type: 'broadcast', event: 'series-reset', payload: { gid: gidRef.current, seriesLength } })
    resetSeriesState(seriesLength)
  }

  const sendReaction = async (emoji: ReactionEmoji) => {
    const now = Date.now()
    if (!channelRef.current || !isReactionEmoji(emoji) || !canSendReaction(lastReactionSentAtRef.current, now)) return false
    lastReactionSentAtRef.current = now
    try {
      await channelRef.current.send({ type: 'broadcast', event: 'reaction', payload: { gid: gidRef.current, emoji } })
      return true
    } catch {
      options.setMessage('Could not send that reaction. Check your connection and try again.')
      return false
    }
  }

  const sendPause = async (paused: boolean, elapsed: number) => {
    if (channelRef.current) await channelRef.current.send({ type: 'broadcast', event: 'pause', payload: { gid: gidRef.current, paused, elapsed } })
  }

  useEffect(() => () => {
    channelRef.current?.unsubscribe()
    if (clockSyncRetryRef.current) clearTimeout(clockSyncRetryRef.current)
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
    for (const resolve of clockPongWaitersRef.current.values()) resolve(Date.now())
    clockPongWaitersRef.current.clear()
  }, [])

  return { players, playersRef, leftPlayersRef, hostGid, host, gidRef, joinedAtRef, channelRef, enterRoom, publish, updateSelfData, createLocalPlayer, leaveRoom, sendRound, sendPause, sendReaction, startNewSeries }
}
