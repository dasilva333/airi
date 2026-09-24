# Mind Map — Cognitive Graph & Dual-View Memory Explorer

> **Status:** Design draft — approved dual-view architecture.
> **Surface key:** `knowledge-graph` (or `mind-map`)
> **Sidebar location:** RECALL section, below Eternal Thread and Production Log.
> **Core Stores:** `useEntityLedgerStore`, `useMemoryShortTermStore` (24h Daily Summaries), `useChatSessionStore`

---

## 1. Problem & Vision

AIRI's **Entity Ledger** (`useEntityLedgerStore`) is uniquely grounded:
- **Semantic Facts:** Entities (people, places, concepts, organizations) connected by Subject-Predicate-Object claims with reinforcement counts and belief supersession chains.
- **Episodic Reality:** Every entity carries `mentions: Set<string>` referencing exact dialogue turn records (`SourceRecord`) with verbatim quotes, speaker provenance, and millisecond timestamps (e.g. `5/30/2026, 10:31:02 AM`).
- **Daily Chapter Digests:** The 24h short-term memory system generates continuous chronological summaries.

Rather than forcing users into a single visualization, the Mind Map provides **two complementary views over the exact same underlying memory data**, toggled with a single switch in the workspace header:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  RECALL  >  MIND MAP                                                                   │
│  VIEW MODE:   (●) Constellation Graph       ( ) Chronological Timeline                 │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. View Mode 1: Constellation Graph (The "Neocortex" View)

The **hero interactive force-directed graph** that visualizes the character's mental world model:

```
                          [ NERV ] ───────── [ Misato ]
                             │                   │ (steals)
                             │                   ▼
                          [ Asuka ] ──────── [ Herbal Essences ]
                             │
                          [ User ]
```

### Canvas Mechanics
- **Nodes = Entities:** Bubbles sized logarithmically by `mentions.size` (e.g. *Asuka* [520 mentions] and *User* [263 mentions] are major gravity centers; *Herbal Essences* [2 mentions] is a localized leaf node).
- **Color Coded Categories:**
  - 🟣 Organization (*NERV*, *Haribo*, *Herbal Essences*)
  - 🔵 Person (*Asuka*, *Misato*, *Shinji*, *User*)
  - 🟢 Place (*Germany*, *Hokkaido*, *Black Forest*)
  - 🟠 Concept (*That absolute BAKA*, *LCL*, *Entry 47*)
- **Edges = Claims:** Labeled directed lines (*Asuka* ──`uses`──> *Herbal Essences*). Edge thickness reflects `reinforcementCount`. Dashed lines indicate `supersededBy` outdated beliefs.
- **Physics Simulation:** Connected entities attract; unrelated entities gently repel. Clusters naturally self-organize (e.g. the friend group clusters together; isolated topics drift to the periphery).

### Interaction Model
- **Click Node $\rightarrow$ Focus:** Zooms and centers on the entity. Directly connected nodes glow brightly; everything else dims to ~30% opacity. Opens the **Entity Detail Drawer** on the right.
- **Double-Click Connected Node $\rightarrow$ Walk the Graph:** Shifts focus to that node, letting you explore through association chains.
- **Click Edge $\rightarrow$ Claim Evolution:** Displays claim detail, reinforcement count, and belief updates ("used to think X, now corrected to Y").
- **Search & Category Filters:** Type to pulse matching nodes; filter chips toggle visibility by entity category.

---

## 3. View Mode 2: Chronological Timeline Stream (The "Timeline" View)

An alternative, linear representation of the **exact same data**, working chronologically (or in reverse) through time:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  CHRONOLOGICAL TIMELINE STREAM                                    [ Newest First ▼ ]   │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  ▼ MAY 30, 2026                                                                        │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │ 📖 24H CHAPTER SUMMARY: "Late Night Hair Brushing & Trust"                       │  │
│  │ Asuka let down her guard during a quiet moment, opened up about her mother's     │  │
│  │ shampoo, and complained about Misato stealing it.                                │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
│  │                                                                                     │
│  ├── 10:31:02 AM  •  NEW ENTITY DISCOVERED: [ Herbal Essences ] (ORGANIZATION)        │
│  │   Claim: Asuka ──[uses]──> Herbal Essences                                         │
│  │   Claim: Misato ──[steals]──> Herbal Essences                                      │
│  │   Turn Quote: "[Asuka stiffens... It's not NERV's cheap stuff. I bring my own—     │
│  │                Herbal Essences, the red bottle...]"                                 │
│  │                                                                                     │
│  ├── 10:28:44 AM  •  ENTITY REINFORCED: [ Misato ] (PERSON, +1 mention)                │
│  │                                                                                     │
│  ▼ MAY 25, 2026                                                                        │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │ 📖 24H CHAPTER SUMMARY: "Tactical Evaluation & Black Forest Reminiscence"        │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
│  ├── 04:15:20 PM  •  NEW ENTITY DISCOVERED: [ German Black Forest ] (CONCEPT)         │
│  │                                                                                     │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Timeline Mechanics
1. **Linear Event Spine:**
   - Grouped by date buckets, reading forwards or backwards in time.
   - Highlights **Entity Births** (the exact moment a character learned a new person, place, or concept).
   - Highlights **Claim Assertions & Revisions** (when a belief was formed or superseded).
