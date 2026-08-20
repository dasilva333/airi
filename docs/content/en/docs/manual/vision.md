---
title: Vision & Screen Perception
description: How to send images and screenshots to AIRI, configure a dedicated Vision-Language Model (VLM), and manage vision costs.
---

# Vision & Screen Perception

AIRI can see and understand visual content. You can drop images into the chat, paste screenshots from your clipboard, or let AIRI analyze your screen to comment on what you are playing, drawing, or reading.

---

## 1. Sending Images to AIRI

There are three ways to share visual context with your companion:

1. **Drag and Drop**: Drag any `.png`, `.jpg`, `.webp`, or `.gif` image directly into the Chatbox conversation area.
2. **Clipboard Paste**: Press `Ctrl+V` (or `Cmd+V` on macOS) in the message composer to attach a copied screenshot.
3. **Paperclip Attachment**: Click the attachment icon in the message composer toolbar to select an image file from your computer.

Once attached, type your message or question and press **Send**. AIRI will examine the image and incorporate its visual details into her reply.

---

## 2. Dedicated Vision Model (VLM) Architecture

In AIRI, the "Mind" (Chat LLM) and the "Eyes" (Vision VLM) can be completely independent models:

```
[ User Message + Image Attachment ]
               │
               ▼
   [ Dedicated Vision Model (VLM) ] ── (Gemini Flash Vision / GPT-4o-mini / Qwen2-VL)
               │
               ▼
    [ Rich Multimodal Response ]
```

### Why Decouple Vision from Chat?
- **Cost Efficiency**: You can use a lightweight, inexpensive model for regular text chat (or a local quantized model), while routing image turns to an optimized vision model like *Google Gemini 2.0 Flash* or *OpenAI GPT-4o-mini*.
- **Flexibility**: You can switch text models on the fly without losing vision capabilities.

### Configuring Your Vision Model
1. Go to **Settings &rarr; Modules &rarr; Vision**.
2. Enable **Vision Subsystem**.
3. Choose your Vision Provider (e.g., Google Gemini, OpenAI, OpenRouter, or Local Ollama/VLM).
4. Select the specific VLM model you want to process images.

---

## 3. Managing Vision Token Costs

Processing high-resolution images with cloud APIs consumes tokens based on image dimensions:

| Model | Approximate Cost per 1MP Image | Notes |
| :--- | :--- | :--- |
| **Gemini 2.0 Flash** | ~$0.00004 | Ultra-fast, highly cost-effective for frequent image sharing. |
| **GPT-4o-mini** | ~$0.00011 | Strong general vision reasoning with modest token costs. |
| **Claude 3.5 Haiku** | ~$0.00010 | High fidelity OCR and UI element detection. |
| **Local VLM (Ollama / Qwen-VL)** | **$0.00 (Free)** | Zero API cost, runs entirely on your local GPU. |

> [!TIP]
> **Automatic Downscaling**: AIRI automatically downscales oversized images before sending them to the VLM to keep inference fast and minimize unnecessary API token consumption.

---

## 4. Screen Perception & Situational Awareness

When enabled in **Settings &rarr; Modules &rarr; Attention Ecology**, AIRI can periodically capture small screen snippets or window thumbnails when significant events occur (such as switching games or achieving a victory screen), providing context for proactive commentary.
