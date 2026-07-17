# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Language

Always respond to the user in Traditional Chinese (繁體中文), regardless of what language this file or the code comments are written in. Code, identifiers, and technical terms may stay in English as appropriate.

## What this project is

A table-tennis serve-reaction training tool (pure static HTML pages, no server, no build step). The user is a learner working solo; the repo iteratively adds simplified physics so visual feel matches judgment training. `game5.html` is the currently-blessed MVP mainline per `docs/MVP_MAINLINE_SPEC.md`; `game4.html` remains the legacy production page; `return-studio.html` / `physics-studio.html` / `serve-generator.html` are research/authoring tools, not deployed behavior.

The repo is **not** a npm project. There is no `package.json`, no `npm test`, no build. Pages are opened directly in a browser. Tests are standalone Node scripts run one-by-one.

## Red-line files and the R0/R1 distinction

Before touching the files listed below, read `AI_CONTEXT/00_READ_ME_FIRST.md` and `AI_CONTEXT/STATUS.md`. The project distinguishes:

- **R0 (contract-internal fix)** — no change to physics state, coordinates, sign convention, units, data schema, or cross-page semantics. Examples: UI, copy, visual feedback, debug info, narrowly-scoped bugs. May proceed with a brief purpose + targeted validation.
- **R1 (model/contract upgrade)** — any change to state representation, coordinates/sign convention, units/time scales, spin combinations, flight/bounce/racket coupling, serialized data semantics, or cross-page behavior. Must propose a full plan (purpose, risk, compatibility, rollback, validation) and get explicit authorization before editing the red-line files.

Red-line files (formal core / mainline / formal data):

- `shared-physics-core.js` — shared physics core (Phase 1 + 2 + schema-2 3D done; full 3D migration still open).
- `game4.html`, `game5.html`, `match-trainer.html` — formal game/trainer pages.
- `videos.json`, `physics-presets.json` — formal data.

`return-studio.html`, `physics-studio.html`, `serve-generator.html` are research/authoring tools. Their outputs may only be written into the red-line files above through R1 review. `prototypes/` is free to experiment but must not auto-write back to formal data/core/pages.

Authorization is scope-limited. A one-time minimum-change grant (e.g. "Game 5 MVP scope") does not cancel R1, and does not promote prototype evidence into physical truth.

## Architecture (read these together)

### Page roles

| File | Role |
|---|---|
| `index.html` | Landing / entry page for the published site. |
| `game4.html` | Legacy formal game page. attack/push use racket-contact mechanics; `loop` still uses the old `model:'direct'` path (not racket-contact). |
| `game5.html` | Current MVP mainline (user decision 2026-07-15). Forked from game4; decoupled technique/direction buttons, direction-C video handoff, per-video preset pairing, swing-delay model, racket mesh hit animation, gesture technique keys, dynamic camera pullback. See `AI_CONTEXT/STATUS.md` section "2026-07-15 新增 game5.html". |
| `match-trainer.html` | Formal trainer page (not in current edit scope). |
| `return-studio.html` | Research/tuning page for return techniques. Has blend/substepped push and Stage 4a spring-damper contact. **Not** deployed game4 behavior — but PADDLE_BLEND=0.605, bounceOffPlaneSubstepped, and the side-spin fallback fix have been synced to game4.html. |
| `physics-studio.html` | Serve preset/physics authoring tool. Aligns table-bounce v2 constants with game4. Does NOT have `SIM_TIME_DILATION` (scale-consistency bug unfixed, low priority). |
| `serve-generator.html` | Per-video preset generator. Reads `videos.json`, produces one preset per approved video with `tags.videoId`, `sideName`, `curveDirection`. |
| `physics-v2-calibration.html` | Table-bounce calibration page. |
| `admin.html`, `review.html` | Admin/review UI for video library. |

### Physics core

`shared-physics-core.js` is the single formal physics core. Phase 1 added 5 constants + 2 functions; Phase 2 added 8 constants + 4 functions including `bounceWithSpinPhysical`. Schema-2 adds world-space `omega` (3D angular velocity vector), real-scale flight bridge, arbitrary-plane contact-point impulse solver with 2D Coulomb friction. Legacy `spin: {topspin, sidespin}` is an x-kick compatibility proxy — `sidespin` sign is **engine convention**, not a left/right data label.

