/**
 * QUARANTINED — do not treat any prior output of this file as real.
 *
 * Phase 0 asserted "Miss Strawberry benchmark PASSED", but it did so by calling
 * the old `RwkvCleanroomEngine.generate()`, which returned a hard-coded canned
 * string whenever the prompt contained "Miss Strawberry". The WASM was never
 * invoked from Node — those "results" were fabricated by the stub, not measured.
 *
 * The real WebGPU inference path lives in `engine/rwkv-session.ts`
 * (`RwkvWebGpuBridge`) + `webroot/runner.js`, proven by the browser spike
 * (`webroot/spike.js`). For a genuine epilogue benchmark, drive that bridge.
 *
 * This file is intentionally not runnable as a benchmark anymore.
 */

export {}

throw new Error(
  '[00-epilogue-validation] Quarantined: previously returned fabricated '
  + 'canned output (no real WASM inference). Use engine/rwkv-session.ts '
  + '(RwkvWebGpuBridge) + webroot/runner.js for real WebGPU inference.',
)
