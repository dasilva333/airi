# Proposal: AnimaDex Ad-hoc Cast Expansion (Dynamic Card Enrichment)

This proposal outlines the design and implementation of a system allowing users to add new characters and settings to an existing Card ad-hoc. It leverages the character gallery selection, voice/model binding, and LLM synthesis capabilities developed for the AnimaDex Wizard, applying surgical edits to the target card.

---

## 🎯 1. User Experience & Goals
When playing a card (e.g., a Steven Universe card with Amethyst, Garnet, Lapis, and Pearl), the user might realize they want to introduce another character (e.g., Peridot). Instead of rebuilding the entire card from scratch:
1. The user clicks an **"Add Character"** button on the Card Settings or Cast Panel.
2. The UI opens the character gallery (reusing the AnimaDex Wizard selection step).
3. The user picks their character(s) and configures their bindings (3D/Live2D models, voice configurations, and animation defaults).
4. The system analyzes the existing Card context (Lore, System Prompt, Roster) and merges the new character definitions into the configuration. **Crucially, the LLM always synthesizes relevant places/settings associated with the character's expansion lore (e.g., "The Barn" for Peridot) to offer world enrichment suggestions.**
5. In the final review step, the user can toggle whether they want to **"Include Synthesized Places & Settings"** in the final card writeback, letting them review the generated ideas first before buying into them.

---

## 🛠️ 2. Core Technical Challenges
*   **Card Integrity**: Modifying a live, functional card can lead to identity issues (e.g., mismatching character keys or voice mappings).
*   **Context Merging**: The LLM needs to generate structural data (Appearance, Personality, instructions) for the new character that harmonizes with the existing card's scenario.
*   **Prompt Modification Safety**: Modifying custom-crafted or single-character prompts requires simple, predictable append behaviors to prevent corrupted system prompts.

---

## 📐 3. Prompt & Metadata Modification Strategy (The Three Modes)

Depending on how the existing card's system prompt is formatted, the system selects one of three parsing behaviors.

> [!IMPORTANT]
> **Universal Metadata Ground Truth**: Regardless of the prompt mode, the card's underlying JSON data structure (`visual_assets` and `modules`) is always updated in the exact same way:
> - The new character concept entry, along with its associated model manifestation IDs and speech configurations, is appended to the card's metadata so that the character is recognized by the runtime renderer and audio engines.
> - If **"Include Synthesized Places & Settings"** is enabled by the user during review, the generated places are appended to the card's `visual_assets` dictionary as `place_[slug]` entries with their corresponding description, prompt, and empty manifestation blocks.

### Mode A: Auto-Generated Card (Structured Headers Found)
*   **Trigger**: The existing card possesses standard auto-generator headers: `## Cast Roster` and `## Character Instructions`.
*   **Execution**:
    1. Parse the system prompt to locate these sections.
    2. Insert the new character identifier `- <|ACTOR:actor_injected|>` directly under the `## Cast Roster` list.
    3. Append a new subsection `### actor_injected` under the `## Character Instructions` block with the synthesized acting guidelines.
    4. If the user decides to include the synthesized settings, locate the settings description list at the bottom of the prompt and append the new location description under its own `### Setting: [Place Name]` header.
*   **Risk**: Low. Predictable list and header insertions.

### Mode B: Hand-Crafted Multi-Actor Card (No Headers, Multi-Actor Structure)
*   **Trigger**: No standard structural headers are found, but the card contains multiple actor keys in `visual_assets` and uses `<|ACTOR:name|>` tokens in the system prompt.
*   **Execution**:
    1. Instead of attempting complex middle-of-text insertions, the system appends a clean, dedicated block to the end of the system prompt:
       ```markdown

       ## Injected Cast Expansion
       - <|ACTOR:actor_injected|>

       ### actor_injected acting instructions:
       [Injected character behavior and prompt details]
       ```
    2. If the user decides to include the synthesized settings, the locations are appended directly under the injected character section:
       ```markdown
       ### Setting: [New Place Name]
       [New location lore and scene descriptions]
       ```
    3. Append the bindings to the card JSON metadata.
*   **Risk**: Low. Clean appends are safe and let the LLM's attention block ingest the new rules naturally.

### Mode C: Single-Based Card (No Actor Tags, Single Identity)
To handle a single-character card (where the AI plays one specific character directly without prefix tokens), we consider two strategies:

#### Baseline: "Throw the User to the Wolves" (Simple Append)
*   **Trigger**: User confirms the single-to-multi warning message.
*   **Execution**: We do not attempt to restructure or "actorize" the original character's prompt sections. We simply append the new character's instructions and active actor token requirements (e.g. `<|ACTOR:actor_injected|>`) to the end of the prompt. If the user includes synthesized settings, we append the place descriptions at the end as well.
*   **Result**: The user can test how the LLM handles the raw transition, allowing them to clean it up manually if the output gets messy.

