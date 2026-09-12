/**
 * use-live2d-translator.ts - Dynamic Hybrid Translation Composable for Live2D Gimmick Deck
 * Combines Tier 1 common lexicon lookup with Tier 2 persistent localStorage / localforage caching.
 */

import { computed, ref, watch } from 'vue'

import { lookupLexicon } from '../interpreter/lexicon'

export type LanguageMode = 'bilingual' | 'en_only' | 'raw'

const CJK_REGEX = /[\u4E00-\u9FFF\u3040-\u30FF]/

export function useLive2dTranslator(modelIdRef: { value: string }) {
  const languageMode = ref<LanguageMode>('bilingual')
  const isTranslating = ref(false)
  const translationCache = ref<Record<string, string>>({})

  // Storage key prefix
  const storageKey = computed(() => `airi:live2d-trans:${modelIdRef.value || 'default'}`)

  // Load persistent cache for the active model
  function loadLocalCache() {
    try {
      const raw = localStorage.getItem(storageKey.value)
      if (raw) {
        translationCache.value = JSON.parse(raw)
      }
      else {
        translationCache.value = {}
      }
    }
    catch {
      translationCache.value = {}
    }
  }

  // Save cache back to localStorage
  function saveLocalCache() {
    try {
      localStorage.setItem(storageKey.value, JSON.stringify(translationCache.value))
    }
    catch (e) {
      console.warn('[Live2dTranslator] Failed to persist translation cache:', e)
    }
  }

  // Reload cache whenever model changes
  watch(() => modelIdRef.value, () => {
    loadLocalCache()
  }, { immediate: true })

  /**
   * Resolves a raw string into primary and secondary display labels.
   */
  function resolve(rawText: string | undefined | null): { main: string, sub?: string } {
    if (!rawText)
      return { main: '' }

    const trimmed = rawText.trim()
    if (!trimmed)
      return { main: rawText }

    // If Mode is raw, return original verbatim
    if (languageMode.value === 'raw') {
      return { main: trimmed }
    }

    // Check Tier 1 static lexicon first
    const lexiconMatch = lookupLexicon(trimmed)
    if (lexiconMatch) {
      if (languageMode.value === 'en_only')
        return { main: lexiconMatch }
      return { main: lexiconMatch, sub: trimmed }
    }

    // Check Tier 2 persistent cache
    const cached = translationCache.value[trimmed]
    if (cached && cached !== trimmed) {
      if (languageMode.value === 'en_only')
        return { main: cached }
      return { main: cached, sub: trimmed }
    }

    // Not translated yet; return raw
    return { main: trimmed }
  }

  /**
   * Translates an array of uncached strings via Google Translate API and saves to cache.
   */
  async function translateMissing(texts: string[], targetLang = 'en'): Promise<number> {
    const toTranslate: string[] = []
    for (const t of texts) {
      if (!t)
        continue
      const trimmed = t.trim()
      if (!trimmed || !CJK_REGEX.test(trimmed))
        continue
      if (lookupLexicon(trimmed))
        continue
      if (translationCache.value[trimmed])
        continue
      toTranslate.push(trimmed)
    }

    if (toTranslate.length === 0)
      return 0

    isTranslating.value = true
    let translatedCount = 0

    try {
      for (const raw of toTranslate) {
        try {
          const cleanText = raw.replace(/\{\$br\}/g, ' ')
          const url = `https://translate.googleapis.com/translate_a/single?client=dict-chrome-ex&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(cleanText)}`
          const resp = await fetch(url)
          if (resp.ok) {
            const data = await resp.json()
            if (Array.isArray(data) && Array.isArray(data[0])) {
              const res = data[0].map((p: any) => p[0]).join('').trim()
              if (res) {
                translationCache.value[raw] = res
                translatedCount++
              }
            }
          }
        }
        catch (err) {
          console.warn(`[Live2dTranslator] Failed to translate: "${raw.slice(0, 20)}..."`, err)
        }
        // Small delay between requests to be polite
        await new Promise(r => setTimeout(r, 60))
      }
      saveLocalCache()
    }
    finally {
      isTranslating.value = false
    }

    return translatedCount
  }

  return {
    languageMode,
    isTranslating,
    translationCache,
    resolve,
    translateMissing,
  }
}
