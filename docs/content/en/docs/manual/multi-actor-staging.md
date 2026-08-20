---
title: Multi-Actor Staging & Wardrobes
description: How to orchestrate multi-character conversations in Studio, manage character outfits, and switch costumes dynamically.
---

# Multi-Actor Staging & Wardrobes

AIRI is not limited to a single character. With **Multi-Actor Staging** and the **Modular Outfits System**, you can host multi-character talk shows, interactive team brainstorms, and manage wardrobe changes mid-conversation.

---

## 1. Multi-Actor Cards & The ACTOR Token

In a multi-actor card (created in the AnimaDex Wizard or Card Editor), multiple character personas live inside one card definition:

```
<|ACTOR:Alice|> Hey Bob, did you finish review on the PR?
<|ACT:motion="think"|>
<|ACTOR:Bob|> Almost! Just running the typecheck suite now.
```

- **Automatic Voice Routing**: AIRI automatically routes `<|ACTOR:Alice|>` speech through Alice's assigned TTS voice and `<|ACTOR:Bob|>` through Bob's voice.
- **Stage Focus**: When an actor speaks, their 3D/2D model animates while inactive actors shift to subtle listening or idle gestures.

---

## 2. Setting Up Outfits & Wardrobes

Characters can have multiple costume variants (e.g., *Casual*, *School Uniform*, *Sleepwear*, *Formal Dress*).

### Adding Outfits to a Card:
1. Open **Settings &rarr; Character Cards &rarr; Edit Card &rarr; Outfits**.
2. Click **"Add Outfit"**.
3. Set the **Outfit Name** and assign the target 3D/2D model file or Live2D expression preset.
4. For VRM models with sub-mesh clothing parts, select which meshes to show/hide for that specific outfit.

---

## 3. Switching Outfits During Chat

- **Manual Switch**: Open the Control Strip or Chatbox Action Menu &rarr; **"Change Outfit"** and click the desired look.
- **In-Character Dialogue Triggers**: The AI companion can trigger costume changes automatically during narrative scenes using the outfit tool (e.g., changing into pajamas when you say *"Goodnight, let's head to sleep"*).

---

## 4. Deep Concept Stacks & Studio Integration

Multi-Actor staging and modular outfits build upon AIRI's underlying Studio Concept Stack. For deep technical configuration of Base vs. Layer concepts, image generation prompt overrides, and autonomous Director grading loops, see the [Studio Configuration Guide](./config/studio.md).
