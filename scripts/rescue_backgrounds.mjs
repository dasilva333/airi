/**
 * rescue_backgrounds.mjs
 *
 * One-shot rescue script: reads all bg-* entries from the Electron app's
 * localforage (via headless BrowserWindow on the real app origin), compares
 * against the remote backup share, uploads any missing ones, and optionally
 * re-encodes them as AVIF/WebP via sharp for long-term space efficiency.
 *
 * Usage:
 *   npx electron scripts/rescue_backgrounds.mjs [backup-dir] [--optimize] [--dry-run]
 *
 * Options:
 *   --optimize   Re-encode existing remote PNGs + new uploads as AVIF via sharp
 *   --dry-run    Report gaps without writing any files
 *   --avif       Force AVIF output (default when --optimize is set)
 *   --webp       Use WebP instead of AVIF (smaller tooling compat risk)
 */

import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import process from 'node:process'

import { app, BrowserWindow, ipcMain } from 'electron'

const args = process.argv.slice(2)
const backupDir = args.find(a => !a.startsWith('--')) || process.env.AIRI_BACKUP_DIR || '/Volumes/AIRI-Backup-Share'
const optimize = args.includes('--optimize')
const dryRun = args.includes('--dry-run')
const useWebP = args.includes('--webp')
const useAvif = !useWebP // default to avif when optimizing

const REMOTE_BG_DIR = path.join(backupDir, 'assets', 'backgrounds')

let sharp = null
if (optimize) {
  try {
    sharp = (await import('sharp')).default
    console.log('[Rescue] ✔ sharp loaded — image optimization enabled')
  }
  catch (e) {
    console.warn('[Rescue] ⚠ sharp not available, skipping optimization:', e.message)
  }
}

console.log(`
╔══════════════════════════════════════════════════════════╗
║         AIRI Background Rescue & Optimization Script      ║
╠══════════════════════════════════════════════════════════╣
║  Backup dir : ${backupDir.padEnd(43)}║
║  Mode       : ${(dryRun ? 'DRY RUN (no writes)' : optimize ? `RESCUE + OPTIMIZE (${useAvif ? 'AVIF' : 'WebP'})` : 'RESCUE (upload missing)').padEnd(43)}║
╚══════════════════════════════════════════════════════════╝
`)

const userDataPath = process.env.AIRI_USER_DATA
  || path.join(app.getPath('appData'), '@proj-airi', 'stage-tamagotchi')
app.setPath('userData', userDataPath)

function ensureLocalOriginServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('<!DOCTYPE html><html><head><title>AIRI Rescue</title></head><body>AIRI Background Rescue Origin</body></html>')
    })
    // NOTICE: MUST use port 5173 — Electron partitions IndexedDB by URL origin
    // (http://localhost:5173). Using any other port creates a separate, empty database.
    // If the dev server is already on 5173, we skip our own server — the real app page
    // also fires did-finish-load and has the same nodeIntegration access.
    server.on('error', () => {
      console.log('[Rescue] Port 5173 already in use (dev server running) — will use it directly.')
      resolve(null)
    })
    server.listen(5173, '127.0.0.1', () => {
      console.log('[Rescue] Origin server started on port 5173.')
      resolve(server)
    })
  })
}

// Collect blob chunks sent from renderer via IPC
const bgChunks = new Map() // id -> { meta, chunks: string[] }
ipcMain.on('rescue-bg-meta', (event, { id, meta, totalChunks }) => {
  bgChunks.set(id, { meta, chunks: new Array(totalChunks).fill(null) })
})
ipcMain.on('rescue-bg-chunk', (event, { id, index, data }) => {
  const entry = bgChunks.get(id)
  if (entry)
    entry.chunks[index] = data
})
ipcMain.on('rescue-progress', (event, msg) => {
  console.log(`[Progress] ${msg}`)
})

