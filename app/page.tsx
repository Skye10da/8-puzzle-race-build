'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Moon, Sun, Trophy, Users, Wifi, Copy, RotateCcw, Menu, Pause, Play, Square, CircleHelp } from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabase/client'

type Player = { name: string; joinedAt: number; gid: string; board: string; moves: number; doneMs: number | null; watch?: boolean }
const solved = '123456780'
const colors = ['#4f9b68', '#d58b4c', '#6e86bc', '#b76a8e']

function mulberry32(seed: number) { return () => { let t = seed += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296 } }
type Difficulty = 'easy' | 'medium' | 'hard' | 'extreme'
const difficultyRanges: Record<Difficulty, [number, number]> = { easy: [8, 12], medium: [16, 20], hard: [22, 26], extreme: [27, 31] }
let distanceMap: Map<string, number> | null = null
let statesByDistance: Map<number, string[]> | null = null
function neighbors(board: string) { const gap = board.indexOf('0'); return [gap - 3, gap + 3, gap - 1, gap + 1].filter(index => index >= 0 && index < 9 && !(gap % 3 === 0 && index === gap - 1) && !(gap % 3 === 2 && index === gap + 1)).map(index => { const next = board.split(''); [next[gap], next[index]] = [next[index], next[gap]]; return next.join('') }) }
function buildDistanceMap() { if (distanceMap) return; distanceMap = new Map([[solved, 0]]); const queue = [solved]; for (let cursor = 0; cursor < queue.length; cursor++) { const board = queue[cursor]; const distance = distanceMap.get(board) ?? 0; for (const next of neighbors(board)) if (!distanceMap.has(next)) { distanceMap.set(next, distance + 1); queue.push(next) } } statesByDistance = new Map(); for (const [board, distance] of distanceMap) statesByDistance.set(distance, [...(statesByDistance.get(distance) ?? []), board]) }
function shuffle(seed: number, difficulty: Difficulty = 'medium'): string { buildDistanceMap(); const rand = mulberry32(seed); const [min, max] = difficultyRanges[difficulty]; const candidates = Array.from({ length: max - min + 1 }, (_, i) => statesByDistance?.get(min + i) ?? []).flat(); return candidates[Math.floor(rand() * candidates.length)] }
function optimalMoves(board: string) { buildDistanceMap(); return distanceMap?.get(board) ?? 0 }
function roomCode() { return Array.from({ length: 4 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join('') }
function canSlide(board: string, index: number) { const gap = board.indexOf('0'); return [gap - 3, gap + 3, gap - 1, gap + 1].includes(index) && !(gap % 3 === 0 && index === gap - 1) && !(gap % 3 === 2 && index === gap + 1) }
function MiniBoard({ board }: { board: string }) { return <div className="mini-board">{board.split('').map((n, i) => <span key={i} className={n === '0' ? 'gap' : ''}>{n === '0' ? '' : n}</span>)}</div> }

export default function Page() {
  const supabase = useMemo(() => getSupabaseClient(), [])
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [room, setRoom] = useState<string | null>(null)
  const [mode, setMode] = useState<'select' | 'single' | 'multi'>('single')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [bestStats, setBestStats] = useState<Record<string, { time: number; moves: number }>>({})
  const [newBest, setNewBest] = useState(false)
  const [dailyMode, setDailyMode] = useState(false)
  const [players, setPlayers] = useState<Player[]>([])
  const [me, setMe] = useState<Player | null>(null)
  const [board, setBoard] = useState(solved)
  const [round, setRound] = useState<'lobby' | 'countdown' | 'racing' | 'finished'>('lobby')
  const [count, setCount] = useState(3)
  const [startedAt, setStartedAt] = useState(0)
  const [elapsed, setElapsed] = useState(0)
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

  useEffect(() => { try { const saved = JSON.parse(localStorage.getItem('puzzle-race-settings') || '{}'); if (saved.name) setName(saved.name); if (saved.difficulty) setDifficulty(saved.difficulty); if (typeof saved.soundOn === 'boolean') setSoundOn(saved.soundOn); if (typeof saved.vibrationOn === 'boolean') setVibrationOn(saved.vibrationOn); const stats = JSON.parse(localStorage.getItem('puzzle-race-stats') || '{}'); setBestStats(stats); const sharedRoom = new URLSearchParams(window.location.search).get('room'); if (sharedRoom) { setCode(sharedRoom.toUpperCase().slice(0, 4)); setMode('multi') } } catch { /* ignore unavailable storage */ } }, [])
  useEffect(() => { try { localStorage.setItem('puzzle-race-settings', JSON.stringify({ name, difficulty, soundOn, vibrationOn })) } catch { /* ignore unavailable storage */ } }, [name, difficulty, soundOn, vibrationOn])

  const getAudio = () => {
    if (typeof window === 'undefined' || !soundOn) return null
    audioRef.current ??= new AudioContext()
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

  const host = players[0]?.gid === gidRef.current
  useEffect(() => {
    try {
      const savedTheme = sessionStorage.getItem('puzzle-race-theme')
      if (savedTheme === 'dark' || savedTheme === 'light') setDark(savedTheme === 'dark')
      const saved = sessionStorage.getItem('puzzle-race-session')
      if (!saved) return
      const data = JSON.parse(saved)
      if (data.name) setName(data.name)
      if (typeof data.dark === 'boolean') setDark(data.dark)
      if (data.difficulty) setDifficulty(data.difficulty)
      if (data.mode === 'single' && data.round !== 'lobby') { setMode('single'); setRoom('solo'); setBoard(data.board || solved); setRound(data.round); setStartedAt(data.startedAt || 0); setElapsed(data.elapsed || 0); movesRef.current = data.moves || 0; const player = data.me as Player; if (player) { setMe(player); setPlayers([player]) } }
    } catch { sessionStorage.removeItem('puzzle-race-session') }
  }, [])
  useEffect(() => { sessionStorage.setItem('puzzle-race-theme', dark ? 'dark' : 'light') }, [dark])
  useEffect(() => { if (!room || !me) return; sessionStorage.setItem('puzzle-race-session', JSON.stringify({ name, mode, room, board, round, startedAt, elapsed, moves: movesRef.current, paused, difficulty, dark, me })) }, [name, mode, room, board, round, startedAt, elapsed, dark, me])
  const publish = useCallback(async (nextBoard = board, doneMs = me?.doneMs ?? null) => { if (!me) return; const next = { ...me, board: nextBoard, moves: movesRef.current, doneMs }; setMe(next); setPlayers(current => current.map(p => p.gid === next.gid ? next : p)); if (channelRef.current) { await channelRef.current.track(next); await channelRef.current.send({ type: 'broadcast', event: 'move', payload: next }) } }, [board, me])
  const beginRound = useCallback((seed: number, selectedDifficulty: Difficulty = difficulty) => { setBoard(shuffle(seed, selectedDifficulty)); movesRef.current = 0; setRound('countdown'); setCount(3); setElapsed(0); setMe(p => p ? { ...p, board: shuffle(seed, selectedDifficulty), moves: 0, doneMs: null } : p) }, [])

  useEffect(() => { document.documentElement.classList.toggle('dark', dark) }, [dark])
  useEffect(() => { if (round !== 'countdown') return; if (count === 0) { setStartedAt(Date.now()); setRound('racing'); return } const timer = setTimeout(() => setCount(c => c - 1), 700); return () => clearTimeout(timer) }, [round, count])
  useEffect(() => { if (round !== 'racing' || paused) return; const timer = setInterval(() => setElapsed(Date.now() - startedAt), 50); return () => clearInterval(timer) }, [round, startedAt, paused])
  useEffect(() => () => { channelRef.current?.unsubscribe(); stopMusic() }, [])
  useEffect(() => { if (!musicOn) stopMusic(); else if (room) startMusic() }, [musicOn, room])
  useEffect(() => {
    if (!menuOpen) return
    const closeOnOutsideClick = (event: PointerEvent) => { if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false) }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [menuOpen])

  const enterRoom = async (requestedCode: string, restoredName = name) => {
    const cleanName = restoredName.trim().slice(0, 12)
    if (!cleanName) return setMessage('Choose a name first.')
    if (!supabase) return setMessage('Supabase is not configured. Add the two NEXT_PUBLIC environment variables to connect.')
    const normalized = requestedCode.toUpperCase()
    const gid = gidRef.current
    const channel = supabase.channel(`p8-${normalized}`, { config: { presence: { key: gid } } })
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<Player>()
      const all = Object.values(state).flat().sort((a, b) => a.joinedAt - b.joinedAt || a.gid.localeCompare(b.gid))
      setPlayers(all)
      if (all.length > 4 && !all.some(p => p.gid === gid)) setMessage('Room is full. You can watch this race.')
    }).on('broadcast', { event: 'move' }, ({ payload }: { payload: Player }) => { if (payload.gid !== gid) setPlayers(current => current.map(p => p.gid === payload.gid ? payload : p)) }).on('broadcast', { event: 'start' }, ({ payload }: { payload: { gid: string; seed: number; difficulty?: Difficulty } }) => { if (payload.gid !== gid) { setDifficulty(payload.difficulty ?? 'medium'); beginRound(payload.seed, payload.difficulty ?? 'medium') } }).on('broadcast', { event: 'restart' }, ({ payload }: { payload: { seed: number; difficulty?: Difficulty } }) => { setDifficulty(payload.difficulty ?? 'medium'); beginRound(payload.seed, payload.difficulty ?? 'medium') })
    await channel.subscribe()
    const player: Player = { name: cleanName, joinedAt: joinedAtRef.current, gid, board: solved, moves: 0, doneMs: null }
    channelRef.current = channel; setRoom(normalized); setMode('multi'); setMe(player); getAudio(); startMusic(); await channel.track(player)
  }
  const restoredMultiRef = useRef(false)
  useEffect(() => {
    if (restoredMultiRef.current || room) return
    try {
      const saved = sessionStorage.getItem('puzzle-race-session')
      if (!saved) return
      const data = JSON.parse(saved)
      if (data.mode === 'multi' && data.room && data.name) { restoredMultiRef.current = true; setName(data.name); void enterRoom(data.room, data.name) }
    } catch { /* ignore malformed session state */ }
  }, [room])
  const celebrate = () => { stopMusic(); [523, 659, 784, 1047].forEach((note, i) => window.setTimeout(() => tone(note, 0.22, 'sine', 0.07), i * 110)) }
  const start = async () => { const seed = Math.floor(Math.random() * 2147483647); await channelRef.current?.send({ type: 'broadcast', event: 'start', payload: { gid: gidRef.current, seed, difficulty } }); beginRound(seed, difficulty) }
  const startSinglePlayer = (daily = false) => { const cleanName = name.trim().slice(0, 12) || 'Player'; const player: Player = { name: cleanName, joinedAt: Date.now(), gid: gidRef.current, board: solved, moves: 0, doneMs: null }; setMode('single'); setRoom('solo'); setDailyMode(daily); setDifficulty(daily ? 'medium' : difficulty); setMe(player); setPlayers([player]); const seed = daily ? Number(new Date().toISOString().slice(0, 10).replaceAll('-', '')) : Math.floor(Math.random() * 2147483647); beginRound(seed, daily ? 'medium' : difficulty) }
  const togglePause = () => { if (round !== 'racing') return; if (paused) setStartedAt(Date.now() - elapsed); setPaused(value => !value); setMenuOpen(false) }
  const stopGame = () => { channelRef.current?.unsubscribe(); channelRef.current = null; sessionStorage.removeItem('puzzle-race-session'); setRoom(null); setMode('single'); setRound('lobby'); setPaused(false); setMenuOpen(false); setPlayers([]); setMe(null); setBoard(solved); stopMusic() }
  const restartGame = async () => { setPaused(false); setMenuOpen(false); const seed = Math.floor(Math.random() * 2147483647); if (channelRef.current) await channelRef.current.send({ type: 'broadcast', event: 'restart', payload: { seed } }); beginRound(seed) }
  const move = async (index: number) => { if (round !== 'racing' || paused || !canSlide(board, index)) return; if (vibrationOn && typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(12); tone(280 + movesRef.current * 8, 0.06, 'square', 0.025); const next = board.split(''); const gap = next.indexOf('0'); [next[index], next[gap]] = [next[gap], next[index]]; const nextBoard = next.join(''); movesRef.current += 1; setBoard(nextBoard); if (nextBoard === solved) { const done = Date.now() - startedAt; setElapsed(done); if (mode === 'single') { try { const current = JSON.parse(localStorage.getItem('puzzle-race-stats') || '{}'); const previous = current[difficulty]; const isBest = !previous || done < previous.time || movesRef.current < previous.moves; if (isBest) { current[difficulty] = { time: Math.min(done, previous?.time ?? done), moves: Math.min(movesRef.current, previous?.moves ?? movesRef.current) }; localStorage.setItem('puzzle-race-stats', JSON.stringify(current)); setBestStats(current); setNewBest(true) } } catch { /* ignore unavailable storage */ } } setRound('finished'); celebrate(); await publish(nextBoard, done) } else await publish(nextBoard) }
  useEffect(() => { const onKey = (e: KeyboardEvent) => { const gap = board.indexOf('0'); const target = e.key === 'ArrowUp' ? gap + 3 : e.key === 'ArrowDown' ? gap - 3 : e.key === 'ArrowLeft' ? gap + 1 : e.key === 'ArrowRight' ? gap - 1 : -1; if (target >= 0 && target < 9) { e.preventDefault(); move(target) } }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey) })

  if (!room) return <main className="shell"><header className="topbar"><div className="brand-mark">8</div><div><p className="eyebrow">REAL-TIME PUZZLE RACE</p><h1>8 Puzzle Race</h1></div><button className="icon-button" onClick={() => setDark(!dark)} aria-label="Toggle theme">{dark ? <Sun size={18} /> : <Moon size={18} />}</button></header><section className="hero-card"><span className="kicker">READY, SET, SLIDE</span><h2>Race your friends<br />to solve the classic.</h2><p>Same shuffle. Same start. One winner.</p><div className="difficulty-picker"><span>Difficulty</span><div className="difficulty-options">{(['easy', 'medium', 'hard', 'extreme'] as Difficulty[]).map(level => <button key={level} className={difficulty === level ? 'selected' : ''} onClick={() => setDifficulty(level)}>{level}</button>)}</div></div><div className="mode-toggle"><button className={`mode-choice ${mode === 'single' ? 'active' : ''}`} onClick={() => setMode('single')}>Single player</button><button className={`mode-choice ${mode === 'multi' ? 'active' : ''}`} onClick={() => setMode('multi')}>Multiplayer</button></div><div className="form-stack"><label>Your name<input value={name} maxLength={12} onChange={e => setName(e.target.value)} placeholder="e.g. Ada" /></label>{mode === 'single' ? <><button className="primary" onClick={() => startSinglePlayer()}>Start solo race <span>→</span></button><button className="secondary" onClick={() => startSinglePlayer(true)}>Daily puzzle</button>{bestStats[difficulty] && <p className="best-stat">Best {difficulty}: {formatTime(bestStats[difficulty].time)} · {bestStats[difficulty].moves} moves</p>}</> : <><button className="primary" onClick={() => enterRoom(roomCode())}>Create room <span>→</span></button><div className="divider"><span>or join a race</span></div><div className="join-row"><input value={code} maxLength={4} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="ROOM CODE" aria-label="Room code" /><button className="secondary" disabled={code.length !== 4} onClick={() => enterRoom(code)}>Join</button></div></>}</div>{message && <p className="notice">{message}</p>}</section><footer><span><Wifi size={14} /> Powered by Supabase Realtime</span><span>2–4 players</span></footer></main>

  const ranking = players.filter(p => p.doneMs !== null).sort((a, b) => (a.doneMs ?? Infinity) - (b.doneMs ?? Infinity))
  return <main className="shell room-shell"><header className="topbar"><div className="brand-mark small">8</div><div><p className="eyebrow">ROOM {room}</p><h1>{round === 'lobby' ? 'Waiting room' : round === 'finished' ? 'Race complete' : 'Solve it!'}</h1></div><button className="icon-button" onClick={() => { setMusicOn(v => !v); if (musicOn) stopMusic(); else startMusic() }} aria-label={musicOn ? 'Mute music' : 'Play music'}>{musicOn ? '♫' : '♪'}</button><button className="icon-button" onClick={() => setSoundOn(v => !v)} aria-label={soundOn ? 'Mute sounds' : 'Enable sounds'}>{soundOn ? '🔊' : '🔇'}</button><button className="icon-button" onClick={() => setVibrationOn(v => !v)} aria-label={vibrationOn ? 'Disable vibration' : 'Enable vibration'}>{vibrationOn ? '◈' : '◇'}</button><button className="icon-button" onClick={() => { navigator.clipboard?.writeText(room); setCopied('code'); window.setTimeout(() => setCopied(''), 1400) }} aria-label="Copy room code"><Copy size={17} /></button><button className="icon-button" onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}${window.location.pathname}?room=${room}`); setCopied('link'); window.setTimeout(() => setCopied(''), 1400) }} aria-label="Copy room link"><Copy size={15} /></button>{copied && <span className="copied-label">Copied!</span>}<button className="icon-button" onClick={() => setMenuOpen(value => !value)} aria-label="Open game menu"><Menu size={17} /></button></header>{menuOpen && <div ref={menuRef} className="game-menu" role="menu"><button onClick={togglePause} disabled={round !== 'racing'}><>{paused ? <Play size={15} /> : <Pause size={15} />}</>{paused ? 'Resume game' : 'Pause game'}</button><button onClick={restartGame}><RotateCcw size={15} /> Restart puzzle</button><button onClick={() => { setHelpOpen(true); setMenuOpen(false) }}><CircleHelp size={15} /> How to play</button><button className="danger-action" onClick={stopGame}><Square size={15} /> Stop and exit</button></div>}{helpOpen && <div className="help-overlay" role="dialog" aria-modal="true" aria-labelledby="help-title"><section className="help-card"><button className="help-close" onClick={() => setHelpOpen(false)} aria-label="Close help">×</button><span className="kicker">QUICK GUIDE</span><h2 id="help-title">How to play</h2><ol><li>Slide tiles next to the empty gap.</li><li>Put every tile in order from 1 to 8.</li><li>The first player to solve the board wins.</li></ol><p>Tap a tile or use the arrow keys. Green tiles are already in their correct position.</p><button className="primary full" onClick={() => setHelpOpen(false)}>Got it</button></section></div>}{round === 'lobby' && <section className="panel intro-panel"><div className="panel-heading"><div><span className="kicker">THE ROOM IS OPEN</span><h2>Bring on the competition.</h2></div><Users size={22} /></div><p className="muted">Share the room code with your friends, then start when everyone is ready.</p><div className="lobby-difficulty"><span>Difficulty</span>{host ? <div className="difficulty-options">{(['easy', 'medium', 'hard', 'extreme'] as Difficulty[]).map(level => <button key={level} className={difficulty === level ? 'selected' : ''} onClick={() => setDifficulty(level)}>{level}</button>)}</div> : <span className="difficulty-badge">{difficulty}</span>}</div>{players.length === 0 ? <div className="empty-state">Connecting to the room…</div> : <div className="player-list">{players.map((p, i) => <PlayerCard key={p.gid} player={p} color={colors[i % colors.length]} />)}</div>}{host ? <button className="primary full" disabled={players.length < 2} onClick={start}>{players.length < 2 ? 'Waiting for a player…' : 'Start race  →'}</button> : <p className="host-note">The host will start the race when ready.</p>}{message && <p className="notice">{message}</p>}</section>}{round !== 'lobby' && <><section className="race-status">{round === 'countdown' ? <><span className="count-number">{count || 'GO'}</span><span>Get your fingers ready</span></> : round === 'finished' ? <><Trophy size={22} /><span>{me?.doneMs ? `Finished in ${formatTime(me.doneMs)}` : 'Race over'}</span></> : <><span className="live-dot" /><span>{formatTime(elapsed)}</span><span className="move-count">{movesRef.current} moves</span><span className="difficulty-badge">{difficulty}</span></>}</section>{paused && <div className="paused-banner"><Pause size={16} /> Game paused</div>}<section className={`puzzle-wrap ${round === 'finished' ? 'winner-celebration' : ''}`}>{round === 'finished' && <div className="winner-burst" aria-live="polite">🏆 You solved it! {newBest && 'New best!'}</div>}<div className="board" role="group" aria-label="Sliding puzzle board">{board.split('').map((n, i) => <button key={i} className={`tile ${n === '0' ? 'gap' : n === String(i + 1) ? 'correct' : ''}`} onClick={() => move(i)} aria-label={n === '0' ? 'Empty space' : `Tile ${n}${n === String(i + 1) ? ', correct position' : ''}`}>{n !== '0' && n}</button>)}</div><p className="hint">Tap a tile next to the gap · Arrow keys work too</p></section>{round === 'finished' && <section className="results panel"><div className="panel-heading"><div><h2>Final ranking</h2><span className="difficulty-badge">{difficulty}</span></div><Trophy size={20} /></div>{ranking.map((p, i) => <div className="rank-row" key={p.gid}><strong>{i + 1}</strong><span>{p.name}</span><span>{formatTime(p.doneMs ?? 0)} · {p.moves} moves (best possible: {optimalMoves(p.board)})</span></div>)}{host && <button className="secondary full" onClick={start}><RotateCcw size={16} /> Play again</button>}</section>}<section className="players-section"><div className="section-label">PLAYERS <span>{players.length}/4</span></div><div className="player-list">{players.map((p, i) => <PlayerCard key={p.gid} player={p} color={colors[i % colors.length]} />)}</div></section></>}{message && <p className="notice">{message}</p>}</main>
}
function formatTime(ms: number) { return `${(ms / 1000).toFixed(2)}s` }
function PlayerCard({ player, color }: { player: Player; color: string }) { return <div className="player-card" style={{ borderLeftColor: color }}><div className="player-info"><span className="avatar" style={{ background: color }}>{player.name.slice(0, 1).toUpperCase()}</span><div><strong>{player.name}</strong><small>{player.doneMs !== null ? `Finished · ${formatTime(player.doneMs)}` : `${player.moves} moves`}</small></div></div><MiniBoard board={player.board} /></div> }
