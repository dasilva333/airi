import './setup'

// Mock browser globals for server-side story collection (Vite-Node)
// This prevents crashes from packages that assume a browser environment
const g = globalThis as any

// Live2D Cubism Core mock
g.Live2DCubismCore = {
  CubismFramework: {
    cleanUp: () => {},
    option: () => ({}),
    startUp: () => {},
  },
}

// Audio & Web API mocks
g.AudioWorkletNode = class {}
g.OfflineAudioContext = class {}
g.AudioContext = class {}

g.CSS = undefined
