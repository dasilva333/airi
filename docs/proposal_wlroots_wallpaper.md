# PROPOSAL: wlroots Layer-Shell Wallpaper Integration

## Objective
Enable Project AIRI to render its full, interactive "Stage" as a desktop wallpaper on Linux Wayland compositors that support the `wlr-layer-shell` protocol (e.g., Sway, Hyprland, Wayfire). This provides a deeply integrated, "always-on" companion experience that lives behind user windows.

## 1. The Challenge: Electron & Layer Shell
Standard Electron `BrowserWindow` does not support the `wlr-layer-shell` protocol required to place a window on the wallpaper layer. While Electron can be set to "below" or "always on bottom," it remains a regular XDG-toplevel window and often interferes with workspace management or is hidden by "show desktop" actions.

## 2. Proposed Architecture: The Sidecar Strategy (KISS)
To maintain the "full" and "interactive" experience without hacking Electron's core, we will use a small native sidecar helper.

### The Sidecar: `airi-wallpaper-sidecar`
- **Language**: Rust (consistent with existing `crates/` in the repo).
- **Core Dependencies**:
    - `wry`: For a lightweight, native Webview.
    - `wayland-client` / `smithay-client-toolkit`: For native Wayland interaction.
    - `layer-shell` protocols: To request the `background` or `bottom` layer.
- **Functionality**:
    1.  Launched by the main AIRI Electron process.
    2.  Creates a Wayland window using `wlr-layer-shell`.
    3.  Sets the layer to `background` and anchors it to all edges (fill screen).
    4.  Loads the Airi Stage URL (e.g., `http://localhost:5173/#/actor`).
    5.  Forwards input events to the Webview to maintain interactivity.

## 3. Integration & Detection
The system will favor an "automatic but gated" approach.

### 1. Compositor Detection
Upon startup on Linux, AIRI will check for wlroots compatibility:
- Check `XDG_CURRENT_DESKTOP` for `Sway`, `Hyprland`, etc.
- (Optional) Use `wayland-info` to verify the presence of `zwlr_layer_shell_v1`.

### 2. Gated Activation
A new setting in `Settings -> System -> Linux` will provide:
- **Wallpaper Mode**: [Toggle] (Default: On if compatible compositor detected)
- **Behavior**: "Render Airi as a system wallpaper on compatible compositors."

AIRI will aim to use this mode by default when a compatible compositor is detected, while allowing the user to opt-out and return to a standard floating window if preferred. When active, the Electron app will hide the standard `Actor Stage` window and instead spawn the `airi-wallpaper-sidecar`.

## 4. Interaction Model
Since the user requested an **interactive** experience:
- The sidecar will be configured with `keyboard_interactivity` set to `none` (to avoid stealing focus from work) but `pointer_events` enabled.
- This allows the user to click the character to trigger expressions, chat, or access the Control Island directly on the desktop background.

## 5. Performance & Resource Considerations
- **Full Experience**: The sidecar runs a full Webview (WebKitGTK on Linux). While heavier than `glpaper`'s shader-only approach, it ensures 1:1 feature parity with the desktop app.
- **Visibility Optimization**: The sidecar can be instructed to "pause" or lower the framerate of the webview when the desktop is completely covered by other windows (if the compositor provides such hints).

## 6. Implementation Roadmap
1.  **Crate Setup**: Create `crates/airi-wallpaper-sidecar`.
2.  **Webview Implementation**: Use `wry` to load a test URL on the wallpaper layer.
3.  **IPC Bridge**: Implement a simple IPC (stdin/stdout or Unix socket) so Electron can tell the sidecar which URL to load or when to terminate.
4.  **UI Settings**: Add the toggle to the AIRI settings page.
5.  **Flake/Nix Update**: Ensure the new sidecar is built and bundled in the Nix package.

## 7. Reference Inspiration
- [glpaper](https://github.com/vi70x3/glpaper): For the `wlr-layer-shell` usage patterns.
- [wry](https://github.com/tauri-apps/wry): For the cross-platform webview bindings.
