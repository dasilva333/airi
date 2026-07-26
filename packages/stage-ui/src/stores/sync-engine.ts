import localforage from 'localforage'

import { debug } from '@proj-airi/stage-shared'
import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { useBroadcastChannel } from '@vueuse/core'
import { AwsClient } from 'aws4fetch'
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { storage, storageState } from '../database/storage'
import { SERVER_URL } from '../libs/auth'

export interface StorageClient {
  validate: () => Promise<{ success: boolean, error?: string }>
  listFiles: () => Promise<{ success: boolean, files?: Array<{ relPath: string, mtime: number, size: number }>, error?: string }>
  readFile: (relPath: string, encoding?: 'utf-8' | 'base64') => Promise<{ success: boolean, content?: string, error?: string }>
  writeFile: (relPath: string, content: string, encoding?: 'utf-8' | 'base64', append?: boolean) => Promise<{ success: boolean, mtime?: number, error?: string }>
  deleteFile: (relPath: string) => Promise<{ success: boolean, error?: string }>
}

export class ElectronFSClient implements StorageClient {
  private fsBackupPath: string
  private electron: any

  constructor(fsBackupPath: string) {
    this.fsBackupPath = fsBackupPath
    this.electron = (window as any).electron
  }

  private hasElectron(): boolean {
    return Boolean(this.electron?.ipcRenderer)
  }

  async validate(): Promise<{ success: boolean, error?: string }> {
    if (!this.hasElectron()) {
      return { success: false, error: 'File system access is only available in the desktop application.' }
    }
    return await this.electron.ipcRenderer.invoke('byos-fs:validate-path', { path: this.fsBackupPath })
  }

  async listFiles(): Promise<{ success: boolean, files?: Array<{ relPath: string, mtime: number, size: number }>, error?: string }> {
    if (!this.hasElectron()) {
      return { success: false, error: 'File system access is only available in the desktop application.' }
    }
    return await this.electron.ipcRenderer.invoke('byos-fs:list-files', { dir: this.fsBackupPath })
  }

  async readFile(relPath: string, encoding?: 'utf-8' | 'base64'): Promise<{ success: boolean, content?: string, error?: string }> {
    if (!this.hasElectron()) {
      return { success: false, error: 'File system access is only available in the desktop application.' }
    }
    return await this.electron.ipcRenderer.invoke('byos-fs:read-file', { dir: this.fsBackupPath, relPath, encoding })
  }

  async writeFile(relPath: string, content: string, encoding?: 'utf-8' | 'base64', append?: boolean): Promise<{ success: boolean, mtime?: number, error?: string }> {
    if (!this.hasElectron()) {
      return { success: false, error: 'File system access is only available in the desktop application.' }
    }
    return await this.electron.ipcRenderer.invoke('byos-fs:write-file', { dir: this.fsBackupPath, relPath, content, encoding, append })
  }

  async deleteFile(relPath: string): Promise<{ success: boolean, error?: string }> {
    if (!this.hasElectron()) {
      return { success: false, error: 'File system access is only available in the desktop application.' }
    }
    return await this.electron.ipcRenderer.invoke('byos-fs:delete-file', { dir: this.fsBackupPath, relPath })
  }
}

export class S3StorageClient implements StorageClient {
  private endpoint: string
  private bucket: string
  private region: string
  private client: AwsClient

  constructor(endpoint: string, bucket: string, region: string, accessKeyId: string, secretAccessKey: string) {
    this.endpoint = endpoint
    this.bucket = bucket
    this.region = region || 'us-east-1'
    this.client = new AwsClient({
      accessKeyId,
      secretAccessKey,
      region: this.region,
    })
  }

  private getS3Url(relPath: string): string {
    const cleanEndpoint = this.endpoint.replace(/\/+$/, '')
    const cleanPath = relPath.startsWith('/') ? relPath : `/${relPath}`
    if (cleanEndpoint.includes('amazonaws.com')) {
      return `https://${this.bucket}.s3.${this.region}.amazonaws.com${cleanPath}`
    }
    return `${cleanEndpoint}/${this.bucket}${cleanPath}`
  }

  async validate(): Promise<{ success: boolean, error?: string }> {
    try {
      const url = this.getS3Url('.byos-write-test')
      const putRes = await this.client.fetch(url, { method: 'PUT', body: 'test' })
      if (!putRes.ok) {
        return { success: false, error: `S3 PUT failed: ${putRes.status} ${putRes.statusText}` }
      }
      await this.client.fetch(url, { method: 'DELETE' })
      return { success: true }
    }
    catch (err: any) {
      return { success: false, error: err.message || String(err) }
    }
  }

  async listFiles(): Promise<{ success: boolean, files?: Array<{ relPath: string, mtime: number, size: number }>, error?: string }> {
    try {
      let continuationToken: string | null = null
      const files: Array<{ relPath: string, mtime: number, size: number }> = []
      do {
        let url = `${this.getS3Url('')}?list-type=2`
        if (continuationToken) {
          url += `&continuation-token=${encodeURIComponent(continuationToken)}`
        }
        const res = await this.client.fetch(url)
        if (!res.ok) {
          return { success: false, error: `ListObjectsV2 failed: ${res.status} ${res.statusText}` }
        }
        const xmlText = await res.text()
        const xmlDoc = new DOMParser().parseFromString(xmlText, 'text/xml')
        const contents = xmlDoc.getElementsByTagName('Contents')
        for (let i = 0; i < contents.length; i++) {
          const node = contents[i]
          const key = node.getElementsByTagName('Key')[0]?.textContent || ''
          const lastModified = node.getElementsByTagName('LastModified')[0]?.textContent || ''
          const size = Number(node.getElementsByTagName('Size')[0]?.textContent || '0')
          if (key) {
            files.push({
              relPath: key,
              mtime: new Date(lastModified).getTime(),
              size,
            })
          }
        }
        const isTruncated = xmlDoc.getElementsByTagName('IsTruncated')[0]?.textContent === 'true'
        continuationToken = isTruncated ? (xmlDoc.getElementsByTagName('NextContinuationToken')[0]?.textContent || null) : null
      } while (continuationToken)

      return { success: true, files }
    }
    catch (err: any) {
      return { success: false, error: err.message || String(err) }
    }
  }

  async readFile(relPath: string, encoding?: 'utf-8' | 'base64'): Promise<{ success: boolean, content?: string, error?: string }> {
    try {
      const url = this.getS3Url(relPath)
      const res = await this.client.fetch(url)
      if (res.status === 404) {
        return { success: false, error: 'ENOENT' }
      }
      if (!res.ok) {
        return { success: false, error: `S3 GET failed: ${res.status} ${res.statusText}` }
      }

      if (encoding === 'base64') {
        const blob = await res.blob()
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onloadend = () => {
            const result = reader.result as string
            const b64 = result.split(',')[1]
            resolve(b64)
          }
          reader.onerror = reject
          reader.readAsDataURL(blob)
        })
        return { success: true, content: base64 }
      }
      else {
        const text = await res.text()
        return { success: true, content: text }
      }
    }
    catch (err: any) {
      return { success: false, error: err.message || String(err) }
    }
  }

  async writeFile(relPath: string, content: string, encoding?: 'utf-8' | 'base64', append?: boolean): Promise<{ success: boolean, mtime?: number, error?: string }> {
    try {
      const url = this.getS3Url(relPath)
      let body: Blob | string = content
      let contentType = 'application/json'

      if (encoding === 'base64') {
        const binRes = await fetch(`data:application/octet-stream;base64,${content}`)
        body = await binRes.blob()
        contentType = relPath.endsWith('.png') ? 'image/png' : 'application/octet-stream'
      }

      if (append) {
        let existingContent = ''
        const readRes = await this.readFile(relPath)
        if (readRes.success && readRes.content) {
          existingContent = readRes.content
        }
        body = existingContent + content
      }

      const res = await this.client.fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body,
      })
      if (!res.ok) {
        return { success: false, error: `S3 PUT failed: ${res.status} ${res.statusText}` }
      }
      return { success: true, mtime: Date.now() }
    }
    catch (err: any) {
      return { success: false, error: err.message || String(err) }
    }
  }

  async deleteFile(relPath: string): Promise<{ success: boolean, error?: string }> {
    try {
      const url = this.getS3Url(relPath)
      const res = await this.client.fetch(url, { method: 'DELETE' })
      if (!res.ok && res.status !== 404) {
        return { success: false, error: `S3 DELETE failed: ${res.status} ${res.statusText}` }
      }
      return { success: true }
    }
    catch (err: any) {
      return { success: false, error: err.message || String(err) }
    }
  }
}

async function parallelLimit<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
) {
  const promises: Promise<void>[] = []
  const executing = new Set<Promise<void>>()
  for (const item of items) {
    const p = fn(item).finally(() => {
      executing.delete(p)
    })
    promises.push(p)
    executing.add(p)
    if (executing.size >= limit) {
      await Promise.race(executing)
    }
  }
  await Promise.all(promises)
}

