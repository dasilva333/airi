import type { ChatHistoryItem } from '../../../types/chat'

import { stripMarkers } from '../../../composables/response-categoriser'

function isTextPart(part: unknown): part is { type: 'text', text?: string } {
  return typeof part === 'object'
    && part !== null
    && 'type' in part
    && part.type === 'text'
    && 'text' in part
}

function getTextFromContentParts(parts: unknown[]): string {
  return parts.reduce<string[]>((texts, part) => {
    if (!isTextPart(part))
      return texts

    const text = part.text?.trim()
    if (text)
      texts.push(text)

    return texts
  }, []).join('\n\n')
}

export function getChatHistoryItemCopyText(message: ChatHistoryItem): string {
  if (message.role === 'error')
    return message.content

  if (message.role === 'assistant') {
    if (message.slices?.length) {
      const text = message.slices
        .filter(slice => slice.type === 'text')
        .map(slice => slice.text.trim())
        .filter(Boolean)
        .join('\n\n')

      if (text)
        return text
    }

    if (typeof message.content === 'string')
      return stripMarkers(message.content)

    if (Array.isArray(message.content)) {
      const text = getTextFromContentParts(message.content)

      if (text)
        return text

      return message.content.map(entry => JSON.stringify(entry)).join('\n')
    }

    return ''
  }

  if (typeof message.content === 'string')
    return message.content

  if (Array.isArray(message.content)) {
    const text = getTextFromContentParts(message.content)

    if (text)
      return text

    return message.content.map(entry => JSON.stringify(entry)).join('\n')
  }

  return ''
}

export function getChatHistoryItemKey(message: ChatHistoryItem | undefined, index: number): string | number {
  if (!message)
    return index

  if (message.id)
    return message.id

  if (message.createdAt != null)
    return `${message.role}:${message.createdAt}:${index}`

  return `${message.role}:${index}`
}

export function formatToolCallSummary(toolName: string, argsInput: string | Record<string, any> | null | undefined): string {
  let parsed: any = null
  if (typeof argsInput === 'string') {
    try {
      parsed = JSON.parse(argsInput)
    }
    catch {
      parsed = null
    }
  }
  else if (argsInput && typeof argsInput === 'object') {
    parsed = argsInput
  }

  // 1. Bash / MCP Bash
  if (toolName === 'bash' || toolName === 'mcp_bash') {
    const rawCmd = (parsed?.command || parsed?.cmd || (typeof argsInput === 'string' && !argsInput.startsWith('{') ? argsInput : '') || '').trim()
    if (!rawCmd)
      return '$ bash'
    const normalized = rawCmd.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').replace(/'\s+/, '\'').trim()
    const truncated = normalized.length > 34 ? `${normalized.slice(0, 34)}...` : normalized
    return `$ ${truncated}`
  }

  // 2. Text Journal
  if (toolName === 'text_journal') {
    const action = parsed?.action
    if (action === 'create') {
      const title = parsed?.title?.trim()
        || parsed?.content?.trim()?.slice(0, 24)
        || 'journal entry'
      return `📓 Created ${title}`
    }
    if (action === 'search') {
      const query = parsed?.query?.trim() || ''
      return `🔍 Searched for ${query}`
    }
    return `📓 text_journal`
  }

  // 3. Image Journal
  if (toolName === 'image_journal') {
    const mode = parsed?.mode || 'inline'
    const title = parsed?.title?.trim()
      || parsed?.prompt?.trim()?.slice(0, 24)
      || 'image'
    return `🎨 Created new ${mode} image called ${title}`
  }

  // 4. MCP Suite
  if (toolName === 'mcp_list_tools') {
    return `🛠️ Discovered MCP tools`
  }

  if (toolName === 'mcp_call_tool') {
    const qualifiedName = parsed?.name || ''
    const toolOnly = qualifiedName.includes('::') ? qualifiedName.split('::')[1] : qualifiedName
    const params = parsed?.parameters || parsed?.arguments || {}

    // Forgiveness: sandbox::bash called via MCP
    if (toolOnly === 'bash' || qualifiedName === 'sandbox::bash') {
      const rawCmd = (params.command || params.cmd || '').trim()
      if (!rawCmd)
        return '$ bash'
      const normalized = rawCmd.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').replace(/'\s+/, '\'').trim()
      const truncated = normalized.length > 34 ? `${normalized.slice(0, 34)}...` : normalized
      return `$ ${truncated}`
    }

    // Web search
    if (toolOnly === 'search' || toolOnly.includes('search')) {
      const query = params.query || params.q || ''
      return `🔍 Searched for ${query}`
    }

    // Filesystem read / write
    if (toolOnly === 'read_file' || toolOnly === 'read') {
      const path = params.path || params.file || ''
      return `📄 Read ${path}`
    }

    if (toolOnly === 'write_file' || toolOnly === 'write') {
      const path = params.path || params.file || ''
      return `✏️ Wrote ${path}`
    }

    if (!toolOnly)
      return `🛠️ mcp_call_tool`

    // Cite tool name and first string param if available
    const firstVal = Object.values(params).find(v => typeof v === 'string' && (v as string).trim().length > 0) as string | undefined
    if (firstVal) {
      const truncatedVal = firstVal.length > 20 ? `${firstVal.slice(0, 20)}...` : firstVal
      return `🛠️ ${toolOnly}: ${truncatedVal}`
    }

    return `🛠️ ${toolOnly}`
  }

  // 5. Mount Widget
  if (toolName === 'mount_widget') {
    const title = parsed?.title || parsed?.path || 'widget'
    return `🧩 Mounted ${title}`
  }

  return toolName
}
