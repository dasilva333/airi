import { Client } from 'https://esm.sh/@modelcontextprotocol/sdk@1.27.1/client/index.js'
import { StreamableHTTPClientTransport } from 'https://esm.sh/@modelcontextprotocol/sdk@1.27.1/client/streamableHttp.js'
import { createOpenAI } from 'https://esm.sh/@xsai-ext/providers@0.4.3/create'
import { streamText } from 'https://esm.sh/@xsai/stream-text@0.4.3'

// DOM Elements
const terminalOutput = document.getElementById('terminalOutput')
const termInput = document.getElementById('termInput')
const termBtn = document.getElementById('termBtn')
const chatMessages = document.getElementById('chatMessages')
const chatInput = document.getElementById('chatInput')
const chatSubmitBtn = document.getElementById('chatSubmitBtn')

// Right Pane Tab Elements
const tabBtnTerminal = document.getElementById('tabBtnTerminal')
const tabBtnCanvas = document.getElementById('tabBtnCanvas')
const terminalPanel = document.getElementById('terminalPanel')
const canvasPanel = document.getElementById('canvasPanel')
const terminalHeaderControls = document.getElementById('terminalHeaderControls')
const canvasHeaderControls = document.getElementById('canvasHeaderControls')
const canvasArtifactName = document.getElementById('canvasArtifactName')
const canvasTabDot = document.getElementById('canvasTabDot')
const canvasActiveBadge = document.getElementById('canvasActiveBadge')
const canvasEmptyState = document.getElementById('canvasEmptyState')
const canvasFrameWrapper = document.getElementById('canvasFrameWrapper')
const canvasIframe = document.getElementById('canvasIframe')

const settingsModal = document.getElementById('settingsModal')
const cfgApiKey = document.getElementById('cfgApiKey')
const cfgBaseUrl = document.getElementById('cfgBaseUrl')
const cfgModel = document.getElementById('cfgModel')
const cfgSystemPrompt = document.getElementById('cfgSystemPrompt')
const cfgSaveNotice = document.getElementById('cfgSaveNotice')

const providerStatusBtn = document.getElementById('providerStatusBtn')
const providerStatusDot = document.getElementById('providerStatusDot')
const providerStatusText = document.getElementById('providerStatusText')

const mcpStatusBadge = document.getElementById('mcpStatusBadge')
const mcpStatusDot = document.getElementById('mcpStatusDot')
const mcpStatusText = document.getElementById('mcpStatusText')

const DEFAULT_SYSTEM_PROMPT = `You are Airi, an autonomous AI companion.
You have access to a full execution stack:
1. In-memory POSIX bash sandbox located at /workspace via the "bash" tool.
   - Standard shell tools: ls, cat, grep, jq, echo, touch, mkdir, pipes, redirection.
   - Built-in TypeScript compiler: "tsc <file.ts>" (powered by tsc-rs v7.1.0-dev). It compiles TypeScript to ES modules with full typechecking!
2. Remote MCP tools over Streamable HTTP:
   - "ping": Ping the remote MCP server for latency and status.
   - "weather_lookup": Retrieve live weather conditions and forecasts for any city.
3. Generative UI Canvas via the "mount_widget" tool:
   - "mount_widget({ path: string, data?: object })": Mounts a compiled JavaScript widget or HTML artifact to the Live Canvas preview tab for the user.
   - Automatically switches the user's view from the terminal to the Generative Canvas.

When asked to build, compile, or demo UI widgets:
1. Fetch any required data (e.g. via MCP weather_lookup).
2. Write clean, self-contained TypeScript code to /workspace/<widget>.ts.
   - The module should export a mount function:
     export default function mount(container: HTMLElement, data?: any) { ... }
   - Use Tailwind CSS classes for beautiful glassmorphism, responsive cards, crisp typography, and status badges.
3. Compile the TypeScript file using bash: "tsc /workspace/<widget>.ts".
4. Mount the compiled widget using mount_widget({ path: "/workspace/<widget>.js", data }).
5. Summarize what you created and the data rendered.`

// State
let conversationHistory = []
let isAgentStreaming = false
let isTermExecuting = false

// Canvas State
let currentActiveArtifact = null
let currentActiveData = null

// Remote MCP state
let mcpClient = null
let mcpTransport = null
let discoveredMcpTools = []

