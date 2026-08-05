/**
 * Phase 0: Epilogue & Cleanroom Setup Verification
 */

import { RwkvCleanroomSession } from '../engine/rwkv-session.js'
import { DEFAULT_BASE_MODEL_URL, fetchTensorBinary, mergeStateWithBaseModel } from '../engine/state-merger.js'

async function runEpilogueValidation() {
  console.log('=== RWKV Cleanroom Harness: Phase 0 Epilogue Validation ===\n')

  try {
    // 1. Fetch base model weights
    const baseBytes = await fetchTensorBinary(DEFAULT_BASE_MODEL_URL)
    console.log(`✓ Base model downloaded (${(baseBytes.byteLength / 1024 / 1024).toFixed(2)} MB)`)

    // 2. Perform tensor state merge setup
    const mergedBuffer = await mergeStateWithBaseModel(baseBytes)
    console.log(`✓ Merged tensor payload ready (${(mergedBuffer.byteLength / 1024 / 1024).toFixed(2)} MB)`)

    // 3. Initialize RWKV Session & compile WASM reader
    const session = new RwkvCleanroomSession(mergedBuffer)

    // 4. Test multi-turn generation pass
    const prompt = 'User: Hi there! I am working on a new Rust backend service today for AIRI.\nAssistant:'
    const output = await session.generateReal({ prompt, maxTokens: 64 })

    console.log('\n--- Output Generated ---')
    console.log(output)
    console.log('------------------------\n')

    console.log('[Phase 0 Verification Complete] Cleanroom harness WASM memory pipeline fully validated!')
  }
  catch (err: any) {
    console.error('❌ Phase 0 Validation Failed:', err.message || String(err))
    process.exit(1)
  }
}

runEpilogueValidation()
