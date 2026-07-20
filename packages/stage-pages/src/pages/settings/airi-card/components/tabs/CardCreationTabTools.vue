<script setup lang="ts">
import { FieldCheckbox, FieldInput } from '@proj-airi/ui'
import { computed } from 'vue'

withDefaults(defineProps<{
  dreamStateEnabled?: boolean
}>(), {
  dreamStateEnabled: false,
})

// Allowed tools model from parent CardCreationDialog
const generationAllowedTools = defineModel<string[] | undefined>('selectedAllowedTools', { required: true })

// Helper computed properties to map allowedTools array to FieldCheckbox boolean values
const hasTextJournal = computed({
  get() {
    return generationAllowedTools.value === undefined || generationAllowedTools.value.includes('text_journal')
  },
  set(checked) {
    const current = generationAllowedTools.value ?? ['text_journal', 'image_journal', 'mcp']
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
    const current = generationAllowedTools.value ?? ['text_journal', 'image_journal', 'mcp']
    if (checked) {
      if (!current.includes('image_journal'))
        generationAllowedTools.value = [...current, 'image_journal']
    }
    else {
      generationAllowedTools.value = current.filter(t => t !== 'image_journal')
    }
  },
})

const hasMcp = computed({
  get() {
    return generationAllowedTools.value === undefined || generationAllowedTools.value.includes('mcp')
  },
  set(checked) {
    const current = generationAllowedTools.value ?? ['text_journal', 'image_journal', 'mcp']
    if (checked) {
      if (!current.includes('mcp'))
        generationAllowedTools.value = [...current, 'mcp']
    }
    else {
      generationAllowedTools.value = current.filter(t => t !== 'mcp')
    }
  },
})

