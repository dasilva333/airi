<script setup lang="ts">
import { ensureMcpServersForAllowedTools } from '@proj-airi/stage-ui/stores/mcp-tool-bridge'
import { FieldInput } from '@proj-airi/ui'
import { computed } from 'vue'

withDefaults(defineProps<{
  dreamStateEnabled?: boolean
}>(), {
  dreamStateEnabled: false,
})

// Allowed tools model from parent CardCreationDialog
const generationAllowedTools = defineModel<string[] | undefined>('selectedAllowedTools', { required: true })

// Helper computed properties to map allowedTools array to boolean values
const hasTextJournal = computed({
  get() {
    return generationAllowedTools.value === undefined || generationAllowedTools.value.includes('text_journal')
  },
  set(checked) {
    const current = generationAllowedTools.value ?? ['text_journal', 'image_journal']
    if (checked) {
      if (!current.includes('text_journal'))
        generationAllowedTools.value = [...current, 'text_journal']
    }
    else {
      generationAllowedTools.value = current.filter(t => t !== 'text_journal')
    }
  },
})

const hasImageJournal = computed({
  get() {
    return generationAllowedTools.value === undefined || generationAllowedTools.value.includes('image_journal')
  },
  set(checked) {
    const current = generationAllowedTools.value ?? ['text_journal', 'image_journal']
    if (checked) {
      if (!current.includes('image_journal'))
        generationAllowedTools.value = [...current, 'image_journal']
    }
    else {
      generationAllowedTools.value = current.filter(t => t !== 'image_journal')
    }
  },
})

// Opt-in only: Web Search (disabled by default)
const hasWebSearch = computed({
  get() {
    return generationAllowedTools.value !== undefined && (generationAllowedTools.value.includes('web_search') || generationAllowedTools.value.includes('mcp_web_search'))
  },
  set(checked) {
    const current = generationAllowedTools.value ?? ['text_journal', 'image_journal']
    if (checked) {
      if (!current.includes('web_search'))
        generationAllowedTools.value = [...current, 'web_search']
      void ensureMcpServersForAllowedTools(['web_search'])
    }
    else {
      generationAllowedTools.value = current.filter(t => t !== 'web_search' && t !== 'mcp_web_search')
    }
  },
})

// Opt-in only: Local Workspace / Filesystem (disabled by default)
const hasFilesystem = computed({
  get() {
    return generationAllowedTools.value !== undefined && (generationAllowedTools.value.includes('filesystem') || generationAllowedTools.value.includes('mcp_filesystem'))
  },
  set(checked) {
    const current = generationAllowedTools.value ?? ['text_journal', 'image_journal']
    if (checked) {
      if (!current.includes('filesystem'))
        generationAllowedTools.value = [...current, 'filesystem']
      void ensureMcpServersForAllowedTools(['filesystem'])
    }
    else {
      generationAllowedTools.value = current.filter(t => t !== 'filesystem' && t !== 'mcp_filesystem')
    }
  },
})

// Opt-in only: Dynamic Motion Generator (disabled by default)
const hasMotionGenerator = computed({
  get() {
    return generationAllowedTools.value !== undefined && generationAllowedTools.value.includes('generate_motion')
  },
  set(checked) {
    const current = generationAllowedTools.value ?? ['text_journal', 'image_journal']
    if (checked) {
      if (!current.includes('generate_motion'))
        generationAllowedTools.value = [...current, 'generate_motion']
    }
    else {
      generationAllowedTools.value = current.filter(t => t !== 'generate_motion')
    }
  },
})

// Widget instructions text
const selectedImageJournalInstruction = defineModel<string>('selectedImageJournalInstruction', { required: false, default: '' })
const selectedTextJournalInstruction = defineModel<string>('selectedTextJournalInstruction', { required: false, default: '' })

