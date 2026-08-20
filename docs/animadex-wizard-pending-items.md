# AnimaDex Wizard — Pending Items Summary

All items below are documented in [proposal-animadex-wizard.md](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/docs/proposal-animadex-wizard.md). None are currently implemented unless marked ✅.

---

## ✅ Implemented (This Session)

| Item | Detail |
|------|--------|
| Multi-actor ACTOR token routing in system prompt | Cast Roster index + per-character invocation hint |
| `confirmCreateCard` sets active card | Fixed `addCard` returning new nanoid — now captured correctly |
| Synthesis perspective rule | LLM instructed not to write "You are [UserNickname]" |
| ACTOR tokens in personality + description fields | All three assembly blocks updated |
| `🎭 Has Model` filter chip with count aggregate | Filter chip added to Step 1 catalog search filters showing count aggregates dynamically |
| Auto-prefill model/voice bindings in Step 2 | Step 2 pre-fills model and voice configurations from persistent settings |
| Auto-writeback manual binding changes | Manual Step 2 updates persist to local storage; manual unbinds are blacklisted to avoid re-linking; manual binds clear blacklist |
| VLM auto-link matching engine | Matches tags Jaccard similarity (>= 0.3) post-indexing to auto-link catalog characters |
| Group copyright upserts | Auto-linking automatically updates and pushes model series copyright names (e.g. "Umamusume") into the model's `groups` array in IndexedDB |

---

## ⏳ Pending — Speech Related (§8)

All three gaps below are **speech/TTS related** and form one cohesive feature:

| # | Gap | Where | Effort |
|---|-----|--------|--------|
| 8.1 | `voiceConfig.ust` not included in LLM synthesis payload | `handleGenerate()` cast builder | Small — read `boundVoices[c.id]` → look up `speechStore.savedVoiceProfiles` |
| 8.2 | `modelPromptSpeech` field missing from LLM output schema | `systemMsg` schema definition | Small — add field + CRITICAL RULE |
| 8.3 | `speechExpressionPrompt` always written as `""` | `confirmCreateCard()` | Small — read `synthesisProposal.actors[key].modelPromptSpeech` |

**These are all one pipeline:** UST config → LLM payload → LLM translates to natural language → written to `speechExpressionPrompt` on card assembly.

---

## ⏳ Pending — Per-Character Idle Animations (§7)

Blocked on a **schema gap** — must fix card schema before wiring wizard UI.

| # | Item | Effort |
|---|------|--------|
| 7.1 | Add `idleAnimations?: string[]` to `visual_assets.[actor_key]` schema | Small |
| 7.2 | Runtime: model switcher reads per-actor `idleAnimations` on actor switch | Medium |
| 7.3 | Synthesis prompt: instruct LLM to populate `idleAnimations[]` from `motions[]` | Small |
| 7.4 | Wizard Step 2 UI: add per-actor idle picker to Manifestation panel | Medium |
| 7.5 | Card Edit UI: expose per-actor idle pickers in Acting tab for multi-actor cards | Medium |

---

## 🔮 Future Phase: Dynamic Character Injection (Ad-hoc Cast Expansion)

Planned as part of [proposal-animadex-new-characters.md](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/docs/proposal-animadex-new-characters.md).

| # | Item | Effort | Description |
|---|------|--------|-------------|
| 9.1 | Mode A Injection | Medium | Automatic parsing and insertion for cards with template markers |
| 9.2 | Mode B Injection | High | Regex-based insertion for structured multi-actor cards without markers |
| 9.3 | Mode C Injection | High | Coercive conversion and wrapping of single-character cards into actor formats |
| 9.4 | UI / Integration Hooks | Medium | "Add Character" dashboard widget loading Wizard Steps 1 & 2 in modal context |
| 9.5 | Safety Backups | Small | Automatic backup or derivative generation prior to card modifications |

## Relevant Skills

- [[airi-animadex-wizard]]
- [[airi-card-editor-wizard]]
