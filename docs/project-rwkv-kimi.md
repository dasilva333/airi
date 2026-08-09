**The `state-merger.ts` file I read does not actually merge state tensors yet.** Here is the complete body of `mergeStateWithBaseModel` (lines 53–64):

```ts
export async function mergeStateWithBaseModel(
  baseBuffer: ArrayBuffer,
  stateBuffer?: ArrayBuffer,
): Promise<ArrayBuffer> {
  if (!stateBuffer) {
    console.info('[RWKV-Harness] No state file provided; using base model safetensors as-is.')
    return baseBuffer
  }

  console.info('[RWKV-Harness] Merging state file tensors into base model safetensors...')
  return baseBuffer // ← returns baseBuffer unchanged; stateBuffer is never read
}
```

The print statement runs, but `stateBuffer` is never touched — the function is currently a passthrough stub. Similarly, `rwkv-session.ts`'s `generate()` is a canned-response stub (hardcoded Miss Strawberry text, no WASM inference): `Session.from_reader` from `@cryscan/web-rwkv-wasm` isn't invoked anywhere in the harness yet. And `01-toggle4-topics.ts` uses `generateSimulatedStateVector('cooking'|'rust')` — synthetic `Math.sin()` vectors with topic-seeded phases — not real hidden states.

So my read: Phase 0 validated the **disk caching + fetch plumbing** (real, verified — 364 MB in `.cache/`), and validated that the harness *scaffolding* matches the Miss Strawberry model card's expected output by construction. The G1 epilogue/state-repo README's Phase 0 conclusion ("PASSED") is accurate at the plumbing level, but the actual `.state` tensor overlay → logit-level behavior change has not yet been empirically observed in this harness. The roleplay fingerprint you saw is the stub.

**This doesn't block Phase 3 design work at all** — the corpus schema, eval methodology, and R&D failure-mode analysis are all independent of whether inference is live. And we can still build `03-echo-chip-eval.ts` now with a clearly-marked real/simulated inference seam, exactly as prior phases did.

Here's the complete Phase 3 design. Per the roadmap you linked, the file layout is already reserved: `experiments/03-echo-chip-eval.ts` + `test-prompts/echo-chips-corpus.json`.

---

## 1 · `experiments/03-echo-chip-eval.ts` — Cleanroom Experiment Design

### 1.1 Execution flow (5 stages)

```
Corpus Loader → Prompt Builder → RWKV Inference → Output Parser/Validator → Scorer
     │                │                │                   │                    │
 corpus.json    evidenceWindow    state-merged      valibot ChipSchema    metrics report
 (N sessions)   (mirror of       WASM session      + repair ladder      (5 metrics,
                 echo-chips.ts)   (temp sweep)                          per-session JSON)
```

**Stage 1 — Corpus ingestion.** Load `echo-chips-corpus.json` as a typed `EvalSession[]` (schema in §2). Each session carries its own `groundTruthChips` so the scorer never needs AIRI's IndexedDB — the corpus is a frozen, version-controlled snapshot of cloud-model ground truth. This is deliberate: local-storage chips have no provenance trail (no record of which cloud model/prompt generated them), so for an auditable baseline, corpus entries should be **regenerated or verified against the *exact* production prompt** before being blessed as ground truth. (Extraction path for real sessions still exists: `local:memory/echo-chips/{userId}` via `echoChipsRepo.getAll`, joined with `chatSessionsRepo` window collection — same `collectWindowMessages` logic, ported to read from exported session JSON instead of Dexie.)

**Stage 2 — Prompt construction (mirror production exactly).** Rebuild the evidence window identically to `synthesizeForCharacter` (echo-chips.ts:248-254):

```
${index}: [${iso}] ${speaker}: ${content}   joined by \n
```

then wrap it in the production instruction block (echo-chips.ts:256-271) verbatim. **Match matters**: if the harness prompt drifts from production, we're measuring prompt sensitivity, not model capability. One required tweak: the prompt currently asks for "3-5 semantic Echo Chips" — for eval, pin `minPills = maxPills` per corpus entry or let it float and score recall accordingly (§1.3).

Character name substitution: evidence uses `User:` / `<charName>:` speaker labels, and the corpus schema carries `characterName` per session (default `"AIRI"`).

**Stage 3 — Inference with state overlay.**