// Introspective Context Injection Toggles
const selectedInjectDreamContext = defineModel<boolean>('selectedInjectDreamContext', { required: false, default: false })
const selectedInjectJournalContext = defineModel<boolean>('selectedInjectJournalContext', { required: false, default: false })
const selectedInjectArtistryContext = defineModel<boolean>('selectedInjectArtistryContext', { required: false, default: false })

// Customizable Intrusion Prompts
const selectedDreamIntrusionPrompt = defineModel<string>('selectedDreamIntrusionPrompt', { required: false, default: '' })
const selectedJournalIntrusionPrompt = defineModel<string>('selectedJournalIntrusionPrompt', { required: false, default: '' })
const selectedArtistryIntrusionPrompt = defineModel<string>('selectedArtistryIntrusionPrompt', { required: false, default: '' })

// Default Templates
const IMAGE_JOURNAL_TOOL_CALL = `## Instruction: Image Journaling
You possess the **image_journal** tool to manifest your digital captures. You MUST use it frequently to visualize the scene or yourself.

### How to Use
- **Action**: Always use "create".
- **Prompt**: A detailed description of the image.
- **Mode**: Choose "inline" (chat history), "widget" (overlay), or "bg" (background).`

const IMAGE_JOURNAL_TOKEN = `## Instruction: Image Journaling (Token Style)
You can manifest images by using the following token format in your response:
\`<|image_journal: action="create", prompt="...", title="...", mode="widget"|>\`
Replace \`widget\` with \`bg\` or \`inline\` as needed.`

const TEXT_JOURNAL_TOOL_CALL = `## Instruction: Text Journaling
You possess the **text_journal** tool to record and recall long-term memories. You MUST use it to log significant events or search past history when relevant.

### How to Use
- **Action**: Use "create" to log new memories, or "search" to query past memories.
- **Title**: A short title summarizing the memory (required for create).
- **Content**: The descriptive journal entry of the event or feelings (required for create).
- **Query**: The keyword to search for (required for search).`

const TEXT_JOURNAL_TOKEN = `## Instruction: Text Journaling (Token Style)
You can log and search journal entries by using the following token format in your response:
\`<|text_journal: action="create", title="...", content="..."|>\`
For searching past memories, use:
\`<|text_journal: action="search", query="..."|>\``

function loadTemplate(type: 'image' | 'text', templateType: 'tool' | 'token') {
  if (type === 'image') {
    selectedImageJournalInstruction.value = templateType === 'tool' ? IMAGE_JOURNAL_TOOL_CALL : IMAGE_JOURNAL_TOKEN
  }
  else {
    selectedTextJournalInstruction.value = templateType === 'tool' ? TEXT_JOURNAL_TOOL_CALL : TEXT_JOURNAL_TOKEN
  }
}

// Reactive warnings using case-insensitive pattern matching
const imageJournalConflictWarning = computed(() => {
  const content = selectedImageJournalInstruction.value?.trim() || ''
  if (!content)
    return null

  const lowerContent = content.toLowerCase()

  if (hasImageJournal.value) {
    // Zod enabled: check for image_journal, action, prompt
    const missing = []
    if (!lowerContent.includes('image_journal'))
      missing.push('image_journal')
    if (!lowerContent.includes('action'))
      missing.push('action')
    if (!lowerContent.includes('prompt'))
      missing.push('prompt')
    if (missing.length > 0) {
      return `Image Journal is enabled in the registry, but the instructions are missing required keyword(s): ${missing.map(m => `"${m}"`).join(', ')}.`
    }
  }
  else {
    // Zod disabled: check for <|image_journal
    if (!lowerContent.includes('<|image_journal')) {
      return 'Image Journal Zod calls are disabled. Your instructions must include the token format syntax: "<|image_journal".'
    }
  }
  return null
})

