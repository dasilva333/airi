import type { ActiveAssistantSession, CodeAssistantStatePayload } from './code-assistant'

import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import {

  createDefaultCharacterReactionConfig,
  resolveCaptionText,
  resolveEffectiveState,
  useCodeAssistantStore,
} from './code-assistant'

// Mock external dependencies
vi.mock('@proj-airi/stage-ui-live2d', () => ({
  useLive2d: vi.fn(() => ({
    triggerEmotion: vi.fn(),
    triggerMotion: vi.fn(),
  })),
}))

vi.mock('@proj-airi/stage-ui-three', () => ({
  useModelStore: vi.fn(() => ({
    triggerEmotion: vi.fn(),
    triggerMotion: vi.fn(),
  })),
}))

vi.mock('@proj-airi/stage-ui-mmd', () => ({
  useMmd: vi.fn(() => ({
    previewExpression: null,
    playOneShotAction: vi.fn(),
  })),
}))

vi.mock('@proj-airi/stage-ui-spine', () => ({
  useSpine: vi.fn(() => ({
    selectVariantAndSkin: vi.fn(),
    playOneShotAnimation: vi.fn(),
  })),
}))

const mockAppendEvent = vi.fn()
vi.mock('../event-log', () => ({
  useEventLogStore: vi.fn(() => ({
    appendEvent: mockAppendEvent,
  })),
}))

const mockActiveCardId = ref('char-relu')
const mockActiveCard = ref<any>({ id: 'char-relu', name: 'ReLU' })

vi.mock('./airi-card', () => ({
  useAiriCardStore: vi.fn(() => ({
    get activeCardId() { return mockActiveCardId.value },
    get activeCard() { return mockActiveCard.value },
  })),
}))

vi.mock('../settings', () => ({
  useSettings: vi.fn(() => ({
    stageModelRenderer: 'live2d',
  })),
}))

vi.mock('../display-models', () => ({
  useDisplayModelsStore: vi.fn(() => ({
    getOrLoadModelCapabilities: vi.fn(async () => ({
      expressionCapabilities: [
        { rawKey: 'Focused', label: 'Focused', usable: true },
        { rawKey: 'Curious', label: 'Curious', usable: true },
        { rawKey: 'Happy', label: 'Happy', usable: true },
      ],
      motionCapabilities: [
        { rawKey: 'Typing', label: 'Typing', usable: true },
        { rawKey: 'Raise hand', label: 'Raise hand', usable: true },
        { rawKey: 'Celebrate', label: 'Celebrate', usable: true },
      ],
    })),
  })),
}))

const mockPostCaption = vi.fn()
vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  return {
    ...actual,
    useBroadcastChannel: vi.fn(() => ({
      post: mockPostCaption,
      data: ref(null),
    })),
  }
})

