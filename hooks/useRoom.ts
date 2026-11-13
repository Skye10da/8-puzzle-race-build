'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { Player, GameMode, RoundState } from '@/lib/game-types'
import { createPuzzle, getOptimalMoves, SOLVED_BOARD, type Difficulty } from '@/lib/puzzle-engine.mjs'
import { prefetchPuzzleEngine } from '@/lib/prefetch-puzzle.mjs'
import { estimateClockOffset, isDifficulty, isRoomCode, isValidBoard, parsePause, parsePlayer, parseRoundStart } from '@/lib/game-protocol.mjs'

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
  const host = hostGid === gidRef.current

  const synchronizeClock = async (channel: any, participantGid: string, currentHostGid: string) => {
    if (participantGid === currentHostGid) { clockOffsetRef.current = 0; return }
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
    clockOffsetRef.current = estimateClockOffset(samples)
  }

  const publish = useCallback(async (nextBoard = options.board, doneMs = options.me?.doneMs ?? null) => {
    const me = options.me
    if (!me) return
    const next = { ...me, board: nextBoard, moves: options.movesRef.current, doneMs, bestPossibleMoves: options.optimalMovesRef.current, hostGid, difficulty: options.difficulty }
    options.setMe(next)
    playersRef.current = playersRef.current.map(player => player.gid === next.gid ? next : player)
    setPlayers(current => current.map(player => player.gid === next.gid ? next : player))
    if (channelRef.current) {
      try { await channelRef.current.track(next); await channelRef.current.send({ type: 'broadcast', event: 'move', payload: next }) }
      catch { options.setMessage('Move is saved on this device; reconnecting to sync it with the room.') }
    }
  }, [options.board, options.me, options.difficulty, options.movesRef, options.optimalMovesRef, options.setMe, options.setMessage, hostGid])

  const enterRoom = async (requestedCode: string, restoredName = options.name, resumeData?: unknown, createRoom = false) => {
    const cleanName = restoredName.trim().slice(0, 12)
    if (!cleanName) return options.setMessage('Choose a name first.')
    if (!isRoomCode(requestedCode)) return options.setMessage('Enter a valid room code.')
    if (!supabase) return options.setMessage('Supabase is not configured. Add the two NEXT_PUBLIC environment variables to connect.')
    prefetchPuzzleEngine()
    const normalized = requestedCode.toUpperCase()
    clockOffsetRef.current = null
    clockHostRef.current = ''
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
      const localStartAt = clockOffsetRef.current === null ? Date.now() + 3000 : start.startAt - clockOffsetRef.current
      options.beginRound(start.seed, start.difficulty, localStartAt)
    }).on('broadcast', { event: 'restart' }, ({ payload }: { payload: unknown }) => {
      const start = parseRoundStart(payload)
      if (!start || start.gid !== playersRef.current[0]?.gid || start.gid === gid) return
      options.setDifficulty(start.difficulty)
      const localStartAt = clockOffsetRef.current === null ? Date.now() + 3000 : start.startAt - clockOffsetRef.current
      options.beginRound(start.seed, start.difficulty, localStartAt)
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
    const player: Player = restoredPlayer ? { ...restoredPlayer, name: cleanName, gid, joinedAt: joinedAtRef.current } : { name: cleanName, joinedAt: joinedAtRef.current, gid, board: SOLVED_BOARD, moves: 0, doneMs: null }
    const roomHostGid = playersRef.current[0]?.gid ?? gid
    const joinedPlayer = { ...player, hostGid: roomHostGid, difficulty: options.difficulty }
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
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
    reconnectTimerRef.current = null
    playersRef.current = []
    leftPlayersRef.current = []
    setPlayers([])
    setHostGid('')
  }

  const sendRound = async (event: 'start' | 'restart', seed: number, difficulty: Difficulty) => {
    const startAt = Date.now() + 3000
    if (channelRef.current) await channelRef.current.send({ type: 'broadcast', event, payload: { gid: gidRef.current, seed, difficulty, startAt } })
    return startAt
  }

  const sendPause = async (paused: boolean, elapsed: number) => {
    if (channelRef.current) await channelRef.current.send({ type: 'broadcast', event: 'pause', payload: { gid: gidRef.current, paused, elapsed } })
  }

  useEffect(() => () => {
    channelRef.current?.unsubscribe()
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
    for (const resolve of clockPongWaitersRef.current.values()) resolve(Date.now())
    clockPongWaitersRef.current.clear()
  }, [])

  return { players, playersRef, leftPlayersRef, hostGid, host, gidRef, joinedAtRef, channelRef, enterRoom, publish, createLocalPlayer, leaveRoom, sendRound, sendPause }
}