// Switch right pane tabs (Terminal ↔ Canvas)
export function switchRightTab(tab) {
  if (tab === 'terminal') {
    tabBtnTerminal.className = 'px-3 py-1.5 rounded-lg flex items-center gap-2 bg-slate-800 text-white font-medium shadow-sm transition cursor-pointer'
    tabBtnCanvas.className = 'px-3 py-1.5 rounded-lg flex items-center gap-2 text-slate-400 hover:text-slate-200 transition cursor-pointer'
    terminalPanel.classList.remove('hidden')
    terminalPanel.classList.add('flex')
    canvasPanel.classList.add('hidden')
    canvasPanel.classList.remove('flex')
    terminalHeaderControls.classList.remove('hidden')
    terminalHeaderControls.classList.add('flex')
    canvasHeaderControls.classList.add('hidden')
    canvasHeaderControls.classList.remove('flex')
  }
  else if (tab === 'canvas') {
    tabBtnCanvas.className = 'px-3 py-1.5 rounded-lg flex items-center gap-2 bg-indigo-900/50 text-indigo-200 border border-indigo-700/50 font-medium shadow-sm transition cursor-pointer'
    tabBtnTerminal.className = 'px-3 py-1.5 rounded-lg flex items-center gap-2 text-slate-400 hover:text-slate-200 transition cursor-pointer'
    canvasPanel.classList.remove('hidden')
    canvasPanel.classList.add('flex')
    terminalPanel.classList.add('hidden')
    terminalPanel.classList.remove('flex')
    canvasHeaderControls.classList.remove('hidden')
    canvasHeaderControls.classList.add('flex')
    terminalHeaderControls.classList.add('hidden')
    terminalHeaderControls.classList.remove('flex')
  }
}
window.switchRightTab = switchRightTab

// Mount widget to the Generative Canvas
export async function mountWidgetToCanvas(filePath, data = {}) {
  currentActiveArtifact = filePath
  currentActiveData = data

  const fileName = filePath.split('/').pop() || filePath
  canvasArtifactName.innerText = fileName
  canvasActiveBadge.classList.remove('hidden')
  canvasTabDot.className = 'h-2 w-2 rounded-full bg-emerald-400 animate-pulse'

  // Fetch file content from in-memory filesystem API
  const res = await fetch(`/api/fs/read?path=${encodeURIComponent(filePath)}`)
  const result = await res.json()
  if (!result.ok) {
    throw new Error(result.error || `Failed to read file ${filePath}`)
  }

  const content = result.content
  canvasEmptyState.classList.add('hidden')
  canvasFrameWrapper.classList.remove('hidden')

  // Generate sandbox iframe srcdoc with pre-loaded Tailwind CDN & dark styling
  let htmlDoc = ''
  if (filePath.endsWith('.html')) {
    htmlDoc = `<!DOCTYPE html>
<html class="dark">
<head>
  <meta charset="UTF-8">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { background: #090d16; color: #f8fafc; font-family: ui-sans-serif, system-ui, sans-serif; padding: 1.25rem; min-height: 100vh; }
  </style>
</head>
<body class="antialiased">
  ${content}
</body>
</html>`
  }
  else {
    // Compiled JS module
    htmlDoc = `<!DOCTYPE html>
<html class="dark">
<head>
  <meta charset="UTF-8">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body {
      background: #090d16;
      color: #f8fafc;
      font-family: ui-sans-serif, system-ui, sans-serif;
      padding: 1.5rem;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
  </style>
</head>
<body class="antialiased">
  <div id="root" class="w-full flex-1 flex flex-col items-center justify-center"></div>
  <script type="module">
    const contextData = ${JSON.stringify(data || {})};
    try {
      const code = ${JSON.stringify(content)};
      const blob = new Blob([code], { type: 'application/javascript' });
      const blobUrl = URL.createObjectURL(blob);
      const mod = await import(blobUrl);
      URL.revokeObjectURL(blobUrl);

      const root = document.getElementById('root');
      if (typeof mod.default === 'function') {
        mod.default(root, contextData);
      } else if (typeof mod.mount === 'function') {
        mod.mount(root, contextData);
      } else if (typeof mod.render === 'function') {
        const res = mod.render(root, contextData);
        if (typeof res === 'string') root.innerHTML = res;
      }
    } catch (err) {
      document.getElementById('root').innerHTML = \`
        <div class="rounded-xl border border-rose-800 bg-rose-950/70 p-4 text-rose-200 w-full max-w-md">
          <div class="font-bold text-sm flex items-center gap-2">
            <span>⚠️ Widget Execution Error</span>
          </div>
          <pre class="mt-2 text-xs font-mono whitespace-pre-wrap text-rose-300">\${err.stack || err.message}</pre>
        </div>
      \`;
    }
  </script>
</body>
</html>`
  }

  canvasIframe.srcdoc = htmlDoc
  switchRightTab('canvas')
}
window.mountWidgetToCanvas = mountWidgetToCanvas

window.reloadCanvasWidget = function () {
  if (currentActiveArtifact) {
    mountWidgetToCanvas(currentActiveArtifact, currentActiveData)
  }
}

