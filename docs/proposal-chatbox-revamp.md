# Proposal: AIRI Chatbox Revamp

## 1. Overview & Phased Roadmap

The AIRI Chatbox is evolving from a linear messaging interface into a **hybrid conversation workspace** — a system where chat, context, and system behavior are clearly separated into dedicated surfaces.

The core principle driving this redesign:

> **Message Content, System Behavior, and Navigation must never compete for the same space.**

### Phases

* **Phase 1 (MVP)**
  Header control hub, session switching, token metrics, LLM selector, behavior controls, inline composer actions.
  *(Completed)*

* **Phase 2**
  Context Artifact Band (Memories + Media), collapsible containers, responsive layout.
  *(Completed)*

* **Phase 3**
  Three-column workspace, left navigation panel, right context panel, bottom toolbar removal, layout consolidation.
  *(Completed)*
  * Done: Right context panel with memories (echo chips, STMM cards, journal cards), media gallery (3-column grid, lazy-loading), md+ toggle button with active state
  * Done: Context band badge consolidation (unified header with collapsible badges)
  * Done: Fixed top header with send mode, grounding, modes, and sidebar toggle
  * Done: Left panel routing architecture and navigation model designed (see Section 7)
  * Done: Left panel implementation (nav component, chat.vue shell restructure, surface components), bottom toolbar removal
  * Done: Reused StageBackgroundPicker as a responsive full-page Media Library in chat_media.vue
  * Done: Created CharacterContextView for advanced structured prompt inspection in chat_world.vue & context dialog
  * Done: Created three-column diagnostic card feed for Director's Monitor in chat_director.vue with two-way prompt-to-image matching
  * Pending: Token capacity progress bar indicator

* **Phase 4 (Extended System Layer)**
  Input preprocessing pipeline, enriched attachments, Director’s Monitor surface, token visualization refinement, expanded attachment system.
  *(Future)*

---

## 2. Fixed Top Header (Control Hub)

The header is the **system control plane**. It governs session state, model selection, and runtime behavior.

### Features

* **Hamburger `☰` (md+)**
  Toggles Left Panel. Hidden in portrait.

* **AIRI Logo + Session Selector**
  Brand anchor + timeline switching.

* **Stacked Token Metrics**
  Compact vertical display:

  * Global Tokens
  * Session Tokens

* **Token Capacity Indicator (Phase 3+)**
  Thin animated progress bar **under the header**, representing:

  ```
  sessionTokens / contextWidth
  ```

  * Neutral → Amber → Red as capacity fills
  * Smooth animated transitions (no snapping)

* **Brain Button**
  Active LLM selector dropdown.

* **Memory & Context Popover**

  * Contains context controls
  * Includes **Trash (destructive action)**

* **Ellipsis `⋮` (Behavior Panel)**
  Unified behavioral control surface:

  * Send Mode (Enter / Shift+Enter / Ctrl+Enter)
  * Grounding Options
  * Autonomous Artistry toggle
  * Heartbeats toggle

> This panel exclusively controls **system behavior**, never message content.

---

## 3. Context Artifact Band (Portrait + Fallback Mode)

A bottom strip that surfaces contextual artifacts when the Right Panel is not active.

### Structure

Two independent sections:

* **Memories**
* **Media Gallery**

### Behavior

* Each section:

  * Has header + content
  * Supports collapse via eye icon
  * Persists state in localStorage

### Critical Constraint (Added)

When **both sections are collapsed**, they compress into a **single shared row**:

```
[ Memories ▸ ] [ Media ▸ ]
```

* Prevents vertical dead space
* Ensures zero-content state remains compact

### Layout

* `<768px`: stacked vertically
* `>=768px`: side-by-side

### Actions

* **Memories**

  * `[+ New]` → JournalMomentModal

* **Media**

  * `[+ Add]` → imagine flow
  * `[View All]` → full Media view (Left Panel route)

---

## 4. Input Composer

The composer is strictly for **message creation**.

### Layout

```
[+] · [✨] · [textarea] · [✈]
```

### Features

* **`[+]` Attach / Enrichment Button**
* **`[✨]` Suggest Response**
* **Textarea**
* **Send / Greet Button**

---

### `[+]` Design Rule (Critical)

`[+]` is not a generic action menu.

It is the:

> **Message Enrichment Layer**

Anything added here becomes part of the message payload.

#### Allowed

* Images
* Screenshots
* Audio (Phase 4)
* Files (Phase 4)
* Links (with preprocessing)

#### Not Allowed

* System toggles
* Agent tools / MCP controls
* Memory management actions

---

## 5. Phase 3: Three-Column Workspace Layout

### Column Architecture (Two-Level Nesting)

The left panel, center content, and right panel are NOT flat siblings in a single row. The layout is a **two-level nesting**:

