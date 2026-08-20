# Creator Proposal: Studio Sidebar Panel (Creative Diagnostics Console)

This proposal outlines the design and implementation of the **Studio Sidebar Panel** (`chat_studio.vue`), which replaces the placeholder Characters sidebar.

It provides creators with a structured, "at-a-glance" creative dashboard during chat sessions to inspect how the runtime engine is organizing their card's assets, outfits, and location rules.

---

## 🎯 1. Core Principles: Separation of Concerns

Our card engine maintains strict boundaries between different entities for maximum control:
* **The Actors (Simulation Layer)**: Need details about their outfits, appearances, and surroundings to speak and act naturally. This data is stored as **`long_prose`** inside the card's `description` (or parsed from the system prompt) using structured markdown.
* **The Director (Orchestration Layer)**: Must not be influenced by raw actor-level prose (to prevent narration repetition). The Director only sees the **`prompt`** (for image generation) and a short **`description`** (for high-level context coordination) via the card's concept assets metadata.

The **Studio Sidebar** bridges this separation of concerns for the creator, pulling both layers together into a unified audit feed.

---

## 🔍 2. Analysis & Extraction Heuristics

The Studio Panel will dynamically inspect the active card's configuration (`visual_assets`, `modules`, `description`, and `system_prompt`) using the following rules:

### A. Characters (Actors & Wardrobes)
An asset is classified as a **Character** if:
1. It starts with an `actor_` or `actress_` key prefix in `visual_assets`.
2. It matches the predefined `concept_user` key (representing the user's entity on stage).
3. Or it possesses explicit speech or model bindings in its manifestation block.
4. *Fallback*: If the card is a Single-Character card with no actor keys, we fall back to displaying the primary character using `modules.displayModelId` or `card.name`.

**Prose Extraction**:
* **Appearance (Actor's Mind)**: We regex-parse the card's `description` or `system_prompt` targeting `### <|ACTOR:key|> Appearance` headers.
* **Acting Instructions**: We parse the section under `## Character Instructions` matching the `### actorKey` headers in `system_prompt`.

---

### B. Settings & Places
An asset is classified as a **Place** if:
1. Its key in `visual_assets` starts with the `place_` prefix.

**Prose Extraction**:
* **Surroundings (Actor's Mind)**: We parse the description field targeting `### Setting: [Place Name]` headers in `description` or `system_prompt`.
* **Director's Prompt**: The image prompt trigger (`visual_assets[key].prompt`).

---

### C. Other Concepts
* Any asset key that is not classified as a Character or Place is placed in the **Other** bucket (e.g. utility tokens, formatting configurations).

---

## 🎨 3. Proposed Panel Layout

```
+-----------------------------------------------------------------------+
|  STUDIO MONITOR                                                       |
|  Inspect active concept stacks and actor alignments.                  |
|                                                                       |
|  ACTIVE CONCEPTS: [ place_apt_living_room ] [ actress_rumi_pink ]    |
+-----------------------------------------------------------------------+
|  CHARACTERS                                                           |
|  +-----------------------------------------------------------------+  |
|  | AVATAR  | actress_rumi_pink            [Speech: OK] [Model: OK] |  |
|  |         |                                                       |  |
|  |         | Director's View: "Rumi's default pink dress outfit"   |  |
|  |         | Trigger: "rumi, (pink dress, frills)"                 |  |
|  |         |                                                       |  |
|  |         | > Show Actor's Perspective (Collapsible)              |  |
|  |         |   [Appearance Long Prose: "Cozy pink knit outfit..."] |  |
|  |         |   [Acting Instructions: "Speak with high energy..."]  |  |
|  |         |                                                       |  |
|  |         | Bindings: TTS (Deepgram/Kokoro), Model (Live2D ID)    |  |
|  |         +-------------------------------------------------------+  |
|                                                                       |
|  PLACES                                                               |
|  +-----------------------------------------------------------------+  |
|  | PREVIEW | place_apt_kitchen                            [Active] |  |
|  |         |                                                       |  |
|  |         | Director's View: "Cozy apartment kitchen layout"      |  |
|  |         | Trigger: "apartment kitchen, sleek countertops"       |  |
|  |         |                                                       |  |
|  |         | > Show Surroundings Lore (Collapsible)                |  |
|  |         |   [Long Prose: "Kitchen counter with tall stools..."] |  |
|  +---------+-------------------------------------------------------+  |
+-----------------------------------------------------------------------+
```

---

## 🛠️ 4. Execution Steps

1. **Rename Component**: Rename `chat_characters.vue` to `chat_studio.vue`.
2. **Update Layout Sidebar**: Update `chat.vue` to import `chat_studio`, rename the sidebar tab label to `"Studio"`, and set a clean icon (`i-solar:layers-minimalistic-bold-duotone` or similar).
3. **Build Parser Utils**: Implement structured regex parsers in `chat_studio.vue` to extract Actor/Setting descriptions from the raw prompt strings.

## Relevant Skills

- [[airi-stage-ui-surfaces]]
