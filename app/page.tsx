'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CircleHelp, Copy, Menu, Moon, Pause, Play, RotateCcw, Share2, Square, Sun, Trophy, Users, Wifi } from 'lucide-react'
import { createPuzzle, getOptimalMoves, SOLVED_BOARD, type Difficulty } from '@/lib/puzzle-engine.mjs'
import { areAllActivePlayersVerified, isDifficulty, isRoomCode, isValidBoard, isVerifiedFinisher, parsePlayer } from '@/lib/game-protocol.mjs'
import type { GameMode, Player, RoundState } from '@/lib/game-types'
import { Lobby } from '@/components/game/Lobby'
import { PlayerCard } from '@/components/game/PlayerCard'
import { RaceBoard } from '@/components/game/RaceBoard'
import { Results } from '@/components/game/Results'
import { useAudio } from '@/hooks/useAudio'
import { useRoom } from '@/hooks/useRoom'
import { useStats } from '@/hooks/useStats'
import { prefetchPuzzleEngine } from '@/lib/prefetch-puzzle.mjs'

const SOLVED = SOLVED_BOARD
const PLAYER_COLORS = ['#4f9b68', '#d58b4c', '#6e86bc', '#b76a8e']
const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function createRoomCode() {
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), byte => ROOM_ALPHABET[byte % ROOM_ALPHABET.length]).join('')
}

function canSlide(board: string, index: number) {
  if (index < 0 || index > 8) return false
  const gap = board.indexOf('0')
  const next = board.split('')
  ;[next[index], next[gap]] = [next[gap], next[index]]
  return (gap >= 0) && (Math.abs(gap - index) === 3 || (Math.floor(gap / 3) === Math.floor(index / 3) && Math.abs(gap - index) === 1))
}

