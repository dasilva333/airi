# Stage-Mate Unity Source

This directory contains the custom C# scripts, editor build automation, scene definitions, animation controllers, and patches developed for AIRI's Stage-Mate integration.

## Layout

- `Assets/StageMate/`: Core sidecar implementation (`MateSidecar.cs`), automated headless builder (`MateSidecarBuild.cs`), lightweight empty companion scene (`MateSidecarScene.unity`), and procedural idle animations.
- `Assets/StreamingAssets/`: Mock configuration stubs for engine startup without native Steam/LLM dependencies.
- `Patches/`: Cross-platform patches for base Mate-Engine scripts (e.g. lifting Windows-only struct declarations in `AvatarHideHandler.cs` and `AvatarWindowHandler.cs` for macOS compilation).
- `ProjectSettings/`: Standalone macOS build settings specifying `MateSidecarScene.unity` as scene 0.
- `build.sh`: Automated macOS batchmode compilation script producing `Build/StageMate.app`.
