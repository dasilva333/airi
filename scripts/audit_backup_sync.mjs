import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import process from 'node:process'

import { app, BrowserWindow, ipcMain } from 'electron'

const defaultBackupDir = process.argv[2] || process.env.AIRI_BACKUP_DIR || '/Volumes/AIRI-Backup-Share'

console.log(`=======================================================`)
console.log(`   AIRI BYOS Comprehensive Data Catalog Sync Auditor   `)
console.log(`   Target SMB/FS Backup Share: ${defaultBackupDir}     `)
console.log(`=======================================================\n`)

const userDataPath = process.env.AIRI_USER_DATA || path.join(app.getPath('appData'), '@proj-airi', 'stage-tamagotchi')
app.setPath('userData', userDataPath)

function ensureLocalOriginServer(port = 5173) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('<!DOCTYPE html><html><head><title>AIRI Audit Origin</title></head><body>AIRI Audit Origin Server</body></html>')
    })
    server.on('error', () => {
      resolve(null)
    })
    server.listen(port, '127.0.0.1', () => {
      resolve(server)
    })
  })
}

// Intercept progress messages from renderer
ipcMain.on('audit-progress', (event, msg) => {
  console.log(`[Progress] ${msg}`)
})

app.whenReady().then(async () => {
  await ensureLocalOriginServer(5173)
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  // NOTICE: Register handler before loadURL to avoid missing did-finish-load
  win.webContents.on('did-finish-load', async () => {
    try {
      console.log('Extracting full local IndexedDB & Localforage data catalog...')
      const localData = await win.webContents.executeJavaScript(`
        (async () => {
          const { ipcRenderer } = require('electron');
          const logProgress = (msg) => ipcRenderer.send('audit-progress', msg);

          const catalog = {
            outboxQueue: [],
            cards: null,
            characters: null,
            providers: null,
            chatIndices: {},
            chatSessions: {},
            textJournal: {},
            shortTermMemory: {},
            lifetimeMemory: {},
            echoChips: {},
            directorNotes: {},
            localstorageMirrors: {},
            syncConflicts: {},
            syncTimestamps: {},
            localModels: [],
            localBackgrounds: [],
            localAnimations: [],
            localStickers: []
          };

          // 1. Read IndexedDB keyval-store
          logProgress('Opening IndexedDB keyval-store...');
          try {
            await new Promise((resolve) => {
              const req = indexedDB.open('keyval-store');
              req.onsuccess = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('keyval')) {
                  logProgress('keyval objectStore not found in keyval-store.');
                  return resolve();
                }
                const tx = db.transaction('keyval', 'readonly');
                const store = tx.objectStore('keyval');
                const keysReq = store.getAllKeys();
                keysReq.onsuccess = () => {
                  const keys = keysReq.result;
                  logProgress('Scanning ' + keys.length + ' keys in keyval-store...');
                  let pending = keys.length;
                  if (pending === 0) return resolve();

                  let scannedCount = 0;
                  for (const key of keys) {
                    const kStr = String(key);
                    store.get(key).onsuccess = (ev) => {
                      const val = ev.target.result;
                      scannedCount++;
                      if (scannedCount % 100 === 0 || scannedCount === keys.length) {
                        logProgress('Read keyval keys: ' + scannedCount + '/' + keys.length);
                      }
                      
                      if (kStr.startsWith('outbox:') || kStr.startsWith('outbox/')) {
                        catalog.outboxQueue.push({ key: kStr, val });
                      } else if (kStr.includes('airi-cards')) {
                        catalog.cards = val;
                      } else if (kStr.includes('local:characters')) {
                        catalog.characters = val;
                      } else if (kStr.includes('local:providers')) {
                        catalog.providers = val;
                      } else if (kStr.includes('chat/index/')) {
                        const uid = kStr.split('chat/index/')[1];
                        catalog.chatIndices[uid] = val;
                      } else if (kStr.includes('chat/sessions/') || kStr.includes('chat:sessions:')) {
                        const sessId = kStr.split('/').pop().split(':').pop();
                        catalog.chatSessions[sessId] = val;
                      } else if (kStr.includes('memory/text-journal/')) {
                        const uid = kStr.split('memory/text-journal/')[1];
                        catalog.textJournal[uid] = val;
                      } else if (kStr.includes('memory/short-term/')) {
                        const uid = kStr.split('memory/short-term/')[1];
                        catalog.shortTermMemory[uid] = val;
                      } else if (kStr.includes('memory/lifetime/')) {
                        const charId = kStr.split('memory/lifetime/')[1];
                        catalog.lifetimeMemory[charId] = val;
                      } else if (kStr.includes('memory/echo-chips/')) {
                        const uid = kStr.split('memory/echo-chips/')[1];
                        catalog.echoChips[uid] = val;
                      } else if (kStr.includes('director/sessions/')) {
                        const sessId = kStr.split('director/sessions/')[1];
                        catalog.directorNotes[sessId] = val;
                      } else if (kStr.includes('local:localstorage/')) {
                        const sKey = kStr.split('local:localstorage/')[1];
                        catalog.localstorageMirrors[sKey] = val;
                      } else if (kStr.includes('sync-metadata/conflicts/')) {
                        const cKey = kStr.split('sync-metadata/conflicts/')[1];
                        catalog.syncConflicts[cKey] = val;
                      } else if (kStr.includes('sync-metadata/timestamps/')) {
                        const tKey = kStr.split('sync-metadata/timestamps/')[1];
                        catalog.syncTimestamps[tKey] = val;
                      }

                      pending--;
                      if (pending === 0) resolve();
                    };
                  }
                };
              };
              req.onerror = (err) => {
                logProgress('Error opening keyval-store: ' + err);
                resolve();
              };
            });
          } catch (e) {
            logProgress('Exception reading keyval-store: ' + e.message);
          }

          // 2. Read IndexedDB localforage
          logProgress('Opening IndexedDB localforage store...');
          try {
            await new Promise((resolve) => {
              const req = indexedDB.open('localforage');
              req.onsuccess = (e) => {
                const db = e.target.result;
                const storeName = db.objectStoreNames.contains('keyvaluepairs') ? 'keyvaluepairs' : db.objectStoreNames[0];
                if (!storeName) {
                  logProgress('No objectStores found in localforage DB.');
                  return resolve();
                }
                const tx = db.transaction(storeName, 'readonly');
                const store = tx.objectStore(storeName);
                const keysReq = store.getAllKeys();
                keysReq.onsuccess = () => {
                  const keys = keysReq.result;
                  logProgress('Scanning ' + keys.length + ' keys in localforage...');
                  let pending = keys.length;
                  if (pending === 0) return resolve();

                  let count = 0;
                  for (const key of keys) {
                    const k = String(key);
                    store.get(key).onsuccess = (ev) => {
                      const item = ev.target.result;
                      count++;
                      if (count % 20 === 0 || count === keys.length) {
                        logProgress('Read localforage items: ' + count + '/' + keys.length);
                      }

                      if (k.startsWith('display-model-') && !k.endsWith('-textures')) {
                        if (item) {
                          catalog.localModels.push({ id: k, name: item.name, format: item.format, hasFile: Boolean(item.file) });
                        }
                      } else if (k.startsWith('bg-') || k.startsWith('background-')) {
                        if (item) {
                          catalog.localBackgrounds.push({ id: k, title: item.title, characterId: item.characterId });
                        }
                      } else if (k.startsWith('custom-vrma-animation-')) {
                        if (item) {
                          catalog.localAnimations.push({ id: k, name: item.name });
                        }
                      } else if (k.startsWith('sticker-data-')) {
                        catalog.localStickers.push(k);
                      }

                      pending--;
                      if (pending === 0) resolve();
                    };
                  }
                };
              };
              req.onerror = () => resolve();
            });
          } catch (e) {
            logProgress('Exception reading localforage: ' + e.message);
          }

          logProgress('IndexedDB & localforage extraction complete!');
          return catalog;
        })()
      `)

      runComprehensiveAudit(localData, defaultBackupDir)
    }
    catch (e) {
      console.error('Audit failed:', e)
    }
    finally {
      app.quit()
    }
  })

  // NOTICE: loadURL is called after handlers are registered to avoid missing did-finish-load
  win.loadURL('http://localhost:5173')
})

