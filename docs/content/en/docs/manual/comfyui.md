---
title: Local Artistry with ComfyUI
description: How to connect your local ComfyUI instance to AIRI, load custom workflows, and generate in-app desktop image widgets.
---

# Local Artistry with ComfyUI

AIRI features a built-in **Artistry Engine** capable of generating background artwork, character selfies, and interactive scene illustrations. While cloud backends like Replicate and Nanobanana are supported, you can connect your own local **ComfyUI** instance for unlimited, free, local image generation directly on your GPU.

---

## 1. Prerequisites

Before connecting ComfyUI to AIRI:
1. Ensure **ComfyUI** is installed and running on your PC (default address: `http://127.0.0.1:8188`).
2. Verify you can access the ComfyUI web interface in your browser and successfully generate an image with your desired checkpoint (e.g., SDXL, Pony, Flux, or Illustrious).

---

## 2. Setting Up the ComfyUI Provider

1. Open AIRI and navigate to **Settings &rarr; Providers &rarr; Artistry (ComfyUI)**.
2. In the **Server URL** field, ensure `http://127.0.0.1:8188` is entered.
3. Click the **Test Connection** button. You should see a green checkmark confirming AIRI can communicate with ComfyUI's WebSocket API.

---

## 3. Exporting Your Workflow (`workflow_api.json`)

To let AIRI drive your ComfyUI generation, export your workflow in **API format**:

1. In ComfyUI, open **Settings** (the gear icon).
2. Enable **"Enable Dev mode Options"**.
3. A new button titled **"Save (API Format)"** will appear in the ComfyUI control panel.
4. Click **Save (API Format)** and save the `.json` file to your computer.

> [!IMPORTANT]
> **API Format vs. Standard Workflow**: Standard ComfyUI JSON files contain UI canvas layout data, which cannot be executed headless. You **must** export using **"Save (API Format)"**.

---

## 4. Tagging Prompt & Image Placeholders

AIRI injects dynamic prompts and input images into your workflow using two placeholder tokens:

- `{{PROMPT}}`: Replaced with the character's generated positive prompt.
- `{{IMAGE}}`: (Optional for image-to-image/ControlNet) Replaced with the input image path or canvas buffer.

### How to Map Fields in AIRI:
1. In **Settings &rarr; Modules &rarr; Artistry**, upload your exported `workflow_api.json`.
2. AIRI will parse your nodes. In the **Exposed Fields** configuration:
   - Map your CLIP Text Encode (Prompt) node text input to `{{PROMPT}}`.
   - If using a negative prompt node, configure your default negative tags.
   - Map your Save Image / Preview Image node output.

---

## 5. Using Artistry in Conversations

Once ComfyUI is connected, AIRI can generate artwork in multiple ways:

- **Direct Requests**: Ask AIRI in chat: *"Draw a scenic sunset view of the beach"* or *"Take a selfie in your cozy room"*.
- **Autonomous Artistry**: If enabled, a background director loop evaluates significant narrative moments and silently generates matching atmospheric illustrations.
- **Desktop Art Widgets**: Generated images appear in the conversation stream and can be opened as floating desktop stickers, pinned to your screen, or set as your active stage background.