```ts
const baseBytes = await fetchTensorBinary(DEFAULT_BASE_MODEL_URL)
const stateBytes = await fetchTensorBinary(DEFAULT_ROLEPLAY_STATE_URL)
const merged = await mergeStateWithBaseModel(baseBytes, stateBytes) // STUB — see blocker note
const engine = new RwkvCleanroomEngine(merged) // STUB — canned generate()

const rawOutput = await engine.generate({
  prompt,
  maxTokens: 512,
  temperature: T, // swept: [0.3, 0.7, 1.0] lower than roleplay temp
  topP: 0.9, // ↑ from roleplay 0.6 — see R&D §3
  presencePenalty: 0.0, // ↓ from 1.5 — CRITICAL, see R&D §3
})
```

Run **three decoding configs** (structured-extraction decoding ≠ roleplay decoding, this is a first-class experiment variable and gets its own column in the report):

| Config | temp | top_p | presence_pen | Hypothesis |
|---|---|---|---|---|
| `rp-fidelity` | 1.3 | 0.6 | 1.5 | Roleplay preset — control; expected to fail JSON compliance |
| `extraction-mid` | 0.7 | 0.9 | 0.0 | Primary candidate |
| `extraction-low` | 0.3 | 0.9 | 0.0 | Max schema compliance; risk of degenerate/repetitive chips |

**Stage 4 — Parse & repair ladder.** RWKV output on a 0.1B model will rarely be clean JSON, so parsing is an explicit graded pipeline (each stage counts how often it fired — those rates are themselves a headline metric):

