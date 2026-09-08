import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      'apps/server',
      'apps/stage-tamagotchi',
      'apps/stage-edge',
      'packages/stage-ui',
      'packages/stage-pages',
      'packages/stage-shared',
      'packages/plugin-sdk',
      'packages/cap-vite',
      'packages/vite-plugin-warpdrive',
      'packages/audio-pipelines-transcribe',
      'packages/pipelines-audio',
      'packages/server-runtime',
      'packages/live2d-runtime',
    ],
  },
})
