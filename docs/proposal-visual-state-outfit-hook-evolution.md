# Architectural Evolution: Scoped Actor State Setter

This document outlines the architectural evolution of the **Production Studio** and **Active Concept Stack** (originally defined in [proposal-visual-state-outfit-hook.md](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/docs/proposal-visual-state-outfit-hook.md)) to support **Scoped Visual State Persistence**.

---

## 1. The Sync Challenge: Stateless Baseline Resets

Under the original "closet" design:
1. The **Active Concept Stack** resolved the active outfit, model override, and manifestation settings in real-time.
2. However, the dialogue engine used *stateless* base actor prefixes at the start of each chat turn (e.g., `<|ACTOR:actor_kommy|>`).
3. **The Temporal Sync Bug (Visual Flash):** Because the initial actor token was stateless, the staging engine fell back to rendering her default base configuration at the start of a turn. Only when the LLM outputted a mid-speech `<|ACT:emotion="..."|>` tag did she swap back, causing a jarring visual "flash" or layout pop.

To solve this, we split characters into explicit stateful outfit tokens (`actor_kommy_swim`, `actor_kommy_lounge`, etc.). While this fixed the visual flash by making turn starts stateful, it required updating the LLM's instructions to track which prefix token to use.

---

## 2. The Solution: Scoped Actor State Setter

Instead of forcing the LLM to remember complex stateful prefix tokens, or running a heavy global search parser, we introduce a **reactive state-mutator hook** utilizing the existing parser's scoping capability.

### 2.1 The Scoping Agent: `markdown-renderer.vue`
The chat streaming system parses incoming tokens line-by-line. In [`markdown-renderer.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/markdown/markdown-renderer.vue#L42-L78), paragraph blocks `<p>...</p>` are analyzed for actor tokens:
* It looks for `[ACTOR: actor_id]` markers (which originate from the `<|ACTOR:actor_id|>` prompt notation).
* When a marker is found, it updates the `activeActorId` variable context. All subsequent inner content (including inline `<|ACT:...|>` elements) is parsed **under the scope of this active actor ID** until a new block updates it.

### 2.2 The ACT Tag as a Registry Mutator
Every `<|ACT:emotion="..."|>` tag maps directly to:
* **Active Expressions Override:** In the concept configuration, expressions are saved under `manifestation.active_expressions` as a mutually exclusive configuration (e.g., `preset2` for a black dress or a specific accessory, as configured in the [`ConceptBuilderModal.vue`](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-pages/src/pages/settings/airi-card/components/ConceptBuilderModal.vue#L870-L896) editor).

When the LLM triggers an inline change:
```text
<|ACTOR:actor_butter_trickcal_maid|> "Hi Homekeeper!" <|ACT:emotion="French Maid [Gun]"|> "Check this out!"
```

The staging engine leverages the parser context to perform a direct mutation of the **registry definition** itself:
1. **Identify Parent Scope:** Capture the active parent actor ID (`actor_butter_trickcal_maid`) established by the markdown parser block.
2. **Mutate Visual Asset Registry:** Update the `manifestation.active_expressions` record for this specific concept ID in the registry:
   ```ts
   visual_assets[activeActorId].manifestation.active_expressions = {
     [emotion]: 1
   }
   ```
3. **Natural Stacking Propagation:** Because we modify the source configuration in the registry, the downstream stacking engine automatically folds the changes into `active_state` and executes the re-render.
4. **Preserve State Across Turns:** On subsequent turns, when the LLM outputs `<|ACTOR:actor_butter_trickcal_maid|>`, the staging engine reads the updated visual asset configuration containing the persistent expression state. The model renders with her maid dress and equipped gun immediately at turn initialization, eliminating visual resets.

---

## 3. Benefits of the Mutation Paradigm

This solution cleanly resolves visual resets while preserving architectural simplicity:

* **Intra-Outfit State Persistence:** Within a single outfit concept (e.g. Maid), a character can toggle accessories or weapons (e.g. Maid [Normal] $\to$ Maid [Gun]). The gun stays equipped in subsequent turns without having to declare a new actor token.
* **UI Transparency:** The user can open the Concept Builder modal for that active outfit, look at the "Active Expressions / Outfits" buttons, and see exactly which state/accessory (like the gun) is currently selected.
* **Zero Downstream Impact:** We do not touch `active_state` directly or alter any of the rendering logic in `syncCardState`. The rest of the engine remains completely unaware of the mutation, maintaining architectural stability.
* **Zero Search Overhead:** The lookup is tightly restricted to the active `activeActorId` context rather than scanning the entire registry.

---

## 4. Implementation Roadmap

### Phase 1: Card Store Mutation Action
- Expose a simple update action in `AiriCardStore` to reactively update the registry config:
  ```ts
  updateConceptExpressions(cardId: string, conceptId: string, expressionName: string) {
    // sets manifestation.active_expressions = { [expressionName]: 1 }
  }
  ```

### Phase 2: Parser Mutation Hook
- Hook into the chat stream parser. When a `<|ACT:emotion="..."|>` tag is encountered, match it to the preceding active `activeActorId` tag tracked by the renderer, and invoke the update action.

### Phase 3: Validation
- Verify that changes made via incoming streams are instantly visible in the Concept Studio UI and persist across new turns.

## Relevant Skills

- [[airi-modular-outfits-system]]
