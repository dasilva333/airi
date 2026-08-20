---
title: AI Producer & Roleplay Suggestions
description: How to use the real-time AI Producer engine to generate contextual dialogue suggestions, plot branches, and roleplay ideas.
---

# AI Producer & Roleplay Suggestions

When chatting or roleplaying with your companion, you might sometimes wonder: *"What should I say next?"* or *"Where should this story go?"*

AIRI includes a dedicated **AI Producer Subsystem**—a secondary intelligence loop that runs alongside your active conversation to suggest creative responses, dramatic plot twists, and topic changes in real time.

---

## 1. How the AI Producer Works

While your primary LLM generates character responses, the AI Producer analyzes the conversational flow in the background:

```
[ Conversation History ] ──► [ AI Producer Intelligence ]
                                       │
        ┌──────────────────────────────┴──────────────────────────────┐
        ▼                                                             ▼
 [ User Reply Suggestions ]                                 [ Director Scene Notes ]
 (3 quick-click response chips)                           (Background narrative direction)
```

- **Zero Disruption**: The Producer runs asynchronously without adding latency to character speech or replies.
- **Context-Aware**: Suggestions adapt to current mood states, active storyline scenarios, and recent Echo Chips.

---

## 2. Using Reply Suggestions in Chat

Above the message composer in the Desktop Chatbox, you will see 2–3 clickable **Suggestion Chips**:

- **Playful / Banter**: Quick witty replies or jokes.
- **Inquisitive**: Follow-up questions exploring what the companion just said.
- **Narrative Action**: Roleplay action prompts (e.g., `*Hands her a cup of hot tea*` or `*Glances out the window at the rain*`).

### Triggering Suggestions
- **Click to Send**: Clicking any suggestion chip instantly sends that message into the conversation.
- **Click to Edit**: Shift-clicking (or clicking the edit icon on a chip) loads the suggestion into your text input box so you can customize it before sending.
- **Refresh**: Click the **"Magic Wand / Reroll"** icon in the composer toolbar to generate fresh suggestions on demand.

---

## 3. Configuring the Producer

You can customize the Producer's personality and creativity in **Settings &rarr; Modules &rarr; Producer**:

- **Creativity Level**: Adjust temperature to balance between natural grounded responses and wild narrative plot twists.
- **Dedicated Producer Model**: You can assign a fast, ultra-cheap model (such as *Gemini Flash* or a local *Qwen 1.5B*) to handle Producer suggestions without consuming your primary reasoning model's token limits.
