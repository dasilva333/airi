# AIRI Mind Map — Design and Visualization Peer Review
Target: dasilva333/airi @ 7bb7d0422a
Review date: 2026-09-24
Scope: Read-only source inspection and five supplied screenshots. No application build, runtime profiling, or production dataset execution was performed. Recommendations below are proposed design decisions, not implemented fixes.

## Recommendation

Combine **session aggregation + deterministic vertical packing + screen-space label culling + optional camera follow**. Keep a linear time axis. Defer fish-eye distortion.

Preserve the dark spatial aesthetic, but make the default view communicate episodes and a few meaningful anchors. Reveal individual mentions through zoom and focus. A 277-entity dataset does not require 277 permanent labels.

| Proposal | Decision | Implementation direction |
|---|---|---|
| 1. Session / episode LOD | Adopt | Stable session membership; overview summaries expand into category aggregates, then individual mentions. |
| 2. Vertical force separation | Modify | Deterministic collision packing with fixed time X. Bounded lane capacity and explicit overflow aggregation. |
| 3. Label culling | Adopt first | Screen-space boxes; selected/search/hover priority; minimum readable font size. |
| 4. Fish-eye time | Defer | Moving temporal distortion complicates comparison, hit testing, and navigation. Linear zoom plus an overview brush addresses the immediate need. |
| 5. Camera follow | Adopt with controls | Follow during scrub/play; suspend on manual pan; provide “Follow time” / recenter. |

## What the screenshots reveal

The constellation has ample separation but very little readable hierarchy. Tiny labels and a field dominated by isolated nodes make it hard to know where to start. Spreading the nodes further would worsen this.

The timeline conflates repeated mentions, entity importance, and first encounters. Large circles, outlines, labels, and shared category lifelines compete for the same narrow bands. The dominant visual is overlap rather than conversational history.

The entity listings also show candidate aliases (“Asuka”, “ASUKA LANGLEY”, “Asuka Langley Soryu”; “Misato”, “Mistato”, “And Misato”, “Through Misato”) and suspicious fragments such as “before” in the graph. These are review candidates, not proof of equivalence. Do not automatically merge context-sensitive names such as “Commander”, “Ikari”, “Tokyo”, or “Tokyo-3”.

The header reports only three claims for 277 entities. Since the current graph adapter creates at most one edge per claim, this snapshot can have at most three rendered edges, and possibly fewer. There is insufficient relational structure for a force layout to discover rich communities. No force tuning can supply missing relationships.

## Source-confirmed problems to fix before visual polish

### 1. High priority: first-seen timestamps collapse to the global beginning

