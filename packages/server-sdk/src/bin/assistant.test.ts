import { describe, expect, it } from 'vitest'

import { parseArgs, parseStdinContext } from './assistant'

describe('assistant CLI Helper', () => {
  describe('parseArgs', () => {
    it('defaults to notify command and port 6121', () => {
      const parsed = parseArgs(['node', 'assistant.ts'])
      expect(parsed.command).toBe('notify')
      expect(parsed.options.port).toBe(6121)
      expect(parsed.options.source).toBe('custom')
    })

    it('parses flags correctly', () => {
      const parsed = parseArgs([
        'node',
        'assistant.ts',
        'notify',
        '--state',
        'wait',
        '--source',
        'claude-code',
        '--headline',
        'Approval needed',
        '--note',
        'Run command: npm test',
        '--tool',
        'run_command',
        '--port',
        '8080',
        '--token',
        'secret123',
      ])
      expect(parsed.command).toBe('notify')
      expect(parsed.options.state).toBe('wait')
      expect(parsed.options.source).toBe('claude-code')
      expect(parsed.options.headline).toBe('Approval needed')
      expect(parsed.options.note).toBe('Run command: npm test')
      expect(parsed.options.tool).toBe('run_command')
      expect(parsed.options.port).toBe(8080)
      expect(parsed.options.token).toBe('secret123')
    })

    it('parses install command and target', () => {
      const parsed = parseArgs(['node', 'assistant.ts', 'install', 'claude'])
      expect(parsed.command).toBe('install')
      expect(parsed.target).toBe('claude')
    })
  })

  describe('parseStdinContext', () => {
    it('parses direct state payload', () => {
      const raw = JSON.stringify({ state: 'work', headline: 'Working on task' })
      const parsed = parseStdinContext(raw)
      expect(parsed.state).toBe('work')
      expect(parsed.headline).toBe('Working on task')
    })

    it('parses Antigravity PreToolUse hook payload', () => {
      const raw = JSON.stringify({
        toolCall: {
          name: 'run_command',
          args: { CommandLine: 'npm test' },
        },
        stepIdx: 1,
      })
      const parsed = parseStdinContext(raw)
      expect(parsed.state).toBe('wait')
      expect(parsed.headline).toBe('Approval requested')
      expect(parsed.tool).toBe('run_command')
    })

    it('parses Antigravity error payload', () => {
      const raw = JSON.stringify({
        error: 'Exit code 1: compile failed',
      })
      const parsed = parseStdinContext(raw)
      expect(parsed.state).toBe('error')
      expect(parsed.headline).toBe('Tool failed')
      expect(parsed.note).toContain('Exit code 1')
    })

    it('parses Antigravity PreInvocation payload', () => {
      const raw = JSON.stringify({
        lastUserInput: 'Please fix the bug in server.ts',
      })
      const parsed = parseStdinContext(raw)
      expect(parsed.state).toBe('work')
      expect(parsed.headline).toBe('Thinking...')
      expect(parsed.note).toBe('Please fix the bug in server.ts')
    })

    it('parses Claude Code hook payload', () => {
      const raw = JSON.stringify({
        event: 'PreToolUse',
        toolName: 'Bash',
      })
      const parsed = parseStdinContext(raw)
      expect(parsed.state).toBe('wait')
      expect(parsed.headline).toBe('Approval needed')
      expect(parsed.tool).toBe('Bash')
    })

    it('returns empty object on empty or invalid input', () => {
      expect(parseStdinContext('')).toEqual({})
      expect(parseStdinContext('not json')).toEqual({})
    })
  })
})
