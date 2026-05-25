import JSZip from 'jszip'

/**
 * A texture file extracted from an MMD zip archive, paired with its relative path.
 *
 * `relativePath` is the path relative to the model file's directory (e.g. `tex/body.png`).
 * `file` is the extracted File object. Note that `File.name` only returns the basename,
 * so `relativePath` must be stored separately to correctly key the texture map.
 */
export interface MmdTextureFile {
  /** Path relative to the model file's directory, e.g. "tex/body.png" or "body.png" */
  relativePath: string
  /** The extracted file blob */
  file: File
}

/**
 * Result of extracting an MMD model from a zip archive.
 */
export interface MmdZipExtractResult {
  /** The PMX or PMD model file */
  modelFile: File
  /** All texture/resource files found alongside the model, with their relative paths */
  textureFiles: MmdTextureFile[]
}

/** File extensions recognized as MMD texture/resource files */
const TEXTURE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.bmp', '.tga', '.dds', '.spa', '.sph', '.toon'])

/** File extensions recognized as MMD model files */
const MODEL_EXTENSIONS = new Set(['.pmx', '.pmd'])

/**
 * Extract an MMD model and its textures from a zip archive.
 *
 * Handles multiple directory structures:
 * - Root-level: model and textures at zip root
 * - Single folder: model and textures inside one folder
 * - Nested: model in a subfolder with textures relative to it
 *
 * Use when:
 * - User imports a .zip file containing an MMD model
 *
 * Expects:
 * - A zip File/Blob containing at least one .pmx or .pmd file
 *
 * Returns:
 * - The model File and an array of texture Files with paths relative to the model
 */
export async function extractMmdFromZip(
  zipFile: File | Blob,
  onProgress?: (message: string) => void,
): Promise<MmdZipExtractResult | undefined> {
  const name = zipFile instanceof File ? zipFile.name : 'blob'
  console.log(`[MMD:Extractor] Starting extraction for: ${name}`)

  onProgress?.('Loading zip file...')
  const zip = await JSZip.loadAsync(zipFile, {
    decodeFileName: (bytes) => {
      try {
        // Try UTF-8 first
        return new TextDecoder('utf-8', { fatal: true }).decode(bytes as Uint8Array)
      } catch {
        // Fallback to Shift-JIS for Japanese MMD models
        return new TextDecoder('shift-jis').decode(bytes as Uint8Array)
      }
    },
  })
  const allPaths = Object.keys(zip.files).filter((p) => !zip.files[p].dir)
  console.log(`[MMD:Extractor] Found ${allPaths.length} files in zip.`)

  // Find the model file (prefer .pmx over .pmd)
  const modelPath = findModelFile(allPaths)
  if (!modelPath) {
    console.warn('[MMD:Extractor] No PMX or PMD file found in zip!')
    return undefined
  }
  console.log(`[MMD:Extractor] Detected model file: ${modelPath}`)

  // Determine the model's directory (for relative texture resolution)
  const modelDir = modelPath.includes('/') ? modelPath.substring(0, modelPath.lastIndexOf('/') + 1) : ''
  console.log(`[MMD:Extractor] Model directory: ${modelDir || '(root)'}`)

  // Extract the model file
  onProgress?.('Extracting model file...')
  const modelData = await zip.files[modelPath].async('blob')
  const modelFileName = modelPath.split('/').pop() ?? modelPath
  const modelFile = new File([modelData], modelFileName, { type: 'application/octet-stream' })

  // Extract texture files — collect all image/resource files
  const textureFiles: MmdTextureFile[] = []
  console.log('[MMD:Extractor] Scanning for textures...')

  let count = 0
  for (const filePath of allPaths) {
    if (filePath === modelPath) continue

    const ext = getExtension(filePath)
    if (!TEXTURE_EXTENSIONS.has(ext)) continue

    count++
    const fileData = await zip.files[filePath].async('blob')

    const normalizedFilePath = filePath.replace(/\\/g, '/')
    let relativePath: string
    if (normalizedFilePath.startsWith(modelDir)) {
      relativePath = normalizedFilePath.substring(modelDir.length)
    } else {
      relativePath = normalizedFilePath.split('/').pop() ?? normalizedFilePath
    }

    const fileName = relativePath.split('/').pop() ?? relativePath
    console.log(`[MMD:Extractor] Extracted texture: ${relativePath} (mapped as: ${relativePath.toLowerCase()})`)
    onProgress?.(`Extracting texture ${count}: ${fileName}`)

    textureFiles.push({
      file: new File([fileData], fileName, { type: guessMimeType(ext) }),
      relativePath: relativePath.toLowerCase(),
    })
  }

  console.log(`[MMD:Extractor] Extraction complete. Found ${textureFiles.length} textures.`)
  return { modelFile, textureFiles }
}

/**
 * Find the best model file path in the zip.
 * Prefers .pmx over .pmd. If multiple exist, picks the one at the shallowest depth.
 */
function findModelFile(paths: string[]): string | undefined {
  const modelPaths = paths.filter((p) => MODEL_EXTENSIONS.has(getExtension(p)))

  if (modelPaths.length === 0) return undefined

  // Prefer .pmx over .pmd
  const pmxPaths = modelPaths.filter((p) => getExtension(p) === '.pmx')
  const candidates = pmxPaths.length > 0 ? pmxPaths : modelPaths

  // Pick the shallowest one (fewest path separators)
  return candidates.sort((a, b) => {
    const depthA = (a.match(/\//g) ?? []).length
    const depthB = (b.match(/\//g) ?? []).length
    return depthA - depthB
  })[0]
}

function getExtension(path: string): string {
  const lastDot = path.lastIndexOf('.')
  if (lastDot === -1) return ''
  return path.substring(lastDot).toLowerCase()
}

function guessMimeType(ext: string): string {
  switch (ext) {
    case '.png':
      return 'image/png'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.bmp':
      return 'image/bmp'
    default:
      return 'application/octet-stream'
  }
}