1. `JSON.parse` direct.
2. Substring extraction: first `{` → last `}`; retry parse.
3. Code-fence stripping (` ```json `) + retry.
4. Line-wise salvage: regex for individual `{"content": ..., "type": ...}` objects; rebuild `pills` array.
5. Fail → record as `schema_failure`, score similarity as 0 for that session.

Then run the production `normalize` mapper (echo-chips.ts:291-304) verbatim — alias mapping (`pill`/`text`→`content`, `category`→`type`), `normalizeChipType`, relevanceScore defaulting — followed by valibot `v.safeParse(ArtifactsSchema, …)`. This replays the production tolerance envelope and tells us whether the existing normalization is sufficient for a weak local model.

**Stage 5 — Scoring.** Per-session and aggregate (§1.3 below). Output appended to an eval-report JSON:

```
scripts/tests/rwkv-harness/reports/03-echo-chip-eval-<timestamp>.json
```

so successive runs (state A/B tests, decoding sweeps) are diffable.

### 1.2 The state-file question (design decision I'd flag)

Recommendation: **run the eval with an A/B toggle — base-only vs. base+roleplay-state** — before committing to the roleplay overlay as the default. The roleplay `.state` nudges *turn-taking persona* behavior ("Miss Strawberry" style). Echo Chip extraction is an analytical/summarization task: the persona prior may produce chatty preamble (`(She reads the chat log carefully) Okay! Here are the chips~`) that burns tokens and breaks JSON compliance, or conversely may improve multi-word evocative phrasing over the raw base model. That's an empirical question — the harness is exactly the place to answer it. Cheap to test; two runs.

### 1.3 Metric definitions

| Metric | Definition | Gate (0.1B) |
|---|---|---|
| **Schema compliance rate** | `% sessions ≥ stage-2 parse success` (and report ladder stage histogram) | ≥ 90% after repair |
| **Evidence-spanned cosine similarity** | For each GT pill: `max` cos-sim against any RWKV pill (embeddings — see below). Session score = mean over GT pills | ≥ 0.75 mean |
| **Precision @ k** | Fraction of RWKV pills with cos-sim ≥ 0.65 against *any* GT pill (hallucination detector) | ≥ 0.70 |
| **Type agreement** | `{mood, flavor, journal_candidate}` exact-match rate on matched pill pairs | ≥ 0.80 vs. `normalizeChipType` |
| **Relevance calibration** | `|relevanceScore_pred − relevanceScore_GT|` mean (both exist in corpus) | ≤ 0.15 |

**Embedding source — key infra choice.** No separate embedding model download: the harness already has RWKV's own `emb.weight` matrix — embed GT and predicted chip text by tokenizing + averaging token embeddings (mean-pool with L2 norm). This is cheap, local, and reproducible. **Caveat:** same-embedder scoring can flatter RWKV output (identical surface tokens score high). Mitigation: also log raw token-overlap F1 (bag-of-words) as a sanity-metric; if cosine is high but F1 ≈ 0 everywhere, distrust it. If we later find the threshold too forgiving, promote the existing `packages/stage-ui/src/libs/workers/search` embedding path — but don't import stage-ui into the Node harness (Vue/Pinia dep tree), keep Phase 3 cleanroom-pure.

**Statistical note:** a small corpus (5–15 sessions) of 3–5 pills each gives 15–75 pill-pairs per config. Fine for go/no-go at these gate thresholds via simple CIs; not fine for fine-grained distinctions between decoding sweeps. Treat config comparison as directional until the corpus grows in Phase 5.

### 1.4 What ships in the file

```ts
// experiments/03-echo-chip-eval.ts — structure sketch
const CONFIGS = [rpFidelity, extractionMid, extractionLow]
for (const cfg of CONFIGS) {
  for (const session of corpus.sessions)
    rawOutput = await engine.generate(buildPrompt(session), cfg.sampling)
}
parseResult = repairLadder(rawOutput) // stages 1–5, counts
validated = v.safeParse(ArtifactsSchema, normalize(parseResult))
scored = scoreSession(validated, session.groundTruthChips, embedder)
report.aggregate(); report.write()
```

---

## 2 · `test-prompts/echo-chips-corpus.json` — Corpus Schema

Extending the proposal's example into the full typed shape the eval consumes:

```json
{
  "corpusVersion": "0.1.0",
  "generatedBy": {
    "model": "claude-sonnet-4-5 | gpt-4o | ...",
    "promptHash": "sha256 of exact production prompt text used",
    "extractedAt": "2026-08-08"
  },
  "sessions": [
    {
      "sessionId": "session-1029",
      "characterName": "AIRI",
      "source": "real-transcript | synthetic-handcrafted",
      "chatTranscript": [
        { "role": "user", "content": "I tried baking sourdough today, but the crust got burned.", "createdAt": 1754654400000 },
        { "role": "assistant", "content": "Ah, temperature control is tricky! What temp did you set?", "createdAt": 1754654460000 }
      ],
      "groundTruthChips": {
        "pills": [
          { "content": "Baking Sourdough", "type": "flavor", "relevanceScore": 0.9, "evidence_indices": [0] },
          { "content": "Kitchen Failure / Frustration", "type": "mood", "relevanceScore": 0.8, "evidence_indices": [0] },
          { "content": "First Loaf Milestone", "type": "journal_candidate", "relevanceScore": 0.7, "evidence_indices": [0, 1] }
        ]
      },
      "negativeControls": {
        "mustNotContain": ["greeting", "hello", "microphone test"]
      }
    }
  ]
}
```

Design decisions, briefly:

- **`evidence_indices` is now REQUIRED ground truth** (production schema has it optional). It enables a sixth metric — evidence grounding: do the RWKV pill's claimed evidence lines actually mention the chip content? A hallucination signal that's stronger than cosine alone.
- **`promptHash` in `generatedBy`** — answers the provenance problem from §1.1: any corpus entry whose hash doesn't match current production prompt text gets flagged `stale: true` and excluded from gating.
- **`negativeControls.mustNotContain`** — direct test of production requirement #5 (ignore greetings/filler). If RWKV emits a chip whose content fuzzy-matches a banned string, that's a targeted precision failure independent of similarity.
- **`source` field** — corpus should mix **real transcripts** (ecological validity, the actual AIRI evidence window) with **handcrafted synthetic sessions** (targeted stress cases: 80-message max windows, topic shifts mid-window, mostly-filler chats that should yield ~0 chips, non-English turns).
- **Corpus seeding strategy:** start with 5–8 sessions spanning: (a) warm/personal chat, (b) technical help, (c) roleplay-heavy (the ChipSchema path sanitizes `<|ACT:...|>` tags — make sure the corpus includes raw slices *pre*-sanitization so the harness replays the sanitize step), (d) filler-heavy negative control, (e) mixed English/Japanese. Phase 5 scales this.

---

## 3 · Technical R&D Analysis — Failure Modes & Mitigations

### FM-1: JSON formatting compliance on 0.1B/1.5B weights — **highest-risk**

A 0.1B RWKV base + persona state has weak schema priors. Expected failure signatures: preamble before `{`, trailing commentary after `}`, single-quoted strings, unquoted keys, truncated arrays at `maxTokens`, commentary *inside* the JSON (small models love `"note":` fields).

**Mitigations (in order of leverage):**

1. **Completion-mode scaffolding (strongest, zero-cost):** end the prompt mid-structure — `Output a JSON object with a "pills" array.\n\n{"pills": [{"content": "` — so the model's first job is continuing a string, not deciding to emit JSON. Auto-prepend the scaffold during parsing so indices stay honest. This alone typically moves schema compliance from ~40% → ~85% on tiny models.
2. **Constrained sampling / logit masking (real fix, later):** `web-rwkv`'s sampler loop supports per-step logits processors in the WASM session API. A JSON grammar mask (jsonformer-style: at each step, allow only tokens consistent with the current parse state) is the *correct* solution for Phase 6 production. For Phase 3 eval, note it as the escape hatch if repair-ladder rates stay >20% — grammar masking guarantees 100% schema compliance, which would make FM-1 metrics trivially pass and shift all signal to similarity metrics.
3. **The repair ladder from §1.4** — treat as baseline instrumentation, not as the fix.
4. **Few-shot exemplar:** one canonical 3-pill example in the prompt (costs ~150 tokens of the 8192 ctx). Test with/without — exemplars can also anchor the model into copying the example's *content*.

### FM-2: Repetition loops

RNN-family models at low temperature loop: `"Baking Sourdough", "Baking Sourdough", "Baking Sourdough"`. Danger interaction: at `extraction-low` config (temp 0.3) repetition risk *rises* even as schema compliance improves. Countervailing danger: the roleplay preset uses `presence_pen=1.5`, which on JSON keys (repeated `"content"`/`"type"` 5×) will actively suppress schema tokens — **this is why `presence_pen=0.0` in extraction configs is the single most important decoding change from the roleplay preset.**
Additional mitigations: post-hoc dedup on normalized pill content (levenshtein ≥ 0.85 ⇒ collapse); a hard `repetition_penalty` on newline-delimited segments only (never on intra-JSON tokens); `maxTokens` sized generously (512) then truncated parse.

### FM-3: Logit-bias / BAN-style constraints — candid assessment

The roleplay state repo family ships "BAN" variants that negative-bias token IDs for slop phrases (`\nUser:`, em-dash runs, etc.). Two honest caveats for Phase 3:
1. **BAN lists target roleplay slop, not schema errors** — they won't fix FM-1.
2. **Blindly banning `\nUser:`-class tokens can harm JSON** (`\n` structure tokens carry schema whitespace). If testing a BAN variant, constrain bans to token IDs that decode to full *phrases*, never to bare whitespace/punctuation ids.
The eval should treat state-variant selection (`roleplay` vs `roleplay+BAN` vs base) as one more sweep axis, reported per-config in the report JSON — not baked into the harness.

### FM-4: Context-length & evidence-window overflow

Production allows 80 messages ≈ potentially >8k tokens pre-sanitization. The ctx8192 G1 checkpoint will overflow silently (truncation drops early evidence → `evidence_indices` shift → grounding metric garbage). Mitigation: harness asserts `tokenCount(prompt) ≤ 7800`, and corpus entries carry their token count; overflow sessions run with a `windowTruncation: "head-drop"` strategy flag so results are comparable. Production's `sanitizeChatContent` already helps (it strips action tags/whitespace) — the corpus must store raw text and run the *same* sanitizer, or token counts won't match production reality.

### FM-5: Semantic drift vs. cloud ground truth — "sourdough" ≠ "bread baking"

Even a well-behaved 0.1B will produce lexically different but semantically adjacent chips. Two implications: (a) cosine threshold 0.75 is a guess — calibrate by having the harness also compute sim(GT pills, GT pills from a *different* cloud model) as an upper-anchor, and sim(random pill pairs) as a floor; the pass gate should sit at ~midpoint, not at an absolute number chosen a priori; (b) expect `journal_candidate` to be the hardest type — it requires salience judgment, not just topic extraction. Predicted outcome to watch: `flavor` recall high, `journal_candidate` type agreement low. If so, consider collapsing to 2-type output for local synthesis with `journal_candidate` promoted by a cheap heuristic (user emotional-marker regex on evidence lines) rather than the model.

### FM-6 (meta): Evaluator contamination

Same-model embeddings scoring same-model output → inflated similarity. Already covered in §1.3 (token-F1 sanity metric), plus: report both metrics side-by-side and flag sessions where they diverge by >0.3.

---

## Sequencing proposal

1. **Now (all unblocked):** write `echo-chips-corpus.json` (schema + 5–8 seed sessions), `03-echo-chip-eval.ts` with the full pipeline against the existing stubbed engine (report generation works today — outputs will reflect stub behavior, which also serves as a pipeline self-test: a canned output should *fail* the similarity gate).
2. **Next:** activate real WASM inference in `engine/rwkv-session.ts` (`Session.from_reader` + sampler), and implement the actual tensor overlay in `mergeStateWithBaseModel` — the `.state` format is a plain safetensors-adjacent tensor list, so this is a header-parse + keyed insert into the base model's state slots. This is a Phase 0-completion task that Phase 3's state A/B depends on.
3. **Then:** decoding sweep → state A/B → report → go/no-go against the gates in §1.3.

Want me to proceed with step 1 — implement `03-echo-chip-eval.ts` + the seed corpus file exactly as designed above, against the stubbed engine (clearly marked), so the full scoring pipeline is running end-to-end before we touch real inference? Or would you rather fold the WASM/state activation (step 2) into the same working session so we only write the eval once against real outputs?
