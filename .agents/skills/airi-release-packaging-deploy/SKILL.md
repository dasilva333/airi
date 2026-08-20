---
name: airi-release-packaging-deploy
description: Use when shipping AIRI artifacts or deploying services — stable-release workflow (version stamping, git tag, release notes, pnpm release:win / release:mac publish scripts), electron-builder packaging for Windows/macOS/Linux (exe/zip/dmg/deb/rpm/flatpak), the release-tamagotchi.yml CI matrix (nightly schedule, workflow_dispatch, SignPath code signing, Apple notarization via CSC_CONTENT/APPLE_ID, latest*.yml auto-update feeds), Android APK and iOS IPA packaging of apps/stage-pocket via Capacitor (cap sync, gradle assembleRelease, Xcode archive), Docker/OCI images of stage-web on ghcr.io, docs deployment to GitHub Pages, Cloudflare edge-worker deployment (apps/stage-edge), or gh CLI release-upload auth quirks.
---

# AIRI Release, Packaging & Deploy

Deployment surface map for shipping AIRI. Desktop releases are manual + script-assisted on the fork; Electron CI builds cover Win/macOS/Linux; mobile (stage-pocket) is Capacitor-based and currently the least automated; stage-web ships as Docker/OCI; edge workers deploy per-user via Cloudflare.

## 1. Surface Map

| Surface | App | Artifacts | Ship path |
|---|---|---|---|
| Windows | `stage-tamagotchi` | `AIRI-<ver>.exe` + `.zip` (portable) | Local: `pnpm run release:win` (fork `dasilva333/airi`) · CI: `release-tamagotchi.yml` |
| macOS | `stage-tamagotchi` | `AIRI-<ver>.dmg` (arm64 + x64) | Local: `pnpm run release:mac` · CI: same workflow (notarized) |
| Linux | `stage-tamagotchi` | `.deb`, `.rpm`, `.flatpak`, AppImage | CI only (`release-tamagotchi.yml`, incl. Flatpak via flathub SDK) |
| Android | `stage-pocket` | `.apk` / `.aab` | Manual Capacitor + Gradle; no release automation exists |
| iOS | `stage-pocket` | `.ipa` | Manual Capacitor + Xcode archive; no release automation exists |
| Web | `stage-web` | `ghcr.io/<repo>` OCI image | `release-docker.yaml` on any tag push |
| Docs | `docs/` (VitePress) | static site | `deploy-docs.yml` → GitHub Pages (`/airi/`) |
| Edge relay | `apps/stage-edge` | Cloudflare Worker (per-user) | Built into users' accounts via OAuth PKCE during onboarding; see `airi-cloud-relay-infrastructure` skill |
| Stage-Mate | `apps/stage-mate` | Unity `StageMate.app/.exe` | See `airi-stage-mate-unity` skill (`build:win/linux/mac`) |

## 2. Desktop Stable Release (Windows & macOS)

Canonical references: **`docs/content/en/docs/contributing/windows-release-guide.md`** and **`docs/content/en/docs/contributing/macos-release-guide.md`**. The workflow unified by `scripts/release/publish-win.js` / `publish-mac.js`:

1. **Release notes first.** `git log [previous-tag]..HEAD --oneline`; draft user-facing notes inline for USER review/approval; save to `release-notes.md` (uncommitted).
2. **Version stamp.** `apps/stage-tamagotchi/package.json` → `[major].[minor].[patch]-stable.[YYYYMMDD]`.
3. **Tag.** `git tag v<version> && git push origin v<version>` (fork remote; never touch upstream without authorization).
4. **Build + publish.** `pnpm run release:win` or `pnpm run release:mac`.
   - Windows supports `--build-only` (stop after build for smoke test, then `pnpm run release:win --upload-only`) since Win installers need interactive smoke testing; macOS uploads directly.
   - Both scripts: `git -c http.sslVerify=false pull && fetch --tags --force`, warn if version date-stamp ≠ today (multi-machine drift: someone forgot to push), physical `node_modules` override cleanup (discord.js/undici/ws etc. copied packages removed before Vite bundling), `NODE_OPTIONS=--max-old-space-size=12288`, `GH_SSL_NO_VERIFY=true`, `GITHUB_TOKEN` deleted so `gh` falls back to keyring auth, artifact discovery (`AIRI-<ver>*.exe|zip` / `.dmg`), release creation/upload to `--repo dasilva333/airi --clobber` using `release-notes.md` if present.
