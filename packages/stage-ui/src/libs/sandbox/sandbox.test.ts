import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createBashTool, executeBashCommand } from '../../stores/modules/tools/bash'
import { ansiToHtml, stripAnsi } from './ansi'
import { SandboxManager } from './manager'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (k: string) => k,
    d: (d: any) => d,
  }),
}))

describe('sandbox subsystem & in-memory posix execution', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('sandboxManager core', () => {
    it('initializes in-memory workspace and executes basic commands', async () => {
      const sandbox = new SandboxManager()
      await sandbox.init()

      const res = await sandbox.exec('echo "hello airi"')
      expect(res.exitCode).toBe(0)
      expect(res.stdout.trim()).toBe('hello airi')
      expect(res.stderr).toBe('')
    })

    it('writes and reads files within virtual RAM disk', async () => {
      const sandbox = new SandboxManager()
      await sandbox.init()

      await sandbox.writeFile('/workspace/sample.txt', 'posix in-memory')
      const content = await sandbox.readFile('/workspace/sample.txt')
      expect(content).toBe('posix in-memory')

      const catRes = await sandbox.exec('cat /workspace/sample.txt')
      expect(catRes.stdout.trim()).toBe('posix in-memory')
    })

    it('preserves permissions on sed -i execution', async () => {
      const sandbox = new SandboxManager()
      await sandbox.init()

      await sandbox.writeFile('/workspace/config.txt', 'port=8080')
      await (sandbox as any).bash.fs.chmod('/workspace/config.txt', 0o755)

      const statBefore = await (sandbox as any).bash.fs.stat('/workspace/config.txt')
      expect(statBefore.mode).toBe(0o755)

      await sandbox.exec('sed -i "s/8080/9090/" /workspace/config.txt')
      const updatedContent = await sandbox.readFile('/workspace/config.txt')
      expect(updatedContent.trim()).toBe('port=9090')

      const statAfter = await (sandbox as any).bash.fs.stat('/workspace/config.txt')
      expect(statAfter.mode).toBe(0o755)
    })

    it('executes in-memory node command with eval and version', async () => {
      const sandbox = new SandboxManager()
      await sandbox.init()

      const versionRes = await sandbox.exec('node -v')
      expect(versionRes.stdout.trim()).toBe('v22.14.0')

      const evalRes = await sandbox.exec('node -e "console.log(20 + 22)"')
      expect(evalRes.stdout.trim()).toBe('42')

      await sandbox.writeFile('/workspace/run.js', 'console.log("script executed");')
      const fileRes = await sandbox.exec('node /workspace/run.js')
      expect(fileRes.stdout.trim()).toBe('script executed')
    })

    it('handles mount_widget command and fires mount listener', async () => {
      const sandbox = new SandboxManager()
      await sandbox.init()

      await sandbox.writeFile('/workspace/widget.js', 'export default { render() { return "widget"; } }')

      let mountedWidgetCaptured: any = null
      sandbox.onMount((w) => {
        mountedWidgetCaptured = w
      })

      const mountRes = await sandbox.exec('mount_widget /workspace/widget.js')
      expect(mountRes.exitCode).toBe(0)
      expect(mountRes.stdout).toContain('[GEN_UI_MOUNT:/workspace/widget.js]')

      expect(mountedWidgetCaptured).not.toBeNull()
      expect(mountedWidgetCaptured.path).toBe('/workspace/widget.js')
      expect(mountedWidgetCaptured.code).toContain('render()')
    })

    it('auto-compiles .ts files on mount_widget and unmounts properly', async () => {
      const sandbox = new SandboxManager()
      await sandbox.init()

      await sandbox.writeFile('/workspace/counter.ts', `
        export default function mount(ctx: any) {
          ctx.innerHTML = '<div>Count: 1</div>'
        }
      `)

      const mountRes = await sandbox.exec('mount_widget /workspace/counter.ts --title "Counter Gauge" --target sidepanel')
      expect(mountRes.exitCode).toBe(0)
      expect(mountRes.stdout).toContain('Mounted Counter Gauge (/workspace/counter.js) to sidepanel')
      expect(sandbox.mountedWidgets.length).toBe(1)
      expect(sandbox.mountedWidgets[0].title).toBe('Counter Gauge')
      expect(sandbox.mountedWidgets[0].target).toBe('sidepanel')

      const unmountRes = await sandbox.exec('unmount_widget /workspace/counter.js')
      expect(unmountRes.exitCode).toBe(0)
      expect(sandbox.mountedWidgets.length).toBe(0)
    })
  })

  describe('level 1 vfs state projections', () => {
    it('projects session.json, cognition.json, telemetry.json, messages.json into /workspace/.airi/', async () => {
      const sandbox = new SandboxManager()
      await sandbox.init()

      const sessionExists = await (sandbox as any).bash.fs.exists('/workspace/.airi/session.json')
      const telemetryExists = await (sandbox as any).bash.fs.exists('/workspace/.airi/telemetry.json')
      const cognitionExists = await (sandbox as any).bash.fs.exists('/workspace/.airi/cognition.json')
      const messagesExists = await (sandbox as any).bash.fs.exists('/workspace/.airi/messages.json')

      expect(sessionExists).toBe(true)
      expect(telemetryExists).toBe(true)
      expect(cognitionExists).toBe(true)
      expect(messagesExists).toBe(true)
    })

    it('allows querying state projections via jq in bash pipeline', async () => {
      const sandbox = new SandboxManager()
      await sandbox.init()

      // Query session.json characterName with jq
      const resName = await sandbox.exec('cat /workspace/.airi/session.json | jq -r .characterName')
      expect(resName.exitCode).toBe(0)
      expect(resName.stdout.trim()).toBe('Airi')

      // Query telemetry.json localTime with jq
      const resTelemetry = await sandbox.exec('cat /workspace/.airi/telemetry.json | jq -r .activeProgram')
      expect(resTelemetry.exitCode).toBe(0)
      expect(resTelemetry.stdout.trim()).toBeDefined()
    })
  })

  describe('ansi formatting helpers', () => {
    it('strips ansi codes from text', () => {
      const colored = '\x1B[31mError:\x1B[0m something went wrong'
      expect(stripAnsi(colored)).toBe('Error: something went wrong')
    })

    it('converts ansi codes to colored html spans', () => {
      const colored = '\x1B[32mSuccess\x1B[0m'
      const html = ansiToHtml(colored)
      expect(html).toContain('<span class="text-green-400 font-semibold">Success</span>')
    })
  })

  describe('bash tool registration', () => {
    it('creates bash tool with expected name and description', async () => {
      const toolDef = await createBashTool()
      const toolName = (toolDef as any).name || (toolDef as any).function?.name
      const toolDesc = (toolDef as any).description || (toolDef as any).function?.description
      expect(toolName).toBe('bash')
      expect(toolDesc).toContain('/workspace')
    })

    it('executes bash tool commands through executeBashCommand', async () => {
      const out = await executeBashCommand({ command: 'echo "test tool execution"' })
      expect(out.trim()).toBe('test tool execution')
    })
  })

  describe('in-memory node runtime virtual fs and imports', () => {
    it('reads /workspace/.airi/telemetry.json synchronously via require("fs")', async () => {
      const sandbox = new SandboxManager()
      await sandbox.init()

      const res = await sandbox.exec(`node -e '
        const fs = require("fs");
        const raw = fs.readFileSync("/workspace/.airi/telemetry.json", "utf-8");
        const t = JSON.parse(raw);
        console.log("activeProgram=" + t.activeProgram);
      '`)
      expect(res.exitCode).toBe(0)
      expect(res.stdout).toContain('activeProgram=')
      expect(res.stderr).toBe('')
    })

    it('executes scripts with static and dynamic ESM imports and top-level await', async () => {
      const sandbox = new SandboxManager()
      await sandbox.init()

      await sandbox.writeFile('/workspace/esm_test.js', `
        import * as fs from "fs";
        import { existsSync } from "node:fs";
        import path from "node:path";
        const dynFs = await import("fs");

        const exists = existsSync("/workspace/.airi/session.json");
        const resolved = path.resolve("/workspace", "test.txt");
        console.log("exists=" + exists + " resolved=" + resolved);
      `)

      const res = await sandbox.exec('node /workspace/esm_test.js')
      expect(res.exitCode).toBe(0)
      expect(res.stdout.trim()).toBe('exists=true resolved=/workspace/test.txt')
      expect(res.stderr).toBe('')
    })

    it('supports fs.writeFileSync to write into virtual RAM disk', async () => {
      const sandbox = new SandboxManager()
      await sandbox.init()

      const res = await sandbox.exec(`node -e '
        const fs = require("fs");
        fs.writeFileSync("/workspace/written_by_node.txt", "node RAM content");
        console.log(fs.readFileSync("/workspace/written_by_node.txt"));
      '`)
      expect(res.exitCode).toBe(0)
      expect(res.stdout.trim()).toBe('node RAM content')

      // Verify POSIX cat can read it too
      const catRes = await sandbox.exec('cat /workspace/written_by_node.txt')
      expect(catRes.stdout.trim()).toBe('node RAM content')
    })

    it('passes script arguments into process.argv', async () => {
      const sandbox = new SandboxManager()
      await sandbox.init()

      await sandbox.writeFile('/workspace/args.js', `
        console.log(process.argv.slice(2).join(","));
      `)

      const res = await sandbox.exec('node /workspace/args.js alpha beta gamma')
      expect(res.exitCode).toBe(0)
      expect(res.stdout.trim()).toBe('alpha,beta,gamma')
    })

    it('handles process.exit(code) without throwing unhandled exceptions', async () => {
      const sandbox = new SandboxManager()
      await sandbox.init()

      const res0 = await sandbox.exec('node -e "process.exit(0)"')
      expect(res0.exitCode).toBe(0)

      const res42 = await sandbox.exec('node -e "process.exit(42)"')
      expect(res42.exitCode).toBe(42)
    })
  })
})
