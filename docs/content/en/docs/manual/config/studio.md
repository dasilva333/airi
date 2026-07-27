---
title: Studio
description: Orchestrate multi-actor scenes, outfit changes, and atmospheric states without binding your character to a single static model or look.
---

# Studio

The Studio is a multi-actor and scene orchestration layer that sits on top of your standard **Airi Card**. Rather than locking a character to one model, one voice, and one visual prompt, the Studio lets you register a collection of reusable **Concepts** — outfits, secondary characters, moods, places, or atmospheric filters — and switch between them on the fly during a session.

The result is a single character that can change looks, cast, location, and tone as the story moves, with the visual avatar, voice, and image prompts all following each other.

---

## The Idea Behind a Concept

A concept is a named package. Whenever the concept is active, its contents are applied to the current scene as three independent layers:

### The Three Pillars

1. **Identity (Prompt Snippet)** — Tags and narrative phrases the image generator will see. When a concept is part of the active stack, its prompt fragment is appended to generated image prompts. Examples: `, (burgundy velvet dress:1.4)`, `, rain, neon street at night`.
2. **Artistry (Generation Overrides)** — Optional per-concept switches for how the scene is *generated*: a different image model or workflow, alternate generation options, or a different provider entirely.
3. **Manifestation (Physical Appearance)** — How the concept *looks on stage*: swapping the active 2D/3D model, locking a baseline mood or expression, recoloring speech text, or changing the background picture.

The key insight: these three pillars are independent. A concept can supply just a prompt (an atmosphere), just a model swap (a costume), or all three at once. Deciding *which* pillars a concept carries, and *when* those pillars apply, is what makes the Studio flexible.

---

## Base vs. Layer Concepts

To keep the visual narrative consistent, every concept is classified as one of two types:

- **Base (Exclusionary)** — A complete, full-state change. Activating a Base concept clears the active stack so nothing overlaps. Use Bases for things that can't co-exist with what came before: a new outfit, a single character who is now alone on stage, or a new location that resets the slate.
- **Layer (Additive)** — A modifier stacked on top of the Base. Layers coexist with the Base and with each other. Use Layers for things that *add* to the scene without replacing it: an emotion, weather, a held prop, or a secondary character who is also on stage.

### The "Bases for Places" Principle

When you start mixing multiple characters and locations in the same card, treating a *person* as the Base causes scene collision whenever two characters share a scene. A cleaner pattern:

- Make the **place** your Base (`place-bedroom`, `place-kitchen`, `place-beach`). When the location changes, the stack resets cleanly.
- Make the **actors and atmospheres** Layers stacked on top (`actor-first-girl`, `actor-grumpy-girl`, `mood-intimate`, `weather-rain`).

This keeps room changes atomic and lets characters layer in naturally, exactly the way they would in a real stage production.

---

## The Concept Stack

At any moment your character has an **active Concept Stack** — the ordered list of concepts that are "on". The Studio resolves the final scene by folding the stack from bottom to top:

- **Prompts** are concatenated together, in order.
- **Artistry** and **Manifestation** fields resolve as **last-wins** — if two concepts override the same setting, the one closer to the top of the stack wins.

This is why Base vs. Layer matters: a new Base wipes the stack first, so its values win uncontested; Layers stack and only override fields they actually declare.

---

## How to Orchestrate Your Scene

You can drive the Studio with **actor tokens**, with the **Autonomous Director**, or with neither — just pre-made assets pinned to your concepts. How the pillars apply depends on *which* system is doing the driving.

### Manual Control with Actor Tokens