#### Premium Downstream Alternative: "Automated Actorization"
*   **Trigger**: Configured via advanced settings or triggered on request.
*   **Execution**: The system programmatically wraps the original card's primary character identity into an actor key (e.g. `actor_original`), inserts a prefixing rule header to the top of the system prompt, and updates the prompt body to require `<|ACTOR:actor_original|>` and `<|ACTOR:actor_injected|>` prefixes to differentiate speakers. If settings are accepted, location schemas are safely mapped under dedicated setting indices.
*   **Result**: A fully clean structural migration of a single-character card into a multi-actor card. *Note: We will monitor LLM behaviors during testing to evaluate if the migration complexity is justified.*

---

## 💾 4. Generation Review & Execution Actions (Step 4)

Once the LLM synthesizes the new character and setting content, the user is presented with a preview of the modified card structure. At this stage, the user has granular control over what gets applied:

*   **"Include Synthesized Places & Settings" Toggle**: A prominent checkbox showing the generated places list. Checking it updates the prompt and `visual_assets` metadata with the new locations; unchecking it ignores them.

At the bottom of the review step, the user can choose between two explicit execution commands:

### Option 1: Apply to Current Card (In-place with Backup)
*   **Action**: Modifies the active card directly.
*   **Safety Safeguard**: Before writing the changes, the system creates a timestamped backup of the current card inside the database (`[original-card-id]-backup-[timestamp]`) so the user can restore it if the generation goes awry.

### Option 2: Create as New Card (Derivative)
*   **Action**: Clones the existing card, appends the new character assets, assigns a derived ID (e.g., `[card-id]-expanded`), and saves it as an independent card.
*   **Use Case**: Ideal for keeping a clean master copy of the scenario and creating variants with different characters.

---

## 📅 5. Action Items & Roadmap
- [ ] **Phase 1 (UI)**: Add "Add Character" button to the Card Editor and wire it to mount the Wizard Step 1 & 2 components in a modal context.
- [ ] **Phase 2 (Parser)**: Build the injection engine utility that reads the target card and decides between Mode A, B, or C.
- [ ] **Phase 3 (Prompting)**: Create the character-synthesis system prompt for the LLM to generate the new character's matching lore segments (and optional setting/place descriptions).
- [ ] **Phase 4 (Review Options)**: Implement the Step 4 preview panel showing the generated settings with the "Include Synthesized Places & Settings" toggle, and "Apply to Current Card (with Backup)" and "Create as New Card" buttons.
- [ ] **Phase 5 (Verification)**: Test dynamic injection on Steven Universe and custom cards, validating that the new actor's model/voice config initializes.

---

## 🔄 6. Downstream Phase: Auto-Assign Backfilling for Existing Cards

To accommodate cards that were created without voice/motion assignments (or prior to the addition of AWS Polly/Deepgram presets), the Studio Tab will expose an **"Auto-Assign Voices & Motions"** utility for compatible cards (Mode A).

### The Auto-Extraction & Database Lookup Pipeline
Rather than asking the user to manually configure each character from scratch, the system will dynamically reconstruct the database context from the card's active JSON structures:

1. **Roster Identification**: Loop through `visual_assets` and capture all keys starting with the `actor_` prefix (e.g. `actor_amethyst_steven_universe`).
2. **Catalog Trigger-Matching**:
   - Extract the character's image prompt: `visual_assets[actorKey].prompt`.
   - Parse the leading trigger phrase (typically everything prior to the first comma, e.g., `amethyst (steven universe)`).
   - Cross-reference this trigger phrase against the local AnimaDex database catalog (`wizardStore.catalog`).
3. **Property Retrieval**:
   - **Gender**: Read the matching catalog entry's gender field (fully resolving the gender gap).
   - **Copyright**: Extract the associated series copyright field from the database record.
   - **Bound Model**: Capture `visual_assets[actorKey].manifestation.modelId` directly.
4. **Modal Mounting**: Map these properties to the `<AutoVoiceConfigModal>` options, allowing the user to select the preferred TTS provider (AWS Polly, Deepgram, or Kokoro) and review the matches.
5. **Writeback**: On user confirmation, write the returned bindings directly into the card's `visual_assets[actorKey].speech` and `modules[actorKey].speech` targets, and save the card.

## Relevant Skills

- [[airi-animadex-wizard]]
- [[airi-card-editor-wizard]]
