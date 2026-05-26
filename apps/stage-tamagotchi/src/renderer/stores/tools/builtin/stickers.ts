import { useStickersStore } from '@proj-airi/stage-ui/stores/stickers'
import type { Tool } from '@xsai/shared-chat'

/**
 * Tools for interacting with the sticker system.
 */
export function stickersTools(): Tool[] {
  return [
    {
      async execute({ stickerId, x, y, duration }: any) {
        const stickersStore = useStickersStore()
        const placement = stickersStore.spawnSticker(stickerId, { duration, x, y })

        if (placement && typeof placement === 'object') {
          const expirationInfo = duration ? ` for ${duration}s` : ''
          return `Successfully spawned sticker "${stickerId}"${expirationInfo} at (${Math.round((placement as any).x)}%, ${Math.round((placement as any).y)}%).`
        } else if (typeof placement === 'string') {
          // Store already provides a helpful message with available labels:
          // "Sticker label '...' not found... Available labels: ..."
          return placement
        } else {
          const available = stickersStore.currentLibrary.map((s) => s.label).join(', ')
          return `Sticker "${stickerId}" not found. Available stickers in your library: ${available || 'None (Upload some first!)'}`
        }
      },
      function: {
        description:
          'Spawns a sticker on the screen to express an emotion, reaction, or decoration. Use specific sticker IDs to choose the visual.',
        name: 'spawn_sticker',
        parameters: {
          properties: {
            duration: {
              description: 'Lifespan in seconds before the sticker fades out. Default is 60s.',
              type: 'integer',
            },
            stickerId: {
              description: 'The unique ID/label of the sticker to spawn.',
              type: 'string',
            },
            x: {
              description: 'Horizontal position (0-100 as percentage of screen width). Random if omitted.',
              type: 'number',
            },
            y: {
              description: 'Vertical position (0-100 as percentage of screen height). Random if omitted.',
              type: 'number',
            },
          },
          required: ['stickerId'],
          type: 'object',
        },
      },
      type: 'function',
    },
  ]
}