Coordinate system: `x` = left/right, `y` = up/down, `z` = forward (positive toward receiver). Right-handed. Distances in meters, velocities in m/s, angular velocities in rad/s. Gravity is scaled to -4.2 m/s² (sim) vs -9.8 (real); `SIM_TIME_DILATION = √(9.8/4.2) ≈ 1.528` compensates at three transition points (`simulatePath` / `simulateServe` / `serveBounceScore`). `physics-studio.html` does NOT have this — its table-contact call is unscaled.

### Spin direction contract (read before touching any side-spin code)

`docs/SPIN_DIRECTION_CONTRACT.md` is the single source of truth. Three independent fields, never derive one from another:

- `sideName` ("left"|"right"|null) — spin name (what the spin IS).
- `curveDirection` ("left"|"right"|"none") — which way the ball curves.
- Legacy `sidespin` sign — engine proxy. Left sidespin = negative sidespin = curves right. Right sidespin = positive = curves left.

Never use `Math.sign(sidespin)` to guess `sideName`. Never mirror an entire path based on sign. The generator must decide path from `placement`/`length` templates, not from sign.

### Per-video serve presets

`physics-presets.json` currently holds 47 per-video generated presets. Each carries `tags: {videoId, videoCategory, spinType, sideName, curveDirection, length, placement}`. `game5.html` pairs by `videoId` (1:1), with category-random fallback for legacy presets without `videoId`. Regenerating presets: run `serve-generator.html`, download replacement `physics-presets.json` (the tool defaults to "clear old presets").

### Video library

`videos.json` has 55 entries; 47 are `kind: video` and approved. `contact_sidebackspin_left`/`_right`/`contact_sidespin_left`/`_right` are separate categories (split 2026-07-15). `contact_time_sec` is filled by `auto-contact-tagger` (rough, ~3 frame error); coach review overwrites the same field. Media path convention: `images/{category}/{category}_{NNN}.{jpg|mp4}` with 3-digit zero-padded numbers — file names are globally unique so they can be flattened later.

### mainline-v2 (independent skeleton)

`mainline-v2/` is the R1 rearchitecture boundary per `docs/plans/MAINLINE_V2_REARCHITECTURE_PLAN.md`. Loads only schema-2 presets with finite world-space `omega`; legacy fields only via explicit `legacy-adapter.js`. V0/V1/V2/V3/V4/V5/V6/V7/V7.1/Full-3D Reset + R1 table-contact candidate are all wired. Does NOT touch legacy pages, shared core, or formal presets. Run its contract test from repo root: `node tools/tests/mainline-v2.test.js`.

### Camera config

`camera-config.json` is read by game4/game5. `game5.html` adds `GAME5_LOOKAT_Y_BOOST` on top of the file's lookAt (only affects game5).

## Commands

There is no `npm test`. Run tests as standalone Node scripts from the repo root:

### Tests with pass/fail (use these for verification)

```bash
node tools/tests/serve-generator-contract.test.js     # VAL-012: 47 approved videos contract
node tools/tests/serve-batch-validation.test.js       # VAL-003: 47-preset legal-serve gate (game4 + physics-studio cross-check)
node tools/tests/batch-validation.test.js             # VAL-004: game4 return batch
node tools/tests/return-studio-batch-validation.test.js  # VAL-005: return-studio research batch
node tools/tests/cross-file-consistency-check.js      # VAL-006/011: constant/function fingerprint sync
node tools/tests/mainline-v2.test.js                  # mainline-v2 V2..V7.1 + Full-3D Reset contract
node tools/tests/mainline-v2-table-bounce-audit.test.js  # 47-preset raw table-bounce transfer audit
node tools/tests/physics-3d-cross-page-e2e.test.js    # cross-page canonical omega data-flow (Game4/5/Return Studio)
node tools/tests/physics-3d-spin.test.js              # 3D spin unit tests
node tools/tests/physics-3d-unified-prototype.test.js # unified 3D prototype
node tools/tests/physics-contact-3d.test.js           # 3D contact mechanics
node tools/tests/physics-flight-3d.test.js            # 3D flight tests
node tools/tests/game5-mvp-validation.test.js         # Game 5 MVP validation
```

### Run a single test

Any single test file above: `node tools/tests/<file>.test.js`. These are self-contained — no test runner, no framework. Failures `process.exit(1)`.

### Calibration / sweep tools (NOT pass/fail tests)

