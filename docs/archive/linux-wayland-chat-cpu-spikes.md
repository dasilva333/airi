# Diagnostic Report: Linux Wayland CPU Spikes & Chat History Bottlenecks

**Status:** Under Investigation / Documented for Reference
**Impacted Environment:** Linux (KDE Neon/KWin Wayland), AMD GPUs (e.g., RX 7900 XT), Native Wayland sessions
**Collaborators:** JC Denton, Richy (dasilva333)

---

## 1. Symptoms & Observed Behavior

1. **CPU Spikes & UI Lag:** When opening menus or rendering the chat window in Electron, CPU usage spikes heavily and the interface lags.
2. **Fresh Load vs. Imported Chat Log:**
   - A clean installation with empty history does **not** experience the CPU spikes.
   - The spikes begin immediately once a large chat log is imported.
   - Clearing the chat history (or consolidating history into long-term memory and then clearing the active log) immediately stops the CPU spikes.
3. **Execution Profile:** JS execution time in the renderer profile is minimal (~30ms), meaning the CPU is not executing infinite user-land JavaScript loops. Instead, the CPU is pinned in the rendering/layout/paint pipeline.
4. **Desktop Environment Sensitivity:**
   - The issue occurs under **native Wayland sessions** (specifically KWin Wayland).
   - Logging out of Wayland and running a native **X11 desktop session** stops the CPU spikes entirely, but sacrifices HDR support, correct 4K display scaling, and breaks color spaces for other applications.

---

## 2. Root Cause Analysis (Investigated Paths)

### A. Rendering/Reflow Paint Storm in Vue Renderer (Primary Vector)
The bottleneck is triggered specifically when the chat history list renders many message bubbles. Under Chromium/Wayland:
- Transparent layered windows combined with CSS effects (e.g., `backdrop-blur`, complex shadows, filters) require expensive compositor redraws.
- High numbers of DOM nodes representing chat bubbles trigger layout recalculations, causing Chromium to enter a paint storm loop when composition parameters change.

### B. Chromium Ozone/Wayland Color Management Loop
Chromium's Ozone-Wayland color manager has known bugs syncing color spaces (e.g., sRGB/BT709 descriptions) for transparent overlay windows on Wayland compositors:
- Because the floating avatar/tamagotchi requires transparent desktop window overlays, Chromium constantly attempts to renegotiate color descriptions with the compositor.
- This renegotiation loop spikes the CPU.

### C. Electron Sandbox / GPU Node Access Restrictions
When Electron is configured with `sandbox: true` (which is enabled on our hardened fork), sandboxed helper processes are restricted from accessing GPU driver nodes (e.g., `/dev/dri/renderD128`):
- The sandbox blocks access to the native Wayland color management protocols, triggering fallback loops and `wayland_wp_color_manager` errors.
- Disabling the sandbox (see diagnostics below) is verified, but in this specific case did not fully halt the CPU spike, suggesting it is a secondary aggravating factor rather than the sole root cause.

---

## 3. Diagnostic & Troubleshooting Steps Run

### Environment Variables & CLI Arguments (Forcing XWayland)
To bypass native Wayland color managers, forcing Electron to run via **XWayland** was tested:
```bash
# Force Electron to fallback to X11 backend (runs under XWayland)
ELECTRON_OZONE_PLATFORM_HINT=x11 pnpm dev:tamagotchi
```
*Result:* Bypasses native Wayland color manager loops. However, package runner argument swallowing can block parameters from reaching Electron directly if passed via standard scripts.

### Disabling the Sandbox
To rule out sandboxing restrictions blocking GPU/compositor nodes:
```bash
# Correct way to pass disable sandbox environment variables through the pnpm workspaces
ELECTRON_DISABLE_SANDBOX=1 pnpm dev:tamagotchi

# Or run the custom script pre-configured for Linux:
pnpm -rF @proj-airi/stage-tamagotchi run dev:linux
```
*Result:* Verified sandbox state did not fix the CPU spikes alone, confirming the core issue is rendering load from long chat logs under Wayland composition.

### Electron App Swapping (Experimental `index.ts` Hacks)
Hardcoding command line switches in Electron main process `index.ts`:
1. `app.commandLine.appendSwitch('ozone-platform', 'x11')`
   - *Result:* Stops CPU spikes, but breaks the Electron GUI layouts.
2. `app.commandLine.appendSwitch('disable-features', 'WaylandColorManagement')`
   - *Result:* No noticeable effect on CPU usage.

---

## 4. Recommendations for Future Remediation

1. **Virtualize Chat History List:**
   The `packages/stage-ui/src/components/scenarios/chat/history.vue` component should implement a virtual scroller (e.g., using `vue-virtual-scroller` or standard lightweight intersection observers). Only render visible chat bubbles in the DOM to keep node count low.
2. **Optimize UI CSS Overlays:**
   Reduce the usage of heavy CSS filters (`backdrop-blur` and complex drop-shadows) on elements that scale dynamically or exist in nested layers, particularly on transparent canvas layouts.
3. **Electron Version Parity:**
   Check if upgrading/downgrading the Electron dependency matches upstream versions where the Wayland color manager performance characteristics might differ.

## Relevant Skills

- [[airi-desktop-chatbox]]
