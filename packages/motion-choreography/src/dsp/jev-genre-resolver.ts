/**
 * TypeSafe Jev System-1 Musical Genre Resolver.
 * Uses high-speed non-autoregressive discrete decisions to classify musical genre
 * from extracted acoustic telemetry across a 17-genre open taxonomy.
 */

import type { AcousticFeatures } from '../types.js'

export const ALL_GENRES_CRITERIA: Record<string, string> = {
  // --- 1. Classical, Acoustic & Vintage Heritage ---
  classical_waltz:
    'Symphony orchestra in 3/4 triple meter, swaying waltz cadence, acoustic strings, woodwinds, and brass with natural high-frequency roll-off.',
  military_march:
    'Acoustic brass and percussion band in crisp 2/4 or 4/4 meter, steady driving snare rolls, pomp and ceremony (Sousa style).',
  ragtime:
    'Syncopated acoustic piano, 90-105 BPM, bouncy left-hand stride bass with heavily syncopated right-hand melodies (Scott Joplin style).',

  // --- 2. Electronic Dance & Club Music (4/4 Grid) ---
  electro_house_edm:
    'High-energy electronic dance music, 124-130 BPM, 4/4 four-on-the-floor kick, bright aggressive saw synths, heavy sidechain pump.',
  deep_house_dance_pop:
    'Melodic club groove, 118-124 BPM, steady 4/4 kick, warm bassline, vocal pocket, organic percussion.',
  nu_disco_midtempo:
    'Mid-tempo groove, 105-117 BPM, 4/4 disco pulse, funk-influenced bass guitar riffs, bright rhythm guitar.',
  chiptune_electro:
    'Retro 8-bit synthetic audio, 125-135 BPM, fast arpeggiated square/triangle chip leads, arcade game aesthetic.',

  // --- 3. High-Cadence Breakbeat & Bass Music ---
  drum_and_bass:
    'Ultra-fast breakbeat, 168-175 BPM, two-step syncopated kick/snare pattern, heavy reese sub-bass, dark or balanced timbre.',
  jungle_breakbeat:
    'Fast chopped breakbeat, 155-165 BPM, complex syncopated acoustic drum breaks (Amen break style) over deep 808 sub-bass.',

  // --- 4. Hip-Hop, Trap, & Funk (Urban Rhythms) ---
  hip_hop_boombap:
    'Laid-back 90s hip-hop, 82-96 BPM, swung syncopated rhythm, heavy acoustic kick on 1, hard cracking snare on 2 and 4, warm analog presence.',
  modern_trap:
    'Modern trap cadence, 130-150 BPM felt at half-time (65-75 BPM), massive saturated 808 sub-bass, rapid 16th/32nd-note hi-hat triplet rolls.',
  syncopated_future_bass:
    'Melodic half-time EDM/Pop, 140-160 BPM (half-time 70-80 BPM), swinging sidechained supersaws, syncopated vocal chops.',
  funk_groove:
    '1970s funk groove, 95-115 BPM, heavily syncopated slap bassline, tight rhythm guitar chucks, off-beat syncopated groove.',

  // --- 5. Spanish, Latin, & Caribbean Rhythms ---
  reggaeton_latin_urban:
    'Latin urban rhythm, 90-100 BPM, iconic 3:3:2 Dembow kick-and-snare syncopation (boom-cha-boom-chick), heavy sub-bass.',
  salsa_afrocuban:
    'High-velocity Afro-Cuban dance, 170-220 BPM, syncopated 3:2 or 2:3 Son Clave pattern, acoustic conga tumbao, timbales, and brass stabs.',
  bachata:
    'Dominican dance in 4/4, 120-140 BPM, syncopated 4th-beat bass accent/pop, bongo martillo rhythm, prominent nylon-string lead guitar.',

  // --- 6. Atmospheric & Freeform ---
  ambient_downtempo:
    'Low-energy atmospheric soundscape, floating textures, absence of a steady rhythmic drum grid or bassline, peaceful/freeform.',
}

export const GENRE_DISPLAY_NAMES: Record<string, string> = {
  classical_waltz: 'Classical Waltz / Triple Meter Ballad',
  military_march: 'Military March / Brass Band',
  ragtime: 'Ragtime / Stride Piano',
  electro_house_edm: 'Electro House / Festival EDM',
  deep_house_dance_pop: 'House / Dance Pop',
  nu_disco_midtempo: 'Nu-Disco / Mid-Tempo Groove',
  chiptune_electro: 'Chiptune / 8-Bit Electro',
  drum_and_bass: 'Drum & Bass / Neurofunk',
  jungle_breakbeat: 'Jungle / Fast Breakbeat',
  hip_hop_boombap: '90s Boom-Bap Hip-Hop',
  modern_trap: 'Modern Trap',
  syncopated_future_bass: 'Syncopated Future Bass / Pop',
  funk_groove: 'Funk / Soul Groove',
  reggaeton_latin_urban: 'Reggaeton / Latin Urban',
  salsa_afrocuban: 'Salsa / Afro-Cuban',
  bachata: 'Bachata / Latin Guitar',
  ambient_downtempo: 'Ambient Soundscape / Downtempo',
}

