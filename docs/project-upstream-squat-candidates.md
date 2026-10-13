## Recent Integrations

- **PR #2920**: `feat(provider-inference): add OpenRouter transcription provider`
  - **Status**: ✅ **Squatted**. Added openrouter-audio-transcription to provider registry and settings page.
- **PR #2929**: `feat(i18n): add Thai`
  - **Status**: ✅ **Squatted**. Integrated full Thai UI locales, onboarding keys, and 2-column appearance step grid option.
- **PR #2930**: `chore(i18n): warn only when English lacks a message`
  - **Status**: ✅ **Squatted**. Added fallback.ts helper suppressing missing-message noise for secondary locales.
- **PR #2904**: `fix(i18n): show the pipe in the Anthropic provider title`
  - **Status**: ✅ **Squatted**. Escaped pipe delimiter in settings.yaml across all 10 locales.
- **PR #2911**: `fix(core-agent): preserve whitespace in streamed speech literals`
  - **Status**: ✅ **Squatted**. Preserved whitespace chunks in chat.ts and proactivity.ts.
- **PR #2916**: `fix(core-agent): exclude nested reasoning from streamed speech`
  - **Status**: ✅ **Squatted**. Prevented stream cursor regression in response-categoriser.ts.
- **PR #2905**: `fix(stage-ui-three): preserve orbit gestures across native text drags`
  - **Status**: ✅ **Squatted**. Prevented default dragstart in OrbitControls.vue.
- **PR #851**: `feat(stage-tamagotchi): add option for chat area send key`
  - **Status**: ✅ **Squatted**. Added UI to General Settings.
- **PR #1302**: `feat: add OpenRouter as a speech (TTS) provider`
  - **Status**: ✅ **Squatted**. Integrated into fork.
- **PR #1256**: `feat(providers): add Amazon Bedrock provider`
  - **Status**: ✅ **Squatted**. Integrated into fork.

## Current Priorities

- **PR #1065**: `fix(onboarding): allow manual model entry when list is empty`
  - **Status**: ✅ **Squatted**. Integrated into fork's onboarding flow.
  - **Why it matters**: Good baseline fix for onboarding. More importantly, onboarding should stop acting like a weird shortlist-driven flow and expose the real provider surface instead of implying that unsupported providers do not exist.
  - **Fork direction**: Use this as the starting point for a broader onboarding refresh:
    - keep manual entry fallback
    - remove the misleading truncated provider experience
    - surface the full supported provider set cleanly
  - **Priority**: High (Under consideration)

- **PR #917**: `feat(stage-tamagotchi): vision`
  - **Status**: ⚪ **Ignored**. Half-baked merge upstream with non-tangible stubs.
  - **Why it matters**: Vision support / Screenshare API. Essential for "seeing" the screen (Minecraft/Factorio/etc).
  - **Status**: Active discussion (Mar 20). Blocking on `electron-audio-loopback` historically but core API is maturing.
  - **Priority**: High (Watch/Research)

## Maybe, But Not Yet

- **PR #1190**: `fix(stage-pages): add missing local provider settings routes`
  - **Status**: Merged upstream (Mar 17).
  - **Decision**: Worth checking for overlap with existing fork changes, likely easy to absorb if not already covered.

- **PR #1148**: `feat(ui,stage-ui,stage-pages,i18n): transcription confidence filter`
  - **Current read**: Lower priority because the fork already has a useful STT toast that shows what the server heard.
  - **Decision**: Do not prioritize right now.

## Explicitly Deferred / Pass (Avoid)

- **PR #2903**: `feat(stage-tamagotchi): let the user choose which Home Assistant devices the model reaches`
  - **User Feedback**: User declined ("2903 - no thanks"). Heavy Tamagotchi / controls-island coupling; smart home filtering passed for now.
  - **Priority**: N/A (**PASS**)

- **PR #1237**: `feat(stage-ui): add chat settings with stream idle timeout`
  - **User Feedback**: "dont' touch it with a 10ft poll im so divergent any attempts would just nuke our code"
  - **Priority**: N/A (**PASS**)

- **PR #1033**: `feat(stage-ui-live2d): exp3 expression system + auto-blink rework`
  - Too large and too far from the current fork state. Integration cost is high.

- **PR #1222**: `fix(llm): flatten content array for OpenAI-compatible providers`
  - Looks risky relative to the current fork because nothing is obviously broken there right now. Avoid speculative provider churn unless a real bug appears.

## Operational Notes / Follow-ups

- **PR #1295**: Re-open candidate. The actual fix for "crackly" audio was identified as the `mediabunny` library, not the previous stability attempts.
- **PR #1289**: Needs a comment explaining the "Snapshot Restore" necessity: It allows users to snap back to their favorite position after moving the window willingly.
- **PR #1298**: Needs updating to current state before posting new screenshots.

## Relevant Skills

- [[airi-roadmap-upstream-research]]
