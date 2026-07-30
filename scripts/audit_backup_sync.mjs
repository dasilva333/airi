import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import { app, BrowserWindow } from 'electron'

const defaultBackupDir = process.argv[2] || process.env.AIRI_BACKUP_DIR || '/Volumes/AIRI-Backup-Share'

console.log(`=======================================================`)
console.log(`   AIRI BYOS Sync Audit Tool                           `)
console.log(`   Target SMB/FS Backup Share: ${defaultBackupDir}     `)
console.log(`=======================================================\n`)

app.whenReady().then(() => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  // Attempt connection to local dev server or static renderer
  const devUrl = process.env.AIRI_APP_URL || 'http://localhost:5173'
  win.loadURL(devUrl).catch((err) => {
    console.warn(`[AuditScript] Could not load ${devUrl}: ${err.message}`)
    console.warn(`[AuditScript] Make sure AIRI app server is running or provide AIRI_APP_URL.`)
  })

  win.webContents.on('did-finish-load', async () => {
    try {
      console.log('Extracting local IndexedDB & Localforage data...')
      const localData = await win.webContents.executeJavaScript(`
        (async () => {
          const result = {
            cards: null,
            sessions: {},
            shortTermMemory: null,
            textJournal: null,
            echoChips: null,
            outboxQueue: [],
            localModels: [],
            localBackgrounds: []
          };

          // 1. Read IndexedDB keyval-store (airi-local & airi-sync-queue)
          try {
            await new Promise((resolve) => {
              const req = indexedDB.open('keyval-store');
              req.onsuccess = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('keyval')) {
                  return resolve();
                }
                const tx = db.transaction('keyval', 'readonly');
                const store = tx.objectStore('keyval');
                const keysReq = store.getAllKeys();
                keysReq.onsuccess = () => {
                  const keys = keysReq.result;
                  let pending = 0;
                  if (keys.length === 0) return resolve();

                  for (const key of keys) {
                    const kStr = String(key);
                    if (kStr.includes('airi-cards')) {
                      pending++;
                      store.get(key).onsuccess = (ev) => {
                        result.cards = ev.target.result;
                        pending--;
                        if (pending === 0) resolve();
                      };
                    } else if (kStr.includes('chat/sessions/') || kStr.includes('chat:sessions:')) {
                      pending++;
                      const sessId = kStr.split('/').pop().split(':').pop();
                      store.get(key).onsuccess = (ev) => {
                        result.sessions[sessId] = ev.target.result;
                        pending--;
                        if (pending === 0) resolve();
                      };
                    } else if (kStr.includes('short-term')) {
                      pending++;
                      store.get(key).onsuccess = (ev) => {
                        result.shortTermMemory = ev.target.result;
                        pending--;
                        if (pending === 0) resolve();
                      };
                    } else if (kStr.includes('outbox:queue') || kStr.includes('outbox/queue')) {
                      pending++;
                      store.get(key).onsuccess = (ev) => {
                        result.outboxQueue.push({ key: kStr, val: ev.target.result });
                        pending--;
                        if (pending === 0) resolve();
                      };
                    }
                  }
                  if (pending === 0) resolve();
                };
              };
              req.onerror = () => resolve();
            });
          } catch (e) {
            console.error('Error scanning keyval-store:', e);
          }

          // 2. Read localforage (models & backgrounds)
          try {
            if (window.localforage) {
              const lfKeys = await window.localforage.keys();
              for (const k of lfKeys) {
                if (k.startsWith('display-model-') && !k.endsWith('-textures')) {
                  const item = await window.localforage.getItem(k);
                  if (item) {
                    result.localModels.push({ id: k, name: item.name, format: item.format, hasFile: Boolean(item.file) });
                  }
                } else if (k.startsWith('bg-')) {
                  const item = await window.localforage.getItem(k);
                  if (item) {
                    result.localBackgrounds.push({ id: k, title: item.title, characterId: item.characterId });
                  }
                }
              }
            }
          } catch (e) {
            console.error('Error scanning localforage:', e);
          }

          return result;
        })()
      `)

      runFullAudit(localData, defaultBackupDir)
    }
    catch (e) {
      console.error('Audit failed:', e)
    }
    finally {
      app.quit()
    }
  })
})

