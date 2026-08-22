import type { ChatHistoryItem } from '../../types/chat'

function extractMessageContent(message: ChatHistoryItem) {
  if (typeof message.content === 'string')
    return message.content

  if (Array.isArray(message.content)) {
    return message.content.map((part) => {
      if (typeof part === 'string')
        return part
      if (part && typeof part === 'object' && 'text' in part)
        return String(part.text ?? '')
      return ''
    }).join('')
  }

  return ''
}

function getMessageFingerprint(message: ChatHistoryItem) {
  return [
    message.role,
    message.createdAt ?? '',
    extractMessageContent(message),
  ].join('\u001F')
}

export function mergeLoadedSessionMessages(storedMessages: ChatHistoryItem[], currentMessages: ChatHistoryItem[]) {
  if (currentMessages.length === 0)
    return storedMessages

  const storedIds = new Set(storedMessages.map(m => m.id).filter(Boolean))
  const storedFingerprints = new Set(storedMessages.map(getMessageFingerprint))

  const uniqueNewMessages = currentMessages.filter((message) => {
    if (message.id && storedIds.has(message.id))
      return false
    const fingerprint = getMessageFingerprint(message)
    if (storedFingerprints.has(fingerprint))
      return false

    // Jitter & ID-mismatch tolerance: if storedMessages already contains an entry with the same role and non-empty content
    // whose createdAt timestamp is within 2 seconds, treat it as the same message
    const content = extractMessageContent(message)
    if (content.trim()) {
      const msgTime = message.createdAt || 0
      const isDuplicateByContentAndTime = storedMessages.some((stored) => {
        if (stored.role !== message.role)
          return false
        const storedContent = extractMessageContent(stored)
        if (storedContent !== content)
          return false
        const storedTime = stored.createdAt || 0
        if (msgTime && storedTime && Math.abs(msgTime - storedTime) <= 2000)
          return true
        return false
      })
      if (isDuplicateByContentAndTime)
        return false
    }

    return true
  })

  if (uniqueNewMessages.length === 0)
    return storedMessages

  // If storedMessages already has a system message, avoid adding redundant ones from uniqueNewMessages
  // unless they are significantly different (e.g. environmental context).
  const hasStoredPersona = storedMessages.some(m => m.role === 'system' && !extractMessageContent(m).includes('[ENVIRONMENTAL AWARENESS]'))

  const finalNewMessages = uniqueNewMessages.filter((m) => {
    if (m.role === 'system') {
      const content = extractMessageContent(m)
      const isContext = content.includes('[ENVIRONMENTAL AWARENESS]') || content.includes('contextual information')
      if (!isContext && hasStoredPersona) {
        // Avoid duplicate persona blocks during merge
        return false
      }
    }
    return true
  })

  return [...storedMessages, ...finalNewMessages]
}
