---
title: Hacker Studio Avatar Modding
description: Inspect and edit VRM or Live2D textures in Avatar Appearance, then export a modified VRM or Live2D ZIP.
---

# Hacker Studio Avatar Modding

**Hacker Studio** is the built-in power-user workspace for examining avatar parts, tuning MToon materials, replacing or generating textures, and exporting a modified VRM, Live2D, or Spine bundle without external 3D software. It is the successor to V-HACK and L-HACK.

---

## 1. Accessing Hacker Studio

1. Open **Settings → Models** and select a VRM, Live2D, or Spine model.
2. Expand **Avatar Appearance** (VRM: after the model sections; Live2D/Spine: after Character Customizations).
3. Use the **Textures**, **Lab**, and **Parts** tabs. No developer toggle or shortcut is required.

The panel is docked in the controls rail so it does not cover the live preview. Adapter and session state live above the collapsible section, so collapsing Avatar Appearance does not discard your replacements. Live2D atlases are listed as `Atlas N`; Spine pages use their atlas page names. Parts and Material adjustments are hidden for Live2D/Spine in this pass.

---

## 2. Key Tools

### Textures

- Browse every glTF image in a two-column atlas grid.
- Search by texture or material name and filter to **All / Main / Shade** maps.
- Every card lists its material owners. A shared texture warns that a replacement affects all owners.

### Lab

Open a texture from the Textures tab to work on it:

- **Local editing** — download the original, edit it externally, then upload/drop a replacement. VRM accepts PNG/JPEG/WebP; Live2D and Spine accept PNG only. Validation runs before the live texture changes and warns about dimension mismatch, lost transparency, or non-PNG formats.
- **Promptcraft** — choose a style preset, write a prompt, and generate a replacement through the configured Artistry provider. UV-layout, seam, and transparent-area guidance is appended to the request only; the saved prompt is never rewritten.
- **Preview** — toggle a replacement on or off on the live avatar. The replacement remains stored per texture.
- **Replacement status** — shows the uploaded filename or “Generated replacement” and whether it is loaded in preview.
- **Material adjustments** — tune Rim Width, Shade Shift, and Additive Blending for the selected material.
- **Color eraser** — remove a picked background color from the current replacement and bake the result.

Late generation results are discarded if the texture changed while the request was running.

### Parts

- Search meshes and toggle individual parts.
- Use **Show all / Hide all** for bulk visibility.
- Ctrl+click a part to isolate it.

---

## 3. Export

### VRM

1. Make texture, material, or part changes.
2. Click **Export modified VRM**.
3. Hacker Studio rebuilds the GLB with the new texture buffer views and hidden-part surgery, then downloads a `.vrm` file.

### Live2D

1. Make atlas replacements.
2. Click **Download modified ZIP**.
3. Hacker Studio rewrites the replaced atlas pages inside the source ZIP and downloads a `<name>_HACK_<stamp>.zip` bundle.

Live2D export requires a ZIP-sourced model. If the model was loaded from a bare `model3.json`/sibling URLs, the button is disabled and the reason is shown. Live2D Parts/drawables and material adjustments are deferred; atlas pages are the current surface.

### Spine

1. Replace one or more atlas pages.
2. Click **Download modified ZIP**.
3. Hacker Studio rewrites the page images inside the selected variant’s source ZIP. Atlas metadata (including UV page size and PMA) is preserved; dimension changes are shown as a warning in the Lab.

Spine export also requires a ZIP source. Bare `.skel`/`.json` URLs show the disabled reason. Parts/slots and skin authoring are deferred.

> Hacker Studio writes raw texture bytes, not the preview gamma-compensated canvas. The preview compensation exists only to make the in-app swap match the re-imported VRM.
