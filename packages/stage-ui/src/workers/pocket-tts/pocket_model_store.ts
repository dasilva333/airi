/**
 * Pocket TTS OPFS Model Store Manager.
 * Downloads Int8 ONNX model files from Hugging Face (KevinAHM/pocket-tts-onnx) into browser OPFS.
 */

const MANAGED_SCHEME = 'managed://'
const DEFAULT_EXTERNAL_MODEL_KEY = 'pocket-tts-onnx-external'
const INTERNAL_ROOT_DIR_NAME = 'pocket-tts-browser-model-store'
const HF_RESOLVE_BASE = 'https://huggingface.co/KevinAHM/pocket-tts-onnx/resolve/main/onnx/'
/**
 * Self-contained emscripten SentencePiece ESM (fs/Buffer shims inlined). Hosted in
 * KevinAHM's demo Space because HF's model repo doesn't ship it. Prefetched into
 * OPFS at load time (served as `text/plain`, which only `fetch` tolerates) and
 * later imported via a `blob:` URL with a JS MIME type.
 */
const SENTENCEPIECE_JS_URL = 'https://huggingface.co/spaces/KevinAHM/pocket-tts-web/resolve/main/sentencepiece.js'
const SENTENCEPIECE_JS_FILE_NAME = 'sentencepiece.js'

const REQUIRED_FILES = [
  'bundle.json',
  'tokenizer.model',
  'bos_before_voice.npy',
  'flow_lm_main_int8.onnx',
  'flow_lm_flow_int8.onnx',
  'mimi_decoder_int8.onnx',
  'mimi_encoder_int8.onnx',
  'text_conditioner_int8.onnx',
]

function normalizeRelativePath(relativePath: string): string {
  const parts = String(relativePath || '')
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean)
  return parts.join('/')
}

async function ensureDirectoryPath(rootHandle: FileSystemDirectoryHandle, relativePath: string): Promise<FileSystemDirectoryHandle> {
  const normalized = normalizeRelativePath(relativePath)
  if (!normalized)
    return rootHandle
  const segments = normalized.split('/')
  let currentHandle = rootHandle
  for (const seg of segments) {
    currentHandle = await currentHandle.getDirectoryHandle(seg, { create: true })
  }
  return currentHandle
}

async function hasFile(rootHandle: FileSystemDirectoryHandle, relativePath: string): Promise<boolean> {
  try {
    const normalized = normalizeRelativePath(relativePath)
    const segments = normalized.split('/')
    const fileName = segments.pop()!
    const dirHandle = await ensureDirectoryPath(rootHandle, segments.join('/'))
    const fileHandle = await dirHandle.getFileHandle(fileName)
    const fileObj = await fileHandle.getFile()

    // Minimum size check to reject 133-byte Git LFS text pointers
    if (fileName !== 'bundle.json' && fileObj.size < 1000) {
      console.info(`[Pocket ModelStore] File "${fileName}" in OPFS is invalid LFS pointer (${fileObj.size} bytes). Forcing re-download...`)
      return false
    }

    return fileObj.size > 0
  }
  catch {
    return false
  }
}

async function downloadAndWriteFile(
  rootHandle: FileSystemDirectoryHandle,
  relativePath: string,
  url: string,
  options: { accessToken?: string } = {},
): Promise<void> {
  const normalized = normalizeRelativePath(relativePath)
  const segments = normalized.split('/')
  const fileName = segments.pop()!
  const dirHandle = await ensureDirectoryPath(rootHandle, segments.join('/'))

  const headers: Record<string, string> = {}
  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`
  }

  console.info(`[Pocket ModelStore] HTTP GET -> ${url}`)
  const response = await fetch(url, { headers })
  if (!response.ok) {
    console.error(`[Pocket ModelStore] HTTP ${response.status} failed for ${url}`)
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`)
  }

  const fileHandle = await dirHandle.getFileHandle(fileName, { create: true })
  const writable = await fileHandle.createWritable()

  if (response.body && typeof response.body.getReader === 'function') {
    const reader = response.body.getReader()
    let bytesDownloaded = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done)
        break
      bytesDownloaded += value.length
      await writable.write(value)
    }
    console.info(`[Pocket ModelStore] Successfully wrote ${bytesDownloaded} bytes for ${fileName}`)
  }
  else {
    const blob = await response.blob()
    await writable.write(blob)
    console.info(`[Pocket ModelStore] Successfully wrote ${blob.size} bytes for ${fileName}`)
  }

  await writable.close()
}