const hasMotionGenerator = computed({
  get() {
    return generationAllowedTools.value !== undefined && generationAllowedTools.value.includes('generate_motion')
  },
  set(checked) {
    const current = generationAllowedTools.value ?? ['text_journal', 'image_journal', 'mcp']
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
    <p class="text-sm text-neutral-500 dark:text-neutral-400">
      Configure the tools, presentation formats, and introspective awareness systems available to your character.
    </p>

    <!-- Group A: Tool Capability Registry -->
    <section class="border border-neutral-200 rounded-2xl bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900/40">
      <h3 class="mb-2 flex items-center gap-2 text-lg text-neutral-800 font-bold dark:text-neutral-100">
        <div class="i-solar:widget-bold-duotone text-primary-500" />
        Allowed Tools & Capabilities
      </h3>
      <p class="mb-6 text-xs text-neutral-400 dark:text-neutral-500">
        Toggle which system capabilities this character is allowed to use. Disabling tools prevents context pollution on smaller local models.
      </p>

      <div class="flex flex-col gap-4">
        <FieldCheckbox
          v-model="hasTextJournal"
          label="Text Journal"
          description="Allows the character to write, search, and recall text journal entries (text_journal)."
        />
        <FieldCheckbox
          v-model="hasImageJournal"
          label="Image/Artistry Journal"
          description="Allows the character to trigger ComfyUI/Replicate image generations and update the background (image_journal)."
        />
        <FieldCheckbox
          v-model="hasMcp"
          label="External Tools (MCP)"
          description="Allows the character to call connected Model Context Protocol (MCP) servers/APIs."
        />
        <FieldCheckbox
          v-model="hasMotionGenerator"
          label="Dynamic Motion Generator (generate_motion)"
          description="Allows the character to autonomously design and generate new custom motions in real time from chat prompts. (Opt-in only). Currently supports VRM humanoid models. Live2D and MMD support is in development."
        />
      </div>
    </section>

    <!-- Group B: Tool Presentation Formats -->
    <section class="border border-neutral-200 rounded-2xl bg-white p-6 space-y-6 dark:border-neutral-800 dark:bg-neutral-900/40">
      <h3 class="flex items-center gap-2 text-lg text-neutral-800 font-bold dark:text-neutral-100">
        <div class="i-solar:tuning-square-bold-duotone text-primary-500" />
        Tool Presentation Formats
      </h3>
      <p class="text-xs text-neutral-400 dark:text-neutral-500">
        Load the templates and specify system instructions for enabled tools to guide the character on how and when to invoke them.
      </p>

      <!-- Image Journal Configuration -->
      <div class="border-neutral-150 border-t pt-6 space-y-4 dark:border-neutral-800">
        <div class="flex items-center justify-between">
          <label class="text-sm text-neutral-700 font-bold dark:text-neutral-300">image_journal Integration</label>
          <div class="flex gap-2">
            <button
              type="button"
              class="dark:hover:bg-neutral-750 rounded-lg bg-neutral-100 px-3 py-1.5 text-xs text-neutral-600 font-medium transition-colors dark:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-300"
              @click="loadTemplate('image', 'tool')"
            >
              Load Tool Call Template
            </button>
            <button
              type="button"
              class="dark:hover:bg-neutral-750 rounded-lg bg-neutral-100 px-3 py-1.5 text-xs text-neutral-600 font-medium transition-colors dark:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-300"
              @click="loadTemplate('image', 'token')"
            >
              Load Token Template
            </button>
          </div>
        </div>

        <FieldInput
          v-model="selectedImageJournalInstruction"
          label="image_journal System Instructions"
          description="Contextual instructions added to guide the model on how and when to use image journaling."
          :single-line="false"
          :rows="6"
        />

        <!-- Image Journal Validation Warning -->
        <div v-if="imageJournalConflictWarning" class="animate-in fade-in flex items-start gap-2 border border-amber-500/20 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-600 duration-200 dark:text-amber-400">
          <div class="i-solar:info-circle-bold-duotone shrink-0 text-lg" />
          <div>
            <strong>Instruction Conflict:</strong> {{ imageJournalConflictWarning }}
          </div>
        </div>
      </div>

      <!-- Text Journal Configuration -->
      <div class="border-neutral-150 border-t pt-6 space-y-4 dark:border-neutral-800">
        <div class="flex items-center justify-between">
          <label class="text-sm text-neutral-700 font-bold dark:text-neutral-300">text_journal Integration</label>
          <div class="flex gap-2">
            <button
              type="button"
              class="dark:hover:bg-neutral-750 rounded-lg bg-neutral-100 px-3 py-1.5 text-xs text-neutral-600 font-medium transition-colors dark:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-300"
              @click="loadTemplate('text', 'tool')"
            >
              Load Tool Call Template
            </button>
            <button
              type="button"
              class="dark:hover:bg-neutral-750 rounded-lg bg-neutral-100 px-3 py-1.5 text-xs text-neutral-600 font-medium transition-colors dark:bg-neutral-800 hover:bg-neutral-200 dark:text-neutral-300"
              @click="loadTemplate('text', 'token')"
            >
              Load Token Template
            </button>
          </div>
        </div>

        <FieldInput
          v-model="selectedTextJournalInstruction"
          label="text_journal System Instructions"
          description="Contextual instructions added to guide the model on how and when to use text journaling."
          :single-line="false"
          :rows="6"
        />

        <!-- Text Journal Validation Warning -->
        <div v-if="textJournalConflictWarning" class="animate-in fade-in flex items-start gap-2 border border-amber-500/20 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-600 duration-200 dark:text-amber-400">
          <div class="i-solar:info-circle-bold-duotone shrink-0 text-lg" />
          <div>
            <strong>Instruction Conflict:</strong> {{ textJournalConflictWarning }}
          </div>
        </div>
      </div>
    </section>

    <!-- Group C: Introspective Context Injections -->
    <section class="border border-neutral-200 rounded-2xl bg-white p-6 space-y-6 dark:border-neutral-800 dark:bg-neutral-900/40">
      <h3 class="mb-2 flex items-center gap-2 text-lg text-neutral-800 font-bold dark:text-neutral-100">
        <div class="i-solar:bolt-bold-duotone text-primary-500" />
        Introspective Context Injections
      </h3>
      <p class="text-xs text-neutral-400 dark:text-neutral-500">
        Allows out-of-band background events to trigger one-time awareness clues on the next user turn.
      </p>

      <div class="space-y-6">
        <!-- Dream Intrusion Toggle & Config -->
        <div
          class="border-neutral-150 dark:border-neutral-850 flex flex-col gap-4 border-t pt-4"
          :class="[!dreamStateEnabled ? 'opacity-50 pointer-events-none' : '']"
        >
          <div class="flex items-center justify-between">
            <div class="flex flex-col gap-1 pr-4">
              <span class="text-sm text-neutral-800 font-bold dark:text-neutral-200">Enable Dream Intrusion</span>
              <span class="text-xs text-neutral-400 dark:text-neutral-500">
                Inject offline consolidated dreams (Echo Chips) into the character's thoughts when resuming the chat.
                <span v-if="!dreamStateEnabled" class="text-red-500 font-semibold dark:text-red-400"> (Disabled: Requires Dream State to be enabled in Modules)</span>
              </span>
            </div>
            <button
              type="button"
              :disabled="!dreamStateEnabled"
              :class="[
                'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                selectedInjectDreamContext && dreamStateEnabled ? 'bg-primary-600' : 'bg-neutral-200 dark:bg-neutral-700',
              ]"
              @click="selectedInjectDreamContext = !selectedInjectDreamContext"
            >
              <span
                aria-hidden="true"
                :class="[
                  'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                  selectedInjectDreamContext && dreamStateEnabled ? 'translate-x-5' : 'translate-x-0',
                ]"
              />
            </button>
          </div>
          <div v-if="selectedInjectDreamContext && dreamStateEnabled" class="animate-in fade-in border-l-2 border-primary-500/30 pl-2 duration-200">
            <FieldInput
              v-model="selectedDreamIntrusionPrompt"
              label="Dream Intrusion Prompt Template"
              description="Instructions injected when a dream occurred. Variables: {timeToDream}, {insertEchoChips}."
              :single-line="false"
              :rows="4"
            />
          </div>
        </div>

        <!-- Journal Intrusion Toggle & Config -->
        <div v-if="hasTextJournal" class="border-neutral-150 dark:border-neutral-850 flex flex-col gap-4 border-t pt-4">
          <div class="flex items-center justify-between">
            <div class="flex flex-col gap-1 pr-4">
              <span class="text-sm text-neutral-800 font-bold dark:text-neutral-200">Enable Journal Intrusion</span>
              <span class="text-xs text-neutral-400 dark:text-neutral-500">Prompt the character to reference their latest journal entry in their next reply.</span>
            </div>
            <button
              type="button"
              :class="[
                'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                selectedInjectJournalContext ? 'bg-primary-600' : 'bg-neutral-200 dark:bg-neutral-700',
              ]"
              @click="selectedInjectJournalContext = !selectedInjectJournalContext"
            >
              <span
                aria-hidden="true"
                :class="[
                  'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                  selectedInjectJournalContext ? 'translate-x-5' : 'translate-x-0',
                ]"
              />
            </button>
          </div>
          <div v-if="selectedInjectJournalContext" class="animate-in fade-in border-l-2 border-primary-500/30 pl-2 duration-200">
            <FieldInput
              v-model="selectedJournalIntrusionPrompt"
              label="Journal Intrusion Prompt Template"
              description="Instructions injected when a journal entry is written. Variables: {timeSinceJournal}, {journalEntryText}."
              :single-line="false"
              :rows="4"
            />
          </div>
        </div>

        <!-- Artistry Intrusion Toggle & Config -->
        <div v-if="hasImageJournal" class="border-neutral-150 dark:border-neutral-850 flex flex-col gap-4 border-t pt-4">
          <div class="flex items-center justify-between">
            <div class="flex flex-col gap-1 pr-4">
              <span class="text-sm text-neutral-800 font-bold dark:text-neutral-200">Enable Artistry Intrusion</span>
              <span class="text-xs text-neutral-400 dark:text-neutral-500">Allow the character to bring up their latest image journal creations on their next response.</span>
            </div>
            <button
              type="button"
              :class="[
                'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                selectedInjectArtistryContext ? 'bg-primary-600' : 'bg-neutral-200 dark:bg-neutral-700',
              ]"
              @click="selectedInjectArtistryContext = !selectedInjectArtistryContext"
            >
              <span
                aria-hidden="true"
                :class="[
                  'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                  selectedInjectArtistryContext ? 'translate-x-5' : 'translate-x-0',
                ]"
              />
            </button>
          </div>
          <div v-if="selectedInjectArtistryContext" class="animate-in fade-in border-l-2 border-primary-500/30 pl-2 duration-200">
            <FieldInput
              v-model="selectedArtistryIntrusionPrompt"
              label="Artistry Intrusion Prompt Template"
              description="Instructions injected when an image artwork is generated. Variables: {imagePrompt}."
              :single-line="false"
              :rows="4"
            />
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