export interface JevGenreOptions {
  apiKey?: string
  endpoint?: string
  model?: string
  signal?: AbortSignal
}

export interface JevGenreResult {
  genreKey: string
  genreTitle: string
  confidence: number
  probabilities: Record<string, number>
}

/**
 * Serializes physical acoustic features into a descriptive text prompt for Jev.
 */
export function formatAcousticTelemetry(
  features: AcousticFeatures,
  bandStats?: { subDb?: number, lowDb?: number, midDb?: number, highDb?: number },
): string {
  const parts: string[] = [
    `Acoustic audio signal telemetry extracted from audio PCM:`,
    `- Tempo: ${features.bpm} BPM`,
    `- Rhythm structure: ${features.rhythmStructure}`,
    `- Energy: ${features.energyTier} (RMS: ${features.energyRms.toFixed(4)})`,
    `- Timbre: ${features.timbreBrightness} (Spectral Centroid: ${features.spectralCentroid} Hz)`,
  ]

  if (features.rhythmStructure === 'waltz_triple') {
    parts.push(`- Metric note: 3/4 triple meter with strong 3-beat downbeat accent covariance`)
  }
  else if (features.rhythmStructure === 'fast_breakbeat') {
    parts.push(`- Metric note: High-cadence broken beat cadence`)
  }
  else if (features.rhythmStructure === 'syncopated') {
    parts.push(`- Metric note: High off-beat syncopation ratio on inter-onset intervals`)
  }

  if (bandStats) {
    const subStr = bandStats.subDb !== undefined ? `${bandStats.subDb.toFixed(1)} dB` : 'unknown'
    const lowStr = bandStats.lowDb !== undefined ? `${bandStats.lowDb.toFixed(1)} dB` : 'unknown'
    const midStr = bandStats.midDb !== undefined ? `${bandStats.midDb.toFixed(1)} dB` : 'unknown'
    const highStr = bandStats.highDb !== undefined ? `${bandStats.highDb.toFixed(1)} dB` : 'unknown'
    parts.push(`- Frequency levels: Sub-Bass: ${subStr}, Low-Mid: ${lowStr}, Mid: ${midStr}, Treble: ${highStr}`)
  }

  return parts.join('\n')
}

/**
 * Calls TypeSafe Jev System-1 API to determine genre from acoustic telemetry.
 * Returns null if no API key is configured or if the request fails.
 */
export async function resolveGenreWithJev(
  features: AcousticFeatures,
  options: JevGenreOptions = {},
  bandStats?: { subDb?: number, lowDb?: number, midDb?: number, highDb?: number },
): Promise<JevGenreResult | null> {
  const apiKey = options.apiKey
    || (typeof process !== 'undefined' ? process.env?.OPENCODE_API_KEY || process.env?.JEV_API_KEY : '')
    || 'oc_sk_b5f83e623ff3_A6Dg_njtWAu0q3lSWorqxiha7RFDBWCV'

  if (!apiKey || apiKey.trim().length === 0) {
    return null
  }

  const endpoint = options.endpoint || 'https://opencode.ai/zen/v1/systemone'
  const model = options.model || 'jev-1.13-free'
  const state = formatAcousticTelemetry(features, bandStats)

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        state,
        questions: {
          genre: {
            type: 'choice',
            instructions: 'Determine the single most accurate musical genre of this track from the acoustic telemetry.',
            criteria: ALL_GENRES_CRITERIA,
          },
        },
      }),
      signal: options.signal,
    })

    if (!res.ok) {
      return null
    }

    const data = await res.json() as any
    const genreAnswer = data?.answers?.genre
    if (!genreAnswer || !genreAnswer.choice) {
      return null
    }

    const genreKey = String(genreAnswer.choice)
    const genreTitle = GENRE_DISPLAY_NAMES[genreKey] || genreKey
    const confidence = typeof genreAnswer.confidence === 'number' ? genreAnswer.confidence : 1.0
    const probabilities = genreAnswer.probabilities || {}

    return {
      genreKey,
      genreTitle,
      confidence,
      probabilities,
    }
  }
  catch {
    return null
  }
}
