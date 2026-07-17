# Mainline-v2 Phase V7 R1 preflight

Date: 2026-07-16

This checkpoint records the first V7 readiness review after the V6 canonical
omega HUD. It is an engineering gate, not a calibration result or a claim of
physical truth.

## Scope and rollback boundary

- The V6 mobile acceptance was checked against `mainline-v2/index.html` at a
  390px requested viewport (375px CSS content width after the browser
  scrollbar).
- The V2/V3/V4/V5/V6 contract surface remains in `mainline-v2/`.
- No formal red-line file was changed by this preflight:
  `shared-physics-core.js`, `game4.html`, `game5.html`, `match-trainer.html`,
  `videos.json`, and `physics-presets.json`.
- Rollback is therefore the existing V6 `mainline-v2/` boundary; no legacy
  page or formal preset migration is required.

## Gate results

| Gate | Result | Evidence / decision |
|---|---|---|
| Canonical schema-2 `omega` | PASS | `node tools/mainline-v2.test.js`; finite pure/mixed/zero/sign-reversed cases pass. |
| Shared serve → flight → table → racket → return flow | PASS | `node tools/physics-3d-cross-page-e2e.test.js`; all three reference pages carry the same canonical omega handoff. |
| Scale boundary | PASS | V2 contract regression covers real/simulation conversion and round-trip values. |
| V2–V6 regression | PASS | 47 canonical presets and the product-shell phases pass `tools/mainline-v2.test.js`. |
| V6 mobile layout | PASS | No horizontal overflow; video panel bottom 433px, table panel top 445px; HUD uses a two-column 143.5px grid; controls are 40px high. |
| V6 runtime HUD | PASS | After starting a round, HUD showed `omega.x=-125.66`, `omega.y=-125.66`, `omega.z=0.00`, norm `177.71 rad/s`. |
| Contact policy final freeze | BLOCKED | `mainline-v2/contact-policy.js` still exposes an instantaneous/Coulomb default plus an experimental compliant/viscous mode. The final policy choice is not frozen. |
| Normal-force evolution | BLOCKED | The current work items explicitly state that full normal-force evolution is not yet unified or validated against measured input. |
| 47-preset forward-model re-solve | HOLD | Must wait for the two contact-model decisions above. |
| Measured calibration / holdout | HOLD | Must follow the candidate re-solve and legal/target-precision classification. |
| Game 5 real visual/feel validation | HOLD | The automated product shell is connected, but category-level player left/right and feel checks remain open. |

## Decision

Phase V7 is **not yet calibration-ready**. The next R1 action is a contact
policy proposal that freezes normal-force evolution, compliant-contact scope,
compatibility, candidate evidence location, and rollback criteria. Only after
that proposal is explicitly authorized should the 47-preset candidate
forward-model re-solve begin.

Candidate Magnus, restitution, friction, and compensation values must remain in
isolated evidence/candidate configuration during that work. They must not be
written into the formal core or formal presets as part of this checkpoint.

## Validation commands

```text
node tools/mainline-v2.test.js
node tools/physics-3d-cross-page-e2e.test.js
node tools/physics-3d-unified-prototype.test.js
```

All three commands passed on this checkpoint.
