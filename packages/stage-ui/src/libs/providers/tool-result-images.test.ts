import { describe, expect, it } from 'vitest'

import { moveToolResultImagesToMessages } from './tool-result-images'

const image = { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,AAAA' } }

describe('moveToolResultImagesToMessages', () => {
  it('leaves messages without tool images untouched', () => {
    const messages = [
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: '', tool_calls: [{ id: 'a', function: { name: 'text_journal' } }] },
      { role: 'tool', tool_call_id: 'a', content: 'ok' },
    ]
    expect(moveToolResultImagesToMessages(messages)).toEqual(messages)
  })

  it('keeps tool text in place and attaches images after the tool messages', () => {
    const result = moveToolResultImagesToMessages([
      { role: 'assistant', content: '', tool_calls: [{ id: 'a', function: { name: 'take_screenshot' } }] },
      { role: 'tool', tool_call_id: 'a', content: [{ type: 'text', text: 'Screenshot taken' }, image] },
    ])

    expect(result).toHaveLength(3)
    expect(result[1]).toEqual({ role: 'tool', tool_call_id: 'a', content: 'Screenshot taken' })
    expect(result[2].role).toBe('user')
    expect(result[2].content[0].text).toContain('take_screenshot')
    expect(result[2].content[1]).toEqual(image)
  })

  it('waits for the whole run of tool messages before attaching images', () => {
    const result = moveToolResultImagesToMessages([
      { role: 'assistant', content: '', tool_calls: [{ id: 'a', function: { name: 'take_screenshot' } }, { id: 'b', function: { name: 'text_journal' } }] },
      { role: 'tool', tool_call_id: 'a', content: [{ type: 'text', text: 'shot' }, image] },
      { role: 'tool', tool_call_id: 'b', content: 'saved' },
      { role: 'assistant', content: 'done' },
    ])

    expect(result.map(m => m.role)).toEqual(['assistant', 'tool', 'tool', 'user', 'assistant'])
  })

  it('drops display-only images', () => {
    const result = moveToolResultImagesToMessages([
      { role: 'assistant', content: '', tool_calls: [{ id: 'a', function: { name: 'take_screenshot' } }] },
      { role: 'tool', tool_call_id: 'a', content: [{ type: 'text', text: 'description' }, { ...image, display_only: true }] },
    ])

    expect(result).toHaveLength(2)
    expect(result[1].content).toBe('description')
  })
})
