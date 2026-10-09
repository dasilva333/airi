import type { McpConfigFile, McpServerConfig } from './mcp-tool-bridge'

import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { defineStore } from 'pinia'
import { computed } from 'vue'

export const useMcpWebConfigStore = defineStore('mcp-web-config', () => {
  const config = useLocalStorageManualReset<McpConfigFile>('settings/mcp/config', {
    mcpServers: {},
  })

  const mcpServers = computed(() => config.value?.mcpServers || {})

  async function getConfig(): Promise<McpConfigFile> {
    return {
      mcpServers: { ...config.value?.mcpServers },
    }
  }

  async function updateConfig(partial: Partial<McpConfigFile>): Promise<void> {
    const current = config.value?.mcpServers || {}
    const incoming = partial.mcpServers || {}
    const updated = { ...current }

    for (const [name, serverConfig] of Object.entries(incoming)) {
      if (serverConfig === null || serverConfig === undefined) {
        delete updated[name]
      }
      else {
        updated[name] = serverConfig
      }
    }

    config.value = {
      mcpServers: updated,
    }
  }

  async function setServer(name: string, serverConfig: McpServerConfig): Promise<void> {
    const current = { ...config.value?.mcpServers }
    current[name] = serverConfig
    config.value = { mcpServers: current }
  }

  async function removeServer(name: string): Promise<void> {
    const current = { ...config.value?.mcpServers }
    delete current[name]
    config.value = { mcpServers: current }
  }

  return {
    config,
    mcpServers,
    getConfig,
    updateConfig,
    setServer,
    removeServer,
  }
})
