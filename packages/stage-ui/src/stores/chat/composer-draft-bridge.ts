import { nanoid } from 'nanoid'

export const CHAT_COMPOSER_DRAFT_CHANNEL = 'airi:chat-composer-draft'
export const CHAT_COMPOSER_DRAFT_STORAGE_KEY = 'airi-chatbox-draft'

const ACK_TIMEOUT_MS = 500

export type ChatComposerDraftMessage
  = | { type: 'append', id: string, text: string }
    | { type: 'ack', id: string }

export function appendDraftText(current: string, text: string): string {
  const addition = text.trim()
  if (!addition)
    return current
  const base = current.trimEnd()
  return base ? `${base} ${addition}` : addition
}

/**
 * Appends text to the desktop chat composer, which lives in another window. When no composer
 * acknowledges in time (chat window closed or another view open), the text is appended to the
 * persisted draft instead, which the composer restores when it mounts.
 */
export function sendTextToChatComposer(text: string): Promise<'composer' | 'draft'> {
  return new Promise((resolve) => {
    const channel = new BroadcastChannel(CHAT_COMPOSER_DRAFT_CHANNEL)
    const id = nanoid()

    const timeout = setTimeout(() => {
      const saved = localStorage.getItem(CHAT_COMPOSER_DRAFT_STORAGE_KEY) ?? ''
      localStorage.setItem(CHAT_COMPOSER_DRAFT_STORAGE_KEY, appendDraftText(saved, text))
      channel.close()
      resolve('draft')
    }, ACK_TIMEOUT_MS)

    channel.onmessage = (event: MessageEvent<ChatComposerDraftMessage>) => {
      if (event.data?.type !== 'ack' || event.data.id !== id)
        return
      clearTimeout(timeout)
      channel.close()
      resolve('composer')
    }

    channel.postMessage({ type: 'append', id, text } satisfies ChatComposerDraftMessage)
  })
}
