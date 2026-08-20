---
name: airi-animadex-wizard
description: >-
  Use when working with the AnimaDex Wizard — the 4-step cast-to-card guided synthesis (guided.vue monolith): the animadex-catalog.json tuple dataset, custom characters (BLIP auto-tagging), the sticky character-bindings localStorage map + blacklist, model auto-linking (Jaccard tag matching), Step 2 roster binding + AutoVoiceConfigModal LLM voice/idle assignment, Step 3 story suggester + BrainModelPicker, Step 4 LLM synthesis payload, doCreateCard card assembly with ACTOR tokens, or cast expansion into live cards. Peer skill: airi-card-editor-wizard (editor breadth, no deep wizard internals).
---

# AnimaDex Wizard — Cast Selection to Card Synthesis

The wizard turns a dataset catalog of ~36k anime characters + the user's local model/voice library into a fully-synthesized multi-actor roleplay card via LLM. Everything lives in one 1929-line monolith (`guided.vue`) — this skill's core job is giving you exact line anchors so you never have to scan the whole file.

## 1. Catalog Provenance & Refresh (READ THIS — the artifact is NOT what it looks like)

- **The catalog is committed, but the dataset is NOT.** `packages/stage-ui/src/assets/animadex-catalog.json` (912 KB) is a point-in-time extract baked into the repo. No transform/build script exists in `scripts/` — the "[id, copyrightIndex, name, trigger, tags, traits]" tuple shape was chosen as the committed artifact, but the transformation pipeline that converts a fresh AnimaDex dataset into this shape is not in this repo.
- **There is no `scripts/animadex-build.js` yet.** If you are asked to refresh the catalog, write it fresh: read the source dataset → emit `{ copyrights, facets, characters: [tuple stream] }` → overwrite the committed JSON → copy to `packages/stage-ui/public/assets/` → verify consumers (wizard loads via `?url` asset import, model-selector auto-linker hardcodes tuple indices).
- **Count drift is real and user-confirmed**: the proposal doc claims ~36k characters; the user asserts the current source dataset is 46k+. The committed artifact may lag. `node -e` a quick `characters.length` check before assuming freshness.
- **Store**: `packages/stage-ui/src/stores/animadex-wizard.ts` — `useAnimaDexWizardStore`. `loadCatalog()` (:56-73) maps tuples into `CharacterItem`. `currentStep` (:38), `selectedCharacters` basket, `storyPrompt` (:39-43), `boundModels` / `boundVoices` (:47-48), filter chips, `suggestions` autocomplete (:143-194), `filteredCharacters` (:197-279), `findCatalogCharacter()` (:281).
- **Thumbnails**: `getCharacterThumbUrl()` (:292-303) resolves `https://blobs.animadex.net/Outputs/thumbs/{trigger}.webp` (filename-sanitized); custom characters (`custom:` prefix) return `null` for thumbnails.

### Custom Characters (Step 1 manual addition path)
- `packages/stage-ui/src/stores/custom-characters.ts` — `useCustomCharactersStore`, persisted at `airi:animadex:custom-characters` (:17). `asCharacterItems` (:58-69) adapts to `CharacterItem` with sentinel `copyrightIndex: -1` and `traits: [0,0,0,0]`.
- Editor modal: `components/CustomCharacterModal.vue` — **image upload + BLIP auto-tagging** via `blip-local` vision provider `captionImage()` (:69, :90) fills the tags field.
- **`waifudiffusion` does NOT exist in this codebase**: the provider registry (`packages/stage-ui/src/libs/providers/providers/`) has zero image-generation providers (only LLM/TTS/STT/vision). The showcase doc's "WD14 visual auto-tagging" phrasing describes the blip-local captioning flow; if the user asks for waifudiffusion-based character art generation, that's a blue-sky feature requiring a new provider entry, not a hidden path.

## 2. The Sticky Bindings Map (the hidden backbone)

Manual model/voice picks persist across wizard runs via a raw-localStorage map keyed by **catalog trigger string**:

- **`settings/airi-card/character-bindings`** — `{ [trigger]: { trigger, displayModelId?, voice?: { baseProvider, baseModel, baseVoice }, voiceProfileId? } }`. Read by `getBindingsMap()` (`guided.vue:218-226`); written on manual model pick (`handlePickModel` :338-367), voice writeback (`writeBackVoiceBinding` :112-135), and by two non-wizard consumers: `model-assignment-modal.vue` and `model-selector.vue` (auto-linker).
- **`settings/airi-card/character-bindings-blacklist`** — `string[]` of triggers to skip. `unbindModel()` (:242-271) pushes a trigger here so auto-link never re-adds it; manual binds remove from it. Includes a double-toggle `showOnlyModels` hack (:264-265) to force `filteredCharacters` recomputation — don't delete it, it IS the reactivity bridge.
- **Auto-linker** (`model-selector.vue` `runAutoLinkCatalog()` :842-899): after "Tag All Models" batch (`blip-local` captioning :775-802), each model's tags are scored against every catalog character's tags field (tuple index `[4]`) using Jaccard similarity (:872-876); matches ≥ 0.3 (:886) write the binding and upsert the series name into the model's `groups`. Everything is keyed off that tag string — catalog tuple indices are load-bearing, changing the transform shape breaks this matcher.

