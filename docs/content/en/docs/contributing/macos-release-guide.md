# macOS Stable Release & Build Guide

This document captures the specific technical steps required to successfully build and release stable versions of the AIRI Electron application on macOS.

## 1. Release Workflow

### Step 1: Version Stamping
Update the `version` in `apps/stage-tamagotchi/package.json`. Follow the format: `[major].[minor].[patch]-stable.[YYYYMMDD]`.

### Step 2: Local Tagging
Create a git tag matching the version (with a `v` prefix) and push it to your fork or upstream:
```bash
git tag v[version]
git push origin v[version]
```

### Step 3: Generate Release Notes
1. **Compare Hashes**: Look at all commits between the previous stable tag and `HEAD`:
   ```bash
   git log [previous-tag]..HEAD --oneline
   ```
2. **Draft Summary**: Focus on outward-facing user features (e.g., new buttons, UI improvements, stability wins).
3. **Save to File**: Save to `release-notes.md`.

### Step 4: Build & Publish (Automated Utility)

Since macOS packages do not require interactive smoke tests before uploading, the compilation and release upload steps are unified into a single command. It handles pulling latest tags, building the app, detecting the compiled `.dmg`, verifying the GitHub release, and uploading the asset.

Simply run:
```bash
pnpm run release:mac
```

---

### Step 5: Manual Alternative / Verification

If you prefer or need to run individual steps manually:

1. **Build macOS Executable**:
   Execute the build command from the `stage-tamagotchi` workspace:
   ```bash
   pnpm -F @proj-airi/stage-tamagotchi run build:mac
   ```
   This runs `electron-builder --mac` and generates a `.dmg` and a `.app` in `dist`.

2. **Publish to GitHub Releases**:
   Use the `gh` CLI to create the release and upload the asset, using the local authentication keyring:
   ```bash
   GITHUB_TOKEN="" GH_SSL_NO_VERIFY="true" gh release upload [tag] apps/stage-tamagotchi/dist/AIRI-[version]-darwin-arm64.dmg --repo dasilva333/airi --clobber
   ```

---

## 2. macOS Specific Considerations

### Notarization & Entitlements
For the app to run on other machines without security warnings:
- **Entitlements**: Specified in `build/entitlements.mac.plist`.
- **Notarization**: Handled by GitHub Actions via `CSC_CONTENT` and `APPLE_ID`. If building locally, ensure your Apple Developer certificate is in your keychain.

### Architecture Support
The project supports both `arm64` (Apple Silicon) and `x64` (Intel).
- Build arm64: `electron-builder --mac --arm64` (default in `pnpm run build:mac` on Apple Silicon).
- Build x64: `electron-builder --mac --x64`.

### Dynamic Permissions
Ensure `extendInfo` in `electron-builder.config.ts` includes `NSMicrophoneUsageDescription` and `NSCameraUsageDescription` so macOS prompts the user correctly.

---

## 3. Troubleshooting & Past Roadblocks

If the `build:mac` command fails, check the following common issues:

### Node Version Mismatch
- **Symptoms**: Installation warnings or runtime errors related to lockfile sync.
- **Cause**: Strict `engines` requirement in the root `package.json` (previously capped at `<=25.0.0` while the environment had `v25.6.0`).
- **Resolution**: Ensure the engine requirement in `package.json` allows the current system's Node version (currently updated to support `<26.0.0`).

### Strict TypeScript Errors (TS6133)
- **Symptoms**: The build typecheck steps crash with code warnings about unused imports or variables.
- **Cause**: Unused variables/imports in files like `src/renderer/pages/settings/modules/mcp.vue`.
- **Resolution**: Clean up or comment out unused imports/variables, as typechecking is strictly enforced before build.

### Vue Template Compilation Errors
- **Symptoms**: `[unplugin-vue-named-template-pre] Element is missing end tag.` or similar template compile issues.
- **Cause**: Missing matching closing tags in Vue template files (e.g., `index.vue`).
- **Resolution**: Run `pnpm run typecheck:web` locally to locate and correct any template syntax or tagging issues.

