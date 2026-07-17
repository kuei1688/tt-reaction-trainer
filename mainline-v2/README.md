# Mainline V2

This directory is the independent Game 5 mainline-v2 boundary described in
`docs/MAINLINE_V2_REARCHITECTURE_PLAN.md`.

## V0 checkpoint

The current legacy pages, `shared-physics-core.js`, `physics-presets.json`,
existing evidence, and cross-page contract remain unchanged. Game 5 is the
only product-line candidate for this migration; Game 4, Return Studio, and
Physics Studio remain reference/research surfaces. This checkpoint does not
claim a complete 3D migration or calibrated physics.

V0 deliberately adds no HUD, no preset re-solve, no Magnus parameter change,
and no measured calibration.

## V1 boundary

The skeleton loads the existing shared core and accepts only preset entries
with `variation.spin3d.schema === 2` and finite world-space `omega`. It
normalizes the input into a canonical `BallState` with `omega` as the only
physical spin state. Legacy fields are available only through the explicit
`legacy-adapter.js` entry boundary and are never read by the v2 runtime.

The runtime exposes the minimal state sequence:

```text
idle -> serve -> flight -> contact -> return -> result
```

## V2 vertical slice

V2 runs one geometry-derived serve through shared-core flight, shared 3D table
contact, a clearly labelled temporary Game 5 racket-plane adapter, and return
flight. The serve velocity is derived at the v2 input boundary from the
existing preset's start/first-bounce metadata; the formal preset is not
rewritten. Diagnostics retain real-scale velocity and omega plus the single
scale boundary used for animation time.

The racket timing/normal is an explicit temporary adapter, not measured
calibration or the final V3 contact policy. The page remains an inspection and
contract smoke surface, not the complete Game 5 product flow.

## V3 contact policy

V3 makes table and racket contact use the same request/response boundary:

```js
contact.solveContact({
  state: ballState,
  surface: surfacePolicy,
  mode: surfacePolicy.mode,
}, sharedCore)
// {state, diagnostics}
```

The normalized diagnostics include normal/tangent impulse, dwell time, friction
regime, and kinetic-energy delta. The default V2 path remains instantaneous and
Coulomb-friction based, so this contract change does not claim new calibration.
The V2 mainline candidate now uses a hybrid policy: the table remains
instantaneous/Coulomb, while the racket uses the existing compliant kernel with
viscous tangential response, finite racket-mass scaling, and wrist-brake surface
velocity policy. Those parameters remain candidate policy inputs, not formal
presets or measured Game 5 constants.

## V4 Game 5 product shell

V4 connects one playable Game 5 round to this boundary without changing the
legacy pages, shared core, or formal presets. The product catalog requires a
canonical `preset.tags.videoId` and exactly one approved video with the same ID;
the video data is read-only and is not used to mutate physics state.

The controller stages the product behavior as:

```text
video -> serve -> table bounce -> delayed swing -> racket contact -> return -> result
```

It carries only the canonical V2/V3 `BallState`, records video handoff, input,
camera, contact, and result events, and renders a mobile-first video/table
experience. Technique, forehand/backhand, and left/right swipe direction are
product inputs. The racket mesh and hit/whiff animations are presentation
behavior; the existing V3 racket adapter remains temporary and uncalibrated.

The completion marker uses the formal preset's second-bounce point as a
`validation-reference` only. `validated: false` is intentional: V4 wires
product behavior to the mainline runtime but does not claim measured landing
validation or physical-truth evidence.

## V6 canonical omega HUD

V6 adds a mobile-first HUD sourced from the runtime's resolved canonical
`physics.ball.omega`. It displays `omega.x`, `omega.y`, `omega.z`, the total
rotation norm, and a non-authoritative component label. The raw values remain
visible so the label cannot replace the canonical state or reintroduce legacy
`spin.sidespin` semantics.

## V7 motion diagnostics

V7 adds a separate motion HUD so product acceptance does not depend on the
rotation HUD. It displays the product/physics phase, real-scale position,
real-scale velocity, speed, last contact, and contact count. A table-bounce
event also produces a short presentation pulse on the training ball so the
contact is visually legible even when the normalized world-to-table projection
has a small displacement.

These are runtime observability and product-feedback changes. They do not
change the canonical state, contact policy, formal presets, or any calibration
claim.

## V7.1 unified table geometry

V7.1 adds `table-geometry.js` as the single visual coordinate system for the
mainline-v2 table scene. It uses the existing table dimensions as display
references, then projects the table polygon, net, center line, airborne ball,
landing marker, and racket presentation point through the same table-space
mapping. The racket offset is a world-space presentation offset only; it does
not alter the canonical ball state or contact solver.

