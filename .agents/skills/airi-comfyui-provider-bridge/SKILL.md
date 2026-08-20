---
name: airi-comfyui-provider-bridge
description: >-
  Use when developing, wiring, or debugging AIRI's ComfyUI local image generation: the main-process ComfyUIProvider (queue → history poll → view/upload endpoints), workflow_api.json upload + prompt/image target annotation (exposedFields), the {{PROMPT}}/{{IMAGE}} placeholder protocol, the exposed-field security boundary, the artistryComfyHealthCheck connection test, the browser-side generateComfyUIWeb fallback, and how ComfyUI sits as a generic ArtistryProvider alongside remote backends (replicate, nanobanana). Peer skill: airi-artistry-comfyui-widgets (widget/headless/autonomous routing layer on top).
---

# ComfyUI Provider Bridge — Local Image Generation Backend

ComfyUI is AIRI's *local* art backend. Crucially it is **not** a registered model provider: `packages/stage-ui/src/libs/providers/providers/registry.ts` only holds LLM/TTS/STT/vision backends. ComfyUI plugs into the **generic Artistry interface** instead, so the rest of the system treats it exactly like a remote provider (Replicate, NanoBanana) — same request/job contracts, same routing, just a server URL + workflow templates instead of an API key + model id.

| Attribute | Value |
| :--- | :--- |
| Provider class | `apps/stage-tamagotchi/src/main/services/airi/widgets/providers/comfyui.ts` — `ComfyUIProvider` (391 lines) |
| Contract | `ArtistryProvider` from `providers/base.ts` — `generate()`, `getStatus()`, `initialize()`, plus callback-style `setJobCallback()` |
| Registration | `artistry-bridge.ts:52-55` — `artistryProviders.set('comfyui' \| 'replicate' \| 'nanobanana', ...)` |
| Settings UI | `packages/stage-pages/src/pages/settings/providers/artistry/comfyui.vue` (734 lines) — connection test, upload, workflow management |
| Settings store | `useArtistryStore` (`artistry.ts`) — `artistry-comfyui-server-url` (default `http://localhost:8188`), `artistry-comfyui-saved-workflows` (`ComfyUIWorkflowTemplate[]`), `artistry-comfyui-active-workflow` |
| Sample workflow | `providers/workflows/txt2img-default.json` — reference only, NOT auto-loaded |

## 1. Workflow Upload & Annotation Rules (the user-facing contract)

Everything in `comfyui.vue`. The stored shape is `ComfyUIWorkflowTemplate = { id, name, workflow, exposedFields: Record<nodeTitle, string[]> }` (`artistry.ts:5-10`).

**Upload rules:**
- Only **API-format JSON** works — user must do ComfyUI `File > Export (API)` to get `workflow_api.json` (the UI copy at :340-367 teaches exactly this). UI-format workflow files fail parsing.
- Parse = iterate top-level entries; a node is valid if it has an `inputs` object (:195-219). `parsedNodes` keeps `{ id, title: _meta.title ?? class_type, type: class_type, inputs }`.
- Zero valid nodes → upload rejected with error; template id = filename slugified (`/[^a-z0-9]+/g → '-'`), re-upload same name replaces in place (:276-283). First saved workflow auto-activates (:286-288).

**Prompt target annotation (required):**
- Node dropdown labels: `{title} ({class_type}) [ID: {id}]` (:100-103).
- **Auto-detect** (:221-229): prefers nodes whose `class_type` includes `textencode` AND have `text`/`value`/`prompt` inputs; fallback = any node with those inputs; last resort = first node.
- Property dropdown **excludes array-valued inputs** (those are node links, not values) (:108-113); on node change, smart-select prefers `text`/`value`/`prompt`/`string` (:155-163); a live value-preview shows the current input value (:116-123).

**Image target annotation (optional — enables bidirectional flows):**
- Node list includes a `(None - Text to Image Only)` option (:126-133); auto-detect prefers `loadimage` class_type or `image` input (:232-235); property auto-select prefers names containing `image` (:166-175).
- Choosing an image target **burns the literal `{{IMAGE}}` placeholder into that input inside the saved workflow JSON at save time** (:260-262) — the placeholder is part of the stored template, not looked up later. Re-uploading the same file wipes it.

**Save** also shows an example `extra` override payload for upstream callers (:308-322): `{ "<node title>": { "<exposed field>": value } }`.

## 2. Provider Execution Protocol (`comfyui.ts`)

1. **Template resolution** (:51): `request.extra?.template > request.model > activeWorkflowId`. No match → job fails with the instructive "upload a workflow in Settings > Providers > ComfyUI" message (:54-61).
2. **Placeholder detection** (:78-81): stringifies `extra` + `workflow` and scans for `{{IMAGE}}` / `{{PROMPT}}`.
3. **Bidirectional image upload** (:83-94): if `{{IMAGE}}` present and `request.extra.image` provided → `uploadImage()` (:342-368): strips data-URL prefix, multipart POST to `/upload/image` with `overwrite=true`, filename `vhack_{ts}.png` (naming vestige of the V-HACK texture loop), returns the ComfyUI input-folder filename.
4. **Override application** — `applyOverrides()` (:253-336), the heart of the system. Logic mirrors CUIPP's `getComfyTemplate.js` (:251):
   - Deep-clones the workflow (templates are never mutated).
   - **Prompt auto-injection**: into the first node with exposed fields, preferring field names `text`/`value`/`prompt`/`string`/`positive` else first field; **skipped entirely if `{{PROMPT}}` appears in `extra`** (:264-279) — placeholder usage opts out of injection.
   - **Per-node overrides** from `extra`: any object-valued key (except reserved `template`, `internalJobId`, `remixId`, `options`) is treated as `{ nodeTitle: { field: value } }`; legacy `extra.options` nesting still honored (:283-305).
   - **SECURITY BOUNDARY**: nodes match ONLY by `_meta.title`, and an override field applies ONLY if it's in `template.exposedFields[title]` (:314-315). Non-exposed fields are silently dropped — this is the anti-arbitrary-injection firewall, by design.
   - **Seed auto-randomize** (`Math.floor(Math.random()*1e15)`) when `seed` is exposed and not explicitly overridden (:322-333). Seeds are NOT reproducible across jobs unless passed as an override.
