import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { widgetsRepo } from '../../database/repos/widgets.repo'
import { useChatSessionStore } from '../../stores/chat/session-store'
import { clearMcpToolBridge, setMcpToolBridge } from '../../stores/mcp-tool-bridge'
import { useAiriCardStore } from '../../stores/modules/airi-card'
import { useNan0Store } from '../../stores/modules/nan0'
import { createBashTool, executeBashCommand } from '../../stores/modules/tools/bash'
import { ansiToHtml, stripAnsi } from './ansi'
import { SandboxManager } from './manager'
import { buildWidgetIframeSrcdoc } from './srcdoc'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (k: string) => k,
    d: (d: any) => d,
  }),
}))

describe('sandbox subsystem & in-memory posix execution', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    await widgetsRepo.clearMounted()
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
      expect(mountRes.stdout).toContain('Widget "Counter Gauge" mounted in right side panel of the chatbox (if closed, open the widgets panel to view).')
      expect(sandbox.mountedWidgets.length).toBe(1)
      expect(sandbox.mountedWidgets[0].title).toBe('Counter Gauge')
      expect(sandbox.mountedWidgets[0].surface).toBe('panel')
      expect(sandbox.mountedWidgets[0].target).toBe('sidepanel')

      const unmountRes = await sandbox.exec('unmount_widget /workspace/counter.js')
      expect(unmountRes.exitCode).toBe(0)
      expect(sandbox.mountedWidgets.length).toBe(0)
    })

    it('transpiles complex TypeScript with interfaces, generics, primitives and non-null assertions', async () => {
      const sandbox = new SandboxManager()
      await sandbox.init()

      await sandbox.writeFile('/workspace/pos.ts', `
        interface MenuItem {
          id: string;
          price: number;
          badge?: string;
        }
        const items: MenuItem[] = [{ id: 'coffee', price: 3.5 }];
        export default function mount({ container, sidecar, onUpdate }: any) {
          const cart: Record<string, number> = {};
          let receiptData: string | null = null;
          const found = items.find(i => i.id === 'coffee')!;
          container.innerHTML = '<div>' + found.price + '</div>';
        }
      `)

      const mountRes = await sandbox.exec('mount_widget /workspace/pos.ts --title "Cafe POS"')
      expect(mountRes.exitCode).toBe(0)
      expect(sandbox.mountedWidgets[0].code).not.toContain(': string')
      expect(sandbox.mountedWidgets[0].code).not.toContain(': number')
      expect(sandbox.mountedWidgets[0].code).not.toContain('Record<string, number>')
      expect(sandbox.mountedWidgets[0].code).not.toContain('interface MenuItem')
      expect(sandbox.mountedWidgets[0].code).toContain('container.innerHTML')
    })

    it('supports --surface widget and --surface panel with explicit reminder messages', async () => {
      const sandbox = new SandboxManager()
      await sandbox.init()

      await sandbox.writeFile('/workspace/stock.js', 'export default function() {}')

      // 1. Mount with --surface widget
      const widgetRes = await sandbox.exec('mount_widget /workspace/stock.js --title "Market Ticker" --surface widget')
      expect(widgetRes.exitCode).toBe(0)
      expect(widgetRes.stdout).toContain('Widget "Market Ticker" mounted in new standalone widget window on the desktop.')
      expect(sandbox.mountedWidgets.length).toBe(1)
      expect(sandbox.mountedWidgets[0].surface).toBe('widget')
      expect(sandbox.mountedWidgets[0].target).toBe('window')

      // 2. Remount with --surface panel
      const panelRes = await sandbox.exec('mount_widget /workspace/stock.js --title "Market Ticker" --surface panel')
      expect(panelRes.exitCode).toBe(0)
      expect(panelRes.stdout).toContain('Widget "Market Ticker" mounted in right side panel of the chatbox (if closed, open the widgets panel to view).')
      expect(sandbox.mountedWidgets[0].surface).toBe('panel')
      expect(sandbox.mountedWidgets[0].target).toBe('sidepanel')
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

    it('projects rawContent into messages.json to preserve ACTOR and cue tokens for widgets', async () => {
      const sandbox = new SandboxManager()
      await sandbox.init()

      const chatSession = useChatSessionStore()
      const sessionId = 'test-session-actors'
      chatSession.activeSessionId = sessionId
      chatSession.sessionMessages[sessionId] = [
        {
          id: 'm1',
          role: 'assistant',
          content: 'Hello Jin! I am brewing your coffee right now.',
          rawContent: '<|ACTOR:makise_kurisu|>Hello Jin! <|ACT:emotion="happy"|>I am brewing your coffee right now.',
          createdAt: new Date().toISOString(),
        } as any,
      ]

      await sandbox.syncProjections()

      const raw = await sandbox.readFile('/workspace/.airi/messages.json')
      const msgs = JSON.parse(raw)
      expect(msgs).toHaveLength(1)
      expect(msgs[0].content).toContain('<|ACTOR:makise_kurisu|>')
      expect(msgs[0].content).toContain('<|ACT:emotion="happy"|>')
    })

    it('projects rich nan0 cognition state into cognition.json when nan0 is enabled', async () => {
      const sandbox = new SandboxManager()
      await sandbox.init()

      const cardStore = useAiriCardStore()
      const nan0Store = useNan0Store()

      const nan0Card = {
        id: 'nan0-card',
        name: 'Nan0',
        description: 'AI companion with sentient emotions',
        extensions: {
          airi: {
            modules: {
              cognition: {
                enabled: true,
                processor: 'local_nan0',
              },
            },
          },
        },
      }
      cardStore.cards.set('nan0-card', nan0Card as any)
      cardStore.activeCardId = 'nan0-card'

      nan0Store.emotions = {
        ...nan0Store.emotions,
        attachment: 0.88,
        suspicion: 0.35,
      }

      await sandbox.syncProjections()

      const cognitionRaw = await sandbox.readFile('/workspace/.airi/cognition.json')
      const cognition = JSON.parse(cognitionRaw)

      expect(cognition.character.name).toBe('Nan0')
      expect(cognition.nan0).toBeDefined()
      expect(cognition.nan0.enabled).toBe(true)
      expect(cognition.nan0.emotions.attachment).toBe(0.88)
      expect(cognition.nan0.emotions.suspicion).toBe(0.35)
      expect(cognition.emotion).toBeDefined()
      expect(typeof cognition.valence).toBe('number')
      expect(typeof cognition.energy).toBe('number')
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

    it('persists mounted widgets in widgetsRepo and rehydrates them across reboots', async () => {
      // 1. Initial boot: mount a TypeScript widget
      const sandbox1 = new SandboxManager()
      await sandbox1.init()

      await sandbox1.writeFile('/workspace/pulse.ts', `
        export default function mount({ container }: any) {
          container.innerHTML = "<h1>Pulse Active</h1>";
        }
      `)

      const mountRes = await sandbox1.exec('mount_widget /workspace/pulse.ts --title "Pulse HUD"')
      expect(mountRes.exitCode).toBe(0)
      expect(sandbox1.mountedWidgets.length).toBe(1)
      expect(sandbox1.mountedWidgets[0].title).toBe('Pulse HUD')

      // Verify it was saved to widgetsRepo
      const persisted = await widgetsRepo.getMountedWidgets()
      expect(persisted.length).toBeGreaterThanOrEqual(1)
      const found = persisted.find(w => w.path === '/workspace/pulse.js')
      expect(found).toBeDefined()
      expect(found?.title).toBe('Pulse HUD')
      expect(found?.isMounted).toBe(true)
      expect(found?.sourcePath).toBe('/workspace/pulse.ts')
      expect(found?.sourceCode).toContain('Pulse Active')

      // 2. Simulate complete restart / reload with a brand new SandboxManager instance
      const sandbox2 = new SandboxManager()
      await sandbox2.init()

      // The new sandbox instance should automatically rehydrate the mounted widget
      expect(sandbox2.mountedWidgets.length).toBeGreaterThanOrEqual(1)
      const rehydrated = sandbox2.mountedWidgets.find(w => w.path === '/workspace/pulse.js')
      expect(rehydrated).toBeDefined()
      expect(rehydrated?.title).toBe('Pulse HUD')

      // Both source and compiled files must exist in the fresh virtual RAM disk
      const sourceContent = await sandbox2.readFile('/workspace/pulse.ts')
      expect(sourceContent).toContain('Pulse Active')

      const bundleContent = await sandbox2.readFile('/workspace/pulse.js')
      expect(bundleContent.length).toBeGreaterThan(0)

      // 3. Unmount widget and verify repo updates
      sandbox2.unmountWidget(rehydrated!.id)
      expect(sandbox2.mountedWidgets.some(w => w.id === rehydrated!.id)).toBe(false)

      const afterUnmount = await widgetsRepo.getMountedWidgets()
      expect(afterUnmount.some(w => w.id === rehydrated!.id)).toBe(false)
    })

    it('persists widget position and surface across rehydration', async () => {
      const sandbox1 = new SandboxManager()
      await sandbox1.init()

      await sandbox1.writeFile('/workspace/floating.js', 'export default function mount() {}')
      await sandbox1.exec('mount_widget /workspace/floating.js --title "Floating Pet" --surface widget')

      expect(sandbox1.mountedWidgets[0].surface).toBe('widget')

      // Update position
      await sandbox1.updateWidgetPosition(sandbox1.mountedWidgets[0].id, { x: 420, y: 180 })

      const repoWidgets = await widgetsRepo.getMountedWidgets()
      const saved = repoWidgets.find(w => w.id === sandbox1.mountedWidgets[0].id)
      expect(saved?.position).toEqual({ x: 420, y: 180 })
      expect(saved?.surface).toBe('widget')

      // Simulate reboot
      const sandbox2 = new SandboxManager()
      await sandbox2.init()

      const rehydrated = sandbox2.mountedWidgets.find(w => w.title === 'Floating Pet')
      expect(rehydrated).toBeDefined()
      expect(rehydrated?.surface).toBe('widget')
      expect(rehydrated?.position).toEqual({ x: 420, y: 180 })
    })

    it('mounts persisted widget with surface override and safely updates surface with reactive proxy state', async () => {
      const sandbox = new SandboxManager()
      await sandbox.init()

      await sandbox.writeFile('/workspace/panel-item.js', 'export default function mount() {}')
      await sandbox.exec('mount_widget /workspace/panel-item.js --title "Panel Tool" --surface panel')
      expect(sandbox.mountedWidgets[0].surface).toBe('panel')

      // Simulate proxy in state
      const proxyState = new Proxy({ counter: 42 }, {
        get(target, prop) {
          return (target as any)[prop]
        },
      })
      sandbox.mountedWidgets[0].state = proxyState

      // Changing surface should not throw DataCloneError
      await expect(sandbox.setWidgetSurface(sandbox.mountedWidgets[0].id, 'widget')).resolves.not.toThrow()
      expect(sandbox.mountedWidgets[0].surface).toBe('widget')

      // Unmount and remount with surface override
      sandbox.unmountWidget(sandbox.mountedWidgets[0].id)
      const remounted = await sandbox.mountPersistedWidget('Panel Tool', 'widget')
      expect(remounted).toBeDefined()
      expect(remounted?.surface).toBe('widget')
    })

    it('lists persisted widgets with list_widgets / widgets and remounts by title or path', async () => {
      const sandbox = new SandboxManager()
      await sandbox.init()

      await sandbox.writeFile('/workspace/clock.ts', `
        export default function mount({ container }: any) {
          container.innerHTML = "<div>12:00:00</div>";
        }
      `)

      await sandbox.exec('mount_widget /workspace/clock.ts --title "Digital Clock"')
      expect(sandbox.mountedWidgets.length).toBeGreaterThanOrEqual(1)

      // Test list_widgets command
      const listRes = await sandbox.exec('list_widgets')
      expect(listRes.exitCode).toBe(0)
      expect(listRes.stdout).toContain('Digital Clock')
      expect(listRes.stdout).toContain('[ACTIVE]')

      // Test widgets alias
      const aliasRes = await sandbox.exec('widgets')
      expect(aliasRes.exitCode).toBe(0)
      expect(aliasRes.stdout).toContain('Digital Clock')

      // Unmount the widget
      const mountedWidget = sandbox.mountedWidgets.find(w => w.title === 'Digital Clock')!
      sandbox.unmountWidget(mountedWidget.id)
      expect(sandbox.mountedWidgets.some(w => w.title === 'Digital Clock')).toBe(false)

      // In list_widgets, it should now show as [UNMOUNTED]
      const unmountedListRes = await sandbox.exec('list_widgets')
      expect(unmountedListRes.stdout).toContain('[UNMOUNTED]')
      expect(unmountedListRes.stdout).toContain('Digital Clock')

      // Delete file from disk to simulate cold remount
      await sandbox.exec('rm /workspace/clock.ts /workspace/clock.js')

      // Remount using title via mount_widget
      const remountRes = await sandbox.exec('mount_widget "Digital Clock"')
      expect(remountRes.exitCode).toBe(0)
      expect(sandbox.mountedWidgets.some(w => w.title === 'Digital Clock')).toBe(true)

      // Remount via mountPersistedWidget API
      sandbox.unmountWidget(mountedWidget.id)
      const apiMounted = await sandbox.mountPersistedWidget(mountedWidget.id)
      expect(apiMounted).not.toBeNull()
      expect(apiMounted?.title).toBe('Digital Clock')
      expect(sandbox.mountedWidgets.some(w => w.id === mountedWidget.id)).toBe(true)
    })
  })

  describe('native mcp cli and virtual node mcp bridge', () => {
    beforeEach(() => {
      clearMcpToolBridge()
    })

    it('returns usage help when mcp is called without arguments or with --help', async () => {
      const sandbox = new SandboxManager()
      await sandbox.init()

      const res = await sandbox.exec('mcp')
      expect(res.exitCode).toBe(0)
      expect(res.stdout).toContain('Usage:')
      expect(res.stdout).toContain('mcp list')
      expect(res.stdout).toContain('mcp call')
    })

    it('returns error when mcp bridge is not available', async () => {
      const sandbox = new SandboxManager()
      await sandbox.init()

      const res = await sandbox.exec('mcp list')
      expect(res.exitCode).toBe(1)
      expect(res.stderr).toContain('MCP tool bridge is not available')
    })

    it('lists tools and executes tool calls piping into filesystem and jq', async () => {
      const mockBridge = {
        listTools: vi.fn().mockResolvedValue([
          { serverName: 'weather', toolName: 'get_forecast', name: 'weather::get_forecast', description: 'Get weather forecast' },
          { serverName: 'github', toolName: 'list_issues', name: 'github::list_issues', description: 'List repo issues' },
        ]),
        callTool: vi.fn().mockImplementation(async (payload: any) => {
          if (payload.name === 'weather::get_forecast') {
            return {
              structuredContent: { city: payload.arguments?.city, temp: 22, condition: 'Sunny' },
            }
          }
          return { toolResult: 'ok' }
        }),
        getRuntimeStatus: vi.fn().mockResolvedValue({ path: '', servers: [], updatedAt: Date.now() }),
      }
      setMcpToolBridge(mockBridge as any)

      const sandbox = new SandboxManager()
      await sandbox.init()

      // 1. mcp list
      const listRes = await sandbox.exec('mcp list')
      expect(listRes.exitCode).toBe(0)
      expect(listRes.stdout).toContain('weather::get_forecast')
      expect(listRes.stdout).toContain('github::list_issues')

      // 2. mcp list --json
      const jsonListRes = await sandbox.exec('mcp list --json')
      expect(jsonListRes.exitCode).toBe(0)
      expect(JSON.parse(jsonListRes.stdout).length).toBe(2)

      // 3. mcp call with args piped to file
      const callRes = await sandbox.exec('mcp weather::get_forecast \'{"city":"Tokyo"}\' > /workspace/weather.json')
      expect(callRes.exitCode).toBe(0)

      // 4. Verify file content and pipe to jq
      const jqRes = await sandbox.exec('cat /workspace/weather.json | jq .city')
      expect(jqRes.exitCode).toBe(0)
      expect(jqRes.stdout.trim()).toBe('"Tokyo"')

      const tempRes = await sandbox.exec('cat /workspace/weather.json | jq .temp')
      expect(tempRes.exitCode).toBe(0)
      expect(tempRes.stdout.trim()).toBe('22')
    })

    it('supports require("mcp") and global mcp in node runtime', async () => {
      const mockBridge = {
        listTools: vi.fn().mockResolvedValue([
          { serverName: 'calc', toolName: 'add', name: 'calc::add', description: 'Add numbers' },
        ]),
        callTool: vi.fn().mockImplementation(async (payload: any) => {
          if (payload.name === 'calc::add') {
            return {
              structuredContent: { sum: (payload.arguments?.a ?? 0) + (payload.arguments?.b ?? 0) },
            }
          }
          return { toolResult: null }
        }),
        getRuntimeStatus: vi.fn().mockResolvedValue({ path: '', servers: [], updatedAt: Date.now() }),
      }
      setMcpToolBridge(mockBridge as any)

      const sandbox = new SandboxManager()
      await sandbox.init()

      // 1. node require('mcp')
      const script = `
const mcp = require('mcp');
const fs = require('fs');
const res = await mcp.callTool('calc::add', { a: 15, b: 27 });
fs.writeFileSync('/workspace/sum.json', JSON.stringify(res));
console.log('SUM:' + res.sum);
`
      await sandbox.exec(`cat > /workspace/calc.js << 'EOF'${script}EOF`)
      const nodeRes = await sandbox.exec('node /workspace/calc.js')
      expect(nodeRes.exitCode).toBe(0)
      expect(nodeRes.stdout).toContain('SUM:42')

      const sumFile = await sandbox.exec('cat /workspace/sum.json | jq .sum')
      expect(sumFile.stdout.trim()).toBe('42')

      // 2. node global mcp via eval (-e)
      const evalRes = await sandbox.exec('node -e "const res = await mcp.callTool(\'calc::add\', { a: 100, b: 200 }); console.log(\'EVAL_SUM:\' + res.sum);"')
      expect(evalRes.exitCode).toBe(0)
      expect(evalRes.stdout).toContain('EVAL_SUM:300')
    })
  })

  describe('widget iframe srcdoc packaging & height stabilization', () => {
    it('packages ESM widgets with auto-height styles and threshold-governed ResizeObserver', async () => {
      const srcdoc = await buildWidgetIframeSrcdoc({
        path: '/workspace/test.js',
        code: 'export default function mount({ container }) { container.innerHTML = "<div>test</div>"; }',
        title: 'Test Widget',
      })

      // Iframe must use auto-height to prevent feedback loop expansion
      expect(srcdoc).toContain('height: auto')
      expect(srcdoc).toContain('min-height: 0')
      expect(srcdoc).not.toContain('min-h-full')
      expect(srcdoc).toContain('observe(root)')
      expect(srcdoc).toContain('Math.abs(h - lastH) > 2')
      expect(srcdoc).toContain('type: \'widget-resize\'')
    })
  })

  describe('lazy sidecar state binding & 2-way reactivity', () => {
    it('initializes with empty state by default without creating sidecar file spam', async () => {
      const sandbox = new SandboxManager()
      await sandbox.init()

      await sandbox.writeFile('/workspace/strawberry.ts', 'export default function mount({ container, state }: AiriWidgetContext) { container.innerHTML = "🍓"; }')
      const res = await sandbox.exec('mount_widget /workspace/strawberry.ts')
      expect(res.exitCode).toBe(0)

      // Does NOT spam empty .json file
      const jsonExists = await (sandbox as any).bash.fs.exists('/workspace/strawberry.json')
      expect(jsonExists).toBe(false)
      expect(sandbox.mountedWidgets[0].state).toBeUndefined()
    })

    it('mounts with preloaded state if sidecar file already exists in VFS', async () => {
      const sandbox = new SandboxManager()
      await sandbox.init()

      await sandbox.writeFile('/workspace/counter.json', JSON.stringify({ count: 7 }))
      await sandbox.writeFile('/workspace/counter.ts', 'export default function mount({ container, state }: AiriWidgetContext) { container.innerHTML = `Count: ${state.count}`; }')
      const res = await sandbox.exec('mount_widget /workspace/counter.ts')
      expect(res.exitCode).toBe(0)

      expect(sandbox.mountedWidgets[0].state).toEqual({ count: 7 })
    })

    it('lazily creates sidecar json and updates widgetsRepo when handleWidgetStateUpdate is called', async () => {
      const sandbox = new SandboxManager()
      await sandbox.init()

      await sandbox.writeFile('/workspace/strawberry.ts', 'export default function mount() {}')
      await sandbox.exec('mount_widget /workspace/strawberry.ts')
      const widget = sandbox.mountedWidgets[0]
      expect(widget).toBeDefined()

      // Simulate setState from iframe
      await sandbox.handleWidgetStateUpdate(widget.id, widget.path, { loves: 12, mood: '🍓' })

      // File should now lazily exist in VFS
      const rawJson = await sandbox.readFile('/workspace/strawberry.json')
      expect(JSON.parse(rawJson)).toEqual({ loves: 12, mood: '🍓' })

      // Persisted in repo
      const persisted = await widgetsRepo.getWidgets()
      const found = persisted.find(w => w.id === widget.id)
      expect(found?.state).toEqual({ loves: 12, mood: '🍓' })
      expect(sandbox.mountedWidgets[0].state).toEqual({ loves: 12, mood: '🍓' })
    })

    it('detects file modifications from bash and synchronizes widget state', async () => {
      const sandbox = new SandboxManager()
      await sandbox.init()

      await sandbox.writeFile('/workspace/strawberry.ts', 'export default function mount() {}')
      await sandbox.exec('mount_widget /workspace/strawberry.ts')
      const widget = sandbox.mountedWidgets[0]

      // First call setState to create the file
      await sandbox.handleWidgetStateUpdate(widget.id, widget.path, { loves: 5 })

      // Agent in bash mutates the file directly via echo/redirect
      const mutateRes = await sandbox.exec('echo \'{"loves": 99, "status": "happy"}\' > /workspace/strawberry.json')
      expect(mutateRes.exitCode).toBe(0)

      // State is synchronized into mounted widget and repo
      expect(sandbox.mountedWidgets[0].state).toEqual({ loves: 99, status: 'happy' })
      const persisted = await widgetsRepo.getWidgets()
      const found = persisted.find(w => w.id === widget.id)
      expect(found?.state).toEqual({ loves: 99, status: 'happy' })
    })

    it('rehydrates persisted state and restores sidecar json on reboot', async () => {
      // Seed persisted widget in widgetsRepo with state
      await widgetsRepo.saveWidget({
        id: 'widget-rehydrate-test',
        title: 'Rehydrate Test',
        path: '/workspace/rehydrate.js',
        sourcePath: '/workspace/rehydrate.ts',
        sourceCode: 'export default function mount() {}',
        code: 'export default function mount() {}',
        state: { level: 3, xp: 450 },
        isMounted: true,
        mountedAt: Date.now(),
        updatedAt: Date.now(),
      })

      const newSandbox = new SandboxManager()
      await newSandbox.init()

      // The .json sidecar should be restored in VFS
      const rawJson = await newSandbox.readFile('/workspace/rehydrate.json')
      expect(JSON.parse(rawJson)).toEqual({ level: 3, xp: 450 })

      // Mounted widget should have state
      const mounted = newSandbox.mountedWidgets.find(w => w.id === 'widget-rehydrate-test')
      expect(mounted?.state).toEqual({ level: 3, xp: 450 })
    })

    it('packages srcdoc with state, setState, onStateChange, and message handlers', async () => {
      const srcdoc = await buildWidgetIframeSrcdoc({
        path: '/workspace/pet.js',
        code: 'export default function mount({ state, setState, onStateChange }) {}',
        title: 'Pet',
        state: { hunger: 25 },
      })

      expect(srcdoc).toContain('let widgetState = {"hunger":25};')
      expect(srcdoc).toContain('function setState(val)')
      expect(srcdoc).toContain('function onStateChange(cb)')
      expect(srcdoc).toContain('widget-state-update')
      expect(srcdoc).toContain('widget-state-sync')
      expect(srcdoc).toContain('get state() { return widgetState; }')
    })
  })
})