// Connect to Remote MCP server via Streamable HTTP
async function initMcpClient() {
  try {
    mcpClient = new Client(
      { name: 'airi-sandbox-client', version: '1.0.0' },
      { capabilities: {} },
    )

    const mcpUrl = new URL('/mcp', window.location.origin).toString()
    mcpTransport = new StreamableHTTPClientTransport(new URL(mcpUrl))

    await mcpClient.connect(mcpTransport)
    const listResult = await mcpClient.listTools()
    discoveredMcpTools = listResult.tools || []

    const names = discoveredMcpTools.map(t => t.name).join(', ')
    mcpStatusBadge.className = 'flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 font-mono text-[11px]'
    mcpStatusDot.className = 'h-2 w-2 rounded-full bg-emerald-400'
    mcpStatusText.innerText = `🟢 MCP: Connected (${discoveredMcpTools.length} tools: ${names})`
    console.log('[MCP Client] Connected over Streamable HTTP. Discovered tools:', discoveredMcpTools)
  }
  catch (err) {
    console.error('[MCP Client] Failed to connect to /mcp:', err)
    mcpStatusBadge.className = 'flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 font-mono text-[11px]'
    mcpStatusDot.className = 'h-2 w-2 rounded-full bg-rose-400'
    mcpStatusText.innerText = '⚠️ MCP: Offline'
  }
}

// Configuration management via localStorage
export function loadConfig() {
  const apiKey = localStorage.getItem('airi_sandbox_api_key') || ''
  const baseUrl = localStorage.getItem('airi_sandbox_base_url') || 'https://openrouter.ai/api/v1'
  const model = localStorage.getItem('airi_sandbox_model') || 'deepseek/deepseek-v4.1-flash'
  const systemPrompt = localStorage.getItem('airi_sandbox_system_prompt') || DEFAULT_SYSTEM_PROMPT

  cfgApiKey.value = apiKey
  cfgBaseUrl.value = baseUrl
  cfgModel.value = model
  cfgSystemPrompt.value = systemPrompt

  updateStatusUI(apiKey, model)
  initConversation(systemPrompt)
}

function updateStatusUI(apiKey, model) {
  if (!apiKey) {
    providerStatusBtn.className = 'flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 transition cursor-pointer'
    providerStatusDot.className = 'h-2 w-2 rounded-full bg-amber-400 animate-pulse'
    providerStatusText.innerText = '⚠️ Set API Key'
  }
  else {
    const shortModel = model.split('/').pop() || model
    providerStatusBtn.className = 'flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 transition cursor-pointer'
    providerStatusDot.className = 'h-2 w-2 rounded-full bg-emerald-400'
    providerStatusText.innerText = `🟢 ${shortModel}`
  }
}

function initConversation(systemPrompt) {
  conversationHistory = [
    { role: 'system', content: systemPrompt || DEFAULT_SYSTEM_PROMPT },
  ]
}

// Modal controls
window.openSettingsModal = function () {
  settingsModal.classList.remove('hidden')
  settingsModal.classList.add('flex')
  cfgApiKey.focus()
}

window.closeSettingsModal = function () {
  settingsModal.classList.add('hidden')
  settingsModal.classList.remove('flex')
}

window.toggleApiKeyVisibility = function () {
  cfgApiKey.type = cfgApiKey.type === 'text' ? 'password' : 'text'
}

window.setModelPreset = function (preset) {
  cfgModel.value = preset
}

window.resetDefaultSystemPrompt = function () {
  cfgSystemPrompt.value = DEFAULT_SYSTEM_PROMPT
}

window.saveSettings = function () {
  const key = cfgApiKey.value.trim()
  const url = cfgBaseUrl.value.trim() || 'https://openrouter.ai/api/v1'
  const mdl = cfgModel.value.trim() || 'deepseek/deepseek-v4.1-flash'
  const prompt = cfgSystemPrompt.value.trim() || DEFAULT_SYSTEM_PROMPT

  localStorage.setItem('airi_sandbox_api_key', key)
  localStorage.setItem('airi_sandbox_base_url', url)
  localStorage.setItem('airi_sandbox_model', mdl)
  localStorage.setItem('airi_sandbox_system_prompt', prompt)

  updateStatusUI(key, mdl)
  initConversation(prompt)

  cfgSaveNotice.style.opacity = '1'
  setTimeout(() => {
    cfgSaveNotice.style.opacity = '0'
    closeSettingsModal()
  }, 700)
}

