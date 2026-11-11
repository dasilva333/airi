# @proj-airi/motion-choreography

Acoustic DSP rhythm analysis, FlowMDM 3D dance prompt synthesis, and real-time beat-synchronized kinematic conductor for AIRI.

---

## 📖 Canonical Architecture

Full subsystem design, mathematical loop specifications, and musical phrasing engine are documented in:
👉 **[`docs/design-motion-choreography.md`](../../docs/design-motion-choreography.md)**

---

## 📦 Subsystems

1. **The Identifier (`src/dsp/`)**:
   - `decodeWav` / `encodeWav`: Zero-dependency PCM WAV codec.
   - `computeMagnitudeSpectrum` / `computeSpectralCentroid`: Cooley-Tukey Radix-2 FFT and psychoacoustic brightness tracking.
   - `analyzeAudioBuffer`: Autocorrelation tempo tracking (BPM) with human locomotion prior, subharmonic octave disambiguation, and metric accent covariance ($3/4$ waltz vs $4/4$ quadruple meter).
   - `synthesizeDanceBrief`: Injects persona movement primitives (`idol`, `gothic_maid`, `cool_android`, `none`) for FlowMDM diffusion.

2. **The Key-Pose Extractor (`src/kinematics/`)**:
   - `extractKeyPosesFromHumanML3D`: Detects kinetic velocity minima, extension maxima, and foot-strikes with temporal non-maximum suppression (NMS) from 263-dim HumanML3D tensors.
   - `quatSlerp` / `vec3Lerp`: Normalized quaternion spherical interpolation with antipodal flipping.

3. **The Conductor (`src/conductor/`)**:
   - `alignDanceSheetToBeats`: Monotonic elastic time-warping mapping poses onto musical downbeats.
   - `evaluateWarpedPoseAt`: Continuous 60 FPS pose evaluation with non-linear phase shaping (`smooth_step`, `cubic_elastic`, `linear`).

4. **Interactive CLI (`src/cli.ts`)**:
   - `pnpm -F @proj-airi/motion-choreography listen`: Real-time 30 FPS ANSI terminal VU meters, 4-band spectrum, psychoacoustic tilt gauge, metric cadence lights, and TypeSafe Jev System-1 genre resolution.

---

## 🧪 Testing

```bash
pnpm -F @proj-airi/motion-choreography test
```

All 31+ unit tests execute in under 500ms using zero-binary mathematical synthetic audio buffers (`tests/synthetic-audio.ts`) and synthetic motion tensors (`tests/synthetic-motion.ts`).
