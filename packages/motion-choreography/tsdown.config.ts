import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    'index': 'src/index.ts',
    'dsp/index': 'src/dsp/index.ts',
    'kinematics/index': 'src/kinematics/index.ts',
    'types': 'src/types.ts',
  },
  unbundle: true,
})