In [MindMapExplorer.vue](https://github.com/dasilva333/airi/blob/7bb7d0422a/packages/stage-pages/src/pages/knowledge-graph/MindMapExplorer.vue), graphNodes initializes earliestMention to minTimestamp, then takes Math.min with each source timestamp. For normal in-range sources, the minimum never advances.

Impact: later entities appear at the beginning; active counts become misleading; entities with no eligible historical mentions can receive synthetic first-encounter beads at that erroneous time.

Initialize with Infinity, reduce over valid source timestamps, and apply an explicit unknown-date policy if no source exists. Do not silently represent missing provenance as the earliest memory.

### 2. High priority: replay currently leaks later knowledge

The same adapter sizes nodes from lifetime mentions.size. Constellation filters edges only by endpoint visibility; it does not time-filter claim evidence or reconstruct claim revisions. Timeline first-bead sizing also uses lifetime counts.

An “as of time T” view should derive counts and available claims from evidence at or before T. If claim history cannot support historical belief reconstruction, explicitly limit the feature to replaying mentions; do not present current claims as historical beliefs.

### 3. Timeline overlap is guaranteed by its layout

In [ChronologicalTimelineView.vue](https://github.com/dasilva333/airi/blob/7bb7d0422a/packages/stage-pages/src/pages/knowledge-graph/components/ChronologicalTimelineView.vue), each entity independently repeats offsets of -16, 0, +16 pixels. First beads can reach radius 24. All entities' first mentions use the same offset; even adjacent offset rows cannot separate these circles.

Replace modulo staggering with cross-entity packing within each lane. A 90-pixel lane has finite capacity: use aggregation or expansion when it fills.

### 4. Timeline camera focus applies the transform twice

timeToX returns an already transformed screen coordinate. fitToPlayhead multiplies that value by currentScale again when creating the new translation.

Separate the base time scale from screen projection. With base coordinate u(t), zoom k, and plot center c:

```text
screenX(t) = k * u(t) + translationX
translationX = c - k * u(focusTime)
c = gutter + usablePlotWidth / 2
```

Use the same coordinate convention for ticks, beads, hit tests, and playhead. Reserve the inspector's visible footprint when calculating usablePlotWidth. Update through the D3 zoom behavior so its internal transform stays synchronized. The current component also has no scrub-time watcher driving camera follow.

### 5. Constellation stability is incomplete

[ConstellationCanvas.vue](https://github.com/dasilva333/airi/blob/7bb7d0422a/packages/stage-pages/src/pages/knowledge-graph/components/ConstellationCanvas.vue) restarts the simulation for every scrub timestamp change, including changes that reveal no new nodes. It watches array lengths rather than entity identity/content, so equal-sized filter changes can leave stale rendered nodes.

The position cache lives inside a component destroyed by the shell's v-if mode switch. It does not survive switching away and back. Initial seeding also uses Math.random.

Cache layout and camera by character outside the disposable renderer. Update topology only when membership/edges change; update labels, types, and counts separately. Use deterministic seeds and avoid reheating unchanged layouts during playback.

### 6. Labels, lane taxonomy, and viewport handling need explicit policies

- Constellation labels sit inside the scaled SVG group and shrink with zoom. Collision force only accounts for circles, not text.
- Timeline draws every first-seen label with no collision pass.
- Unknown entity types fall into the final animal lane. Give Unknown its own lane or an explicitly named “Other / unclassified” group.
- The fixed lane stack can exceed the available height; the wrapper hides overflow and Y transforms are not applied. Provide vertical scrolling or intentional lane expansion.
- Tooltip positioning uses cursor coordinates plus a fixed offset without viewport clamping.
- Timeline accepts claims but does not render them. Do not describe claim evolution as already visible.
- The design spec still describes the rejected vertical stream and features beyond these implementations. Update it to distinguish shipped behavior from planned behavior.

## Proposed timeline experience

### Overview: Where did conversations happen?

Show compact session bands along the linear axis, with a quiet density histogram underneath. Category lanes contain small aggregates rather than all mention circles. Session labels can say “May 30 · 18 entities · 42 turns” using actual, separately computed counts.

Use existing session identity where available. If deriving episodes from inactivity gaps, label them as inferred episodes and keep membership stable across zoom levels. Daily chapter boundaries are not necessarily conversation-session boundaries. Generated episode titles should be distinguished from source text.

### Episode focus: What was discussed here?

Clicking an aggregate frames its time interval. Render one mark per entity per episode with a mention count. Pack marks vertically while retaining their true temporal anchors. Where a wide episode aggregate represents an interval, encode that interval rather than implying a single precise occurrence.

Expand the selected category when necessary. Keep unused categories collapsible. Do not squeeze every lane above the fold at the cost of legibility.

### Detail: What exactly was said?

At sufficient horizontal space, show individual mentions as small dots. A first encounter gets a distinct ring or diamond; do not make every mention inherit the entity's lifetime size.

Draw the selected entity's lifeline and its mention trail. Hide other entity lifelines by default: hundreds of lines on the same category center communicate little.

A hovered or keyboard-focused mention shows entity, speaker, timestamp, and a short verbatim excerpt. Selection pins the inspector. Preserve turnId as well as entityId so the drawer opens to the clicked occurrence; the current click emits only entityId.

## Label and packing rules for the implementing agent

1. Keep ordinary timeline dots approximately 3–5 CSS pixels in radius as an initial tuning range; use larger invisible hit regions or nearest-mark picking.
2. Compute layout in screen space after the time/zoom projection. Pack across all visible marks in a lane, sorted by timestamp with stable ID tie-breaking.
3. Preserve prior row assignments where possible. Repack at meaningful scale changes, not on every horizontal pan.
4. Cap rows. Represent unplaceable marks with a discoverable aggregate; expanding a cluster must still work for exactly coincident timestamps, where more horizontal zoom cannot separate them.
5. Run a separate label pass with measured text bounds and padding. Priority: selected, keyboard focus/hover, search matches, pinned entities, then locally important anchors.
6. Use an area-based label budget, not a fixed “top 10%” rule. Reserve readable labels for a manageable subset, with 12–13 CSS pixels as an initial target.
7. Keep accepted labels stable through small camera changes; use hysteresis around LOD thresholds. Transition aggregates without intercepting clicks with duplicate invisible marks.
8. Clamp tooltips and suppress graph hover while panning. Provide a searchable/list-based route to entities that does not require precise pointer targeting.

## Proposed constellation experience

Keep the galaxy, but give it navigational anchors.

- Default to a few legible entity or group labels, small subordinate nodes, and restrained halos. Reduce the decorative grid's prominence.
- Selecting an entity highlights its actual claim neighborhood, dims unrelated nodes, and opens provenance.
- Show “No recorded relationships” for an isolated entity. Offer “Mentioned together” as a separate, optional association layer.
- Distinguish asserted claims, co-mentions, and embedding similarity in both legend and inspection. Similarity is not a factual claim.
- Avoid constructing all pairwise links for a large conversation. Session hubs or bounded strongest associations are more readable.
- Group unconnected nodes by an explicit rule such as category or episode. Label the grouping so proximity does not falsely imply discovered semantics.
- Use the same category colors, selection ring, label treatment, and inspector as Timeline.
- Treat canonicalization as a parallel data-quality track: reversible alias grouping, retained source labels, and user review of uncertain merges.

The embedding-provider work may eventually support a similarity view, but it is not a prerequisite for this visualization repair.

## Shared time and cross-view continuity

Separate three pieces of state:

| State | Meaning |
|---|---|
| cursorTime | The inspected moment |
| visibleTimeRange | The interval shown by the timeline camera |
| replayCutoff | Optional “known by this time” filter |

Default Timeline exploration can show the whole history while the cursor navigates it. Explicit replay applies the cutoff consistently across both views. If retaining cutoff filtering as the default, make that mode visible.

Replace the crowded scrubber pins with a binned activity overview and draggable viewport brush. Retain chapter markers as sparse landmarks. Clamp both their displayed position and emitted timestamp. Prefer source-time intervals over summary creation time when placing retrospective chapters.

During scrub dragging, update camera position directly per animation frame; do not queue long easing transitions. Playback can interpolate smoothly. Manual pan suspends follow, and a visible control resumes it. Stop playback on direct scrub input and character change. Offer session-step navigation rather than only fixed one-day jumps.

Switching views must preserve character, filters, entity selection, selected occurrence, cursor, and each view's camera. Frame the selected entity's relevant episode when entering Timeline; restore its spatial neighborhood when returning.

A short crossfade with the selected entity anchored is sufficient initially. Avoid morphing one entity node into hundreds of mentions without explaining the one-to-many mapping. Later, animate only the selected entity into its occurrences. Honor reduced-motion settings.

## Alternative models

| Model | Useful role | Limitation |
|---|---|---|
| Session timeline + density overview | Recommended main chronological view | Requires meaningful aggregation and drill-down |
| Calendar heatmap | Long-history date navigation | Cannot explain entity relationships alone |
| Entity-by-session matrix | Optional “Compare” view for recurring topics | Less spatially expressive; rows need filtering |
| Git-style DAG | Explicit claim revision / supersession history | Branch structure is misleading for ordinary mentions |
| Audio-style waveform | Activity density overview | Must explain whether height means turns, mentions, or entities |

## Implementation order and acceptance criteria

**First:** repair temporal derivation, camera coordinates, same-count filter updates, and Unknown classification.
**Second:** add label culling, smaller mention marks, focused lifelines, vertical scrolling, and session aggregation.
**Third:** add viewport brush, follow behavior, persisted layouts/cameras, and cross-view continuity.
**Later:** similarity layers, richer revision exploration, and optional temporal distortion.

Acceptance scenarios:

- An entity first mentioned June 3 is absent during May 30 replay; counts and claims obey the documented temporal contract.
- At least 25 entities at the exact same timestamp remain discoverable without overlapping permanent labels or lane spill.
- Long labels, Unknown entities, empty filters, and a single timestamp remain usable.
- Focus/recenter works after multiple pans and zooms, with the inspector open and closed.
- Equal-count category/search changes render the correct IDs and labels.
- Switching views and returning retains selection and the prior camera/layout.
- Smaller windows can reach every lane; keyboard users can inspect entities and occurrences.
- Rapid character changes do not leave the previous character's selection, timer, or layout active.
- Profile with the actual 277-entity/514-source data and a larger occurrence-heavy fixture. Count visible marks, not only entities. First remove offscreen work, repeated sorting, and unnecessary simulation restarts; choose Canvas only if measurement justifies it.

Validation scope: these are source-backed findings and proposed acceptance checks. They have not been executed against the running desktop application.