## 3. guided.vue Step Anatomy (monolith map)

Script: lines 1-909. Template: lines 911-1929. Imports tell the dependency story: `animadex-wizard`, `custom-characters`, `display-models`, `llm`, `airi-card`, `consciousness`, `speech`, `providers`, `user-profile` (:2-18) + three modals (:20-22).

| Region | Lines | What |
| :--- | :--- | :--- |
| Welcome banner localStorage | :25 | `airi:animadex-wizard:welcome-banner-visible` |
| Custom character CRUD handlers | :38-62 | Modal open/edit/delete/clone |
| Step 4 preview state | :103-110 | `synthesisPayload`, `synthesisProposal`, `refinementGuidance`, `userDescriptionInput`, `includeSelfConcept` |
| onMounted | :156-163 | `loadCatalog()`; prefills `storyPrompt.nickname` from `userProfileStore.name`, description + image prompt from user-profile settings |
| Bindings helpers | :218-271 | `getBindingsMap`, `hasBoundModel`, `getModelPreviewUrl`, `unbindModel` (+blacklist) |
| prefillRosterBindings | :300-321 | Step 1→2 transition hook; voiceProfileId prefix sniffing: `voice_profile_*` → virtual-audio-studio :312-317 |
| Step 2 pick + writeback | :338-374 | `handlePickModel`, `getBoundModel` |
| Story suggester | :384-504 | `TropeTemplate` list :391-411, `fetchStoryIdeas` :417-481, `applySuggestion` :483 |
| Synthesis pipeline | :508-670 | `handleGenerate` (see §5) |
| Card creation | :673-908 | `doCreateCard` :673-895, `doConfirm` :898, `confirmCreateCard` :904 |
| STEP 1 template | :951-1311 | Search/autocomplete :1030-1075, gender/toggles :1077-1114, chips :1115, grid :1132-1268, World Dock :1270 |
| STEP 2 template | :1312-1447 | Roster rows :1346, model avatar avatar-picker, voice pill, Auto-configure button :1425 |
| STEP 3 template | :1448-1678 | Trope chips :1470-1479, guidance input + fetch :1489-1504, suggestion cards :1515-1563, nickname/looks/self-concept fields :1575-1620, BrainModelPicker :1653 |
| STEP 4 template | :1679-1869 | Developer payload toggle :1728, proposal dashboard :1738, refinement loop :1811-1830, three submit buttons :1832-1869 |
| Dialog mounts | :1871-1929 | ModelSelectorDialog, AutoVoiceConfigModal, CustomCharacterModal, VoiceCreatorModal |

### Step 1 specifics (cast selection)
- Autocomplete sources (`animadex-wizard.ts` :143-194): query-as-tag option, hair/eye color facets, copyright names, character names — capped at 15, character matches ≤ 5.
- "Has Model" toggle (`filteredCharacters` :259-275) reads the bindings map **directly from localStorage** inside the computed — reactivity is manual (see unbind hack above).
- Custom characters get hover management actions (edit/clone/delete) at template :1206.

### Step 2 specifics (roster binding)
- `handleNext()` (:323-331) calls `prefillRosterBindings()` — bindings map → in-memory `boundModels`/`boundVoices`.
- **AutoVoiceConfigModal** (`components/AutoVoiceConfigModal.vue`, 872 lines): 15s countdown on open (:297-313) so provider download can be cancelled; `runAutoConfiguration()` (:323) ask the active LLM to match voice presets (kokoro-local default :304) to cast by gender/tags AND pick 1-3 idleAnimations from each bound model's real motion list (:347-351, :353-369 prompt). Result lands in `handleApplyAutoVoices` (guided.vue :137-145) → `boundVoices` + writeback + `characterIdleAnimations` ref (:100) which Step 4 consumes as `idleAnimations` in `visual_assets`.

## 4. Step 3 LLM & Profile Wiring

- Suggestion prompt: `fetchStoryIdeas` (:417) — system prompt :436-449 (3 scenarios, unified world, raw JSON array); user message contains only cast + optional guidance.
- Nicknames post-processing (:459-468): replaces `{Name}`/`[User]`/etc. placeholders with `userProfileStore.name` — the user profile settings (`packages/stage-ui/src/stores/settings/user-profile.ts`, keys `settings/user-profile/*`) feed nickname, "Your looks", and the image-prompt field (:158-162 prefill, template :1575-1614).
- Bottom LLM indicator: `BrainModelPicker` at :1653 lets the user switch the consciousness model that BOTH suggestion-gen and Step-4 synthesis will use (`consciousnessStore.activeModel/activeProvider` — no per-wizard override exists).

