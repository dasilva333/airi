import { toDisplayString } from 'vue'
import { useI18n } from 'vue-i18n'

import { onboardingDisplayKeys, onboardingDisplayPatterns } from './display-text-keys'

const patterns = onboardingDisplayPatterns.map(pattern => ({ ...pattern, regex: new RegExp(pattern.source) }))

/** Translate reviewed UI copy at render time without rewriting stored presets or prompts. */
export function useOnboardingDisplayText() {
  const { t, te } = useI18n()

  function displayText(value: unknown, depth = 0): string {
    const text = toDisplayString(value)
    const normalized = text.trim().replace(/\s+/g, ' ')
    const key = onboardingDisplayKeys[normalized]
    if (key && te(key))
      return t(key)
    // Only translate the known readiness-summary lists; user-entered prose stays intact.
    const summaryTerms = ['STMM', 'Journal', 'Lifetime', 'Dreams', 'Web Search', 'Filesystem', '3D Motions']
    const list = normalized.split(', ')
    if (list.length > 1 && list.every(item => summaryTerms.includes(item)))
      return list.map(item => displayText(item, depth + 1)).join(', ')
    if (depth >= 4)
      return text

    for (const pattern of patterns) {
      const match = pattern.regex.exec(normalized)
      if (match && te(pattern.key)) {
        const params = Object.fromEntries(pattern.names.map((name, index) => [name, pattern.translateParameterNames.includes(name) ? displayText(match[index + 1], depth + 1) : match[index + 1]]))
        if (pattern.onlyIfParametersTranslate && pattern.names.every((name, index) => params[name] === match[index + 1]))
          return text
        return t(pattern.key, params)
      }
    }
    if (text.includes('\n'))
      return text.split('\n').map(line => displayText(line, depth + 1)).join('\n')
    return text
  }

  function displayOptions<T extends { label: unknown }>(options: T[]) {
    return options.map(option => ({ ...option, label: displayText(option.label) }))
  }

  return { displayText, displayOptions }
}
