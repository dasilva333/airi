import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      'apps/server',
      'apps/stage-tamagotchi',
      'apps/stage-edge',
      'apps/stage-edge-discord-do',
      'packages/stage-ui',
      'packages/stage-pages',
      'packages/stage-shared',
      'packages/plugin-sdk',
      'packages/cap-vite',
      'packages/vite-plugin-warpdrive',
      'packages/audio-pipelines-transcribe',
      'packages/pipelines-audio',
      'packages/server-runtime',
      'packages/server-sdk',
      'packages/live2d-runtime',
      'packages/i18n',
      'packages/speech-transformer-math',
      'packages/speech-transformer-chem',
      'packages/stream-kit',
      'packages/stage-ui-spine',
    ],
  },
})