/**
 * Ensure the SentencePiece WASM module (`sentencepiece.js`) is cached in OPFS at
 * the store root. It is cross-origin and served as `text/plain`, so we fetch it
 * once into OPFS rather than importing it by URL.
 */
export async function ensureSentencePieceModule(accessToken = ''): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.storage || !navigator.storage.getDirectory) {
    throw new Error('OPFS storage (navigator.storage.getDirectory) is not supported in this browser environment.')
  }
  const opfsRoot = await navigator.storage.getDirectory()
  const appDir = await opfsRoot.getDirectoryHandle(INTERNAL_ROOT_DIR_NAME, { create: true })
  if (await hasFile(appDir, SENTENCEPIECE_JS_FILE_NAME))
    return
  await downloadAndWriteFile(appDir, SENTENCEPIECE_JS_FILE_NAME, SENTENCEPIECE_JS_URL, { accessToken })
}

/** Read an OPFS-cached file as a same-origin Blob (for `blob:` module import). */
export async function readOpfsFileBlob(fileName: string, mimeType: string): Promise<Blob> {
  const opfsRoot = await navigator.storage.getDirectory()
  const appDir = await opfsRoot.getDirectoryHandle(INTERNAL_ROOT_DIR_NAME)
  const fileHandle = await appDir.getFileHandle(fileName)
  const file = await fileHandle.getFile()
  return new Blob([await file.arrayBuffer()], { type: mimeType })
}

export async function ensureExternalBrowserOnnxModels(options: {
  language?: string
  model?: string
  onProgress?: (p: { phase: string, fileName: string, fileIndex: number, fileCount: number, message: string, percent: number }) => void
  accessToken?: string
} = {}): Promise<{ managedPath: string, opfsLangDir: FileSystemDirectoryHandle }> {
  if (typeof navigator === 'undefined' || !navigator.storage || !navigator.storage.getDirectory) {
    throw new Error('OPFS storage (navigator.storage.getDirectory) is not supported in this browser environment.')
  }

  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {}
  const langMap: Record<string, string> = {
    english: 'english_2026-04',
    french: 'french_24l',
    spanish: 'spanish_24l',
    german: 'german_24l',
    portuguese: 'portuguese_24l',
    italian: 'italian_24l',
  }
  const rawLang = options.language || options.model || 'english_2026-04'
  const langFolder = langMap[rawLang] || rawLang

  console.info(`[Pocket ModelStore] Initializing OPFS storage check for model folder: "${langFolder}"...`)

  const opfsRoot = await navigator.storage.getDirectory()
  const appDir = await opfsRoot.getDirectoryHandle(INTERNAL_ROOT_DIR_NAME, { create: true })
  const langDir = await appDir.getDirectoryHandle(langFolder, { create: true })

  const totalFiles = REQUIRED_FILES.length
  let fileIndex = 0

  for (const fileName of REQUIRED_FILES) {
    fileIndex++
    const targetRelPath = `${langFolder}/${fileName}`
    const fileExists = await hasFile(appDir, targetRelPath)

    const percent = Math.round((fileIndex / totalFiles) * 100)

    if (!fileExists) {
      console.info(`[Pocket ModelStore] [DOWNLOAD NEEDED] File ${fileIndex}/${totalFiles}: ${fileName}`)
      onProgress({
        phase: 'download',
        fileName,
        fileIndex,
        fileCount: totalFiles,
        percent,
        message: `Downloading ${fileName} (${fileIndex}/${totalFiles})...`,
      })

      const downloadUrl = `${HF_RESOLVE_BASE}${langFolder}/${fileName}`
      try {
        await downloadAndWriteFile(appDir, targetRelPath, downloadUrl, options)
      }
      catch (err) {
        console.error(`[Pocket ModelStore] Error downloading ${fileName}:`, err)
        throw err
      }
    }
    else {
      console.info(`[Pocket ModelStore] [OPFS CACHED] File ${fileIndex}/${totalFiles}: ${fileName}`)
      onProgress({
        phase: 'cached',
        fileName,
        fileIndex,
        fileCount: totalFiles,
        percent,
        message: `Cached ${fileName} (${fileIndex}/${totalFiles})`,
      })
    }
  }

  console.info(`[Pocket ModelStore] ✅ All ${totalFiles} ONNX model files present in OPFS for "${langFolder}".`)
  return {
    managedPath: `${MANAGED_SCHEME}${DEFAULT_EXTERNAL_MODEL_KEY}/${langFolder}`,
    opfsLangDir: langDir,
  }
}