// Clear chat
window.clearChat = function () {
  initConversation(localStorage.getItem('airi_sandbox_system_prompt'))
  chatMessages.innerHTML = `
    <div class="flex justify-center">
      <div class="text-[11px] text-slate-400 bg-slate-800/60 border border-slate-700/50 rounded-full px-3.5 py-1 flex items-center gap-2">
        <span>✨ Conversation cleared. In-memory POSIX workspace + tsc compiler + Canvas ready.</span>
      </div>
    </div>
  `
}

function ansiToHtml(str) {
  if (!str)
    return ''
  let escaped = str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  const colorMap = {
    30: 'text-slate-500',
    31: 'text-rose-400',
    32: 'text-emerald-400',
    33: 'text-amber-300',
    34: 'text-blue-400',
    35: 'text-purple-400',
    36: 'text-cyan-400',
    37: 'text-slate-100',
    90: 'text-slate-400',
    91: 'text-rose-300',
    92: 'text-emerald-300',
    93: 'text-amber-200',
    94: 'text-blue-300',
    95: 'text-purple-300',
    96: 'text-cyan-300',
    97: 'text-white',
    1: 'font-bold text-white',
    2: 'opacity-70',
  }

  let openSpans = 0
  escaped = escaped.replace(/\x1B\[([0-9;]+)m/g, (_, codes) => {
    const parts = codes.split(';')
    const classes = []
    let reset = false

    for (const p of parts) {
      if (p === '0' || p === '') {
        reset = true
      }
      else if (colorMap[p]) {
        classes.push(colorMap[p])
      }
    }

    let res = ''
    if (reset) {
      while (openSpans > 0) {
        res += '</span>'
        openSpans--
      }
    }
    if (classes.length > 0) {
      res += `<span class="${classes.join(' ')}">`
      openSpans++
    }
    return res
  })

  while (openSpans > 0) {
    escaped += '</span>'
    openSpans--
  }

  escaped = escaped.replace(/\x1B\[[0-9;]*[a-z]/gi, '')
  return escaped
}

// Terminal commands (Human execution)
window.runHumanCommand = async function (cmd) {
  if (!cmd || isTermExecuting)
    return
  isTermExecuting = true
  termBtn.disabled = true
  termBtn.innerText = '...'

  const cmdBlock = document.createElement('div')
  cmdBlock.className = 'space-y-1'
  cmdBlock.innerHTML = `
    <div class="text-emerald-400 font-semibold flex items-center gap-1.5">
      <span>airi@sandbox:~$</span>
      <span class="text-white whitespace-pre-wrap">${escapeHtml(cmd)}</span>
    </div>
  `
  terminalOutput.appendChild(cmdBlock)

  try {
    const res = await fetch('/api/exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: cmd }),
    })
    const data = await res.json()

    const outBlock = document.createElement('div')
    outBlock.className = 'pl-2 border-l border-slate-800 whitespace-pre-wrap'

    if (data.stdout)
      outBlock.innerHTML += `<div class="text-slate-300">${ansiToHtml(data.stdout)}</div>`

    if (data.stderr)
      outBlock.innerHTML += `<div class="text-rose-400">${ansiToHtml(data.stderr)}</div>`

    if (!data.stdout && !data.stderr)
      outBlock.innerHTML += `<div class="text-slate-600 italic">(command completed with exit code ${data.exitCode})</div>`

    cmdBlock.appendChild(outBlock)

    // Check for auto-mount trigger
    if (data.stdout && data.stdout.includes('[GEN_UI_MOUNT:')) {
      const match = data.stdout.match(/\[GEN_UI_MOUNT:(.*?)\]/)
      if (match && match[1]) {
        mountWidgetToCanvas(match[1])
      }
    }
  }
  catch (err) {
    const errBlock = document.createElement('div')
    errBlock.className = 'text-rose-400 pl-2 border-l border-rose-800'
    errBlock.innerText = `Execution error: ${err.message}`
    cmdBlock.appendChild(errBlock)
  }
  finally {
    isTermExecuting = false
    termBtn.disabled = false
    termBtn.innerText = 'Exec'
    terminalOutput.scrollTop = terminalOutput.scrollHeight
  }
}

window.handleTerminalSubmit = function (e) {
  e.preventDefault()
  const cmd = termInput.value.trim()
  if (!cmd)
    return
  termInput.value = ''
  runHumanCommand(cmd)
}

// Terminal logging for agent execution
function logAgentCommandStart(cmd) {
  const block = document.createElement('div')
  block.className = 'space-y-1'
  block.innerHTML = `
    <div class="text-indigo-400 font-semibold flex items-center gap-1.5">
      <span class="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">AGENT</span>
      <span>airi@sandbox:~$</span>
      <span class="text-white whitespace-pre-wrap">${escapeHtml(cmd)}</span>
    </div>
  `
  terminalOutput.appendChild(block)
  terminalOutput.scrollTop = terminalOutput.scrollHeight
  return block
}

function logAgentCommandResult(block, data) {
  const outBlock = document.createElement('div')
  outBlock.className = 'pl-2 border-l border-indigo-900/50 whitespace-pre-wrap'
  if (data.stdout)
    outBlock.innerHTML += `<div class="text-slate-300">${ansiToHtml(data.stdout)}</div>`

  if (data.stderr)
    outBlock.innerHTML += `<div class="text-rose-400">${ansiToHtml(data.stderr)}</div>`

  if (!data.stdout && !data.stderr)
    outBlock.innerHTML += `<div class="text-slate-600 italic">(command finished with exit code ${data.exitCode})</div>`

  block.appendChild(outBlock)
  terminalOutput.scrollTop = terminalOutput.scrollHeight

  // Check for auto-mount trigger
  if (data.stdout && data.stdout.includes('[GEN_UI_MOUNT:')) {
    const match = data.stdout.match(/\[GEN_UI_MOUNT:(.*?)\]/)
    if (match && match[1]) {
      mountWidgetToCanvas(match[1])
    }
  }
}

// Reset sandbox
window.resetSandbox = async function () {
  if (!confirm('Reset in-memory filesystem to default seeded state?'))
    return
  try {
    await fetch('/api/reset', { method: 'POST' })
    clearTerminal()
    runHumanCommand('ls -la')
  }
  catch (err) {
    alert(`Reset failed: ${err.message}`)
  }
}

window.clearTerminal = function () {
  terminalOutput.innerHTML = `
    <div class="text-slate-500 select-none">
      ══════════════════════════════════════════════════════════════════<br>
      AIRI IN-MEMORY BASH ENVIRONMENT (just-bash v3.6.0)<br>
      TypeScript 7.1.0-dev Compiler (tsc-rs) bound as 'tsc'<br>
      Virtual RAM Disk: 100% Host-Isolated. Shared with AI Agent.<br>
      ══════════════════════════════════════════════════════════════════
    </div>
  `
}

// Native @xsai bash tool definition
function createBashTool(assistantBubbleEl) {
  return {
    type: 'function',
    function: {
      name: 'bash',
      description: 'Execute a bash command in the virtual in-memory POSIX environment (/workspace). Supports ls, cat, grep, jq, echo, mkdir, touch, tsc (TypeScript compiler), pipes (|), and redirection (>). Always use this tool to inspect files, write scripts, or compile TypeScript.',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The shell command line to execute in /workspace',
          },
        },
        required: ['command'],
      },
    },
    execute: async ({ command }) => {
      const termBlock = logAgentCommandStart(command)

      const chipsContainer = assistantBubbleEl.querySelector('.tool-chips-container')
      const chipEl = document.createElement('div')
      chipEl.className = 'flex items-center gap-2 px-2.5 py-1 rounded-lg bg-indigo-950/60 border border-indigo-800/50 text-[11px] font-mono text-indigo-300 animate-pulse'
      chipEl.innerHTML = `
        <span class="h-1.5 w-1.5 rounded-full bg-indigo-400"></span>
        <span>Running bash: ${escapeHtml(command)}</span>
      `
      chipsContainer.appendChild(chipEl)
      chatMessages.scrollTop = chatMessages.scrollHeight

      const res = await fetch('/api/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      })
      const data = await res.json()

      logAgentCommandResult(termBlock, data)

      chipEl.classList.remove('animate-pulse')
      const isOk = data.exitCode === 0 && !data.stderr
      chipEl.className = `flex items-center justify-between px-2.5 py-1 rounded-lg ${isOk ? 'bg-slate-900 border border-slate-800 text-slate-300' : 'bg-rose-950/40 border border-rose-800/40 text-rose-300'} text-[11px] font-mono`
      chipEl.innerHTML = `
        <div class="flex items-center gap-1.5 truncate mr-2">
          <span class="${isOk ? 'text-emerald-400' : 'text-rose-400'} font-bold">${isOk ? '✓' : '✗'}</span>
          <span class="truncate">${escapeHtml(command)}</span>
        </div>
        <span class="text-[10px] text-slate-500 shrink-0">exit ${data.exitCode}</span>
      `

      return JSON.stringify({
        stdout: data.stdout || '',
        stderr: data.stderr || '',
        exitCode: data.exitCode,
      })
    },
  }
}

