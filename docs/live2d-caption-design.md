# Live2D Caption & Motion Labeling Design

> How captions, motion labels, and localized dialogue actually work in AIRI for Live2D models.
> Written after tracing the full pipeline from `model3.json` → `motionManager.definitions` → caption overlay.

---

## How Captions Work (the real pipeline)

### Source of truth: `model3.json` motion entries

Captions are **not** read from:
- `motion3.json` `UserData` fields ← common misconception, this is unimplemented
- A separate sidecar file (e.g. `umaru_labels.json`)
- Any external manifest

They **are** read from the inline fields on each motion entry inside `model3.json`'s `FileReferences.Motions` block:

```json
{
  "FileReferences": {
    "Motions": {
      "demanding": [
        {
          "File": "motions_start_0_file_0.motion3.json",
          "Sound": "motions_start_0_sound_0.wav",
          "Text": "Buy me manga, big bro! I wanna read it, I wanna read it!",
          "Language": "en"
        }
      ]
    }
  }
}
```

### The runtime pipeline

1. **`Model.vue` line 733–742** — after the model loads, `availableMotions` is built directly from `motionManager.definitions` (which is the parsed `Motions` block from `model3.json`):

   ```ts
   availableMotions.value = Object
     .entries(motionManager.definitions)
     .flatMap(([motionName, definition]) => definition?.map((motion, index) => ({
       motionName, // ← the group key string (e.g. "demanding")
       motionIndex: index,
       fileName: motion.File || motion.Sound || motion.Name,
       sound: motion.Sound,
       text: motion.Text, // ← caption text
       language: motion.Language, // ← "en", "ja", etc.
     })))
   ```

2. **`Model.vue` line 907–963** — when a motion fires, it looks up `activeMotionDef` from `availableMotions`, resolves the English localization, and if `resolvedTextDef.text` is truthy it posts to the `airi-caption-overlay` BroadcastChannel.

3. **Caption overlay** — receives `{ type: 'caption-assistant', segments: [{ text, color, actorId }] }` and displays it on screen.

### What triggers caption display

- Caption appears if and only if `motion.Text` is non-empty on the matched motion entry
- English is preferred: if siblings share the same `File`+`Sound`, the one with `Language: "en"` wins
- If captions are disabled in settings, falls back to OS notification / HTML5 notification

---

## How Motion Labels Work in the UI

### What the UI shows

`ModelCustomizer.vue` renders each motion's label as:
```ts
displayName: motionMappings[key] || key
```

Where `key` is the **full relative file path** extracted by `getOrLoadModelCapabilities`:
```ts
// display-models.ts ~line 1071
const fullPath = manifestDir ? `${manifestDir}${relativeFile}` : relativeFile
motions.push(fullPath.replace(/\\/g, '/'))
```

So if your `model3.json` has `"File": "motions_start_0_file_0.motion3.json"`, the UI key is exactly `motions_start_0_file_0.motion3.json` and the label defaults to that raw path unless the user has set a custom `motionMappings[key]` override.

> **The `Name` field on motion entries is NOT read by `getOrLoadModelCapabilities`.** It is also not read for caption purposes. Only `File`, `Sound`, `Text`, and `Language` are consumed.

### The motion group key matters for triggering

The **group key** (e.g. `"demanding"`, `"idle"`) IS what the Live2D store uses to fire a motion:
```ts
startMotion(group: "demanding", index: 0)
```
This is how the AI card's motion triggers work — the card says `"demanding"` and the runtime looks up the `demanding` group in `motionManager.definitions`.

---

## Correct model3.json structure for a captioned model

Each motion that has audio and dialogue should follow this pattern:

```json
{
  "FileReferences": {
    "Motions": {
      "<emotion_label>": [
        {
          "File": "<motion_file>.motion3.json",
          "Sound": "<audio_file>.wav",
          "Text": "<English caption text>",
          "Language": "en"
        }
      ],
      "<emotion_label_with_multiple_variants>": [
        {
          "File": "motions_tap_head_0_file_0.motion3.json",
          "Sound": "motions_tap_head_0_sound_0.wav",
          "Text": "New enemies are appearing! Time to show off Umaru's gaming skills!",
          "Language": "en"
        },
        {
          "File": "motions_tap_head_1_file_0.motion3.json",
          "Sound": "motions_tap_head_1_sound_0.wav",
          "Text": "Looks like there's a new story arc! I can feel it's gonna be legendary!",
          "Language": "en"
        }
      ]
    }
  }
}
```

### Rules
- Group key = emotion label (snake_case). This is what the AI card uses for `motionTag`.
- Multiple motions sharing a label go in the same group array — the runtime picks by index.
- Silent/idle motions can omit `Text` and `Sound`.
- `Language: "en"` is required for the English caption to be preferred over a fallback.

---

## What Does NOT Work (known dead ends)

| Approach | Status | Reason |
|---|---|---|
| `motion3.json` `UserData` `{ "Value": "text_en::..." }` | ❌ Unimplemented | `Model.vue` never reads `UserData` from motion files |
| Separate `umaru_labels.json` sidecar | ❌ Not read | Nothing in AIRI loads this file |
| `Name` field on model3.json motion entries | ❌ Not read by store | `getOrLoadModelCapabilities` only reads `File`/`file` |
| `motionMappings` in IndexedDB | ✅ Works for display label only | User must set manually; not scriptable |

---

## Working Reference: Juewa

Juewa (Soul Tide) is the confirmed working reference model. Her zip contains a `model3.json` with `Text` + `Language` fields on every motion entry. Clicking any motion in the UI:
- Plays the motion animation
- Plays the associated `.ogg` audio
- Displays the English caption via the overlay

Path on backup: `/Volumes/AIRI-Backup-Share/assets/models/` (search for `juewa`)

---

## Umaru-chan (Model 2173041194) — Current Status

As of this restoration pass, the model3.json still has generic group keys (`idle`, `start`, `tap_head`, `tap_body`) and **no `Text` or `Language` fields**. Captions and semantic labels are in `umaru_labels.json` and `motion3.json` UserData — neither location is read by AIRI.

### What needs to happen next

1. **Rewrite `model_0.model3.json`** — use emotion labels as group keys, add `Text` + `Language` inline on each motion entry
2. **Repackage the zip** — include updated `model_0.model3.json`
3. **Re-upload to AIRI** — fresh load will pick up the correct structure

The full label catalog is in [`umaru_labels.json`](../personal_airi/himouto_umaru/live2d_2173041194/umaru_labels.json).

---

## Adding Japanese Captions (future)

To support bilingual captions, add a second entry per motion with `"Language": "ja"`:

```json
"sulky": [
  {
    "File": "motions_start_10_file_0.motion3.json",
    "Sound": "motions_start_10_sound_0.wav",
    "Text": "I was so lonely... Where did you go, big bro?",
    "Language": "en"
  },
  {
    "File": "motions_start_10_file_0.motion3.json",
    "Sound": "motions_start_10_sound_0.wav",
    "Text": "寂しかったよお兄ちゃんどこ行ってたのおも",
    "Language": "ja"
  }
]
```

The runtime already prefers `en` when both exist (`enLocalized?.text ? enLocalized : defaultDef`), so this is backwards compatible. Displaying `ja` would require a user preference toggle — not yet implemented.

## Relevant Skills

- [[airi-caption-subsystem]]
