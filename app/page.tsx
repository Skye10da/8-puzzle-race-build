'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Moon, Sun, Trophy, Users, Wifi, Copy, RotateCcw, Menu, Pause, Play, Square, CircleHelp } from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { createPuzzle, getNeighbors, getOptimalMoves, SOLVED_BOARD, type Difficulty } from '@/lib/puzzle-engine.mjs'
import { isDifficulty, isRoomCode, isValidBoard, parsePause, parsePlayer, parseRoundStart, parseStats } from '@/lib/game-protocol.mjs'

type Player = { name: string; joinedAt: number; gid: string; board: string; moves: number; doneMs: number | null; hostGid?: string; difficulty?: Difficulty; bestPossibleMoves?: number; left?: boolean }
const solved = SOLVED_BOARD
const colors = ['#4f9b68', '#d58b4c', '#6e86bc', '#b76a8e']
const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function roomCode() { return Array.from(crypto.getRandomValues(new Uint8Array(10)), byte => ROOM_ALPHABET[byte % ROOM_ALPHABET.length]).join('') }
function canSlide(board: string, index: number) { return index >= 0 && index < 9 && getNeighbors(board).includes(swapForSlide(board, index)) }
function swapForSlide(board: string, index: number) { const gap = board.indexOf('0'); if (index < 0 || index > 8) return ''; const next = board.split(''); [next[index], next[gap]] = [next[gap], next[index]]; return next.join('') }
function MiniBoard({ board }: { board: string }) { return <div className="mini-board">{board.split('').map((n, i) => <span key={i} className={n === '0' ? 'gap' : ''}>{n === '0' ? '' : n}</span>)}</div> }

