import { describe, expect, it } from 'vitest'

import { validateWorkerScriptForUpload } from './packager'

const VALID_WORKER = `
export class EmbassyDO {
  async fetch() { return new Response('ok') }
}
export default {
  async fetch() { return new Response('ok') }
}
`

describe('validateWorkerScriptForUpload', () => {
  it('rejects empty, missing, and whitespace-only bundles with build guidance', () => {
    for (const bad of ['', '   ', '\n\t ', null, undefined]) {
      const err = validateWorkerScriptForUpload(bad as unknown as string)
      expect(err).toContain('empty')
      expect(err).toContain('pnpm --filter @proj-airi/stage-edge build')
    }
  })

  it('accepts a bundle exporting the required DO class', () => {
    expect(validateWorkerScriptForUpload(VALID_WORKER, 'EmbassyDO')).toBeNull()
  })

  it('accepts any non-empty bundle when no DO class is required', () => {
    expect(validateWorkerScriptForUpload('export default { fetch() {} }')).toBeNull()
  })

  it('rejects a bundle missing the bound DO class before Cloudflare can 10061', () => {
    // ROOT CAUSE: esbuild/packager failures used to fall through to an empty
    // (or stub) script that still carried DO bindings — Cloudflare answered
    // 10061 on the user's screen with no hint at the real cause.
    const err = validateWorkerScriptForUpload('export default { fetch() {} }', 'EmbassyDO')
    expect(err).toContain('EmbassyDO')
    expect(err).toContain('rebuild')
  })
})
