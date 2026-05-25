<route lang="yaml">
meta:
  layout: docs
</route>

<script setup lang="ts">
import { MarkdownRenderer } from '@proj-airi/stage-ui/components'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

const route = useRoute()
const { locale } = useI18n()

// NOTICE: Relative path from this file to project root is 7 segments.
const modules = import.meta.glob('../../../../../../../docs/content/**/*.md', {
  eager: false,
  import: 'default',
  query: '?raw',
})

const content = ref('')
const loading = ref(true)
const diagnostics = ref('')

const segments = computed(() => {
  const path = (route.params as any).path as string[] | string
  if (Array.isArray(path)) {
    return path.filter(Boolean)
  }
  return (path || '').split('/').filter(Boolean)
})

async function loadContent() {
  loading.value = true
  const lang = locale.value || 'en'
  const pathStr = segments.value.join('/') || 'overview'

  const candidates = [
    `../../../../../../../docs/content/${lang}/docs/${pathStr}.md`,
    `../../../../../../../docs/content/${lang}/docs/${pathStr}/index.md`,
    `../../../../../../../docs/content/en/docs/${pathStr}.md`,
    `../../../../../../../docs/content/en/docs/${pathStr}/index.md`,
  ]

  let loader = null
  let finalPath = ''
  for (const candidate of candidates) {
    if (modules[candidate]) {
      loader = modules[candidate]
      finalPath = candidate
      break
    }
  }

  if (loader) {
    try {
      const rawRaw = await (loader() as Promise<string>)
      const raw = rawRaw.trim()

      // Improved Frontmatter Extraction (Handles CRLF and leading whitespace/BOM)
      const fmRegex = /^\s*---\r?\n([\s\S]*?)\r?\n---/
      const fmMatch = raw.match(fmRegex)

      let title = ''
      let stripped = raw

      if (fmMatch) {
        const fm = fmMatch[1]
        const titleMatch = fm.match(/title:\s*(.*)/)
        if (titleMatch) {
          title = titleMatch[1].replace(/['"]/g, '').trim()
        }
        stripped = raw.replace(fmRegex, '').trim()
      } else {
        // Fallback: If no --- block at start, check for loose "title: " at very start
        const looseTitleMatch = raw.match(/^\s*title:\s*(.*)/)
        if (looseTitleMatch) {
          title = looseTitleMatch[1].split('\n')[0].replace(/['"]/g, '').trim()
          stripped = raw.replace(/^\s*title:.*\n?/, '').trim()
        }
      }

      // Ensure we don't duplicate a title if the md already starts with #
      if (title && !stripped.startsWith('# ')) {
        content.value = `# ${title}\n\n${stripped}`
      } else {
        content.value = stripped
      }

      diagnostics.value = `Lang: ${lang} | Found: ${finalPath} | Title: ${title || 'NONE'}`
    } catch (e: any) {
      content.value = `# Error\n${e.message}`
      diagnostics.value = `Load Error: ${e.message}`
    }
  } else {
    content.value = `# Not Found\nPath: ${pathStr}`
    diagnostics.value = `Not Found in Glob (Size: ${Object.keys(modules).length})`
  }
  loading.value = false
}

watch([segments, locale], loadContent, { immediate: true })
</script>

<template>
  <div v-if="loading" flex="~ col items-center justify-center gap-4" h-64 text-sky-400>
    <div i-svg-spinners:90-ring-with-bg text-3xl />
    <span class="text-xs font-black tracking-widest uppercase">Syncing Node...</span>
  </div>
  <div v-else class="flex flex-col gap-6">
    <div class="content-wrapper">
      <MarkdownRenderer :content="content" />
    </div>
  </div>
</template>