## 5. Step 4 Synthesis & Card Creation (do NOT skim this)

`handleGenerate()` (:508-670):
1. Builds `cast` with per-character `actingCapabilities` (format detection :519-530, `getOrLoadModelCapabilities` :521) — this feeds the LLM the exact whitelisted expressions/motions per bound model.
2. **Deterministic actor keys** (:549-554): `actor_${slug}` where slug is lowercased ASCII+underscore name. This EXACT slug formula is duplicated in at least 4 places (:552, :656, :765, :837) — change one, change all.
3. Compiles `synthesisPayload` (cast + storySettings + actorKeys + activeLLM) — shown in the developer view (:1728).
4. Synthesis system prompt (:595-624): schema requires `name/scenario/first_mes/alternate_greetings/system_prompt/places (place_main + 1-2 alts)/actors`. CRITICAL RULES (:619-622): keyed ACT tags only (:586-593 `actTemplateRules`), unique per-actor greetings starting with `<|ACTOR:...|>`, never "You are [UserNickname]" (:591).
5. On LLM failure, falls back to a mock proposal so the dashboard is never empty (:638-665).

`doCreateCard()` (:673-895) — the order matters:
1. Inherits the ACTIVE card's `artistry` settings via JSON serialize-deserialize clone (:685-687) — strips reactive proxies AND preserves provider/spawnMode/autonomous config.
2. Assembles `system_prompt` from parts: Cast Roster index → response format example → World Premise → per-actor instructions (:694-716).
3. First character's bound model/voice become card-level `modules.displayModelId` / `modules.speech` defaults (:747-761); EVERY actor also gets `modules[actorKey]` + `visual_assets[actorKey]` with prompt = `trigger, (tags)` (:772), behavior/stations from Step 2 (:796), speech from `boundVoices` (:800-806).
4. `concept_user` visual asset only if `includeSelfConcept` (:810-819); places as `isBase: true` (:821-833); `active_concepts` = actor slugs (+concept_user) (:836-843).
5. Final card (:846-883) is CC-v3-shaped under `data:` with `extensions.airi.{modules, visual_assets, active_concepts, artistry, acting}`. Saved via `addCard` + `activateCard` (:885-886). `doConfirm` (:898) resets + navigates WITHOUT saving; `confirmCreateCard` (:904) saves then closes. The three Step-4 buttons deliberately expose all three combos.

## 6. Pitfalls & Failure Modes

- **Catalog tuple indices are contractual**: `[0]` id, `[1]` copyrightIndex, `[2]` name, `[3]` trigger, `[4]` tags, `[5]` traits. The auto-linker, autocomplete matcher, and thumbnail URL all hard-code indices.
- **Actor key slug duplication**: 4 copies of the same regex chain; mismatched slugs silently orphan proposal actors in `doCreateCard`.
- **Bindings map is localStorage, not unstorage**: it does NOT sync via BYOS. Voice bindings travel as raw provider ids.
- **Don't remove blacklist flows without replacement** — they are the only stop on auto-link re-binding an intentionally-unbound model.
- **`isGenerating` double-duty**: `handleGenerate` emits it BEFORE the LLM returns :510, and Step-4 preview stays live across refinements; the mock-fallback path is user-visible by design (toast warns).
- **`airi-text-to-motion` / acting prompts are static defaults** at :876-878; the card gets `modelExpressionPrompt: 'Trigger expressions matching dialogue emotions.'` — extend here if the acting-keys schema evolves.

## 7. Cross-Citations

- `docs/proposal-animadex-wizard.md` — founding spec (Step 4 schema, suggestions UX, pending speech gaps §8).
- `docs/proposal-animadex-new-characters.md` — ad-hoc cast expansion into live cards (three prompt-parsing modes A/B/C; same bindings map + `visual_assets` ground truth).
- `docs/project-animadex-wizard-pending-items.md` — live implementation status ledger.
- `docs/content/en/docs/showcase/02-animadex-wizard.md` — product showcase.
- Peer skills: `airi-card-editor-wizard` (index.vue editor + import), `airi-card-schema` (AiriCard/AiriExtension Valibot), `airi-tool-registry-builtin-tools` (visual_assets consumers), `airi-memory-ui-pages` — none of these covers this wizard's internals.

## 8. Verification

- `pnpm -F @proj-airi/stage-pages typecheck` after guided.vue or component changes; `pnpm -F @proj-airi/stage-ui typecheck` for store-level edits.
- Runtime: Settings → AIRI Card → "Create With Wizard" (`/settings/airi-card/guided`); step 4 end-to-end requires an active consciousness model.

## Related Skills & References

- **Peer Skills**: [[airi-card-editor-wizard]], [[airi-card-schema]], [[airi-memory-ui-pages]], [[airi-tool-registry-builtin-tools]]
- **Key Documents**: [[proposal-animadex-wizard]], [[proposal-animadex-new-characters]], [[project-animadex-wizard-pending-items]], [[02-animadex-wizard]]
