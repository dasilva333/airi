import { startWorkers } from './snippets/wasm-bindgen-rayon-38edf6e439f6d70d/src/workerHelpers.no-bundler.js'

export class Runtime {
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr
    this.__wbg_ptr = 0
    RuntimeFinalization.unregister(this)
    return ptr
  }

  free() {
    const ptr = this.__destroy_into_raw()
    wasm.__wbg_runtime_free(ptr, 0)
  }

  cancel() {
    const ret = wasm.runtime_cancel(this.__wbg_ptr)
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0])
    }
  }

  /**
   * Checks the part's size and BLAKE3; after the last part, builds the engine. Returns
   * whether the engine is ready.
   * @param {number} part
   * @returns {boolean}
   */
  end_part(part) {
    const ret = wasm.runtime_end_part(this.__wbg_ptr, part)
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1])
    }
    return ret[0] !== 0
  }

  /**
   * @param {string} manifest_json
   */
  constructor(manifest_json) {
    const ptr0 = passStringToWasm0(manifest_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc)
    const len0 = WASM_VECTOR_LEN
    const ret = wasm.runtime_new(ptr0, len0)
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1])
    }
    this.__wbg_ptr = ret[0]
    RuntimeFinalization.register(this, this.__wbg_ptr, this)
    return this
  }

  /**
   * Discards what was written to part `part` (after a failed `end_part`), to write it again.
   * @param {number} part
   */
  restart_part(part) {
    const ret = wasm.runtime_restart_part(this.__wbg_ptr, part)
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0])
    }
  }

  /**
   * Starts a synthesis (`session::Request` as JSON); returns the plan (`{"fragments"}`).
   * @param {string} request_json
   * @returns {string}
   */
  start(request_json) {
    let deferred3_0
    let deferred3_1
    try {
      const ptr0 = passStringToWasm0(request_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc)
      const len0 = WASM_VECTOR_LEN
      const ret = wasm.runtime_start(this.__wbg_ptr, ptr0, len0)
      let ptr2 = ret[0]
      let len2 = ret[1]
      if (ret[3]) {
        ptr2 = 0; len2 = 0
        throw takeFromExternrefTable0(ret[2])
      }
      deferred3_0 = ptr2
      deferred3_1 = len2
      return getStringFromWasm0(ptr2, len2)
    }
    finally {
      wasm.__wbindgen_free(deferred3_0, deferred3_1, 1)
    }
  }

  /**
   * One frame; returns `{"fragment","fragments","frame","done"}`.
   * @returns {string}
   */
  step() {
    let deferred2_0
    let deferred2_1
    try {
      const ret = wasm.runtime_step(this.__wbg_ptr)
      let ptr1 = ret[0]
      let len1 = ret[1]
      if (ret[3]) {
        ptr1 = 0; len1 = 0
        throw takeFromExternrefTable0(ret[2])
      }
      deferred2_0 = ptr1
      deferred2_1 = len1
      return getStringFromWasm0(ptr1, len1)
    }
    finally {
      wasm.__wbindgen_free(deferred2_0, deferred2_1, 1)
    }
  }

  /**
   * The 44.1 kHz samples produced since the last call.
   * @returns {Float32Array}
   */
  take_audio() {
    const ret = wasm.runtime_take_audio(this.__wbg_ptr)
    if (ret[3]) {
      throw takeFromExternrefTable0(ret[2])
    }
    const v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice()
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4)
    return v1
  }

  /**
   * @returns {number}
   */
  threads() {
    const ret = wasm.runtime_threads(this.__wbg_ptr)
    if (ret[2]) {
      throw takeFromExternrefTable0(ret[1])
    }
    return ret[0] >>> 0
  }

  /**
   * The next bytes of part `part` (index into the manifest's `parts`), in order.
   * @param {number} part
   * @param {Uint8Array} bytes
   */
  write_part(part, bytes) {
    const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_malloc)
    const len0 = WASM_VECTOR_LEN
    const ret = wasm.runtime_write_part(this.__wbg_ptr, part, ptr0, len0)
    if (ret[1]) {
      throw takeFromExternrefTable0(ret[0])
    }
  }
}
if (Symbol.dispose)
  Runtime.prototype[Symbol.dispose] = Runtime.prototype.free

