import { describe, expect, it } from 'vitest'

import { formatChatError } from './error-formatter'

describe('formatChatError pure error presentation seam', () => {
  it('formats standard Error instance with model and provider context', () => {
    const error = new Error('Connection timed out after 30s')
    const result = formatChatError(error, { model: 'claude-3-5-sonnet', provider: 'anthropic' })

    expect(result.message).toBe('Connection timed out after 30s')
    expect(result.isAuthError).toBe(false)
    expect(result.markdown).toContain('**Configured Model**: `claude-3-5-sonnet` *(Provider: `anthropic`)*')
    expect(result.markdown).toContain('**Error**: Connection timed out after 30s')
    expect(result.markdown).toContain('Brain Picker')
    expect(result.markdown).not.toContain('verify your API key in **Settings > Providers**')
  })

  it('uses default fallback labels when model or provider context is missing', () => {
    const error = new Error('Generic failure')
    const result = formatChatError(error)

    expect(result.markdown).toContain('**Configured Model**: `Default` *(Provider: `Default`)*')
  })

  it('handles primitive thrown values (string, number, null)', () => {
    const strResult = formatChatError('Network crashed')
    expect(strResult.message).toBe('Network crashed')
    expect(strResult.markdown).toContain('**Error**: Network crashed')

    const numResult = formatChatError(503)
    expect(numResult.message).toBe('503')

    const nullResult = formatChatError(null)
    expect(nullResult.message).toBe('null')
  })

  it('detects auth errors (401, 403, unauthorized, api key) and includes provider settings guidance', () => {
    const err401 = new Error('Request failed with status 401: Unauthorized')
    const res401 = formatChatError(err401)
    expect(res401.isAuthError).toBe(true)
    expect(res401.markdown).toContain('verify your API key in **Settings > Providers**')

    const errApiKey = new Error('Missing or invalid API key provided')
    const resApiKey = formatChatError(errApiKey)
    expect(resApiKey.isAuthError).toBe(true)
    expect(resApiKey.markdown).toContain('verify your API key in **Settings > Providers**')
  })

  it('extracts technical details from response, data, body, or cause', () => {
    const errWithResponse: any = new Error('API request rejected')
    errWithResponse.response = { status: 400, details: 'Invalid temperature parameter' }

    const result = formatChatError(errWithResponse)
    expect(result.technicalDetail).toContain('"status": 400')
    expect(result.technicalDetail).toContain('Invalid temperature parameter')
    expect(result.markdown).toContain('<details>\n<summary>🔍 Technical Details</summary>')
    expect(result.markdown).toContain('```json\n{\n  "status": 400,')
  })

  it('extracts and parses embedded JSON from error message (common in 429s)', () => {
    const errWithEmbeddedJson = new Error('Rate limit exceeded: {"error":{"code":"rate_limit_exceeded","retry_after":15}} please wait.')
    const result = formatChatError(errWithEmbeddedJson)

    expect(result.technicalDetail).toContain('"code": "rate_limit_exceeded"')
    expect(result.technicalDetail).toContain('"retry_after": 15')
    expect(result.message).toBe('Rate limit exceeded:  please wait.')
  })
})