// Native @xsai mount_widget tool definition
function createMountWidgetTool(assistantBubbleEl) {
  return {
    type: 'function',
    function: {
      name: 'mount_widget',
      description: 'Mount a compiled JavaScript (.js) widget or HTML (.html) artifact from /workspace to the Live Generative UI Canvas for the user to see. Automatically switches the right pane to the Canvas.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'The file path in /workspace (e.g. /workspace/weather_card.js)',
          },
          data: {
            type: 'object',
            description: 'Optional JSON state/context object to pass into the widget mount function',
          },
        },
        required: ['path'],
      },
    },
    execute: async ({ path, data }) => {
      const chipsContainer = assistantBubbleEl.querySelector('.tool-chips-container')
      const chipEl = document.createElement('div')
      chipEl.className = 'flex items-center gap-2 px-2.5 py-1 rounded-lg bg-indigo-950/60 border border-indigo-700/60 text-[11px] font-mono text-indigo-300 animate-pulse'
      chipEl.innerHTML = `
        <span class="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-ping"></span>
        <span>Mounting widget: <strong>${escapeHtml(path)}</strong></span>
      `
      chipsContainer.appendChild(chipEl)
      chatMessages.scrollTop = chatMessages.scrollHeight

      try {
        await mountWidgetToCanvas(path, data || {})
        chipEl.classList.remove('animate-pulse')
        chipEl.className = 'flex items-center justify-between px-2.5 py-1 rounded-lg bg-indigo-950/50 border border-indigo-700/50 text-indigo-200 text-[11px] font-mono'
        chipEl.innerHTML = `
          <div class="flex items-center gap-1.5 truncate mr-2">
            <span class="text-indigo-400 font-bold">✨</span>
            <span class="font-semibold text-indigo-300">Mounted to Canvas:</span>
            <span class="truncate text-slate-300 font-mono">${escapeHtml(path)}</span>
          </div>
          <span class="text-[10px] text-emerald-400 font-bold shrink-0">✓ Live</span>
        `
        return JSON.stringify({
          ok: true,
          mounted: path,
          message: `Widget ${path} successfully rendered and mounted on the Generative Canvas. View has been switched to Canvas.`,
        })
      }
      catch (err) {
        chipEl.classList.remove('animate-pulse')
        chipEl.className = 'flex items-center justify-between px-2.5 py-1 rounded-lg bg-rose-950/40 border border-rose-800/40 text-rose-300 text-[11px] font-mono'
        chipEl.innerHTML = `
          <div class="flex items-center gap-1.5 truncate mr-2">
            <span class="text-rose-400 font-bold">✗</span>
            <span>mount_widget error: ${escapeHtml(err.message)}</span>
          </div>
        `
        return JSON.stringify({ error: err.message })
      }
    },
  }
}