2. **24h Memory Chapter Cards:**
   - Integrated directly into the stream as contextual narrative anchors.
   - Summarizes the overall emotional and conversational tone of each day.
3. **Filtering by Entity:**
   - Select any entity (e.g. *Herbal Essences*) to isolate its **Personal Lifeline**: see only the moments that specific entity was mentioned across history.
4. **Verbatim Dialogue Grounding:**
   - Every event in the timeline features its direct turn quote with an *"Inspect in Chat"* link to jump directly to that point in conversational transcript history.

---

## 4. The Shared Temporal Scrubber Bridge

Both views are bridged by a **Universal Time Slider** along the bottom bar:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  ◀  Day 1 (May 20) ────── Day 5 (May 25) ────── Day 10 (May 30) ────── Today (Live)  ▶ │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

- **In Constellation View:** Dragging the slider filters the visible nodes on the canvas. Dragging forward lets you **watch the character's mind expand and grow** as new entities pop into existence.
- **In Timeline View:** Dragging the slider smoothly scrolls the chronological stream to that exact point in time.

---

## 5. Summary of View Differences

| Dimension | Mode 1: Constellation Graph | Mode 2: Chronological Timeline |
| :--- | :--- | :--- |
| **Cognitive Focus** | **Associative / Spatial (Neocortex)** | **Linear / Episodic (Autobiographical)** |
| **Visual Structure** | Force-directed node-edge network | Vertical chronological stream |
| **Primary Question** | *"How is knowledge organized and connected?"* | *"When did the character learn this, and what happened next?"* |
| **Best For** | Relationship mapping, clustering, belief revision | Tracking history, narrative recaps, timeline auditing |
| **Underlying Data** | `useEntityLedgerStore` | `useEntityLedgerStore` + `useMemoryShortTermStore` |

---

## 6. Zero-State Experience & Self-Healing Priming

### The "Empty Void" Problem
If a user clicks **RECALL → Mind Map** on a character that hasn't had their knowledge graph primed, landing on a blank black void feels like a broken feature.

### The Engaging Zero-State Canvas
When `entities.length === 0`:
1. **Visual Watermark:** A faint, pulsing constellation wireframe with floating stardust particles.
2. **Contextual Discovery Telemetry:**
   > **"Asuka's Mind Map is Unprimed"**
   > *Discovered 514 dialogue turns across 3 sessions and 3 Sacred Journal records waiting to be synthesized.*
3. **Primary Action Callout:**
   A prominent primary button: **`⚡ Synthesize Knowledge Graph`**.

### Self-Healing Permission Guard (One-Click Activation)
When the user clicks `⚡ Synthesize Knowledge Graph`:
- The system checks if **In-Flight Memory Grounding (Universe RAG++)** is enabled on the active character card (`extensions.airi.cognitionConfig.inFlightGrounding`).
- **If Grounding is Disabled:** Instead of failing silently or forcing the user to leave the page, a friendly confirmation modal appears:
  ```
  ┌────────────────────────────────────────────────────────────────────────┐
  │  Enable In-Flight Memory Grounding?                                    │
  │                                                                        │
  │  To synthesize this Mind Map and ground future dialogue with these     │
  │  memories, we need to enable Universe RAG++ for Asuka.                 │
  │                                                                        │
  │  [✓] Enable Universe RAG++ & Grounding                                 │
  │  [✓] Classify Entities via System 1 (Jev / ModernBERT)                 │
  │                                                                        │
  │                     [ Cancel ]    [ Enable & Synthesize ]              │
  └────────────────────────────────────────────────────────────────────────┘
  ```
- Clicking **`Enable & Synthesize`**:
  1. Atomically updates the character's cognition settings to active.
  2. Fires `entityLedgerStore.rebuildKnowledgeGraph(characterId)`.
  3. Displays a live progress bar right on the canvas:
     > *"Classifying candidate entities with System 1... [========----] 64%"*
  4. As nodes and claims are extracted, they dynamically pop into existence on the canvas in real-time.

---

## 7. In-Canvas Utility Controls & Quick Settings