5. **Final placeholder resolution** (:99-110): after overrides, `{{PROMPT}}` → request prompt, `{{IMAGE}}` → uploaded filename, replaced recursively through every string in the JSON (`replacePlaceholders` :370-390, regex-escaped).

## 3. HTTP Endpoint Surface

All against `{serverUrl}` (trailing slashes stripped in `initialize` :40):

| Endpoint | Usage | Notes |
| :--- | :--- | :--- |
| `POST /prompt` | Queue resolved workflow graph | body `{ prompt: <graph json> }` (ComfyUI quirk: key is `prompt`), 30s AbortController; returns `prompt_id` |
| `GET /history/{prompt_id}` | Poll completion | 5s interval (`POLL_INTERVAL_MS`), 10-min hard timeout; **1s-retry race guard** for history rows with empty `outputs` (:181-196); logs `status.messages` when present |
| `GET /view?filename&subfolder&type` | Resolve `imageUrl` | First image from any node's outputs wins (:203-214); no images → failure with raw-history dump logged |
| `POST /upload/image` | Texture upload (see §2.3) | multipart, returns `{ name }` |
| `GET /system_stats` | Connection test | GPU names + VRAM; Electron path goes through `artistryComfyHealthCheck` eventa invoke — contract defined at `packages/stage-shared/src/artistry.ts:5` (`eventa:invoke:electron:artistry:comfy-health-check`), handler at `widgets/index.ts:93` (non-CORS errors pass through, fetch/CORS/Forbidden are rethrown as `'CORS'`); browser path fetches directly with `mode: 'cors'` (`comfyui.vue:43-59`) — CORS refusal is the #1 browser failure mode |

Callback lifecycle: results cached in `jobResults`, fired via `setJobCallback` (fires immediately if result already arrived); **both maps are GC'd 10s after completion** (:239-245) — late subscribers get nothing.

## 4. Web Fallback (`generateComfyUIWeb`)

Non-Electron surfaces (stage-web/pocket) can't reach main-process providers: `artistry-autonomous.ts:294` implements a minimal renderer-side duplicate — injects the prompt **only into a field literally named `text`** (:317-323; no preference list, no `value`/`prompt` fallback — a divergence from the main provider), randomizes seed (:337-339), polls `/history` at **3s intervals with a 5-min timeout** (:354-387; vs 5s/10min in main), and downloads the image as base64 for the journal (:371-379). It does NOT implement the `{{IMAGE}}` upload path — bidirectional texture flows are desktop/Electron-only today.

## 5. Pitfalls & Failure Modes

- **`exposedFields` only ever contains the one prompt-target field at save time** — users wanting seed/cfg overrides must know field names appear in `extra` payloads per the example block; unexposed overrides are silently dropped by design.
- **No workflow uploaded = hard fail** with onboarding hint — the bundled `txt2img-default.json` is a reference sample, never auto-registered.
- **`{{IMAGE}}` lives in the saved template**, not the annotation UI — editing the saved workflow by hand without re-injecting it breaks bidirectional flows.
- **"Job completed but no images"** = workflow never ended at an output node; the raw history is logged — check for `SaveImage`/`PreviewImage`.
- **Concurrency**: headless runs are serialized (`MAX_CONCURRENT_HEADLESS = 1`, `artistry-bridge.ts:60-62`) and deduped by fingerprint while in flight — see peer skill for the bridge layer.
- **Server CORS**: browser-direct mode requires ComfyUI started with `--enable-cors-header "*"` (the exact flag the settings page's troubleshooting banner teaches at `comfyui.vue:449`); the Electron `/system_stats` path sidesteps this entirely.

## 6. Cross-Citations & Verification

- `airi-artistry-comfyui-widgets` — the widget/headless/autonomous layer that routes INTO this provider; `airi-card-schema` — card-level `artistry` overrides.
- `docs/content/en/docs/advanced/architecture/design-comfyui-image-generation-widget.md` + `arch-comfyui-native-api-engine.md` — design + engine architecture docs.
- `docs/data-catalog.md` §4.8 — the `artistry-comfyui-*` localStorage keys.
- Typecheck: `pnpm -F @proj-airi/stage-tamagotchi typecheck` (provider + main handlers), `pnpm -F @proj-airi/stage-pages typecheck` (comfyui.vue), `pnpm -F @proj-airi/stage-ui typecheck` (store).

## Related Skills & References

- **Peer Skills**: [[airi-artistry-comfyui-widgets]], [[airi-card-schema]]
- **Key Documents**: [[design-comfyui-image-generation-widget]], [[arch-comfyui-native-api-engine]], [[data-catalog]]