The camera trapezoid and height scale are visual parameters. They are not new
physics constants, measured calibration, or replacements for
`shared-physics-core.js`. The geometry test checks projection consistency and
source wiring, but a browser refresh and manual visual check are still needed
for visual acceptance.

## Full-3D Reset after V7.2

The V7.2 velocity replacement has been removed. The table contact response from
`contact.solveContact()` is now the post-table `BallState` without a bridge,
target solve, or velocity rewrite. Every subsequent post-table sample is
advanced by the real-scale 3D integrator from that raw state.

Racket interception is a separate product timing boundary. At the configured
`racketInterceptDurationSimulation`, the product records the actual integrated
ball position as `racketInterceptPoint` and then applies the explicit racket
contact policy. This point is not derived from `secondBounce`, and it does not
modify the ball position before contact. The `net-crossing` event is emitted
only when the raw integrated path actually crosses `z = 0`; no event is
synthesized to make a round look valid. When it does cross, the event also
reports ball-radius-aware net clearance and whether the path clears the net;
this is diagnostics only and does not apply a hidden net velocity response.

`trajectory-diagnostics.js` is the V2 forward-path guardrail layer. It reports
table-height crossing/bounds, net-plane crossing/clearance, and raw downward
table crossings without changing the canonical `BallState`.

Current R1 candidate baseline: 47/47 first table contacts are in bounds; 23 raw
post-table paths cross `z = 0`, and all 23 clear the net with ball radius; all
47 produce a raw second table crossing. The raw post-contact speed ratio is
0.803–0.821 and the kinetic-energy diagnostic delta is negative for every
preset. These are diagnostic results, not a calibration pass or a product
success gate.

## Full-3D first-bounce launch solve

When a preset does not provide a non-zero launch velocity, `serve-data.js` now
asks the mainline scale adapter to numerically solve the initial 3D velocity
against `firstBounce`, using the same real-scale gravity/Magnus integrator used
by runtime flight. This is a forward-model solve for the first contact only;
it does not read `secondBounce`, rewrite post-table velocity, or change formal
preset data. The current 47-preset solve reaches its first-bounce x/z targets
within the V2 test tolerance, but remains engineering evidence rather than
calibrated physical truth.

`secondBounce` remains only a `validation-reference` marker at completion. It is
not a post-table target, a racket target, or a source of velocity. The current
R1 candidate clears the current forward paths, but that result is model
evidence only; it is not a claim that the formal serve/contact data is
calibrated or visually accepted, and it is not a reason to reintroduce a local
trajectory replacement.

## R1 table-contact candidate

The default mainline-v2 table policy now uses a finite-contact 3D candidate:
3 ms dwell, 12 substeps at 0.25 ms, harmonic (half-sine) compression, spring
6000, damping 4, and Coulomb friction. The compression amplitude is derived
from the incoming normal speed and ball mass; it is not taken from a landing
target. The shared 3D contact-point velocity and world-space `omega` remain
the only contact state inputs.

This is an R1 model candidate, not measured calibration. It is intentionally
local to `mainline-v2/contact-policy.js`; the rollback boundary is the prior
instantaneous table mode via `tableNormalModel: "instantaneous"`. The candidate
must continue to pass the V2 contact invariants and the 47-preset transfer
audit before any future formal-page consideration.

## Table-bounce transfer audit

Run the raw table-bounce transfer audit from the repository root:

```text
node tools/mainline-v2-table-bounce-audit.test.js
```

The audit compares the incoming BallState, the shared 3D table contact
response, and the raw post-table integration for all 47 presets. It reports
speed/energy transfer, omega change, impulse, friction regime, net clearance,
and the error between the raw second table crossing and the formal
`secondBounce` reference. It does not fit or mutate table parameters, and it
never uses `secondBounce` to generate velocity.

## V5 contract regressions

V5 extends the contract test with canonical-only loader rejection, zero/pure/
mixed/sign-reversed omega cases, actual table-bounce omega samples, axial
left/right mirror and rotated-frame contact invariance, passive-table energy
non-increase, real/simulation scale checks, and the rule that legacy spin is
consumed only by the explicit adapter entry. These are engineering regression
checks; they are not calibration or physical-truth evidence.

Run the V2/V3/V4/V5/V6/V7/V7.1/Full-3D Reset contract test from the repository root:

```text
node tools/mainline-v2.test.js
```