export default function Page() {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [room, setRoom] = useState<string | null>(null)
  const [mode, setMode] = useState<GameMode>('single')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [dailyMode, setDailyMode] = useState(false)
  const [me, setMe] = useState<Player | null>(null)
  const [board, setBoard] = useState(SOLVED)
  const [round, setRound] = useState<RoundState>('lobby')
  const [count, setCount] = useState(3)
  const [startedAt, setStartedAt] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [message, setMessage] = useState('')
  const [dark, setDark] = useState(false)
  const [copied, setCopied] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [paused, setPaused] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const movesRef = useRef(0)
  const initialBoardRef = useRef(SOLVED)
  const optimalMovesRef = useRef(0)
  const roundSeedRef = useRef<number | null>(null)
  const roundDifficultyRef = useRef<Difficulty>('medium')
  const reconnectSnapshotRef = useRef<any>(null)
  const audio = useAudio(Boolean(room))
  const { bestStats, newBest, setNewBest, recordSoloResult, dailyBest, dailyStreak, todayDailyResult, recordDailyResult } = useStats()

  const beginRound = useCallback((seed: number, selectedDifficulty: Difficulty = difficulty, localStartAt = Date.now() + 3000) => {
    const nextBoard = createPuzzle(seed, selectedDifficulty)
    roundSeedRef.current = seed
    roundDifficultyRef.current = selectedDifficulty
    initialBoardRef.current = nextBoard
    optimalMovesRef.current = getOptimalMoves(nextBoard) ?? 0
    setBoard(nextBoard)
    movesRef.current = 0
    setRound('countdown')
    setCount(Math.max(1, Math.ceil((localStartAt - Date.now()) / 1000)))
    setStartedAt(localStartAt)
    setElapsed(0)
    setPaused(false)
    setMe(player => player ? { ...player, board: nextBoard, moves: 0, doneMs: null, bestPossibleMoves: optimalMovesRef.current } : player)
  }, [difficulty])

  const roomClient = useRoom({
    name,
    difficulty,
    room,
    mode,
    board,
    round,
    startedAt,
    elapsed,
    paused,
    me,
    movesRef,
    optimalMovesRef,
    initialBoardRef,
    roundSeedRef,
    roundDifficultyRef,
    reconnectSnapshotRef,
    setRoom,
    setMode,
    setDifficulty,
    setMe,
    setBoard,
    setRound,
    setStartedAt,
    setElapsed,
    setPaused,
    setMessage,
    beginRound,
    unlockAudio: audio.unlockAudio,
    startMusic: audio.startMusic,
  })
  const { players, host, gidRef, joinedAtRef } = roomClient

  useEffect(() => { prefetchPuzzleEngine() }, [])
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('puzzle-race-settings') || '{}')
      if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
        if (typeof saved.name === 'string') setName(saved.name.slice(0, 12))
        if (isDifficulty(saved.difficulty)) setDifficulty(saved.difficulty)
        if (typeof saved.soundOn === 'boolean') audio.setSoundOn(saved.soundOn)
        if (typeof saved.musicOn === 'boolean') audio.setMusicOn(saved.musicOn)
        if (typeof saved.vibrationOn === 'boolean') audio.setVibrationOn(saved.vibrationOn)
      }
      const inviteRoom = new URLSearchParams(window.location.search).get('room')
      if (inviteRoom && isRoomCode(inviteRoom)) { setCode(inviteRoom.toUpperCase()); setMode('multi') }
    } catch { /* ignore unavailable storage */ }
    finally { setSettingsLoaded(true) }
  }, [])
  useEffect(() => {
    if (!settingsLoaded) return
    try { localStorage.setItem('puzzle-race-settings', JSON.stringify({ name, difficulty, soundOn: audio.soundOn, vibrationOn: audio.vibrationOn, musicOn: audio.musicOn })) } catch { /* ignore unavailable storage */ }
  }, [settingsLoaded, name, difficulty, audio.soundOn, audio.vibrationOn, audio.musicOn])
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
        setMode('single'); setRoom('solo'); setBoard(data.board); setRound(data.round); setStartedAt(data.startedAt); setElapsed(data.elapsed); setPaused(Boolean(data.paused)); roundSeedRef.current = Number.isSafeInteger(data.roundSeed) ? data.roundSeed : null; roundDifficultyRef.current = isDifficulty(data.roundDifficulty) ? data.roundDifficulty : isDifficulty(data.difficulty) ? data.difficulty : 'medium'; initialBoardRef.current = data.startBoard ?? data.board; optimalMovesRef.current = getOptimalMoves(initialBoardRef.current) ?? 0; movesRef.current = data.moves; setMe(player); roomClient.createLocalPlayer(player)
      }
    } catch { try { sessionStorage.removeItem('puzzle-race-session') } catch { /* storage unavailable */ } }
  }, [])
  useEffect(() => { try { sessionStorage.setItem('puzzle-race-theme', dark ? 'dark' : 'light') } catch { /* ignore unavailable session storage */ } }, [dark])
  useEffect(() => {
    if (!room || !me) return
    try { sessionStorage.setItem('puzzle-race-session', JSON.stringify({ name, mode, room, board, startBoard: initialBoardRef.current, roundSeed: roundSeedRef.current, roundDifficulty: roundDifficultyRef.current, round, startedAt, elapsed, moves: movesRef.current, paused, difficulty, dailyMode, dark, gid: me.gid, joinedAt: me.joinedAt, savedAt: Date.now(), me })) } catch { /* ignore unavailable session storage */ }
  }, [name, mode, room, board, round, startedAt, elapsed, dark, paused, difficulty, dailyMode, me])
  useEffect(() => { if (room && me) reconnectSnapshotRef.current = { name, mode, room, board, startBoard: initialBoardRef.current, roundSeed: roundSeedRef.current, roundDifficulty: roundDifficultyRef.current, round, startedAt, elapsed, moves: movesRef.current, paused, difficulty, dailyMode, dark, gid: me.gid, joinedAt: me.joinedAt, me } }, [name, mode, room, board, round, startedAt, elapsed, paused, difficulty, dailyMode, dark, me])
  useEffect(() => { document.documentElement.classList.toggle('dark', dark) }, [dark])
  useEffect(() => { if (round !== 'countdown') return; const tick = () => { const remaining = startedAt - Date.now(); setCount(Math.max(0, Math.ceil(remaining / 1000))); if (remaining <= 0) setRound('racing') }; tick(); const timer = setInterval(tick, 50); return () => clearInterval(timer) }, [round, startedAt])
  useEffect(() => { if (round !== 'racing' || paused) return; const timer = setInterval(() => setElapsed(Date.now() - startedAt), 200); return () => clearInterval(timer) }, [round, startedAt, paused])
  useEffect(() => {
    if (!menuOpen) return
    const closeOnOutsideClick = (event: PointerEvent) => { if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false) }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [menuOpen])
  const autoJoinRef = useRef(false)
  useEffect(() => { if (!room && mode === 'multi' && name.trim() && isRoomCode(code) && new URLSearchParams(window.location.search).get('room') && !autoJoinRef.current) { autoJoinRef.current = true; void roomClient.enterRoom(code) } }, [code, mode, name, room])
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
        restoredMultiRef.current = true; setName(data.name.slice(0, 12)); void roomClient.enterRoom(data.room, data.name, data)
      }
    } catch { try { sessionStorage.removeItem('puzzle-race-session') } catch { /* storage unavailable */ } }
  }, [room])

  const copyToClipboard = async (value: string, confirmation = 'Copied!') => { try { if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable'); await navigator.clipboard.writeText(value); setCopied(confirmation); setMessage(''); window.setTimeout(() => setCopied(''), 1800) } catch { setCopied(''); setMessage('Could not copy automatically. Please copy the room code or link manually.') } }
  const shareRoom = async () => { if (!room) return; const url = `${window.location.origin}${window.location.pathname}?room=${room}`; if (typeof navigator.share === 'function') { try { await navigator.share({ title: '8 Puzzle Race', text: `Join my 8 Puzzle Race room ${room}`, url }); return } catch (error) { if (error instanceof DOMException && error.name === 'AbortError') return } } await copyToClipboard(url, 'Link copied!') }
  const start = async () => { if (mode === 'multi' && !roomClient.host) return; setNewBest(false); const seed = Math.floor(Math.random() * 2147483647); try { const startAt = await roomClient.sendRound('start', seed, difficulty); beginRound(seed, difficulty, startAt) } catch { setMessage('Could not start the race. Check your connection and try again.') } }
  const startSinglePlayer = (daily = false) => { const cleanName = name.trim().slice(0, 12) || 'Player'; const player: Player = { name: cleanName, joinedAt: Date.now(), gid: roomClient.gidRef.current, board: SOLVED, moves: 0, doneMs: null, hostGid: roomClient.gidRef.current }; setMode('single'); setRoom('solo'); setDailyMode(daily); setDifficulty(daily ? 'medium' : difficulty); setMe(player); roomClient.createLocalPlayer(player); setNewBest(false); const seed = daily ? Number(new Date().toISOString().slice(0, 10).replaceAll('-', '')) : Math.floor(Math.random() * 2147483647); beginRound(seed, daily ? 'medium' : difficulty) }
  const togglePause = async () => { if (round !== 'racing' || mode === 'multi' && !roomClient.host) return; const nextPaused = !paused; const nextElapsed = nextPaused ? Date.now() - startedAt : elapsed; if (!nextPaused) setStartedAt(Date.now() - elapsed); setElapsed(nextElapsed); setPaused(nextPaused); setMenuOpen(false); try { await roomClient.sendPause(nextPaused, nextElapsed) } catch { setMessage('Pause state could not sync. Reconnecting to the room.') } }
  const stopGame = () => { roomClient.leaveRoom(); sessionStorage.removeItem('puzzle-race-session'); setRoom(null); setMode('single'); setRound('lobby'); setPaused(false); setMenuOpen(false); setMe(null); setBoard(SOLVED); setMessage('') }
  const restartGame = async () => { if (mode === 'multi' && !roomClient.host) return; if (mode === 'multi' && !areAllActivePlayersVerified(players, roundSeedRef.current, roundDifficultyRef.current) && !window.confirm('Others are still racing. Restart for everyone?')) return; setNewBest(false); setPaused(false); setMenuOpen(false); const selectedDifficulty = dailyMode ? 'medium' : difficulty; const seed = dailyMode ? Number(new Date().toISOString().slice(0, 10).replaceAll('-', '')) : Math.floor(Math.random() * 2147483647); try { const startAt = await roomClient.sendRound('restart', seed, selectedDifficulty); beginRound(seed, selectedDifficulty, startAt) } catch { setMessage('Could not restart the race. Check your connection and try again.') } }
  const move = async (index: number) => { if (round !== 'racing' || paused || !canSlide(board, index)) return; audio.playMove(movesRef.current); const next = board.split(''); const gap = next.indexOf('0'); [next[index], next[gap]] = [next[gap], next[index]]; const nextBoard = next.join(''); movesRef.current += 1; setBoard(nextBoard); if (nextBoard === SOLVED) { const done = Date.now() - startedAt; setElapsed(done); if (mode === 'single') { if (dailyMode) recordDailyResult(done, movesRef.current); else recordSoloResult(difficulty, done, movesRef.current) } setRound('finished'); audio.playFinish(); await roomClient.publish(nextBoard, done) } else await roomClient.publish(nextBoard) }
  useEffect(() => { const onKey = (event: KeyboardEvent) => { const gap = board.indexOf('0'); const target = event.key === 'ArrowUp' ? gap + 3 : event.key === 'ArrowDown' ? gap - 3 : event.key === 'ArrowLeft' ? gap + 1 : event.key === 'ArrowRight' ? gap - 1 : -1; if (target >= 0 && target < 9) { event.preventDefault(); void move(target) } }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey) })

  const isVerified = (player: Player) => roundSeedRef.current !== null && isVerifiedFinisher(player, roundSeedRef.current, roundDifficultyRef.current)
  const ranking = players.filter(player => player.doneMs !== null && !player.left && isVerified(player)).sort((a, b) => (a.doneMs ?? Infinity) - (b.doneMs ?? Infinity))

  if (!room) return <main className="shell"><header className="topbar"><div className="brand-mark">8</div><div><p className="eyebrow">REAL-TIME PUZZLE RACE</p><h1>8 Puzzle Race</h1></div><button className="icon-button" onClick={() => setDark(!dark)} aria-label="Toggle theme">{dark ? <Sun size={18} /> : <Moon size={18} />}</button></header><Lobby mode={mode} onModeChange={setMode} difficulty={difficulty} onDifficultyChange={setDifficulty} name={name} onNameChange={setName} roomCode={code} onRoomCodeChange={setCode} bestStats={bestStats} dailyBest={dailyBest} todayDailyResult={todayDailyResult} dailyStreak={dailyStreak} message={message} onStartSolo={() => startSinglePlayer()} onDailyPuzzle={() => startSinglePlayer(true)} onCreateRoom={() => void roomClient.enterRoom(createRoomCode(), name, undefined, true)} onJoinRoom={() => void roomClient.enterRoom(code)} /><footer><span><Wifi size={14} /> Powered by Supabase Realtime</span><span>2–4 players</span></footer></main>

  return <main className="shell room-shell"><header className="topbar"><div className="brand-mark small">8</div><div><p className="eyebrow">ROOM {room}</p><h1>{round === 'lobby' ? 'Waiting room' : round === 'finished' ? 'Race complete' : 'Solve it!'}</h1></div><button className="share-button" onClick={() => void shareRoom()}><Share2 size={16} /><span>Share</span></button><button className="icon-button" onClick={() => setMenuOpen(value => !value)} aria-label="Open game menu"><Menu size={17} /></button></header>{copied && <div className="copy-toast" role="status">{copied}</div>}{menuOpen && <div ref={menuRef} className="game-menu" role="group" aria-label="Game menu"><label className="menu-toggle"><span>Background music</span><input type="checkbox" checked={audio.musicOn} onChange={() => audio.setMusicOn(value => !value)} /></label><label className="menu-toggle"><span>Move sounds</span><input type="checkbox" checked={audio.soundOn} onChange={() => audio.setSoundOn(value => !value)} /></label><label className="menu-toggle"><span>Vibration</span><input type="checkbox" checked={audio.vibrationOn} onChange={() => audio.setVibrationOn(value => !value)} /></label><button onClick={() => void copyToClipboard(room, 'Code copied!')}><Copy size={15} /> Copy code</button><button onClick={togglePause} disabled={round !== 'racing' || mode === 'multi' && !roomClient.host}><>{paused ? <Play size={15} /> : <Pause size={15} />}</>{paused ? 'Resume game' : 'Pause game'}</button><button onClick={restartGame} disabled={mode === 'multi' && !roomClient.host}><RotateCcw size={15} /> Restart puzzle</button><button onClick={() => { setHelpOpen(true); setMenuOpen(false) }}><CircleHelp size={15} /> How to play</button><button className="danger-action" onClick={stopGame}><Square size={15} /> Stop and exit</button></div>}{helpOpen && <div className="help-overlay" role="dialog" aria-modal="true" aria-labelledby="help-title"><section className="help-card"><button className="help-close" onClick={() => setHelpOpen(false)} aria-label="Close help">×</button><span className="kicker">QUICK GUIDE</span><h2 id="help-title">How to play</h2><ol><li>Slide tiles next to the empty gap.</li><li>Put every tile in order from 1 to 8.</li><li>The first player to solve the board wins.</li></ol><p>Tap a tile or use the arrow keys. Green tiles are already in their correct position.</p><button className="primary full" onClick={() => setHelpOpen(false)}>Got it</button></section></div>}{round === 'lobby' && <section className="panel intro-panel"><div className="panel-heading"><div><span className="kicker">THE ROOM IS OPEN</span><h2>Bring on the competition.</h2></div><Users size={22} /></div><p className="muted">Share the room code with your friends, then start when everyone is ready.</p><div className="lobby-difficulty"><span>Difficulty</span>{roomClient.host ? <div className="difficulty-options">{(['easy', 'medium', 'hard', 'extreme'] as Difficulty[]).map(level => <button key={level} className={difficulty === level ? 'selected' : ''} onClick={() => setDifficulty(level)}>{level}</button>)}</div> : <span className="difficulty-badge">{difficulty}</span>}</div>{players.length === 0 ? <div className="empty-state">Connecting to the room…</div> : <div className="player-list">{players.map((player, index) => <PlayerCard key={player.gid} player={player} color={PLAYER_COLORS[index % PLAYER_COLORS.length]} verified={isVerified(player)} />)}</div>}{roomClient.host ? <button className="primary full" disabled={players.filter(player => !player.left).length < 2} onClick={start}>{players.filter(player => !player.left).length < 2 ? 'Waiting for a player…' : 'Start race  →'}</button> : <p className="host-note">The host will start the race when ready.</p>}{message && <p className="notice">{message}</p>}</section>}{round !== 'lobby' && <><RaceBoard board={board} round={round} count={count} elapsed={elapsed} moves={movesRef.current} paused={paused} player={me} winner={ranking[0] ?? null} newBest={newBest} onMove={index => void move(index)} />{round === 'finished' && <Results ranking={ranking} difficulty={difficulty} optimalMoves={optimalMovesRef.current} host={roomClient.host} canChangeDifficulty={mode === 'multi'} onDifficultyChange={setDifficulty} onPlayAgain={() => void restartGame()} />}{message && <p className="notice">{message}</p>}<section className="players-section"><div className="section-label">PLAYERS <span>{players.filter(player => !player.left).length}/4</span></div><div className="player-list">{players.map((player, index) => <PlayerCard key={player.gid} player={player} color={PLAYER_COLORS[index % PLAYER_COLORS.length]} verified={isVerified(player)} />)}</div></section></>}</main>
}
