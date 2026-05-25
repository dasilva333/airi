import { describe, expect, it } from 'vitest'

import { sanitizeMessages } from './llm'

describe('sanitizeMessages', () => {
  it('should flatten text-only content arrays for backward compatibility', () => {
    const messages = [
      {
        content: [
          { text: 'Hello', type: 'text' },
          { text: ' world', type: 'text' },
        ],
        role: 'user',
      },
    ]

    const sanitized = sanitizeMessages(messages)
    expect(sanitized[0].content).toBe('Hello world')
    expect(typeof sanitized[0].content).toBe('string')
  })

  it('should keep content arrays if image_url is present and vision is not explicitly disabled', () => {
    const messages = [
      {
        content: [
          { text: 'What is this?', type: 'text' },
          { image_url: { url: 'data:image/png;base64,...' }, type: 'image_url' },
        ],
        role: 'user',
      },
    ]

    const sanitized = sanitizeMessages(messages)
    expect(Array.isArray(sanitized[0].content)).toBe(true)
    expect((sanitized[0].content as any)[1].type).toBe('image_url')
  })

  it('should strip images and replace with placeholder when vision is disabled', () => {
    const messages = [
      {
        content: [
          { text: 'Look at this:', type: 'text' },
          { image_url: { url: 'data:image/png;base64,...' }, type: 'image_url' },
          { text: 'Nice, right?', type: 'text' },
        ],
        role: 'user',
      },
    ]

    const sanitized = sanitizeMessages(messages, { vision: false })
    expect(typeof sanitized[0].content).toBe('string')
    expect(sanitized[0].content).toBe('Look at this: [Image] Nice, right?')
  })

  it('should handle assistant messages with images when vision is disabled', () => {
    const messages = [
      {
        content: [
          { text: 'I see an image:', type: 'text' },
          { image_url: { url: '...' }, type: 'image_url' },
        ],
        role: 'assistant',
      },
    ]

    const sanitized = sanitizeMessages(messages, { vision: false })
    expect(sanitized[0].content).toBe('I see an image: [Image]')
  })

  it('should convert error roles to user messages', () => {
    const messages = [
      {
        content: 'Something went wrong',
        role: 'error',
      },
    ]

    const sanitized = sanitizeMessages(messages)
    expect(sanitized[0].role).toBe('user')
    expect(sanitized[0].content).toContain('User encountered error')
  })
})