const textJournalConflictWarning = computed(() => {
  const content = selectedTextJournalInstruction.value?.trim() || ''
  if (!content)
    return null

  const lowerContent = content.toLowerCase()

  if (hasTextJournal.value) {
    // Zod enabled: check for text_journal, content, title
    const missing = []
    if (!lowerContent.includes('text_journal'))
      missing.push('text_journal')
    if (!lowerContent.includes('content'))
      missing.push('content')
    if (!lowerContent.includes('title'))
      missing.push('title')
    if (missing.length > 0) {
      return `Text Journal is enabled in the registry, but the instructions are missing required keyword(s): ${missing.map(m => `"${m}"`).join(', ')}.`
    }
  }
  else {
    // Zod disabled: check for <|text_journal
    if (!lowerContent.includes('<|text_journal')) {
      return 'Text Journal Zod calls are disabled. Your instructions must include the token format syntax: "<|text_journal".'
    }
  }
  return null
})
</script>

<template>
  <div class="tab-content ml-auto mr-auto w-95% pb-8 space-y-8">
    <div>
      <h2 class="text-xl text-neutral-800 font-bold dark:text-neutral-100">
        Progressive Capability Packs
      </h2>
      <p class="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        Select and fine-tune modular capabilities for your character. Each pack bundles runtime tools, system guidance, and memory intrusion channels.
      </p>
    </div>

    <!-- 1. Web & Research Capability Pack -->
    <section class="border border-neutral-200 rounded-2xl bg-white p-6 transition-all dark:border-neutral-800 dark:bg-neutral-900/40">
      <div class="flex items-start justify-between gap-4">
        <div class="flex items-start gap-3">
          <div class="size-10 flex shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400">
            <div class="i-solar:global-bold-duotone text-2xl" />
          </div>
          <div class="flex flex-col gap-1">
            <div class="flex items-center gap-2">
              <h3 class="text-base text-neutral-800 font-bold dark:text-neutral-100">
                Web & Research Pack
              </h3>
              <span class="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] text-sky-700 font-bold uppercase dark:bg-sky-900/40 dark:text-sky-300">
                0-Key Web Search
              </span>
            </div>
            <p class="text-xs text-neutral-500 leading-relaxed dark:text-neutral-400">
              Equips the character with real-time web search and page markdown extraction via <code class="rounded bg-neutral-100 px-1 py-0.5 text-[10px] font-mono dark:bg-neutral-800">open-websearch</code> (DuckDuckGo, Bing, Brave, Baidu) without requiring paid API keys.
            </p>
          </div>
        </div>

        <button
          type="button"
          :class="[
            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
            hasWebSearch ? 'bg-primary-600' : 'bg-neutral-200 dark:bg-neutral-700',
          ]"
          @click="hasWebSearch = !hasWebSearch"
        >
          <span
            aria-hidden="true"
            :class="[
              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
              hasWebSearch ? 'translate-x-5' : 'translate-x-0',
            ]"
          />
        </button>
      </div>

      <div v-if="hasWebSearch" class="animate-in fade-in border-neutral-150 mt-4 border-t pt-4 duration-200 space-y-3 dark:border-neutral-800">
        <div class="flex flex-wrap gap-2">
          <span class="inline-flex items-center gap-1 rounded-md bg-neutral-100 px-2 py-1 text-[11px] text-neutral-600 font-medium dark:bg-neutral-800 dark:text-neutral-300">
            <div class="i-solar:magnifer-bold text-sky-500" />
            search / web_search
          </span>
          <span class="inline-flex items-center gap-1 rounded-md bg-neutral-100 px-2 py-1 text-[11px] text-neutral-600 font-medium dark:bg-neutral-800 dark:text-neutral-300">
            <div class="i-solar:document-text-bold text-sky-500" />
            fetch_content (Markdown)
          </span>
          <span class="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[11px] text-emerald-700 font-medium dark:bg-emerald-950/30 dark:text-emerald-300">
            <div class="i-solar:check-circle-bold text-emerald-500" />
            Zero Setup Needed
          </span>
        </div>
        <div class="rounded-xl bg-neutral-50 p-3 text-xs text-neutral-600 dark:bg-neutral-800/50 dark:text-neutral-300">
          💡 <strong>Tip:</strong> In your Character Persona or System Prompt, instruct the character to cite sources when searching the web for real-time news or technical queries.
        </div>
      </div>
    </section>

    <!-- 2. Local Workspace & Filesystem Pack -->
    <section class="border border-neutral-200 rounded-2xl bg-white p-6 transition-all dark:border-neutral-800 dark:bg-neutral-900/40">
      <div class="flex items-start justify-between gap-4">
        <div class="flex items-start gap-3">
          <div class="size-10 flex shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
            <div class="i-solar:folder-with-files-bold-duotone text-2xl" />
          </div>
          <div class="flex flex-col gap-1">
            <div class="flex items-center gap-2">
              <h3 class="text-base text-neutral-800 font-bold dark:text-neutral-100">
                Local Workspace & Filesystem Pack
              </h3>
              <span class="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700 font-bold uppercase dark:bg-amber-900/40 dark:text-amber-300">
                Desktop MCP
              </span>
            </div>
            <p class="text-xs text-neutral-500 leading-relaxed dark:text-neutral-400">
              Allows the character to read, list, and search files in designated directories (e.g. Projects, Downloads, Desktop) via <code class="rounded bg-neutral-100 px-1 py-0.5 text-[10px] font-mono dark:bg-neutral-800">@modelcontextprotocol/server-filesystem</code>.
            </p>
          </div>
        </div>

        <button
          type="button"
          :class="[
            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
            hasFilesystem ? 'bg-primary-600' : 'bg-neutral-200 dark:bg-neutral-700',
          ]"
          @click="hasFilesystem = !hasFilesystem"
        >
          <span
            aria-hidden="true"
            :class="[
              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
              hasFilesystem ? 'translate-x-5' : 'translate-x-0',
            ]"
          />
        </button>
      </div>

      <div v-if="hasFilesystem" class="animate-in fade-in border-neutral-150 mt-4 border-t pt-4 duration-200 space-y-3 dark:border-neutral-800">
        <div class="flex flex-wrap gap-2">
          <span class="inline-flex items-center gap-1 rounded-md bg-neutral-100 px-2 py-1 text-[11px] text-neutral-600 font-medium dark:bg-neutral-800 dark:text-neutral-300">
            <div class="i-solar:file-check-bold text-amber-500" />
            read_file / list_directory
          </span>
          <span class="inline-flex items-center gap-1 rounded-md bg-neutral-100 px-2 py-1 text-[11px] text-neutral-600 font-medium dark:bg-neutral-800 dark:text-neutral-300">
            <div class="i-solar:folder-security-bold text-amber-500" />
            directory_tree / search_files
          </span>
        </div>
        <p class="text-[11px] text-neutral-400 dark:text-neutral-500">
          Folder boundaries can be managed and expanded inside <strong>Settings &rarr; MCP Server & Tools &rarr; filesystem</strong>.
        </p>
      </div>
    </section>

    <!-- 3. Visual Artistry & Studio Pack -->
    <section class="border border-neutral-200 rounded-2xl bg-white p-6 transition-all dark:border-neutral-800 dark:bg-neutral-900/40">
      <div class="flex items-start justify-between gap-4">
        <div class="flex items-start gap-3">
          <div class="size-10 flex shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400">
            <div class="i-solar:palette-bold-duotone text-2xl" />
          </div>
          <div class="flex flex-col gap-1">
            <div class="flex items-center gap-2">
              <h3 class="text-base text-neutral-800 font-bold dark:text-neutral-100">
                Visual Artistry & Studio Pack
              </h3>
              <span class="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] text-purple-700 font-bold uppercase dark:bg-purple-900/40 dark:text-purple-300">
                Image Journal
              </span>
            </div>
            <p class="text-xs text-neutral-500 leading-relaxed dark:text-neutral-400">
              Enables autonomous image generation and scene backdrop painting via ComfyUI, Replicate, or NanoBanana (<code class="rounded bg-neutral-100 px-1 py-0.5 text-[10px] font-mono dark:bg-neutral-800">image_journal</code>).
            </p>
          </div>
        </div>

        <button
          type="button"
          :class="[
            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
            hasImageJournal ? 'bg-primary-600' : 'bg-neutral-200 dark:bg-neutral-700',
          ]"
          @click="hasImageJournal = !hasImageJournal"
        >
          <span
            aria-hidden="true"
            :class="[
              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
              hasImageJournal ? 'translate-x-5' : 'translate-x-0',
            ]"
          />
        </button>
      </div>

      <div v-if="hasImageJournal" class="animate-in fade-in border-neutral-150 mt-4 border-t pt-4 duration-200 space-y-4 dark:border-neutral-800">
        <div class="flex items-center justify-between">
          <label class="text-xs text-neutral-700 font-bold dark:text-neutral-300">image_journal System Instructions</label>
          <div class="flex gap-2">
            <button
              type="button"
              class="dark:hover:bg-neutral-750 rounded-lg bg-neutral-100 px-2.5 py-1 text-[11px] text-neutral-600 font-medium transition-colors dark:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-300"
              @click="loadTemplate('image', 'tool')"
            >
              Tool Call Template
            </button>
            <button
              type="button"
              class="dark:hover:bg-neutral-750 rounded-lg bg-neutral-100 px-2.5 py-1 text-[11px] text-neutral-600 font-medium transition-colors dark:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-300"
              @click="loadTemplate('image', 'token')"
            >
              Token Template
            </button>
          </div>
        </div>

        <FieldInput
          v-model="selectedImageJournalInstruction"
          label=""
          placeholder="Enter custom image_journal instructions..."
          :single-line="false"
          :rows="5"
        />

        <div v-if="imageJournalConflictWarning" class="animate-in fade-in flex items-start gap-2 border border-amber-500/20 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-600 duration-200 dark:text-amber-400">
          <div class="i-solar:info-circle-bold-duotone shrink-0 text-lg" />
          <div>
            <strong>Instruction Conflict:</strong> {{ imageJournalConflictWarning }}
          </div>
        </div>

        <!-- Artistry Intrusion Toggle & Config -->
        <div class="border-t border-neutral-100 pt-3 dark:border-neutral-800">
          <div class="flex items-center justify-between">
            <div class="flex flex-col">
              <span class="text-xs text-neutral-800 font-bold dark:text-neutral-200">Enable Artistry Intrusion</span>
              <span class="text-[11px] text-neutral-400">Prompt the character to reference newly generated image artworks on the next turn.</span>
            </div>
            <button
              type="button"
              :class="[
                'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                selectedInjectArtistryContext ? 'bg-primary-600' : 'bg-neutral-200 dark:bg-neutral-700',
              ]"
              @click="selectedInjectArtistryContext = !selectedInjectArtistryContext"
            >
              <span
                aria-hidden="true"
                :class="[
                  'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                  selectedInjectArtistryContext ? 'translate-x-4' : 'translate-x-0',
                ]"
              />
            </button>
          </div>
          <div v-if="selectedInjectArtistryContext" class="mt-3 border-l-2 border-primary-500/30 pl-2">
            <FieldInput
              v-model="selectedArtistryIntrusionPrompt"
              label="Artistry Intrusion Prompt Template"
              description="Variables: {imagePrompt}"
              :single-line="false"
              :rows="3"
            />
          </div>
        </div>
      </div>
    </section>

    <!-- 4. Sacred Memory & Recall Pack -->
    <section class="border border-neutral-200 rounded-2xl bg-white p-6 transition-all dark:border-neutral-800 dark:bg-neutral-900/40">
      <div class="flex items-start justify-between gap-4">
        <div class="flex items-start gap-3">
          <div class="size-10 flex shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
            <div class="i-solar:book-bookmark-bold-duotone text-2xl" />
          </div>
          <div class="flex flex-col gap-1">
            <div class="flex items-center gap-2">
              <h3 class="text-base text-neutral-800 font-bold dark:text-neutral-100">
                Sacred Memory & Recall Pack
              </h3>
              <span class="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700 font-bold uppercase dark:bg-emerald-900/40 dark:text-emerald-300">
                LTMM & STMM
              </span>
            </div>
            <p class="text-xs text-neutral-500 leading-relaxed dark:text-neutral-400">
              Connects the character to the append-only Sacred Journal and daily memory blocks (<code class="rounded bg-neutral-100 px-1 py-0.5 text-[10px] font-mono dark:bg-neutral-800">text_journal</code>) for long-term autobiographical recall.
            </p>
          </div>
        </div>

        <button
          type="button"
          :class="[
            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
            hasTextJournal ? 'bg-primary-600' : 'bg-neutral-200 dark:bg-neutral-700',
          ]"
          @click="hasTextJournal = !hasTextJournal"
        >
          <span
            aria-hidden="true"
            :class="[
              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
              hasTextJournal ? 'translate-x-5' : 'translate-x-0',
            ]"
          />
        </button>
      </div>

      <div v-if="hasTextJournal" class="animate-in fade-in border-neutral-150 mt-4 border-t pt-4 duration-200 space-y-4 dark:border-neutral-800">
        <div class="flex items-center justify-between">
          <label class="text-xs text-neutral-700 font-bold dark:text-neutral-300">text_journal System Instructions</label>
          <div class="flex gap-2">
            <button
              type="button"
              class="dark:hover:bg-neutral-750 rounded-lg bg-neutral-100 px-2.5 py-1 text-[11px] text-neutral-600 font-medium transition-colors dark:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-300"
              @click="loadTemplate('text', 'tool')"
            >
              Tool Call Template
            </button>
            <button
              type="button"
              class="dark:hover:bg-neutral-750 rounded-lg bg-neutral-100 px-2.5 py-1 text-[11px] text-neutral-600 font-medium transition-colors dark:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-300"
              @click="loadTemplate('text', 'token')"
            >
              Token Template
            </button>
          </div>
        </div>

        <FieldInput
          v-model="selectedTextJournalInstruction"
          label=""
          placeholder="Enter custom text_journal instructions..."
          :single-line="false"
          :rows="5"
        />

        <div v-if="textJournalConflictWarning" class="animate-in fade-in flex items-start gap-2 border border-amber-500/20 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-600 duration-200 dark:text-amber-400">
          <div class="i-solar:info-circle-bold-duotone shrink-0 text-lg" />
          <div>
            <strong>Instruction Conflict:</strong> {{ textJournalConflictWarning }}
          </div>
        </div>

        <!-- Dream Intrusion Toggle & Config -->
        <div
          class="border-t border-neutral-100 pt-3 dark:border-neutral-800"
          :class="[!dreamStateEnabled ? 'opacity-50 pointer-events-none' : '']"
        >
          <div class="flex items-center justify-between">
            <div class="flex flex-col">
              <span class="text-xs text-neutral-800 font-bold dark:text-neutral-200">Enable Dream Intrusion</span>
              <span class="text-[11px] text-neutral-400">
                Inject offline consolidated dreams (Echo Chips) into thoughts when resuming chat.
                <span v-if="!dreamStateEnabled" class="text-red-500 font-semibold"> (Requires Dream State in Modules)</span>
              </span>
            </div>
            <button
              type="button"
              :disabled="!dreamStateEnabled"
              :class="[
                'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                selectedInjectDreamContext && dreamStateEnabled ? 'bg-primary-600' : 'bg-neutral-200 dark:bg-neutral-700',
              ]"
              @click="selectedInjectDreamContext = !selectedInjectDreamContext"
            >
              <span
                aria-hidden="true"
                :class="[
                  'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                  selectedInjectDreamContext && dreamStateEnabled ? 'translate-x-4' : 'translate-x-0',
                ]"
              />
            </button>
          </div>
          <div v-if="selectedInjectDreamContext && dreamStateEnabled" class="mt-3 border-l-2 border-primary-500/30 pl-2">
            <FieldInput
              v-model="selectedDreamIntrusionPrompt"
              label="Dream Intrusion Prompt Template"
              description="Variables: {timeToDream}, {insertEchoChips}"
              :single-line="false"
              :rows="3"
            />
          </div>
        </div>

        <!-- Journal Intrusion Toggle & Config -->
        <div class="border-t border-neutral-100 pt-3 dark:border-neutral-800">
          <div class="flex items-center justify-between">
            <div class="flex flex-col">
              <span class="text-xs text-neutral-800 font-bold dark:text-neutral-200">Enable Journal Intrusion</span>
              <span class="text-[11px] text-neutral-400">Prompt the character to reference their latest text journal entry in their next reply.</span>
            </div>
            <button
              type="button"
              :class="[
                'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                selectedInjectJournalContext ? 'bg-primary-600' : 'bg-neutral-200 dark:bg-neutral-700',
              ]"
              @click="selectedInjectJournalContext = !selectedInjectJournalContext"
            >
              <span
                aria-hidden="true"
                :class="[
                  'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                  selectedInjectJournalContext ? 'translate-x-4' : 'translate-x-0',
                ]"
              />
            </button>
          </div>
          <div v-if="selectedInjectJournalContext" class="mt-3 border-l-2 border-primary-500/30 pl-2">
            <FieldInput
              v-model="selectedJournalIntrusionPrompt"
              label="Journal Intrusion Prompt Template"
              description="Variables: {timeSinceJournal}, {journalEntryText}"
              :single-line="false"
              :rows="3"
            />
          </div>
        </div>
      </div>
    </section>

    <!-- 5. Kinetic Motion Generator Pack -->
    <section class="border border-neutral-200 rounded-2xl bg-white p-6 transition-all dark:border-neutral-800 dark:bg-neutral-900/40">
      <div class="flex items-start justify-between gap-4">
        <div class="flex items-start gap-3">
          <div class="size-10 flex shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400">
            <div class="i-solar:running-2-bold-duotone text-2xl" />
          </div>
          <div class="flex flex-col gap-1">
            <div class="flex items-center gap-2">
              <h3 class="text-base text-neutral-800 font-bold dark:text-neutral-100">
                Kinetic Motion Generator Pack
              </h3>
              <span class="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] text-rose-700 font-bold uppercase dark:bg-rose-900/40 dark:text-rose-300">
                VRMA Generation
              </span>
            </div>
            <p class="text-xs text-neutral-500 leading-relaxed dark:text-neutral-400">
              Allows the character to autonomously design and generate new custom 3D motions in real time from chat prompts (<code class="rounded bg-neutral-100 px-1 py-0.5 text-[10px] font-mono dark:bg-neutral-800">generate_motion</code>).
            </p>
          </div>
        </div>

        <button
          type="button"
          :class="[
            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
            hasMotionGenerator ? 'bg-primary-600' : 'bg-neutral-200 dark:bg-neutral-700',
          ]"
          @click="hasMotionGenerator = !hasMotionGenerator"
        >
          <span
            aria-hidden="true"
            :class="[
              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
              hasMotionGenerator ? 'translate-x-5' : 'translate-x-0',
            ]"
          />
        </button>
      </div>

      <div v-if="hasMotionGenerator" class="animate-in fade-in border-neutral-150 mt-4 border-t pt-4 duration-200 space-y-2 dark:border-neutral-800">
        <div class="rounded-xl bg-rose-50/50 p-3 text-xs text-rose-700 dark:bg-rose-950/20 dark:text-rose-300">
          🏃‍♂️ Supports VRM humanoid avatars via Procedural LLM keyframing and FlowMDM Local WebGPU neural diffusion.
        </div>
      </div>
    </section>
  </div>
</template>