// Convert Remote MCP tool into @xsai tool
function createXsaiMcpTool(mcpTool, assistantBubbleEl) {
  return {
    type: 'function',
    function: {
      name: mcpTool.name,
      description: mcpTool.description || `Remote MCP tool: ${mcpTool.name}`,
      parameters: mcpTool.inputSchema || { type: 'object', properties: {} },
    },
    execute: async (args) => {
      const chipsContainer = assistantBubbleEl.querySelector('.tool-chips-container')
      const chipEl = document.createElement('div')
      chipEl.className = 'flex items-center gap-2 px-2.5 py-1 rounded-lg bg-indigo-950/60 border border-indigo-700/60 text-[11px] font-mono text-indigo-300 animate-pulse'
      chipEl.innerHTML = `
        <span class="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-ping"></span>
        <span>Calling MCP: <strong>${escapeHtml(mcpTool.name)}</strong>(${escapeHtml(JSON.stringify(args || {}))})</span>
      `
      chipsContainer.appendChild(chipEl)
      chatMessages.scrollTop = chatMessages.scrollHeight

      try {
        if (!mcpClient) {
          throw new Error('Remote MCP client is not connected')
        }
        const callResult = await mcpClient.callTool({
          name: mcpTool.name,
          arguments: args || {},
        })

        chipEl.classList.remove('animate-pulse')
        chipEl.className = 'flex items-center justify-between px-2.5 py-1 rounded-lg bg-indigo-950/50 border border-indigo-700/50 text-indigo-200 text-[11px] font-mono'
        chipEl.innerHTML = `
          <div class="flex items-center gap-1.5 truncate mr-2">
            <span class="text-indigo-400 font-bold">📡</span>
            <span class="font-semibold text-indigo-300">mcp::${escapeHtml(mcpTool.name)}</span>
            <span class="truncate text-slate-400">(${escapeHtml(JSON.stringify(args || {}))})</span>
          </div>
          <span class="text-[10px] text-emerald-400 font-bold shrink-0">✓ ok</span>
        `

        let resultText = ''
        if (Array.isArray(callResult.content)) {
          resultText = callResult.content.map(c => c.text || JSON.stringify(c)).join('\n')
        }
        else {
          resultText = JSON.stringify(callResult)
        }
        return resultText
      }
      catch (err) {
        chipEl.classList.remove('animate-pulse')
        chipEl.className = 'flex items-center justify-between px-2.5 py-1 rounded-lg bg-rose-950/40 border border-rose-800/40 text-rose-300 text-[11px] font-mono'
        chipEl.innerHTML = `
          <div class="flex items-center gap-1.5 truncate mr-2">
            <span class="text-rose-400 font-bold">✗</span>
            <span>mcp::${escapeHtml(mcpTool.name)} error: ${escapeHtml(err.message)}</span>
          </div>
        `
        return JSON.stringify({ error: err.message })
      }
    },
  }
}

