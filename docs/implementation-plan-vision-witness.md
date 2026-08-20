# Implementation Plan: Vision Witness & Ambient Observation

This plan outlines the architecture and implementation steps for integrating a passive "Vision Witness" system. We will follow a phased approach, prioritizing a stable MVP before adding complex multi-monitor and cost-governance features.

## 🏁 Phase 1: MVP (Minimal Viable Witness)

The goal of Phase 1 is "End-to-End Connectivity" with zero friction.

1.  **Configuration Dependency**:
    -   Requires the **Google Gemini Provider** to be configured (`Settings > Providers > Google Gemini`).
    -   Reuses the existing Gemini API Key to avoid redundant configuration.
2.  **Modality**:
    -   **Native AI Voice**: (Default) Use the low-latency audio output from Gemini Live directly. This bypasses the complexity of text extraction and TTS routing for the first version.
3.  **Visuals**:
    -   **Single Display**: Snapshot only the Primary monitor.
    -   **Control Island**: A single pulsing Amber icon when active.
4.  **Settings**:
    -   Simple toggle: `Settings > Modules > Vision Witness > Enabled`.
    -   Fixed 5-minute interval for stability.

## 🌟 Phase 2: Advanced Features ("The Wishlist")

Once the MVP is verified, we will progressively implement the following:

### 1. 🎨 3-Mode Status Light & Interactive UI
-   **Purple Blink**: Real-time feedback for the duration of a "Live Event" (Mic active or Screen Capture in progress).
-   **Mode Scaling**: Low Pulse (Ambient) -> High Pulse (Power) -> Red Border (Active).

### 2. 🖥️ Multi-Display & Follow Mode
-   **Capture Logic**: Add support for `Follow Active Window` (dynamic monitor switching) and `Panoramic Grid` (multi-monitor capture).
-   **Downscaling**: Automatic image resizing to 1024px to keep token costs low during multi-display snaps.

### 3. 🛡️ Budget & Tier Governance
-   **Cost Counter**: Live USD readout in the Control Island.
-   **Tier Lock**: Safety locks for Free Tier users (locks interval at >= 60s).
-   **Total Cutoff**: Stop module if the session budget exceeds a user-defined amount.

### 4. 📝 Character-Specific Intelligence
-   **Witness Prompt**: Field in the **Proactivity Tab** to allow character-specific observation styles.

## ⚙️ Configuration & Dependencies

| Requirement | Source | Description |
| :--- | :--- | :--- |
| **API Key** | `googleProvider.apiKey` | Shared with the main Gemini LLM setup. |
| **Model** | `gemini-1.5-flash` | Hardcoded for MVP (Best balance of cost/speed). |
| **Audio** | `Native Stream` | Plays Gemini's voice response directly. |

## User Review Required

> [!IMPORTANT]
> **MVP Dependency**: You MUST have a Google Gemini API Key configured in the Providers section for this module to activate.
> [!CAUTION]
> **Voice Identity**: In MVP, the voice will be a generic Gemini voice. Routing back to the Character's specific TTS engine is scheduled for Phase 2.

## Proposed Changes

---

### [Component] Core Logic & State

#### [MODIFY] [vision.ts](file:///c:/Users/h4rdc/Documents/Github/airi-rebase-scratch/packages/stage-ui/src/stores/modules/vision.ts)
- Add MVP state: `isEnabled`, `status: 'idle' | 'active' | 'capturing'`.
- Logic to pull the key from `useGoogleProvider`.

---

### [Component] UI / Control Island

#### [NEW] [VisionControl.vue](file:///c:/Users/h4rdc/Documents/Github/airi-rebase-scratch/apps/stage-tamagotchi/src/renderer/components/ControlIsland/VisionControl.vue)
- Simple pulsing icon implementation.
- Purple blink trigger on status: `capturing`.

---

### [Component] Settings

#### [NEW] [VisionModuleSettings.vue](file:///c:/Users/h4rdc/Documents/Github/airi-rebase-scratch/packages/stage-pages/src/pages/settings/modules/vision-witness.vue)
- MVP Interface: A single switch and a status readout ("Connected to Gemini").

## Verification Plan

### Manual Verification
1. Configure Gemini Provider with a valid key.
2. Enable "Vision Witness" Module.
3. Observe Amber pulse on Control Island.
4. Open a test image (e.g., a photo of a Cat) -> Verify AIRI comments via Native Audio on the next heartbeat.

## Relevant Skills

- [[airi-attention-ecology-vision]]
