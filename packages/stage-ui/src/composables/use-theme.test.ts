import { useTheme } from '@proj-airi/ui'
import { beforeEach, describe, expect, it } from 'vitest'

describe('useTheme composable', () => {
  const { themeMode, switchToNextTheme, isDark, toggleDark } = useTheme()

  beforeEach(() => {
    themeMode.value = 'auto'
  })

  it('cycles through theme modes deterministically (light -> dark -> auto -> light)', () => {
    themeMode.value = 'light'
    expect(themeMode.value).toBe('light')

    switchToNextTheme()
    expect(themeMode.value).toBe('dark')

    switchToNextTheme()
    expect(themeMode.value).toBe('auto')

    switchToNextTheme()
    expect(themeMode.value).toBe('light')
  })

  it('switches from auto to light on next theme cycle', () => {
    themeMode.value = 'auto'
    switchToNextTheme()
    expect(themeMode.value).toBe('light')
  })

  it('maintains backwards compatibility with isDark computed getter', () => {
    themeMode.value = 'dark'
    expect(isDark.value).toBe(true)

    themeMode.value = 'light'
    expect(isDark.value).toBe(false)
  })

  it('updates themeMode when isDark setter is invoked', () => {
    isDark.value = true
    expect(themeMode.value).toBe('dark')

    isDark.value = false
    expect(themeMode.value).toBe('light')
  })

  it('supports toggleDark toggling between light and dark', () => {
    themeMode.value = 'light'
    toggleDark()
    expect(themeMode.value).toBe('dark')
    expect(isDark.value).toBe(true)

    toggleDark()
    expect(themeMode.value).toBe('light')
    expect(isDark.value).toBe(false)
  })

  it('allows directly writing all 3 valid modes to themeMode', () => {
    themeMode.value = 'auto'
    expect(themeMode.value).toBe('auto')

    themeMode.value = 'dark'
    expect(themeMode.value).toBe('dark')

    themeMode.value = 'light'
    expect(themeMode.value).toBe('light')
  })
})
