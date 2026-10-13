interface ContentPart {
  type?: string
  text?: string
  image_url?: { url: string }
  /** Shown in the chat UI only; never sent to the model. */
  display_only?: boolean
}

/**
 * OpenAI-compatible chat APIs only accept text in `role: "tool"` messages. Tool results that
 * carry images keep their text in the tool message, and the images are re-attached in a
 * labelled message right after the run of tool messages, so the model sees them within the
 * same reply without mistaking them for something the user sent.
 */
export function moveToolResultImagesToMessages(messages: any[]): any[] {
  const toolNames = new Map<string, string>()
  const output: any[] = []
  let pending: { names: string[], images: ContentPart[] } | undefined

  const flushPending = () => {
    if (!pending)
      return
    output.push({
      role: 'user',
      content: [
        { type: 'text', text: `[Automatic output of the ${pending.names.join(', ')} tool call. Attached by the app, not written by the user.]` },
        ...pending.images.map(part => ({ type: 'image_url', image_url: part.image_url })),
      ],
    })
    pending = undefined
  }

  for (const message of messages) {
    if (message?.role !== 'tool')
      flushPending()

    if (message?.role === 'assistant' && Array.isArray(message.tool_calls)) {
      for (const call of message.tool_calls)
        toolNames.set(call?.id, call?.function?.name ?? 'tool')
    }

    if (message?.role !== 'tool' || !Array.isArray(message.content)) {
      output.push(message)
      continue
    }

    const parts = message.content as ContentPart[]
    const text = parts.filter(part => part?.type === 'text').map(part => part.text ?? '').join('\n')
    const images = parts.filter(part => part?.type === 'image_url' && part.image_url?.url && !part.display_only)

    output.push({ ...message, content: text })

    if (images.length > 0) {
      pending ??= { names: [], images: [] }
      pending.names.push(toolNames.get(message.tool_call_id) ?? 'tool')
      pending.images.push(...images)
    }
  }

  flushPending()
  return output
}

type FetchLike = (input: any, init?: any) => Promise<Response>

export function withToolResultImageSupport(baseFetch?: (input: any, init: any) => Promise<Response>): FetchLike {
  return async (input, init) => {
    const body = init?.body
    if (typeof body === 'string' && body.includes('"role":"tool"') && body.includes('image_url')) {
      try {
        const parsed = JSON.parse(body)
        if (Array.isArray(parsed.messages)) {
          parsed.messages = moveToolResultImagesToMessages(parsed.messages)
          init = { ...init, body: JSON.stringify(parsed) }
        }
      }
      catch {}
    }

    return (baseFetch ?? globalThis.fetch)(input, init)
  }
}
