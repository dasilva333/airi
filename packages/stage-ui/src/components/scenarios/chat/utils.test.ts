import type { ChatAssistantMessage } from '../../../types/chat'

import { describe, expect, it } from 'vitest'

import { formatToolCallSummary, getChatHistoryItemCopyText } from './utils'

describe('getChatHistoryItemCopyText', () => {
  it('copies actor-aware text slices as clean prose with no orchestration markers', () => {
    const message: ChatAssistantMessage = {
      role: 'assistant',
      content: 'Hi, how are you? I am great, thanks.',
      rawContent: '<|ACTOR:actor_one|>Hi, how are you?<|ACTOR:actor_two|>I am great, thanks.',
      slices: [
        { type: 'text', text: 'Hi, how are you?', actorId: 'actor_one', startsActor: true },
        {
          type: 'tool-call',
          toolCall: {
            args: '{}',
            toolCallId: 'tool-1',
            toolCallType: 'function',
            toolName: 'text_journal',
          },
        },
        { type: 'text', text: 'I am great, thanks.', actorId: 'actor_two', startsActor: true },
      ],
      tool_results: [],
    }

    const copied = getChatHistoryItemCopyText(message)

    expect(copied).toBe('Hi, how are you?\n\nI am great, thanks.')
    expect(copied).not.toContain('<|')
  })
})

describe('formatToolCallSummary', () => {
  describe('bash and mcp_bash', () => {
    it('formats single-line shell commands with $ prefix', () => {
      expect(formatToolCallSummary('bash', JSON.stringify({ command: 'ls -la /workspace' }))).toBe('$ ls -la /workspace')
      expect(formatToolCallSummary('mcp_bash', JSON.stringify({ command: 'cat /workspace/notes.txt' }))).toBe('$ cat /workspace/notes.txt')
    })

    it('handles multiline commands flattening whitespace and truncates', () => {
      const multiline = JSON.stringify({ command: 'node -e \'\nconst fs = require("fs");\nconsole.log(123);\n\'' })
      expect(formatToolCallSummary('bash', multiline)).toBe('$ node -e \'const fs = require("fs");...')
    })

    it('falls back to $ bash when command is empty', () => {
      expect(formatToolCallSummary('bash', '{}')).toBe('$ bash')
    })
  })

  describe('text_journal', () => {
    it('formats create action with natural language created statement', () => {
      expect(formatToolCallSummary('text_journal', JSON.stringify({
        action: 'create',
        title: 'Haven Cafe Daily Log',
        content: 'Today we served coffee...',
      }))).toBe('📓 Created Haven Cafe Daily Log')
    })

    it('formats search action with natural language searched statement', () => {
      expect(formatToolCallSummary('text_journal', JSON.stringify({
        action: 'search',
        query: 'coffee blend',
      }))).toBe('🔍 Searched for coffee blend')
    })
  })

  describe('image_journal', () => {
    it('formats image creation with mode and title', () => {
      expect(formatToolCallSummary('image_journal', JSON.stringify({
        action: 'create',
        mode: 'inline',
        title: 'Strawberry Latte Art',
      }))).toBe('🎨 Created new inline image called Strawberry Latte Art')

      expect(formatToolCallSummary('image_journal', JSON.stringify({
        action: 'create',
        mode: 'bg',
        title: 'Rainy Afternoon Cafe',
      }))).toBe('🎨 Created new bg image called Rainy Afternoon Cafe')

      expect(formatToolCallSummary('image_journal', JSON.stringify({
        action: 'create',
        mode: 'widget',
        title: 'Arona Portrait',
      }))).toBe('🎨 Created new widget image called Arona Portrait')
    })
  })

  describe('mcp suite', () => {
    it('formats mcp_list_tools as discovery summary', () => {
      expect(formatToolCallSummary('mcp_list_tools', '{}')).toBe('🛠️ Discovered MCP tools')
    })

    it('formats mcp_call_tool routing bash forgiveness to shell prompt', () => {
      expect(formatToolCallSummary('mcp_call_tool', JSON.stringify({
        name: 'sandbox::bash',
        parameters: { command: 'cat /workspace/haven.ts' },
      }))).toBe('$ cat /workspace/haven.ts')
    })

    it('formats mcp_call_tool for search and filesystem citing the tool without server prefix', () => {
      expect(formatToolCallSummary('mcp_call_tool', JSON.stringify({
        name: 'websearch::search',
        parameters: { query: 'blue archive arona halo' },
      }))).toBe('🔍 Searched for blue archive arona halo')

      expect(formatToolCallSummary('mcp_call_tool', JSON.stringify({
        name: 'filesystem::read_file',
        parameters: { path: '/workspace/notes.txt' },
      }))).toBe('📄 Read /workspace/notes.txt')
    })

    it('formats generic mcp tool citing the tool name and argument', () => {
      expect(formatToolCallSummary('mcp_call_tool', JSON.stringify({
        name: 'weather::get_weather',
        parameters: { city: 'Tokyo' },
      }))).toBe('🛠️ get_weather: Tokyo')
    })
  })

  describe('mount_widget and fallbacks', () => {
    it('formats mount_widget with title', () => {
      expect(formatToolCallSummary('mount_widget', JSON.stringify({
        title: 'Haven Dialogue 🌸',
        path: '/workspace/haven.ts',
      }))).toBe('🧩 Mounted Haven Dialogue 🌸')
    })

    it('formats take_screenshot with and without a window title', () => {
      expect(formatToolCallSummary('take_screenshot', JSON.stringify({
        window: 'Edge',
        focus: 'the chat',
      }))).toBe('📸 Took a screenshot of Edge')
      expect(formatToolCallSummary('take_screenshot', JSON.stringify({ display: '2' }))).toBe('📸 Took a screenshot of display 2')
      expect(formatToolCallSummary('take_screenshot', '{}')).toBe('📸 Took a screenshot')
    })

    it('falls back to raw tool name for unknown tools', () => {
      expect(formatToolCallSummary('custom_unknown_tool', '{}')).toBe('custom_unknown_tool')
    })
  })
})