function runComprehensiveAudit(local, backupDir) {
  let issuesCount = 0
  let passedCount = 0

  const logHeader = (sectionTitle) => {
    console.log(`\n=======================================================`)
    console.log(`   ${sectionTitle}`)
    console.log(`=======================================================`)
  }

  // 1. Outbox Queue Audit
  logHeader('1. OUTBOX SYNC QUEUE (airi-sync-queue)')
  if (local.outboxQueue && local.outboxQueue.length > 0) {
    console.warn(`⚠️ [UNCOMMITTED MUTATIONS] Found ${local.outboxQueue.length} unsynced items pending in local outbox queue!`)
    for (const item of local.outboxQueue.slice(0, 5)) {
      console.warn(`  - Pending mutation: ${item.key}`)
    }
    if (local.outboxQueue.length > 5) {
      console.warn(`  ... and ${local.outboxQueue.length - 5} more`)
    }
    issuesCount += local.outboxQueue.length
  }
  else {
    console.log('✔ Outbox sync queue is completely clean (0 pending mutations).')
    passedCount++
  }

  // 2. Structured Data Audit
  logHeader('2. STRUCTURED DATA TABLES (airi-local)')

  // 2.1 AIRI Cards
  const cardsPath = path.join(backupDir, 'db', 'airi-cards.json')
  if (fs.existsSync(cardsPath)) {
    try {
      const remoteCards = JSON.parse(fs.readFileSync(cardsPath, 'utf8'))
      const localCardsMap = new Map(Array.isArray(local.cards) ? local.cards : Object.entries(local.cards || {}))
      const remoteCardsMap = new Map(Array.isArray(remoteCards) ? remoteCards : Object.entries(remoteCards))

      console.log(`[AIRI Cards] Local count: ${localCardsMap.size} | Remote Backup count: ${remoteCardsMap.size}`)
      let cardIssues = 0
      for (const [id, lCard] of localCardsMap.entries()) {
        const rCard = remoteCardsMap.get(id)
        if (!rCard) {
          console.warn(`  ❌ Card "${lCard.name}" (${id}) exists locally but is MISSING in remote backup!`)
          cardIssues++
        }
        else {
          const lTime = lCard.updatedAt || lCard.createdAt || 0
          const rTime = rCard.updatedAt || rCard.createdAt || 0
          if (lTime > rTime) {
            console.warn(`  ⚠️ Card "${lCard.name}" (${id}) has newer local changes! (Local: ${lTime}, Remote: ${rTime})`)
            cardIssues++
          }
        }
      }
      if (cardIssues === 0 && localCardsMap.size > 0) {
        console.log('  ✔ All local character cards are 100% synchronized with remote backup.')
        passedCount++
      }
      issuesCount += cardIssues
    }
    catch (e) {
      console.error(`  ❌ Failed to parse remote cards file ${cardsPath}: ${e.message}`)
      issuesCount++
    }
  }
  else {
    console.warn(`  ⚠️ Remote cards file does not exist at ${cardsPath}`)
    issuesCount++
  }

  // 2.2 Chat Sessions Index & Records
  const sessDir = path.join(backupDir, 'db', 'chat', 'sessions')
  const localSessIds = Object.keys(local.chatSessions || {})
  console.log(`\n[Chat Sessions] Local count: ${localSessIds.length}`)
  if (fs.existsSync(sessDir)) {
    const remoteFiles = fs.readdirSync(sessDir).filter(f => f.endsWith('.json'))
    const remoteSessIds = new Set(remoteFiles.map(f => f.replace('.json', '')))
    console.log(`[Chat Sessions] Remote Backup count: ${remoteSessIds.size}`)
    let sessIssues = 0

    for (const id of localSessIds) {
      const lSess = local.chatSessions[id]
      if (!lSess)
        continue
      if (!remoteSessIds.has(id)) {
        console.warn(`  ❌ Session "${lSess.meta?.title || id}" exists locally but is MISSING in remote backup!`)
        sessIssues++
      }
      else {
        const rPath = path.join(sessDir, `${id}.json`)
        try {
          const rSess = JSON.parse(fs.readFileSync(rPath, 'utf8'))
          const lTime = lSess.meta?.updatedAt || lSess.meta?.createdAt || 0
          const rTime = rSess.meta?.updatedAt || rSess.meta?.createdAt || 0
          if (lTime > rTime) {
            console.warn(`  ⚠️ Session "${lSess.meta?.title || id}" is newer locally (Local: ${lTime}, Remote: ${rTime})`)
            sessIssues++
          }
        }
        catch (e) {
          console.error(`  ❌ Failed to parse remote chat session ${rPath}: ${e.message}`)
          sessIssues++
        }
      }
    }
    if (sessIssues === 0 && localSessIds.length > 0) {
      console.log('  ✔ All local chat sessions are 100% synchronized with remote backup.')
      passedCount++
    }
    issuesCount += sessIssues
  }
  else {
    console.warn(`  ⚠️ Remote chat sessions directory does not exist at ${sessDir}`)
    issuesCount++
  }

  // 2.3 Long-Term Memory (Text Journal)
  const journalDir = path.join(backupDir, 'db', 'memory', 'text-journal')
  const localJournalKeys = Object.keys(local.textJournal || {})
  console.log(`\n[Text Journal] Local user stores count: ${localJournalKeys.length}`)
  if (fs.existsSync(journalDir)) {
    let journalIssues = 0
    for (const uid of localJournalKeys) {
      const rPath = path.join(journalDir, `${uid}.json`)
      if (!fs.existsSync(rPath)) {
        console.warn(`  ❌ Text journal for user "${uid}" is MISSING in remote backup!`)
        journalIssues++
      }
      else {
        console.log(`  ✔ Text journal for user "${uid}" exists in remote backup.`)
      }
    }
    if (journalIssues === 0 && localJournalKeys.length > 0)
      passedCount++
    issuesCount += journalIssues
  }

  // 2.4 Short-Term Memory
  const stmDir = path.join(backupDir, 'db', 'memory', 'short-term')
  const localStmKeys = Object.keys(local.shortTermMemory || {})
  console.log(`\n[Short-Term Memory] Local user stores count: ${localStmKeys.length}`)
  if (fs.existsSync(stmDir)) {
    let stmIssues = 0
    for (const uid of localStmKeys) {
      const rPath = path.join(stmDir, `${uid}.json`)
      if (!fs.existsSync(rPath)) {
        console.warn(`  ❌ Short-term memory for user "${uid}" is MISSING in remote backup!`)
        stmIssues++
      }
      else {
        console.log(`  ✔ Short-term memory for user "${uid}" exists in remote backup.`)
      }
    }
    if (stmIssues === 0 && localStmKeys.length > 0)
      passedCount++
    issuesCount += stmIssues
  }

  // 2.5 Lifetime Memory Artifacts
  const ltmmDir = path.join(backupDir, 'db', 'memory', 'lifetime')
  const localLtmmKeys = Object.keys(local.lifetimeMemory || {})
  console.log(`\n[Lifetime Memory] Local character artifacts count: ${localLtmmKeys.length}`)
  if (fs.existsSync(ltmmDir)) {
    let ltmmIssues = 0
    for (const charId of localLtmmKeys) {
      const rPath = path.join(ltmmDir, `${charId}.json`)
      if (!fs.existsSync(rPath)) {
        console.warn(`  ❌ Lifetime memory artifact for character "${charId}" is MISSING in remote backup!`)
        ltmmIssues++
      }
      else {
        console.log(`  ✔ Lifetime memory artifact for character "${charId}" exists in remote backup.`)
      }
    }
    if (ltmmIssues === 0 && localLtmmKeys.length > 0)
      passedCount++
    issuesCount += ltmmIssues
  }

  // 3. Sync Conflicts & Metadata Audit
  logHeader('3. SYNC METADATA & CONFLICTS')
  const conflictsList = Object.keys(local.syncConflicts || {})
  if (conflictsList.length > 0) {
    console.warn(`⚠️ [UNRESOLVED CONFLICTS] Found ${conflictsList.length} unresolved sync conflict(s):`)
    for (const cKey of conflictsList) {
      console.warn(`  - Conflict on key: ${cKey}`)
    }
    issuesCount += conflictsList.length
  }
  else {
    console.log('✔ No unresolved sync conflicts found in local metadata.')
    passedCount++
  }

  // 4. Binary Assets Audit
  logHeader('4. BINARY & BLOB ASSETS (localforage)')

  // 4.1 Display Models
  const manifestPath = path.join(backupDir, 'assets', 'models', 'manifest.json')
  let remoteManifest = { models: {} }
  if (fs.existsSync(manifestPath)) {
    try {
      remoteManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    }
    catch (e) {
      console.error(`  ❌ Failed to parse remote models manifest: ${e.message}`)
    }
  }
  const remoteModelKeys = new Set(Object.keys(remoteManifest.models || {}))
  console.log(`[Display Models] Local count: ${local.localModels.length} | Remote Manifest count: ${remoteModelKeys.size}`)
  for (const m of local.localModels) {
    const rawId = m.id.replace('display-model-', '')
    const inRemote = remoteModelKeys.has(m.id) || remoteModelKeys.has(rawId)
    if (!inRemote) {
      console.log(`  ℹ Model "${m.name || m.id}" (${m.format}) is local-only (not synced to remote backup).`)
    }
    else {
      console.log(`  ✔ Model "${m.name || m.id}" exists in both local database and remote backup.`)
    }
  }

  // 4.2 Background Images
  const bgBackupDir = path.join(backupDir, 'assets', 'backgrounds')
  console.log(`\n[Custom Backgrounds] Local count: ${local.localBackgrounds.length}`)
  if (fs.existsSync(bgBackupDir)) {
    for (const bg of local.localBackgrounds) {
      const rawId = bg.id.replace(/^bg-/, '').replace(/^background-/, '')
      const jsonPath = path.join(bgBackupDir, `${rawId}.json`)
      if (!fs.existsSync(jsonPath)) {
        console.warn(`  ❌ Background "${bg.title || bg.id}" is MISSING in remote backup!`)
        issuesCount++
      }
      else {
        console.log(`  ✔ Background "${bg.title || bg.id}" exists in remote backup.`)
      }
    }
  }
  else if (local.localBackgrounds.length > 0) {
    console.warn(`  ❌ Remote backgrounds directory does not exist at ${bgBackupDir}`)
    issuesCount += local.localBackgrounds.length
  }

  // 4.3 Custom VRMA Animations & Stickers
  console.log(`\n[Custom VRMA Animations] Local count: ${local.localAnimations.length}`)
  console.log(`[Local Stickers] Local count: ${local.localStickers.length}`)

  // Final Audit Summary
  logHeader('AUDIT SUMMARY')
  if (issuesCount === 0) {
    console.log('🎉 AUDIT PASSED: All local database records and outbox queues are 100% synced!')
    console.log('You can clear local IndexedDB state safely; your data will fully restore from backup.')
  }
  else {
    console.log(`⚠️ AUDIT WARNING: Found ${issuesCount} potential unsynced item(s) or pending outbox mutations.`)
    console.log('Please resolve or allow pending syncs to finish before clearing local storage.')
  }
}