app.whenReady().then(async () => {
  await ensureLocalOriginServer()

  const win = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  })

  win.webContents.on('did-fail-load', (event, code, desc) => {
    console.error(`[Rescue] Page failed to load: ${code} ${desc}`)
    app.quit()
  })

  // NOTICE: loadURL is called after handlers are registered to avoid missing did-finish-load
  win.loadURL('http://localhost:5173')

  win.webContents.on('did-finish-load', async () => {
    try {
      console.log('[Rescue] Renderer ready — extracting backgrounds from localforage...\n')

      // Extract all bg-* entries from localforage, sending blobs as chunked base64 via IPC
      await win.webContents.executeJavaScript(`
        (async () => {
          const { ipcRenderer } = require('electron');
          const log = (m) => ipcRenderer.send('rescue-progress', m);

          const CHUNK_SIZE = 512 * 1024; // 512 KB per IPC chunk

          const keys = await new Promise((res, rej) => {
            const req = indexedDB.open('localforage');
            req.onsuccess = (e) => {
              const db = e.target.result;
              const storeName = db.objectStoreNames.contains('keyvaluepairs')
                ? 'keyvaluepairs' : db.objectStoreNames[0];
              if (!storeName) return res([]);
              db.transaction(storeName, 'readonly')
                .objectStore(storeName)
                .getAllKeys()
                .onsuccess = (ev) => res(ev.target.result);
            };
            req.onerror = () => res([]);
          });

          const bgKeys = keys.filter(k => String(k).startsWith('bg-'));
          log('Found ' + bgKeys.length + ' background keys in localforage');

          for (let i = 0; i < bgKeys.length; i++) {
            const key = bgKeys[i];
            log('Exporting [' + (i + 1) + '/' + bgKeys.length + ']: ' + key);

            const entry = await new Promise((res, rej) => {
              const req2 = indexedDB.open('localforage');
              req2.onsuccess = (e) => {
                const db = e.target.result;
                const storeName = db.objectStoreNames.contains('keyvaluepairs')
                  ? 'keyvaluepairs' : db.objectStoreNames[0];
                db.transaction(storeName, 'readonly')
                  .objectStore(storeName)
                  .get(key)
                  .onsuccess = (ev) => res(ev.target.result);
              };
              req2.onerror = () => res(null);
            });

            if (!entry || !entry.blob) {
              log('  Skipping ' + key + ' — no blob data');
              continue;
            }

            // Convert Blob to base64 string
            const arrayBuf = await entry.blob.arrayBuffer();
            const uint8 = new Uint8Array(arrayBuf);
            let binary = '';
            for (let j = 0; j < uint8.length; j++) binary += String.fromCharCode(uint8[j]);
            const b64 = btoa(binary);

            // Send metadata first
            const { blob, ...meta } = entry;
            const totalChunks = Math.ceil(b64.length / CHUNK_SIZE);
            ipcRenderer.send('rescue-bg-meta', { id: key, meta, totalChunks });

            // Send blob in chunks
            for (let c = 0; c < totalChunks; c++) {
              ipcRenderer.send('rescue-bg-chunk', {
                id: key,
                index: c,
                data: b64.slice(c * CHUNK_SIZE, (c + 1) * CHUNK_SIZE),
              });
            }
          }

          log('Renderer extraction complete — ' + bgKeys.length + ' backgrounds sent');
          return bgKeys.length;
        })()
      `)

      // Wait briefly for all IPC messages to arrive
      await new Promise(r => setTimeout(r, 3000))

      win.close()
      await runRescue()
    }
    catch (e) {
      console.error('[Rescue] Fatal error in renderer:', e)
      app.quit()
    }
  })
})

