# Proposal: Proactivity Vision (Screenshot) Pipeline

This proposal outlines the design, UI configuration, and backend execution flow for adding vision (screenshot) capabilities to the **Autonomous Proactivity** and **Manual Grounding** systems in AIRI.

It directly integrates with and builds upon the core **Direct vs. Forward-to-LLM** vision paradigm detailed in the base design document [proposal-vlm-forward-to-llm.md](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/docs/proposal-vlm-forward-to-llm.md), which establishes the pipeline for decoupling sight from voice.

---

## 1. Architectural Concept: Integrating the Vision Paradigm

When the proactivity loop triggers or a message is sent with screen grounding enabled, the system captures a screenshot. This image is handled under one of two modes, based on the **Impersonator vs. Forwarder** design:

```
                    ┌────────────────────────┐
                    │  Screen Capture Event  │
                    └───────────┬────────────┘
                                │
                                ▼
                    ┌────────────────────────┐
                    │      Select VLM        │
                    │   (Default / Override) │
                    └───────────┬────────────┘
                                │
             ┌──────────────────┴──────────────────┐
             ▼                                     ▼
   ┌───────────────────┐                 ┌───────────────────┐
   │ Impersonator Mode │                 │  Forwarder Mode   │
   │ (Direct Response) │                 │ (Forward to LLM)  │
   └─────────┬─────────┘                 └─────────┬─────────┘
             │                                     │
             ▼                                     ▼
   [ VLM generates final ]              [ VLM extracts tags/   ]
   [ proactive response   ]              [ text/descriptions    ]
                                                   │
                                                   ▼
                                        [ Text output forwarded]
                                        [ as context to the    ]
                                        [ primary character LLM]
```

### Mode A: Impersonator (Direct Response)
* The selected VLM receives the screenshot directly as part of the message payload and acts as a stand-in for the active character.
* It generates the final conversational response directly (e.g., *"You have been coding in VS Code for 3 hours, take a break!"*).

### Mode B: Forwarder (Forward to LLM)
* The VLM acts as a **visual sensor** to convert image features into textual metadata.
* This is ideal for lightweight local models:
  * **WD14 Tagging:** Extracts visual tags (e.g. `coding, computer screen, dark mode`).
  * **BLIP / BLIP2 Captioning:** Generates simple descriptions (e.g., `a person working on a code editor`).
  * **Fast Tiny OCR:** Extracts active text from the screen.
* The extracted text/tags are bundled into the sensor payload and forwarded as textual context to the primary text-only LLM (such as a local Llama-3 or cloud DeepSeek). The character then reacts in their own voice.

---

## 2. UI and Settings Configuration

The **Proactivity** tab in the **Edit Card** modal will be expanded to support the following screenshot settings:

```
[ ] Enable Screen Grounding (Screenshots)
    ├── Monitor Selection:  [ 1 ]  [ 2 ]  [ 3 ]  (Button selector representing active displays)
    ├── VLM Configuration:
    │   ├── Default: [Global VLM: Gemini Flash] (Display only)
    │   └── [ ] Override VLM Model
    │       ├── Provider: [ Ollama       ] (Dropdown of configured providers)
    │       └── Model:    [ llava:latest  ] (Dropdown of available models for provider)
    └── Strategy:
        ├── (o) Forward to LLM (Metadata Extractor)
        │   └── Extractor Type: [ BLIP Captioner / OCR / WD14 ]
        └── ( ) Direct Response (VLM Impersonator)
```

### Configuration Inputs
1. **Monitor Selection:** A horizontal row of buttons representing connected screens. The user selects exactly which screen is captured during the heartbeat or message send.
2. **VLM Model Override:** Toggling this allows the character to bypass the global VLM and use a dedicated model (such as a local Ollama/LM Studio vision model) specifically for character vision tasks.
3. **Strategy Select:** Radio buttons to select between **Forward to LLM** (acting as a captioner/tagger) or **Direct Response** (acting as the character).

---

## 3. Considerations and Open Questions

### Performance & Resource Conflict
* **Local Vision Load:** Running a local VLM (like LLaVA or Qwen-VL) via Ollama/LM Studio alongside the primary LLM can cause heavy GPU memory (VRAM) paging, introducing significant latency.
* **Metadata Extraction Bottleneck:** Built-in models like BLIP and WD14 run inside the browser runtime or a local runner. We must ensure they load asynchronously and cache their weights so they do not block the UI thread during capture ticks.

### Security and Privacy
* **Automated Captures:** Taking a screenshot every few minutes automatically means potentially capturing private keys, chats, or personal emails.
* **Mitigation:**
  * The UI should display a prominent warning when the screenshot option is enabled.
  * Captures must never be stored on disc; they should remain in volatile memory (base64 buffers) and be GC'd immediately after inference.

### API Cost Control
* **Proactivity Gating:** VLMs are expensive. If heartbeats run on a 1-minute timer, vision prompts can drain API budgets rapidly. We should recommend matching screenshot triggers to larger intervals or only taking a screenshot when the user's active window/title changes.

## Relevant Skills

- [[airi-proactivity-sensory-telemetry]]