Users should not have to leave the Mind Map and dig into Settings just to manage their knowledge graph. The workspace canvas header includes a **Cognition Utility Strip**:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  RECALL  >  MIND MAP                     🟢 Universe RAG++ Active  [ ⚡ Rebuild ] [ ⋮ ]│
│  View: (●) Constellation  ( ) Timeline   Stats: 277 Entities · 3 Claims · 514 Turns    │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Key Quick Controls:
1. **`⚡ Rebuild Knowledge Graph` Button:**
   Always available in the top bar. Initiates a fresh scan of newly accumulated dialogue turns and journal entries without opening the settings menu.
2. **Cognition Health Status Pill:**
   - `🟢 Universe RAG++ Active` (click opens Quick Settings flyout).
   - `🟡 Grounding Paused` (click prompts 1-click resumption).
3. **Quick Settings Flyout (`⋮` menu):**
   - **Toggle:** `In-Flight Memory Grounding` (On/Off)
   - **Toggle:** `Deep Memory Reasoning` (On/Off)
   - **Selector:** Precision Reranking Engine (`Local Laya` vs `TypeSafe Jev`)
   - **Destructive:** `🗑️ Clear Knowledge Graph` (with confirmation)
   - **Link:** *"Configure Full Cognition in Character Card →"*

---

## 8. Official Tech Stack & Rendering Architecture

### Core Libraries & Packages

| Layer | Technology | Role & Justification |
| :--- | :--- | :--- |
| **Physics Simulation** | **`d3-force`** (~15 KB) | Computes non-linear mechanics: many-body charge repulsion, link spring attraction, radial centering, and collision bounding. Runs decoupled from the DOM. |
| **Pan & Zoom Canvas** | **`d3-zoom`** (~10 KB) | Provides buttery smooth mouse/trackpad panning, pinch-to-zoom, bounds containment, and programmatic focus transitions (`transition().call(zoom.transform, ...)`). |
| **Primary Renderer** | **Vue 3 Declarative SVG** | Nodes, halos, and edges are native SVG elements rendered reactively by Vue templates. Allows full UnoCSS styling, CSS transitions, filter blurs, and hover hitboxes. |
| **High-Density Fallback** | **HTML5 Canvas** (LOD) | If a universe or character exceeds 600+ visible nodes, the canvas switches from SVG DOM to a single `<canvas>` driven by `requestAnimationFrame` for 60fps performance. |
| **Styling & Theming** | **UnoCSS + CSS Filters** | Glowing anime/cyberpunk aesthetic using UnoCSS classes, SVG `feDropShadow` / `feGaussianBlur` filters, and dark-mode tokens. |
| **Icons** | **Iconify** | Category markers and action icons (`carbon:network-4`, `carbon:time`, `carbon:search`, `carbon:filter`, `carbon:information`, `carbon:renew`). |
| **State Management** | **Pinia Stores** | Direct consumption of `useEntityLedgerStore`, `useMemoryShortTermStore`, and `useChatSessionStore`. |

### New Dependencies to Install
```bash
pnpm -F @proj-airi/stage-pages add d3-force d3-zoom
pnpm -F @proj-airi/stage-pages add -D @types/d3-force @types/d3-zoom
```
*(Combined bundle impact: **< 25 KB gzipped**, avoiding monolithic D3 bloat)*

---

## 9. Technical Implementation Blueprint

### Workspace Component Hierarchy
```
apps/stage-tamagotchi/src/renderer/components/chat/chat_knowledge_graph.vue
  └─ packages/stage-pages/src/pages/knowledge-graph/MindMapExplorer.vue
       ├─ MindMapHeader.vue (View toggle, Cognition pill, Rebuild button, Quick Settings)
       ├─ [Empty State] MindMapZeroState.vue (Telemetry summary + Self-healing enable CTA)
       ├─ [Mode 1] ConstellationCanvas.vue (Vue SVG + d3-force + d3-zoom)
       ├─ [Mode 2] ChronologicalTimelineView.vue (Vertical linear event feed)
       ├─ UniversalTimeScrubber.vue (Shared bottom timeline slider with 24h pins)
       └─ EntityDetailDrawer.vue (Slide-out provenance, claims, and lifeline inspector)
```

### Route Wiring (`chat.vue`)
1. Add `'knowledge-graph'` to the `activeSurface` union type.
2. Add entry to `SURFACE_LABELS` (`"Mind Map"`) and `SURFACE_ICONS` (`carbon:network-4`).
3. Add to `NAV_SECTIONS` under the `RECALL` group (directly below Eternal Thread and Production Log).
4. Code-split async import for `chat_knowledge_graph.vue`.
5. Support in compact drawer navigation.
