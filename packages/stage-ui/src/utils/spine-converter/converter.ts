// @ts-ignore
import initModule from './SpineSkeletonDataConverter.js'
// @ts-ignore
import wasmUrl from './SpineSkeletonDataConverter.wasm?url'

/**
 * Converts a Spine skeleton file from 3.x to a supported target version (default 4.1.20)
 * entirely in-memory using WebAssembly.
 *
 * @param inputBytes The raw Uint8Array of the 3.x skeleton file.
 * @param filename The name of the file (e.g. "skeleton.skel") to mount in virtual FS.
 * @param targetVersion The Spine target version to upgrade to (default "4.1.20").
 * @returns A promise resolving to the upgraded Uint8Array.
 */
export async function convertSpineSkeleton(
  inputBytes: Uint8Array,
  filename: string,
  targetVersion = '4.1.20',
): Promise<Uint8Array> {
  console.log(`[Spine-Wasm-Converter] Instantiating SpineSkeletonDataConverter WebAssembly for ${filename}...`)
  const Module = (await initModule({
    locateFile: (path: string) => {
      if (path.endsWith('.wasm')) {
        console.log(`[Spine-Wasm-Converter] Loading Wasm from: ${wasmUrl}`)
        return wasmUrl
      }
      return path
    },
  })) as any

  const inputPath = `/${filename}`
  const outputPath = `/output_${Date.now()}_${filename}`

  console.log(`[Spine-Wasm-Converter] Writing file ${filename} to MEMFS...`)
  Module.FS.writeFile(inputPath, inputBytes)

  try {
    console.log(`[Spine-Wasm-Converter] Calling callMain conversion for version: ${targetVersion}`)
    Module.callMain([inputPath, outputPath, '-v', targetVersion])

    console.log(`[Spine-Wasm-Converter] Reading output file from MEMFS...`)
    const outputBytes = Module.FS.readFile(outputPath)
    console.log(`[Spine-Wasm-Converter] Successfully converted skeleton: ${outputBytes.length} bytes.`)
    return outputBytes
  }
  finally {
    try {
      Module.FS.unlink(inputPath)
    }
    catch {}
    try {
      Module.FS.unlink(outputPath)
    }
    catch {}
  }
}
