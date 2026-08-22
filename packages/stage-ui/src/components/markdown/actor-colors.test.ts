import { describe, expect, it } from 'vitest'

import { postProcessActorColors } from './actor-colors'

describe('postProcessActorColors', () => {
  it('adds a chip and actor color when a slice starts an actor', () => {
    expect(postProcessActorColors('<p>Hello.</p>', {
      actorId: 'actor_one',
      startsActor: true,
    })).toBe('<p><span class="actor-chip actor-chip-actor_one">One</span><span class="actor-color-actor_one">Hello.</span></p>')
  })

  it('colors an actor continuation without adding a duplicate chip', () => {
    const rendered = postProcessActorColors('<p>Still speaking.</p>', {
      actorId: 'actor_one',
      startsActor: false,
    })

    expect(rendered).toBe('<p><span class="actor-color-actor_one">Still speaking.</span></p>')
    expect(rendered).not.toContain('actor-chip')
  })

  it('leaves zero-token markdown unchanged', () => {
    const html = '<p>Normal single-character response.</p>'

    expect(postProcessActorColors(html)).toBe(html)
    expect(postProcessActorColors(html, { startsActor: true })).toBe(html)
  })

  it('rejects invalid actor ids instead of emitting unsafe classes', () => {
    const html = '<p>Normal response.</p>'

    expect(postProcessActorColors(html, {
      actorId: 'actor"><script>',
      startsActor: true,
    })).toBe(html)
  })
})
