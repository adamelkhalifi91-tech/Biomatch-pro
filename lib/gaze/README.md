# `lib/gaze` — Ocular integrity pipeline (Phase 1)

Client-side gaze estimation and quality gating for BioMatch's asynchronous
proctoring. Zero backend calls. MediaPipe FaceMesh (`refineLandmarks: true`,
iris model enabled) remains the only detector.

This module replaces the ad-hoc inline math that previously lived in `App.jsx`
and `utils/faceMeshEngine.js` with a typed, tested, documented pipeline.

---

## Answers to the three inspection questions

**1. Test runner.** None was configured. Added **Vitest 2** (`npm test`) plus
**TypeScript 5** and **@types/react** / **@types/react-dom** for the strictly-
typed modules and `.tsx` components. All are dev-only: the prompt explicitly
permits adding the test runner, and TypeScript + the React type packages are the
zero-runtime companions required to honour the "strict TS, no `any`" directive
for `.ts`/`.tsx` files. esbuild (already present via Vite) transpiles the
sources, so there is no runtime weight. The legacy `.jsx` app is untouched by
`tsconfig` (`allowJs` is off) — `npm run typecheck` audits only `lib/gaze` + the
proctoring components.

**2. Target rectangle.** The "prueba" is **the full mobile-frame panel**, not a
sub-component. `App.jsx` renders the entire flow inside a centred
`maxWidth: 420px × 100dvh` container; `ScreenPrep`/`ScreenRecording` fill it at
`width:100% height:100%`. There is no inner bounding box to track against — the
gaze rectangle is the panel viewport itself, addressed in **percentage
coordinates `[0,100] × [0,100]`** (matching the existing calibration targets).
The off-screen logic therefore tests the centroid against the `[0,100]` box. If
a future revision moves the question/answer area into a smaller component, pass
its `getBoundingClientRect()` (mapped into the same `%` space) as the target
rectangle to `isOffScreen`.

> Note on form factor: this is a **~420px-wide** layout, i.e. a narrow angular
> span (~10–14° horizontal at 50–60 cm). Gaze error in degrees maps to a large
> fraction of this small screen, which is exactly why temporal smoothing,
> fixation-based off-screen detection, and a head-pose-aware polynomial matter
> more here than on a desktop monitor.

**3. Mirroring / canonical coordinate space.**

> **CANONICAL FEATURE SPACE = raw MediaPipe normalized image coordinates from
> the NON-MIRRORED hidden `<video>` element.** Origin top-left, `x` increases to
> image-right, `y` increases downward, both in `[0,1]`.

FaceMesh runs on `App.jsx`'s hidden `sharedVideoRef` video, which carries **no**
CSS transform — it sees the raw sensor image. The *displayed* preview videos in
`ScreenPrep`/`ScreenRecording`/`ScreenCalibration` use `transform: scaleX(-1)`
**purely for selfie comfort**; that mirroring never touches the feature
pipeline. The gaze dot overlay is positioned in ordinary CSS `%` space (not
mirrored).

Because calibration learns the feature→screen mapping from the *same*
non-mirrored source used at runtime, the polynomial absorbs the sign convention
automatically and the dot lands correctly on the mirrored backdrop.

**Sign convention.** `fx > 0` ⇒ iris displaced toward **image-right** relative
to the eye centre; `fy > 0` ⇒ iris displaced **downward**. In raw
(non-mirrored) space, `fx > 0` corresponds to the subject gazing toward *their
own left*. **Do not** feed mirrored coordinates into any function here. Any
consumer that flips the source horizontally must re-calibrate; mixing spaces
mid-flow silently breaks everything, so the space is fixed and documented here.

---

## Pipeline order (per detector frame)

```
landmarks ─▶ qualityGate ─▶ blinkDetector ─▶ gazeMapper.extractFeatures
                 │               │                    │
              drop bad        skip blink         fx, fy (+ pose)
              frames          frames                  │
                 │               │                    ▼
                 └──────────────┴────────▶ calibration model.predict ─▶ (x,y)%
                                                             │
                                                   2D One Euro Filter
                                                             │
                                              GazeDot 60fps interpolation
```

Blink frames and quality-rejected frames **must not** advance the One Euro
filter, the calibration averaging, or (Phase 2) fixation timers.

## Chosen constants & FPS (see source JSDoc for full rationale)

- **Detector rate: 15 FPS** (66 ms). The previous code ran at 4 FPS. 15 FPS is
  the documented safe fallback from the prompt: a real CPU profile on the target
  laptop could not be captured in this build environment (headless, no webcam),
  so the conservative tier is chosen rather than a fabricated measurement. The
  60 FPS render loop + One Euro smoothing make 15 FPS feel fluid. `DETECTOR_FPS`
  in `gazeRuntime.ts` can be raised to 30 once a live profile shows the page
  stays < 60% sustained CPU.
- **One Euro**: `minCutoff 1.0 Hz`, `beta 0.007`, `dCutoff 1.0 Hz` (Casiez 2012).
- **Render interpolation**: exponential easing factor `0.30` at 60 FPS.
- **EAR blink threshold**: `0.21`, min `2` consecutive frames (Soukupová 2016).
- **Quality gate**: yaw/pitch `±35°`, frame-edge margin `5%`, eye luminance
  `< 40/255`, sustained-loss `500 ms`.
- **Calibration**: 9-point 3×3 grid, median aggregation, leave-one-out CV;
  quality bands good `<3%`, acceptable `3–6%`, poor `>6%` of screen diagonal.

## Known limitations (carry into Phase 2 verdicts)

- Reflective glasses, low light, and sub-480p cameras degrade iris localization
  and can produce false positives.
- Medical conditions (nystagmus, strabismus) can break the fixation/centroid
  assumptions.
- Head pose is a **geometric proxy** from landmarks, not solvePnP: the
  `@mediapipe/face_mesh` JS solution does not expose `facialTransformationMatrix`.
  The polynomial rescales the proxy via its pose coefficients, so absolute
  accuracy of yaw/pitch is not required, only frame-to-frame consistency.
- The `%`-space CV metric uses the unit-square diagonal as reference; on very
  non-square viewports the per-axis pixel error differs from the reported `%`.
