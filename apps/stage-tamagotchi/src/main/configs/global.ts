import { array, boolean, number, object, optional, picklist, string } from 'valibot'

import { createConfig } from '../libs/electron/persistence'

export const globalAppConfigSchema = object({
  language: optional(string(), 'en'),
  microphoneToggleHotkey: optional(picklist(['Scroll', 'Caps', 'Num']), 'Scroll'),
  windows: optional(
    array(
      object({
        dock: optional(string()),
        enabled: optional(boolean()),
        height: optional(number()),
        locked: optional(boolean()),
        orientation: optional(picklist(['vertical', 'horizontal'])),
        snapshot: optional(
          object({
            height: number(),
            width: number(),
            x: number(),
            y: number(),
          }),
        ),
        tag: string(),
        title: optional(string()),
        width: optional(number()),
        x: optional(number()),
        y: optional(number()),
      }),
    ),
  ),
})

export function createGlobalAppConfig() {
  const config = createConfig('app', 'config.json', globalAppConfigSchema, {
    default: {
      language: 'en',
      microphoneToggleHotkey: 'Scroll',
      windows: [],
    },
  })
  config.setup()

  return config
}
