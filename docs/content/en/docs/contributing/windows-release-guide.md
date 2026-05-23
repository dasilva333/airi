# Stable Release & Build Guide

This document captures the lessons learned and the specific technical steps required to successfully build and release stable versions of the AIRI Electron application, particularly focusing on overcoming environment-related build failures.

## 1. Release Workflow

### Step 1: Generate & Review Release Notes
Do not proceed blindly. This is the implicit first step of the entire process.
1. **Compare Hashes**: Analyze all commits between the previous stable tag and `HEAD`:
   ```bash
   git log [previous-tag]..HEAD --oneline
   ```
2. **Draft Summary**: Focus on user-facing features (new UI, stability wins, feature additions) rather than internal refactors.
3. **Present Inline**: Present the gathered details and drafted notes **inline** to the USER for review and edits. Do not hide this in a "blind" artifact without showing it to the user first.
4. **Finalize**: Once approved, save the notes to a local, uncommitted file (e.g., `release-notes.md`).

### Step 2: Version Stamping
Update the `version` in `apps/stage-tamagotchi/package.json`. Follow the format: `[major].[minor].[patch]-stable.[YYYYMMDD]`.

### Step 3: Local Tagging
Create a git tag matching the version (with a `v` prefix) and push it to your fork or upstream:
```bash
git tag v0.9.1-stable.20260520
git push origin v0.9.1-stable.20260520
```

### Step 4: Build Windows Executable
Execute the build command from the `stage-tamagotchi` workspace:
```bash
pnpm -F @proj-airi/stage-tamagotchi run build:win
```
This runs `electron-builder --win` after performing necessary typechecks and production builds.

### Step 5: Publish to GitHub Releases
Use the `gh` CLI to create the release and upload the asset.


**Daily / Development Release (Target your fork):**
```bash
gh release create v0.9.1-stable.20260408 apps/stage-tamagotchi/dist/AIRI-0.9.1-stable.20260408-windows-x64-setup.exe --repo dasilva333/airi --title "AIRI v0.9.1-stable (April 8, 2026)" --notes-file release-notes.md
```

**Stable Release (Target upstream):**
Only target the upstream repository if you have write access and are performing an official release.
```bash
gh release create [tag] [artifact_path] --repo moeru-ai/airi --title "[Title]" --notes "[Notes]"
```

> [!IMPORTANT]
> **Authentication Scope**: Ensure your `gh` CLI session has the `workflow` scope. This is required for creating releases. If you see a "Failed to create release" error despite having permissions, run:
> `gh auth refresh -h github.com -s workflow`

---

## 2. Lessons Learned: Environment Conflicts

### The `node:crypto` Renderer Error
Electron renderer processes are browser environments. Many modern dependencies (like `@noble/hashes` or `better-auth`) accidentally pull in Node.js-specific bundles in production builds.

**Symptoms:**
- `Uncaught Error: Module "node:crypto" has been externalized for browser compatibility.`
- `Cannot access "node:crypto.webcrypto" in client code.`

**Solution:**
1. **Force Browser Aliases**: Map Node-specific packages to their browser equivalents in `electron.vite.config.ts`.
2. **Custom Shimming**: Implement a virtual `node:crypto` shim (e.g., `apps/stage-tamagotchi/src/renderer/shims/node-crypto.ts`) that maps `node:crypto.webcrypto` to `window.crypto`.

### DuckDB Environment Leakage
`@proj-airi/duckdb-wasm` (and its dependencies) may attempt to load Node.js-specific WASM loaders or bundles even in the renderer.

**Solution:**
Use a custom Vite plugin (e.g., `force-node-crypto-shim` in our config) to intercept `resolveId` and redirected any path like `bundles/default-node` to `bundles/default-browser`.

### Global Module Shimming
To prevent "leakage" of Node.js modules like `process`, `module`, and `path` into the renderer bundle:
1. Use the custom Vite plugin to catch imports starting with `node:` or common Node-only module names.
2. Redirect them to a virtual empty module or a safe constant-only shim.

---

## 3. Resilient Builds

To avoid build failures due to transient network issues (e.g., downloading VRM models or fonts):
- Use the `resilient` wrapper (found in `packages/stage-shared/src/ts/resilient.ts`) in build-time download plugins or scripts.
- This provides automatic retries and ensures the build can continue if at least one critical asset is present.

---

## 4. Troubleshooting

- **Alias Conflicts**: If an alias doesn't work, it might be due to relative path resolution within `node_modules`. Use **regex aliases** in Vite configuration to catch all variations.
- **Typecheck Failures**: If adding an alias breaks typechecks, ensure the shim file exports types compatible with the original module, or use `// @ts-ignore` sparingly in the shim itself.
- **File Locks**: If `electron-builder` fails with an `IOException` (e.g., "process cannot access the file app.asar"), it is likely that an instance of AIRI or a file watcher is locking the artifact. Refer to the process safety guidelines below.

---

## 5. Build Safety & Process Management

> [!CAUTION]
> **Strict Process Guidelines**:
> - **Never autonomously run `taskkill`** or similar commands without explicitly pausing and obtaining permission from the USER.
> - `taskkill` is **not** a standard part of the release process and should only be considered a last resort when manual coordination with the user fails.
> - If a file is locked (e.g., `app.asar`), ask the user to stop the relevant process; they will gladly stop and restart it to facilitate the build.
> - **"Nuking" all `node.exe` or `electron.exe` processes is never acceptable** for any reason, as it can cause data loss or terminate essential background services.

