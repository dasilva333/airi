# Image Journal Proposal

## Overview

The `image_journal` is a first-class character capability designed to provide durable, persistent storage for AI-generated art. It replaces the current ephemeral `stage_widgets` flow with an append-only, character-scoped image history system.

## The Problem: Ephemeral Widgets

Currently, generated art is modeled as a `stage_widgets` lifecycle problem. This approach has several limitations:
- **Ownership**: The widget is both the live surface and the only owner of the image history.
- **Fragility**: Once a widget is replaced or removed, the history becomes inaccessible or hard to reason about.
- **Model overhead**: The LLM must manage widget IDs, which adds unnecessary complexity to the prompt.

## The Solution: `image_journal`

The `image_journal` reframes generated art as a persistent record rather than a temporary UI element. The widget becomes a **viewport** into the journal, not the source of truth itself.

### Key Principles

1.  **Durable Storage**: Image history is stored independently of any active UI widgets. History is scoped per character.
2.  **Carousel UI Pattern**: Preserve the successful "carousel" interaction pattern already used for generated art.
3.  **Append-only**: New images are appended to the journal history over time.
4.  **Simplified Logic**: Remove the need for the LLM to track and manage ephemeral widget IDs for art.

## Proposed MVP Tools

### 1. `image_journal.create`
Generates a new image and appends it to the character's journal.
- **Arguments**:
  - `title`: A human-readable title for the image.
  - `prompt`: The generation prompt.
- **Behavior**: Routes through the defined Artistry provider (e.g., ComfyUI, Replicate) and adds the resulting metadata/URL to the persistent journal.

### 2. `image_journal.set_as_background`
Promotes the currently focused journal image to the Stage background.
- **Behavior**: Triggers the scene system to update the background.
- **Context Feedback**: Once updated, the active background is surfaced back into the proactivity/sensor layer as "ambient self-context," allowing the character to be aware of their current environment.

## Technical Requirements

### Storage & Management
- **Sanitization**: All titles must be sanitized and slugified for stable storage.
- **Deduplication**: Automatic deduplication of titles within a character's journal.
- **Scope**: Journal entries are strictly scoped to the `activeCardId`.

### UI Integration
- The existing carousel component should be refactored to consume the `image_journal` store instead of local widget state.
- Support for "Set as Background" should be added to the journal UI interface.

## Future Extensions
- **Tagging/Search**: Keyword-based search and categorization of journal entries.
- **Manual Upload**: Allow users to manually add images to a character's journal.
- **Shared Journal**: Optional cross-character gallery or vault for shared assets.

## Relevant Skills

- [[airi-data-persistence]]
- [[airi-memory-image-journal]]
- [[airi-scenes-backgrounds]]
