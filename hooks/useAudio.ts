'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export function useAudio(isActive: boolean) {
  const [musicOn, setMusicOn] = useState(false)
  const [soundOn, setSoundOn] = useState(true)
  const [vibrationOn, setVibrationOn] = useState(true)
  const audioRef = useRef<AudioContext | null>(null)
  const musicTimerRef = useRef<number | null>(null)

  const getAudio = useCallback(() => {
    if (typeof window === 'undefined' || !soundOn || typeof window.AudioContext !== 'function') return null
    audioRef.current ??= new window.AudioContext()
    if (audioRef.current.state === 'suspended') void audioRef.current.resume()
    return audioRef.current
  }, [soundOn])

  const playTone = useCallback((frequency: number, duration = 0.08, type: OscillatorType = 'sine', volume = 0.045) => {
    const audio = getAudio()
    if (!audio) return
    const oscillator = audio.createOscillator()
    const gain = audio.createGain()
    oscillator.type = type
    oscillator.frequency.value = frequency
    gain.gain.setValueAtTime(volume, audio.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration)
    oscillator.connect(gain).connect(audio.destination)
    oscillator.start()
    oscillator.stop(audio.currentTime + duration)
  }, [getAudio])

  const stopMusic = useCallback(() => {
    if (musicTimerRef.current !== null) {
      window.clearInterval(musicTimerRef.current)
      musicTimerRef.current = null
    }
  }, [])

  const startMusic = useCallback(() => {
    if (!musicOn || musicTimerRef.current !== null) return
    const notes = [196, 247, 294, 247, 220, 262, 330, 262]
    let step = 0
    musicTimerRef.current = window.setInterval(() => playTone(notes[step++ % notes.length], 0.28, 'triangle', 0.012), 360)
  }, [musicOn, playTone])

  const unlockAudio = useCallback(() => { getAudio() }, [getAudio])
  const playMove = useCallback((moves: number) => {
    if (vibrationOn && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(12)
    playTone(280 + moves * 8, 0.06, 'square', 0.025)
  }, [playTone, vibrationOn])
  const playFinish = useCallback(() => {
    stopMusic()
    ;[523, 659, 784, 1047].forEach((note, index) => window.setTimeout(() => playTone(note, 0.22, 'sine', 0.07), index * 110))
  }, [playTone, stopMusic])

  useEffect(() => {
    if (isActive && musicOn) startMusic()
    else stopMusic()
  }, [isActive, musicOn, startMusic, stopMusic])
  useEffect(() => () => { stopMusic(); void audioRef.current?.close() }, [stopMusic])

  return { musicOn, setMusicOn, soundOn, setSoundOn, vibrationOn, setVibrationOn, unlockAudio, startMusic, stopMusic, playMove, playFinish }
}