If you want tight, scripted control, you (or your card's scripted dialogue) can place an **actor token** directly inside the chat:

```text
<|ACTOR:pajamas|> "Good night, master!"
<|ACTOR:casual_outfit|> "Good morning!"
```

The orchestration engine intercepts these tags as the dialogue streams and applies all three pillars of the named concept on the fly — the active model swaps to pajamas, the voice and prompt settings update, and the Scene is set for that speaking turn.

This is the primary way to do **multi-character dialogue** with a single card. Each character is its own concept with its own model and voice, and the dialogue script switches them by name:

```text
<|ACTOR:first_girl|> "I'm doing great, and you?"
<|ACTOR:grumpy_girl|> "Bah humbug. Buzz off."
```

The engine places the speaking character on top of the stack and the model follows.

### Autonomous Director Automation

When **Autonomous Artistry** is enabled in the card's artistry settings, you can hand the camera over to the **Director**. After each conversation turn, the Director reads the recent history, grades how visually interesting the scene is, and decides:

- Whether to generate a fresh scene image at all (against a configurable threshold)
- Which concepts should be on the stack for the next image
- The prompt and generation recipe for the image itself

You don't need to write actor tokens for this mode. The Director manages the stack itself, keeping continuity from turn to turn ("we're still in the living room with both girls") and refreshing atmospheric modifiers as the scene's emotional tone shifts.

### How the Modes Cooperate

This is the part most worth understanding, because it determines which pillars you can safely mix:

| Pillar | Who owns it |
| :--- | :--- |
| Identity (prompt) & Artistry (generation) | Either — the **Director** naturally owns these during autonomous mode |
| Manifestation (model swap) | Depends on the setup — see the three setups below |
| Manifestation (background image) | The **Director** if it's on; otherwise the active concept's own pinned background |

**Setup A — Actor-driven (Modern, Multi-Character).** Two or more models share the stage; handoffs are driven **only** by `<|ACTOR:x|>` tokens in the dialogue. The place is a **Layer-friendly Base** and the characters are **Layers**. In this setup, the Director keeps managing the scene (it still writes the prompt tags for both girls, the place, and the weather — *that's* its job) but it will **never** move the physical model out from under the currently speaking actor. The actor token alone decides who is on stage.

**Setup B — Director-driven Outfits (the Classic Production Studio).** A single character with multiple full looks (`actor-pajamas`, `actor-daytime-dress`), no actor tokens, no mid-dialogue swaps. Here the Director itself drives the model: when the story calls for a wardrobe change, it activates the new outfit as a **Base**, the stack wipes, and the model swaps once, cleanly.

**Setup C — Static-Preset Personalities (Actor-Driven, Director-less).** Two faces of one soul, each its own **Base**, each pinning its own hand-authored **background image**. No Director — Autonomous Artistry is off. The actor token fires the whole stage package (model + flat background + voice) atomically. The model itself triggers the swap mid-dialogue whenever the other aspect surfaces.

::: tip The Short Version
- If your script uses `<|ACTOR:x|>` tokens to switch *coexisting* characters, make the characters **Layers**, make the place the **Base**, and let the actor tokens own the physical model.
- If your script has no actor tokens and relies on the Director to change your character's whole look, make those looks **Bases**.
- If you're pinning pre-made background images to each personality and letting the model switch between them, make each personality a **Base** and turn the Director off.
- Never mark two *coexisting* speaking characters as mutually exclusive Bases in the same scene — that conflict is the one the Studio intentionally isn't designed for. Two *non-coexisting* personalities swapping in and out (Setup C) is exactly what Bases are for.
:::

---

## Creating a Concept

You register concepts from the artistry section of your card. Each concept has the following configuration:

### Identity

- **ID** — A short, stable, lowercase identifier used in tokens and in the Director's selections (e.g. `actor-first-girl`, `place-living-room`, `mood-intimate`). Keep these simple and consistent.
- **Description** — What the concept is, written for the Director so it can recognize when the scene calls for it.
- **Prompt** — The narrative snippet appended to image prompts when this concept is active. Combined additively across the stack.
- **Type** — **Base** or **Layer** (see above).

### Manifestation

- **Model** — The 2D/3D model (Live2D or VRM) this concept should put on stage when it owns the physical avatar.
- **Mood / Expression** — An optional baseline emotional state to lock while the concept is active.
- **Background** — An optional scene background to apply alongside the concept (respects the Director's autonomy: a manually-set background won't be overridden while the Director is on).
- **Text Color** — Optionally recolor this concept's dialogue lines in the chat for at-a-glance speaker identification.

### Artistry

- **Provider / Model / Options** — Per-concept overrides for the image-generation pipeline. Use these when a concept demands a different workflow (e.g. one concept renders in monochrome via an alternate ComfyUI template, another renders in full color).

### Speech

- **Provider / Model / Voice** — Per-concept overrides for text-to-speech. Let each character in a multi-actor card sound distinct, even if they share a single stage.

### Idle Behaviour

- **Idle Animations** — A per-concept list of suggested idle animations/motions while the concept's model is on stage. Empty falls back to the card's general idle set.

---

## Director Configuration

The autonomous artistry module exposes the following settings, all per-card:

| Setting | What it controls |
| :--- | :--- |
| **Autonomous Artistry** | Master toggle for the Director. |
| **Grading Threshold** | A 1–100 score the Director must reach before spending tokens on a new image. Lower = more images; higher = only the striking moments get rendered. |
| **Trigger Target** | Whether the Director judges the **last user message** or the **last assistant reply**. Most users set this to *Assistant*. |
| **History Depth** | How many of the most recent turns the Director can see when deciding the scene. Larger = more visual continuity but more tokens. |
| **Spawn Mode** | How the generated image is delivered once it's ready (see below). |

### Spawn Modes

- **Background Scene** — The image becomes your character's new background. Ideal for "cinematic" RP where every generated scene *is* the room your actor is standing in.
- **Inline Image** — The image is posted into the chat history as an assistant message. Good when you want the image to live alongside the words rather than replace the backdrop.
- **Floating Panel** — The image appears as a temporary on-stage card alongside your actor without changing the background. Useful for showing what your character is looking at or holding.
- **Background + Floating Panel** — Both: updates the backdrop and pops up the temporary card together.

---

## Multi-Character Cards in Practice (Setup A Walkthrough)

A typical two-character card:

1. Register the **place** as your Base — `place-living-room` with its prompt and background pillar. No model of its own.
2. Register **first_girl** as a Layer — model, voice, dialogue text color, and a short prompt tag describing her appearance.
3. Register **grumpy_girl** as a Layer — different model, different voice, different color.
4. Set the system prompt so the assistant knows to format its multi-character reply with one actor token per turn, like:

```text
<|ACTOR:first_girl|> *peeks up from her book* "Oh! Hey Richy, how are you?"
<|ACTOR:grumpy_girl|> *doesn't look up* "...What."
```

5. Enable Autonomous Artistry with **Background Scene** as the spawn mode.

What happens during play:

- The streaming reply is intercepted token-by-token. When the `first_girl` token appears, her model swaps onto the stage and her audio is synthesized in her voice. When her dialogue ends and the `grumpy_girl` token appears, the stage hands off to her model and her voice — synchronised with the audio so the model change lands exactly when her line starts being spoken.
- Sometime after your message, the Director quietly grades the scene and generates an image. If it crosses the threshold, the new image is applied as the stage background. It includes both girls in the image prompt for continuity, **but it does not change which girl is on the physical stage** — that decision is the actor token's to make, never the Director's.

---

## Single-Character Wardrobe Cards in Practice (Setup B Walkthrough)

1. Register each full outfit as its own **Base** — `actor-pajamas` carries its own model and a "sleepwear, lace trim" prompt; `actor-daytime-dress` carries its own model and a "yellow sundress" prompt. Each is a complete, exclusionary state.
2. Register any pure modifiers as **Layers** — `mood-cozy`, `weather-snow`, etc.
3. Leave actor tokens out of your system prompt. Let the AI narrate the change naturally ("the clock strikes midnight and she changes into her pajamas").
4. Enable Autonomous Artistry.

Now the Director drives everything: when the scene shifts from morning to night, it activates the new outfit as a Base, the stack wipes, and the model swaps once at the moment the decision is made. Atmospheric modifiers come and go on top.

---

## Static-Preset Personalities in Practice (Setup C Walkthrough)

Setup A and Setup B both lean on the Director for the scene around the actor. There's a third pattern worth knowing — and the takeaway is bigger than the pattern itself: **the Studio does not require the Director.**

Setup C is for a single character who is really *two faces of the same soul*. Think a modern boxer and her reincarnated-priestess past self, a daytime persona and a midnight one, a human form and a divine one. Each face has its own model, its own voice, *and its own hand-authored background image* — a flat, static, pre-rendered scene that you, the card author, pick for that personality. When the actor token fires, the entire stage package swaps atomically — the model, the background image, and (if you've set them) the voice and prompt — in one move. No scene is generated. The Director is off.

::: tip Setup C in one line
Two actor tokens, two Bases, two flat background images, **Autonomous Artistry disabled**. The actor token *is* the scene switch.
:::

### Why this is its own setup

It looks superficially like Setup A (actor-token-driven) or Setup B (full-state Base swaps), but it's genuinely neither:

- Unlike **Setup A**, the two actor tokens don't represent *different characters on the same stage*. They're two aspects of one character, never on stage at the same time. There is no shared "place" Base and no coexisting Layer actors. Each personality *is* the Base, and a Base is exclusionary — when one is on, the other is fully off.
- Unlike **Setup B**, the swaps are *not* driven by the Director reading the scene and deciding to redress the character. They're driven by the model itself, mid-dialogue, whenever the narrative calls for the other aspect of the soul to surface. And the model-swap is only half the point — each personality carries its **own static background**, which is the part the Director would otherwise own. Authoring those backgrounds ahead of time *is* the Director's job, done once, by hand.

### How to author it

1. Register each personality as its own **Base** concept — e.g. `flanny_oven` for the boxer, `flanny_priestess` for the priestess.
2. On each concept's Manifestation pillar, set **both** the **Model** *and* the **Background** — a flat, pre-rendered scene you've imported ahead of time. No prompt snippet is needed; you're not generating images, you're pinning a chosen one.
3. Leave the artistry / speech pillars set per personality if you want the voice and TTS to flip with the aspect.
4. **Turn Autonomous Artistry off** on this card. The Director has nothing to do here — handing it the camera would only fight your actor tokens over the background.
5. Teach the model the two tokens and the rule that it must re-emit the actor token *every time* it shifts identity, even halfway through a single message:

```text
You represent two distinct aspects of your soul. You MUST use the ACTOR token
again every time you shift your identity or speech style, even in mid-message.
- <|ACTOR:flanny_oven|> : Your modern, energetic boxer self. Use for gear and grit.
- <|ACTOR:flanny_priestess|> : Your ancient, reincarnated priestess self. Use for lore and spirit.
Do not speak on behalf of the other.
```

A turn then reads like this:

```text
<|ACTOR:flanny_oven|> Yo, Coach! Check out the footwork today!
<|ACTOR:flanny_priestess|> *as the old soul stirs* "And the Great Flame remembers when
  this fist was a prayer..."
<|ACTOR:flanny_oven|> "Whoa, whoa — back to the now, the bag's not gonna hit itself!"
```

Each token fires atomically: the stage flips to the oven-aspect's model against its static oven-themed background, the priestess-aspect's model against her hand-picked shrine background, back to the oven — cleanly, predictably, with no image ever having to be generated.

### The takeaway

The Studio's three orchestration modes — actor tokens, the Director, and hand-authored static state — are tools, not a bundle. Setup C is the proof: a card where Autonomous Artistry is silently off, no image is ever generated mid-conversation, and the entire visual experience is delivered through pre-made assets pinned to actor tokens. The Director is one *optional* way to drive the Studio; a well-authored card can drive it itself.

---

## Power-User Moves: ACT Tokens as Setters for ACTOR Tokens

So far we've treated **actor tokens** (`<|ACTOR:x|>`) as the way to put a concept on stage, and **ACT tags** (`<|ACT:emotion="..."|>`) as the way to play a short-lived expression or motion. There's a more powerful way to use ACT tags that's worth knowing: under the Studio's scoping rules, an ACT tag placed inside an actor's dialogue block doesn't just *play* a state — it **sets** it. The change is written into the concept itself and persists turn after turn, so the actor owns their own in-costume appearance without competing with the Director for control of the stage model.

This is what makes an actor's accessories, weapons, or sub-outfits "stick" naturally across a scene — the maid walks on with her gun already drawn, every turn, until she explicitly puts it away.

### The Manifestation Pillar's Second Face

Recall that a concept's **Manifestation** pillar isn't only the model swap. It also carries **Active Expressions** — the variant, accessory, or skin state currently applied to that model (a Live2D expression preset, a VRM blendshape combo, a Spine skin). So an avatar's look has two independent parts:

- **Which model** — owned by the actor token and the costume concept it names.
- **Which variant of that model** — ownable by ACT emotion tags, persisted into the concept's Active Expressions.

The Director manages the first (via the concept stack). The actor, through scoped ACT tags, manages the second.

### How the Setter Pattern Works

An ACT tag is interpreted **under the scope of the actor token that opens its paragraph block**. When the engine sees:

```text
<|ACTOR:actor_butter_trickcal_maid|> *curtsies* "Welcome home, master!"
<|ACT:emotion="French Maid [Gun]"|> *pulls out a popgun* "Surprise!"
```

…three things happen, in order:

1. The opening actor token activates the `actor_butter_trickcal_maid` concept — her maid-outfit model takes the stage.
2. The `ACT` tag is parsed *under* that actor's scope, so the engine knows exactly which concept it's talking about.
3. Instead of just flashing the `"French Maid [Gun]"` expression once, the engine **writes that state into the concept's Active Expressions**. From that moment on, `actor_butter_trickcal_maid` carries `French Maid [Gun]` as its current variant.

The practical payoff: on the *next* turn, when the LLM opens with `<|ACTOR:actor_butter_trickcal_maid|>`, she enters already wearing the gun variant — no flash back to a default pose, no awkward re-equip animation, no need for the LLM to re-emit the ACT tag.

### The `Variant [Skin]` Notation

In-costume states follow a `Variant [Skin]` naming convention. A maid costume might expose:

- `French Maid [Weapon_Off]` — unarmed, hands free
- `French Maid [Gun]` — popgun drawn
- `French Maid [Normal]` — the costume's neutral resting state

Setting `<|ACT:emotion="French Maid [Gun]"|>` swaps to the gun variant; `<|ACT:emotion="French Maid [Weapon_Off]"|>` puts it away. The bracketed skin is the sub-state, the unbracketed name is the costume variant the skin belongs to. Motions like `<|ACT:motion="Happy_1"|>` can be combined inline for one-shot body animation on top of the persistent expression state.

### Two Scopes of Persistence

The setter pattern works at two granularities, and a card can use either or both:

- **Broad character concept** — One concept represents the whole character, and ACT emotion tags toggle sub-states (a mood, an accessory) that persist as long as the character is on stage. Simple, but the LLM must remember which sub-state is currently active.
- **Specific costume concept** — Each costume is its own concept (`actor_kommy_swim`, `actor_kommy_maid`, …), and within a costume, ACT tags persist the variant/skin. Switching to a different costume concept resets to that costume's default `[Normal]`, but staying inside one costume lets accessory toggles accumulate and persist naturally. This is the cleaner pattern for cards with many outfits, because each costume resets its own state and the LLM only has to remember its current costume, not every accessory it ever touched.

### How This Cooperates with the Director

This is the part that makes the pattern safe to combine with Setup A. The two systems own different pillars and never argue over the same one:

| Decision | Owned by |
| :--- | :--- |
| Place (the Base), which costume is on the stack, image prompt tags, background image | **Director** |
| Which model is physically on stage | **Actor token** |
| Which variant/skin of that model the actor is currently in | **Actor's ACT tags**, persisted into the concept |

So the Director can decide "she's in the maid outfit, in the living room, and the image should show both girls" — while the actor decides "and I'm holding the gun variant of that outfit." The Director never reaches into the in-costume state, and the actor never reaches into the scene-level stack.

### Teaching the Model to Use the Pattern

Cards that lean on the setter pattern split their instruction across two fields, because they teach the model two different things.

**The character's System Prompt** carries the **roster** and the rules of address:

- A list of every active costume token, each mapped to its concept — e.g. `<|ACTOR:actor_kommy_lounge|>` (Basic Civvies), `<|ACTOR:actor_kommy_swim|>` (Swimsuit Civvies), `<|ACTOR:actor_butter_trickcal_maid|>` (French Maid) — with an instruction to prefix *every* dialogue block with the costume-matching token and never fall back to bold name headers.
- An explicit deprecation of older, unscoped actor tokens (a bare `actor_kommy` with no costume suffix). Without this, the model will occasionally emit the bare form, and the setter scoping has nothing to attach the in-costume state to — the gun never equips.

**The Acting tab's Model Expression Prompt** is where the machine-readable contract lives. This field is where you give the model the *exact strings* it's allowed to emit and the *rules* for emitting them:

- **Approved Emotions** — the precise `Variant [Skin]` strings each costume exposes, grouped by costume. For a maid costume this might be `French Maid [Normal]`, `French Maid [Gun]`, `French Maid [Weapon_Off]`; for a basic civvies outfit just `Basic Civvies [Normal]`. Bracketed skins are handheld/prop states.
- **Approved Motions** — the body-animation cue list (`Happy_1`, `Panic_2`, `Dizzy_1`, `Taunt_3`, …) the model is allowed to request, plus the short-format syntax `<|ACT:emotion="…",motion="…"|>` with both keys explicit.
- **The four orchestration rules** that make the setter pattern actually persist:
  1. **Initial Outfit (Turn Start Prefix)** — open every dialogue block with the actor token matching the *currently active* costume.
  2. **Mid-Speech Transformation** — to change clothes or draw a prop mid-turn, insert `<|ACT:emotion="Variant [Skin]"|>` inline at the moment of the change.
  3. **Subsequent Turn Sync** — once you've changed costumes mid-turn, the *next* turn's prefix actor token must match the new costume. This is the rule that closes the loop: the persisted state from the previous turn plus the matching token at turn start means she enters already in the right look, no reset flash.
  4. **Fluid Physical Acting** — pair each dialogue beat with a `motion="…"` cue so the body language tracks the words.

The split matters because the two fields are doing different jobs. The system prompt tells the model *who's in the scene and how to address them*; the acting prompt tells the model *the exact vocabulary of expressions and motions it's allowed to speak in, and the protocol for persisting a change*. Keeping the raw string lists in the Acting field rather than the system prompt keeps the system prompt shorter and puts the format contract where the parser can rely on it being consistent.

### A Worked In-Costume Transition

With those two fields authored as above, a single turn can carry a full prop swap and have it persist — faithfully to how production cards author this:

```text
<|ACTOR:actor_butter_trickcal_maid|> <|ACT:emotion="French Maid [Normal]",motion="Idle_1"|>
  *Butter dusts the table* "Clean and tidy! Just normal maid stuff, Homekeeper!"
<|ACT:emotion="French Maid [Gun]",motion="Taunt_1"|>
  "But look what I found in the laundry basket — a shiny Magnum! Hands in the air!"
```

What unfolds on the stage:

1. The opening token puts the maid model on stage in its `[Normal]` variant (or, if the previous turn persisted `[Gun]`, in whatever variant was last set — that's the whole point).
2. The first `ACT` tag pins `French Maid [Normal]` and plays `Idle_1` over it.
3. The second `ACT` tag, still scoped under the maid actor, writes `French Maid [Gun]` into the **concept's** Active Expressions — the gun is now equipped *as far as the concept is concerned*, not just for this turn.
4. Because of Subsequent Turn Sync, the next turn opens with `<|ACTOR:actor_butter_trickcal_maid|>` and the persisted `[Gun]` state renders immediately. To put the gun away later, the model emits `<|ACT:emotion="French Maid [Weapon_Off]"|>` — and from that moment on, `[Weapon_Off]` sticks until something changes it.

The Director, meanwhile, has been free to swap places (`place_main` → `place_beach`), refresh atmospheric modifiers, and generate scene images around her the entire time. It never touched `French Maid [Gun]` — that was the actor's call, persisted in the actor's concept, exactly as the pillar ownership says it should be.

### One Constraint Worth Keeping

The setter pattern assumes Setup A's shape: actors and costumes are **Layers**, with the place as the **Base**. If a costume were marked as a Base, activating it would wipe the whole stack on entry — and the in-costume variant state you'd carefully persisted would be thrown away on every wardrobe change. Keep costume concepts as Layers, and the persisted state rides along cleanly wherever the scene goes.

---

## Troubleshooting & Tips

<summary>My characters swap on stage at the wrong time</summary>

This is almost always a Base-vs-Layer misclassification. If two speaking characters are both marked as Bases, whoever the Director lists "later" wins. Move your characters to Layers and let the place be your Base — the Studio will then never have the Director decide which character is on stage.

<summary>The Director keeps redressing my character mid-speech</summary>

If you're running an actor-token script (Setup A) and your characters are also marked as Bases, the Director's scene-management is competing with your actor tokens over the physical model. Switch the characters to Layers — Director-driven full model swaps are intended for the no-token wardrobe flow (Setup B) only.

<summary>The image prompt never includes my character's outfit</summary>

Make sure the relevant concept still has its **Identity** prompt snippet filled in. A concept can sit in the active stack and contribute its model/voice without contributing a prompt, but that's only what you want when the Director's own narrative prompt is already enough. For tagged, specific wardrobe prompt content, the prompt snippet is the lever.

<summary>The Director reacts too often / too rarely</summary>

Tune the **Grading Threshold**. Around 30–40 tends to feel "alive" (most visually interesting moments get drawn); higher (60+) means the Director only opens the camera for cinematic beats.

<summary>The Director loses track of where we are</summary>

The Director maintains a small persistent "scratchpad" of visual state (location, held items, time of day). Long scene-swap streaks can outpace it. Increasing the **History Depth** lets the Director see further back, which usually restores sense of place.

<summary>I want a manual scene update without the Director intervening</summary>

Disable **Autonomous Artistry** on the card. Your actor tokens continue to work — only the background-image generation stops.