export const useSyncEngineStore = defineStore('sync-engine', () => {
  // Sync Configuration State
  const syncEnabled = useLocalStorageManualReset<boolean>('settings/sync/enabled', false)
  const syncInterval = useLocalStorageManualReset<number>('settings/sync/interval', 30) // in minutes
  const conflictStrategy = useLocalStorageManualReset<'lww' | 'remote-wins' | 'local-wins'>('settings/sync/conflict-strategy', 'lww')
  const activeProvider = useLocalStorageManualReset<string>('settings/sync/active-provider', 'local-fs')
  const fsBackupPath = useLocalStorageManualReset<string>('settings/sync/fs-path', '')

  const selectiveSyncEnabled = useLocalStorageManualReset<boolean>('settings/sync/selective-enabled', false)
  const selectiveCheckedIds = useLocalStorageManualReset<string[]>('settings/sync/selective-checked-ids', [])

  // S3 Configuration State
  const s3Endpoint = useLocalStorageManualReset<string>('settings/sync/s3-endpoint', '')
  const s3Bucket = useLocalStorageManualReset<string>('settings/sync/s3-bucket', '')
  const s3Region = useLocalStorageManualReset<string>('settings/sync/s3-region', 'us-east-1')
  const s3AccessKeyId = useLocalStorageManualReset<string>('settings/sync/s3-access-key-id', '')
  const s3SecretAccessKey = useLocalStorageManualReset<string>('settings/sync/s3-secret-access-key', '')

  // Runtime State
  const isSyncing = ref(false)
  const lastSyncTime = ref<number>(Number(localStorage.getItem('settings/sync/last-time') || '0'))
  const syncError = ref('')

  // Check and initialize default OS path if empty
  if (!fsBackupPath.value) {
    const userAgent = navigator.userAgent.toLowerCase()
    if (userAgent.includes('win')) {
      fsBackupPath.value = 'C:\\AIRI-Backup-Share'
    }
    else if (userAgent.includes('linux')) {
      fsBackupPath.value = '/mnt/AIRI-Backup-Share'
    }
    else {
      fsBackupPath.value = '/Volumes/AIRI-Backup-Share'
    }
  }

  // Helper to get active client
  function getActiveClient(): StorageClient {
    if (activeProvider.value === 's3') {
      return new S3StorageClient(
        s3Endpoint.value,
        s3Bucket.value,
        s3Region.value,
        s3AccessKeyId.value,
        s3SecretAccessKey.value,
      )
    }
    return new ElectronFSClient(fsBackupPath.value)
  }

  // Helper to call Electron IPC
  const electron = (window as any).electron

  function hasElectron(): boolean {
    return Boolean(electron?.ipcRenderer)
  }

  async function validateConnection(provider?: string): Promise<{ success: boolean, error?: string }> {
    const targetProvider = provider || activeProvider.value
    let client: StorageClient
    if (targetProvider === 's3') {
      client = new S3StorageClient(
        s3Endpoint.value,
        s3Bucket.value,
        s3Region.value,
        s3AccessKeyId.value,
        s3SecretAccessKey.value,
      )
    }
    else {
      client = new ElectronFSClient(fsBackupPath.value)
    }
    return await client.validate()
  }

  async function validatePath(path: string): Promise<{ success: boolean, error?: string }> {
    const client = new ElectronFSClient(path)
    return await client.validate()
  }

  async function getRemoteCatalog() {
    const client = getActiveClient()
    const listRes = await client.listFiles()
    if (!listRes.success) {
      return { success: false, error: listRes.error || 'Failed to list remote files' }
    }
    const remoteFiles = listRes.files || []

    // Read remote cards
    let cards: [string, any][] = []
    try {
      const cardsRes = await client.readFile('db/airi-cards.json')
      if (cardsRes.success && cardsRes.content) {
        cards = JSON.parse(cardsRes.content)
      }
    }
    catch (e) {
      debug('[SyncEngine] Failed to read remote airi-cards:', e)
    }

    // Read remote display models manifest
    let models: any[] = []
    try {
      const modelsRes = await client.readFile('assets/models/manifest.json')
      if (modelsRes.success && modelsRes.content) {
        const manifest = JSON.parse(modelsRes.content)
        models = Object.values(manifest.models || {})
      }
    }
    catch (e) {
      debug('[SyncEngine] Failed to read remote display models manifest:', e)
    }

    // Read remote backgrounds metadata
    const backgrounds: any[] = []
    const bgJsonFiles = remoteFiles.filter(f =>
      f.relPath.replace(/\\/g, '/').startsWith('assets/backgrounds/')
      && f.relPath.endsWith('.json'),
    )
    if (bgJsonFiles.length > 0) {
      await Promise.all(bgJsonFiles.map(async (file) => {
        try {
          const readRes = await client.readFile(file.relPath)
          if (readRes.success && readRes.content) {
            const meta = JSON.parse(readRes.content)
            const pngPath = file.relPath.replace(/\.json$/, '.png')
            const pngFile = remoteFiles.find(rf => rf.relPath === pngPath)
            backgrounds.push({
              id: file.relPath.split('/').pop()?.replace(/\.json$/, '') || '',
              ...meta,
              sizeBytes: pngFile?.size || 0,
            })
          }
        }
        catch (e) {
          debug('[SyncEngine] Failed to read remote background json:', file.relPath, e)
        }
      }))
    }

    // Read remote custom VMD motions manifest
    let vmds: any[] = []
    try {
      const vmdsRes = await client.readFile('assets/mmd/manifest.json')
      if (vmdsRes.success && vmdsRes.content) {
        const manifest = JSON.parse(vmdsRes.content)
        vmds = Object.values(manifest.motions || {})
      }
    }
    catch (e) {
      debug('[SyncEngine] Failed to read remote MMD motions manifest:', e)
    }

    // Read remote custom VRMA animations manifest
    let vrmas: any[] = []
    try {
      const vrmasRes = await client.readFile('assets/vrma/manifest.json')
      if (vrmasRes.success && vrmasRes.content) {
        const manifest = JSON.parse(vrmasRes.content)
        vrmas = Object.values(manifest.animations || {})
      }
    }
    catch (e) {
      debug('[SyncEngine] Failed to read remote VRMA animations manifest:', e)
    }

    return {
      success: true,
      remoteFiles,
      cards,
      models,
      backgrounds,
      vmds,
      vrmas,
    }
  }

  async function downloadSpecificModel(id: string) {
    const client = getActiveClient()
    // Read remote manifest
    let remoteModel: any = null
    try {
      const modelsRes = await client.readFile('assets/models/manifest.json')
      if (modelsRes.success && modelsRes.content) {
        const manifest = JSON.parse(modelsRes.content)
        remoteModel = manifest.models?.[id]
      }
    }
    catch (e) {
      console.error('[SyncEngine] Failed to read remote manifest for specific model:', e)
      return { success: false, error: 'Failed to read remote manifest' }
    }

    if (!remoteModel) {
      return { success: false, error: `Model ${id} not found in remote manifest` }
    }

    try {
      debug(`[SyncEngine] Targeted download for model: ${id} (${remoteModel.name})`)
      const readBinRes = await client.readFile(`assets/models/${id}.bin`, 'base64')
      if (!readBinRes.success || !readBinRes.content) {
        return { success: false, error: readBinRes.error || 'Failed to read model binary' }
      }

      // Reconstruct File object
      const mimeType = 'application/octet-stream'
      const binRes = await fetch(`data:${mimeType};base64,${readBinRes.content}`)
      const blob = await binRes.blob()
      const fileObj = new File([blob], remoteModel.name, { type: mimeType })

      // Download preview sidecar if present
      let previewImage: string | undefined
      if (remoteModel.hasPreview) {
        debug(`[SyncEngine] Downloading model preview: ${id}`)
        const readPreviewRes = await client.readFile(`assets/models/${id}-preview.png`, 'base64')
        if (readPreviewRes.success && readPreviewRes.content) {
          previewImage = `data:image/png;base64,${readPreviewRes.content}`
        }
      }

      const entry: any = {
        id,
        format: remoteModel.format,
        type: 'file',
        file: fileObj,
        name: remoteModel.name,
        previewImage,
        importedAt: remoteModel.importedAt,
        nsfw: remoteModel.nsfw,
        groups: remoteModel.groups,
        tags: remoteModel.tags,
        expressions: remoteModel.expressions,
        motions: remoteModel.motions,
        emotionMappings: remoteModel.emotionMappings,
        motionMappings: remoteModel.motionMappings,
        hiddenExpressions: remoteModel.hiddenExpressions,
        hiddenMotions: remoteModel.hiddenMotions,
        favoriteExpressions: remoteModel.favoriteExpressions,
      }

      await localforage.setItem(id, entry)

      // Download textures if present
      if (remoteModel.hasTextures) {
        const readTexRes = await client.readFile(`assets/models/${id}-textures.json`)
        if (readTexRes.success && readTexRes.content) {
          const texturesData = JSON.parse(readTexRes.content)
          const textures: any[] = []
          for (const tex of texturesData) {
            const texMime = tex.type || 'image/png'
            const texRes = await fetch(`data:${texMime};base64,${tex.base64}`)
            const texBlob = await texRes.blob()
            const texFile = new File([texBlob], tex.name, { type: texMime })
            textures.push({
              relativePath: tex.relativePath,
              file: texFile,
            })
          }
          await localforage.setItem(`${id}-textures`, textures)
        }
      }

      // If selective sync is active, make sure this model is checked so it doesn't get evicted/skipped in future syncs
      if (selectiveSyncEnabled.value) {
        const modelNodeId = `model-${id}`
        if (!selectiveCheckedIds.value.includes(modelNodeId)) {
          selectiveCheckedIds.value.push(modelNodeId)
        }
      }

      // Reload local display models store
      const { useDisplayModelsStore } = await import('./display-models')
      const displayModelStore = useDisplayModelsStore()
      await displayModelStore.loadDisplayModelsFromIndexedDB(true)

      // Broadcast changes so other windows sync
      displayModelStore.broadcastModelsSync(Date.now())

      return { success: true }
    }
    catch (e: any) {
      console.error('[SyncEngine] Error during targeted model download:', e)
      return { success: false, error: e.message || 'Error occurred during download' }
    }
  }

  async function readRemoteFile(relPath: string, encoding?: 'utf-8' | 'base64') {
    const client = getActiveClient()
    return await client.readFile(relPath, encoding)
  }

  function normalizeStorageKey(fullKey: string): string | null {
    if (fullKey.startsWith('local:airi-sync-queue:') || fullKey.startsWith('local:airi-sync-queue/'))
      return null
    if (fullKey.startsWith('outbox:airi-local:') || fullKey.startsWith('outbox:airi-local/'))
      return null

    if (fullKey.startsWith('local:airi-local:')) {
      const relative = fullKey.substring('local:airi-local:'.length)
      return `local:${relative.replace(/:/g, '/')}`
    }
    if (fullKey.startsWith('local:')) {
      const relative = fullKey.substring('local:'.length)
      return `local:${relative.replace(/:/g, '/')}`
    }
    if (fullKey.startsWith('outbox:airi-sync-queue:')) {
      const relative = fullKey.substring('outbox:airi-sync-queue:'.length)
      return `outbox:${relative.replace(/:/g, '/')}`
    }
    if (fullKey.startsWith('outbox:')) {
      const relative = fullKey.substring('outbox:'.length)
      return `outbox:${relative.replace(/:/g, '/')}`
    }
    return null
  }

  // Convert storage key to relative path on disk (e.g. local:chat/sessions/123 -> db/chat/sessions/123.json)
  function getRelPathForKey(key: string): string {
    const cleanKey = key.replace(/^local:/, '')
    // Replace colons with slashes to create nested directories, avoiding Windows filename colon restrictions
    return `db/${cleanKey.replace(/:/g, '/')}.json`
  }

  const { post: broadcastBgSync } = useBroadcastChannel({ name: 'airi:background-sync' })
  const { post: broadcastReload } = useBroadcastChannel({ name: 'airi:store-reload' })

  function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result as string
        const base64 = result.split(',')[1]
        resolve(base64)
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  async function reconcileBackgrounds(): Promise<void> {
    debug('[SyncEngine] Reconciling backgrounds...')
    const quotaCheck = await checkQuotaLimit()
    if (!quotaCheck.safe) {
      debug('[SyncEngine] reconcileBackgrounds aborted:', quotaCheck.reason)
      return
    }
    await logDebug('Starting reconcileBackgrounds()')
    try {
      const client = getActiveClient()
      // 1. Get list of deleted background IDs from sync metadata
      const rawLocalKeys = await storage.getKeys('local')
      const localKeys = rawLocalKeys.map(normalizeStorageKey).filter((k): k is string => k !== null)
      const deletedBgIds = new Set<string>()
      const DELETED_PREFIX = 'local:sync-metadata/deleted-backgrounds/'
      for (const k of localKeys) {
        if (k.startsWith(DELETED_PREFIX)) {
          deletedBgIds.add(k.substring(DELETED_PREFIX.length))
        }
      }
      await logDebug(`deletedBgIds size: ${deletedBgIds.size}`)

      // 2. List all remote files to find backgrounds
      const listRes = await client.listFiles()
      if (!listRes.success) {
        await logDebug(`Failed to list remote files: ${listRes.error}`)
        return
      }

      const remoteFiles = (listRes.files || []) as Array<{ relPath: string, mtime: number, size: number }>
      const remoteBgs = new Map<string, { json?: string, png?: string }>()
      for (const file of remoteFiles) {
        const normalizedPath = file.relPath.replace(/\\/g, '/')
        if (normalizedPath.startsWith('assets/backgrounds/')) {
          const base = normalizedPath.substring('assets/backgrounds/'.length)
          const ext = base.split('.').pop()
          const id = base.substring(0, base.length - (ext ? ext.length + 1 : 0))
          if (!id)
            continue
          if (!remoteBgs.has(id)) {
            remoteBgs.set(id, {})
          }
          if (ext === 'json')
            remoteBgs.get(id)!.json = file.relPath
          if (ext === 'png')
            remoteBgs.get(id)!.png = file.relPath
        }
      }
      await logDebug(`remoteBgs size: ${remoteBgs.size}`)

      // 3. Process deletions (both remote and local)
      for (const id of deletedBgIds) {
        const remoteInfo = remoteBgs.get(id)
        if (remoteInfo) {
          if (remoteInfo.json) {
            await client.deleteFile(remoteInfo.json)
          }
          if (remoteInfo.png) {
            await client.deleteFile(remoteInfo.png)
          }
        }
        await localforage.removeItem(id)
      }

      // 4. Load all local backgrounds from localforage
      const localBgs = new Map<string, any>()
      const keys549 = await localforage.keys()
      const bgKeys549 = keys549.filter(key => key.startsWith('bg-') && !deletedBgIds.has(key))
      for (const key of bgKeys549) {
        const val = await localforage.getItem<any>(key)
        if (val) {
          localBgs.set(key, val)
        }
      }
      await logDebug(`localBgs size (before uploads/downloads): ${localBgs.size}`)

      // 5. Upload backgrounds present locally but missing/incomplete on remote
      for (const [id, entry] of localBgs.entries()) {
        if (selectiveSyncEnabled.value) {
          const charId = entry.characterId || 'shared'
          const bundleId = charId === 'shared' ? 'bg-char-shared' : `bg-char-${charId}`
          if (!selectiveCheckedIds.value.includes(bundleId)) {
            await logDebug(`Skipping upload of background ${id} because its bundle ${bundleId} is not selected in selective sync.`)
            continue
          }
        }
        const remoteInfo = remoteBgs.get(id)
        if (!remoteInfo || !remoteInfo.png || !remoteInfo.json) {
          await logDebug(`Uploading background to remote: ${id} (title: ${entry.title}, characterId: ${entry.characterId})`)
          const { blob, ...metadata } = entry
          const jsonRelPath = `assets/backgrounds/${id}.json`
          await client.writeFile(jsonRelPath, JSON.stringify(metadata, null, 2))

          if (blob instanceof Blob) {
            const base64 = await blobToBase64(blob)
            const pngRelPath = `assets/backgrounds/${id}.png`
            await client.writeFile(pngRelPath, base64, 'base64')
          }
          else {
            await logDebug(`Warning: background ${id} has no valid Blob object locally.`)
          }
        }
      }

      // 6. Download backgrounds present on remote but missing locally
      let hasDownloads = false
      for (const [id, remoteInfo] of remoteBgs.entries()) {
        if (deletedBgIds.has(id))
          continue
        const localEntry = localBgs.get(id)
        const existsLocally = !!(localEntry && localEntry.blob instanceof Blob)

        await logDebug(`Checking background ${id}: existsLocally=${existsLocally}, hasJson=${!!remoteInfo.json}, hasPng=${!!remoteInfo.png}`)

        if (!existsLocally && remoteInfo.json && remoteInfo.png) {
          if (selectiveSyncEnabled.value && remoteInfo.json) {
            const readJson = await client.readFile(remoteInfo.json)
            if (readJson.success && readJson.content) {
              const metadata = JSON.parse(readJson.content)
              const charId = metadata.characterId || 'shared'
              const bundleId = charId === 'shared' ? 'bg-char-shared' : `bg-char-${charId}`
              if (!selectiveCheckedIds.value.includes(bundleId)) {
                await logDebug(`Skipping download of background ${id} because its bundle ${bundleId} is not selected in selective sync.`)
                continue
              }
            }
          }
          await logDebug(`Downloading background from remote: ${id}`)
          const readJson = await client.readFile(remoteInfo.json)
          if (!readJson.success || !readJson.content) {
            await logDebug(`Failed to read remote JSON for ${id}: ${readJson.error}`)
            continue
          }
          const metadata = JSON.parse(readJson.content)

          const readPng = await client.readFile(remoteInfo.png, 'base64')
          if (!readPng.success || !readPng.content) {
            await logDebug(`Failed to read remote PNG for ${id}: ${readPng.error}`)
            continue
          }

          const mimeType = 'image/png'
          const res = await fetch(`data:${mimeType};base64,${readPng.content}`)
          const blob = await res.blob()

          const entry = {
            ...metadata,
            id,
            blob,
          }

          await localforage.setItem(id, entry)
          await logDebug(`Successfully saved downloaded background ${id} (title: ${entry.title}, characterId: ${entry.characterId}) to localforage.`)
          hasDownloads = true
        }
      }

      if (hasDownloads) {
        broadcastBgSync(Date.now())
        try {
          const { useBackgroundStore } = await import('./background')
          const bgStore = useBackgroundStore()
          await bgStore.initializeStore()
        }
        catch (e) {
          console.error('[SyncEngine] Failed to refresh background store:', e)
        }
      }
      await logDebug('Finished reconcileBackgrounds()')
    }
    catch (err: any) {
      await logDebug(`Error in reconcileBackgrounds(): ${err.message || err}`)
      throw err
    }
  }

  async function reconcileModels(): Promise<void> {
    debug('[SyncEngine] Reconciling models...')
    const quotaCheck = await checkQuotaLimit()
    if (!quotaCheck.safe) {
      debug('[SyncEngine] reconcileModels aborted:', quotaCheck.reason)
      return
    }
    let hasLocalMetadataChanges = false
    try {
      const client = getActiveClient()
      // 1. Get list of deleted model IDs from sync metadata
      const rawLocalKeys = await storage.getKeys('local')
      const localKeys = rawLocalKeys.map(normalizeStorageKey).filter((k): k is string => k !== null)
      const deletedModelIds = new Set<string>()
      const DELETED_PREFIX = 'local:sync-metadata/deleted-models/'
      for (const k of localKeys) {
        if (k.startsWith(DELETED_PREFIX)) {
          deletedModelIds.add(k.substring(DELETED_PREFIX.length))
        }
      }

      // 2. Read remote manifest
      let manifest: {
        models: Record<string, {
          id: string
          format: string
          name: string
          importedAt: number
          previewImage?: string
          hasTextures: boolean
          hasPreview?: boolean
          nsfw?: boolean
          groups?: string[]
          tags?: string[]
          expressions?: string[]
          motions?: string[]
          emotionMappings?: Record<string, string>
          motionMappings?: Record<string, string>
          hiddenExpressions?: string[]
          hiddenMotions?: string[]
          favoriteExpressions?: string[]
        }>
        deleted?: string[]
      } = { models: {}, deleted: [] }
      try {
        const readRes = await client.readFile('assets/models/manifest.json')
        if (readRes.success && readRes.content) {
          manifest = JSON.parse(readRes.content)
          if (!manifest.deleted) {
            manifest.deleted = []
          }
        }
      }
      catch (e) {
        debug('[SyncEngine] Failed to read remote model manifest or it does not exist, initializing new manifest.', e)
      }

      let manifestModified = false

      // Migration: convert inline previewImage strings to sidecar files to shrink bloated manifest.json
      for (const [id, remoteModel] of Object.entries(manifest.models)) {
        if (remoteModel.previewImage && typeof remoteModel.previewImage === 'string' && remoteModel.previewImage.startsWith('data:')) {
          debug(`[SyncEngine] Migrating bloated previewImage in manifest to sidecar for: ${id}`)
          const parts = remoteModel.previewImage.split(',')
          const base64 = parts[1]
          if (base64) {
            const previewRelPath = `assets/models/${id}-preview.png`
            const uploadRes = await client.writeFile(previewRelPath, base64, 'base64')
            if (uploadRes.success) {
              remoteModel.hasPreview = true
            }
          }
          delete remoteModel.previewImage
          manifestModified = true
        }
      }

      // 3. Process deletions (both remote and local)
      for (const id of deletedModelIds) {
        if (!manifest.deleted) {
          manifest.deleted = []
        }
        if (!manifest.deleted.includes(id)) {
          manifest.deleted.push(id)
          manifestModified = true
        }
        if (manifest.models[id]) {
          debug(`[SyncEngine] Deleting remote model assets for: ${id}`)
          await client.deleteFile(`assets/models/${id}.bin`)
          if (manifest.models[id].hasTextures) {
            await client.deleteFile(`assets/models/${id}-textures.json`)
          }
          if (manifest.models[id].hasPreview) {
            await client.deleteFile(`assets/models/${id}-preview.png`)
          }
          delete manifest.models[id]
          manifestModified = true
        }
        await localforage.removeItem(id)
        await localforage.removeItem(`${id}-textures`)
        await storage.removeItem(`local:sync-metadata/timestamps/${id}`)
        await storage.removeItem(`local:sync-metadata/deleted-models/${id}`)
      }

      // 4. Load all local models from localforage (excluding presets & deleted models)
      const localModels = new Map<string, any>()
      const keys755 = await localforage.keys()
      const modelKeys755 = keys755.filter(key => key.startsWith('display-model-') && !key.endsWith('-textures') && !deletedModelIds.has(key))
      for (const key of modelKeys755) {
        const val = await localforage.getItem<any>(key)
        if (val) {
          localModels.set(key, val)
        }
      }

      // 4.5 Auto-extract missing capabilities (expressions/motions) only for active models
      try {
        // Collect model IDs referenced by cards
        const referencedModelIds = new Set<string>()
        const cardsVal = await storage.getItemRaw<any>('local:airi-cards')
        if (cardsVal) {
          const parsedCards = Array.isArray(cardsVal) ? cardsVal : Object.entries(cardsVal)
          for (const item of parsedCards) {
            const card = Array.isArray(item) ? item[1] : item
            const displayModelId = card?.extensions?.airi?.modules?.displayModelId
            if (displayModelId) {
              referencedModelIds.add(displayModelId)
            }
          }
        }

        const { useDisplayModelsStore } = await import('./display-models')
        const displayModelsStore = useDisplayModelsStore()

        for (const [id, val] of localModels.entries()) {
          // Skip capabilities extraction for models that are not actively used by any cards
          if (!referencedModelIds.has(id)) {
            continue
          }

          const hasExpressions = val.expressions && val.expressions.length > 0
          const hasMotions = val.motions && val.motions.length > 0
          if (!hasExpressions || !hasMotions) {
            debug(`[SyncEngine] Extracting missing capabilities for active model: ${id} (${val.name})`)
            const caps = await displayModelsStore.getOrLoadModelCapabilities(id)
            if (caps) {
              const updatedVal = await localforage.getItem<any>(id)
              if (updatedVal) {
                localModels.set(id, updatedVal)
              }
            }
          }
        }
      }
      catch (e) {
        console.error('[SyncEngine] Error in model capabilities auto-extraction:', e)
      }

      // 5. Upload local-only models (not in remote manifest and not in local deleted list)
      for (const [id, entry] of localModels.entries()) {
        if (manifest.deleted && manifest.deleted.includes(id)) {
          debug(`[SyncEngine] Model ${id} (${entry.name}) is marked as deleted remotely. Deleting locally.`)
          await localforage.removeItem(id)
          await localforage.removeItem(`${id}-textures`)
          await storage.removeItem(`local:sync-metadata/timestamps/${id}`)
          continue
        }

        if (selectiveSyncEnabled.value) {
          const modelNodeId = `model-${id}`
          if (!selectiveCheckedIds.value.includes(modelNodeId)) {
            debug(`[SyncEngine] Skipping upload of model ${id} because it is not selected in selective sync.`)
            continue
          }
        }
        if (!manifest.models[id]) {
          debug(`[SyncEngine] Uploading model to remote: ${id} (${entry.name})`)
          if (entry.file instanceof Blob || entry.file instanceof File) {
            const base64 = await blobToBase64(entry.file)
            const binRelPath = `assets/models/${id}.bin`
            const uploadRes = await client.writeFile(binRelPath, base64, 'base64')
            if (!uploadRes.success) {
              console.error(`[SyncEngine] Failed to upload model binary for ${id}:`, uploadRes.error)
              continue
            }
          }
          else {
            debug(`[SyncEngine] Local model ${id} does not contain a valid File/Blob.`, entry)
            continue
          }

          // Check and upload textures if present
          let hasTextures = false
          const textures = await localforage.getItem<any[]>(`${id}-textures`).catch(() => null)
          if (textures && Array.isArray(textures) && textures.length > 0) {
            debug(`[SyncEngine] Uploading textures for model: ${id}`)
            const texturesData = []
            for (const tex of textures) {
              if (tex.file instanceof Blob || tex.file instanceof File) {
                const texBase64 = await blobToBase64(tex.file)
                texturesData.push({
                  relativePath: tex.relativePath,
                  name: tex.file.name,
                  type: tex.file.type,
                  base64: texBase64,
                })
              }
            }
            if (texturesData.length > 0) {
              const texturesRelPath = `assets/models/${id}-textures.json`
              const texUploadRes = await client.writeFile(texturesRelPath, JSON.stringify(texturesData, null, 2))
              if (texUploadRes.success) {
                hasTextures = true
              }
              else {
                console.error(`[SyncEngine] Failed to upload textures for ${id}:`, texUploadRes.error)
              }
            }
          }

          // Check and upload preview image if present
          let hasPreview = false
          if (entry.previewImage && typeof entry.previewImage === 'string' && entry.previewImage.startsWith('data:')) {
            debug(`[SyncEngine] Uploading preview image sidecar for: ${id}`)
            const parts = entry.previewImage.split(',')
            const base64 = parts[1]
            if (base64) {
              const previewRelPath = `assets/models/${id}-preview.png`
              const previewUploadRes = await client.writeFile(previewRelPath, base64, 'base64')
              if (previewUploadRes.success) {
                hasPreview = true
              }
              else {
                console.error(`[SyncEngine] Failed to upload preview for ${id}:`, previewUploadRes.error)
              }
            }
          }

          // Add to manifest
          manifest.models[id] = {
            id,
            format: entry.format,
            name: entry.name || '',
            importedAt: entry.importedAt || Date.now(),
            hasPreview,
            hasTextures,
            nsfw: entry.nsfw,
            groups: entry.groups,
            tags: entry.tags,
            expressions: entry.expressions,
            motions: entry.motions,
            emotionMappings: entry.emotionMappings,
            motionMappings: entry.motionMappings,
            hiddenExpressions: entry.hiddenExpressions,
            hiddenMotions: entry.hiddenMotions,
            favoriteExpressions: entry.favoriteExpressions,
          }
          manifestModified = true

          // Record sync history timestamp
          await storage.setItemRaw(`local:sync-metadata/timestamps/${id}`, Date.now())
        }
      }

      // 5.5 Reconcile metadata for models existing in both local and remote
      for (const [id, localEntry] of localModels.entries()) {
        const remoteEntry = manifest.models[id]
        if (remoteEntry) {
          let localModified = false

          // 1. Merge groups
          const localGroups = localEntry.groups || []
          const remoteGroups = remoteEntry.groups || []
          const hasGroupDiff = JSON.stringify(localGroups) !== JSON.stringify(remoteGroups)

          if (hasGroupDiff) {
            if (conflictStrategy.value === 'local-wins' || (localGroups.length > 0 && remoteGroups.length === 0)) {
              remoteEntry.groups = localGroups
              manifestModified = true
            }
            else if (conflictStrategy.value === 'remote-wins' || (remoteGroups.length > 0 && localGroups.length === 0)) {
              localEntry.groups = remoteGroups
              localModified = true
            }
            else {
              const mergedGroups = Array.from(new Set([...localGroups, ...remoteGroups]))
              remoteEntry.groups = mergedGroups
              localEntry.groups = mergedGroups
              manifestModified = true
              localModified = true
            }
          }

          // 2. Merge nsfw
          if (localEntry.nsfw !== remoteEntry.nsfw) {
            if (conflictStrategy.value === 'local-wins' || (localEntry.nsfw !== undefined && remoteEntry.nsfw === undefined)) {
              remoteEntry.nsfw = localEntry.nsfw
              manifestModified = true
            }
            else if (conflictStrategy.value === 'remote-wins' || (remoteEntry.nsfw !== undefined && localEntry.nsfw === undefined)) {
              localEntry.nsfw = remoteEntry.nsfw
              localModified = true
            }
            else {
              const mergedNsfw = localEntry.nsfw || remoteEntry.nsfw
              remoteEntry.nsfw = mergedNsfw
              localEntry.nsfw = mergedNsfw
              manifestModified = true
              localModified = true
            }
          }

          // 3. Merge name
          if (localEntry.name !== remoteEntry.name && remoteEntry.name) {
            if (conflictStrategy.value === 'local-wins') {
              remoteEntry.name = localEntry.name
              manifestModified = true
            }
            else {
              localEntry.name = remoteEntry.name
              localModified = true
            }
          }

          // 4. Merge tags (union)
          const localTags = localEntry.tags || []
          const remoteTags = remoteEntry.tags || []
          if (JSON.stringify(localTags) !== JSON.stringify(remoteTags)) {
            const mergedTags = Array.from(new Set([...localTags, ...remoteTags]))
            remoteEntry.tags = mergedTags
            localEntry.tags = mergedTags
            manifestModified = true
            localModified = true
          }

          // 5. Merge expressions (union)
          const localExpressions = localEntry.expressions || []
          const remoteExpressions = remoteEntry.expressions || []
          if (JSON.stringify(localExpressions) !== JSON.stringify(remoteExpressions)) {
            const mergedExpressions = Array.from(new Set([...localExpressions, ...remoteExpressions]))
            remoteEntry.expressions = mergedExpressions
            localEntry.expressions = mergedExpressions
            manifestModified = true
            localModified = true
          }

          // 6. Merge motions (union)
          const localMotions = localEntry.motions || []
          const remoteMotions = remoteEntry.motions || []
          if (JSON.stringify(localMotions) !== JSON.stringify(remoteMotions)) {
            const mergedMotions = Array.from(new Set([...localMotions, ...remoteMotions]))
            remoteEntry.motions = mergedMotions
            localEntry.motions = mergedMotions
            manifestModified = true
            localModified = true
          }

          // 7. Merge emotionMappings (map merge)
          const localEmotionMappings = localEntry.emotionMappings || {}
          const remoteEmotionMappings = remoteEntry.emotionMappings || {}
          if (JSON.stringify(localEmotionMappings) !== JSON.stringify(remoteEmotionMappings)) {
            const mergedEmotionMappings = { ...remoteEmotionMappings, ...localEmotionMappings }
            remoteEntry.emotionMappings = mergedEmotionMappings
            localEntry.emotionMappings = mergedEmotionMappings
            manifestModified = true
            localModified = true
          }

          // 8. Merge motionMappings (map merge)
          const localMotionMappings = localEntry.motionMappings || {}
          const remoteMotionMappings = remoteEntry.motionMappings || {}
          if (JSON.stringify(localMotionMappings) !== JSON.stringify(remoteMotionMappings)) {
            const mergedMotionMappings = { ...remoteMotionMappings, ...localMotionMappings }
            remoteEntry.motionMappings = mergedMotionMappings
            localEntry.motionMappings = mergedMotionMappings
            manifestModified = true
            localModified = true
          }

          // 9. Merge hiddenExpressions (union)
          const localHiddenExpressions = localEntry.hiddenExpressions || []
          const remoteHiddenExpressions = remoteEntry.hiddenExpressions || []
          if (JSON.stringify(localHiddenExpressions) !== JSON.stringify(remoteHiddenExpressions)) {
            const mergedHiddenExpressions = Array.from(new Set([...localHiddenExpressions, ...remoteHiddenExpressions]))
            remoteEntry.hiddenExpressions = mergedHiddenExpressions
            localEntry.hiddenExpressions = mergedHiddenExpressions
            manifestModified = true
            localModified = true
          }

          // 10. Merge hiddenMotions (union)
          const localHiddenMotions = localEntry.hiddenMotions || []
          const remoteHiddenMotions = remoteEntry.hiddenMotions || []
          if (JSON.stringify(localHiddenMotions) !== JSON.stringify(remoteHiddenMotions)) {
            const mergedHiddenMotions = Array.from(new Set([...localHiddenMotions, ...remoteHiddenMotions]))
            remoteEntry.hiddenMotions = mergedHiddenMotions
            localEntry.hiddenMotions = mergedHiddenMotions
            manifestModified = true
            localModified = true
          }

          // 11. Merge favoriteExpressions (union)
          const localFavExpressions = localEntry.favoriteExpressions || []
          const remoteFavExpressions = remoteEntry.favoriteExpressions || []
          if (JSON.stringify(localFavExpressions) !== JSON.stringify(remoteFavExpressions)) {
            const mergedFavExpressions = Array.from(new Set([...localFavExpressions, ...remoteFavExpressions]))
            remoteEntry.favoriteExpressions = mergedFavExpressions
            localEntry.favoriteExpressions = mergedFavExpressions
            manifestModified = true
            localModified = true
          }

          if (localModified) {
            debug(`[SyncEngine] Updating local display model metadata for: ${id}`)
            await localforage.setItem(id, localEntry)
            hasLocalMetadataChanges = true
          }
        }
      }

      // 6. Download remote-only models (in remote manifest but missing locally)
      let hasDownloads = false
      for (const [id, remoteModel] of Object.entries(manifest.models)) {
        if (deletedModelIds.has(id))
          continue
        if (!localModels.has(id)) {
          if (selectiveSyncEnabled.value) {
            const modelNodeId = `model-${id}`
            if (!selectiveCheckedIds.value.includes(modelNodeId)) {
              debug(`[SyncEngine] Skipping download of model ${id} because it is not selected in selective sync.`)
              continue
            }
          }
          debug(`[SyncEngine] Downloading model from remote: ${id} (${remoteModel.name})`)
          const readBinRes = await client.readFile(`assets/models/${id}.bin`, 'base64')
          if (!readBinRes.success || !readBinRes.content) {
            console.error(`[SyncEngine] Failed to read remote model binary for ${id}:`, readBinRes.error)
            if (readBinRes.error?.includes('ENOENT')) {
              debug(`[SyncEngine] Remote model binary for ${id} is missing on storage. Removing from manifest.`)
              delete manifest.models[id]
              manifestModified = true
            }
            continue
          }

          // Reconstruct File object
          const mimeType = 'application/octet-stream'
          const res = await fetch(`data:${mimeType};base64,${readBinRes.content}`)
          const blob = await res.blob()
          const fileObj = new File([blob], remoteModel.name, { type: mimeType })

          // Download preview sidecar if present
          let previewImage: string | undefined
          if (remoteModel.hasPreview) {
            debug(`[SyncEngine] Downloading model preview: ${id}`)
            const readPreviewRes = await client.readFile(`assets/models/${id}-preview.png`, 'base64')
            if (readPreviewRes.success && readPreviewRes.content) {
              previewImage = `data:image/png;base64,${readPreviewRes.content}`
            }
          }

          const entry = {
            id,
            format: remoteModel.format,
            type: 'file',
            file: fileObj,
            name: remoteModel.name,
            previewImage,
            importedAt: remoteModel.importedAt,
            nsfw: remoteModel.nsfw,
            groups: remoteModel.groups,
          }

          await localforage.setItem(id, entry)

          // Download textures if present
          if (remoteModel.hasTextures) {
            const readTexRes = await client.readFile(`assets/models/${id}-textures.json`)
            if (readTexRes.success && readTexRes.content) {
              const texturesData = JSON.parse(readTexRes.content)
              const textures: any[] = []
              for (const tex of texturesData) {
                const texMime = tex.type || 'image/png'
                const texRes = await fetch(`data:${texMime};base64,${tex.base64}`)
                const texBlob = await texRes.blob()
                const texFile = new File([texBlob], tex.name, { type: texMime })
                textures.push({
                  relativePath: tex.relativePath,
                  file: texFile,
                })
              }
              await localforage.setItem(`${id}-textures`, textures)
            }
          }

          // Record sync history timestamp
          await storage.setItemRaw(`local:sync-metadata/timestamps/${id}`, Date.now())
          hasDownloads = true
        }
      }

      // Write updated manifest to remote
      if (manifestModified) {
        debug('[SyncEngine] Writing updated model manifest to remote.')
        await client.writeFile('assets/models/manifest.json', JSON.stringify(manifest, null, 2))
      }

      if (hasDownloads || hasLocalMetadataChanges) {
        try {
          const { useDisplayModelsStore } = await import('./display-models')
          const modelStore = useDisplayModelsStore()
          await modelStore.loadDisplayModelsFromIndexedDB()
        }
        catch (e) {
          console.error('[SyncEngine] Failed to refresh display models store:', e)
        }
      }
    }
    catch (err) {
      console.error('[SyncEngine] Model reconciliation error:', err)
    }
  }

  async function reconcileMmdMotions(): Promise<void> {
    debug('[SyncEngine] Reconciling MMD motions...')
    const quotaCheck = await checkQuotaLimit()
    if (!quotaCheck.safe) {
      debug('[SyncEngine] reconcileMmdMotions aborted:', quotaCheck.reason)
      return
    }
    try {
      const client = getActiveClient()

      // 1. Load deleted IDs from localStorage
      const deletedMotionsStr = localStorage.getItem('settings/mmd/deleted-motions') || '[]'
      const deletedMotionIds = new Set<string>(JSON.parse(deletedMotionsStr))

      // 2. Read remote manifest
      let manifest: {
        motions: Record<string, { id: string, name: string, importedAt: number }>
        deleted?: string[]
      } = { motions: {}, deleted: [] }
      let manifestExists = false
      let remoteManifestMtime = 0
      try {
        const readRes = await client.readFile('assets/mmd/manifest.json')
        if (readRes.success && readRes.content) {
          manifest = JSON.parse(readRes.content)
          if (!manifest.deleted) {
            manifest.deleted = []
          }
          manifestExists = true
        }

        const listRes = await client.listFiles()
        if (listRes.success && listRes.files) {
          const manifestFile = listRes.files.find(f => f.relPath.replace(/\\/g, '/') === 'assets/mmd/manifest.json')
          if (manifestFile) {
            remoteManifestMtime = manifestFile.mtime
          }
        }
      }
      catch (e) {
        debug('[SyncEngine] Failed to read remote MMD manifest, initializing new manifest.', e)
      }

      let manifestModified = false

      // 3. Process deletions (both remote and local)
      for (const id of deletedMotionIds) {
        if (!manifest.deleted) {
          manifest.deleted = []
        }
        if (!manifest.deleted.includes(id)) {
          manifest.deleted.push(id)
          manifestModified = true
        }
        if (manifest.motions[id]) {
          debug(`[SyncEngine] Deleting remote custom VMD motion: ${id}`)
          await client.deleteFile(`assets/mmd/animations/${id}.bin`)
          delete manifest.motions[id]
          manifestModified = true
        }
        await localforage.removeItem(id)
        await storage.removeItem(`local:sync-metadata/timestamps/${id}`)
      }

      // 4. Load local custom motions (keys starting with `mmd-motion-` and not deleted)
      const localMotions = new Map<string, any>()
      const keys1144 = await localforage.keys()
      const motionKeys1144 = keys1144.filter(key => key.startsWith('mmd-motion-') && !deletedMotionIds.has(key))
      for (const key of motionKeys1144) {
        const val = await localforage.getItem<any>(key)
        if (val) {
          localMotions.set(key, val)
        }
      }

      // 5. Upload local-only motions to remote
      for (const [id, entry] of localMotions.entries()) {
        if (manifest.deleted && manifest.deleted.includes(id)) {
          debug(`[SyncEngine] VMD motion ${id} (${entry.name}) is marked as deleted remotely. Deleting locally.`)
          await localforage.removeItem(id)
          await storage.removeItem(`local:sync-metadata/timestamps/${id}`)
          continue
        }

        if (selectiveSyncEnabled.value) {
          const nodeId = `vmd-${id}`
          if (!selectiveCheckedIds.value.includes(nodeId)) {
            debug(`[SyncEngine] Skipping upload of VMD motion ${id} because it is not selected in selective sync.`)
            continue
          }
        }

        if (!manifest.motions[id]) {
          const hasSyncHistory = await storage.getItemRaw<number>(`local:sync-metadata/timestamps/${id}`)
          const isStaleManifest = remoteManifestMtime > 0 && hasSyncHistory && hasSyncHistory > remoteManifestMtime

          if (hasSyncHistory && manifestExists && !isStaleManifest) {
            debug(`[SyncEngine] VMD motion ${id} (${entry.name}) has sync history but is missing from remote manifest. Deleting locally.`)
            await localforage.removeItem(id)
            await storage.removeItem(`local:sync-metadata/timestamps/${id}`)
            continue
          }

          debug(`[SyncEngine] Uploading VMD motion to remote: ${id} (${entry.name})`)
          if (entry.file instanceof Blob || entry.file instanceof File) {
            const base64 = await blobToBase64(entry.file)
            const binRelPath = `assets/mmd/animations/${id}.bin`
            const uploadRes = await client.writeFile(binRelPath, base64, 'base64')
            if (!uploadRes.success) {
              console.error(`[SyncEngine] Failed to upload VMD binary for ${id}:`, uploadRes.error)
              continue
            }
          }
          else {
            debug(`[SyncEngine] Local VMD motion ${id} does not contain a valid File/Blob.`, entry)
            continue
          }

          manifest.motions[id] = {
            id,
            name: entry.name,
            importedAt: entry.importedAt || Date.now(),
          }
          manifestModified = true
          await storage.setItemRaw(`local:sync-metadata/timestamps/${id}`, Date.now())
        }
      }

      // 6. Download remote-only motions
      let hasDownloads = false
      for (const [id, remoteMotion] of Object.entries(manifest.motions)) {
        if (deletedMotionIds.has(id))
          continue

        if (!localMotions.has(id)) {
          if (selectiveSyncEnabled.value) {
            const nodeId = `vmd-${id}`
            if (!selectiveCheckedIds.value.includes(nodeId)) {
              debug(`[SyncEngine] Skipping download of VMD motion ${id} because it is not selected in selective sync.`)
              continue
            }
          }

          debug(`[SyncEngine] Downloading VMD motion from remote: ${id} (${remoteMotion.name})`)
          const readBinRes = await client.readFile(`assets/mmd/animations/${id}.bin`, 'base64')
          if (!readBinRes.success || !readBinRes.content) {
            console.error(`[SyncEngine] Failed to read remote VMD binary for ${id}:`, readBinRes.error)
            if (readBinRes.error?.includes('ENOENT')) {
              debug(`[SyncEngine] Remote VMD binary for ${id} is missing on storage. Removing from manifest.`)
              delete manifest.motions[id]
              manifestModified = true
            }
            continue
          }

          const mimeType = 'application/octet-stream'
          const res = await fetch(`data:${mimeType};base64,${readBinRes.content}`)
          const blob = await res.blob()
          const fileObj = new File([blob], `${remoteMotion.name}.vmd`, { type: mimeType })

          const entry = {
            id,
            name: remoteMotion.name,
            file: fileObj,
          }

          await localforage.setItem(id, entry)
          await storage.setItemRaw(`local:sync-metadata/timestamps/${id}`, Date.now())
          hasDownloads = true
        }
      }

      if (manifestModified) {
        debug('[SyncEngine] Writing updated MMD manifest to remote.')
        await client.writeFile('assets/mmd/manifest.json', JSON.stringify(manifest, null, 2))
      }

      // If we downloaded any new motions, let's refresh the store custom motions array
      if (hasDownloads) {
        try {
          const { useMmd } = await import('@proj-airi/stage-ui-mmd/stores/mmd')
          const mmdStore = useMmd()
          // Read localforage and rebuild customMotions list
          const nextMotions: any[] = []
          const keys1259 = await localforage.keys()
          const motionKeys1259 = keys1259.filter(key => key.startsWith('mmd-motion-'))
          for (const key of motionKeys1259) {
            const val = await localforage.getItem<any>(key)
            if (val) {
              nextMotions.push({ id: val.id, name: val.name })
            }
          }
          mmdStore.customMotions = nextMotions
        }
        catch (e) {
          console.error('[SyncEngine] Failed to refresh MMD store:', e)
        }
      }
    }
    catch (err) {
      console.error('[SyncEngine] MMD motion reconciliation error:', err)
    }
  }

  async function reconcileVrmaAnimations(): Promise<void> {
    debug('[SyncEngine] Reconciling VRMA animations...')
    const quotaCheck = await checkQuotaLimit()
    if (!quotaCheck.safe) {
      debug('[SyncEngine] reconcileVrmaAnimations aborted:', quotaCheck.reason)
      return
    }
    try {
      const client = getActiveClient()

      // 1. Load deleted IDs from localStorage
      const deletedAnimsStr = localStorage.getItem('settings/vrma/deleted-animations') || '[]'
      const deletedAnimIds = new Set<string>(JSON.parse(deletedAnimsStr))

      // 2. Read remote manifest
      let manifest: {
        animations: Record<string, { id: string, name: string, originalFileName: string, importedAt: number }>
        deleted?: string[]
      } = { animations: {}, deleted: [] }
      let manifestExists = false
      let remoteManifestMtime = 0
      try {
        const readRes = await client.readFile('assets/vrma/manifest.json')
        if (readRes.success && readRes.content) {
          manifest = JSON.parse(readRes.content)
          if (!manifest.deleted) {
            manifest.deleted = []
          }
          manifestExists = true
        }

        const listRes = await client.listFiles()
        if (listRes.success && listRes.files) {
          const manifestFile = listRes.files.find(f => f.relPath.replace(/\\/g, '/') === 'assets/vrma/manifest.json')
          if (manifestFile) {
            remoteManifestMtime = manifestFile.mtime
          }
        }
      }
      catch (e) {
        debug('[SyncEngine] Failed to read remote VRMA manifest, initializing new manifest.', e)
      }

      let manifestModified = false

      // 3. Process deletions (both remote and local)
      for (const id of deletedAnimIds) {
        if (!manifest.deleted) {
          manifest.deleted = []
        }
        if (!manifest.deleted.includes(id)) {
          manifest.deleted.push(id)
          manifestModified = true
        }
        if (manifest.animations[id]) {
          debug(`[SyncEngine] Deleting remote custom VRMA animation: ${id}`)
          await client.deleteFile(`assets/vrma/animations/${id}.bin`)
          delete manifest.animations[id]
          manifestModified = true
        }
        await localforage.removeItem(`custom-vrma-animation-${id}`)
        await storage.removeItem(`local:sync-metadata/timestamps/${id}`)
      }

      // 4. Load local custom VRMAs (keys starting with `custom-vrma-animation-` and not deleted)
      const localAnims = new Map<string, any>()
      const keys1342 = await localforage.keys()
      const animKeys1342 = keys1342.filter(key => key.startsWith('custom-vrma-animation-'))
      for (const key of animKeys1342) {
        const id = key.substring('custom-vrma-animation-'.length)
        if (!deletedAnimIds.has(id)) {
          const val = await localforage.getItem<any>(key)
          if (val) {
            localAnims.set(id, val)
          }
        }
      }

      // 5. Upload local-only animations to remote
      for (const [id, entry] of localAnims.entries()) {
        if (manifest.deleted && manifest.deleted.includes(id)) {
          debug(`[SyncEngine] VRMA animation ${id} (${entry.name}) is marked as deleted remotely. Deleting locally.`)
          await localforage.removeItem(`custom-vrma-animation-${id}`)
          await storage.removeItem(`local:sync-metadata/timestamps/${id}`)
          continue
        }

        if (selectiveSyncEnabled.value) {
          const nodeId = `vrma-${id}`
          if (!selectiveCheckedIds.value.includes(nodeId)) {
            debug(`[SyncEngine] Skipping upload of VRMA animation ${id} because it is not selected in selective sync.`)
            continue
          }
        }

        if (!manifest.animations[id]) {
          const hasSyncHistory = await storage.getItemRaw<number>(`local:sync-metadata/timestamps/${id}`)
          const isStaleManifest = remoteManifestMtime > 0 && hasSyncHistory && hasSyncHistory > remoteManifestMtime

          if (hasSyncHistory && manifestExists && !isStaleManifest) {
            debug(`[SyncEngine] VRMA animation ${id} (${entry.name}) has sync history but is missing from remote manifest. Deleting locally.`)
            await localforage.removeItem(`custom-vrma-animation-${id}`)
            await storage.removeItem(`local:sync-metadata/timestamps/${id}`)
            continue
          }

          debug(`[SyncEngine] Uploading VRMA animation to remote: ${id} (${entry.name})`)
          if (entry.file instanceof Blob || entry.file instanceof File) {
            const base64 = await blobToBase64(entry.file)
            const binRelPath = `assets/vrma/animations/${id}.bin`
            const uploadRes = await client.writeFile(binRelPath, base64, 'base64')
            if (!uploadRes.success) {
              console.error(`[SyncEngine] Failed to upload VRMA binary for ${id}:`, uploadRes.error)
              continue
            }
          }
          else {
            debug(`[SyncEngine] Local VRMA animation ${id} does not contain a valid File/Blob.`, entry)
            continue
          }

          manifest.animations[id] = {
            id,
            name: entry.name,
            originalFileName: entry.originalFileName || `${entry.name}.vrma`,
            importedAt: entry.importedAt || Date.now(),
          }
          manifestModified = true
          await storage.setItemRaw(`local:sync-metadata/timestamps/${id}`, Date.now())
        }
      }

      // 6. Download remote-only animations
      let hasDownloads = false
      for (const [id, remoteAnim] of Object.entries(manifest.animations)) {
        if (deletedAnimIds.has(id))
          continue

        if (!localAnims.has(id)) {
          if (selectiveSyncEnabled.value) {
            const nodeId = `vrma-${id}`
            if (!selectiveCheckedIds.value.includes(nodeId)) {
              debug(`[SyncEngine] Skipping download of VRMA animation ${id} because it is not selected in selective sync.`)
              continue
            }
          }

          debug(`[SyncEngine] Downloading VRMA animation from remote: ${id} (${remoteAnim.name})`)
          const readBinRes = await client.readFile(`assets/vrma/animations/${id}.bin`, 'base64')
          if (!readBinRes.success || !readBinRes.content) {
            console.error(`[SyncEngine] Failed to read remote VRMA binary for ${id}:`, readBinRes.error)
            if (readBinRes.error?.includes('ENOENT')) {
              debug(`[SyncEngine] Remote VRMA binary for ${id} is missing on storage. Removing from manifest.`)
              delete manifest.animations[id]
              manifestModified = true
            }
            continue
          }

          const mimeType = 'application/octet-stream'
          const res = await fetch(`data:${mimeType};base64,${readBinRes.content}`)
          const blob = await res.blob()
          const fileObj = new File([blob], remoteAnim.originalFileName || `${remoteAnim.name}.vrma`, { type: mimeType })

          const entry = {
            file: fileObj,
            importedAt: remoteAnim.importedAt,
            name: remoteAnim.name,
            originalFileName: remoteAnim.originalFileName,
          }

          await localforage.setItem(`custom-vrma-animation-${id}`, entry)
          await storage.setItemRaw(`local:sync-metadata/timestamps/${id}`, Date.now())
          hasDownloads = true
        }
      }

      if (manifestModified) {
        debug('[SyncEngine] Writing updated VRMA manifest to remote.')
        await client.writeFile('assets/vrma/manifest.json', JSON.stringify(manifest, null, 2))
      }

      // If downloaded new custom animations, reload custom animations in the store
      if (hasDownloads) {
        try {
          const { useCustomVrmAnimationsStore } = await import('@proj-airi/stage-ui-three')
          const store = useCustomVrmAnimationsStore()
          store.customAnimationsLoaded = false
          await store.loadCustomAnimations()
        }
        catch (e) {
          console.error('[SyncEngine] Failed to reload VRMA animations store:', e)
        }
      }
    }
    catch (err) {
      console.error('[SyncEngine] VRMA animation reconciliation error:', err)
    }
  }

  function getKeyForRelPath(relPath: string): string {
    const normalized = relPath.replace(/\\/g, '/')
    if (normalized.startsWith('db/') && normalized.endsWith('.json')) {
      const clean = normalized.substring(3, normalized.length - 5)
      return `local:${clean}`
    }
    return ''
  }

  function mergeArraysById(localArr: any[], remoteArr: any[]): any[] {
    const mergedMap = new Map<string, any>()
    for (const item of localArr) {
      if (item && item.id) {
        mergedMap.set(item.id, item)
      }
    }
    for (const item of remoteArr) {
      if (item && item.id) {
        const existing = mergedMap.get(item.id)
        if (existing) {
          const existingTime = existing.updatedAt || existing.createdAt || 0
          const remoteTime = item.updatedAt || item.createdAt || 0
          if (remoteTime > existingTime) {
            mergedMap.set(item.id, item)
          }
        }
        else {
          mergedMap.set(item.id, item)
        }
      }
    }
    return Array.from(mergedMap.values())
  }

  // Merges two airi-cards Map-entry arrays.
  function mergeAiriCards(localVal: any, remoteVal: any): any {
    try {
      const localEntries = Array.isArray(localVal) ? localVal as [string, any][] : []
      const remoteEntries = Array.isArray(remoteVal) ? remoteVal as [string, any][] : []

      const mergedMap = new Map<string, any>()
      for (const [id, card] of localEntries) {
        if (id && card) {
          mergedMap.set(id, card)
        }
      }
      for (const [id, card] of remoteEntries) {
        if (id && card) {
          const existing = mergedMap.get(id)
          if (existing) {
            const existingTime = existing.updatedAt || existing.createdAt || 0
            const remoteTime = card.updatedAt || card.createdAt || 0
            if (remoteTime > existingTime) {
              mergedMap.set(id, card)
            }
          }
          else {
            mergedMap.set(id, card)
          }
        }
      }
      return Array.from(mergedMap.entries())
    }
    catch (e) {
      console.error('[SyncEngine] Failed to merge airi-cards:', e)
      return localVal || remoteVal
    }
  }

  // Merges two chat-session indexes.
  function mergeChatIndices(localVal: any, remoteVal: any): any {
    try {
      const localIdx = localVal && typeof localVal === 'object' && !Array.isArray(localVal) ? localVal : { characters: {} }
      const remoteIdx = remoteVal && typeof remoteVal === 'object' && !Array.isArray(remoteVal) ? remoteVal : { characters: {} }

      const mergedCharacters: Record<string, any> = {}
      const allCharacterIds = new Set([
        ...Object.keys(localIdx.characters || {}),
        ...Object.keys(remoteIdx.characters || {}),
      ])

      for (const charId of allCharacterIds) {
        const localChar = localIdx.characters?.[charId] || { sessions: {} }
        const remoteChar = remoteIdx.characters?.[charId] || { sessions: {} }

        const mergedSessions: Record<string, any> = {}
        const allSessionIds = new Set([
          ...Object.keys(localChar.sessions || {}),
          ...Object.keys(remoteChar.sessions || {}),
        ])

        let activeSessionId = localChar.activeSessionId || remoteChar.activeSessionId || ''

        for (const sessId of allSessionIds) {
          const localSess = localChar.sessions?.[sessId]
          const remoteSess = remoteChar.sessions?.[sessId]

          if (localSess && remoteSess) {
            const localTime = localSess.updatedAt || localSess.createdAt || 0
            const remoteTime = remoteSess.updatedAt || remoteSess.createdAt || 0
            if (remoteTime > localTime) {
              mergedSessions[sessId] = remoteSess
            }
            else {
              mergedSessions[sessId] = localSess
            }
          }
          else {
            mergedSessions[sessId] = localSess || remoteSess
          }
        }

        const localActiveSess = localChar.sessions?.[localChar.activeSessionId]
        const remoteActiveSess = remoteChar.sessions?.[remoteChar.activeSessionId]
        const localActiveTime = localActiveSess?.updatedAt || localActiveSess?.createdAt || 0
        const remoteActiveTime = remoteActiveSess?.updatedAt || remoteActiveSess?.createdAt || 0
        if (remoteActiveTime > localActiveTime && remoteChar.activeSessionId) {
          activeSessionId = remoteChar.activeSessionId
        }
        else if (localChar.activeSessionId) {
          activeSessionId = localChar.activeSessionId
        }

        mergedCharacters[charId] = {
          activeSessionId,
          sessions: mergedSessions,
        }
      }

      return {
        userId: localIdx.userId || remoteIdx.userId || 'local',
        characters: mergedCharacters,
      }
    }
    catch (e) {
      console.error('[SyncEngine] Failed to merge chat indices:', e)
      return localVal || remoteVal
    }
  }

  // Merges two available-motions arrays stored in localStorage bridge objects.
  function mergeAvailableMotions(localVal: any, remoteVal: any): any {
    if (!localVal)
      return remoteVal
    if (!remoteVal)
      return localVal

    try {
      const localRaw = typeof localVal === 'string' ? localVal : (localVal.value || '[]')
      const remoteRaw = typeof remoteVal === 'string' ? remoteVal : (remoteVal.value || '[]')

      let localArr: any[] = []
      let remoteArr: any[] = []

      try {
        localArr = JSON.parse(localRaw)
      }
      catch (e) {
        console.error('[SyncEngine] Failed to parse local available-motions:', e)
      }

      try {
        remoteArr = JSON.parse(remoteRaw)
      }
      catch (e) {
        console.error('[SyncEngine] Failed to parse remote available-motions:', e)
      }

      if (!Array.isArray(localArr))
        localArr = []
      if (!Array.isArray(remoteArr))
        remoteArr = []

      const mergedMap = new Map<string, any>()

      const getMotionKey = (item: any) => {
        if (!item)
          return ''
        return `${item.motionName || ''}:${item.motionIndex ?? ''}:${item.fileName || ''}`
      }

      for (const item of localArr) {
        const key = getMotionKey(item)
        if (key) {
          mergedMap.set(key, item)
        }
      }

      for (const item of remoteArr) {
        const key = getMotionKey(item)
        if (key) {
          const existing = mergedMap.get(key)
          if (existing) {
            mergedMap.set(key, {
              ...existing,
              ...item,
              sound: item.sound || existing.sound,
              text: item.text || existing.text,
              language: item.language || existing.language,
            })
          }
          else {
            mergedMap.set(key, item)
          }
        }
      }

      const mergedList = Array.from(mergedMap.values())
      const mergedValueStr = JSON.stringify(mergedList)

      return {
        value: mergedValueStr,
        originalKey: localVal.originalKey || remoteVal.originalKey || 'settings/live2d/available-motions',
      }
    }
    catch (e) {
      console.error('[SyncEngine] Failed to merge available motions:', e)
      return localVal || remoteVal
    }
  }

  const conflicts = ref<any[]>([])

  const debugLogBuffer: string[] = []

  async function logDebug(msg: string) {
    debug(`[SyncEngine] ${msg}`)
    const logLine = `[${new Date().toISOString()}] ${msg}\n`
    debugLogBuffer.push(logLine)
  }

  async function flushDebugLogs() {
    if (debugLogBuffer.length === 0)
      return
    try {
      const client = getActiveClient()
      if (activeProvider.value === 'local-fs' && hasElectron()) {
        const fullLog = debugLogBuffer.join('')
        await client.writeFile('sync-engine-debug.log', fullLog, 'utf-8', true)
      }
    }
    catch (e) {
      console.error('[SyncEngine] Debug log flush failed:', e)
    }
    finally {
      debugLogBuffer.length = 0
    }
  }

  async function loadConflicts() {
    try {
      const client = getActiveClient()
      const rawLocalKeys = await storage.getKeys('local')
      const localKeys = rawLocalKeys.map(normalizeStorageKey).filter((k): k is string => k !== null)
      const list: any[] = []
      const PREFIX = 'local:sync-metadata/conflicts/'
      for (const k of localKeys) {
        if (k.startsWith(PREFIX)) {
          const conflictData = await storage.getItemRaw<any>(k)
          if (conflictData) {
            if (conflictData.key.startsWith('local:chat/sessions/')) {
              try {
                const localVal = await storage.getItemRaw<any>(conflictData.key)
                let remoteVal: any = null
                const readRes = await client.readFile(conflictData.remoteRelPath)
                if (readRes.success && readRes.content) {
                  try {
                    remoteVal = JSON.parse(readRes.content)
                  }
                  catch (e) {}
                }

                conflictData.sessionDetails = {
                  local: localVal
                    ? {
                        characterId: localVal.meta?.characterId || '',
                        title: localVal.meta?.title || '',
                        messageCount: localVal.messages?.length || localVal.meta?.messageCount || 0,
                        lastMessage: localVal.messages?.[localVal.messages.length - 1]?.content || '',
                      }
                    : null,
                  remote: remoteVal
                    ? {
                        characterId: remoteVal.meta?.characterId || '',
                        title: remoteVal.meta?.title || '',
                        messageCount: remoteVal.messages?.length || remoteVal.meta?.messageCount || 0,
                        lastMessage: remoteVal.messages?.[remoteVal.messages.length - 1]?.content || '',
                      }
                    : null,
                }
              }
              catch (e) {
                console.error('[SyncEngine] Failed to enrich conflict details:', e)
              }
            }
            list.push(conflictData)
          }
        }
      }
      conflicts.value = list
      await logDebug(`loadConflicts: Loaded ${list.length} conflicts.`)
    }
    catch (e) {
      console.error('[SyncEngine] Failed to load conflicts:', e)
      await logDebug(`loadConflicts error: ${e}`)
    }
  }

  // Safety Heuristics Guard
  async function checkSyncConflict(localKey: string, localTime: number, remoteFile: { size: number, mtime: number, relPath: string }, type: 'remote-newer' | 'local-newer'): Promise<boolean> {
    const isCritical = localKey.startsWith('local:chat/sessions/') || localKey.startsWith('local:characters/') || localKey.startsWith('local:localstorage/') || localKey.startsWith('local:director/sessions/') || localKey.startsWith('local:chat/index/')
    await logDebug(`checkSyncConflict: key=${localKey}, type=${type}, critical=${isCritical}`)
    if (!isCritical)
      return false

    try {
      const localVal = await storage.getItemRaw(localKey)
      const localSerialized = localVal ? (typeof localVal === 'string' ? localVal : JSON.stringify(localVal, null, 2)) : ''
      const localSize = localSerialized ? new TextEncoder().encode(localSerialized).byteLength : 0
      const remoteSize = remoteFile.size
      await logDebug(`checkSyncConflict stats for ${localKey}: localSize=${localSize}, remoteSize=${remoteSize}`)

      let isContraction = false
      if (type === 'remote-newer') {
        isContraction = remoteSize < localSize && localSize > 10240 && (remoteSize < 2048 || localSize > 5 * remoteSize)
      }
      else {
        isContraction = localSize < remoteSize && remoteSize > 10240 && (localSize < 2048 || remoteSize > 5 * localSize)
      }

      await logDebug(`checkSyncConflict outcome for ${localKey}: isContraction=${isContraction}`)

      if (isContraction) {
        await logDebug(`[WARNING] Safety conflict registered for ${localKey} (${type}). Local Size = ${localSize} bytes, Remote Size = ${remoteSize} bytes. Overwrite blocked.`)

        const conflictData = {
          key: localKey,
          localTimestamp: localTime,
          remoteTimestamp: remoteFile.mtime,
          localSize,
          remoteSize,
          remoteRelPath: remoteFile.relPath,
          conflictTime: Date.now(),
        }
        await storage.setItemRaw(`local:sync-metadata/conflicts/${localKey.replace('local:', '')}`, conflictData)
        return true
      }
    }
    catch (e) {
      console.error(`[SyncEngine] Error during safety check for ${localKey}:`, e)
      await logDebug(`checkSyncConflict error for ${localKey}: ${e}`)
    }
    return false
  }

  // Apply Resolution
  async function resolveConflict(localKey: string, choice: 'local' | 'remote' | 'merge') {
    const client = getActiveClient()
    const relPath = getRelPathForKey(localKey)
    const conflictMetadataKey = `local:sync-metadata/conflicts/${localKey.replace('local:', '')}`

    try {
      storageState.isImportingRemoteData = true

      if (choice === 'local') {
        debug(`[SyncEngine] Resolving conflict for ${localKey} keeping LOCAL.`)
        const localVal = await storage.getItemRaw(localKey)
        if (localVal !== undefined && localVal !== null) {
          const writeRes = await client.writeFile(relPath, JSON.stringify(localVal, null, 2))
          if (writeRes.success) {
            const stats = await client.listFiles()
            const matchingFile = stats.files?.find((f: any) => f.relPath === relPath)
            if (matchingFile) {
              await storage.setItemRaw(`local:sync-metadata/timestamps/${localKey.replace('local:', '')}`, matchingFile.mtime)
            }
          }
          else {
            throw new Error(`Failed to write remote file: ${writeRes.error}`)
          }
        }
      }
      else if (choice === 'remote') {
        debug(`[SyncEngine] Resolving conflict for ${localKey} keeping REMOTE.`)
        const readRes = await client.readFile(relPath)
        if (readRes.success && readRes.content) {
          const remoteVal = JSON.parse(readRes.content)
          await storage.setItemRaw(localKey, remoteVal)

          const stats = await client.listFiles()
          const matchingFile = stats.files?.find((f: any) => f.relPath === relPath)
          if (matchingFile) {
            await storage.setItemRaw(`local:sync-metadata/timestamps/${localKey.replace('local:', '')}`, matchingFile.mtime)
          }
        }
        else {
          throw new Error(`Failed to read remote file: ${readRes.error}`)
        }
      }
      else if (choice === 'merge') {
        debug(`[SyncEngine] Resolving conflict for ${localKey} by MERGING arrays.`)
        const readRes = await client.readFile(relPath)
        if (readRes.success && readRes.content) {
          const remoteData = JSON.parse(readRes.content)
          const localData = await storage.getItemRaw(localKey)

          let mergedData: any = null

          if (localKey.startsWith('local:chat/sessions/')) {
            const isLocalObj = localData && typeof localData === 'object' && !Array.isArray(localData)
            const isRemoteObj = remoteData && typeof remoteData === 'object' && !Array.isArray(remoteData)

            const localMsgs = isLocalObj ? (localData.messages || []) : (Array.isArray(localData) ? localData : [])
            const remoteMsgs = isRemoteObj ? (remoteData.messages || []) : (Array.isArray(remoteData) ? remoteData : [])

            const mergedMsgs = mergeArraysById(localMsgs, remoteMsgs)

            if (isLocalObj) {
              mergedData = {
                ...localData,
                ...remoteData,
                messages: mergedMsgs,
                updatedAt: Date.now(),
              }
            }
            else {
              mergedData = mergedMsgs
            }
          }
          else if (localKey === 'local:localstorage/settings/live2d/available-motions') {
            mergedData = mergeAvailableMotions(localData, remoteData)
          }
          else {
            if (Array.isArray(localData) && Array.isArray(remoteData)) {
              mergedData = mergeArraysById(localData, remoteData)
            }
            else {
              mergedData = localData || remoteData
            }
          }

          await storage.setItemRaw(localKey, mergedData)

          const writeRes = await client.writeFile(relPath, JSON.stringify(mergedData, null, 2))
          if (writeRes.success) {
            const stats = await client.listFiles()
            const matchingFile = stats.files?.find((f: any) => f.relPath === relPath)
            if (matchingFile) {
              await storage.setItemRaw(`local:sync-metadata/timestamps/${localKey.replace('local:', '')}`, matchingFile.mtime)
            }
          }
          else {
            throw new Error(`Failed to write remote file: ${writeRes.error}`)
          }
        }
        else {
          throw new Error(`Failed to read remote file: ${readRes.error}`)
        }
      }

      await storage.removeItem(conflictMetadataKey)
      await loadConflicts()
      toast.success(`Conflict resolved successfully using ${choice} strategy`)
    }
    catch (e) {
      console.error(`[SyncEngine] Conflict resolution failed for ${localKey}:`, e)
      toast.error(`Resolution failed: ${e}`)
    }
    finally {
      storageState.isImportingRemoteData = false
    }
  }

  // Storage Quota Guard
  async function checkQuotaLimit(): Promise<{ safe: boolean, reason?: string }> {
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const { quota, usage } = await navigator.storage.estimate()
        if (quota !== undefined && usage !== undefined) {
          const ratio = usage / quota
          const remainingMB = (quota - usage) / (1024 * 1024)
          if (ratio > 0.90 || remainingMB < 100) {
            return {
              safe: false,
              reason: `Storage quota running low (Usage: ${(ratio * 100).toFixed(1)}%, Remaining: ${remainingMB.toFixed(1)} MB)`,
            }
          }
        }
      }
    }
    catch (e) {
      debug('[SyncEngine] Failed to estimate storage quota:', e)
    }
    return { safe: true }
  }

  // Run full two-way reconciliation (LWW)
  async function reconcile(opts?: { skipBinaryAssets?: boolean }): Promise<boolean> {
    const client = getActiveClient()
    const pathValidation = await client.validate()
    if (!pathValidation.success) {
      debug('[SyncEngine] Sync storage target is invalid or inaccessible, skipping reconciliation:', pathValidation.error)
      return false
    }

    const quotaCheck = await checkQuotaLimit()
    if (!quotaCheck.safe) {
      console.error('[SyncEngine] Sync aborted:', quotaCheck.reason)
      toast.error(`Sync aborted: ${quotaCheck.reason}`)
      return false
    }

    debug('[SyncEngine] Starting reconciliation...')
    try {
      const listRes = await client.listFiles()
      if (!listRes.success) {
        throw new Error(listRes.error || 'Failed to list remote files')
      }

      const remoteFiles = (listRes.files || []) as Array<{ relPath: string, mtime: number, size: number }>
      const remoteFileMap = new Map(remoteFiles.map(f => [getKeyForRelPath(f.relPath), f]))

      const rawLocalKeys = await storage.getKeys('local')
      const localKeys = rawLocalKeys.map(normalizeStorageKey).filter((k): k is string => k !== null)
      const localTimestamps = new Map<string, number>()

      for (const fullKey of localKeys) {
        if (fullKey.startsWith('local:sync-metadata/timestamps/')) {
          const actualKey = `local:${fullKey.replace('local:sync-metadata/timestamps/', '')}`
          const t = await storage.getItemRaw<number>(fullKey)
          if (t) {
            localTimestamps.set(actualKey, t)
          }
        }
      }

      storageState.isImportingRemoteData = true

      const remoteEntries = Array.from(remoteFileMap.entries())
      await parallelLimit(remoteEntries, 15, async ([localKey, remoteFile]) => {
        if (!localKey)
          return

        if (localKey.startsWith('local:localstorage/')) {
          const key = localKey.substring('local:localstorage/'.length)
          if (shouldExcludeLocalStorageKey(key))
            return
        }

        const loopQuotaCheck = await checkQuotaLimit()
        if (!loopQuotaCheck.safe) {
          debug('[SyncEngine] Quota limit hit mid-sync. Aborting download of key:', localKey)
          return
        }

        if (selectiveSyncEnabled.value && localKey.startsWith('local:chat/sessions/')) {
          let charId: string | null = null
          const localVal = await storage.getItemRaw<any>(localKey)
          if (localVal && localVal.meta?.characterId) {
            charId = localVal.meta.characterId
          }
          else {
            const readRes = await client.readFile(remoteFile.relPath)
            if (readRes.success && readRes.content) {
              try {
                const remoteVal = JSON.parse(readRes.content)
                charId = remoteVal.meta?.characterId || null
              }
              catch (e) {}
            }
          }
          if (charId) {
            const chatNodeId = `chat-${charId}`
            if (!selectiveCheckedIds.value.includes(chatNodeId)) {
              await logDebug(`Skipping reconcile of chat session ${localKey} because character chat ${chatNodeId} is not selected.`)
              return
            }
          }
        }

        const localTime = localTimestamps.get(localKey)
        await logDebug(`Reconciling key: ${localKey}, localTime=${localTime}, remoteMtime=${remoteFile.mtime}, remoteSize=${remoteFile.size}`)

        const isMergeableKey = [
          'local:memory/short-term/local',
          'local:memory/text-journal/local',
          'local:memory/echo-chips/local',
          'local:airi-cards',
          'local:localstorage/settings/live2d/available-motions',
        ].includes(localKey) || localKey.startsWith('local:chat/index/')

        if (isMergeableKey) {
          debug(`[SyncEngine] Key ${localKey} is mergeable. Executing merge...`)
          let remoteVal: any = null
          const readRes = await client.readFile(remoteFile.relPath)
          if (readRes.success && readRes.content) {
            try {
              remoteVal = JSON.parse(readRes.content)
            }
            catch (e) {
              console.error(`[SyncEngine] Failed to parse remote data for mergeable key ${localKey}:`, e)
            }
          }

          const localVal = await storage.getItemRaw<any>(localKey)
          let mergedVal: any = null

          if (localKey === 'local:airi-cards') {
            mergedVal = mergeAiriCards(localVal, remoteVal)
          }
          else if (localKey.startsWith('local:chat/index/')) {
            mergedVal = mergeChatIndices(localVal, remoteVal)
          }
          else if (localKey === 'local:localstorage/settings/live2d/available-motions') {
            mergedVal = mergeAvailableMotions(localVal, remoteVal)
          }
          else {
            let localArr = localVal || []
            let remoteArr = remoteVal || []
            if (!Array.isArray(localArr))
              localArr = []
            if (!Array.isArray(remoteArr))
              remoteArr = []
            mergedVal = mergeArraysById(localArr, remoteArr)
          }

          await storage.setItemRaw(localKey, mergedVal)

          const writeRes = await client.writeFile(remoteFile.relPath, JSON.stringify(mergedVal, null, 2))
          if (writeRes.success && writeRes.mtime) {
            await storage.setItemRaw(`local:sync-metadata/timestamps/${localKey.replace('local:', '')}`, writeRes.mtime)
          }
          localTimestamps.delete(localKey)
          return
        }

        if (localTime === undefined) {
          const queueKey = `outbox:queue/${localKey.replace('local:', '')}`
          const hasPendingOutbox = await storage.getItemRaw(queueKey).then(val => val !== null && val !== undefined)
          if (hasPendingOutbox) {
            await logDebug(`[SyncEngine] Skipping download for ${localKey} because it has pending local changes in the outbox.`)
            return
          }

          const localVal = await storage.getItemRaw(localKey)
          if (localVal !== undefined && localVal !== null) {
            const localSerialized = typeof localVal === 'string' ? localVal : JSON.stringify(localVal, null, 2)
            const localSize = new TextEncoder().encode(localSerialized).byteLength

            if (localSize === remoteFile.size) {
              // First check: if the remote file has identical contents, just align the local timestamp
              const readRes = await client.readFile(remoteFile.relPath)
              if (readRes.success && readRes.content) {
                try {
                  const remoteVal = JSON.parse(readRes.content)
                  if (JSON.stringify(localVal) === JSON.stringify(remoteVal)) {
                    await logDebug(`[SyncEngine] Case A content identical for ${localKey}. Aligning timestamp to remote ${remoteFile.mtime} (skipped download).`)
                    await storage.setItemRaw(`local:sync-metadata/timestamps/${localKey.replace('local:', '')}`, remoteFile.mtime)
                    return
                  }
                }
                catch (e) {}
              }
            }
            else {
              await logDebug(`[SyncEngine] Case A size mismatch for ${localKey} (local size: ${localSize}, remote size: ${remoteFile.size}). Skipping remote read for content comparison.`)
            }

            if (conflictStrategy.value === 'local-wins') {
              debug(`[SyncEngine] Uploading (local-wins/Case A): ${localKey} -> remote (${remoteFile.relPath})`)
              const writeRes = await client.writeFile(remoteFile.relPath, JSON.stringify(localVal, null, 2))
              if (writeRes.success && writeRes.mtime) {
                await storage.setItemRaw(`local:sync-metadata/timestamps/${localKey.replace('local:', '')}`, writeRes.mtime)
              }
              return
            }

            await logDebug(`[Case A] Local key ${localKey} exists but localTime is undefined. Running safety check.`)
            const isConflict = conflictStrategy.value === 'remote-wins' ? false : await checkSyncConflict(localKey, 0, remoteFile, 'remote-newer')
            if (isConflict) {
              await logDebug(`[WARNING] Safety conflict registered for ${localKey} (Case A - local data exists). Overwrite blocked.`)
              return
            }
          }

          debug(`[SyncEngine] Downloading (missing local): remote (${remoteFile.relPath}) -> ${localKey}`)
          const readRes = await client.readFile(remoteFile.relPath)
          if (readRes.success && readRes.content) {
            const data = JSON.parse(readRes.content)
            await storage.setItemRaw(localKey, data)
            await storage.setItemRaw(`local:sync-metadata/timestamps/${localKey.replace('local:', '')}`, remoteFile.mtime)
          }
        }
        else if (remoteFile.mtime > localTime || conflictStrategy.value === 'remote-wins') {
          const queueKey = `outbox:queue/${localKey.replace('local:', '')}`
          const hasPendingOutbox = await storage.getItemRaw(queueKey).then(val => val !== null && val !== undefined)
          if (hasPendingOutbox) {
            await logDebug(`[SyncEngine] Skipping overwrite for ${localKey} because it has pending local changes in the outbox.`)
            return
          }

          const localVal = await storage.getItemRaw(localKey)
          if (localVal) {
            const localSerialized = typeof localVal === 'string' ? localVal : JSON.stringify(localVal, null, 2)
            const localSize = new TextEncoder().encode(localSerialized).byteLength

            if (localSize === remoteFile.size) {
              // First check: if the remote file has identical contents, just align the local timestamp
              const readRes = await client.readFile(remoteFile.relPath)
              if (readRes.success && readRes.content) {
                try {
                  const remoteVal = JSON.parse(readRes.content)
                  if (JSON.stringify(localVal) === JSON.stringify(remoteVal)) {
                    await logDebug(`[SyncEngine] Case B content identical for ${localKey}. Aligning timestamp to remote ${remoteFile.mtime} (skipped download).`)
                    await storage.setItemRaw(`local:sync-metadata/timestamps/${localKey.replace('local:', '')}`, remoteFile.mtime)
                    return
                  }
                }
                catch (e) {}
              }
            }
            else {
              await logDebug(`[SyncEngine] Case B size mismatch for ${localKey} (local size: ${localSize}, remote size: ${remoteFile.size}). Skipping remote read for content comparison.`)
            }
          }

          if (conflictStrategy.value === 'local-wins') {
            debug(`[SyncEngine] Uploading (local-wins/Case B): ${localKey} -> remote (${remoteFile.relPath})`)
            if (localVal) {
              const writeRes = await client.writeFile(remoteFile.relPath, JSON.stringify(localVal, null, 2))
              if (writeRes.success && writeRes.mtime) {
                await storage.setItemRaw(`local:sync-metadata/timestamps/${localKey.replace('local:', '')}`, writeRes.mtime)
              }
            }
            return
          }

          // Case B: Remote file is newer OR strategy is remote-wins -> Download and overwrite local
          const isConflict = conflictStrategy.value === 'remote-wins' ? false : await checkSyncConflict(localKey, localTime, remoteFile, 'remote-newer')
          if (isConflict) {
            debug(`[SyncEngine] Conflict safety guard blocked auto-overwrite of local key ${localKey}`)
            return
          }

          debug(`[SyncEngine] Downloading (remote newer/Case B): remote (${remoteFile.relPath}) -> ${localKey}`)
          const readRes = await client.readFile(remoteFile.relPath)
          if (readRes.success && readRes.content) {
            const data = JSON.parse(readRes.content)
            await storage.setItemRaw(localKey, data)
            await storage.setItemRaw(`local:sync-metadata/timestamps/${localKey.replace('local:', '')}`, remoteFile.mtime)
          }
        }
        else if (localTime > remoteFile.mtime) {
          const localVal = await storage.getItemRaw(localKey)
          if (localVal) {
            const localSerialized = typeof localVal === 'string' ? localVal : JSON.stringify(localVal, null, 2)
            const localSize = new TextEncoder().encode(localSerialized).byteLength

            if (localSize === remoteFile.size) {
              // Check: if remote file has identical contents despite older timestamp, just align local timestamp
              const readRes = await client.readFile(remoteFile.relPath)
              if (readRes.success && readRes.content) {
                try {
                  const remoteVal = JSON.parse(readRes.content)
                  if (JSON.stringify(localVal) === JSON.stringify(remoteVal)) {
                    await logDebug(`[SyncEngine] Case C content identical for ${localKey}. Aligning timestamp to remote ${remoteFile.mtime} (skipped upload).`)
                    await storage.setItemRaw(`local:sync-metadata/timestamps/${localKey.replace('local:', '')}`, remoteFile.mtime)
                    return
                  }
                }
                catch (e) {}
              }
            }
            else {
              await logDebug(`[SyncEngine] Case C size mismatch for ${localKey} (local size: ${localSize}, remote size: ${remoteFile.size}). Skipping remote read for content comparison.`)
            }
          }

          const isConflict = await checkSyncConflict(localKey, localTime, remoteFile, 'local-newer')
          if (isConflict) {
            debug(`[SyncEngine] Conflict safety guard blocked auto-overwrite of remote file for key ${localKey}`)
            return
          }

          debug(`[SyncEngine] Uploading (local newer/Case C): ${localKey} -> remote (${remoteFile.relPath})`)
          if (localVal) {
            const writeRes = await client.writeFile(remoteFile.relPath, JSON.stringify(localVal, null, 2))
            if (!writeRes.success) {
              console.error(`[SyncEngine] Failed to write remote file for ${localKey}:`, writeRes.error)
            }
          }
        }
      })

      const localKeysToUpload = localKeys.filter((fullKey) => {
        if (fullKey.startsWith('local:sync-metadata/') || fullKey === 'local:sync-metadata')
          return false
        return !remoteFileMap.has(fullKey)
      })

      await parallelLimit(localKeysToUpload, 15, async (fullKey) => {
        if (selectiveSyncEnabled.value && fullKey.startsWith('local:chat/sessions/')) {
          const localVal = await storage.getItemRaw<any>(fullKey)
          const charId = localVal?.meta?.characterId
          if (charId) {
            const chatNodeId = `chat-${charId}`
            if (!selectiveCheckedIds.value.includes(chatNodeId)) {
              await logDebug(`Skipping local-only upload of chat session ${fullKey} because character chat ${chatNodeId} is not selected.`)
              return
            }
          }
        }
        const relPath = getRelPathForKey(fullKey)
        debug(`[SyncEngine] Uploading (local only): ${fullKey} -> remote (${relPath})`)

        const localValRaw = await storage.getItemRaw(fullKey)
        const localVal = await storage.getItem(fullKey)
        const valToUse = localVal ?? localValRaw
        if (valToUse !== undefined && valToUse !== null) {
          const writeRes = await client.writeFile(relPath, typeof valToUse === 'string' ? valToUse : JSON.stringify(valToUse, null, 2))
          if (!writeRes.success) {
            console.error(`[SyncEngine] Failed to write remote file for ${fullKey}:`, writeRes.error)
            return
          }
          if (writeRes.mtime) {
            await storage.setItemRaw(`local:sync-metadata/timestamps/${fullKey.replace('local:', '')}`, writeRes.mtime)
          }
        }
      })

      if (!opts?.skipBinaryAssets) {
        await reconcileBackgrounds()
        await reconcileModels()
        await reconcileMmdMotions()
        await reconcileVrmaAnimations()
      }
      else {
        debug('[SyncEngine] Skipping binary asset reconciliation (startup mode).')
      }

      storageState.isImportingRemoteData = false
      return true
    }
    catch (err) {
      storageState.isImportingRemoteData = false
      console.error('[SyncEngine] Reconciliation error:', err)
      return false
    }
  }

  // Process the pending mutations in the outbox queue
  async function processOutbox(): Promise<boolean> {
    const client = getActiveClient()
    const pathValidation = await client.validate()
    if (!pathValidation.success) {
      return false
    }

    const rawOutboxKeys = await storage.getKeys('outbox')
    const outboxKeys = rawOutboxKeys.map(normalizeStorageKey).filter((k): k is string => k !== null).filter(k => k.startsWith('outbox:queue/'))
    if (outboxKeys.length === 0)
      return true

    debug(`[SyncEngine] Processing ${outboxKeys.length} outbox queue items...`)

    storageState.isImportingRemoteData = true
    try {
      await parallelLimit(outboxKeys, 15, async (fullQueueKey) => {
        const item = await storage.getItemRaw<{ key: string, action: 'upsert' | 'delete', timestamp: number }>(fullQueueKey)
        if (!item) {
          await storage.removeItem(fullQueueKey)
          return
        }

        if (selectiveSyncEnabled.value && item.key.startsWith('local:chat/sessions/')) {
          const localVal = await storage.getItemRaw<any>(item.key)
          const charId = localVal?.meta?.characterId
          if (charId) {
            const chatNodeId = `chat-${charId}`
            if (!selectiveCheckedIds.value.includes(chatNodeId)) {
              await logDebug(`Skipping outbox processing for chat session ${item.key} because character chat ${chatNodeId} is not selected.`)
              await storage.removeItem(fullQueueKey)
              return
            }
          }
        }

        const conflictKey = `local:sync-metadata/conflicts/${item.key.replace('local:', '')}`
        const hasActiveConflict = await storage.getItemRaw(conflictKey)
        if (hasActiveConflict) {
          debug(`[SyncEngine] Outbox processing skipped for ${item.key} due to active conflict.`)
          return
        }

        const relPath = getRelPathForKey(item.key)

        if (item.action === 'upsert') {
          const isMergeableKey = [
            'local:memory/short-term/local',
            'local:memory/text-journal/local',
            'local:memory/echo-chips/local',
            'local:airi-cards',
            'local:localstorage/settings/live2d/available-motions',
          ].includes(item.key) || item.key.startsWith('local:chat/index/')

          if (isMergeableKey) {
            debug(`[SyncEngine] Outbox key ${item.key} is mergeable. Merging with remote...`)
            let remoteVal: any = null
            const readRes = await client.readFile(relPath)
            if (readRes.success && readRes.content) {
              try {
                remoteVal = JSON.parse(readRes.content)
              }
              catch (e) {}
            }
            const localVal = await storage.getItemRaw<any>(item.key)
            let mergedVal: any = null

            if (item.key === 'local:airi-cards') {
              mergedVal = mergeAiriCards(localVal, remoteVal)
            }
            else if (item.key.startsWith('local:chat/index/')) {
              mergedVal = mergeChatIndices(localVal, remoteVal)
            }
            else if (item.key === 'local:localstorage/settings/live2d/available-motions') {
              mergedVal = mergeAvailableMotions(localVal, remoteVal)
            }
            else {
              let localArr = localVal || []
              let remoteArr = remoteVal || []
              if (!Array.isArray(localArr))
                localArr = []
              if (!Array.isArray(remoteArr))
                remoteArr = []
              mergedVal = mergeArraysById(localArr, remoteArr)
            }

            await storage.setItemRaw(item.key, mergedVal)

            const writeRes = await client.writeFile(relPath, JSON.stringify(mergedVal, null, 2))
            if (!writeRes.success) {
              throw new Error(writeRes.error || 'Failed to write remote file')
            }
            if (writeRes.mtime) {
              await storage.setItemRaw(`local:sync-metadata/timestamps/${item.key.replace('local:', '')}`, writeRes.mtime)
            }
          }
          else {
            const val = await storage.getItemRaw(item.key)
            if (val) {
              const writeRes = await client.writeFile(relPath, JSON.stringify(val, null, 2))
              if (!writeRes.success) {
                throw new Error(writeRes.error || 'Failed to write remote file')
              }
              if (writeRes.mtime) {
                await storage.setItemRaw(`local:sync-metadata/timestamps/${item.key.replace('local:', '')}`, writeRes.mtime)
              }
            }
          }
        }
        else if (item.action === 'delete') {
          const delRes = await client.deleteFile(relPath)
          if (!delRes.success) {
            throw new Error(delRes.error || 'Failed to delete remote file')
          }
        }

        await storage.removeItem(fullQueueKey)
      })
      storageState.isImportingRemoteData = false
      return true
    }
    catch (err) {
      storageState.isImportingRemoteData = false
      console.error('[SyncEngine] Failed to process outbox queue:', err)
      return false
    }
  }

  function shouldExcludeLocalStorageKey(key: string): boolean {
    // NOTICE: airi-cards and scene/backgrounds are too large for localStorage quota;
    // they are synced natively via IndexedDB / localforage so we exclude them from the dump/restore bridge.
    if (key === 'airi-cards')
      return true
    if (key === 'scene/backgrounds')
      return true
    if (key.startsWith('airi_cc_'))
      return true
    if (key.startsWith('settings/sync/'))
      return true
    if (key === 'settings/discord/enabled')
      return true
    return false
  }

  async function dumpLocalStorageToIndexedDb() {
    await logDebug('dumpLocalStorageToIndexedDb starting...')
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && !shouldExcludeLocalStorageKey(key)) {
        const val = localStorage.getItem(key) || ''
        const cachedVal = await storage.getItemRaw<{ value: string, originalKey?: string }>(`local:localstorage/${key}`)
        if (!cachedVal || cachedVal.value !== val || cachedVal.originalKey !== key) {
          await logDebug(`dumpLocalStorageToIndexedDb: key=${key} has changed. Writing to IndexedDB.`)
          await storage.setItemRaw(`local:localstorage/${key}`, { value: val, originalKey: key })
        }
      }
    }
    await logDebug('dumpLocalStorageToIndexedDb completed.')
  }

  async function restoreLocalStorageFromIndexedDb(opts?: { skipReload?: boolean }) {
    await logDebug('restoreLocalStorageFromIndexedDb starting...')
    let anyChanged = false
    try {
      const rawLocalKeys = await storage.getKeys('local')
      for (const rawKey of rawLocalKeys) {
        const fullKey = normalizeStorageKey(rawKey)
        if (fullKey && fullKey.startsWith('local:localstorage/')) {
          const key = fullKey.substring('local:localstorage/'.length)
          if (!shouldExcludeLocalStorageKey(key)) {
            const valObj = await storage.getItemRaw<{ value: string, originalKey?: string }>(rawKey)
            if (valObj && typeof valObj === 'object' && 'value' in valObj) {
              const val = valObj.value
              const targetKey = valObj.originalKey || key
              if (val !== null && val !== undefined) {
                const currentVal = localStorage.getItem(targetKey)
                if (currentVal !== val) {
                  await logDebug(`restoreLocalStorageFromIndexedDb: key=${targetKey} updated from IndexedDB.`)
                  try {
                    localStorage.setItem(targetKey, val)
                    anyChanged = true
                    window.dispatchEvent(new StorageEvent('storage', {
                      key: targetKey,
                      newValue: val,
                      storageArea: localStorage,
                    }))
                  }
                  catch (quotaErr) {
                    console.error(`[SyncEngine] Failed to write key ${targetKey} to localStorage:`, quotaErr)
                    await logDebug(`Failed to write key ${targetKey} to localStorage (quota exceeded).`)
                  }
                }
              }
            }
          }
        }
      }
      if (anyChanged && !opts?.skipReload) {
        await logDebug('restoreLocalStorageFromIndexedDb: LocalStorage changed. Reloading window...')
        toast.info('Settings updated, reloading interface...', { duration: 1500 })
        setTimeout(() => {
          window.location.reload()
        }, 1500)
      }
    }
    catch (e) {
      console.error('[SyncEngine] Failed to restore localStorage from IndexedDB:', e)
      await logDebug(`restoreLocalStorageFromIndexedDB error: ${e}`)
    }
    await logDebug('restoreLocalStorageFromIndexedDb completed.')
  }

  // Non-destructive startup restore: fills in localStorage keys that are ABSENT (null)
  // from the IndexedDB backup. Does NOT overwrite existing keys, does NOT reload.
  // Returns the list of keys that were written.
  async function restoreLocalStorageFromIndexedDbSafe(): Promise<string[]> {
    await logDebug('restoreLocalStorageFromIndexedDbSafe starting...')
    const restored: string[] = []
    try {
      const rawLocalKeys = await storage.getKeys('local')
      for (const rawKey of rawLocalKeys) {
        const fullKey = normalizeStorageKey(rawKey)
        if (fullKey && fullKey.startsWith('local:localstorage/')) {
          const key = fullKey.substring('local:localstorage/'.length)
          if (shouldExcludeLocalStorageKey(key))
            continue
          const valObj = await storage.getItemRaw<{ value: string, originalKey?: string }>(rawKey)
          if (valObj && typeof valObj === 'object' && 'value' in valObj) {
            const val = valObj.value
            const targetKey = valObj.originalKey || key
            // Only restore if the key is currently absent from localStorage
            if (localStorage.getItem(targetKey) !== null)
              continue
            if (val !== null && val !== undefined) {
              try {
                localStorage.setItem(targetKey, val)
                restored.push(targetKey)
                await logDebug(`restoreLocalStorageFromIndexedDbSafe: restored missing key=${targetKey}`)
              }
              catch (quotaErr) {
                console.error(`[SyncEngine] Safe restore: quota exceeded for key ${targetKey}:`, quotaErr)
              }
            }
          }
        }
      }
    }
    catch (e) {
      console.error('[SyncEngine] restoreLocalStorageFromIndexedDbSafe failed:', e)
      await logDebug(`restoreLocalStorageFromIndexedDbSafe error: ${e}`)
    }
    await logDebug(`restoreLocalStorageFromIndexedDbSafe completed. Restored ${restored.length} keys.`)
    return restored
  }

  function isMainWindow(): boolean {
    if (typeof window === 'undefined')
      return false
    const hash = window.location.hash || ''
    return hash === '' || hash === '#/' || hash === '#'
  }

  // Called once at app boot. Fills in any missing localStorage keys from IndexedDB
  // (safe, non-destructive), then if sync is enabled and the backup path is reachable,
  // kicks off a background full reconcile to pull any IndexedDB keys that were also lost.
  async function initializeFromLocalBackup(): Promise<void> {
    await logDebug('initializeFromLocalBackup starting...')
    try {
      const restored = await restoreLocalStorageFromIndexedDbSafe()
      if (restored.length > 0) {
        debug(`[SyncEngine] Boot restore: recovered ${restored.length} localStorage keys from IndexedDB:`, restored)
        for (const k of restored) {
          window.dispatchEvent(new StorageEvent('storage', { key: k, newValue: localStorage.getItem(k), storageArea: localStorage }))
        }
      }
      if (localStorage.getItem('settings/sync/enabled') === 'true') {
        if (isMainWindow()) {
          const lastTime = Number(localStorage.getItem('settings/sync/last-time') || '0')
          const intervalMin = typeof syncInterval.value === 'number' && syncInterval.value > 0 ? syncInterval.value : 30
          const msSinceLastSync = Date.now() - lastTime
          const intervalMs = intervalMin * 60 * 1000

          if (msSinceLastSync < intervalMs) {
            await logDebug(`[SyncEngine] Skipping startup reconcile: last sync was ${Math.round(msSinceLastSync / 1000)}s ago, interval is ${intervalMin}m.`)
            return
          }

          if (isSyncing.value || (typeof window !== 'undefined' && (window as any).__airiIsSyncing)) {
            await logDebug('initializeFromLocalBackup: Sync is already in progress, skipping background reconcile.')
            return
          }

          await logDebug('initializeFromLocalBackup: sync is enabled, kicking off background reconcile from disk...')
          // Run non-blocking so we don't block the rest of the App.vue startup pipeline.
          void (async () => {
            if (isSyncing.value || (typeof window !== 'undefined' && (window as any).__airiIsSyncing)) {
              await logDebug('initializeFromLocalBackup IIFE: Sync is already in progress, skipping background reconcile.')
              return
            }
            isSyncing.value = true
            if (typeof window !== 'undefined') {
              (window as any).__airiIsSyncing = true
            }
            try {
              // CRITICAL: dump current localStorage to IDB FIRST so every key gets a fresh
              // timestamp (= now). This prevents the subsequent reconcile from treating
              // a slightly-older remote file as "newer" and downloading it on top of the
              // user's current provider/voice/settings configuration.
              await dumpLocalStorageToIndexedDb()
              // Run lightweight startup reconcile — JSON data only, skip models/backgrounds
              // to prevent OOM from loading large binary assets into the renderer heap.
              const success = await reconcile({ skipBinaryAssets: true })
              if (success) {
                await restoreLocalStorageFromIndexedDb()
                window.dispatchEvent(new CustomEvent('airi:idb-key-updated', { detail: { key: 'local:airi-cards' } }))
                await logDebug('initializeFromLocalBackup: background reconcile + restore complete.')
              }
            }
            catch (e) {
              console.error('[SyncEngine] initializeFromLocalBackup background reconcile failed:', e)
              await logDebug(`initializeFromLocalBackup background reconcile error: ${e}`)
            }
            finally {
              isSyncing.value = false
              if (typeof window !== 'undefined') {
                (window as any).__airiIsSyncing = false
              }
            }
          })()
        }
        else {
          await logDebug('initializeFromLocalBackup: sync is enabled, but skipping remote reconcile in secondary window.')
        }
      }
    }
    catch (e) {
      console.error('[SyncEngine] initializeFromLocalBackup failed:', e)
      await logDebug(`initializeFromLocalBackup error: ${e}`)
    }
    await logDebug('initializeFromLocalBackup completed.')
  }

  // Trigger Sync
  async function triggerSync(force = true) {
    if (isSyncing.value || (typeof window !== 'undefined' && (window as any).__airiIsSyncing))
      return

    if (!force) {
      const lastTime = Number(localStorage.getItem('settings/sync/last-time') || '0')
      const intervalMin = typeof syncInterval.value === 'number' && syncInterval.value > 0 ? syncInterval.value : 30
      const msSinceLastSync = Date.now() - lastTime
      const intervalMs = intervalMin * 60 * 1000
      if (msSinceLastSync < intervalMs) {
        void logDebug(`[SyncEngine] Skipping auto-sync: last sync was ${Math.round(msSinceLastSync / 1000)}s ago, interval is ${intervalMin}m.`)
        return
      }
    }

    isSyncing.value = true
    if (typeof window !== 'undefined') {
      (window as any).__airiIsSyncing = true
    }
    syncError.value = ''

    try {
      // 0. Dump local storage changes
      await dumpLocalStorageToIndexedDb()

      // 1. Reconcile both ends
      const reconSuccess = await reconcile()
      if (!reconSuccess) {
        throw new Error('Reconciliation failed or backup directory is inaccessible.')
      }

      // 2. Process any remaining local outbox items
      const queueSuccess = await processOutbox()
      if (!queueSuccess) {
        throw new Error('Failed to fully process sync outbox.')
      }

      // 2.5. Restore synced values back to localStorage
      await restoreLocalStorageFromIndexedDb()

      // 2.6. Notify stores that consume native IndexedDB keys (not localStorage) to reload.
      // The airi-card store uses local:airi-cards directly in IndexedDB and has no automatic
      // reactivity watcher — dispatch an event so it can call loadCards() to pick up merged data.
      window.dispatchEvent(new CustomEvent('airi:idb-key-updated', { detail: { key: 'local:airi-cards' } }))

      await loadConflicts()

      lastSyncTime.value = Date.now()
      localStorage.setItem('settings/sync/last-time', String(lastSyncTime.value))
      toast.success('Cloud Sync completed successfully')
      broadcastReload(Date.now())
    }
    catch (err) {
      syncError.value = String(err)
      toast.error(`Sync Failed: ${syncError.value}`)
    }
    finally {
      isSyncing.value = false
      if (typeof window !== 'undefined') {
        (window as any).__airiIsSyncing = false
      }
      await flushDebugLogs()
    }
  }

  // Pure one-way force restore: clears local IndexedDB, localforage, and localStorage
  // (excluding sync setup keys) and downloads everything directly from the remote backup.
  async function forceRestoreFromRemote(opts?: { skipReload?: boolean }): Promise<boolean> {
    const client = getActiveClient()
    const connectionValidation = await client.validate()
    if (!connectionValidation.success) {
      toast.error(`Cannot restore: Storage connection failed: ${connectionValidation.error}`)
      return false
    }

    isSyncing.value = true
    syncError.value = ''
    storageState.isImportingRemoteData = true

    try {
      await logDebug('[Restore] Starting force restore from remote backup...')

      // 1. Wipe outbox queue
      const rawOutboxKeys = await storage.getKeys('outbox')
      for (const k of rawOutboxKeys) {
        await storage.removeItem(k)
      }

      // 2. Wipe local database entries (excluding sync settings)
      const rawLocalKeys = await storage.getKeys('local')
      for (const k of rawLocalKeys) {
        const normalized = normalizeStorageKey(k)
        if (normalized && (normalized.includes('settings/sync/') || normalized.includes('local:settings/sync/'))) {
          continue
        }
        await storage.removeItem(k)
      }

      // 3. Wipe localStorage (excluding sync settings and onboarding state)
      const keysToKeep = [
        'settings/sync/enabled',
        'settings/sync/interval',
        'settings/sync/conflict-strategy',
        'settings/sync/active-provider',
        'settings/sync/fs-path',
        'settings/sync/selective-enabled',
        'settings/sync/selective-checked-ids',
        'settings/sync/s3-endpoint',
        'settings/sync/s3-bucket',
        'settings/sync/s3-region',
        'settings/sync/s3-access-key-id',
        'settings/sync/s3-secret-access-key',
        'settings/discord/enabled',
        'airi-onboarding-state',
      ]
      const lsKeys = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && !keysToKeep.includes(key)) {
          lsKeys.push(key)
        }
      }
      for (const key of lsKeys) {
        localStorage.removeItem(key)
      }

      // 4. Wipe localforage (VRM/Live2D model files and backgrounds)
      await localforage.clear()

      // 5. List and download all files from remote
      const listRes = await client.listFiles()
      if (!listRes.success) {
        throw new Error(listRes.error || 'Failed to list remote files')
      }

      const remoteFiles = (listRes.files || []) as Array<{ relPath: string, mtime: number, size: number }>
      await logDebug(`[Restore] Found ${remoteFiles.length} remote files. Downloading...`)

      // A. Reconcile database files first
      const dbFiles = remoteFiles.filter(f => f.relPath.replace(/\\/g, '/').startsWith('db/'))
      await parallelLimit(dbFiles, 15, async (remoteFile) => {
        const localKey = getKeyForRelPath(remoteFile.relPath)
        if (!localKey)
          return

        const readRes = await client.readFile(remoteFile.relPath)
        if (readRes.success && readRes.content) {
          const data = JSON.parse(readRes.content)
          await storage.setItemRaw(localKey, data)
          await storage.setItemRaw(`local:sync-metadata/timestamps/${localKey.replace('local:', '')}`, remoteFile.mtime)
        }
      })

      // B. Reconcile binary backgrounds and models
      await reconcileBackgrounds()
      await reconcileModels()
      await reconcileMmdMotions()
      await reconcileVrmaAnimations()

      // C. Restore synced localStorage keys back to window.localStorage
      await restoreLocalStorageFromIndexedDb({ skipReload: opts?.skipReload })

      lastSyncTime.value = Date.now()
      localStorage.setItem('settings/sync/last-time', String(lastSyncTime.value))
      await logDebug('[Restore] Force restore completed successfully.')

      if (!opts?.skipReload) {
        toast.success('Restore completed successfully. Reloading...')
        setTimeout(() => {
          window.location.reload()
        }, 1000)
      }

      return true
    }
    catch (err: any) {
      syncError.value = String(err)
      toast.error(`Restore Failed: ${syncError.value}`)
      await logDebug(`[Restore] Restore failed: ${syncError.value}`)
      return false
    }
    finally {
      storageState.isImportingRemoteData = false
      isSyncing.value = false
      await flushDebugLogs()
    }
  }

  // Pure settings-only restore: pulls db/localstorage configuration files, overriding outbox
  async function restoreSettingsFromRemote(opts?: { skipReload?: boolean }): Promise<boolean> {
    const client = getActiveClient()
    const connectionValidation = await client.validate()
    if (!connectionValidation.success) {
      toast.error(`Cannot restore: Storage connection failed: ${connectionValidation.error}`)
      return false
    }

    isSyncing.value = true
    syncError.value = ''
    storageState.isImportingRemoteData = true

    try {
      await logDebug('[Restore Settings] Starting settings-only restore from remote backup...')

      // 1. List remote backup files
      const listRes = await client.listFiles()
      if (!listRes.success) {
        throw new Error(listRes.error || 'Failed to list remote files')
      }

      const remoteFiles = (listRes.files || []) as Array<{ relPath: string, mtime: number, size: number }>
      const configFiles = remoteFiles.filter(f => f.relPath.replace(/\\/g, '/').startsWith('db/localstorage/'))
      await logDebug(`[Restore Settings] Found ${configFiles.length} remote configuration files. Importing...`)

      // 2. Process in parallel
      await parallelLimit(configFiles, 15, async (remoteFile) => {
        const localKey = getKeyForRelPath(remoteFile.relPath)
        if (!localKey)
          return

        // A. Clear outbox entry if it exists to prevent safety blocks
        const keyWithoutPrefix = localKey.replace('local:', '')
        const lsKey = keyWithoutPrefix.substring('localstorage/'.length)
        if (shouldExcludeLocalStorageKey(lsKey))
          return

        const outboxKey = `outbox:queue/${keyWithoutPrefix}`
        await storage.removeItem(outboxKey)

        // B. Read remote file content
        const readRes = await client.readFile(remoteFile.relPath)
        if (readRes.success && readRes.content) {
          try {
            const data = JSON.parse(readRes.content)

            // C. Save to local IndexedDB unstorage
            await storage.setItemRaw(localKey, data)

            // D. Save to local localStorage for immediate renderer state
            if (data && data.value !== undefined) {
              const lsKey = keyWithoutPrefix.substring('localstorage/'.length)
              localStorage.setItem(lsKey, data.value)
            }

            // E. Align local sync metadata timestamp to remote file mtime
            await storage.setItemRaw(`local:sync-metadata/timestamps/${keyWithoutPrefix}`, remoteFile.mtime)
          }
          catch (e) {
            console.error(`[Restore Settings] Failed to parse content for ${remoteFile.relPath}:`, e)
          }
        }
      })

      lastSyncTime.value = Date.now()
      localStorage.setItem('settings/sync/last-time', String(lastSyncTime.value))
      await logDebug('[Restore Settings] Settings restore completed successfully.')

      if (!opts?.skipReload) {
        toast.success('Settings restored successfully. Reloading...')
        setTimeout(() => {
          window.location.reload()
        }, 1000)
      }

      return true
    }
    catch (err: any) {
      syncError.value = String(err)
      toast.error(`Restore Settings Failed: ${syncError.value}`)
      await logDebug(`[Restore Settings] Restore failed: ${syncError.value}`)
      return false
    }
    finally {
      storageState.isImportingRemoteData = false
      isSyncing.value = false
      await flushDebugLogs()
    }
  }

  // Background Auto Sync Interval Trigger
  let syncTimer: any = null

  function startAutoSyncTimer() {
    stopAutoSyncTimer()
    if (!syncEnabled.value)
      return

    // Only run the auto sync timer in the main window to prevent multiple concurrent intervals
    // running in secondary windows/overlays.
    if (!isMainWindow()) {
      void logDebug('[SyncEngine] Auto sync timer initialization skipped: not in main window.')
      return
    }

    const intervalMin = typeof syncInterval.value === 'number' && syncInterval.value > 0 ? syncInterval.value : 30
    const ms = intervalMin * 60 * 1000
    void logDebug(`[SyncEngine] Starting auto sync timer with interval ${intervalMin} minutes (${ms} ms)`)

    if (typeof window !== 'undefined') {
      const g = window as any
      if (g.__airiSyncTimer) {
        clearInterval(g.__airiSyncTimer)
      }
      g.__airiSyncTimer = setInterval(() => {
        void logDebug('[SyncEngine] Auto sync timer interval triggered')
        void triggerSync(false)
      }, ms)
      syncTimer = g.__airiSyncTimer
    }
    else {
      syncTimer = setInterval(() => {
        void triggerSync(false)
      }, ms)
    }
  }

  function stopAutoSyncTimer() {
    if (syncTimer) {
      clearInterval(syncTimer)
      syncTimer = null
    }
    if (typeof window !== 'undefined') {
      const g = window as any
      if (g.__airiSyncTimer) {
        clearInterval(g.__airiSyncTimer)
        g.__airiSyncTimer = null
      }
    }
  }

  // Watchers to restart timer when config changes
  watch([syncEnabled, syncInterval], () => {
    if (syncEnabled.value) {
      startAutoSyncTimer()
    }
    else {
      stopAutoSyncTimer()
    }
  }, { immediate: true })

  // Auto-clear outbox items if sync is disabled to reclaim disk space
  watch(syncEnabled, async (enabled) => {
    if (!enabled) {
      try {
        const rawOutboxKeys = await storage.getKeys('outbox')
        for (const k of rawOutboxKeys) {
          await storage.removeItem(k)
        }
        debug('[SyncEngine] Cleared sync outbox because Cloud Sync is disabled.')
      }
      catch (e) {
        console.error('[SyncEngine] Failed to clear sync outbox:', e)
      }
    }
  }, { immediate: true })

  async function fetchGDriveManifest() {
    try {
      const res = await fetch(`${SERVER_URL}/api/gdrive/manifest`, {
        credentials: 'include',
      })
      if (res.ok) {
        return await res.json()
      }
      const data = await res.json()
      console.error('[SyncEngine] Failed to fetch gdrive manifest:', data.error)
    }
    catch (e) {
      console.error('[SyncEngine] Error fetching gdrive manifest:', e)
    }
    return { version: '1.0', providers: [] }
  }

  async function saveGDriveManifest(manifest: any) {
    try {
      const res = await fetch(`${SERVER_URL}/api/gdrive/manifest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(manifest),
        credentials: 'include',
      })
      if (res.ok) {
        return true
      }
      const data = await res.json()
      console.error('[SyncEngine] Failed to save gdrive manifest:', data.error)
    }
    catch (e) {
      console.error('[SyncEngine] Error saving gdrive manifest:', e)
    }
    return false
  }

  // Initialize conflicts on store load
  void loadConflicts()

  return {
    syncEnabled,
    syncInterval,
    conflictStrategy,
    activeProvider,
    fsBackupPath,
    s3Endpoint,
    s3Bucket,
    s3Region,
    s3AccessKeyId,
    s3SecretAccessKey,
    isSyncing,
    lastSyncTime,
    syncError,
    conflicts,

    validatePath,
    validateConnection,
    triggerSync,
    getRemoteCatalog,
    downloadSpecificModel,
    readRemoteFile,
    resolveConflict,
    loadConflicts,
    initializeFromLocalBackup,
    forceRestoreFromRemote,
    restoreSettingsFromRemote,
    selectiveSyncEnabled,
    selectiveCheckedIds,
    fetchGDriveManifest,
    saveGDriveManifest,
  }
})
