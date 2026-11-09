import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    'index': 'src/index.ts',
    'conductor/index': 'src/conductor/index.ts',
    'dsp/index': 'src/dsp/index.ts',
    'kinematics/index': 'src/kinematics/index.ts',
    'types': 'src/types.ts',
    'cli': 'src/cli.ts',
  },
  unbundle: true,
})