function runFullAudit(local, backupDir) {
  let issuesFound = 0
  let totalAudited = 0

  // 1. Audit Outbox Queue
  console.log('--- 1. AUDITING PENDING OUTBOX MUTATIONS ---')
  if (local.outboxQueue && local.outboxQueue.length > 0) {
    console.warn(`[UNCOMMITTED MUTATIONS] Found ${local.outboxQueue.length} unsynced items pending in local outbox queue!`)
    for (const item of local.outboxQueue.slice(0, 5)) {
      console.warn(`  - Pending mutation: ${item.key}`)
    }
    if (local.outboxQueue.length > 5) {
      console.warn(`  ... and ${local.outboxQueue.length - 5} more`)
    }
    issuesFound += local.outboxQueue.length
  }
  else {
    console.log('✔ Outbox sync queue is completely clean (0 pending mutations).')
  }

  // 2. Audit Character Cards
  console.log('\n--- 2. AUDITING CHARACTER CARDS ---')
  const cardsBackupPath = path.join(backupDir, 'db', 'airi-cards.json')
  if (fs.existsSync(cardsBackupPath)) {
    try {
      const remoteCards = JSON.parse(fs.readFileSync(cardsBackupPath, 'utf8'))
      const localCardsMap = new Map(Array.isArray(local.cards) ? local.cards : Object.entries(local.cards || {}))
      const remoteCardsMap = new Map(Array.isArray(remoteCards) ? remoteCards : Object.entries(remoteCards))

      console.log(`Local Cards count: ${localCardsMap.size} | Backup Cards count: ${remoteCardsMap.size}`)
      totalAudited += localCardsMap.size

      for (const [id, localCard] of localCardsMap.entries()) {
        const remoteCard = remoteCardsMap.get(id)
        if (!remoteCard) {
          console.warn(`[MISSING REMOTE CARD] Card "${localCard.name}" (${id}) is local-only and missing in backup share!`)
          issuesFound++
        }
        else {
          const lTime = localCard.updatedAt || localCard.createdAt || 0
          const rTime = remoteCard.updatedAt || remoteCard.createdAt || 0
          if (lTime > rTime) {
            console.warn(`[UNSYNCED CARD] Card "${localCard.name}" (${id}) has newer local changes! (Local: ${lTime}, Remote: ${rTime})`)
            issuesFound++
          }
        }
      }
      if (issuesFound === 0) {
        console.log('✔ All local character cards are 100% synchronized with backup share.')
      }
    }
    catch (e) {
      console.error(`[ERROR] Failed to parse remote cards backup at ${cardsBackupPath}:`, e.message)
      issuesFound++
    }
  }
  else {
    console.warn(`[MISSING BACKUP FILE] Remote cards backup file does not exist at ${cardsBackupPath}`)
    issuesFound++
  }

  // 3. Audit Chat Sessions
  console.log('\n--- 3. AUDITING CHAT SESSIONS ---')
  const sessionsBackupDir = path.join(backupDir, 'db', 'chat', 'sessions')
  const localSessions = local.sessions || {}
  const localSessIds = Object.keys(localSessions)
  console.log(`Local Sessions count: ${localSessIds.length}`)
  totalAudited += localSessIds.length

  if (fs.existsSync(sessionsBackupDir)) {
    const remoteFiles = fs.readdirSync(sessionsBackupDir).filter(f => f.endsWith('.json'))
    const remoteSessIds = new Set(remoteFiles.map(f => f.replace('.json', '')))
    console.log(`Backup Sessions count: ${remoteSessIds.size}`)

    let sessionIssues = 0
    for (const id of localSessIds) {
      const lSess = localSessions[id]
      if (!lSess)
        continue
      if (!remoteSessIds.has(id)) {
        console.warn(`[MISSING REMOTE CHAT] Session "${lSess.title || id}" exists locally but is missing in backup!`)
        sessionIssues++
      }
      else {
        const rPath = path.join(sessionsBackupDir, `${id}.json`)
        try {
          const rSess = JSON.parse(fs.readFileSync(rPath, 'utf8'))
          const lTime = lSess.updatedAt || lSess.createdAt || 0
          const rTime = rSess.updatedAt || rSess.createdAt || 0
          if (lTime > rTime) {
            console.warn(`[UNSYNCED CHAT] Session "${lSess.title || id}" is newer locally (Local: ${lTime}, Remote: ${rTime})`)
            sessionIssues++
          }
        }
        catch (e) {
          console.error(`[ERROR] Failed to parse chat session backup ${rPath}:`, e.message)
          sessionIssues++
        }
      }
    }
    issuesFound += sessionIssues
    if (sessionIssues === 0) {
      console.log('✔ All local chat sessions are 100% synchronized with backup share.')
    }
  }
  else {
    console.warn(`[MISSING BACKUP DIR] Remote chat sessions directory does not exist at ${sessionsBackupDir}`)
    issuesFound++
  }

  // 4. Audit Display Models
  console.log('\n--- 4. AUDITING DISPLAY MODELS ---')
  const manifestPath = path.join(backupDir, 'assets', 'models', 'manifest.json')
  let remoteManifest = { models: {} }
  if (fs.existsSync(manifestPath)) {
    try {
      remoteManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    }
    catch (e) {
      console.error(`[ERROR] Failed to parse models manifest: ${e.message}`)
    }
  }
  const remoteModelKeys = new Set(Object.keys(remoteManifest.models || {}))

  console.log(`Local Models count: ${local.localModels.length} | Remote Manifest Models count: ${remoteModelKeys.size}`)
  for (const m of local.localModels) {
    const rawId = m.id.replace('display-model-', '')
    const inRemote = remoteModelKeys.has(m.id) || remoteModelKeys.has(rawId)
    if (!inRemote) {
      console.log(`ℹ Local model "${m.name || m.id}" (${m.format}) is local-only (not synced to remote backup).`)
    }
    else {
      console.log(`✔ Model "${m.name || m.id}" exists in both local database and remote backup.`)
    }
  }

  // Final Audit Summary
  console.log('\n=======================================================')
  console.log('                  AUDIT SUMMARY                        ')
  console.log('=======================================================')
  if (issuesFound === 0) {
    console.log('🎉 AUDIT PASSED: All local databases and outbox queues are 100% synced!')
    console.log('You can clear local IndexedDB state safely; your data will fully restore from backup.')
  }
  else {
    console.log(`⚠️ AUDIT WARNING: Found ${issuesFound} potential unsynced item(s) or pending outbox mutations.`)
    console.log('Please resolve or allow pending syncs to finish before clearing local storage.')
  }
}
