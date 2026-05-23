# AIRI v0.9.1-stable (May 20, 2026)

Hotfix release resolving several stability regressions in the chat session system, timeline reactivity, and Windows backup pipeline.

## Bug Fixes

### 💬 Chat & Session Stability
- **Session Redirect Loop**: Resolved an infinite redirect loop that could occur when navigating between chat sessions.
- **0-Count Timeline Reactivity**: Fixed a reactivity issue where timeline entry counts displayed as 0 despite data being present.
- **Assistant Bubble Cleanup**: Removed stale markdown renderer logic from the assistant chat item component that was causing rendering inconsistencies.

### 🗄️ Backup Reliability
- **Windows Backup Failures**: Fixed a Windows-specific failure in the backup store pipeline that was preventing successful backup writes.