/**
 * @param {number} num_threads
 * @returns {Promise<any>}
 */
export function initThreadPool(num_threads) {
  const ret = wasm.initThreadPool(num_threads)
  return ret
}

/**
 * The message of the last panic, for the host to read after a `RuntimeError: unreachable`.
 * @returns {string}
 */
export function last_panic() {
  let deferred1_0
  let deferred1_1
  try {
    const ret = wasm.last_panic()
    deferred1_0 = ret[0]
    deferred1_1 = ret[1]
    return getStringFromWasm0(ret[0], ret[1])
  }
  finally {
    wasm.__wbindgen_free(deferred1_0, deferred1_1, 1)
  }
}

/**
 * `[{"id","label"}]` of the built-in voices.
 * @returns {string}
 */
export function voices() {
  let deferred1_0
  let deferred1_1
  try {
    const ret = wasm.voices()
    deferred1_0 = ret[0]
    deferred1_1 = ret[1]
    return getStringFromWasm0(ret[0], ret[1])
  }
  finally {
    wasm.__wbindgen_free(deferred1_0, deferred1_1, 1)
  }
}

export class wbg_rayon_PoolBuilder {
  static __wrap(ptr) {
    const obj = Object.create(wbg_rayon_PoolBuilder.prototype)
    obj.__wbg_ptr = ptr
    wbg_rayon_PoolBuilderFinalization.register(obj, obj.__wbg_ptr, obj)
    return obj
  }

  __destroy_into_raw() {
    const ptr = this.__wbg_ptr
    this.__wbg_ptr = 0
    wbg_rayon_PoolBuilderFinalization.unregister(this)
    return ptr
  }

  free() {
    const ptr = this.__destroy_into_raw()
    wasm.__wbg_wbg_rayon_poolbuilder_free(ptr, 0)
  }

  build() {
    wasm.wbg_rayon_poolbuilder_build(this.__wbg_ptr)
  }

  /**
   * @returns {string}
   */
  mainJS() {
    const ret = wasm.wbg_rayon_poolbuilder_mainJS(this.__wbg_ptr)
    return ret
  }

  /**
   * @returns {number}
   */
  numThreads() {
    const ret = wasm.wbg_rayon_poolbuilder_numThreads(this.__wbg_ptr)
    return ret >>> 0
  }

  /**
   * @returns {number}
   */
  receiver() {
    const ret = wasm.wbg_rayon_poolbuilder_receiver(this.__wbg_ptr)
    return ret >>> 0
  }
}
if (Symbol.dispose)
  wbg_rayon_PoolBuilder.prototype[Symbol.dispose] = wbg_rayon_PoolBuilder.prototype.free

/**
 * @param {number} receiver
 */