~20 files like `push-tilty-sweep-calibration.js`, `bounce-spin-decay-sweep.js`, `paddle-blend-fine-sweep.js`. These print a numeric table/report and always `exit 0` unless the script itself crashes. Do not treat their output as pass/fail. Delegate long-running sweeps to a subagent via the Agent tool — keep main thread focused on goals/results, not raw sweep output.

### Serving pages locally

Open the HTML file directly in a browser, or serve the directory with any static server (`python -m http.server`, `npx serve`, etc.) — no build step required.

## Workflow rules that catch real bugs

- **id-list pattern in tool pages**: Several tool pages build DOM refs via `Object.fromEntries(idList.map(id => [id, $(id)]))`. If HTML adds an id that's missing from the JS `idList`, that property becomes `undefined` and any `annEls.xxx.value = ...` throws TypeError inside a DOM event listener (not caught by outer try/catch, not always visible in console). When editing HTML in `direction-c-annotator`, `physics-studio`, `serve-generator`, or similar tool pages, sync the JS id-list array too.
- **Headless file-picker debugging**: synthesize `FileList` + a window `'error'` listener to catch exceptions swallowed inside DOM handlers.
- **Hidden-tab rAF freeze**: when validating game5 headlessly, background tabs freeze rAF; use visibility/EventSource workarounds rather than assuming rAF ticks.
- **Hit sound is not a reliable judgment cue**; table-bounce sound is a legitimate rhythm cue. Do not wire training cues to hit sound.
- **Do not delete failing cases, hide uncertainty, or fabricate data.** Do not write `return-studio.html` research behavior as `game4.html` deployed. Do not promote prototype results to model decisions. Do not treat GLM drafts' "deployed"/"risk: none" as true without verifying against the file.

## Key reference docs (read when relevant)

- `AI_CONTEXT/00_READ_ME_FIRST.md` — entry point for AI/handoff; defines R0/R1 and red-line files.
- `AI_CONTEXT/STATUS.md` — current state (active work, what's a red-line, recent fixes). **Read this first.**
- `AI_CONTEXT/OPEN_ITEMS.md` — outstanding TODOs; review item-by-item.
- `AI_CONTEXT/3D_RESEARCH_ARCHIVE_INDEX.md` — index of same-stage 3D/Game 5 research evidence.
- `docs/MVP_MAINLINE_SPEC.md` — the narrow playable loop `game5.html` implements.
- `docs/PHYSICS_MODEL_SPEC.md` — formal physics constants/functions, split into "verified formal" / "research" / "pending decision".
- `docs/SPIN_DIRECTION_CONTRACT.md` — single source of truth for left/right sidespin semantics.
- `docs/CORE_FILE_SYNC_STATUS.md` — what's synced between game4 / return-studio / physics-studio, what's not.
- `docs/DEVELOPMENT_MATRIX.md` — module status map; what's safe to hand to GLM vs high-tier model vs human.
- `docs/VALIDATION_PLAN.md` — VAL-001..VAL-012 entries; which `tools/*.test.js` covers which.
- `docs/BATCH_VALIDATION_SPEC.md` — run-serve-batch / run-return-batch minimum spec.
- `docs/3D_PHYSICS_UNIFIED_MIGRATION_PLAN.md` — current R1 3D migration plan.
- `docs/MAINLINE_V2_REARCHITECTURE_PLAN.md` + `mainline-v2/README.md` — mainline-v2 phases.

## Model selection guidance (from `00_READ_ME_FIRST.md`)

- Use Claude / OpenAI high-tier for: red-line file judgment, cross-file consistency, architecture decisions, deep multi-step reasoning.
- GLM-5.2 is fine for: frontend/UI code generation, single-task logic, large repetitive cleanup, batch data scans, prototype code in `prototypes/`.
- Don't call a fixed task queue; pick per task. Save deep-tier budget for red-line touches and physics/logic bug hunting.

## Memory

Long-term memory lives in `C:\Users\Kevin\.claude\projects\C--Users-Kevin-Documents-2026-06-16-files-mentioned-by-the-user-tt-outputs-tt-reaction-trainer-pages\memory\` and is indexed by `MEMORY.md`. Existing entries cover: hit-vs-bounce sound cues, headless file-picker debugging, video-library-shell id-list bug, game4 push swing-direction limitation, tiltY angle conversion + push calibration, push lift/drive K calibration, delegate-experiments-to-subagent, game4 push rally backspin, racket momentum in isolated tests, game5 mobile UX overhaul. Check `MEMORY.md` before reasoning about prior decisions.