5. **Manual fallback:** `pnpm -F @proj-airi/stage-tamagotchi run build:win|build:mac`, then `GITHUB_TOKEN="" GH_SSL_NO_VERIFY="true" gh release upload [tag] <artifact> --repo dasilva333/airi --clobber`.

### Windows-specific
- Always ship the portable `.zip` alongside the `.exe` (WDAC/AppLocker/SmartScreen blocks unsigned installers). CLI error "An Application Control policy has blocked this file" → advise Properties→Unblock, `Unblock-File`, admin run, or the zip.
- Code signing for the `.exe` is a standing action item (see guide §6).
- `app.asar` / `airi.exe` file locks are pre-checked by the script; if locked, ask the USER to close the holding process. **Never run `taskkill` autonomously** per the guide's hard rule.

### macOS-specific
- `build:mac` produces `.dmg` + `.app` in `apps/stage-tamagotchi/dist`; arch flags `--arm64` (default on Apple Silicon) / `--x64`.
- Notarization entitlements in `build/entitlements.mac.plist`; CI uses `CSC_CONTENT` + `APPLE_ID` secrets; local builds need the Apple Developer cert in keychain.
- `electron-builder.config.ts` `extendInfo` must keep `NSMicrophoneUsageDescription` + `NSCameraUsageDescription`.

## 3. Electron CI / CD (`.github/workflows/release-tamagotchi.yml`)

Triggers: `release: prereleased` (auto-publish), `workflow_dispatch` (manual, `build_only` / `artifacts_only` / `tag` / platform filter), nightly `schedule` (cron `0 0 * * *`).

Build matrix: `windows-latest` (x64 setup), `macos-15-intel` (x64) + `macos-26` (arm64, Xcode 26.2), `ubuntu-latest` (x64) + `ubuntu-24.04-arm` (arm64, deb/rpm + **flatpak** via `ai.moeru.airi.flatpak.yml` + flathub SDK).

- Publish policy: `--publish=onTagOrDraft` for release events, `never` for build/artifacts-only runs; artifacts uploaded via `softprops/action-gh-release` including `latest.yml` / `latest-*.yml` auto-update feeds; `merge-mac-latest` job merges x64+arm64 `latest-mac.yml`.
- **Windows signing:** SignPath signing requests on `moeru-ai/airi` only (`test-signing` policy, `ci-github-actions-artifacts-windows` config); on the fork this step is skipped by the repo guard.
- **macOS signing:** base64-decoded `CSC_CONTENT` → `apple-developer-code-signing.p12`; notarization via `APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD` / `APPLE_TEAM_ID`.
- Linux runners run `jlumbroso/free-disk-space` first (historic "No space left" archive failures).

## 4. Mobile: Android APK & iOS IPA (`apps/stage-pocket`)