```
[ col-2 left sidebar ] [ content-wrapper (col-10 or col-12)         ]
                                  [ chat col-9 ][ right panel col-3 ]
```

**Level 1** — `chat.vue` manages only the sidebar ↔ content split:
- The left sidebar is either `col-2` (landscape) or an overlay (portrait)
- The content wrapper fills the remaining space (`col-10` or `col-12`)
- The sidebar has no knowledge of the right panel's state

**Level 2** — the content surface (`chat_messages.vue`) manages its own internal split:
- When the right panel is open: `col-9` chat + `col-3` right panel
- When closed: `col-12` chat, the full context band visible

**Why this matters:** The three columns never coexist in a single `w-2/12 + w-7/12 + w-3/12` grid. The sidebar wraps around the content wrapper, and the content wrapper negotiates its own inner layout. This keeps the sidebar and right panel completely decoupled — neither needs to know the other exists.

### Layout Modes

#### Portrait (<768px)

```
Header
+----------------------------+
| [overlay sidebar (col-2)]  | ← hovers over content, auto-closes on selection
|   Chat + Context Band      |
|   Composer                 |
+----------------------------+
```

- Sidebar renders as a floating overlay at `col-2` width
- Content remains `col-12` underneath
- Right panel auto-suppressed (already wired via `showRightPanel`)
- One-click use: open → select → auto-close

#### Landscape (md+)

```
[ col-2 sidebar ] [                   col-10 content wrapper                   ]
                              [ chat col-9 ][ right panel col-3 ]
```

