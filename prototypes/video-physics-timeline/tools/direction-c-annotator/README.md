# Direction C annotator (prototype only)

## Status

Phase 1 completed on 2026-07-12; Phase 2 completed on 2026-07-12. This remains
an isolated prototype and is not an approved Trainer feature, video
calibration, or a physics-truth claim.

Open `index.html` from a static local server (or double-click via `file://`;
the tool then falls back to a built-in preview profile). The video source is
freely selectable: pick any local video file — it is processed entirely in the
browser and never uploaded. The bundled `real_backspin_001` sample loads as the
default source. Drafts are saved per source file name, so switching back to a
previously annotated file restores its draft automatically.

Set the contact frame, observation end frame, and yellow entry marker, then run
the C3 preview: the tool drives the same `direction-c-engine.js` Experiment
state flow as the direction-c page (OBSERVING → contact → overlap fade →
training ball), and the training ball is stepped by `prototype-physics-bridge`
with the `prototype_short` profile's velocity, spin, and gravity from the
dragged entry point — no fake animation. The panel saves a source-scoped draft
to local storage and exposes JSON for handoff to a coach.

The preview is intentionally not camera calibration, ball tracking, or proof of
physical continuity. Every generated record is locked to
`annotation_status: "draft"` and `review_status: "pending_coach"`.

Run the Phase 1/2 checks with:

```text
node prototypes/video-physics-timeline/tools/direction-c-annotator/annotation-contract.test.js
node prototypes/video-physics-timeline/tools/direction-c-annotator/preview-runtime.test.js
node prototypes/video-physics-timeline/tools/direction-c-annotator/mobile-layout.test.js
node prototypes/video-physics-timeline/projection-helper.test.js
node prototypes/video-physics-timeline/direction-c/direction-c-engine.test.js
```
