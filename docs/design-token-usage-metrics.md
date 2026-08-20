# Token Usage Metrics in airi_dasilva333

## Current State

### Data Storage
Token usage is currently stored in localStorage under the `settings/gemini/` namespace:
- `settings/gemini/voice-tokens`: Gemini Live Bidi session usage (44k in example)
- `settings/gemini/inference-tokens`: Global lifetime inference usage (~28M in example)
- `settings/gemini/grounding`: Grounding metadata toggle
- `settings/gemini/output-mode`: Audio output mode selector

### Key Misconception Cleared Up
**All previous UI references to "Gemini Island" or "Control Island" are deprecated**. These components no longer exist in the codebase. Any code that appears to display token metrics in those locations is inactive unused code that hasn't been removed yet.

### What Actually Displays Metrics Today
Currently, there is **no active UI** that displays the lifetime token metrics anywhere in the application. The 28M number exists purely in localStorage with no visual representation.

## Problem

The global lifetime token counter (`settings/gemini/inference-tokens`) is misleading because:
1. It's stored under a `gemini` namespace despite aggregating usage from **all providers** (OpenAI, Anthropic, etc.)
2. Users (including fork maintainers) have been accumulating stats under this misleading key
3. There's no way to view these metrics in the UI

## Proposed Solution

### 1. Rename Storage Keys
**Action**: Rename localStorage keys to remove provider-specific connotation:
- `settings/gemini/inference-tokens` → `settings/usage/global-tokens`
- `settings/gemini/voice-tokens` → `settings/usage/live-tokens`

**Why**: Maintains aggregation (no splitting) while fixing the misleading namespace. We want to track global inference, not per-provider breakdowns.

### 2. Chatbox Toolbar Display
**Location**: `InteractiveArea.vue` toolbar (next to context width pill)

**Implementation**:
- Add a "Lifetime" chip showing global token count
- Keep context width as "Session" (current session tokens)
- No conceptual conflation - both are token counts but different time scopes

**User Quote**: *"I never suggested or thought of conflating the two I merely point out they both represent a token count even if one is session based and the other one is lifetime based"* - This is the correct approach.

### 3. Control Strip Integration (Primary Focus)
**The New Control Strip** is the ever-present UI element that replaces deprecated islands. It has these capabilities:
- Customizable button placement/order
- Snap-to-edges functionality
- Customizable appearance (colors, etc.)
- Custom button behaviors

**Stats Button Implementation**:
1. **Button Display**: Shows current global token count (e.g., "28M")
2. **Customizer Integration**: Add "Reset Global Tokens" option in control strip customization dialog
3. **Interactive Features**:
   - Click to show popover with extended stats:
     - Global tokens (lifetime)
     - Live tokens (Gemini Live)
     - Estimated cost
     - Mini daily usage chart (time-series visualization)
   - Optional: Configurable cycling through different metrics
   - Optional: Time range selector (daily/weekly/all-time)

**Why Control Strip**:
- Ever-present visibility
- Users already customize it
- Natural place for stats
- Reset functionality accessible without digging through settings

### 4. Settings (MVP Exclusion)
**Action**: No dedicated "Settings > Usage" page for MVP. The control strip provides sufficient access.

## Implementation Plan

### Phase 1: Data Migration
1. Rename localStorage keys (with read migration for existing users)
2. Update live-session.ts to use new key names
3. Verify no other references to old keys exist

### Phase 2: Chatbox Toolbar
1. Add lifetime token chip to InteractiveArea.vue
2. Style to match existing context width pill
3. Ensure labels clearly distinguish "Session" vs "Lifetime"

### Phase 3: Control Strip Stats
1. Create new stats button component
2. Integrate into control strip customization system
3. Implement popover with:
   - Global/live token breakdown
   - Cost estimation
   - Mini chart (initially static, later dynamic)
4. Add reset functionality to control strip customizer

### Phase 4: Enhanced Stats (Future)
- Daily usage tracking
- Per-provider breakdown (optional)
- Export functionality
- Time range filtering in popover

## Technical Notes

### Chart Implementation
For the mini daily usage chart:
- Use a lightweight charting library (or simple SVG)
- Track daily token usage in new localStorage array
- Display last 7-14 days in popover

### Migration Strategy
```javascript
// On app load
if (localStorage.getItem('settings/gemini/inference-tokens')) {
  const globalTokens = localStorage.getItem('settings/gemini/inference-tokens')
  localStorage.setItem('settings/usage/global-tokens', globalTokens)
  // Mark as migrated to avoid duplicate
  localStorage.setItem('settings/gemini/_migrated', 'true')
}
```

### Control Strip Customizer Extension
Extend the existing control strip customization system to include:
- Stats button visibility toggle
- Stats button label customization
- Reset counter action in customizer dialog
- Optional: Cycling behavior configuration

## Conclusion
The solution focuses on:
1. Fixing the misleading storage namespace
2. Adding visible lifetime metrics where users naturally look (chatbox + control strip)
3. Leveraging the new control strip's flexibility for rich stats interaction
4. Maintaining global aggregation (no splitting)

The control strip emerges as the primary surface for stats due to its ever-presence and customization capabilities, making the 28M number impossible to miss while providing rich interaction possibilities.

## Relevant Skills

- [[airi-prefix-cache-alignment]]
