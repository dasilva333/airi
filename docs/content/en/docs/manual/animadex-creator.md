---
title: AnimaDex Character Creator
description: A complete guide to creating rich, multi-actor AI character cards using the guided 4-step AnimaDex Wizard.
---

# AnimaDex Character Creator

The **AnimaDex Wizard** is AIRI's guided character creation engine. Instead of forcing you to write complex system prompts and JSON schemas by hand, the AnimaDex Wizard guides you through a 4-step process—drawing from a built-in catalog of over 36,000 popular characters, automatically linking 3D/2D models, assigning fitting voice personalities, and synthesizing rich roleplay cards.

---

## 1. Opening the AnimaDex Wizard

To open the wizard:
1. Open **Settings &rarr; Character Cards &rarr; AnimaDex Wizard** (or click the **"Create Card"** button in the character selection shelf).
2. The guided creation modal will open on Step 1.

---

## 2. The 4-Step Creation Workflow

```
[ Step 1: Cast Selection ] ──► [ Step 2: Roster & Assets ] ──► [ Step 3: Story & Soul ] ──► [ Step 4: Synthesis & Output ]
  (Search 36k Catalog            (Bind 3D/2D Models,             (Pick Scenario Tropes,       (Compile CCv3 Card,
   or Custom Character)           Voices, & Idle Motions)         Brain Models, & Hooks)       Inspect ACT Tokens)
```

---

### Step 1: Cast Selection (Search & Filters)
- **Search Catalog**: Type the name of any character or franchise across anime, games, manga, and visual novels.
- **Filter Chips**: Filter by franchise, archetype tags (e.g., *tsundere*, *kuudere*, *mentor*, *detective*), or toggle **"Has Installed Model"** to only show characters you already have 3D/2D assets for.
- **Custom Characters**: If your character is an original creation (OC), click **"Add Custom Character"**, upload an avatar image, and let the built-in BLIP visual tagger suggest appearance tags automatically.
- **World Dock**: Select up to 4 characters if you want to create a multi-actor ensemble cast.

---

### Step 2: Roster Binding & Auto-Voice Setup
- **Model Auto-Linking**: AIRI uses Jaccard similarity tag-matching to automatically detect if you have a matching VRM or Live2D model in your library.
- **Voice & Personality Assignment**: Click **Auto-Configure Voice** to let the LLM analyze the character's archetype and recommend fitting TTS voices, pitch modifications, and resting idle animations.

---

### Step 3: Story & Soul
- **Scenario Suggester**: Choose from popular scenario tropes (e.g., *Roommates*, *Fantasy Adventuring Party*, *Late Night Coding Partner*, *Childhood Friend Reunion*) or enter your own custom backstory premise.
- **Dynamic Placeholders**: Uses `{Name}` and `{User}` tokens that automatically adapt to your configured global user profile.
- **Brain Model Picker**: Assign which LLM provider and model will power this specific character's intellect.

---

### Step 4: Card Synthesis & Generation
- Click **"Synthesize Character Card"**.
- AIRI generates the full CCv3-compliant character card, complete with:
  - First Message & Greeting.
  - Character Persona & Behavioral Guidelines.
  - Acting Instructions & `<|ACT:...|>` emotion cue mappings.
  - Multi-Actor routing tokens (if you selected multiple characters).
- Review the generated output, make any manual edits you desire, and click **"Save to Library"**.
