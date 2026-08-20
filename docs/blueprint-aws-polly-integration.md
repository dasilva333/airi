# Blueprint: Amazon AWS Polly Integration (Preset Provider)

This blueprint outlines the technical requirements and file changes needed to integrate the local AWS Polly OpenAI-Compatible gateway as a first-class preset provider in the AIRI provider catalog.

---

## 🏗️ 1. Architecture Overview

We are treating the `aws-polly` gateway as a **Preset Provider**. This means:
1.  **Identity**: It appears in the "Add Provider" list with its own name and icon.
2.  **Locality**: It defaults to a local loopback address (`http://127.0.0.1:8090/v1/`).
3.  **Compatibility**: It leverages the existing OpenAI-compatible speech driver but with a custom identity to ensure the unique Polly voices are exposed easily.

---

## 🛠️ 2. Core Implementation Steps

### Phase 1: Define Provider Metadata
Add the `aws-polly-tts` entry to the `legacyProviderMetadata` block in the Pinia store.

**Metadata specs:**
- **ID**: `aws-polly-tts`
- **Category**: `speech`
- **Task**: `text-to-speech`
- **Icon**: `i-logos:aws` or `i-solar:microphone-large-bold-duotone`
- **Default Base URL**: `http://127.0.0.1:8090/v1/`

### Phase 2: Implement Voice Discovery
AWS Polly has a vast but static set of voices. We will implement `listVoices` to either:
1.  **Dynamic Fetch**: Attempt to hit `/v1/voices` on the local gateway.
2.  **Hardcoded Fallback**: If the server is offline or doesn't support discovery, provide the list of standard neural voices (Joey, Ivy, Salli, etc.) to ensure a smooth UI experience.

### Phase 3: UI Integration
- Update `packages/stage-ui/src/stores/providers.ts` to include the new metadata.
- Ensure the "Add" flow correctly handles the default local URL for non-technical users.

---

## 🗺️ 3. Integration Points Summary

| File | Change |
| :--- | :--- |
| `packages/stage-ui/src/stores/providers.ts` | **[MODIFY]** Append `aws-polly-tts` to `legacyProviderMetadata`. |
| `packages/stage-ui/src/stores/providers/types.ts` | (Optional) Add any Polly-specific extended capability flags if needed. |
| `docs/blueprint-aws-polly-integration.md` | **[NEW]** This documentation file. |

---

## ⚡ 4. Requirements & Guardrails

### 🛡️ Fallback Logic
The integration MUST default to **"Joey"** if a requested voice ID is invalid or missing, mirroring the server-side fallback implemented in the gateway.

### 🚀 Zero-Config Setup
The `defaultBaseUrl` should be set to `http://127.0.0.1:8090/v1/` out of the box so that users who run the standard Polly server don't have to copy-paste URLs.

### 🎨 Icons & UX
Use a recognizable AWS or Polly-specific icon to distinguish it from generic OpenAI or ElevenLabs providers.

---

## 📈 5. Verification Plan

### Automated Tests
- No new automated tests required; verify connectivity via manually adding the provider in the UI.

### Manual Verification
1.  Open Settings -> Providers.
2.  Locate "Amazon AWS Polly" in the list.
3.  Add the provider (default URL should be pre-filled).
4.  Switch a character to the Polly provider.
5.  Confirm that voice synthesis succeeds.

## Relevant Skills

- [[airi-audio-pipeline]]