export function wbg_rayon_start_worker(receiver) {
  wasm.wbg_rayon_start_worker(receiver)
}
function __wbg_get_imports(memory) {
  const import0 = {
    __proto__: null,
    __wbg_Error_30c8987f7c2ed4e2(arg0, arg1) {
      const ret = new Error(getStringFromWasm0(arg0, arg1))
      return ret
    },
    __wbg___wbindgen_is_undefined_8865fb403f8fe9d8(arg0) {
      const ret = arg0 === undefined
      return ret
    },
    __wbg___wbindgen_memory_caa4a6165639c8b5() {
      const ret = wasm.memory
      return ret
    },
    __wbg___wbindgen_module_7115fb14045f9891() {
      const ret = wasmModule
      return ret
    },
    __wbg___wbindgen_throw_41e9ee4f547fc59a(arg0, arg1) {
      throw new Error(getStringFromWasm0(arg0, arg1))
    },
    __wbg_instanceof_Window_82d71df4eddf88bc(arg0) {
      let result
      try {
        result = arg0 instanceof Window
      }
      catch (_) {
        result = false
      }
      const ret = result
      return ret
    },
    __wbg_startWorkers_622cedd0d351664e(arg0, arg1, arg2) {
      const ret = startWorkers(arg0, arg1, wbg_rayon_PoolBuilder.__wrap(arg2))
      return ret
    },
    __wbg_static_accessor_GLOBAL_266715b9d96ba635() {
      const ret = typeof global === 'undefined' ? null : global
      return isLikeNone(ret) ? 0 : addToExternrefTable0(ret)
    },
    __wbg_static_accessor_GLOBAL_THIS_10fb7dc1ae063179() {
      const ret = typeof globalThis === 'undefined' ? null : globalThis
      return isLikeNone(ret) ? 0 : addToExternrefTable0(ret)
    },
    __wbg_static_accessor_SELF_0b583911f537483a() {
      const ret = typeof self === 'undefined' ? null : self
      return isLikeNone(ret) ? 0 : addToExternrefTable0(ret)
    },
    __wbg_static_accessor_URL_fac851ed3060f4eb() {
      const ret = import.meta.url
      return ret
    },
    __wbg_static_accessor_WINDOW_d7f903d1508cbdc4() {
      const ret = typeof window === 'undefined' ? null : window
      return isLikeNone(ret) ? 0 : addToExternrefTable0(ret)
    },
    __wbindgen_init_externref_table() {
      const table = wasm.__wbindgen_externrefs
      const offset = table.grow(4)
      table.set(0, undefined)
      table.set(offset + 0, undefined)
      table.set(offset + 1, null)
      table.set(offset + 2, true)
      table.set(offset + 3, false)
    },
    memory: memory || new WebAssembly.Memory({ initial: 28, maximum: 32768, shared: true }),
  }
  return {
    '__proto__': null,
    './ming_runtime_bg.js': import0,
  }
}

const RuntimeFinalization = (typeof FinalizationRegistry === 'undefined')
  ? { register: () => {}, unregister: () => {} }
  : new FinalizationRegistry(ptr => wasm.__wbg_runtime_free(ptr, 1))
const wbg_rayon_PoolBuilderFinalization = (typeof FinalizationRegistry === 'undefined')
  ? { register: () => {}, unregister: () => {} }
  : new FinalizationRegistry(ptr => wasm.__wbg_wbg_rayon_poolbuilder_free(ptr, 1))

function addToExternrefTable0(obj) {
  const idx = wasm.__externref_table_alloc()
  wasm.__wbindgen_externrefs.set(idx, obj)
  return idx
}

function getArrayF32FromWasm0(ptr, len) {
  ptr = ptr >>> 0
  return getFloat32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len)
}

let cachedFloat32ArrayMemory0 = null
function getFloat32ArrayMemory0() {
  if (cachedFloat32ArrayMemory0 === null || cachedFloat32ArrayMemory0.buffer !== wasm.memory.buffer) {
    cachedFloat32ArrayMemory0 = new Float32Array(wasm.memory.buffer)
  }
  return cachedFloat32ArrayMemory0
}

function getStringFromWasm0(ptr, len) {
  return decodeText(ptr >>> 0, len)
}

let cachedUint8ArrayMemory0 = null
function getUint8ArrayMemory0() {
  if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.buffer !== wasm.memory.buffer) {
    cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer)
  }
  return cachedUint8ArrayMemory0
}

function isLikeNone(x) {
  return x === undefined || x === null
}

function passArray8ToWasm0(arg, malloc) {
  const ptr = malloc(arg.length * 1, 1) >>> 0
  getUint8ArrayMemory0().set(arg, ptr / 1)
  WASM_VECTOR_LEN = arg.length
  return ptr
}

function passStringToWasm0(arg, malloc, realloc) {
  if (realloc === undefined) {
    const buf = cachedTextEncoder.encode(arg)
    const ptr = malloc(buf.length, 1) >>> 0
    getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf)
    WASM_VECTOR_LEN = buf.length
    return ptr
  }

  let len = arg.length
  let ptr = malloc(len, 1) >>> 0

  const mem = getUint8ArrayMemory0()

  let offset = 0

  for (; offset < len; offset++) {
    const code = arg.charCodeAt(offset)
    if (code > 0x7F)
      break
    mem[ptr + offset] = code
  }
  if (offset !== len) {
    if (offset !== 0) {
      arg = arg.slice(offset)
    }
    ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0
    const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len)
    const ret = cachedTextEncoder.encodeInto(arg, view)

    offset += ret.written
    ptr = realloc(ptr, len, offset, 1) >>> 0
  }

  WASM_VECTOR_LEN = offset
  return ptr
}

