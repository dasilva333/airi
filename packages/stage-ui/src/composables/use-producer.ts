import type { ChatProvider } from '@xsai-ext/providers/utils'

import type { ChatHistoryItem } from '../types/chat'

import { useLocalStorage } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'

import * as v from 'valibot'

import { useChatContextStore } from '../stores/chat/context-store'
import { useLLM } from '../stores/llm'
import { useAiriCardStore } from '../stores/modules/airi-card'
import { useConsciousnessStore } from '../stores/modules/consciousness'
import { useProactivityStore } from '../stores/proactivity'
import { useProvidersStore } from '../stores/providers'

const ChoiceSchema = v.object({
  title: v.string(),
  message: v.string(),
})

const ProducerResponseSchema = v.object({
  options: v.array(ChoiceSchema),
})

function sanitizeChatContent(text: string) {
  return text
    .replace(/<\|ACT:[^>]*\|>/g, ' ')
    .replace(/<\|[^>]+\|>/g, ' ')
    .replace(/\[[^\]]+\]/g, ' ')
    .replace(/\r/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractPartText(part: any): string {
  if (!part)
    return ''
  if (typeof part === 'string')
    return part
  if (typeof part.text === 'string')
    return part.text
  if (typeof part.input === 'string')
    return part.input
  if (typeof part.output === 'string')
    return part.output
  return ''
}

function extractMessageText(message: ChatHistoryItem): string {
  if (message.role === 'assistant' && Array.isArray((message as any).slices)) {
    const sliceText = (message as any).slices.filter((slice: any) => slice?.type === 'text' && typeof slice.text === 'string').map((slice: any) => slice.text).join(' ')

    if (sliceText.trim())
      return sanitizeChatContent(sliceText)
  }

  const content = (message as any).content
  if (typeof content === 'string')
    return sanitizeChatContent(content)

  if (Array.isArray(content)) {
    return sanitizeChatContent(content.map(extractPartText).join(' '))
  }

  return ''
}

export const DEFAULT_SYSTEM_PROMPT_TEMPLATE = `You are a dialogue writing assistant for an interactive roleplay. 
Your job is to suggest {count} things the USER could say next, written in the user's natural, personal voice, please ensure you follow their style of capitalization and punctuation and the way they say things including action brackets and asterisks to imitate the user as closely as possible.

The conversation so far involves the user chatting with {characterName}.
{guidance}

Rules:
- Each suggestion must sound like something the user would naturally say, not a formal prompt
{lengthRule}
- No meta-commentary, no "(OOC)" notes, no quotation marks around the message text
- Output exactly {count} options matching the requested voice style.`

function compilePrompt(
  template: string,
  options: {
    count: number
    characterName: string
    guidance?: string
    shortReplies: boolean
  },
) {
  const guidanceText = options.guidance
    ? `The user wants suggestions that feel like: "${options.guidance}"`
    : ''
  const lengthRuleText = options.shortReplies
    ? '- Keep each message under 2 sentences'
    : '- Match the user\'s typical response length and depth, generating detailed, paragraph-length options (multiple sentences and rich actions) rather than short dialogue snippets'

  return template
    .replace(/\{count\}/g, String(options.count))
    .replace(/\{characterName\}/g, options.characterName)
    .replace(/\{guidance\}/g, guidanceText)
    .replace(/\{lengthRule\}/g, lengthRuleText)
}

export function useProducer() {
  const llmStore = useLLM()
  const consciousnessStore = useConsciousnessStore()
  const providersStore = useProvidersStore()
  const { activeProvider, activeModel } = storeToRefs(consciousnessStore)

  const cacheAligned = useLocalStorage('airi:producer:cache-aligned', false)
  const airiCardStore = useAiriCardStore()
  const customPromptTemplate = useLocalStorage(
    computed(() => `airi:producer:system-prompt-template:${airiCardStore.activeCardId || 'global'}`),
    () => {
      const legacy = localStorage.getItem('airi:producer:system-prompt-template')
      return legacy || DEFAULT_SYSTEM_PROMPT_TEMPLATE
    },
  )

  const loading = ref(false)
  const error = ref<string | null>(null)

  async function generateSuggestions(options: {
    characterName: string
    messages: ChatHistoryItem[]
    guidance?: string
    contextDepth: number
    count: number
    shortReplies: boolean
  }) {
    loading.value = true
    error.value = null

    try {
      const providerId = activeProvider.value
      const modelId = activeModel.value

      if (!providerId || !modelId) {
        throw new Error('No active AI provider/model configured.')
      }

      const provider = await providersStore.getProviderInstance<ChatProvider>(providerId)
      if (!provider) {
        throw new Error(`Failed to resolve provider instance for "${providerId}".`)
      }

      const customTemplate = customPromptTemplate.value || DEFAULT_SYSTEM_PROMPT_TEMPLATE
      const compiledPrompt = compilePrompt(customTemplate, {
        count: options.count,
        characterName: options.characterName,
        guidance: options.guidance,
        shortReplies: options.shortReplies,
      })

      let inputMessages: any[] = []

      if (cacheAligned.value) {
        const chatContext = useChatContextStore()
        const proactivityStore = useProactivityStore()
        const cardStore = useAiriCardStore()

        const systemMsg = options.messages.find(m => m.role === 'system')
        const conversationMsgs = options.messages.filter(
          m => m.role === 'user' || m.role === 'assistant',
        )

        const formattedHistory = conversationMsgs.map((m) => {
          let messageContent: any = ''
          if (m.role === 'assistant') {
            messageContent = (m as any).rawContent || m.content
          }
          else {
            messageContent = m.content
          }

          if (Array.isArray(messageContent)) {
            messageContent = messageContent.map(extractPartText).join('')
          }

          return {
            role: m.role,
            content: messageContent as string,
          }
        })

        // Replicate the chat.ts context injections
        const contextsSnapshot = chatContext.getContextsSnapshot()
        const groundingEnabled = cardStore.activeCard?.extensions?.airi?.groundingEnabled
        const sensorPayload = groundingEnabled ? proactivityStore.sensorPayload : ''

        let contextContent = ''
        if (Object.keys(contextsSnapshot).length > 0) {
          contextContent += 'These are the contextual information retrieved or on-demand updated from other modules:\n'
            + `${Object.entries(contextsSnapshot).map(([key, value]) => `Module ${key}: ${JSON.stringify(value)}`).join('\n')}\n`
        }

        if (sensorPayload) {
          contextContent += `${contextContent ? '\n---\n' : ''
          }[ENVIRONMENTAL AWARENESS]\n`
          + `The following telemetry describes your current environmental context. `
          + `Use it to stay grounded in the user's reality and inform your response. `
          + `You may reference specific values (like time or active applications) if relevant `
          + `to the conversation, but avoid a dry, technical recitation of the data.\n`
          + `---\n`
          + `${sensorPayload}\n`
        }

        const systemMessages: any[] = []
        if (systemMsg) {
          let systemContent = systemMsg.content
          if (Array.isArray(systemContent)) {
            systemContent = systemContent.map(extractPartText).join('')
          }
          systemMessages.push({ role: 'system', content: systemContent })
        }

        if (contextContent.trim()) {
          systemMessages.push({ role: 'system', content: contextContent.trim() })
        }

        const instructionSuffix = `${compiledPrompt}\n\nYou must output the result strictly in this JSON schema format:\n{\n  "options": [\n    { "title": "Option Title/Emotion (e.g. Playful, Bold, Curious)", "message": "The suggested reply text" }\n  ]\n}`

        inputMessages = [
          ...systemMessages,
          ...formattedHistory,
          { role: 'user', content: instructionSuffix },
        ]
      }
      else {
        const relevantMessages = options.messages
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .slice(-options.contextDepth)

        const chatHistoryText = relevantMessages
          .map((m) => {
            const speaker = m.role === 'user' ? 'User' : options.characterName
            const content = extractMessageText(m)
            return `${speaker}: ${content}`
          })
          .join('\n')

        const userPrompt = `Here is the conversation history so far:\n${chatHistoryText}\n\nGenerate ${options.count} options for what the User could say next.`

        inputMessages = [
          { role: 'system', content: compiledPrompt },
          { role: 'user', content: userPrompt },
        ]
      }

      const res = await llmStore.generateObject<{ options: Array<{ title: string, message: string }> }>(
        modelId,
        provider,
        {
          messages: inputMessages,
          schema: ProducerResponseSchema,
          normalize: (parsed: any) => {
            function decodeEscapes(str: string): string {
              try {
                // If it contains double-escaped backslashes or unicode codes, parse it out.
                // Doing JSON.parse(JSON.stringify(str)) or similar doesn't decode,
                // but JSON.parse('"' + str + '"') will process unicode/newline escape sequences.
                // We must escape quotes and newlines first to prevent invalid JSON strings.
                const sanitized = str
                  .replace(/\\/g, '\\\\')
                  .replace(/"/g, '\\"')
                  .replace(/\n/g, '\\n')
                  .replace(/\r/g, '\\r')
                  .replace(/\t/g, '\\t')

                // Now replace double-escaped ones that the LLM literally outputted as text like "\\n" or "\\u2014"
                // so JSON.parse can translate them to their actual characters.
                // We convert literal raw sequences:
                // \\uXXXX -> \uXXXX
                // \\n -> \n
                // \\r -> \r
                // \\t -> \t
                // \\" -> \"
                const rawProcessed = sanitized
                  .replace(/\\\\u([0-9a-fA-F]{4})/g, '\\u$1')
                  .replace(/\\\\n/g, '\\n')
                  .replace(/\\\\r/g, '\\r')
                  .replace(/\\\\t/g, '\\t')
                  .replace(/\\\\"/g, '\\"')
                  .replace(/\\\\'/g, '\'')
                  .replace(/\\\\\\\//g, '/')

                return JSON.parse(`"${rawProcessed}"`)
              }
              catch (e) {
                // Fallback: simple replacements if JSON.parse fails
                return str
                  .replace(/\\n/g, '\n')
                  .replace(/\\r/g, '\r')
                  .replace(/\\t/g, '\t')
                  .replace(/\\u2014/g, '\u2014')
              }
            }

            if (parsed && Array.isArray(parsed.options)) {
              parsed.options = parsed.options.map((opt: any) => ({
                title: decodeEscapes(String(opt.title || 'Option')),
                message: decodeEscapes(String(opt.message || '')),
              }))
            }
            return parsed
          },
        },
      )

      if (!res?.options || res.options.length === 0) {
        throw new Error('No suggestions generated.')
      }

      return res.options
    }
    catch (err: any) {
      error.value = err.message || 'Failed to generate suggestions'
      console.error('[useProducer] Error generating suggestions:', err)
      throw err
    }
    finally {
      loading.value = false
    }
  }

  return {
    generateSuggestions,
    loading,
    error,
  }
}
