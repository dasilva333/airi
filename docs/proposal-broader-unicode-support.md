# Proposal: Broader Unicode Support & Combining Mark Handling

This proposal addresses rendering issues and potential crashes when processing complex Unicode grapheme clusters—specifically stacked Combining Enclosing Marks (General Category `Me`)—across the application and downstream platforms (such as Discord).

---

## 1. Problem Description & Root Cause

When a base character is followed by multiple consecutive **Combining Enclosing Marks** (e.g., `U+20DD` Combining Enclosing Circle `⃝`), the rendering pipeline (typically HarfBuzz / Blink within Chromium or Discord's clients) fails to calculate correct positioning matrices, causing visual corruption or truncated glyph buffers.

### Technical Mechanics

1. **GPOS Lookup Constraints**:
   Standard combining diacritics use **Mark-to-Base** (GPOS Lookup Type 4) and **Mark-to-Mark** (GPOS Lookup Type 5) attachments to stack. Enclosing marks (`Me`) generally lack Mark-to-Mark definitions in common fonts. When multiple enclosing marks are stacked, they are positioned relative to the base character without proper offset propagation, causing geometry collisions.

2. **Font Fallback Cascading**:
   When the primary font lacks glyph support for enclosing marks, the shaper falls back to secondary fonts. Multiple consecutive marks can resolve to different fallback fonts, causing conflicting advance widths and layout matrices.

3. **Glyph Buffer Truncation**:
   Shaping engines place a hard limit on the number of combining marks allowed per cluster to prevent layout calculation loops. Exceeding this threshold can lead to glyph buffer truncation, rendering missing glyph boxes (``), or broken character combinations.

---

## 2. Proposed Solutions & Risk Analysis

### Option A: Application-Level Normalization (Deduplication)

This approach sanitizes strings before they are transmitted to external services (like Discord) or rendered in the local UI by deduplicating consecutive identical enclosing marks.

* **Target Unicode Enclosing Marks (Category `Me`)**:
  * `U+20DD` (Combining Enclosing Circle `⃝`)
  * `U+20DE` (Combining Enclosing Square `⃞`)
  * `U+20DF` (Combining Enclosing Diamond `⃟`)
  * `U+20E3` (Combining Enclosing Keycap `⃣`)
  * `U+20E4` (Combining Enclosing Upward Pointing Triangle `⃤`)

* **Implementation Detail**:
  Add a regex-based pre-processing step inside outbound and inbound text message pipelines:
  ```typescript
  export function sanitizeEnclosingMarks(text: string): string {
    // Matches 2 or more consecutive occurrences of U+20DD through U+20E4 and collapses them
    return text.replace(/([\u20DD-\u20E4])\1+/g, '$1')
  }
  ```

* **Risk & Safety Assessment**:
  * **Safety**: 🟢 **Extremely Safe**
  * **Impact**: Negligible execution overhead (microseconds on typical chat strings). It has zero side-effects on alphanumeric characters, standard emojis, and Zero-Width Joiner (ZWJ) sequences.
  * **Feasibility**: High. Easily added to existing message-sending utilities.

---

### Option B: Engine-Level Font and Shaper Configuration

This approach involves modifying the internal configuration of the rendering engine (e.g., HarfBuzz, Skia, or Chromium flags) inside the Electron process.

* **Implementation Detail**:
  Configuring the layout engine's cluster level and increasing limits using native shaper adjustments:
  ```cpp
  hb_buffer_set_cluster_level(buffer, HB_BUFFER_CLUSTER_LEVEL_MONOTONE_GRAPHEMES);
  ```

* **Risk & Safety Assessment**:
  * **Safety**: 🔴 **Extremely Dangerous**
  * **Impact**: Custom binary compilation and modifying underlying layout flags introduces instability, risk of memory leaks, and potentially breaks standard rendering behaviors for complex scripts (such as CJK, Arabic, or Indic languages).
  * **Feasibility**: Low. Closed-source downstream platforms like Discord cannot be modified, making this ineffective for outbound message corruption.

## Relevant Skills

- [[airi-i18n-localization]]
