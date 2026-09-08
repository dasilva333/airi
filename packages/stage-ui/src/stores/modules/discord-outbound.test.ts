import { describe, expect, it } from 'vitest'

import {
  formatDiscordInboundMessage,
  formatDiscordOutboundReply,
  formatDiscordSteerInterruption,
} from './discord-outbound'

describe('discord outbound & inbound formatting contracts', () => {
  describe('formatDiscordOutboundReply', () => {
    it('returns null when all content sources are empty or missing', () => {
      expect(formatDiscordOutboundReply({})).toBeNull()
      expect(formatDiscordOutboundReply({ rawContent: '', content: '' }, '')).toBeNull()
    })

    it('formats technical error notification when error is present', () => {
      const fromString = formatDiscordOutboundReply({ error: 'Gateway timeout' })
      expect(fromString).toEqual({
        content: '⚠️ **AIRI encountered a technical problem.**\n*(Error: Gateway timeout)*',
        isError: true,
      })

      const fromErrorObj = formatDiscordOutboundReply({ error: new Error('Rate limit reached (429)') })
      expect(fromErrorObj).toEqual({
        content: '⚠️ **AIRI encountered a technical problem.**\n*(Error: Rate limit reached (429))*',
        isError: true,
      })

      const fromEmptyError = formatDiscordOutboundReply({ error: {} })
      expect(fromEmptyError?.content).toContain('*(Error: Unknown Error)*')
    })

    it('converts actor tokens to bold bracketed format with actor_ prefix stripped', () => {
      const reply = formatDiscordOutboundReply({
        content: '<|ACTOR:actor_oshino_shinobu|> Yay, peace peace!',
      })
      expect(reply?.content).toBe('**[oshino_shinobu]**: Yay, peace peace!')
      expect(reply?.isError).toBe(false)
    })

    it('converts actress tokens to bold bracketed format with actress_ prefix stripped', () => {
      const reply = formatDiscordOutboundReply({
        content: '<|ACTOR:actress_senjougahara|> What are you looking at?',
      })
      expect(reply?.content).toBe('**[senjougahara]**: What are you looking at?')
    })

    it('converts plain actor tokens without actor_/actress_ prefix', () => {
      const reply = formatDiscordOutboundReply({
        content: '<|ACTOR:companion_bot|> Systems online.',
      })
      expect(reply?.content).toBe('**[companion_bot]**: Systems online.')
    })

    it('converts legacy actor tokens closed with plain > instead of |>', () => {
      const reply = formatDiscordOutboundReply({
        content: '<|ACTOR:actor_tsukihi> Platinum mad!',
      })
      expect(reply?.content).toBe('**[tsukihi]**: Platinum mad!')
    })

    it('strips avatar action markers from outbound content', () => {
      const reply = formatDiscordOutboundReply({
        content: '<|ACT:smile|> Nice to meet you! <|DELAY:500|> Let us begin. <|ACT:{"animation":"wave"}|>',
      })
      expect(reply?.content).toBe('Nice to meet you!  Let us begin.')
      expect(reply?.content).not.toContain('<|ACT:')
      expect(reply?.content).not.toContain('<|DELAY:')
    })

    it('formats text_journal create tool calls', () => {
      const reply = formatDiscordOutboundReply({
        content: 'I wrote something down in my journal.',
        slices: [
          {
            type: 'tool-call',
            toolCall: {
              function: {
                name: 'text_journal',
                arguments: JSON.stringify({
                  action: 'create',
                  title: 'A Stroll in the Park',
                  content: 'The cherry blossoms were in full bloom today.',
                }),
              },
            },
          },
        ],
      })

      expect(reply?.content).toContain('I wrote something down in my journal.')
      expect(reply?.content).toContain('### New Journal Entry: A Stroll in the Park')
      expect(reply?.content).toContain('> The cherry blossoms were in full bloom today.')
    })

    it('formats text_journal search tool calls with query and limit', () => {
      const reply = formatDiscordOutboundReply({
        content: 'Looking through my memories...',
        slices: [
          {
            type: 'tool-call',
            toolCall: {
              function: {
                name: 'text_journal',
                arguments: JSON.stringify({
                  action: 'search',
                  query: 'stargazing at midnight',
                  limit: 5,
                }),
              },
            },
          },
        ],
      })

      expect(reply?.content).toContain('Looking through my memories...')
      expect(reply?.content).toContain('🔍 Searching Journal: "stargazing at midnight" (limit: 5)')
    })

    it('formats image_journal create tool calls with title and mode metadata', () => {
      const reply = formatDiscordOutboundReply({
        content: 'I generated a new concept art for you.',
        slices: [
          {
            type: 'tool-call',
            toolCall: {
              function: {
                name: 'image_journal',
                arguments: JSON.stringify({
                  action: 'create',
                  prompt: 'cyberpunk neon alleyway in the rain',
                  title: 'Neo Tokyo Night',
                  mode: 'portrait',
                }),
              },
            },
          },
        ],
      })

      expect(reply?.content).toContain('🎨 Generating Image: "cyberpunk neon alleyway in the rain" (title: "Neo Tokyo Night") (mode: "portrait")')
    })

    it('formats image_journal apply background tool calls', () => {
      const reply = formatDiscordOutboundReply({
        content: 'Setting the mood for us.',
        slices: [
          {
            type: 'tool-call',
            toolCall: {
              function: {
                name: 'image_journal',
                arguments: JSON.stringify({
                  action: 'apply',
                  query: 'cozy fireplace in winter',
                }),
              },
            },
          },
        ],
      })

      expect(reply?.content).toContain('🖼️ Applying Background: "cozy fireplace in winter"')
    })

    it('formats generic tool calls and recovers from malformed argument JSON', () => {
      const reply = formatDiscordOutboundReply({
        content: 'Checking external data...',
        slices: [
          {
            type: 'tool-call',
            toolCall: {
              function: {
                name: 'calculator',
                arguments: JSON.stringify({ expression: '42 * 10' }),
              },
            },
          },
          {
            type: 'tool-call',
            toolCall: {
              function: {
                name: 'broken_tool',
                arguments: '{ unquoted_broken }',
              },
            },
          },
        ],
      })

      expect(reply?.content).toContain('🔧 `calculator` | `{"expression":"42 * 10"}`')
      expect(reply?.content).toContain('🔧 `broken_tool` | `{ unquoted_broken }`')
    })

    it('chains multiple multi-actor dialogue turns and tool slices seamlessly', () => {
      const reply = formatDiscordOutboundReply({
        rawContent: '<|ACTOR:actor_araragi|> Did you see that? <|ACTOR:actress_shinobu|> Indeed I did, half-vampire. <|ACT:giggle|>',
        slices: [
          {
            type: 'tool-call',
            toolCall: {
              function: {
                name: 'text_journal',
                arguments: JSON.stringify({ action: 'search', query: 'vampire sightings' }),
              },
            },
          },
        ],
      })

      expect(reply?.content).toContain('**[araragi]**: Did you see that?')
      expect(reply?.content).toContain('**[shinobu]**: Indeed I did, half-vampire.')
      expect(reply?.content).not.toContain('<|ACT:giggle|>')
      expect(reply?.content).toContain('🔍 Searching Journal: "vampire sightings" (limit: 3)')
    })
  })

  describe('formatDiscordInboundMessage', () => {
    it('formats inbound message with display name and content', () => {
      const formatted = formatDiscordInboundMessage('Kyo', 'Can you review the server logs?')
      expect(formatted).toBe('Kyo says:\nCan you review the server logs?')
    })
  })

  describe('formatDiscordSteerInterruption', () => {
    it('formats interruption continuation when partialText is non-empty', () => {
      const formatted = formatDiscordSteerInterruption(
        'I was about to suggest we',
        'Kyo',
        'Never mind, we fixed it!',
      )
      expect(formatted).toBe('You were saying: "I was about to suggest we", but then Kyo interrupted with:\nNever mind, we fixed it!')
    })

    it('falls back to standard inbound framing when partialText is empty', () => {
      const formatted = formatDiscordSteerInterruption('', 'Kyo', 'Quick question')
      expect(formatted).toBe('Kyo says:\nQuick question')
    })
  })
})