- Sidebar is `col-2`, persistent, toggled via ☰ hamburger
- Content wrapper is `col-10` when sidebar is open, `col-12` when closed
- Inside the content wrapper, the chat surface handles its own right panel split
- Right panel carve-out (`col-3` from the content wrapper's `col-10`) is invisible to the sidebar

---

### Layout Options (Revised)

The original spec enforced **mutual exclusion** — Right Panel open = Context Band hidden. After building and using the layout, this was relaxed:

* **Context Band and Right Panel can coexist.** The user controls redundancy via the eye toggles on each band section.
* This enables flexible configurations: e.g., journals on the right panel, images in the band, or only echo chips in the band with the full media gallery on the right.
* The collapse toggles already give users precise control — enforced exclusion would only remove freedom.

**Why this works:** The Context Band is always in the chat column. The Right Panel is a separate column. They don't compete for the same space — they offer different scales of the same content, and the user decides which scale to use for each section.

---

### Core Rules

* Portrait (<768px): left sidebar is an overlay, content is `col-12`, right panel force-suppressed
* Landscape (md+): left sidebar is persistent `col-2`, toggled via ☰ hamburger — content fills remaining space
* Right panel state persists in localStorage but is suppressed below 768px
* Right panel auto-restores when crossing back above 768px
* Context Band is always in the content column — independently collapsible via eye toggles
* Panel priority on shrink: right panel collapses first, then left sidebar

---

## 6. Bottom Toolbar Elimination

All bottom toolbar functionality is redistributed.

### Final Composer

```
[+] · [✨] · [textarea] · [✈]
```

### Mapping

| Old Feature        | New Location              |
| ------------------ | ------------------------- |
| Screenshot / Image | `[+]`                     |
| Imagine Mode       | Removed → Media `[+ Add]` |
| Image Studio       | Left Panel                |
| Stage Style        | Left Panel                |
| Memory & Context   | Header                    |
| Grounding          | Ellipsis                  |
| Trash              | Memory Popover            |

---

## 7. Left Panel (Navigation Router)

The Left Panel is not just a sidebar.

It is the:

> **Primary Navigation Router for Workspace Surfaces**

### Behavior

* `<768px`: overlay, auto-closes on selection
* `>=768px`: persistent, manual toggle

### Critical Shift

Selecting a panel:

> **Replaces the main content area entirely**

Chat is just one route among many.

---

### Routes

```
#/chat              → redirect to #/chat/messages
#/chat/messages     ← Chat view (InteractiveArea + composer)
#/chat/director     ← Director's Monitor
#/chat/world        ← World Bible
#/chat/characters   ← Characters
#/chat/media        ← Media
#/chat/archives     ← Archives
#/chat/notes        ← Notes
#/chat/settings     ← Settings (footer link)
```

All routes nest under `#/chat/` — this preserves the workspace context. `#/chat` alone redirects to `#/chat/messages` so existing bookmarks and deep links don't break.

### Component Architecture

`chat.vue` becomes a **workspace shell** — it owns the shared chrome and delegates the center surface via a component slot:

```
chat.vue                         ← workspace shell (shared chrome)
  ├── WindowTitleBar             ← session selector, tokens, LLM brain, memory, ellipsis, sidebar toggles
  ├── Left panel nav             ← ☰ toggle, route nav items, footer settings link
  ├── <component :is="activeSurface" />  ← center surface slot
  │     ├── chat_messages.vue    ← InteractiveArea + composer (current #/chat content)
  │     ├── chat_director.vue    ← Director's Monitor surface
  │     ├── chat_world.vue       ← World Bible surface
  │     ├── chat_characters.vue
  │     ├── chat_media.vue
  │     ├── chat_archives.vue
  │     ├── chat_notes.vue
  │     └── chat_settings.vue
  └── Right context panel        ← memories + media gallery (already built)
```

**The shell owns:**
- Header toolbar (always visible, never replaced)
- Left panel nav (always visible at md+, overlay at <768px)
- Right context panel (toggleable at md+, hidden at <768px)
- Center surface slot (the only part that changes between routes)

**Active surface** is keyed from a localStorage ref (`airi:chat:left-panel-active`) that holds the route segment (`'messages'`, `'director'`, `'world'`, etc.). A computed maps the key to the corresponding component via `markRaw()` for performance.

### Navigation State

| Property | Key | Default |
|----------|-----|---------|
| Left panel open | `airi:chat:left-panel-open` | `true` |
| Active surface | `airi:chat:left-panel-active` | `'messages'` |

### Behavior

* `<768px`: left panel renders as an overlay drawer, auto-closes on route selection
* `>=768px`: left panel renders as a persistent sidebar; collapsed by the ☰ hamburger in the header (sits between logo and session selector)

---

## 8. Right Context Panel

A vertical, expanded version of the Context Band.

### Behavior

* Only visible at `md+`
* Can coexist with Context Band — the user manages redundancy via eye toggles
* State persists in localStorage and is restored across sessions
* State is suppressed below 768px but automatically restores when width returns past the threshold

### Differences from Context Band

* Larger Memory cards with detailed metadata (STMM stats, content previews)
* Echo chips rendered as full-width vertical items (not grouped pills)
* "View More" pagination for Media Gallery (12 items per batch)
* Collapse toggles managed per-section via the Context Band badges

---

## 9. Token Metrics System (Refined)

### Visual Model

* Thin progress bar under header
* Represents:

  ```
  sessionTokens / contextWidth
  ```

### Behavior

* Smooth animated transitions
* Color escalation:

  * Neutral → Amber → Red

### Future Hook (Phase 4)

* Visual indication when compaction occurs
* Pre-threshold warning state

---

## 10. Phase 4: Extended System Layer

### 10.1 Input Preprocessing Pipeline

All enriched inputs pass through a deterministic pipeline:

```
User Input
 + Attachments / Links
   → Preprocessor
     → Normalized Context Bundle
       → LLM
```

### Capabilities

* Link metadata extraction
* Content scraping (when applicable)
* File parsing
* Media normalization

### Goal

Shift intelligence from:

* runtime tools

to:

* input shaping

---

### 10.2 Expanded `[+]` System

Adds support for:

* Audio input
* File attachments
* Link previews with extracted context

Strictly remains:

> message enrichment only

---

### 10.3 Director’s Monitor (First-Class Surface)

A dedicated timeline of **non-chat events**.

### Data Model (existing)

```ts
interface DirectorNote {
  id: string
  sessionId: string
  type: 'director-note'
  content: string
  intensity: number
  title?: string
  prompt?: string
  target?: 'user' | 'assistant'
  state: 'pending' | 'done'
  selected_concepts?: string[]
  scratchpad?: string
  createdAt: number
  isArchived?: boolean
}
```

### Core Rule

> Director’s Monitor is NOT chat.

### It represents:

* Narrative injections
* System-level interventions
* Generated artifacts
* Structured events

### It explicitly excludes:

* user messages
* assistant replies

---

### 10.4 Workspace Separation

Each surface:

* has independent rendering
* maintains its own scroll/state where appropriate
* avoids overloading the Chat view

---

### 10.5 Token Awareness Evolution

Future enhancements:

* compaction visualization
* threshold warnings
* contextual hints for token pressure

---

## 11. Component & Data Store References

### UI Components

* Chat Page: `chat.vue`
* Interactive Area: `InteractiveArea.vue`
* Journal Modal: `JournalMomentModal.vue`

### Stores

* Session Store: `session-store.ts`
* Character Store: `airi-card.ts`
* Journal Store: `memory-text-journal.ts`

---

# Final System Principle

Everything in the UI must map cleanly to one of these:

| Domain          | Surface                    |
| --------------- | -------------------------- |
| Message Content | Composer (`[+]`)           |
| System Behavior | Ellipsis                   |
| Navigation      | Left Panel                 |
| Context         | Right Panel / Context Band |

If something does not fit one of these, it does not belong in the current model.

---

This version removes ambiguity, locks the layout rules that would otherwise break under pressure, and cleanly separates what belongs where. It also sets you up to scale without reintroducing the chaos you just eliminated.

## Relevant Skills

- [[airi-desktop-chatbox]]
