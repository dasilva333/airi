---
title: Proactivity & Idle Behaviors
description: Learn how AIRI senses your environment, decides when to speak spontaneously, and how to configure autonomous heartbeats.
---

# Proactivity & Idle Behaviors

Unlike traditional chatbots that only speak when spoken to, AIRI is equipped with an autonomous **Proactivity Engine**. She monitors environmental context—such as your active application, idle duration, and time of day—and can initiate conversations, comment on your activities, or reflect on past memories without requiring a prompt.

---

## 1. How the Proactivity Engine Works

The Proactivity Engine runs on a periodic **Heartbeat Loop** managed in the background.

```
[ OS Sensors (Window, AFK, Time) ] 
               │
               ▼
[ Salience & Cooldown Filter ] ──(Busy / Suppressed)──► [ Skip Turn ]
               │ (Trigger Conditions Met)
               ▼
[ Proactivity Prompt + Ledger ] ──► [ LLM Heartbeat Decision ]
                                          │
                  ┌───────────────────────┴───────────────────────┐
                  ▼                                               ▼
         [ "NO_REPLY" ]                                 [ Spontaneous Remark ]
       (Silent passivity)                            (Speaks via TTS & Avatar)
```

1. **Sensory Polling**: At regular intervals (default: every 30–60 seconds), AIRI gathers lightweight sensory telemetry from your system.
2. **Context Compilation**: It builds an awareness snapshot including:
   - Your currently focused window title and process name (e.g., *VS Code*, *Blender*, *YouTube*).
   - How long you have been typing, moving your mouse, or idle/AFK.
   - Current local time and recent system events.
3. **The Heartbeat Decision**: The LLM evaluates whether this is a natural moment to speak.
   - If you are deeply focused, in a meeting, or if nothing noteworthy has changed, the model emits a special `NO_REPLY` sentinel token and remains silent.
   - If an interesting event or extended silence occurs, AIRI generates a spontaneous remark or asks a relevant question.

---

## 2. Environmental Telemetry & Privacy

AIRI respects your privacy and control:
- **Local Evaluation**: Sensory telemetry is processed locally within the Electron main process.
- **Privacy Filters & App Exclusion**: You can configure an **Excluded Applications List** in Settings to prevent AIRI from reading window titles from password managers, banking browsers, or private documents.
- **No Keystroke Logging**: The proactivity system only checks OS-level idle time counters, never recording keystrokes or text you type in other apps.

---

## 3. Configuring Proactivity

You can tune AIRI's proactivity to match your preferences in **Settings &rarr; General &rarr; Proactivity**:

### Proactivity Modes
- **Disabled**: AIRI operates strictly as a reactive assistant (speaks only when messaged).
- **Subtle / Low Frequency** (Recommended for work): Heartbeats fire every 5–10 minutes; AIRI speaks only after long periods of inactivity or when you return to your PC.
- **Engaged / High Frequency** (Best for casual hanging out): Heartbeats fire every 1–2 minutes, encouraging playful banter and frequent observations.

### Quiet Hours & Focus Mode
- **Quiet Hours**: Define a time range (e.g., 23:00 to 08:00) during which all proactive speech is silenced.
- **AFK Threshold**: Define how many minutes of inactivity qualify as "User is Away" (triggering welcome-back greetings when you move your mouse again).

---

## 4. Spontaneous Memory & Reflection

During quiet downtime, AIRI's proactivity engine can also trigger **Spontaneous Reflection**:
- Looking up an unvisited entry in her Long-Term Text Journal.
- Checking recent Echo Chips to see if an ongoing story thread or unresolved question can be revisited.
- Generating background imagery (via Autonomous Artistry) to match the current conversation vibe.
