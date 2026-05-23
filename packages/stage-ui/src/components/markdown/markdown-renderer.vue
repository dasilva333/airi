<script setup lang="ts">
import DOMPurify from 'dompurify'

import { healMozibake } from '@proj-airi/stage-shared'
import { onMounted, ref, watch } from 'vue'

import { useMarkdown } from '../../composables/markdown'

interface Props {
  content: string
  class?: string
}

const props = defineProps<Props>()

const processedContent = ref('')
const { process, processSync } = useMarkdown()

function formatActorName(id: string): string {
  const name = id.replace(/^(actress_|actor_)/i, '')
  const customNames: Record<string, string> = {
    cg1: 'Nia',
    cg2: 'Vara',
    juewa: 'Juewa',
    rumi: 'Rumi',
  }
  const lower = name.toLowerCase()
  if (customNames[lower])
    return customNames[lower]

  return name
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

function postProcessActorColors(html: string): string {
  if (!html.includes('[ACTOR:'))
    return html

  // Match standard paragraph <p>...</p> or list item <li>...</li> blocks
  const blockRegex = /(<p>|<li>)([\s\S]*?)(<\/p>|<\/li>)/gi
  let activeActorId: string | null = null

  const result = html.replace(blockRegex, (match, openTag, innerContent, closeTag) => {
    // Check if this block contains an actor marker: [ACTOR:xxx]
    const markerRegex = /\[ACTOR:\s*([\w-]+)\s*\]/i
    const markerMatch = markerRegex.exec(innerContent)

    let isNewMarker = false
    if (markerMatch) {
      activeActorId = markerMatch[1].trim()
      // Strip the marker from the block content
      innerContent = innerContent.replace(markerRegex, '')
      isNewMarker = true
    }

    if (activeActorId) {
      // If this was a new marker block, prepend the polished pill badge!
      let chipHtml = ''
      if (isNewMarker) {
        const displayName = formatActorName(activeActorId)
        chipHtml = `<span class="actor-chip actor-chip-${activeActorId}">${displayName}</span>`
      }
      // Wrap only the inner content of this block in our inline styled class
      return `${openTag}${chipHtml}<span class="actor-color-${activeActorId}">${innerContent}</span>${closeTag}`
    }

    return match
  })

  return result
}

async function processContent() {
  if (!props.content) {
    processedContent.value = ''
    return
  }

  // const sample = props.content.slice(0, 10).split('').map(c => `${c} (0x${c.charCodeAt(0).toString(16)})`).join(', ')
  // console.debug(`[MarkdownRenderer] Healing input (sample: ${sample})...`)

  let healed = healMozibake(props.content)

  // FAILSAFE: Level 2 Literal Mappings directly in component to bypass potential shared-package cache stale
  const commonScrambles: Record<string, string> = {
    'Ê·': 'ʷ',
    'â—´': '◴',
    'â—•': '•',
    'á´¥': 'ᴥ',
    'â‰§': '≧',
    'ï¿£': '￣',
    'ãƒ˜': 'ヘ',
    'â¬½': '⬽',
    'Â¬': '¬',
    'â–½': '▽',
    'Ê•': 'ʕ',
    'Ê"': 'ʔ',
    'â‰¦': '≦',
  }

  for (const [key, val] of Object.entries(commonScrambles)) {
    healed = healed.replaceAll(key, val)
  }

  if (healed !== props.content) {
    // console.debug('[MarkdownRenderer] Scrambled Unicode healed successfully.')
  }
  else {
    // If it's still scrambled but healing failed, log the actual codes
    // console.debug('[MarkdownRenderer] No changes made by healer.')
  }

  try {
    const rawCompiled = await process(healed)
    processedContent.value = postProcessActorColors(DOMPurify.sanitize(rawCompiled))
  }
  catch (error) {
    console.warn('Failed to process markdown with syntax highlighting, using fallback:', error)
    processedContent.value = postProcessActorColors(DOMPurify.sanitize(processSync(healed)))
  }
}

function handleLinkClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  const anchor = target.closest('a')
  if (!anchor)
    return

  const href = anchor.getAttribute('href')
  if (href && (href.startsWith('http') || href.startsWith('mailto:'))) {
    e.preventDefault()
    if (window.confirm(`Open external resource?\n\nThis will take you to:\n${href}`)) {
      window.open(href, '_blank')
    }
  }
}

// Process content when it changes
watch(() => props.content, processContent, { immediate: true })

onMounted(() => {
  processContent()
})
</script>

<template>
  <div
    :class="props.class"
    class="markdown-content"
    @click="handleLinkClick"
    v-html="processedContent"
  />
</template>

<style scoped>
.markdown-content :deep(h1) {
  font-size: 2.5rem;
  font-weight: 900;
  margin-bottom: 1.5rem;
  background: linear-gradient(to right, #38bdf8, #a78bfa, #64748b);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  letter-spacing: -0.025em;
}

.dark .markdown-content :deep(h1) {
  background: linear-gradient(to right, #38bdf8, #a78bfa, #ffffff);
  -webkit-background-clip: text;
}

.markdown-content :deep(h2) {
  font-size: 1.75rem;
  font-weight: 800;
  margin-top: 2rem;
  margin-bottom: 1rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  padding-bottom: 0.5rem;
  color: rgba(0, 0, 0, 0.85);
}

.dark .markdown-content :deep(h2) {
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.9);
}

.markdown-content :deep(h3) {
  font-size: 1.25rem;
  font-weight: 700;
  margin-top: 1.5rem;
  margin-bottom: 0.75rem;
  color: rgba(0, 0, 0, 0.8);
}

.dark .markdown-content :deep(h3) {
  color: rgba(255, 255, 255, 0.85);
}

.markdown-content :deep(p) {
  margin-bottom: 1.25rem;
  line-height: 1.75;
  color: inherit;
}

.markdown-content :deep(ul), .markdown-content :deep(ol) {
  margin-bottom: 1.25rem;
  padding-left: 1.5rem;
  color: inherit;
}

.markdown-content :deep(li) {
  margin-bottom: 0.5rem;
}

.markdown-content :deep(blockquote) {
  margin: 1.5rem 0;
  padding: 1rem 1.5rem;
  border-left: 4px solid #38bdf8;
  background: rgba(56, 189, 248, 0.05);
  border-radius: 4px 12px 12px 4px;
}

.markdown-content :deep(blockquote p) {
  margin-bottom: 0;
  color: rgba(0, 0, 0, 0.7);
  font-style: italic;
}

.dark .markdown-content :deep(blockquote p) {
  color: rgba(255, 255, 255, 0.8);
}

.markdown-content :deep(pre), .markdown-content :deep(.shiki) {
  background: rgba(0, 0, 0, 0.05) !important;
  border: 1px solid rgba(0, 0, 0, 0.05);
  border-radius: 12px;
  padding: 1.25rem;
  margin: 1.5rem 0;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.05);
  color: inherit;
}

.dark .markdown-content :deep(pre), .dark .markdown-content :deep(.shiki) {
  background: rgba(0, 0, 0, 0.3) !important;
  border: 1px solid rgba(255, 255, 255, 0.05);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
}

.markdown-content :deep(.actor-chip) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 2px 6px;
  border-radius: 4px;
  margin-right: 8px;
  vertical-align: middle;
  line-height: 1;
  user-select: none;
}
</style>
