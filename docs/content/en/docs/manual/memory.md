---
title: How Memory & Continuity Works
description: A complete guide to AIRI's layered memory architecture, short-term daily summaries, long-term journals, echo chips, and lifetime continuity.
---

# How Memory & Continuity Works

One of the biggest limitations of standard AI assistants is the "Goldfish Effect"—forgetting what happened yesterday as soon as the context window fills up. AIRI solves this through a multi-tiered memory architecture that preserves your shared history, emotional milestones, and daily routines over months and years without degrading performance or exceeding token limits.

---

## 1. The Multi-Tiered Memory Model

AIRI structures memory across several complementary layers:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Active Chat Session (Recent messages in current window)  │
├─────────────────────────────────────────────────────────────┤
│ 2. Echo Chips (3-5 active emotional & thematic anchors)     │
├─────────────────────────────────────────────────────────────┤
│ 3. Short-Term Memory (Daily summary blocks of past 3 days)  │
├─────────────────────────────────────────────────────────────┤
│ 4. Long-Term Text Journal (Spontaneous append-only entries) │
├─────────────────────────────────────────────────────────────┤
│ 5. Lifetime Artifacts (Eternal consolidated bio & history)  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Memory Layers Explained

### 1. Active Chat Session
Contains the immediate conversational turn history. When this buffer approaches your model's context threshold, older messages are gracefully compacted and summarized so the conversation never crashes.

### 2. Echo Chips (Emotional & Thematic Anchors)
Visible in the right context rail of the chatbox, **Echo Chips** are 3–5 compact semantic tags (such as *"Playing Elden Ring tonight"*, *"Stressed about Monday deadline"*, or *"Loves matcha lattes"*). They serve as high-priority continuity anchors that ensure AIRI keeps recent personal topics top-of-mind without cluttering the prompt.

### 3. Short-Term Memory (Daily Summaries)
At the end of each day (or when waking up), AIRI compresses the day's conversations into a structured daily summary block. The last 3 days of summaries are automatically injected into the model's awareness prompt, allowing AIRI to say: *"How did that interview go yesterday?"* or *"Did you ever finish that boss fight from Tuesday?"*

### 4. Long-Term Companion Journal
AIRI has a private, append-only **Text Journal**. During conversations or downtime reflection, AIRI can record meaningful thoughts, realizations, or shared secrets.
- **Sacred Journal Rule**: AIRI's journal entries are permanent and cannot be silently erased or hallucinated away.
- **Searchable**: When you mention a past event or inside joke, AIRI uses local semantic search to query her journal and retrieve the exact entry.

### 5. Lifetime Artifacts (The Eternal Thread)
For long-term companions with months of history, AIRI periodically runs an offline consolidation pass (the *Dreaming Pipeline*) that distills hundreds of daily logs into a cohesive, non-repeating **Lifetime Biography**. This represents her foundational long-term memory of who you are and what you have experienced together.

---

## 3. Managing and Inspecting Memories

You have complete transparency and ownership over your companion's memory:

- **Viewing the Journal**: Open the **Studio &rarr; Journal** tab in the Desktop Chatbox to read every entry AIRI has written.
- **Editing Daily Summaries**: In **Settings &rarr; System & Data &rarr; Memory**, you can view and adjust recent short-term daily blocks.
- **Rebuilding Memory**: If you made a major prompt change or imported a large chat log, click **"Rebuild Short-Term Memory"** to regenerate summary blocks from raw history.

---

## 4. Privacy & Local Storage

All memory layers (chat history, journal entries, vector indices, and echo chips) are stored **100% locally on your machine** inside browser/Electron IndexedDB storage. Your private conversations and reflections are never sent to third-party vector databases or shared with external servers.