function takeFromExternrefTable0(idx) {
  const value = wasm.__wbindgen_externrefs.get(idx)
  wasm.__externref_table_dealloc(idx)
  return value
}

let cachedTextDecoder = (typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8', { ignoreBOM: true, fatal: true }) : undefined)
if (cachedTextDecoder)
  cachedTextDecoder.decode()

const MAX_SAFARI_DECODE_BYTES = 2146435072
let numBytesDecoded = 0
function decodeText(ptr, len) {
  numBytesDecoded += len
  if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
    cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true })
    cachedTextDecoder.decode()
    numBytesDecoded = len
  }
  return cachedTextDecoder.decode(getUint8ArrayMemory0().slice(ptr, ptr + len))
}

const cachedTextEncoder = (typeof TextEncoder !== 'undefined' ? new TextEncoder() : undefined)

if (cachedTextEncoder) {
  cachedTextEncoder.encodeInto = function (arg, view) {
    const buf = cachedTextEncoder.encode(arg)
    view.set(buf)
    return {
      read: arg.length,
      written: buf.length,
    }
  }
}

let WASM_VECTOR_LEN = 0

let wasmModule, wasmInstance, wasm
function __wbg_finalize_init(instance, module, thread_stack_size) {
  wasmInstance = instance
  wasm = instance.exports
  wasmModule = module
  cachedFloat32ArrayMemory0 = null
  cachedUint8ArrayMemory0 = null
  if (typeof thread_stack_size !== 'undefined' && (typeof thread_stack_size !== 'number' || thread_stack_size === 0 || thread_stack_size % 65536 !== 0)) {
    throw new Error('invalid stack size')
  }

  wasm.__wbindgen_start(thread_stack_size)
  return wasm
}

async function __wbg_load(module, imports) {
  if (typeof Response === 'function' && module instanceof Response) {
    if (!module.ok) {
      throw new Error(`failed to fetch Wasm: ${module.status} ${module.statusText} fetching '${module.url}'`)
    }

    if (typeof WebAssembly.instantiateStreaming === 'function') {
      try {
        return await WebAssembly.instantiateStreaming(module, imports)
      }
      catch (e) {
        const validResponse = expectedResponseType(module.type)

        if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
          console.warn('`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n', e)
        }
        else { throw e }
      }
    }

    const bytes = await module.arrayBuffer()
    return await WebAssembly.instantiate(bytes, imports)
  }
  else {
    const instance = await WebAssembly.instantiate(module, imports)

    if (instance instanceof WebAssembly.Instance) {
      return { instance, module }
    }
    else {
      return instance
    }
  }

  function expectedResponseType(type) {
    switch (type) {
      case 'basic': case 'cors': case 'default': return true
    }
    return false
  }
}

function initSync(module, memory) {
  if (wasm !== undefined)
    return wasm

  let thread_stack_size
  if (module !== undefined) {
    if (Object.getPrototypeOf(module) === Object.prototype) {
      ({ module, memory, thread_stack_size } = module)
    }
    else {
      console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
    }
  }

  const imports = __wbg_get_imports(memory)
  if (!(module instanceof WebAssembly.Module)) {
    module = new WebAssembly.Module(module)
  }
  const instance = new WebAssembly.Instance(module, imports)
  return __wbg_finalize_init(instance, module, thread_stack_size)
}

async function __wbg_init(module_or_path, memory) {
  if (wasm !== undefined)
    return wasm

  let thread_stack_size
  if (module_or_path !== undefined) {
    if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
      ({ module_or_path, memory, thread_stack_size } = module_or_path)
    }
    else {
      console.warn('using deprecated parameters for the initialization function; pass a single object instead')
    }
  }

  if (module_or_path === undefined) {
    module_or_path = new URL('ming_runtime_bg.wasm', import.meta.url)
  }
  const imports = __wbg_get_imports(memory)

  if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
    module_or_path = fetch(module_or_path)
  }

  const { instance, module } = await __wbg_load(await module_or_path, imports)

  return __wbg_finalize_init(instance, module, thread_stack_size)
}

export { __wbg_init as default, initSync }
