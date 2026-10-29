// @vitest-environment jsdom
import { Alert as UiAlert } from '@proj-airi/ui'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp, h, nextTick } from 'vue'

import StageUiAlert from './alert.vue'

describe('alert component contract & backwards compatibility (#3221, #3224, #3232)', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    container.remove()
  })

  it('renders with modern semantic tone="danger" and opaque gradient base', async () => {
    const app = createApp({
      render() {
        return h(UiAlert, { tone: 'danger', title: 'Fatal error occurred' }, {
          default: () => 'Something went wrong',
        })
      },
    })
    app.mount(container)
    await nextTick()

    const alertEl = container.querySelector('[data-tone="danger"]')
    expect(alertEl).not.toBeNull()
    expect(alertEl?.className).toContain('bg-white dark:bg-neutral-900 bg-gradient-to-r')
    expect(alertEl?.textContent).toContain('Fatal error occurred')
    expect(alertEl?.textContent).toContain('Something went wrong')

    app.unmount()
  })

  it('maps legacy type="error" to tone="danger" for backwards compatibility', async () => {
    const app = createApp({
      render() {
        return h(UiAlert, { type: 'error', title: 'Connection Failed' })
      },
    })
    app.mount(container)
    await nextTick()

    const alertEl = container.querySelector('[data-tone="danger"]')
    expect(alertEl).not.toBeNull()
    expect(alertEl?.textContent).toContain('Connection Failed')

    app.unmount()
  })

  it('maps legacy type="warning", type="success", and type="info"', async () => {
    const app = createApp({
      render() {
        return h('div', [
          h(UiAlert, { type: 'warning', title: 'Warn Title' }),
          h(UiAlert, { type: 'success', title: 'Success Title' }),
          h(UiAlert, { type: 'info', title: 'Info Title' }),
        ])
      },
    })
    app.mount(container)
    await nextTick()

    expect(container.querySelector('[data-tone="warning"]')).not.toBeNull()
    expect(container.querySelector('[data-tone="success"]')).not.toBeNull()
    expect(container.querySelector('[data-tone="info"]')).not.toBeNull()

    app.unmount()
  })

  it('renders legacy #content slot alongside #title slot', async () => {
    const app = createApp({
      render() {
        return h(UiAlert, { type: 'error' }, {
          title: () => h('span', { class: 'custom-title' }, 'Validation Failure'),
          content: () => h('div', { class: 'custom-content' }, 'API key is invalid'),
        })
      },
    })
    app.mount(container)
    await nextTick()

    expect(container.querySelector('.custom-title')?.textContent).toBe('Validation Failure')
    expect(container.querySelector('.custom-content')?.textContent).toBe('API key is invalid')

    app.unmount()
  })

  it('emits dismiss event when dismiss button is clicked', async () => {
    let dismissed = false
    const app = createApp({
      render() {
        return h(UiAlert, {
          dismissible: true,
          title: 'Dismissible Alert',
          onDismiss: () => {
            dismissed = true
          },
        })
      },
    })
    app.mount(container)
    await nextTick()

    const dismissBtn = container.querySelector('button[aria-label="Dismiss"]') as HTMLButtonElement | null
    expect(dismissBtn).not.toBeNull()
    dismissBtn?.click()
    await nextTick()

    expect(dismissed).toBe(true)

    app.unmount()
  })

  it('stage-ui alert.vue wrapper delegates props and slots cleanly to @proj-airi/ui Alert', async () => {
    const app = createApp({
      render() {
        return h(StageUiAlert, { type: 'warning' }, {
          title: () => 'Wrapper Title',
          content: () => 'Wrapper Content via Legacy Slot',
        })
      },
    })
    app.mount(container)
    await nextTick()

    const alertEl = container.querySelector('[data-tone="warning"]')
    expect(alertEl).not.toBeNull()
    expect(alertEl?.textContent).toContain('Wrapper Title')
    expect(alertEl?.textContent).toContain('Wrapper Content via Legacy Slot')

    app.unmount()
  })
})
