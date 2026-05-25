import { ChatMessageHandler } from '../libs/mineflayer/message'
import type { MineflayerPlugin } from '../libs/mineflayer/plugin'
import { useLogger } from '../utils/logger'

export function Echo(): MineflayerPlugin {
  const logger = useLogger()

  return {
    spawned(mineflayer) {
      const onChatHandler = new ChatMessageHandler(mineflayer.username).handleChat((username, message) => {
        logger.withFields({ message, username }).log('Chat message received')
        mineflayer.bot.chat(message)
      })

      this.beforeCleanup = () => {
        mineflayer.bot.removeListener('chat', onChatHandler)
      }

      mineflayer.bot.on('chat', onChatHandler)
    },
  }
}
