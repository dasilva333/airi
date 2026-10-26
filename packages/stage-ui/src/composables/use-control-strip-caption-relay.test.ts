import { describe, expect, it } from 'vitest'
import { ref } from 'vue'

import { installMateSpeechDevtoolsHook, useControlStripCaptionRelay } from './use-control-strip-caption-relay'

describe('useControlStripCaptionRelay single-owner contract', () => {
  it('constructs the channel without side effects when not on Electron', () => {
    const isElectron = ref(false)
    const { captionChannelData } = useControlStripCaptionRelay({ isElectron })
    expect(captionChannelData.value).toBeFalsy()
  })

  it('installs a callable devtools hook exactly once', async () => {
    const isElectron = ref(false)
    useControlStripCaptionRelay({ isElectron })

    installMateSpeechDevtoolsHook()
    const hook = (window as any).__AIRI_DEVTOOLS_MATE_SPEECH__
    expect(typeof hook).toBe('function')
  })
})
