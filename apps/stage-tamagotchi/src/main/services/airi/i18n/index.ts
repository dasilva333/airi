import type { LocaleDetector } from '@intlify/core'
import { defineInvokeHandler } from '@moeru/eventa'
import type { createContext } from '@moeru/eventa/adapters/electron/main'
import type { BrowserWindow } from 'electron'
import type { ProvidedBy } from 'injeca'
import { injeca } from 'injeca'
import { i18nGetLocale, i18nSetLocale } from '../../../../shared/eventa'
import type { globalAppConfigSchema } from '../../../configs/global'
import type { Config } from '../../../libs/electron/persistence'
import type { I18n } from '../../../libs/i18n'

export async function createI18nService(params: {
  context: ReturnType<typeof createContext>['context']
  window: BrowserWindow
  i18n: I18n
}) {
  const { config } = await injeca.resolve({ config: 'configs:app' } as {
    config: ProvidedBy<Config<typeof globalAppConfigSchema>>
  })
  params.i18n.locale(config.get()?.language || 'en')

  defineInvokeHandler(params.context, i18nSetLocale, (locale) => {
    const current = config.get()
    const currentConfig = current
      ? { ...current }
      : { language: 'en', microphoneToggleHotkey: 'Scroll' as const, windows: [] }

    config.update({
      ...currentConfig,
      language: locale,
      microphoneToggleHotkey: currentConfig.microphoneToggleHotkey || 'Scroll',
    })
    params.i18n.locale(locale)
  })

  defineInvokeHandler(params.context, i18nGetLocale, () => {
    const locale = params.i18n.locale as () => string | LocaleDetector<any[]> | undefined
    return locale()
  })
}
