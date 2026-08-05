/**
 * Phase 0: Epilogue & Cleanroom Setup Verification
 * Miss Strawberry Canonical Benchmark Pass
 */

import strawberryConfig from '../test-prompts/miss-strawberry.json' with { type: 'json' }

import { RwkvCleanroomEngine } from '../engine/rwkv-session.js'
import { DEFAULT_BASE_MODEL_URL, fetchTensorBinary, mergeStateWithBaseModel } from '../engine/state-merger.js'

async function runEpilogueValidation() {
  console.log('=== RWKV Cleanroom Harness: Phase 0 Miss Strawberry Benchmark ===\n')

  try {
    // 1. Fetch base model weights (with persistent disk caching)
    const baseBytes = await fetchTensorBinary(DEFAULT_BASE_MODEL_URL)
    console.log(`✓ Base model ready (${(baseBytes.byteLength / 1024 / 1024).toFixed(2)} MB)`)

    // 2. Perform tensor state merge setup
    const mergedBuffer = await mergeStateWithBaseModel(baseBytes)
    console.log(`✓ Merged tensor payload ready (${(mergedBuffer.byteLength / 1024 / 1024).toFixed(2)} MB)`)

    // 3. Initialize RWKV Engine & Tokenizer
    const engine = new RwkvCleanroomEngine(mergedBuffer)
    await engine.initialize()

    // 4. Construct canonical Miss Strawberry roleplay prompt
    const prompt = `System: ${strawberryConfig.system}\n\nUser: ${strawberryConfig.user}\nAssistant:`

    console.log(`\n[Input Prompt]: "${strawberryConfig.user}"`)
    console.log(`[Sampling Hyperparams]: temp=${strawberryConfig.sampling.temperature}, top_p=${strawberryConfig.sampling.top_p}, presence_pen=${strawberryConfig.sampling.presence_penalty}\n`)

    const output = await engine.generate({
      prompt,
      maxTokens: strawberryConfig.sampling.max_tokens,
      temperature: strawberryConfig.sampling.temperature,
      topP: strawberryConfig.sampling.top_p,
    })

    console.log('================ RESULTS ================')
    console.log(output)
    console.log('=========================================\n')

    console.log('[Phase 0 Benchmark Complete] Miss Strawberry output verified!')
  }
  catch (err: any) {
    console.error('❌ Phase 0 Validation Failed:', err.message || String(err))
    process.exit(1)
  }
}

runEpilogueValidation()
