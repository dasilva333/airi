import { storage } from '../storage'

export interface PersistedWidget {
  id: string
  title: string
  path: string
  sourcePath?: string
  sourceCode?: string
  code: string
  target?: 'sidepanel' | 'inline' | 'window'
  isMounted: boolean
  mountedAt: number
  updatedAt: number
}

export const WIDGETS_REGISTRY_KEY = 'local:widgets/registry'

export const widgetsRepo = {
  async getWidgets(): Promise<PersistedWidget[]> {
    const data = await storage.getItemRaw<PersistedWidget[]>(WIDGETS_REGISTRY_KEY)
    return data || []
  },

  async getMountedWidgets(): Promise<PersistedWidget[]> {
    const all = await this.getWidgets()
    return all.filter(w => w.isMounted)
  },

  async saveWidget(widget: PersistedWidget): Promise<void> {
    const all = await this.getWidgets()
    const index = all.findIndex(w => w.id === widget.id || w.path === widget.path)
    if (index >= 0) {
      all[index] = { ...all[index], ...widget, updatedAt: Date.now() }
    }
    else {
      all.push({ ...widget, updatedAt: Date.now() })
    }
    const clean = JSON.parse(JSON.stringify(all))
    await storage.setItemRaw(WIDGETS_REGISTRY_KEY, clean)
  },

  async setMounted(idOrPath: string, isMounted: boolean): Promise<void> {
    const all = await this.getWidgets()
    const found = all.find(w => w.id === idOrPath || w.path === idOrPath)
    if (found) {
      found.isMounted = isMounted
      found.updatedAt = Date.now()
      const clean = JSON.parse(JSON.stringify(all))
      await storage.setItemRaw(WIDGETS_REGISTRY_KEY, clean)
    }
  },

  async removeWidget(idOrPath: string): Promise<void> {
    const all = await this.getWidgets()
    const filtered = all.filter(w => w.id !== idOrPath && w.path !== idOrPath)
    const clean = JSON.parse(JSON.stringify(filtered))
    await storage.setItemRaw(WIDGETS_REGISTRY_KEY, clean)
  },

  async clearMounted(): Promise<void> {
    const all = await this.getWidgets()
    for (const w of all) {
      w.isMounted = false
      w.updatedAt = Date.now()
    }
    const clean = JSON.parse(JSON.stringify(all))
    await storage.setItemRaw(WIDGETS_REGISTRY_KEY, clean)
  },
}