// Chat submission handler
window.handleChatSubmit = async function (e) {
  e.preventDefault()
  const text = chatInput.value.trim()
  if (!text || isAgentStreaming)
    return

  const apiKey = localStorage.getItem('airi_sandbox_api_key') || ''
  if (!apiKey) {
    openSettingsModal()
    return
  }

  chatInput.value = ''
  setStreamingState(true)

  // Append user message to UI
  appendUserBubble(text)
  conversationHistory.push({ role: 'user', content: text })

  // Create assistant placeholder bubble
  const { bubbleEl, contentEl } = createAssistantBubble()

  // Build complete toolset: bashTool + mountWidgetTool + discovered MCP tools
  const bashTool = createBashTool(bubbleEl)
  const mountWidgetTool = createMountWidgetTool(bubbleEl)
  const xsaiMcpTools = discoveredMcpTools.map(t => createXsaiMcpTool(t, bubbleEl))
  const allTools = [bashTool, mountWidgetTool, ...xsaiMcpTools]

  const baseUrl = localStorage.getItem('airi_sandbox_base_url') || 'https://openrouter.ai/api/v1'
  const model = localStorage.getItem('airi_sandbox_model') || 'deepseek/deepseek-v4.1-flash'

  try {
    const provider = createOpenAI(apiKey, baseUrl)
    const chatConfig = provider.chat(model)

    let accumulatedText = ''

    const result = streamText({
      ...chatConfig,
      messages: conversationHistory,
      tools: allTools,
      maxSteps: 12,
      headers: {
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Project AIRI In-Memory Sandbox',
      },
      onEvent(event) {
        if (event.type === 'text-delta') {
          accumulatedText += event.text
          contentEl.innerHTML = marked.parse(accumulatedText)
          chatMessages.scrollTop = chatMessages.scrollHeight
        }
      },
    })

    const updatedMessages = await result.messages
    conversationHistory = updatedMessages

    if (!accumulatedText.trim()) {
      const lastMsg = updatedMessages[updatedMessages.length - 1]
      if (lastMsg && lastMsg.content)
        contentEl.innerHTML = marked.parse(lastMsg.content)
    }
  }
  catch (err) {
    console.error('LLM Dispatch Error:', err)
    contentEl.innerHTML = `
      <div class="p-3 rounded-lg bg-rose-950/60 border border-rose-800/80 text-rose-200 text-xs space-y-1.5">
        <div class="font-semibold flex items-center gap-1.5">
          <span>⚠️ Inference Error</span>
        </div>
        <p class="text-rose-300 font-mono text-[11px]">${escapeHtml(err.message || String(err))}</p>
        <div class="pt-1">
          <button onclick="openSettingsModal()" class="px-2.5 py-1 rounded bg-rose-900/60 hover:bg-rose-800 text-[11px] text-white border border-rose-700 cursor-pointer">
            Review Settings & API Key
          </button>
        </div>
      </div>
    `
  }
  finally {
    setStreamingState(false)
    chatMessages.scrollTop = chatMessages.scrollHeight
    chatInput.focus()
  }
}

function setStreamingState(streaming) {
  isAgentStreaming = streaming
  chatSubmitBtn.disabled = streaming
  if (streaming) {
    chatSubmitBtn.innerHTML = `
      <svg class="animate-spin -ml-1 mr-1 h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
      <span>Thinking</span>
    `
  }
  else {
    chatSubmitBtn.innerHTML = '<span>Send</span>'
  }
}

function appendUserBubble(text) {
  const userDiv = document.createElement('div')
  userDiv.className = 'flex items-start gap-3 justify-end'
  userDiv.innerHTML = `
    <div class="max-w-[80%] rounded-2xl rounded-tr-sm bg-blue-600 px-4 py-2.5 text-sm text-white shadow-md">
      ${escapeHtml(text)}
    </div>
    <div class="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-medium text-slate-300 shrink-0">
      You
    </div>
  `
  chatMessages.appendChild(userDiv)
  chatMessages.scrollTop = chatMessages.scrollHeight
}