Capacitor app (config `capacitor.config.ts`: appId `ai.moeru.airi-pocket`, appName `AIRI`, `webDir: 'dist'`). **The `android/` and `ios/` native projects ARE tracked in git** (unlike stage-mate's gitignored clone) — commit legitimate native edits, but treat `cap`-regenerated files (e.g. `android/capacitor.settings.gradle`, "DO NOT EDIT" header) as generated noise unless a plugin list actually changed.

### Dev loop
- `pnpm -rF @proj-airi/stage-pocket run dev:ios` (= `cap-vite -- ios`, the in-repo `packages/cap-vite` tool: Vite dev server + `cap run` live reload; `CAPACITOR_DEV_SERVER_URL` env drives the capacitor dev-server config). Full CLI: `cap-vite [vite args] -- <ios|android> [cap run args]`.
- **`dev:android` is missing** from stage-pocket's `package.json` — root `dev:pocket:android` invokes it and fails. Develop Android via `cap-vite -- android` directly or the manual flow below.
- Root convenience: `pnpm run open:ios` (= `cap open ios`).

### Android APK/AAB (manual, no release script)
1. `pnpm -F @proj-airi/stage-pocket run build` — Vite web bundle → `dist/`.
2. `pnpm -F @proj-airi/stage-pocket exec cap sync android` — copies web assets + plugin wiring into the Gradle project.
3. Build: from `apps/stage-pocket/android`: `./gradlew assembleRelease` → `app/build/outputs/apk/release/app-release.apk` (AAB: `bundleRelease`).
4. **Signing is conditional** (`app/build.gradle`): release is signed only when credentials exist — `android/keystore.properties` (copy of `keystore.properties.example`, gitignored) or env vars `AIRI_KEYSTORE_FILE` / `AIRI_KEYSTORE_PASSWORD` / `AIRI_KEY_ALIAS` / `AIRI_KEY_PASSWORD` (env wins). Without credentials the APK is unsigned — fine for sideload/debug-install, but the Play Store requires a signed AAB (`bundleRelease`). Generate a keystore once with `keytool -genkey -v -keystore airi-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias airi`; the keystore file itself (`.jks`) is gitignored — back it up securely, losing it loses store update continuity.
- Facts: applicationId `ai.moeru.airipocket`, `minSdkVersion 24`, `targetSdkVersion`/`compileSdkVersion 36`, `versionCode 1` / `versionName "1.0"` (`app/build.gradle`).
- `capacitor.settings.gradle` hard-codes `.pnpm` store paths for `@capacitor/android`, `@capacitor/local-notifications`, `capacitor-native-settings` — it breaks when versions bump until `capacitor update` / `cap sync` regenerates it (`pnpm install --frozen-lockfile` keeps paths stable across machines).

### iOS IPA (manual, macOS + Xcode required)
1. Same web build + `cap sync ios`.
2. Open `ios/App/App.xcodeproj` in Xcode (or `xcodebuild`): set signing team & bundle id `ai.moeru.airi-pocket`.
3. **Archive** (Product → Archive) → **Distribute App** (App Store Connect / Ad Hoc / Development) for the `.ipa`. No `ExportOptions.plist` / distribution automation exists in-repo yet.
4. Versioning lives in Xcode project: `MARKETING_VERSION` (CFBundleShortVersionString) and `CURRENT_PROJECT_VERSION` (CFBundleVersion).
- `Info.plist` (tracked): mic + speech-recognition usage descriptions (`NSMicrophoneUsageDescription`, `NSSpeechRecognitionUsageDescription`), `NSAllowsArbitraryLoads: true` (LAN/local model HTTP), `ITSAppUsesNonExemptEncryption: false`, iPhone-only, portrait+landscape.
- `lint:swift` runs swiftlint over `ios/` (`swiftlint.yml` present).

### Mobile version discipline
`stage-pocket` has its own semver in `package.json` (`0.9.1-stable.<date>`) but Android `versionCode` and iOS build numbers are managed separately — bump both whenever distributing a new build to the same channel.

## 5. Web / Docker / Docs / Edge

- **Docker:** `release-docker.yaml` → on any tag push or manual dispatch, builds `ghcr.io/<repo>` from `apps/stage-web/Dockerfile` for `linux/amd64,linux/arm64,linux/arm64/v8` with GHA cache. Tag scheme: semver from `v*` tags (`latest`, `X.Y.Z`, `X.Y`, `X` when not `v0.*`).
- **Docs:** `deploy-docs.yml` → on push to `main` touching `docs/**`, VitePress build (`BASE_URL=/airi/`) → GitHub Pages artifact deploy.
- **Edge relay:** `apps/stage-edge` is NOT centrally deployed — each user provisions their own Cloudflare Worker + KV + R2 via OAuth PKCE during onboarding (CloudflareStageDeployer). See the `airi-cloud-relay-infrastructure` skill for maintainer-side flows.

## 6. Common Pitfalls

- **`node:crypto` externalization in renderer builds.** Symptom: `Module "node:crypto" has been externalized for browser compatibility`. Fix lives in `electron.vite.config.ts` browser aliases + `src/renderer/shims/node-crypto.ts` shim; DuckDB leaks `bundles/default-node` into renderer — intercepted via the `force-node-crypto-shim` resolveId plugin. Same vector for `process`/`module`/`path` leaks. (windows-release-guide §2.)
- **Release date-stamp mismatch warning.** If publish scripts warn the version date differs from today, another machine/agent likely forgot to push — sync tags before re-running, don't override blindly.
- **Invalid `GITHUB_TOKEN` env overrides keyring** causing 401s on `gh release create`; always clear it for release commands. `gh` needs `workflow` scope: `gh auth refresh -h github.com -s workflow`.
- **Engines:** root requires Node `>=20.14.0 <28.0.0`, pnpm `>=10`. macOS guide documents past lockfile failures when Node outpaced the cap.
- **Build-breaking strictness:** TS6133 unused imports fail the pre-build typecheck; broken Vue template end-tags fail with `unplugin-vue-named-template-pre` — run `pnpm run typecheck:web` to localize.
- **Resilient asset downloads:** build-time font/model fetches should use `packages/stage-shared/src/ts/resilient.ts` retry wrapper to survive flaky networks.
- **taskkill ban:** never kill `node.exe`/`electron.exe` en masse to unstuck builds; coordinate with the user instead (guide §5, CAUTION).
- **Fork vs upstream asymmetry:** the release scripts target `dasilva333/airi`; SignPath signing and several CI guards only fire on `moeru-ai/airi`. Don't assume parity.
- **Android/iOS release automation does not exist.** Any "release pocket" request means manual gradle/Xcode steps plus signing decisions — confirm with the user which channel (sideload/ad-hoc/store) before proceeding.

## When to Use

- Running or troubleshooting `release:win` / `release:mac`, version stamping, tagging, release-note drafting.
- Interpreting or fixing `release-tamagotchi.yml`, `release-docker.yaml`, or `deploy-docs.yml`.
- Electron-builder config, signing/notarization, artifact naming (`artifacts-metadata.ts`, `rename-artifacts`).
- Building stage-pocket APK/AAB/IPA, capacity/Capacitor sync problems, native-project git hygiene.
- Any "why did the build fail" involving renderer Node-module leakage, disk space, or file locks.

## Verification

- Desktop local release: the publish scripts re-verify tag/artifact existence themselves; a successful run ends with the GitHub release URL printed and the artifacts visible there.
- Build-only validation without release: `pnpm run release:win --build-only` (smoke test window), or `pnpm -F @proj-airi/stage-tamagotchi run build:win|build:mac` for compile-level confidence. Typecheck/build per the `airi-codebase-verification` skill before any push.
- Mobile: APK sanity = install on device/emulator (`adb install`); IPA = Xcode archive log + installed app run. No CI covers pocket yet — state this explicitly when asked to "reproduce CI" for mobile.
- After any file modification: `git status` and report open/unstaged files verbatim.

### Authoritative Documents

- [docs/content/en/docs/contributing/windows-release-guide.md](docs/content/en/docs/contributing/windows-release-guide.md) — Windows stable-release workflow, lessons learned, WDAC/codesign action items, build-safety rules.
- [docs/content/en/docs/contributing/macos-release-guide.md](docs/content/en/docs/contributing/macos-release-guide.md) — macOS release workflow, notarization/entitlements, troubleshooting.
- [docs/delivery/AIRI-customer-deployment-guide.zh-CN.md](docs/delivery/AIRI-customer-deployment-guide.zh-CN.md) — customer-facing deployment guide (zh-CN).
- `.github/workflows/release-tamagotchi.yml` · `.github/workflows/release-docker.yaml` · `.github/workflows/deploy-docs.yml` — automation surfaces described above.
- [docs/rosetta-stone.md](docs/rosetta-stone.md) — repo layout & persistence references for anything release-adjacent.

## Related Skills & References

- **Peer Skills**: [[airi-cloud-relay-infrastructure]], [[airi-codebase-verification]], [[airi-stage-mate-unity]]
- **Key Documents**: [[windows-release-guide]], [[macos-release-guide]], [[release-notes]], [[zh-CN]], [[rosetta-stone]]
