// Setup file for stage-ui vitest unit test execution

if (typeof window === 'undefined') {
  (globalThis as any).window = globalThis
}

// Window EventTarget methods for Node.js test environment
const eventTarget = new EventTarget()
if (!globalThis.window.addEventListener) {
  globalThis.window.addEventListener = eventTarget.addEventListener.bind(eventTarget)
}
if (!globalThis.window.removeEventListener) {
  globalThis.window.removeEventListener = eventTarget.removeEventListener.bind(eventTarget)
}
if (!globalThis.window.dispatchEvent) {
  globalThis.window.dispatchEvent = eventTarget.dispatchEvent.bind(eventTarget)
}

// Web Audio API stubs for headless Node.js unit tests (required by wlipsync / audio pipelines)
if (typeof (globalThis as any).AudioWorkletNode === 'undefined') {
  (globalThis as any).AudioWorkletNode = class AudioWorkletNode {}
}
if (typeof (globalThis as any).AudioNode === 'undefined') {
  (globalThis as any).AudioNode = class AudioNode {}
}
if (typeof (globalThis as any).AudioContext === 'undefined') {
  (globalThis as any).AudioContext = class AudioContext {}
}

function createStorageMock() {
  const store = new Map<string, string>()
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, val: string) => store.set(key, String(val)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size
    },
  }
}

if (!globalThis.localStorage) {
  const storage = createStorageMock()
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    writable: true,
  })
  if (globalThis.window) {
    Object.defineProperty(globalThis.window, 'localStorage', {
      value: storage,
      writable: true,
    })
  }
}

if (!globalThis.sessionStorage) {
  const storage = createStorageMock()
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: storage,
    writable: true,
  })
  if (globalThis.window) {
    Object.defineProperty(globalThis.window, 'sessionStorage', {
      value: storage,
      writable: true,
    })
  }
}

if (!globalThis.window.Live2DCubismCore) {
  (globalThis.window as any).Live2DCubismCore = {}
}
