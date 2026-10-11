import type { CommandLogEntry, ExecResult, MountedWidget, SandboxManager, VirtualFileEntry } from '../libs/sandbox'

import { onMounted, ref } from 'vue'

import { getSandboxManager } from '../libs/sandbox'

export function useSandbox() {
  const sandbox = ref<SandboxManager | null>(null)
  const isReady = ref(false)
  const isExecuting = ref(false)
  const lastResult = ref<ExecResult | null>(null)
  const mountedWidgets = ref<MountedWidget[]>([])
  const commandHistory = ref<CommandLogEntry[]>([])

  async function init() {
    if (sandbox.value)
      return
    const instance = await getSandboxManager()
    sandbox.value = instance
    mountedWidgets.value = instance.mountedWidgets
    commandHistory.value = instance.commandHistory

    instance.onMount(() => {
      mountedWidgets.value = [...instance.mountedWidgets]
    })

    instance.onCommand(() => {
      commandHistory.value = [...instance.commandHistory]
    })

    isReady.value = true
  }

  async function exec(command: string): Promise<ExecResult> {
    await init()
    if (!sandbox.value) {
      throw new Error('Sandbox is not initialized')
    }

    isExecuting.value = true
    try {
      const res = await sandbox.value.exec(command)
      lastResult.value = res
      return res
    }
    finally {
      isExecuting.value = false
    }
  }

  async function readFile(path: string): Promise<string> {
    await init()
    if (!sandbox.value) {
      throw new Error('Sandbox is not initialized')
    }
    return await sandbox.value.readFile(path)
  }

  async function writeFile(path: string, content: string): Promise<void> {
    await init()
    if (!sandbox.value) {
      throw new Error('Sandbox is not initialized')
    }
    await sandbox.value.writeFile(path, content)
  }

  async function listFiles(dir = '/workspace'): Promise<VirtualFileEntry[]> {
    await init()
    if (!sandbox.value)
      return []
    return await sandbox.value.listFiles(dir)
  }

  function clearLogs(): void {
    if (sandbox.value) {
      sandbox.value.clearLogs()
      commandHistory.value = []
    }
  }

  async function reset(): Promise<void> {
    await init()
    if (!sandbox.value)
      return
    await sandbox.value.reset()
    mountedWidgets.value = []
    commandHistory.value = []
    lastResult.value = null
  }

  function unmountWidget(idOrPath: string): void {
    if (sandbox.value) {
      sandbox.value.unmountWidget(idOrPath)
      mountedWidgets.value = [...sandbox.value.mountedWidgets]
    }
  }

  function clearWidgets(): void {
    if (sandbox.value) {
      sandbox.value.clearWidgets()
      mountedWidgets.value = []
    }
  }

  onMounted(() => {
    void init()
  })

  return {
    sandbox,
    isReady,
    isExecuting,
    lastResult,
    mountedWidgets,
    commandHistory,
    exec,
    listFiles,
    clearLogs,
    readFile,
    writeFile,
    reset,
    unmountWidget,
    clearWidgets,
  }
}
