import { array, boolean, number, object, optional, picklist, string } from 'valibot'

import { createConfig } from '../libs/electron/persistence'

export const globalAppConfigSchema = object({
  language: optional(string(), 'en'),
  windows: optional(array(object({
    title: optional(string()),
    tag: string(),
    x: optional(number()),
    y: optional(number()),
    width: optional(number()),
    height: optional(number()),
    enabled: optional(boolean()),
    dock: optional(string()),
    locked: optional(boolean()),
    orientation: optional(picklist(['vertical', 'horizontal'])),
    collapsed: optional(boolean()),
    backgroundColor: optional(string()),
    snapshot: optional(object({
      x: number(),
      y: number(),
      width: number(),
      height: number(),
    })),
  }))),
  microphoneToggleHotkey: optional(picklist(['Scroll', 'Caps', 'Num']), 'Scroll'),
  corsBypassUrls: optional(array(string())),
})

export function createGlobalAppConfig() {
  const config = createConfig('app', 'config.json', globalAppConfigSchema, {
    default: {
      language: 'en',
      windows: [],
      microphoneToggleHotkey: 'Scroll',
      corsBypassUrls: [
        'https://api.deepgram.com/*',
        'https://opencode.ai/*',
        'https://pioneer.ai/*',
        'https://integrate.api.nvidia.com/*',
        'https://text.pollinations.ai/*',
        'https://api.xiaomimimo.com/*',
        'http://localhost:11434/*',
        'http://127.0.0.1:11434/*',
        'http://localhost:1234/*',
        'http://127.0.0.1:1234/*',
      ],
    },
  })
  config.setup()

  return config
}