async function runRescue() {
  console.log(`\n[Rescue] Processing ${bgChunks.size} backgrounds extracted from localforage...\n`)

  if (!fs.existsSync(REMOTE_BG_DIR)) {
    console.warn(`[Rescue] Remote backgrounds dir doesn't exist: ${REMOTE_BG_DIR}`)
    if (!dryRun)
      fs.mkdirSync(REMOTE_BG_DIR, { recursive: true })
  }

  // Build set of already-backed-up IDs (have both .json AND .png)
  const existingFiles = new Set(fs.readdirSync(REMOTE_BG_DIR))
  const backedUpIds = new Set()
  for (const f of existingFiles) {
    if (f.endsWith('.json')) {
      const id = f.slice(0, -5)
      if (existingFiles.has(`${id}.png`) || existingFiles.has(`${id}.avif`) || existingFiles.has(`${id}.webp`)) {
        backedUpIds.add(id)
      }
    }
  }

  console.log(`[Rescue] Remote already has ${backedUpIds.size} complete background(s)`)

  let rescued = 0
  let skipped = 0
  let failed = 0

  // Size stats tracking
  const sizeStats = { pngBytes: [], outBytes: [] }

  for (const [id, { meta, chunks }] of bgChunks.entries()) {
    if (backedUpIds.has(id)) {
      process.stdout.write(`  ✔ Already backed up: ${meta.title || id}\n`)
      skipped++
      continue
    }

    // Reassemble base64 blob
    const b64 = chunks.join('')
    if (!b64) {
      console.warn(`  ⚠ No blob data for ${id}, skipping`)
      failed++
      continue
    }

    const imgBuffer = Buffer.from(b64, 'base64')
    sizeStats.pngBytes.push(imgBuffer.length)

    const jsonPath = path.join(REMOTE_BG_DIR, `${id}.json`)
    const imgPath = path.join(REMOTE_BG_DIR, `${id}.${optimize && sharp ? (useAvif ? 'avif' : 'webp') : 'png'}`)

    process.stdout.write(`  ↑ Rescuing: ${(meta.title || id).slice(0, 60)} [${(imgBuffer.length / 1024).toFixed(0)} KB PNG]`)

    if (!dryRun) {
      try {
        // Write JSON sidecar
        fs.writeFileSync(jsonPath, JSON.stringify(meta, null, 2), 'utf8')

        let outBuffer = imgBuffer
        if (optimize && sharp) {
          if (useAvif) {
            outBuffer = await sharp(imgBuffer).avif({ quality: 72, effort: 4 }).toBuffer()
          }
          else {
            outBuffer = await sharp(imgBuffer).webp({ quality: 80, effort: 4 }).toBuffer()
          }
          sizeStats.outBytes.push(outBuffer.length)
          process.stdout.write(` → ${(outBuffer.length / 1024).toFixed(0)} KB ${useAvif ? 'AVIF' : 'WebP'} (${((1 - outBuffer.length / imgBuffer.length) * 100).toFixed(0)}% smaller)`)
        }
        else {
          sizeStats.outBytes.push(imgBuffer.length)
        }

        fs.writeFileSync(imgPath, outBuffer)
        process.stdout.write(' ✔\n')
        rescued++
      }
      catch (e) {
        process.stdout.write(` ✗ FAILED: ${e.message}\n`)
        failed++
      }
    }
    else {
      process.stdout.write(' [DRY RUN — would upload]\n')
      rescued++
    }
  }

  // Summary
  const avgPng = sizeStats.pngBytes.length
    ? sizeStats.pngBytes.reduce((a, b) => a + b, 0) / sizeStats.pngBytes.length
    : 0
  const avgOut = sizeStats.outBytes.length
    ? sizeStats.outBytes.reduce((a, b) => a + b, 0) / sizeStats.outBytes.length
    : 0
  const totalPngMB = sizeStats.pngBytes.reduce((a, b) => a + b, 0) / 1048576
  const totalOutMB = sizeStats.outBytes.reduce((a, b) => a + b, 0) / 1048576

  console.log(`
╔══════════════════════════════════════════════════════════╗
║                    RESCUE SUMMARY                         ║
╠══════════════════════════════════════════════════════════╣
║  Total in localforage : ${String(bgChunks.size).padEnd(32)}║
║  Already backed up    : ${String(skipped).padEnd(32)}║
║  Rescued (uploaded)   : ${String(rescued).padEnd(32)}║
║  Failed               : ${String(failed).padEnd(32)}║
╠══════════════════════════════════════════════════════════╣
║  Avg source PNG size  : ${(avgPng / 1024).toFixed(1).padEnd(28)} KB  ║
${optimize && sharp
  ? `║  Avg output ${(useAvif ? 'AVIF' : 'WebP').padEnd(5)} size : ${(avgOut / 1024).toFixed(1).padEnd(28)} KB  ║
║  Total size saved     : ${(totalPngMB - totalOutMB).toFixed(2).padEnd(28)} MB  ║
║  Space saving ratio   : ${((1 - totalOutMB / totalPngMB) * 100).toFixed(0).padEnd(27)}%   ║`
  : `║  Total PNG data       : ${totalPngMB.toFixed(2).padEnd(28)} MB  ║`}
╚══════════════════════════════════════════════════════════╝

💡 SPACE EFFICIENCY RECOMMENDATIONS:
  1. Re-encode existing remote PNGs to AVIF for ~60-75% size reduction:
       npx electron scripts/rescue_backgrounds.mjs --optimize --avif

  2. Cap background blob sizes at upload time (e.g. max 2 MB) by running
     a sharp resize pass in the background generation pipeline before
     writing to localforage. Selfies & AI images are often 4-8 MB PNG.

  3. Consider storing backgrounds as 1280x720 max resolution — most are
     displayed at CSS background-size:cover behind a small window, so
     anything above 1920px is pure waste.

  4. Implement a TTL-based eviction policy for localforage backgrounds:
     keep last N backgrounds per character + pinned ones; evict the rest
     from local cache (they remain on the remote share for restore).

  5. Add a background.format field to the metadata sidecar to tell the
     sync engine which remote file extension to look for (.avif vs .png)
     so the downloader can fetch the right file on restore.
`)

  app.quit()
}