function createAssistantBubble() {
  const botDiv = document.createElement('div')
  botDiv.className = 'flex items-start gap-3'
  botDiv.innerHTML = `
    <div class="h-8 w-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-xs font-semibold text-white shadow-md shadow-indigo-500/20 shrink-0">
      AI
    </div>
    <div class="max-w-[85%] rounded-2xl rounded-tl-sm bg-slate-800/80 border border-slate-700/50 px-4 py-3 text-sm text-slate-200 shadow-sm space-y-2">
      <!-- Tool chips container -->
      <div class="tool-chips-container space-y-1.5"></div>
      <!-- Markdown text container -->
      <div class="assistant-content prose-chat text-xs leading-relaxed text-slate-200">
        <span class="inline-flex items-center gap-1.5 text-slate-400 italic">
          <span class="h-1.5 w-1.5 rounded-full bg-blue-400 animate-ping"></span>
          Airi is processing...
        </span>
      </div>
    </div>
  `
  chatMessages.appendChild(botDiv)
  chatMessages.scrollTop = chatMessages.scrollHeight
  return {
    bubbleEl: botDiv,
    contentEl: botDiv.querySelector('.assistant-content'),
  }
}

function escapeHtml(str) {
  if (!str)
    return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// Sample Weather Widget Demo Button
window.demoWeatherWidget = async function () {
  const sampleCode = `
export interface WeatherForecastDay {
  day: string;
  temp: string;
  cond: string;
}

export interface WeatherData {
  location: string;
  temperature: number;
  condition: string;
  humidity: number;
  forecast: WeatherForecastDay[];
}

export default function mount(container: HTMLElement, data?: any) {
  const d: WeatherData = data && data.location ? data : {
    location: "Tokyo, Japan",
    temperature: 18,
    condition: "Partly Cloudy",
    humidity: 62,
    forecast: [
      { day: "Tomorrow", temp: "19°C", cond: "Sunny" },
      { day: "Wednesday", temp: "16°C", cond: "Rain" },
      { day: "Thursday", temp: "21°C", cond: "Clear" }
    ]
  };

  container.innerHTML = \`
    <div class="max-w-md mx-auto w-full rounded-2xl bg-gradient-to-br from-indigo-950/90 via-slate-900/90 to-blue-950/80 border border-indigo-500/30 p-6 shadow-2xl backdrop-blur-xl space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <span class="text-[10px] uppercase font-bold tracking-widest text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">Live Forecast</span>
          <h2 class="text-xl font-bold text-white mt-1">\${d.location}</h2>
        </div>
        <div class="text-3xl">⛅</div>
      </div>

      <div class="flex items-baseline justify-between border-y border-slate-800/80 py-4">
        <div>
          <div class="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-300 via-indigo-200 to-white font-mono">
            \${d.temperature}°C
          </div>
          <div class="text-xs text-slate-400 mt-0.5">\${d.condition}</div>
        </div>
        <div class="text-right text-xs text-slate-400 space-y-1">
          <div>Humidity: <span class="font-mono text-slate-200">\${d.humidity}%</span></div>
          <div>Wind: <span class="font-mono text-slate-200">12 km/h</span></div>
        </div>
      </div>

      <div class="space-y-2">
        <div class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">3-Day Forecast</div>
        <div class="grid grid-cols-3 gap-2">
          \${(d.forecast || []).map(f => \`
            <div class="rounded-xl bg-slate-950/60 border border-slate-800/60 p-2.5 text-center">
              <div class="text-[10px] text-slate-400 font-medium">\${f.day}</div>
              <div class="text-xs font-bold text-white font-mono mt-1">\${f.temp}</div>
              <div class="text-[10px] text-indigo-300 mt-0.5">\${f.cond}</div>
            </div>
          \`).join('')}
        </div>
      </div>

      <div class="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500">
        <span>Compiled with tsc-rs (TS 7.1.0-dev)</span>
        <span class="text-emerald-400 font-mono font-medium">● Generative UI</span>
      </div>
    </div>
  \`;
}
`

  try {
    // 1. Write TypeScript file into in-memory filesystem
    await fetch('/api/exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        command: `cat << 'EOF' > /workspace/demo_weather.ts\n${sampleCode}\nEOF\ntsc /workspace/demo_weather.ts`,
      }),
    })

    // 2. Mount compiled JS to canvas
    await mountWidgetToCanvas('/workspace/demo_weather.js', {
      location: 'Tokyo, Japan',
      temperature: 18,
      condition: 'Partly Cloudy',
      humidity: 62,
    })
  }
  catch (err) {
    alert(`Failed to launch demo widget: ${err.message}`)
  }
}

// Auto-initialize on load
window.addEventListener('load', () => {
  loadConfig()
  initMcpClient()
  runHumanCommand('ls -la')
})
