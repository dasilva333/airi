import type { TransportAdapter } from './transport'
import type { TransportRegistry } from './transport-registry'

import { describe, expectTypeOf, it } from 'vitest'

describe('transportRegistry', () => {
  it('exposes register / get / list / initialize', () => {
    expectTypeOf<TransportRegistry>().toHaveProperty('register')
    expectTypeOf<TransportRegistry>().toHaveProperty('get')
    expectTypeOf<TransportRegistry>().toHaveProperty('list')
    expectTypeOf<TransportRegistry>().toHaveProperty('initialize')

    expectTypeOf<TransportRegistry['register']>().toEqualTypeOf<(adapter: TransportAdapter) => void>()
    expectTypeOf<TransportRegistry['get']>().toEqualTypeOf<(id: string) => TransportAdapter | undefined>()
    // readonly snapshot: compile-time check (expectTypeOf struggles with readonly modifiers)
    type _ListReturnsReadonly = ReturnType<TransportRegistry['list']> extends readonly TransportAdapter[] ? true : false
    const _listReadonly: _ListReturnsReadonly = true
    void _listReadonly
    expectTypeOf<TransportRegistry['initialize']>().toEqualTypeOf<(id: string, sovereign: boolean) => Promise<void>>()
  })

  it('is implementable by a plain object (structural typing)', () => {
    const mock: TransportRegistry = {
      register: () => {},
      get: () => undefined,
      list: () => [],
      initialize: async () => {},
    }
    expectTypeOf(mock).toMatchTypeOf<TransportRegistry>()
  })
})