export default function Page() {
  const supabase = useMemo(() => getSupabaseClient(), [])
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [room, setRoom] = useState<string | null>(null)
  const [mode, setMode] = useState<'select' | 'single' | 'multi'>('single')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [bestStats, setBestStats] = useState<Record<string, { bestTimeMs: number; bestMoves: number }>>({})
  const [newBest, setNewBest] = useState(false)
  const [dailyMode, setDailyMode] = useState(false)
  const [players, setPlayers] = useState<Player[]>([])
  const playersRef = useRef<Player[]>([])
  const leftPlayersRef = useRef<Player[]>([])
  const [me, setMe] = useState<Player | null>(null)
  const [board, setBoard] = useState(solved)
  const [round, setRound] = useState<'lobby' | 'countdown' | 'racing' | 'finished'>('lobby')
  const [count, setCount] = useState(3)
  const [startedAt, setStartedAt] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [hostGid, setHostGid] = useState('')
    const initialBoardRef = useRef(solved)
  const optimalMovesRef = useRef(0)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const reconnectSnapshotRef = useRef<any>(null)
  const [message, setMessage] = useState('')
  const [dark, setDark] = useState(false)
  const channelRef = useRef<any>(null)
  const gidRef = useRef(Math.random().toString(36).slice(2, 10))
  const joinedAtRef = useRef(Date.now())
  const movesRef = useRef(0)
  const audioRef = useRef<AudioContext | null>(null)
  const musicTimerRef = useRef<number | null>(null)
  const [musicOn, setMusicOn] = useState(true)
  const [soundOn, setSoundOn] = useState(true)
  const [vibrationOn, setVibrationOn] = useState(true)
  const [copied, setCopied] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [paused, setPaused] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => { try { const saved = JSON.parse(localStorage.getItem('puzzle-race-settings') || '{}'); if (saved && typeof saved === 'object' && !Array.isArray(saved)) { if (typeof saved.name === 'string') setName(saved.name.slice(0, 12)); if (isDifficulty(saved.difficulty)) setDifficulty(saved.difficulty); if (typeof saved.soundOn === 'boolean') setSoundOn(saved.soundOn); if (typeof saved.vibrationOn === 'boolean') setVibrationOn(saved.vibrationOn) } const stats = parseStats(JSON.parse(localStorage.getItem('puzzle-race-stats') || '{}')); setBestStats(stats); const sharedRoom = new URLSearchParams(window.location.search).get('room'); if (sharedRoom && isRoomCode(sharedRoom)) { setCode(sharedRoom.toUpperCase()); setMode('multi') } } catch { /* ignore unavailable storage */ } }, [])
  useEffect(() => { try { localStorage.setItem('puzzle-race-settings', JSON.stringify({ name, difficulty, soundOn, vibrationOn })) } catch { /* ignore unavailable storage */ } }, [name, difficulty, soundOn, vibrationOn])

  const getAudio = () => {
    if (typeof window === 'undefined' || !soundOn) return null
    if (typeof window.AudioContext !== 'function') return null
    audioRef.current ??= new window.AudioContext()
    if (audioRef.current.state === 'suspended') void audioRef.current.resume()
    return audioRef.current
  }
  const tone = (frequency: number, duration = 0.08, type: OscillatorType = 'sine', volume = 0.045) => {
    const audio = getAudio(); if (!audio) return
    const oscillator = audio.createOscillator(); const gain = audio.createGain()
    oscillator.type = type; oscillator.frequency.value = frequency; gain.gain.setValueAtTime(volume, audio.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration)
    oscillator.connect(gain).connect(audio.destination); oscillator.start(); oscillator.stop(audio.currentTime + duration)
  }
  const startMusic = () => {
    if (!musicOn || musicTimerRef.current !== null) return
    const notes = [196, 247, 294, 247, 220, 262, 330, 262]; let step = 0
    musicTimerRef.current = window.setInterval(() => tone(notes[step++ % notes.length], 0.28, 'triangle', 0.012), 360)
  }
  const stopMusic = () => { if (musicTimerRef.current !== null) { window.clearInterval(musicTimerRef.current); musicTimerRef.current = null } }

  const host = hostGid === gidRef.current
  useEffect(() => {
    try {
      const savedTheme = sessionStorage.getItem('puzzle-race-theme')
      if (savedTheme === 'dark' || savedTheme === 'light') setDark(savedTheme === 'dark')
      const inviteRoom = new URLSearchParams(window.location.search).get('room')
      if (inviteRoom && isRoomCode(inviteRoom)) { setCode(inviteRoom.toUpperCase()); setMode('multi'); return }
      const saved = sessionStorage.getItem('puzzle-race-session')
      if (!saved) return
      const data = JSON.parse(saved)
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new TypeError('Invalid saved session')
      if (data.savedAt !== undefined && (!Number.isFinite(data.savedAt) || data.savedAt > Date.now() + 60_000 || Date.now() - data.savedAt > 24 * 60 * 60 * 1000)) { sessionStorage.removeItem('puzzle-race-session'); setMessage('This saved game expired. Start a new puzzle.'); return }
      if (typeof data.name === 'string') setName(data.name.slice(0, 12))
      if (typeof data.dark === 'boolean') setDark(data.dark)
      if (isDifficulty(data.difficulty)) setDifficulty(data.difficulty)
      setDailyMode(Boolean(data.dailyMode))
      if (data.mode === 'single' && data.round !== 'lobby') {
        const player = parsePlayer(data.me)
        const validRound = ['countdown', 'racing', 'finished'].includes(data.round)
        if (!player || !validRound || !isValidBoard(data.board) || !isValidBoard(data.startBoard ?? data.board) || !Number.isFinite(data.startedAt) || !Number.isFinite(data.elapsed) || data.elapsed < 0 || !Number.isSafeInteger(data.moves) || data.moves < 0) throw new TypeError('Invalid saved game state')
        setMode('single'); setRoom('solo'); setBoard(data.board); setRound(data.round); setStartedAt(data.startedAt); setElapsed(data.elapsed); setPaused(Boolean(data.paused)); initialBoardRef.current = data.startBoard ?? data.board; optimalMovesRef.current = getOptimalMoves(initialBoardRef.current) ?? 0; movesRef.current = data.moves; gidRef.current = player.gid; joinedAtRef.current = player.joinedAt; setHostGid(player.gid); setMe(player); playersRef.current = [player]; setPlayers([player])
      }
    } catch { try { sessionStorage.removeItem('puzzle-race-session') } catch { /* storage unavailable */ } }
  }, [])
  useEffect(() => { try { sessionStorage.setItem('puzzle-race-theme', dark ? 'dark' : 'light') } catch { /* ignore unavailable session storage */ } }, [dark])
  useEffect(() => { if (!room || !me) return; try { sessionStorage.setItem('puzzle-race-session', JSON.stringify({ name, mode, room, board, startBoard: initialBoardRef.current, round, startedAt, elapsed, moves: movesRef.current, paused, difficulty, dailyMode, dark, gid: me.gid, joinedAt: me.joinedAt, savedAt: Date.now(), me })) } catch { /* ignore unavailable session storage */ } }, [name, mode, room, board, round, startedAt, dark, paused, difficulty, dailyMode, me])
  useEffect(() => { if (room && me) reconnectSnapshotRef.current = { name, mode, room, board, startBoard: initialBoardRef.current, round, startedAt, elapsed, moves: movesRef.current, paused, difficulty, dailyMode, dark, gid: me.gid, joinedAt: me.joinedAt, me } }, [name, mode, room, board, round, startedAt, elapsed, paused, difficulty, dailyMode, dark, me])
  const publish = useCallback(async (nextBoard = board, doneMs = me?.doneMs ?? null) => { if (!me) return; const next = { ...me, board: nextBoard, moves: movesRef.current, doneMs, bestPossibleMoves: optimalMovesRef.current, hostGid, difficulty }; setMe(next); playersRef.current = playersRef.current.map(player => player.gid === next.gid ? next : player); setPlayers(current => current.map(p => p.gid === next.gid ? next : p)); if (channelRef.current) { try { await channelRef.current.track(next); await channelRef.current.send({ type: 'broadcast', event: 'move', payload: next }) } catch { setMessage('Move is saved on this device; reconnecting to sync it with the room.') } } }, [board, me, hostGid, difficulty])
  const beginRound = useCallback((seed: number, selectedDifficulty: Difficulty = difficulty, sharedStartAt = Date.now() + 3000) => { const newBoard = createPuzzle(seed, selectedDifficulty); initialBoardRef.current = newBoard; optimalMovesRef.current = getOptimalMoves(newBoard) ?? 0; setBoard(newBoard); movesRef.current = 0; setRound('countdown'); setCount(Math.max(1, Math.ceil((sharedStartAt - Date.now()) / 1000))); setStartedAt(sharedStartAt); setElapsed(0); setPaused(false); setMe(p => p ? { ...p, board: newBoard, moves: 0, doneMs: null, bestPossibleMoves: optimalMovesRef.current } : p) }, [difficulty])

  useEffect(() => { document.documentElement.classList.toggle('dark', dark) }, [dark])
  useEffect(() => { if (round !== 'countdown') return; const tick = () => { const remaining = startedAt - Date.now(); setCount(Math.max(0, Math.ceil(remaining / 1000))); if (remaining <= 0) setRound('racing') }; tick(); const timer = setInterval(tick, 50); return () => clearInterval(timer) }, [round, startedAt])
  useEffect(() => { if (round !== 'racing' || paused) return; const timer = setInterval(() => setElapsed(Date.now() - startedAt), 200); return () => clearInterval(timer) }, [round, startedAt, paused])
  useEffect(() => () => { channelRef.current?.unsubscribe(); stopMusic(); if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current) }, [])
  useEffect(() => { if (!musicOn) stopMusic(); else if (room) startMusic() }, [musicOn, room])
  useEffect(() => {
    if (!menuOpen) return
    const closeOnOutsideClick = (event: PointerEvent) => { if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false) }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [menuOpen])

  useEffect(() => { if (mode === 'multi' && round === 'lobby' && host && me && channelRef.current) void channelRef.current.track({ ...me, hostGid, difficulty }) }, [difficulty, hostGid, host, mode, round, me])
  const autoJoinRef = useRef(false)
  const enterRoom = async (requestedCode: string, restoredName = name, resumeData?: any, createRoom = false) => {
    const cleanName = restoredName.trim().slice(0, 12)
    if (!cleanName) return setMessage('Choose a name first.')
    if (!isRoomCode(requestedCode)) return setMessage('Enter a valid room code.')
    if (!supabase) return setMessage('Supabase is not configured. Add the two NEXT_PUBLIC environment variables to connect.')
    const normalized = requestedCode.toUpperCase()
    if (!resumeData || resumeData.room !== normalized) { playersRef.current = []; leftPlayersRef.current = []; setPlayers([]) }
    const restoredPlayer = resumeData ? parsePlayer(resumeData.me) : null
    const activeSnapshotValid = resumeData?.round === 'lobby' || resumeData && ['countdown', 'racing', 'finished'].includes(resumeData.round) && isValidBoard(resumeData.board) && isValidBoard(resumeData.startBoard ?? resumeData.board) && Number.isFinite(resumeData.startedAt) && Number.isFinite(resumeData.elapsed) && resumeData.elapsed >= 0 && Number.isSafeInteger(resumeData.moves) && resumeData.moves >= 0
    if (resumeData && (!restoredPlayer || resumeData.gid && resumeData.gid !== restoredPlayer.gid || !activeSnapshotValid)) return setMessage('Saved race data is invalid. Rejoin the room to continue.')
    if (channelRef.current) await channelRef.current.unsubscribe()
    const gid = restoredPlayer?.gid ?? gidRef.current
    gidRef.current = gid
    if (restoredPlayer?.joinedAt) joinedAtRef.current = restoredPlayer.joinedAt
    const channel = supabase.channel(`p8-${normalized}`, { config: { presence: { key: gid } } })
    let resolveSync!: () => void
    const presenceReady = new Promise<void>(resolve => { resolveSync = resolve })
    channel.on('presence', { event: 'sync' }, () => {
      const all = [...new Map(Object.entries(channel.presenceState()).flatMap(([presenceKey, values]) => values.flatMap(value => { const player = parsePlayer(value); return player && player.gid === presenceKey ? [[presenceKey, player]] : [] }))).values()].sort((a, b) => a.joinedAt - b.joinedAt || a.gid.localeCompare(b.gid))
      const gone = playersRef.current.filter(previous => !all.some(player => player.gid === previous.gid) && previous.gid !== gid).map(player => ({ ...player, left: true }))
      leftPlayersRef.current = [...leftPlayersRef.current.filter(player => !all.some(active => active.gid === player.gid)), ...gone.filter(player => !leftPlayersRef.current.some(old => old.gid === player.gid))]
      playersRef.current = all
      if (all.length > 0) setMessage('')
      setPlayers([...all, ...leftPlayersRef.current])
      const nextHost = all[0]?.gid ?? ''
      if (all[0]?.difficulty) setDifficulty(all[0].difficulty)
      setHostGid(nextHost)
      resolveSync()
    }).on('broadcast', { event: 'move' }, ({ payload }: { payload: unknown }) => { const player = parsePlayer(payload); if (!player || player.gid === gid || !playersRef.current.some(active => active.gid === player.gid)) return; playersRef.current = playersRef.current.map(current => current.gid === player.gid ? player : current); setPlayers(current => current.map(existing => existing.gid === player.gid ? player : existing)) }).on('broadcast', { event: 'start' }, ({ payload }: { payload: unknown }) => { const start = parseRoundStart(payload); if (!start || start.gid !== playersRef.current[0]?.gid || start.gid === gid) return; setDifficulty(start.difficulty); beginRound(start.seed, start.difficulty, Date.now() + start.countdownMs) }).on('broadcast', { event: 'restart' }, ({ payload }: { payload: unknown }) => { const start = parseRoundStart(payload); if (!start || start.gid !== playersRef.current[0]?.gid || start.gid === gid) return; setDifficulty(start.difficulty); beginRound(start.seed, start.difficulty, Date.now() + start.countdownMs) }).on('broadcast', { event: 'pause' }, ({ payload }: { payload: unknown }) => { const pause = parsePause(payload); if (!pause || pause.gid !== playersRef.current[0]?.gid || pause.gid === gid) return; setElapsed(pause.elapsed); if (!pause.paused) setStartedAt(Date.now() - pause.elapsed); setPaused(pause.paused) })
    channel.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') { reconnectAttemptsRef.current = 0; setMessage('') }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        if (channelRef.current && channelRef.current !== channel) return
        setMessage('Connection lost. Reconnecting…')
        if (reconnectAttemptsRef.current < 3 && !reconnectTimerRef.current) {
          reconnectAttemptsRef.current += 1
          const savedGame = reconnectSnapshotRef.current ?? resumeData
          reconnectTimerRef.current = setTimeout(() => { reconnectTimerRef.current = null; void enterRoom(normalized, cleanName, savedGame, createRoom) }, reconnectAttemptsRef.current * 1000)
        } else if (reconnectAttemptsRef.current >= 3) setMessage('Unable to reconnect. Check your connection, then rejoin the room.')
      }
    })
    const synced = await Promise.race([presenceReady.then(() => true), new Promise<boolean>(resolve => setTimeout(() => resolve(false), 2500))])
    if (!synced) { await channel.unsubscribe(); setMessage('Could not reach this room. It may have expired or the room code is invalid.'); return }
    const occupied = [...new Set(playersRef.current.map(player => player.gid).filter(playerGid => playerGid !== gid))]
    if (occupied.length >= 4) { await channel.unsubscribe(); setMessage('Room is full. This race already has four players.'); return }
    if (!createRoom && !resumeData && occupied.length === 0) { await channel.unsubscribe(); setMessage('No active room found with that code. Check the code or ask the host for a fresh link.'); return }
    const player: Player = restoredPlayer ? { ...restoredPlayer, name: cleanName, gid, joinedAt: joinedAtRef.current } : { name: cleanName, joinedAt: joinedAtRef.current, gid, board: solved, moves: 0, doneMs: null }
    const roomHostGid = playersRef.current[0]?.gid ?? gid
    const joinedPlayer = { ...player, hostGid: roomHostGid, difficulty }
    channelRef.current = channel; setRoom(normalized); setMode('multi'); setHostGid(roomHostGid); setMe(joinedPlayer); playersRef.current = [...playersRef.current, joinedPlayer]; getAudio(); startMusic()
    await channel.track(joinedPlayer)
    if (resumeData?.round && resumeData.round !== 'lobby') { setBoard(resumeData.board); initialBoardRef.current = resumeData.startBoard ?? resumeData.board; optimalMovesRef.current = getOptimalMoves(initialBoardRef.current) ?? 0; movesRef.current = resumeData.moves ?? 0; setRound(resumeData.round); setStartedAt(resumeData.startedAt); setElapsed(resumeData.elapsed ?? 0); setPaused(Boolean(resumeData.paused)) }
  }
  useEffect(() => { if (!room && mode === 'multi' && name.trim() && isRoomCode(code) && new URLSearchParams(window.location.search).get('room') && !autoJoinRef.current) { autoJoinRef.current = true; void enterRoom(code) } }, [code, mode, name, room])
  const restoredMultiRef = useRef(false)
  useEffect(() => {
    if (restoredMultiRef.current || room) return
    const invitation = new URLSearchParams(window.location.search).get('room')
    if (invitation && isRoomCode(invitation)) return
    try {
      const saved = sessionStorage.getItem('puzzle-race-session')
      if (!saved) return
      const data = JSON.parse(saved)
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new TypeError('Invalid saved room')
      if (data.savedAt !== undefined && (!Number.isFinite(data.savedAt) || data.savedAt > Date.now() + 60_000 || Date.now() - data.savedAt > 24 * 60 * 60 * 1000)) { sessionStorage.removeItem('puzzle-race-session'); setMessage('This saved room has expired. Join or create a new room.'); return }
      if (data.mode === 'multi') {
        if (!isRoomCode(data.room) || typeof data.name !== 'string' || !parsePlayer(data.me)) { sessionStorage.removeItem('puzzle-race-session'); setMessage('Saved room details are invalid. Join the room again.'); return }
        restoredMultiRef.current = true; setName(data.name.slice(0, 12)); void enterRoom(data.room, data.name, data)
      }
    } catch { try { sessionStorage.removeItem('puzzle-race-session') } catch { /* storage unavailable */ } }
  }, [room])
  const copyToClipboard = async (value: string) => { try { if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable'); await navigator.clipboard.writeText(value); setCopied('copied'); setMessage(''); window.setTimeout(() => setCopied(''), 1400) } catch { setCopied(''); setMessage('Could not copy automatically. Please copy the room code or link manually.') } }
  const celebrate = () => { stopMusic(); [523, 659, 784, 1047].forEach((note, i) => window.setTimeout(() => tone(note, 0.22, 'sine', 0.07), i * 110)) }
  const start = async () => { if (mode === 'multi' && !host) return; setNewBest(false); const seed = Math.floor(Math.random() * 2147483647); const countdownMs = 3000; try { await channelRef.current?.send({ type: 'broadcast', event: 'start', payload: { gid: gidRef.current, seed, difficulty, countdownMs } }); beginRound(seed, difficulty, Date.now() + countdownMs) } catch { setMessage('Could not start the race. Check your connection and try again.') } }
  const startSinglePlayer = (daily = false) => { const cleanName = name.trim().slice(0, 12) || 'Player'; const player: Player = { name: cleanName, joinedAt: Date.now(), gid: gidRef.current, board: solved, moves: 0, doneMs: null, hostGid: gidRef.current }; setMode('single'); setRoom('solo'); setDailyMode(daily); setDifficulty(daily ? 'medium' : difficulty); setMe(player); playersRef.current = [player]; setPlayers([player]); setHostGid(player.gid); setNewBest(false); const seed = daily ? Number(new Date().toISOString().slice(0, 10).replaceAll('-', '')) : Math.floor(Math.random() * 2147483647); beginRound(seed, daily ? 'medium' : difficulty) }
  const togglePause = async () => { if (round !== 'racing' || mode === 'multi' && !host) return; const nextPaused = !paused; const nextElapsed = nextPaused ? Date.now() - startedAt : elapsed; if (!nextPaused) setStartedAt(Date.now() - elapsed); setElapsed(nextElapsed); setPaused(nextPaused); setMenuOpen(false); if (channelRef.current) { try { await channelRef.current.send({ type: 'broadcast', event: 'pause', payload: { gid: gidRef.current, paused: nextPaused, elapsed: nextElapsed } }) } catch { setMessage('Pause state could not sync. Reconnecting to the room.') } } }
  const stopGame = () => { channelRef.current?.unsubscribe(); channelRef.current = null; if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; playersRef.current = []; leftPlayersRef.current = []; sessionStorage.removeItem('puzzle-race-session'); setHostGid(''); setRoom(null); setMode('single'); setRound('lobby'); setPaused(false); setMenuOpen(false); setPlayers([]); setMe(null); setBoard(solved); stopMusic() }
  const restartGame = async () => { if (mode === 'multi' && !host) return; setNewBest(false); setPaused(false); setMenuOpen(false); const seed = Math.floor(Math.random() * 2147483647); const countdownMs = 3000; try { if (channelRef.current) await channelRef.current.send({ type: 'broadcast', event: 'restart', payload: { gid: gidRef.current, seed, difficulty, countdownMs } }); beginRound(seed, difficulty, Date.now() + countdownMs) } catch { setMessage('Could not restart the race. Check your connection and try again.') } }
  const move = async (index: number) => { if (round !== 'racing' || paused || !canSlide(board, index)) return; if (vibrationOn && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(12); tone(280 + movesRef.current * 8, 0.06, 'square', 0.025); const next = board.split(''); const gap = next.indexOf('0'); [next[index], next[gap]] = [next[gap], next[index]]; const nextBoard = next.join(''); movesRef.current += 1; setBoard(nextBoard); if (nextBoard === solved) { const done = Date.now() - startedAt; setElapsed(done); if (mode === 'single') { try { const current = JSON.parse(localStorage.getItem('puzzle-race-stats') || '{}'); const scoreDifficulty = dailyMode ? 'medium' : difficulty; const previous = current[scoreDifficulty]; const previousTime = previous?.bestTimeMs ?? previous?.time ?? Infinity; const previousMoves = previous?.bestMoves ?? previous?.moves ?? Infinity; const isBest = done < previousTime || movesRef.current < previousMoves; if (isBest) { current[scoreDifficulty] = { bestTimeMs: Math.min(done, previousTime), bestMoves: Math.min(movesRef.current, previousMoves) }; localStorage.setItem('puzzle-race-stats', JSON.stringify(current)); setBestStats(current); setNewBest(true) } } catch { /* ignore unavailable storage */ } } setRound('finished'); celebrate(); await publish(nextBoard, done) } else await publish(nextBoard) }
  useEffect(() => { const onKey = (e: KeyboardEvent) => { const gap = board.indexOf('0'); const target = e.key === 'ArrowUp' ? gap + 3 : e.key === 'ArrowDown' ? gap - 3 : e.key === 'ArrowLeft' ? gap + 1 : e.key === 'ArrowRight' ? gap - 1 : -1; if (target >= 0 && target < 9) { e.preventDefault(); move(target) } }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey) })

  if (!room) return <main className="shell"><header className="topbar"><div className="brand-mark">8</div><div><p className="eyebrow">REAL-TIME PUZZLE RACE</p><h1>8 Puzzle Race</h1></div><button className="icon-button" onClick={() => setDark(!dark)} aria-label="Toggle theme">{dark ? <Sun size={18} /> : <Moon size={18} />}</button></header><section className="hero-card"><span className="kicker">READY, SET, SLIDE</span><h2>Race your friends<br />to solve the classic.</h2><p>Same shuffle. Same start. One winner.</p><div className="difficulty-picker"><span>Difficulty</span><div className="difficulty-options">{(['easy', 'medium', 'hard', 'extreme'] as Difficulty[]).map(level => <button key={level} className={difficulty === level ? 'selected' : ''} onClick={() => setDifficulty(level)}>{level}</button>)}</div></div><div className="mode-toggle"><button className={`mode-choice ${mode === 'single' ? 'active' : ''}`} onClick={() => setMode('single')}>Single player</button><button className={`mode-choice ${mode === 'multi' ? 'active' : ''}`} onClick={() => setMode('multi')}>Multiplayer</button></div><div className="form-stack"><label>Your name<input value={name} maxLength={12} onChange={e => setName(e.target.value)} placeholder="e.g. Ada" /></label>{mode === 'single' ? <><button className="primary" onClick={() => startSinglePlayer()}>Start solo race <span>→</span></button><button className="secondary" onClick={() => startSinglePlayer(true)}>Daily puzzle</button>{bestStats[difficulty] && <p className="best-stat">Best {difficulty}: {formatTime(bestStats[difficulty].bestTimeMs)} · {bestStats[difficulty].bestMoves} moves</p>}</> : <><button className="primary" onClick={() => enterRoom(roomCode(), name, undefined, true)}>Create room <span>→</span></button><div className="divider"><span>or join a race</span></div><div className="join-row"><input value={code} maxLength={10} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="ROOM CODE" aria-label="Room code" /><button className="secondary" disabled={!isRoomCode(code)} onClick={() => enterRoom(code)}>Join</button></div></>}</div>{message && <p className="notice">{message}</p>}</section><footer><span><Wifi size={14} /> Powered by Supabase Realtime</span><span>2–4 players</span></footer></main>

  const ranking = players.filter(p => p.doneMs !== null && !p.left).sort((a, b) => (a.doneMs ?? Infinity) - (b.doneMs ?? Infinity))
  return <main className="shell room-shell"><header className="topbar"><div className="brand-mark small">8</div><div><p className="eyebrow">ROOM {room}</p><h1>{round === 'lobby' ? 'Waiting room' : round === 'finished' ? 'Race complete' : 'Solve it!'}</h1></div><button className="icon-button" onClick={() => { setMusicOn(v => !v); if (musicOn) stopMusic(); else startMusic() }} aria-label={musicOn ? 'Mute music' : 'Play music'}>{musicOn ? '♫' : '♪'}</button><button className="icon-button" onClick={() => setSoundOn(v => !v)} aria-label={soundOn ? 'Mute sounds' : 'Enable sounds'}>{soundOn ? '🔊' : '🔇'}</button><button className="icon-button" onClick={() => setVibrationOn(v => !v)} aria-label={vibrationOn ? 'Disable vibration' : 'Enable vibration'}>{vibrationOn ? '◈' : '◇'}</button><button className="icon-button" onClick={() => void copyToClipboard(room)} aria-label="Copy room code"><Copy size={17} /></button><button className="icon-button" onClick={() => void copyToClipboard(`${window.location.origin}${window.location.pathname}?room=${room}`)} aria-label="Copy room link"><Copy size={15} /></button>{copied && <span className="copied-label">Copied!</span>}<button className="icon-button" onClick={() => setMenuOpen(value => !value)} aria-label="Open game menu"><Menu size={17} /></button></header>{menuOpen && <div ref={menuRef} className="game-menu" role="menu"><button onClick={togglePause} disabled={round !== 'racing' || mode === 'multi' && !host}><>{paused ? <Play size={15} /> : <Pause size={15} />}</>{paused ? 'Resume game' : 'Pause game'}</button><button onClick={restartGame} disabled={mode === 'multi' && !host}><RotateCcw size={15} /> Restart puzzle</button><button onClick={() => { setHelpOpen(true); setMenuOpen(false) }}><CircleHelp size={15} /> How to play</button><button className="danger-action" onClick={stopGame}><Square size={15} /> Stop and exit</button></div>}{helpOpen && <div className="help-overlay" role="dialog" aria-modal="true" aria-labelledby="help-title"><section className="help-card"><button className="help-close" onClick={() => setHelpOpen(false)} aria-label="Close help">×</button><span className="kicker">QUICK GUIDE</span><h2 id="help-title">How to play</h2><ol><li>Slide tiles next to the empty gap.</li><li>Put every tile in order from 1 to 8.</li><li>The first player to solve the board wins.</li></ol><p>Tap a tile or use the arrow keys. Green tiles are already in their correct position.</p><button className="primary full" onClick={() => setHelpOpen(false)}>Got it</button></section></div>}{round === 'lobby' && <section className="panel intro-panel"><div className="panel-heading"><div><span className="kicker">THE ROOM IS OPEN</span><h2>Bring on the competition.</h2></div><Users size={22} /></div><p className="muted">Share the room code with your friends, then start when everyone is ready.</p><div className="lobby-difficulty"><span>Difficulty</span>{host ? <div className="difficulty-options">{(['easy', 'medium', 'hard', 'extreme'] as Difficulty[]).map(level => <button key={level} className={difficulty === level ? 'selected' : ''} onClick={() => setDifficulty(level)}>{level}</button>)}</div> : <span className="difficulty-badge">{difficulty}</span>}</div>{players.length === 0 ? <div className="empty-state">Connecting to the room…</div> : <div className="player-list">{players.map((p, i) => <PlayerCard key={p.gid} player={p} color={colors[i % colors.length]} />)}</div>}{host ? <button className="primary full" disabled={players.filter(player => !player.left).length < 2} onClick={start}>{players.filter(player => !player.left).length < 2 ? 'Waiting for a player…' : 'Start race  →'}</button> : <p className="host-note">The host will start the race when ready.</p>}{message && <p className="notice">{message}</p>}</section>}{round !== 'lobby' && <><section className="race-status">{round === 'countdown' ? <><span className="count-number">{count || 'GO'}</span><span>Get your fingers ready</span></> : round === 'finished' ? <><Trophy size={22} /><span>{me?.doneMs ? `Finished in ${formatTime(me.doneMs)}` : 'Race over'}</span></> : <><span className="live-dot" /><span>{formatTime(elapsed)}</span><span className="move-count">{movesRef.current} moves</span><span className="difficulty-badge">{difficulty}</span></>}</section>{paused && <div className="paused-banner"><Pause size={16} /> Game paused</div>}<section className={`puzzle-wrap ${round === 'finished' ? 'winner-celebration' : ''}`}>{round === 'finished' && <div className="winner-burst" aria-live="polite">🏆 You solved it! {newBest && 'New best!'}</div>}<div className="board" role="group" aria-label="Sliding puzzle board">{board.split('').map((n, i) => <button key={i} className={`tile ${n === '0' ? 'gap' : n === String(i + 1) ? 'correct' : ''}`} onClick={() => move(i)} aria-label={n === '0' ? 'Empty space' : `Tile ${n}${n === String(i + 1) ? ', correct position' : ''}`}>{n !== '0' && n}</button>)}</div><p className="hint">Tap a tile next to the gap · Arrow keys work too</p></section>{round === 'finished' && <section className="results panel"><div className="panel-heading"><div><h2>Final ranking</h2><span className="difficulty-badge">{difficulty}</span></div><Trophy size={20} /></div>{ranking.map((p, i) => <div className="rank-row" key={p.gid}><strong>{i + 1}</strong><span>{p.name}</span><span>{formatTime(p.doneMs ?? 0)} · {p.moves} moves (best possible: {p.bestPossibleMoves ?? 0})</span></div>)}{host && <button className="secondary full" onClick={start}><RotateCcw size={16} /> Play again</button>}</section>}<section className="players-section"><div className="section-label">PLAYERS <span>{players.filter(player => !player.left).length}/4</span></div><div className="player-list">{players.map((p, i) => <PlayerCard key={p.gid} player={p} color={colors[i % colors.length]} />)}</div></section></>}{message && <p className="notice">{message}</p>}</main>
}
function formatTime(ms: number) { return `${(ms / 1000).toFixed(2)}s` }
function PlayerCard({ player, color }: { player: Player; color: string }) { return <div className="player-card" style={{ borderLeftColor: color }}><div className="player-info"><span className="avatar" style={{ background: color }}>{player.name.slice(0, 1).toUpperCase()}</span><div><strong>{player.name}</strong><small>{player.left ? 'Left the race' : player.doneMs !== null ? `Finished · ${formatTime(player.doneMs)}` : `${player.moves} moves`}</small></div></div><MiniBoard board={player.board} /></div> }