describe('code Assistant Subsystem', () => {
  beforeEach(() => {
    try {
      localStorage.clear()
    }
    catch {}
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockActiveCardId.value = 'char-relu'
    mockActiveCard.value = { id: 'char-relu', name: 'ReLU' }

    const store = useCodeAssistantStore()
    store.enabled = true
    store.characterConfigs = {}
    store.activeSessions = []
    store.effectiveState = 'idle'
  })

  describe('resolveCaptionText', () => {
    it('formats template variables correctly', () => {
      const template = '{headline}: {note} (tool: {tool})'
      const payload: Partial<CodeAssistantStatePayload> = {
        headline: 'Approval needed',
        note: 'Run test suite?',
        tool: 'npm test',
      }
      expect(resolveCaptionText(template, payload)).toBe('Approval needed: Run test suite? (tool: npm test)')
    })

    it('handles missing variables gracefully', () => {
      const template = 'Working on {headline} {note}'
      const payload: Partial<CodeAssistantStatePayload> = {
        headline: 'refactoring',
      }
      expect(resolveCaptionText(template, payload)).toBe('Working on refactoring')
    })

    it('returns empty string on empty template', () => {
      expect(resolveCaptionText('', { headline: 'anything' })).toBe('')
    })
  })

  describe('createDefaultCharacterReactionConfig', () => {
    it('provides valid reaction mappings for all 5 canonical states', () => {
      const config = createDefaultCharacterReactionConfig()
      expect(config.enabled).toBe(true)
      expect(config.reactions.work.expression).toBe('Focused')
      expect(config.reactions.work.motion).toBe('Typing')
      expect(config.reactions.wait.expression).toBe('Curious')
      expect(config.reactions.wait.motion).toBe('Raise hand')
      expect(config.reactions.done.expression).toBe('Happy')
      expect(config.reactions.done.motion).toBe('Celebrate')
      expect(config.reactions.idle.expression).toBe('Neutral')
      expect(config.reactions.error.expression).toBe('Concerned')
    })
  })

  describe('resolveEffectiveState', () => {
    const now = 100000
    const timeoutMs = 90000

    it('returns idle when there are no active sessions', () => {
      const result = resolveEffectiveState([], timeoutMs, now)
      expect(result.effectiveState).toBe('idle')
    })

    it('filters out timed-out sessions', () => {
      const sessions: ActiveAssistantSession[] = [
        {
          sessionId: 'old-session',
          state: 'work',
          assistant: 'claude',
          lastUpdated: now - 95000, // expired (>90s)
          payload: { state: 'work' },
        },
      ]
      const result = resolveEffectiveState(sessions, timeoutMs, now)
      expect(result.effectiveState).toBe('idle')
    })

    it('prioritizes error over all other states', () => {
      const sessions: ActiveAssistantSession[] = [
        { sessionId: 's1', state: 'work', assistant: 'claude', lastUpdated: now, payload: { state: 'work' } },
        { sessionId: 's2', state: 'wait', assistant: 'gemini', lastUpdated: now, payload: { state: 'wait' } },
        { sessionId: 's3', state: 'error', assistant: 'antigravity', lastUpdated: now, payload: { state: 'error' } },
      ]
      const result = resolveEffectiveState(sessions, timeoutMs, now)
      expect(result.effectiveState).toBe('error')
      expect(result.dominantSession?.sessionId).toBe('s3')
    })

    it('prioritizes wait over work and done', () => {
      const sessions: ActiveAssistantSession[] = [
        { sessionId: 's1', state: 'work', assistant: 'claude', lastUpdated: now, payload: { state: 'work' } },
        { sessionId: 's2', state: 'wait', assistant: 'gemini', lastUpdated: now, payload: { state: 'wait' } },
        { sessionId: 's3', state: 'done', assistant: 'antigravity', lastUpdated: now, payload: { state: 'done' } },
      ]
      const result = resolveEffectiveState(sessions, timeoutMs, now)
      expect(result.effectiveState).toBe('wait')
      expect(result.dominantSession?.sessionId).toBe('s2')
    })

    it('prioritizes work over done', () => {
      const sessions: ActiveAssistantSession[] = [
        { sessionId: 's1', state: 'work', assistant: 'claude', lastUpdated: now, payload: { state: 'work' } },
        { sessionId: 's2', state: 'done', assistant: 'gemini', lastUpdated: now, payload: { state: 'done' } },
      ]
      const result = resolveEffectiveState(sessions, timeoutMs, now)
      expect(result.effectiveState).toBe('work')
      expect(result.dominantSession?.sessionId).toBe('s1')
    })

    it('resolves done when all active sessions are complete', () => {
      const sessions: ActiveAssistantSession[] = [
        { sessionId: 's1', state: 'done', assistant: 'claude', lastUpdated: now, payload: { state: 'done' } },
      ]
      const result = resolveEffectiveState(sessions, timeoutMs, now)
      expect(result.effectiveState).toBe('done')
    })
  })

  describe('useCodeAssistantStore', () => {
    it('computes status badge correctly', () => {
      const store = useCodeAssistantStore()

      // 1. Initial state with no config
      expect(store.statusInfo.badge).toBe('setup_needed')
      expect(store.statusInfo.text).toContain('Setup needed · ReLU has no reactions configured')

      // 2. Setup character config
      store.getOrInitCharacterConfig('char-relu')
      expect(store.statusInfo.badge).toBe('ready')
      expect(store.statusInfo.text).toContain('Ready · ReLU is responding to assistant events')

      // 3. Paused / disabled
      store.enabled = false
      expect(store.statusInfo.badge).toBe('paused')
      expect(store.statusInfo.text).toBe('Paused · Notifications are disabled')
    })

    it('respects master switch killswitch', () => {
      const store = useCodeAssistantStore()
      store.getOrInitCharacterConfig('char-relu')
      store.enabled = false

      const result = store.handleAssistantState({
        state: 'work',
        assistant: 'claude',
        headline: 'Building code',
      })

      expect(result.handled).toBe(false)
      expect(result.reason).toBe('disabled')
      expect(mockAppendEvent).not.toHaveBeenCalled()
      expect(mockPostCaption).not.toHaveBeenCalled()
    })

    it('silently ignores unconfigured active character', () => {
      const store = useCodeAssistantStore()
      // No characterConfigs initialized for char-relu

      const result = store.handleAssistantState({
        state: 'work',
        assistant: 'claude',
        headline: 'Building code',
      })

      expect(result.handled).toBe(false)
      expect(result.reason).toBe('character_unconfigured')
      expect(mockAppendEvent).not.toHaveBeenCalled()
    })

    it('handles incoming state and triggers actuation and Event Ledger', () => {
      const store = useCodeAssistantStore()
      store.getOrInitCharacterConfig('char-relu')

      const result = store.handleAssistantState({
        state: 'wait',
        assistant: 'gemini',
        headline: 'Permission requested',
        note: 'Allow shell command?',
      })

      expect(result.handled).toBe(true)
      expect(result.effectiveState).toBe('wait')
      expect(store.effectiveState).toBe('wait')

      // Verifies Event Ledger was recorded
      expect(mockAppendEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'tools',
          type: 'code-assistant:wait',
          source: 'gemini',
          textSummary: expect.stringContaining('Permission requested: Allow shell command?'),
        }),
      )

      // Verifies Caption broadcast
      expect(mockPostCaption).toHaveBeenCalledWith({
        type: 'caption-speaker',
        text: 'GEMINI ASSISTANT',
      })
      expect(mockPostCaption).toHaveBeenCalledWith({
        type: 'caption-assistant',
        segments: expect.arrayContaining([
          expect.objectContaining({
            text: 'Permission requested: Allow shell command?',
            isActive: true,
          }),
        ]),
      })
    })

    it('supports character config copying and reset', () => {
      const store = useCodeAssistantStore()
      store.getOrInitCharacterConfig('char-relu')

      // Customize relu
      store.updateCharacterConfig('char-relu', {
        reactions: {
          ...store.getOrInitCharacterConfig('char-relu').reactions,
          work: {
            expression: 'CustomWorkExp',
            motion: 'CustomWorkMot',
            sound: 'Chime',
            captionEnabled: true,
            captionTemplate: 'Work: {headline}',
          },
        },
      })

      // Copy to amber
      store.copyCharacterConfig('char-relu', 'char-amber')
      expect(store.characterConfigs['char-amber'].reactions.work.expression).toBe('CustomWorkExp')

      // Reset relu
      store.resetCharacterConfig('char-relu')
      expect(store.characterConfigs['char-relu'].reactions.work.expression).toBe('Focused')
    })

    it('runs testReaction in preview isolation without writing to Event Ledger', () => {
      const store = useCodeAssistantStore()
      store.getOrInitCharacterConfig('char-relu')

      store.testReaction('char-relu', 'wait')

      // Caption is emitted for live auditioning on stage
      expect(mockPostCaption).toHaveBeenCalled()
      // But Event Ledger is NEVER touched during preview
      expect(mockAppendEvent).not.toHaveBeenCalled()
      // Nor are real active sessions altered
      expect(store.activeSessions).toHaveLength(0)
    })
  })
})
