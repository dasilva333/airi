#!/usr/bin/env node
/**
 * Project AIRI - Motion Choreography CLI Inspector
 * Real-time terminal acoustic spectrum, beat pulse, and FlowMDM DanceBrief inspector.
 */

import type { ChildProcess } from 'node:child_process'

import type { EnergyTier, PersonaArchetype, TimbreBrightness, TrackMetadata } from './types.js'

import { execSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import * as readline from 'node:readline'

import { analyzeAudioBuffer, classifyEnergyTier, classifyTimbreBrightness } from './dsp/analyzer.js'
import { applyHannWindow, computeMagnitudeSpectrum, computeSpectralCentroid } from './dsp/fft.js'
import { decodeWav, encodeWav } from './dsp/wav.js'
import { extractKeyPosesFromTrajectories } from './kinematics/key-pose-extractor.js'
import { synthesizeDanceBrief } from './synthesizer.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CACHE_DIR = resolve(__dirname, '../.cache')
const MANIFEST_PATH = resolve(__dirname, '../tests/fixtures/corpus-manifest.json')

interface ManifestItem {
  id: string
  title: string
  artist: string
  license: string
  url: string
  sha1: string
  expectedBpm: number
  expectedRhythm: string
  genreHint?: string
}

function loadManifest(): ManifestItem[] {
  if (!existsSync(MANIFEST_PATH))
    return []
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8')) as ManifestItem[]
}

function printUsage() {
  console.log(`
Project AIRI - Motion Choreography Real-Time Inspector

Usage:
  pnpm -F @proj-airi/motion-choreography listen [options]

Options:
  --song <id | path>       Corpus song ID or path to local audio file (.wav, .mp3, .ogg, .flac)
                           Default: 'blue-danube-waltz' (or 'synthetic-44')
  --persona <archetype>    Companion persona archetype: idol, gothic_maid, cool_android,
                           chill_gamer, chaotic_gremlin (Default: 'idol')
  --list                   List all public-domain / CC-0 corpus tracks and exit
  -h, --help               Show this help message

Interactive Controls during playback:
  [Space]     Pause / Resume playback
  [p]         Cycle companion persona archetype in real time
  [Left]      Skip backward 10 seconds
  [Right]     Skip forward 10 seconds
  [q]         Quit
`)
}

function printList() {
  const items = loadManifest()
  console.log('\nAvailable Public-Domain / CC-0 Test Corpus Tracks:\n')
  console.log('  • synthetic-44       (In-Memory Synthetic 120 BPM 4/4 Beat)')
  console.log('  • synthetic-waltz    (In-Memory Synthetic 84 BPM 3/4 Waltz)')
  for (const item of items) {
    console.log(`  • ${item.id.padEnd(24)} "${item.title}" - ${item.artist} (~${item.expectedBpm} BPM, ${item.expectedRhythm})`)
  }
  console.log('\nUsage example:')
  console.log('  pnpm -F @proj-airi/motion-choreography listen --song blue-danube-waltz --persona gothic_maid\n')
}

// Ensure cache directory exists
if (!existsSync(CACHE_DIR)) {
  mkdirSync(CACHE_DIR, { recursive: true })
}

/**
 * Downloads a remote URL to a local destination if missing.
 */
async function downloadFile(url: string, destPath: string): Promise<void> {
  const res = await fetch(url)
  if (!res.ok)
    throw new Error(`HTTP ${res.status} fetching ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  writeFileSync(destPath, buf)
}

/**
 * Converts any audio file to 16-bit 44.1kHz mono WAV using ffmpeg or afconvert.
 */
function convertToWav(inputPath: string, outputPath: string): void {
  try {
    execSync(`ffmpeg -y -i "${inputPath}" -ar 44100 -ac 1 "${outputPath}" 2>/dev/null`)
  }
  catch {
    try {
      execSync(`afconvert -f WAVE -d LEI16@44100 -c 1 "${inputPath}" "${outputPath}" 2>/dev/null`)
    }
    catch (e) {
      throw new Error(`Failed to convert ${inputPath} to WAV: neither ffmpeg nor afconvert succeeded: ${e}`)
    }
  }
}

/**
 * Resolves song input into decoded Float32Array PCM buffer and metadata.
 */
async function resolveAudio(songArg: string): Promise<{
  channelData: Float32Array[]
  sampleRate: number
  duration: number
  metadata: TrackMetadata
}> {
  if (songArg === 'synthetic-44') {
    const { generateSynthetic44Beat } = await import('../tests/synthetic-audio.js')
    const syn = generateSynthetic44Beat(120, 30, 44100)
    return {
      channelData: syn.channelData,
      sampleRate: syn.sampleRate,
      duration: syn.duration,
      metadata: { title: 'Synthetic 4/4 Beat', artist: 'AIRI Generator', bpmHint: 120, genreHint: 'House' },
    }
  }

  if (songArg === 'synthetic-waltz') {
    const { generateSyntheticWaltz } = await import('../tests/synthetic-audio.js')
    const syn = generateSyntheticWaltz(84, 30, 44100)
    return {
      channelData: syn.channelData,
      sampleRate: syn.sampleRate,
      duration: syn.duration,
      metadata: { title: 'Synthetic 3/4 Waltz', artist: 'AIRI Generator', bpmHint: 84, genreHint: 'Classical Waltz' },
    }
  }

  // Check corpus manifest
  const manifest = loadManifest()
  const matched = manifest.find(m => m.id === songArg)
  if (matched) {
    const ext = matched.url.split('.').pop() ?? 'ogg'
    const cachedSource = join(CACHE_DIR, `${matched.id}.${ext}`)
    const cachedWav = join(CACHE_DIR, `${matched.id}.wav`)

    if (!existsSync(cachedWav)) {
      if (!existsSync(cachedSource)) {
        process.stdout.write(`Downloading "${matched.title}" from Wikimedia Commons...\n`)
        await downloadFile(matched.url, cachedSource)
      }
      process.stdout.write(`Converting to PCM WAV...\n`)
      convertToWav(cachedSource, cachedWav)
    }

    const wavBytes = readFileSync(cachedWav)
    const decoded = decodeWav(wavBytes)
    return {
      ...decoded,
      metadata: {
        title: matched.title,
        artist: matched.artist,
        bpmHint: matched.expectedBpm,
        genreHint: matched.genreHint,
      },
    }
  }

  // Local file path
  const localPath = resolve(songArg.replace(/^~/, process.env.HOME || ''))
  if (!existsSync(localPath)) {
    throw new Error(`Audio file or corpus ID not found: ${songArg}`)
  }

  let wavPath = localPath
  if (!localPath.toLowerCase().endsWith('.wav')) {
    wavPath = join(CACHE_DIR, `temp-input-${Date.now()}.wav`)
    convertToWav(localPath, wavPath)
  }

  const wavBytes = readFileSync(wavPath)
  const decoded = decodeWav(wavBytes)
  return {
    ...decoded,
    metadata: {
      title: localPath.split('/').pop()?.replace(/\.[^/.]+$/, '') ?? 'Local Track',
      artist: 'Local File',
    },
  }
}

// -------------------------------------------------------------
// Interactive Playback and Terminal UI Engine
// -------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('-h') || args.includes('--help')) {
    printUsage()
    process.exit(0)
  }
  if (args.includes('--list')) {
    printList()
    process.exit(0)
  }

  let songArg = 'blue-danube-waltz'
  let personaArg: PersonaArchetype = 'none'

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--song' && args[i + 1])
      songArg = args[++i]
    else if (args[i] === '--persona' && args[i + 1])
      personaArg = args[++i] as PersonaArchetype
  }

  process.stdout.write('\nAnalyzing audio signal...\n')

  const { channelData, sampleRate, duration, metadata } = await resolveAudio(songArg)
  const mono = channelData[0]

  // Run full DSP analysis
  const features = analyzeAudioBuffer([mono], sampleRate)

  // Pre-extract key-poses across duration using trajectory representation
  const trajSeqLen = Math.floor(duration * 20)
  const dummyPositions: [number, number, number][][] = []
  const dummyTranslations: [number, number, number][] = []
  const dummyRotations: [number, number, number, number][] = []

  for (let t = 0; t < trajSeqLen; t++) {
    const sec = t / 20
    const sampleIdx = Math.min(mono.length - 1, Math.floor(sec * sampleRate))
    const amp = Math.abs(mono[sampleIdx])
    dummyTranslations.push([0, 0.9 + amp * 0.1, 0])
    dummyRotations.push([0, 0, 0, 1])
    dummyPositions.push([
      [amp * Math.sin(t / 4), 0.5, 0],
      [0, amp * Math.cos(t / 4), 0],
    ])
  }

  const danceSheet = extractKeyPosesFromTrajectories(
    {
      seqLen: trajSeqLen,
      fps: 20,
      rootTranslations: dummyTranslations,
      rootRotations: dummyRotations,
      jointPositions: dummyPositions,
    },
    { targetKeyPoseCount: 6, minFrameInterval: 12 },
  )

  // Audio Playback Controller
  const personas: PersonaArchetype[] = ['none', 'idol', 'gothic_maid', 'cool_android', 'chill_gamer', 'chaotic_gremlin']
  let currentPersonaIndex = Math.max(0, personas.indexOf(personaArg))

  let isPlaying = false
  let playheadSeconds = 0.0
  let playbackStartTime = 0.0
  let afplayProcess: ChildProcess | null = null
  const tempWavPath = join(tmpdir(), `airi-preview-${process.pid}.wav`)

  function killAfplay() {
    if (afplayProcess) {
      try {
        afplayProcess.kill('SIGKILL')
      }
      catch {}
      afplayProcess = null
    }
  }

  function startPlayback(fromSeconds: number) {
    killAfplay()
    const clamped = Math.max(0, Math.min(duration - 0.1, fromSeconds))
    playheadSeconds = clamped

    const startSample = Math.floor(clamped * sampleRate)
    const slicedMono = mono.subarray(startSample)
    const encoded = encodeWav([slicedMono], sampleRate)
    writeFileSync(tempWavPath, encoded)

    afplayProcess = spawn('afplay', [tempWavPath], { stdio: 'ignore' })
    afplayProcess.on('exit', () => {
      if (isPlaying && Math.abs(currentPlayhead() - duration) < 0.5) {
        pausePlayback()
        playheadSeconds = 0.0
      }
    })

    playbackStartTime = performance.now() - clamped * 1000
    isPlaying = true
  }

  function pausePlayback() {
    if (isPlaying) {
      playheadSeconds = (performance.now() - playbackStartTime) / 1000
      killAfplay()
      isPlaying = false
    }
  }

  function resumePlayback() {
    if (!isPlaying) {
      startPlayback(playheadSeconds)
    }
  }

  function seek(deltaSec: number) {
    const cur = currentPlayhead()
    const target = Math.max(0, Math.min(duration - 0.5, cur + deltaSec))
    if (isPlaying) {
      startPlayback(target)
    }
    else {
      playheadSeconds = target
    }
  }

  function currentPlayhead(): number {
    if (!isPlaying)
      return playheadSeconds
    return Math.min(duration, (performance.now() - playbackStartTime) / 1000)
  }

  function cleanup() {
    killAfplay()
    if (existsSync(tempWavPath)) {
      try {
        unlinkSync(tempWavPath)
      }
      catch {}
    }
    // Restore terminal: show cursor and exit alternate screen buffer
    process.stdout.write('\u001B[?25h\u001B[?1049l')
    process.exit(0)
  }

  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)
  process.on('exit', killAfplay)

  // Switch to Alternate Screen Buffer and hide cursor for a clean, stable UI
  process.stdout.write('\u001B[?1049h\u001B[?25l\u001B[2J\u001B[H')

  // Configure raw keyboard input
  readline.emitKeypressEvents(process.stdin)
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true)
  }

  process.stdin.on('keypress', (str, key) => {
    if (key.ctrl && key.name === 'c') {
      cleanup()
    }
    else if (key.name === 'q') {
      cleanup()
    }
    else if (key.name === 'space') {
      if (isPlaying)
        pausePlayback()
      else resumePlayback()
    }
    else if (key.name === 'p') {
      currentPersonaIndex = (currentPersonaIndex + 1) % personas.length
    }
    else if (key.name === 'left') {
      seek(-10)
    }
    else if (key.name === 'right') {
      seek(10)
    }
  })

  // Start initial playback
  startPlayback(0)

  // Real-time Spectrum Dynamic Range Trackers (Decibel based with auto-scaling)
  interface BandTracker {
    minDb: number
    maxDb: number
    smoothedRatio: number
  }

  const bandTrackers: BandTracker[] = [
    { minDb: -42, maxDb: -10, smoothedRatio: 0.1 }, // Sub-bass
    { minDb: -38, maxDb: -8, smoothedRatio: 0.1 }, // Low-mid
    { minDb: -42, maxDb: -12, smoothedRatio: 0.1 }, // Mid
    { minDb: -52, maxDb: -18, smoothedRatio: 0.1 }, // Treble
  ]

  const fftSize = 1024
  const frameBuffer = new Float32Array(fftSize)
  let smoothedCentroid = features.spectralCentroid || 1200
  let smoothedRms = features.energyRms || 0.1

  function formatTime(sec: number): string {
    const m = Math.floor(sec / 60)
    const s = (sec % 60).toFixed(1).padStart(4, '0')
    return `${m.toString().padStart(2, '0')}:${s}`
  }

  function makeVuBar(ratio: number, width = 28): string {
    const clamped = Math.max(0, Math.min(1, ratio))
    const filled = Math.round(clamped * width)
    const empty = width - filled

    // Shaded color gradient: Green -> Yellow -> Red
    let barStr = ''
    for (let i = 0; i < filled; i++) {
      const posRatio = i / width
      if (posRatio < 0.6) {
        barStr += '\x1B[32m█\x1B[0m' // Green
      }
      else if (posRatio < 0.85) {
        barStr += '\x1B[33m█\x1B[0m' // Yellow
      }
      else {
        barStr += '\x1B[31m█\x1B[0m' // Red
      }
    }
    return `[${barStr}\x1B[90m${'░'.repeat(empty)}\x1B[0m]`
  }

  function makeProgressBar(ratio: number, width = 28): string {
    const clamped = Math.max(0, Math.min(1, ratio))
    const filled = Math.round(clamped * width)
    return `[\x1B[36m${'█'.repeat(filled)}\x1B[90m${'░'.repeat(width - filled)}\x1B[0m]`
  }

  function makeTiltBar(hz: number, width = 12): string {
    const minLog = Math.log10(150)
    const maxLog = Math.log10(5000)
    const curLog = Math.log10(Math.max(150, Math.min(5000, hz)))
    const ratio = Math.max(0, Math.min(1, (curLog - minLog) / (maxLog - minLog)))
    const pos = Math.round(ratio * (width - 1))

    let dotColor = '\x1B[1;32m'
    if (hz < 850)
      dotColor = '\x1B[1;34m'
    else if (hz < 1500)
      dotColor = '\x1B[1;33m'
    else if (hz <= 3000)
      dotColor = '\x1B[1;32m'
    else dotColor = '\x1B[1;36m'

    let bar = ''
    for (let i = 0; i < width; i++) {
      if (i === pos) {
        bar += `${dotColor}●\x1B[0m`
      }
      else {
        bar += '\x1B[90m─\x1B[0m'
      }
    }
    return `[${bar}]`
  }

  function formatTimbreLabel(timbre: TimbreBrightness): string {
    switch (timbre) {
      case 'dark':
        return '\x1B[1;34mDARK\x1B[0m'
      case 'warm':
        return '\x1B[1;33mWARM\x1B[0m'
      case 'balanced':
        return '\x1B[1;32mBALANCED\x1B[0m'
      case 'bright':
        return '\x1B[1;36mBRIGHT\x1B[0m'
      default:
        return '\x1B[1;32mBALANCED\x1B[0m'
    }
  }

  function formatEnergyLabel(tier: EnergyTier): string {
    switch (tier) {
      case 'low':
        return '\x1B[1;34mLOW\x1B[0m'
      case 'moderate':
        return '\x1B[1;32mMODERATE\x1B[0m'
      case 'high':
        return '\x1B[1;33mHIGH\x1B[0m'
      case 'explosive':
        return '\x1B[1;31mEXPLOSIVE\x1B[0m'
      default:
        return '\x1B[1;32mMODERATE\x1B[0m'
    }
  }

  setInterval(() => {
    const curSec = currentPlayhead()
    const activePersona = personas[currentPersonaIndex]
    const brief = synthesizeDanceBrief(features, metadata, { archetype: activePersona })

    // Instantaneous Spectrum & Signal calculation at curSec
    const sampleIdx = Math.floor(curSec * sampleRate)
    let frameRmsSum = 0
    for (let i = 0; i < fftSize; i++) {
      const s = sampleIdx + i < mono.length ? mono[sampleIdx + i] : 0
      frameBuffer[i] = s
      frameRmsSum += s * s
    }
    const instantRms = Math.sqrt(frameRmsSum / fftSize)
    if (instantRms > smoothedRms) {
      smoothedRms = 0.55 * instantRms + 0.45 * smoothedRms
    }
    else {
      smoothedRms = 0.18 * instantRms + 0.82 * smoothedRms
    }

    applyHannWindow(frameBuffer)
    const mags = computeMagnitudeSpectrum(frameBuffer)

    // Calculate instantaneous centroid with ballistics
    const instantCentroid = computeSpectralCentroid(mags, sampleRate, fftSize)
    if (instantRms > 0.005 && instantCentroid > 0) {
      smoothedCentroid = 0.25 * instantCentroid + 0.75 * smoothedCentroid
    }
    const liveTimbre = classifyTimbreBrightness(smoothedCentroid)
    const liveEnergyTier = classifyEnergyTier(smoothedRms)

    // Per-bin average magnitude across 4 log-spaced frequency bands
    // 1. Sub-bass: bins 1 to 3 (~43Hz to 129Hz)
    let sumSubSq = 0
    for (let k = 1; k <= 3; k++) sumSubSq += mags[k] * mags[k]
    const rmsSub = Math.sqrt(sumSubSq / 3)

    // 2. Low-Mid: bins 3 to 12 (~129Hz to 516Hz)
    let sumLowSq = 0
    for (let k = 3; k < 12; k++) sumLowSq += mags[k] * mags[k]
    const rmsLow = Math.sqrt(sumLowSq / 9)

    // 3. Mid: bins 12 to 58 (~516Hz to 2500Hz)
    let sumMidSq = 0
    for (let k = 12; k < 58; k++) sumMidSq += mags[k] * mags[k]
    const rmsMid = Math.sqrt(sumMidSq / 46)

    // 4. Treble: bins 58 to 370 (~2500Hz to 16000Hz)
    let sumHighSq = 0
    const trebleMaxBin = Math.min(370, mags.length)
    const trebleBinCount = trebleMaxBin - 58
    for (let k = 58; k < trebleMaxBin; k++) sumHighSq += mags[k] * mags[k]
    const rmsHigh = Math.sqrt(sumHighSq / Math.max(1, trebleBinCount))

    const rmsBands = [rmsSub, rmsLow, rmsMid, rmsHigh]

    // Compute decibels and dynamically adapt min/max scale per band
    const bandData = rmsBands.map((rms, idx) => {
      const tracker = bandTrackers[idx]
      const db = 20 * Math.log10(rms + 1e-5)

      // Dynamic peak attack / slow decay
      if (db > tracker.maxDb) {
        tracker.maxDb = db
      }
      else {
        tracker.maxDb -= 0.05 // Slowly decay peak floor
      }

      // Dynamic noise floor
      if (db < tracker.minDb) {
        tracker.minDb = db
      }
      else {
        tracker.minDb += 0.03 // Slowly pull up floor
      }

      const dynRange = Math.max(20, tracker.maxDb - tracker.minDb)
      const rawRatio = Math.max(0, Math.min(1, (db - tracker.minDb) / dynRange))

      // Exponential smoothing (fast attack, smooth release)
      if (rawRatio > tracker.smoothedRatio) {
        tracker.smoothedRatio = 0.65 * rawRatio + 0.35 * tracker.smoothedRatio
      }
      else {
        tracker.smoothedRatio = 0.22 * rawRatio + 0.78 * tracker.smoothedRatio
      }

      return {
        db,
        ratio: tracker.smoothedRatio,
      }
    })

    // Progress bar
    const progressRatio = duration > 0 ? curSec / duration : 0
    const progBar = makeProgressBar(progressRatio, 28)
    const pct = Math.round(progressRatio * 100)

    // Beat Pulse indicator
    const effectiveBpm = brief.bpm > 0 ? brief.bpm : 120
    const isDownbeat = features.beatTimestamps.some(ts => Math.abs(ts - curSec) < 0.12)
    const beatIndex = Math.floor(curSec * (effectiveBpm / 60))

    const isWaltz = features.rhythmStructure === 'waltz_triple'
      || (metadata.genreHint && metadata.genreHint.toLowerCase().includes('waltz'))
      || brief.detectedGenre.toLowerCase().includes('waltz')

    let meterVisual = ''
    if (isWaltz) {
      const beatInBar = beatIndex % 3
      meterVisual = beatInBar === 0 ? '\x1B[1;32m●\x1B[0m ○ ○' : beatInBar === 1 ? '○ \x1B[1;32m●\x1B[0m ○' : '○ ○ \x1B[1;32m●\x1B[0m'
    }
    else {
      const beatInBar = beatIndex % 4
      meterVisual = beatInBar === 0 ? '\x1B[1;32m●\x1B[0m ○ ○ ○' : beatInBar === 1 ? '○ \x1B[1;32m●\x1B[0m ○ ○' : beatInBar === 2 ? '○ ○ \x1B[1;32m●\x1B[0m ○' : '○ ○ ○ \x1B[1;32m●\x1B[0m'
    }

    const stateLabel = isPlaying ? '\x1B[1;32mPLAYING\x1B[0m' : '\x1B[1;33mPAUSED \x1B[0m'
    const beatFlash = isDownbeat ? '\x1B[1;32m● BEAT\x1B[0m' : '\x1B[90m○ beat\x1B[0m'

    // Key-poses hit so far
    const recentKeyposes = danceSheet.keyframes.filter(kf => kf.timeSeconds <= curSec)
    const latestPose = recentKeyposes.length > 0 ? recentKeyposes[recentKeyposes.length - 1] : null
    const isPoseFlash = latestPose && Math.abs(curSec - latestPose.timeSeconds) < 0.35

    const out: string[] = []
    out.push('\x1B[H') // Home cursor to 0,0
    out.push('\x1B[1;36m╭─ Project AIRI ── The Identifier & Motion Choreographer ──────────────────────────\x1B[0m\x1B[K')
    out.push(`│  Track  : \x1B[1m${metadata.title ?? songArg}\x1B[0m ${metadata.artist ? `\x1B[90mby ${metadata.artist}\x1B[0m` : ''}\x1B[K`)
    out.push(`│  Status : [ ${stateLabel} ]    Time : [${formatTime(curSec)} / ${formatTime(duration)}]  ${progBar}  \x1B[1m${pct}%\x1B[0m\x1B[K`)
    out.push('\x1B[1;36m╰──────────────────────────────────────────────────────────────────────────────────\x1B[0m\x1B[K')
    out.push('\x1B[K')

    out.push('\x1B[1;33m╭─ Live Acoustic Spectrum & Dynamic Range ─────────────────────────────────────────\x1B[0m\x1B[K')
    out.push(`│  Sub-Bass (40Hz)   : ${makeVuBar(bandData[0].ratio, 28)}  \x1B[1m${Math.round(bandData[0].ratio * 100).toString().padStart(3, ' ')}%\x1B[0m \x1B[90m(${bandData[0].db.toFixed(1)} dB)\x1B[0m\x1B[K`)
    out.push(`│  Low-Mid  (250Hz)  : ${makeVuBar(bandData[1].ratio, 28)}  \x1B[1m${Math.round(bandData[1].ratio * 100).toString().padStart(3, ' ')}%\x1B[0m \x1B[90m(${bandData[1].db.toFixed(1)} dB)\x1B[0m\x1B[K`)
    out.push(`│  Mid     (1000Hz)  : ${makeVuBar(bandData[2].ratio, 28)}  \x1B[1m${Math.round(bandData[2].ratio * 100).toString().padStart(3, ' ')}%\x1B[0m \x1B[90m(${bandData[2].db.toFixed(1)} dB)\x1B[0m\x1B[K`)
    out.push(`│  Treble   (4000Hz) : ${makeVuBar(bandData[3].ratio, 28)}  \x1B[1m${Math.round(bandData[3].ratio * 100).toString().padStart(3, ' ')}%\x1B[0m \x1B[90m(${bandData[3].db.toFixed(1)} dB)\x1B[0m\x1B[K`)
    out.push(`│\x1B[K`)
    out.push(`│  RMS Energy: \x1B[1m${smoothedRms.toFixed(4)}\x1B[0m [${formatEnergyLabel(liveEnergyTier)}]       Spectral: \x1B[1m${Math.round(smoothedCentroid).toString().padStart(4, ' ')} Hz\x1B[0m ${makeTiltBar(smoothedCentroid)} [${formatTimbreLabel(liveTimbre)}]\x1B[K`)
    out.push('\x1B[1;33m╰──────────────────────────────────────────────────────────────────────────────────\x1B[0m\x1B[K')
    out.push('\x1B[K')

    out.push('\x1B[1;32m╭─ Metric Cadence & Beat Pulse ────────────────────────────────────────────────────\x1B[0m\x1B[K')
    out.push(`│  Tempo : \x1B[1m${effectiveBpm} BPM\x1B[0m \x1B[90m(Confidence: ${(features.confidence * 100).toFixed(0)}%)\x1B[0m        Pulse : [ ${beatFlash} ]\x1B[K`)
    out.push(`│  Meter : ${meterVisual}  [\x1B[1m${isWaltz ? 'waltz_triple (3/4)' : features.rhythmStructure}\x1B[0m]\x1B[K`)
    out.push(`│  Groove: \x1B[90m${isWaltz ? 'Swaying 3/4 triple meter with graceful waltz lilt' : brief.rhythmDescriptor}\x1B[0m\x1B[K`)
    out.push('\x1B[1;32m╰──────────────────────────────────────────────────────────────────────────────────\x1B[0m\x1B[K')
    out.push('\x1B[K')

    out.push('\x1B[1;35m╭─ Real-Time FlowMDM DanceBrief & Key-Pose Feed ───────────────────────────────────\x1B[0m\x1B[K')
    const personaLabel = activePersona === 'none' ? 'none (pure beat)' : activePersona
    out.push(`│  Active Persona : [\x1B[1;33m ${personaLabel.padEnd(16)} \x1B[0m]  \x1B[90m(press 'p' to switch)\x1B[0m\x1B[K`)
    out.push(`│  Detected Genre : \x1B[1m${brief.detectedGenre}\x1B[0m\x1B[K`)
    out.push(`│  FlowMDM Prompt :\x1B[K`)
    out.push(`│    \x1B[37m"${brief.choreographerPrompt.slice(0, 78)}\x1B[0m\x1B[K`)
    if (brief.choreographerPrompt.length > 78) {
      out.push(`│     \x1B[37m${brief.choreographerPrompt.slice(78, 156)}"\x1B[0m\x1B[K`)
    }
    else {
      out.push(`│     \x1B[37m"\x1B[0m\x1B[K`)
    }
    out.push(`│\x1B[K`)

    if (isPoseFlash && latestPose) {
      out.push(`│  \x1B[1;33m⭐ KEY-POSE #${latestPose.frameIndex}: [${latestPose.poseType.toUpperCase()}] at ${formatTime(latestPose.timeSeconds)} (Salience: ${latestPose.salienceScore})\x1B[0m\x1B[K`)
    }
    else {
      const poseInfo = latestPose
        ? `Last Pose: #${latestPose.frameIndex} [${latestPose.poseType}] at ${formatTime(latestPose.timeSeconds)}`
        : 'Waiting for anchor key-pose inflection...'
      out.push(`│  \x1B[90m${poseInfo}\x1B[0m\x1B[K`)
    }
    out.push('\x1B[1;35m╰──────────────────────────────────────────────────────────────────────────────────\x1B[0m\x1B[K')
    out.push('\x1B[K')
    out.push('\x1B[90mControls: [Space] Pause/Resume | [p] Cycle Persona | [←/→] Skip ±10s | [q] Quit\x1B[0m\x1B[K')

    process.stdout.write(`${out.join('\n')}\x1B[J`) // Clear rest of screen below
  }, 33)
}

main().catch((err) => {
  process.stdout.write('\u001B[?25h\u001B[?1049l\n') // Show cursor and restore screen
  console.error('\nError in Motion Choreography Inspector:', err)
  process.exit(1)
})
