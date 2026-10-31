import type { Card } from '@proj-airi/ccc'

import type { ModelCapabilityItem } from '../libs/character/model-capabilities'
import type { CharacterCueAllowlist } from '../types/card.schema'

import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { useSystemOneStore } from '../stores/modules/system-one'
import {
  calculateWpmBudgetMs,
  containsExplicitActToken,
  createSentenceStrideBuffer,
  extractTokensFromPrompt,
  isClassifiableSentence,
  normalizeSentenceText,
  normalizeStrideText,
  resolveAllowedEmotionOptions,
  resolveCueToken,
  splitSentences,
  useAutonomousCues,
} from './use-autonomous-cues'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

describe('use-autonomous-cues', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('sentence stride buffer & splitting', () => {
    it('slices complete sentences on [.?!] boundaries', () => {
      const buffer = createSentenceStrideBuffer()
      const sentences = buffer.feed('Hello world! How are you today? I am fine.')
      expect(sentences).toEqual([
        'Hello world!',
        'How are you today?',
        'I am fine.',
      ])
      expect(buffer.flush()).toEqual([])
    })

    it('assembles fragmented streaming deltas into complete sentences', () => {
      const buffer = createSentenceStrideBuffer()

      expect(buffer.feed('Wait, are ')).toEqual([])
      expect(buffer.feed('you serious?! ')).toEqual(['Wait, are you serious?!'])
      expect(buffer.feed('No, really.')).toEqual(['No, really.'])
      expect(buffer.flush()).toEqual([])
    })

    it('holds incomplete trailing fragments until flushed at stream end', () => {
      const buffer = createSentenceStrideBuffer()

      expect(buffer.feed('First sentence. The trailing fragment has no period')).toEqual([
        'First sentence.',
      ])
      expect(buffer.getPendingBuffer()).toBe(' The trailing fragment has no period')

      const flushed = buffer.flush()
      expect(flushed).toEqual(['The trailing fragment has no period'])
      expect(buffer.getPendingBuffer()).toBe('')
    })

    it('clears buffer cleanly on reset()', () => {
      const buffer = createSentenceStrideBuffer()
      buffer.feed('Incomplete sentence without end')
      expect(buffer.getPendingBuffer()).toBe('Incomplete sentence without end')
      buffer.reset()
      expect(buffer.getPendingBuffer()).toBe('')
      expect(buffer.flush()).toEqual([])
    })

    it('discards trailing pure punctuation or noise fragments on flush()', () => {
      const buffer = createSentenceStrideBuffer()
      buffer.feed('Hello world! ~')
      expect(buffer.flush()).toEqual([])

      const buffer2 = createSentenceStrideBuffer()
      buffer2.feed('First line. ...')
      expect(buffer2.flush()).toEqual([])
    })

    it('splitSentences helper slices entire text blocks cleanly', () => {
      const sentences = splitSentences('Hello there! Yes, you. What is your name?')
      expect(sentences).toEqual([
        'Hello there!',
        'Yes, you.',
        'What is your name?',
      ])
    })
  })

  describe('isClassifiableSentence noise filtering', () => {
    it('rejects pure punctuation and symbols', () => {
      expect(isClassifiableSentence('~')).toBe(false)
      expect(isClassifiableSentence('~ ~')).toBe(false)
      expect(isClassifiableSentence('...')).toBe(false)
      expect(isClassifiableSentence('!??')).toBe(false)
      expect(isClassifiableSentence('✨')).toBe(false)
      expect(isClassifiableSentence('')).toBe(false)
      expect(isClassifiableSentence('   ')).toBe(false)
    })

    it('rejects short fragments below the 7-character or 2-word threshold', () => {
      expect(isClassifiableSentence('Oh!')).toBe(false)
      expect(isClassifiableSentence('Ooh~')).toBe(false)
      expect(isClassifiableSentence('Yes.')).toBe(false)
      expect(isClassifiableSentence('No.')).toBe(false)
    })

    it('accepts multi-word sentences meeting length and word count criteria', () => {
      expect(isClassifiableSentence('Rainy days are just secret cuddle days wearing a grey disguise!')).toBe(true)
      expect(isClassifiableSentence('What do you think about them?')).toBe(true)
      expect(isClassifiableSentence('Hello there, how are you?')).toBe(true)
      expect(isClassifiableSentence('I agree with that.')).toBe(true)
    })

    it('accepts CJK sentences with 3 or more characters even without spaces', () => {
      expect(isClassifiableSentence('雨の日ですね')).toBe(true)
      expect(isClassifiableSentence('今天天气真好')).toBe(true)
      expect(isClassifiableSentence('안녕하세요')).toBe(true)
      expect(isClassifiableSentence('好~')).toBe(false)
    })
  })

  describe('explicit ACT marker detection & normalization', () => {
    it('identifies explicit ACT markers', () => {
      expect(containsExplicitActToken('<|ACT:emotion="happy"|> Hello!')).toBe(true)
      expect(containsExplicitActToken('Look at this <|ACT:motion="wave"|>')).toBe(true)
      expect(containsExplicitActToken('Bare close <|ACT:emotion="smug"> text')).toBe(true)
      expect(containsExplicitActToken('Plain dialogue without markup.')).toBe(false)
      expect(containsExplicitActToken('[whisper] TTS speech tag only')).toBe(false)
    })

    it('normalizes sentence text by removing ACT tokens', () => {
      const text = '<|ACT:emotion="happy"|> Hello world!'
      expect(normalizeSentenceText(text)).toBe('Hello world!')
    })

    it('normalizes stride text across punctuation, ACT tokens, and Unicode scripts', () => {
      expect(normalizeStrideText('Hmm~ let me count in my memories...')).toBe('hmm let me count in my memories')
      expect(normalizeStrideText('<|ACT:emotion="happy"|> Hello world!')).toBe('hello world')
      expect(normalizeStrideText('so that means… about six and a half months?')).toBe('so that means about six and a half months')
      expect(normalizeStrideText('こんにちは！元気ですか？')).toBe('こんにちは 元気ですか')
    })
  })

  describe('wPM spoken duration budget calculation', () => {
    it('computes 90% spoken duration budget based on word count', () => {
      // 5 words at 150 WPM: (5 / 150) * 60,000 * 0.9 = 1,800ms
      expect(calculateWpmBudgetMs('One two three four five.')).toBe(1800)

      // 10 words at 150 WPM: (10 / 150) * 60,000 * 0.9 = 3,600ms
      expect(calculateWpmBudgetMs('One two three four five six seven eight nine ten.')).toBe(3600)

      // Enforces a minimum duration floor of 500ms for short words
      expect(calculateWpmBudgetMs('Hi.')).toBe(500)
    })
  })

  describe('cue token resolution & allowlist lookup', () => {
    const allowlist: CharacterCueAllowlist = {
      version: 1,
      emotions: {
        smug: { rawKey: 'F01_Face_Smug', label: 'Smug Smirk' },
        happy: { rawKey: 'Surprised', label: 'Happy Joy' },
      },
      motions: {
        wave: { rawKey: 'Mtn_HandWave', label: 'Friendly Wave' },
      },
    }

    const capabilities: ModelCapabilityItem[] = [
      { rawKey: 'F02_Face_Angry', label: 'Angry Glare', usable: true },
      { rawKey: 'Blink_L', label: 'Left Blink', usable: true },
      { rawKey: 'Broken_Morph', label: 'Broken', usable: false },
    ]

    it('resolves semantic token from cueAllowlist emotions', () => {
      const res = resolveCueToken('smug', { allowlist, capabilities })
      expect(res).toEqual({ rawKey: 'F01_Face_Smug', label: 'Smug Smirk' })
    })

    it('resolves semantic token from cueAllowlist motions', () => {
      const res = resolveCueToken('wave', { allowlist, capabilities })
      expect(res).toEqual({ rawKey: 'Mtn_HandWave', label: 'Friendly Wave' })
    })

    it('falls back to model capability by label match', () => {
      const res = resolveCueToken('Angry Glare', { allowlist, capabilities })
      expect(res).toEqual({ rawKey: 'F02_Face_Angry', label: 'Angry Glare' })
    })

    it('falls back to model capability by rawKey match', () => {
      const res = resolveCueToken('Blink_L', { allowlist, capabilities })
      expect(res).toEqual({ rawKey: 'Blink_L', label: 'Left Blink' })
    })

    it('ignores unusable model capabilities', () => {
      const res = resolveCueToken('Broken', { allowlist, capabilities })
      expect(res).toBeNull()
    })

    it('matches directly against physical rig expressions when available', () => {
      const res = resolveCueToken('Surprise_Rig_Key', { rigExpressions: ['Smile_Rig', 'Surprise_Rig_Key'] })
      expect(res).toEqual({ rawKey: 'Surprise_Rig_Key', label: 'Surprise_Rig_Key' })
    })

    it('resolves allowlist rawKey with case normalization against rigExpressions', () => {
      const res = resolveCueToken('smug', {
        allowlist,
        rigExpressions: ['f01_face_smug'],
      })
      expect(res).toEqual({ rawKey: 'f01_face_smug', label: 'Smug Smirk' })
    })

    it('returns null for unmapped tokens or "none"', () => {
      expect(resolveCueToken('none', { allowlist, capabilities })).toBeNull()
      expect(resolveCueToken('non_existent_token', { allowlist, capabilities })).toBeNull()
    })
  })

  describe('allowed emotion options resolution', () => {
    it('returns allowlist emotion keys plus none when present', () => {
      const allowlist: CharacterCueAllowlist = {
        version: 1,
        emotions: {
          smug: { rawKey: 'Smug', label: 'Smug' },
          pout: { rawKey: 'Pout', label: 'Pout' },
        },
      }
      const { options, isFallback } = resolveAllowedEmotionOptions(allowlist)
      expect(options).toEqual(['none', 'smug', 'pout'])
      expect(isFallback).toBe(false)
    })

    it('returns allowlist emotion keys plus none when present in manual mode (leaving motions empty)', () => {
      const allowlist: CharacterCueAllowlist = {
        emotions: {
          smug: { rawKey: 'Smug', label: 'Smug' },
          pout: { rawKey: 'Pout', label: 'Pout' },
        },
      }
      const motionCaps: ModelCapabilityItem[] = [
        { rawKey: 'Happy_1', label: 'Happy 1', usable: true },
      ]
      const { options, isFallback } = resolveAllowedEmotionOptions(allowlist, [], motionCaps, { autoMode: false })
      expect(options).toEqual(['none', 'smug', 'pout'])
      expect(isFallback).toBe(false)
    })

    it('populates both emotions and motions from active model when autoMode is true with variant stemming', () => {
      const capabilities: ModelCapabilityItem[] = [
        { rawKey: 'Joy', label: 'Joy', usable: true },
        { rawKey: 'Sad', label: 'Sad', usable: true },
        { rawKey: 'Noise', label: 'Noise', usable: false },
      ]
      const motionCaps: ModelCapabilityItem[] = [
        { rawKey: 'Happy_1', label: 'Happy 1', usable: true },
        { rawKey: 'Happy_2', label: 'Happy 2', usable: true },
        { rawKey: 'Angry_1', label: 'Angry 1', usable: true },
      ]
      const { options, isFallback, variantMap } = resolveAllowedEmotionOptions(undefined, capabilities, motionCaps, { autoMode: true })
      expect(options).toEqual(['none', 'Joy', 'Sad', 'Happy', 'Angry'])
      expect(isFallback).toBe(false)
      expect(variantMap.get('Happy')).toEqual(['Happy 1', 'Happy 2'])
      expect(variantMap.get('Angry')).toEqual(['Angry 1'])
    })

    it('returns only none when allowlist is empty in manual mode', () => {
      const capabilities: ModelCapabilityItem[] = [
        { rawKey: 'Default', label: 'Default', usable: true },
      ]
      const { options, isFallback } = resolveAllowedEmotionOptions(undefined, capabilities, [], { autoMode: false })
      expect(options).toEqual(['none'])
      expect(isFallback).toBe(false)
    })

    it('returns only none without fallbacks when both model capabilities are empty in auto mode', () => {
      const { options, isFallback } = resolveAllowedEmotionOptions(undefined, [], [], { autoMode: true })
      expect(options).toEqual(['none'])
      expect(isFallback).toBe(false)
    })
  })

  describe('useAutonomousCues composable execution & evaporation doctrine', () => {
    function createMockCard(overrides: Partial<any> = {}): Card {
      return {
        id: 'card-test-1',
        name: 'Test Character',
        personality: 'Tsundere and proud.',
        description: 'A sharp-tongued student.',
        extensions: {
          airi: {
            acting: {
              autoCuesEnabled: true,
              cueAllowlist: {
                version: 1,
                emotions: {
                  smug: { rawKey: 'F_Smug', label: 'Smug' },
                  happy: { rawKey: 'F_Happy', label: 'Happy' },
                },
              },
              ...overrides,
            },
          },
        },
      } as unknown as Card
    }

    it('skips evaluation and records "disabled" when autoCuesEnabled is false', async () => {
      const card = createMockCard({ autoCuesEnabled: false })
      const actuateEmotion = vi.fn()
      const { evaluateSentenceStride } = useAutonomousCues({ activeCard: card, actuateEmotion })

      const record = await evaluateSentenceStride('You really did that?')
      expect(record.status).toBe('disabled')
      expect(actuateEmotion).not.toHaveBeenCalled()
    })

    it('skips evaluation and records "skipped-prefixed" when sentence has explicit ACT tag', async () => {
      const card = createMockCard({ autoCuesEnabled: true })
      const actuateEmotion = vi.fn()
      const { evaluateSentenceStride } = useAutonomousCues({ activeCard: card, actuateEmotion })

      const record = await evaluateSentenceStride('<|ACT:emotion="smug"|> I knew you would do that.')
      expect(record.status).toBe('skipped-prefixed')
      expect(record.sentence).toBe('I knew you would do that.')
      expect(actuateEmotion).not.toHaveBeenCalled()
    })

    it('degrades gracefully and records "unconfigured" when System 1 is not configured', async () => {
      const card = createMockCard({ autoCuesEnabled: true })
      const actuateEmotion = vi.fn()
      const systemOneStore = useSystemOneStore()
      systemOneStore.activeProvider = 'none'

      const { evaluateSentenceStride } = useAutonomousCues({ activeCard: card, actuateEmotion })

      const record = await evaluateSentenceStride('Are you listening?')
      expect(record.status).toBe('unconfigured')
      expect(actuateEmotion).not.toHaveBeenCalled()
    })

    it('executes System 1, fires actuation, and enforces the Evaporation Doctrine', async () => {
      const card = createMockCard({ autoCuesEnabled: true })
      const actuateEmotion = vi.fn()
      const systemOneStore = useSystemOneStore()
      systemOneStore.activeProvider = 'laya-local'

      vi.spyOn(systemOneStore, 'execute').mockResolvedValueOnce({
        answers: {
          emotion: {
            choice: 'smug',
            confidence: 0.92,
          },
        },
      } as any)

      const { evaluateSentenceStride } = useAutonomousCues({ activeCard: card, actuateEmotion })

      const sentence = 'Did you really think I wouldn\'t notice?'
      const record = await evaluateSentenceStride(sentence)

      expect(record.status).toBe('fired')
      expect(record.token).toBe('smug')
      expect(record.rawKey).toBe('F_Smug')
      expect(record.confidence).toBe(0.92)

      // Actuation fired in-memory with provenance
      expect(actuateEmotion).toHaveBeenCalledTimes(1)
      expect(actuateEmotion).toHaveBeenCalledWith('F_Smug', expect.objectContaining({
        token: 'smug',
        rawKey: 'F_Smug',
        sentence,
        confidence: 0.92,
        provenance: 'autonomous_system_one',
      }))

      // Evaporation doctrine assertion: original input sentence is unpolluted
      expect(record.sentence).toBe(sentence)
      expect(record.sentence).not.toContain('<|ACT:')
    })

    it('records "none" when System 1 picks none and fires zero actuation', async () => {
      const card = createMockCard({ autoCuesEnabled: true })
      const actuateEmotion = vi.fn()
      const systemOneStore = useSystemOneStore()
      systemOneStore.activeProvider = 'laya-local'

      vi.spyOn(systemOneStore, 'execute').mockResolvedValueOnce({
        answers: {
          emotion: {
            choice: 'none',
            confidence: 0.88,
          },
        },
      } as any)

      const { evaluateSentenceStride } = useAutonomousCues({ activeCard: card, actuateEmotion })

      const record = await evaluateSentenceStride('The temperature outside is 20 degrees.')
      expect(record.status).toBe('none')
      expect(record.token).toBe('none')
      expect(actuateEmotion).not.toHaveBeenCalled()
    })

    it('records "unmapped" when chosen token cannot be resolved to rawKey', async () => {
      const card = createMockCard({ autoCuesEnabled: true })
      const actuateEmotion = vi.fn()
      const systemOneStore = useSystemOneStore()
      systemOneStore.activeProvider = 'laya-local'

      vi.spyOn(systemOneStore, 'execute').mockResolvedValueOnce({
        answers: {
          emotion: {
            choice: 'unknown_hallucinated_token',
            confidence: 0.7,
          },
        },
      } as any)

      const { evaluateSentenceStride } = useAutonomousCues({ activeCard: card, actuateEmotion })

      const record = await evaluateSentenceStride('What is going on?')
      expect(record.status).toBe('unmapped')
      expect(record.rawKey).toBeNull()
      expect(actuateEmotion).not.toHaveBeenCalled()
    })

    it('drops cue and records "budget-dropped" when latency exceeds WPM budget and enforceBudget is enabled', async () => {
      const card = createMockCard({ autoCuesEnabled: true })
      const actuateEmotion = vi.fn()
      const systemOneStore = useSystemOneStore()
      systemOneStore.activeProvider = 'laya-local'

      // Mock execute with artificial delay exceeding budget
      vi.spyOn(systemOneStore, 'execute').mockImplementationOnce(async () => {
        // Sentence 'Go now.' has 720ms budget; delay 800ms
        await new Promise(resolve => setTimeout(resolve, 800))
        return {
          answers: {
            emotion: { choice: 'happy', confidence: 0.9 },
          },
        } as any
      })

      const { evaluateSentenceStride } = useAutonomousCues({
        activeCard: card,
        actuateEmotion,
        enforceBudget: true,
      })

      const record = await evaluateSentenceStride('Go now.')
      expect(record.status).toBe('budget-dropped')
      expect(actuateEmotion).not.toHaveBeenCalled()
    })

    it('does not drop cue when enforceBudget is false even if latency exceeds WPM budget (holds for playback queue)', async () => {
      const card = createMockCard({ autoCuesEnabled: true })
      const actuateEmotion = vi.fn()
      const systemOneStore = useSystemOneStore()
      systemOneStore.activeProvider = 'laya-local'

      vi.spyOn(systemOneStore, 'execute').mockImplementationOnce(async () => {
        await new Promise(resolve => setTimeout(resolve, 800))
        return {
          answers: {
            emotion: { choice: 'happy', confidence: 0.9 },
          },
        } as any
      })

      const { evaluateSentenceStride } = useAutonomousCues({
        activeCard: card,
        actuateEmotion,
        enforceBudget: false,
      })

      const record = await evaluateSentenceStride('Go now.')
      expect(record.status).toBe('fired')
      expect(record.rawKey).toBe('F_Happy')
      expect(actuateEmotion).toHaveBeenCalledWith('F_Happy', expect.objectContaining({
        token: 'happy',
        rawKey: 'F_Happy',
      }))
    })

    it('skips evaluation and records "skipped-noise" without invoking System 1 for short fragments or punctuation', async () => {
      const card = createMockCard({ autoCuesEnabled: true })
      const actuateEmotion = vi.fn()
      const systemOneStore = useSystemOneStore()
      systemOneStore.activeProvider = 'laya-local'
      const executeSpy = vi.spyOn(systemOneStore, 'execute')

      const { evaluateSentenceStride } = useAutonomousCues({ activeCard: card, actuateEmotion })

      const record = await evaluateSentenceStride('~')
      expect(record.status).toBe('skipped-noise')
      expect(executeSpy).not.toHaveBeenCalled()
      expect(actuateEmotion).not.toHaveBeenCalled()
    })

    it('skips evaluation via markExplicitActSeen when an explicit ACT token was parsed earlier in the stream', async () => {
      const card = createMockCard({ autoCuesEnabled: true })
      const actuateEmotion = vi.fn()
      const systemOneStore = useSystemOneStore()
      systemOneStore.activeProvider = 'laya-local'
      const executeSpy = vi.spyOn(systemOneStore, 'execute')

      const { evaluateSentenceStride, markExplicitActSeen } = useAutonomousCues({ activeCard: card, actuateEmotion })

      // Signal that an explicit ACT marker was parsed on the special token stream
      markExplicitActSeen()

      // Sentence text itself has no marker (already parsed out)
      const record1 = await evaluateSentenceStride('This sentence had an ACT token right before it.')
      expect(record1.status).toBe('skipped-prefixed')
      expect(executeSpy).not.toHaveBeenCalled()
      expect(actuateEmotion).not.toHaveBeenCalled()

      // Subsequent sentence without an ACT marker is NOT skipped
      executeSpy.mockResolvedValueOnce({
        answers: {
          emotion: { choice: 'happy', confidence: 0.95 },
        },
      } as any)

      const record2 = await evaluateSentenceStride('This is an ordinary follow-up sentence.')
      expect(record2.status).toBe('fired')
      expect(executeSpy).toHaveBeenCalledTimes(1)
      expect(actuateEmotion).toHaveBeenCalledTimes(1)
    })

    it('reactively evaluates when activeCard is passed as a ref or getter', async () => {
      const cardRef = ref<Card | null>(null)
      const actuateEmotion = vi.fn()
      const systemOneStore = useSystemOneStore()
      systemOneStore.activeProvider = 'laya-local'

      const { evaluateSentenceStride } = useAutonomousCues({
        activeCard: () => cardRef.value,
        actuateEmotion,
      })

      // Initially null -> disabled
      const record1 = await evaluateSentenceStride('Hello there!')
      expect(record1.status).toBe('disabled')

      // Switch character card to one with autoCuesEnabled
      cardRef.value = createMockCard({ autoCuesEnabled: true })
      vi.spyOn(systemOneStore, 'execute').mockResolvedValueOnce({
        answers: {
          emotion: { choice: 'happy', confidence: 0.8 },
        },
      } as any)

      const record2 = await evaluateSentenceStride('Hello there!')
      expect(record2.status).toBe('fired')
      expect(actuateEmotion).toHaveBeenCalledTimes(1)
    })

    it('extracts dynamic emotional intensity score and clamps to [0.3, 1.0]', async () => {
      const card = createMockCard({ autoCuesEnabled: true })
      const actuateEmotion = vi.fn()
      const systemOneStore = useSystemOneStore()
      systemOneStore.activeProvider = 'laya-local'

      // Mock return with explicit score question answer
      vi.spyOn(systemOneStore, 'execute').mockResolvedValueOnce({
        answers: {
          emotion: { choice: 'happy', confidence: 0.95 },
          intensity: { score: 0.72 },
        },
      } as any)

      const { evaluateSentenceStride } = useAutonomousCues({ activeCard: card, actuateEmotion })

      const sentence = 'That is wonderful news!'
      const record = await evaluateSentenceStride(sentence)

      expect(record.status).toBe('fired')
      expect(record.intensity).toBe(0.72)
      expect(actuateEmotion).toHaveBeenCalledWith('F_Happy', expect.objectContaining({
        intensity: 0.72,
      }))
    })

    it('clamps out-of-range emotional intensity to [0.3, 1.0]', async () => {
      const card = createMockCard({ autoCuesEnabled: true })
      const actuateEmotion = vi.fn()
      const systemOneStore = useSystemOneStore()
      systemOneStore.activeProvider = 'laya-local'

      // Case 1: Overshoot (> 1.0)
      vi.spyOn(systemOneStore, 'execute').mockResolvedValueOnce({
        answers: {
          emotion: { choice: 'happy', confidence: 0.9 },
          intensity: { score: 1.8 },
        },
      } as any)

      const { evaluateSentenceStride } = useAutonomousCues({ activeCard: card, actuateEmotion })
      const recordHigh = await evaluateSentenceStride('Look at this incredible thing!')
      expect(recordHigh.intensity).toBe(1.0)

      // Case 2: Undershoot (< 0.3)
      vi.spyOn(systemOneStore, 'execute').mockResolvedValueOnce({
        answers: {
          emotion: { choice: 'happy', confidence: 0.8 },
          intensity: { score: 0.05 },
        },
      } as any)

      const recordLow = await evaluateSentenceStride('Look at this subtle thing.')
      expect(recordLow.intensity).toBe(0.3)
    })

    it('dynamically resolves per-actor model and capabilities via resolveActorModel in multi-character turns', async () => {
      const card = createMockCard({ autoCuesEnabled: true })
      const actuateEmotion = vi.fn()
      const systemOneStore = useSystemOneStore()
      systemOneStore.activeProvider = 'laya-local'

      const currentActorId = ref('actor_butter')
      const resolveActorModel = vi.fn((actorId?: string | null) => {
        if (actorId === 'actor_butter') {
          return {
            modelId: 'model-butter',
            expressionCapabilities: [{ rawKey: 'Butter_Happy', label: 'Butter Happy', usable: true }],
            motionCapabilities: [{ rawKey: 'Butter_TailWag', label: 'Butter TailWag', usable: true }],
          }
        }
        return {
          modelId: 'model-kommy',
          expressionCapabilities: [{ rawKey: 'Kommy_Serious', label: 'Kommy Serious', usable: true }],
          motionCapabilities: [{ rawKey: 'Kommy_Goggles', label: 'Kommy Goggles', usable: true }],
        }
      })

      vi.spyOn(systemOneStore, 'execute').mockResolvedValue({
        answers: {
          emotion: { choice: 'none', confidence: 0.9 },
        },
      } as any)

      const { evaluateSentenceStride } = useAutonomousCues({
        activeCard: card,
        currentActorId,
        autoMode: true,
        resolveActorModel,
        actuateEmotion,
      })

      // Turn 1: Butter
      await evaluateSentenceStride('I checked with my ears!')
      expect(resolveActorModel).toHaveBeenCalledWith('actor_butter')

      // Turn 2: Switch actor to Kommy
      currentActorId.value = 'actor_kommy'
      await evaluateSentenceStride('You want me to hit the box on purpose?')
      expect(resolveActorModel).toHaveBeenCalledWith('actor_kommy')
    })
  })

  describe('extractTokensFromPrompt reverse extractor', () => {
    const candidateTokens = [
      'anger_hash',
      'angry',
      'arrow_eyes',
      'cat_mouth',
      'crying',
      'gloomy',
      'heart',
      'heartbroken',
      'music',
      'question',
      'shocked_eyes',
      'sleepy',
      'small_x_eyes',
      'star_eyes',
      'surprised',
      'sweating',
      'smile',
      'blush',
      'pout',
      'wink',
      'shy',
    ]

    it('returns empty array when prompt is empty or candidates are empty', () => {
      expect(extractTokensFromPrompt('', candidateTokens)).toEqual([])
      expect(extractTokensFromPrompt('Some prompt text', [])).toEqual([])
    })

    it('extracts tokens formatted inside official <|ACT:emotion="..."|> markers', () => {
      const prompt = `Available expression cues: <|ACT:emotion="anger_hash"|>, <|ACT:emotion="angry"|>, <|ACT:emotion="smile"|>`
      const extracted = extractTokensFromPrompt(prompt, candidateTokens)
      expect(extracted).toEqual(['anger_hash', 'angry', 'smile'])
    })

    it('extracts tokens formatted as clean bullet points or lists', () => {
      const prompt = `
The available tokens are:
- anger_hash
- angry
- smile
- blush
- cat_mouth
`
      const extracted = extractTokensFromPrompt(prompt, candidateTokens)
      expect(extracted).toEqual(['anger_hash', 'angry', 'cat_mouth', 'smile', 'blush'])
    })

    it('extracts tokens wrapped in backticks, single quotes, double quotes, or brackets', () => {
      const prompt = `
Tokens:
- \`smile\` (happy)
- 'pout' (annoyed)
- "cat_mouth" (playful)
- [wink]
`
      const extracted = extractTokensFromPrompt(prompt, candidateTokens)
      expect(extracted).toEqual(['cat_mouth', 'smile', 'pout', 'wink'])
    })

    it('extracts comma-separated tokens in prose', () => {
      const prompt = `Inject physical emotion cues sparingly: anger_hash, angry, arrow_eyes, pout, and shy at emotional peaks.`
      const extracted = extractTokensFromPrompt(prompt, candidateTokens)
      expect(extracted).toEqual(['anger_hash', 'angry', 'arrow_eyes', 'pout', 'shy'])
    })

    it('rejects partial matches and substring false-positives', () => {
      const prompt = `
I caught a fishy smell in the air.
Her thoughts were scattered across the floor.
Please send me a facsimile of that document.
`
      // Candidate tokens include 'shy', 'cat', 'smile'
      const candidates = ['shy', 'cat', 'smile']
      const extracted = extractTokensFromPrompt(prompt, candidates)
      expect(extracted).toEqual([])
    })

    it('does not match token prefix when suffix is an alphanumeric/underscore word character', () => {
      const prompt = `Available token is only anger_hash.`
      // Candidate list contains both 'anger' and 'anger_hash'
      const candidates = ['anger', 'anger_hash']
      const extracted = extractTokensFromPrompt(prompt, candidates)
      // 'anger' must not match inside 'anger_hash'
      expect(extracted).toEqual(['anger_hash'])
    })

    it('matches case-insensitively while preserving candidate token casing', () => {
      const prompt = `Use SMILE and BLUSH when pleased.`
      const extracted = extractTokensFromPrompt(prompt, ['smile', 'blush', 'pout'])
      expect(extracted).toEqual(['smile', 'blush'])
    })

    it('deduplicates repeatedly mentioned tokens', () => {
      const prompt = `Use smile when happy. Example: "Hi! <|ACT:emotion="smile"|>". Remember to use smile.`
      const extracted = extractTokensFromPrompt(prompt, ['smile', 'blush'])
      expect(extracted).toEqual(['smile'])
    })
  })
})
