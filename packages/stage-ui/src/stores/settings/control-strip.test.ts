import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { CUSTOMIZER_CATALOG } from '../../constants/control-customizer'
import {
  DEFAULT_MOBILE_BUTTONS,
  useSettingsControlStrip,
} from './control-strip'

describe('control strip store: web chat toggle invariants', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('includes chat toggle in DEFAULT_MOBILE_BUTTONS', () => {
    const mobileChat = DEFAULT_MOBILE_BUTTONS.find(btn => btn.id === 'chat')
    expect(mobileChat).toBeDefined()
    expect(mobileChat?.enabled).toBe(true)
    expect(mobileChat?.icon).toBe('i-solar:chat-line-linear')
  })

  it('ensures chat is not restricted to desktopOnly in the customizer catalog', () => {
    const catalogChat = CUSTOMIZER_CATALOG
      .flatMap(group => group.items)
      .find(item => item.id === 'chat')
    expect(catalogChat).toBeDefined()
    expect(catalogChat?.desktopOnly).toBeFalsy()
  })

  it('flips chatOpen state when toggled', () => {
    const store = useSettingsControlStrip()
    const initial = store.chatOpen

    store.chatOpen = !initial
    expect(store.chatOpen).toBe(!initial)

    store.chatOpen = initial
    expect(store.chatOpen).toBe(initial)
  })
})
