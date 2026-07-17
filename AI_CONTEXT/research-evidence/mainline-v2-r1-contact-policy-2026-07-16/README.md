# Mainline-v2 R1 contact policy proposal

Date: 2026-07-16

Decision authorized by the user: **hard table contact, compliant racket
contact**.

This is a scoped R1 candidate for the independent `mainline-v2/` boundary. It
does not promote parameters to the shared core, legacy pages, formal presets,
or measured physical truth.

## Purpose

Make the table and racket behave like the surfaces they represent:

- The table is a rigid floor: an instantaneous normal response with Coulomb
  tangential friction.
- The racket is a deformable, moving surface: a short compliant normal contact
  with viscous tangential response, finite racket mass, and wrist braking.

The physical state remains schema-2 world-space `omega`; this decision changes
only the contact response policy used by the mainline-v2 candidate.

## Candidate policy

| Surface | Normal | Tangent | Other policy inputs |
|---|---|---|---|
| Table | `instantaneous` | `coulomb` | infinite surface mass, no wrist brake |
| Racket | `compliant` | `viscous` | dwell `0.004 s`, racket mass `0.18 kg`, wrist brake `20 s^-1`, dt `0.0005 s`, 8 steps, spring `5000`, damping `4`, tangent damping `0.5` |

These values already existed as an explicitly exercised compliant-contact
candidate in the V3 tests. They are engineering candidate inputs, not measured
Game 5 calibration constants.

## Risks

- Racket outgoing velocity and canonical `omega` will differ from the
  instantaneous adapter.
- The 47 preset target-precision results may change after racket contact.
- The candidate may feel too soft, too damped, or unstable for some techniques.
- The normal-force evolution is now explicitly a candidate model, but it still
  requires holdout and measured-input validation before promotion.

## Compatibility and rollback

- Input schema, coordinate frame, units, scale adapter, and canonical omega
  contract remain unchanged.
- Table contact remains the existing hard-contact path.
- Legacy pages and formal presets continue to use their existing files.
- Rollback is one mainline-v2 policy change: restore the racket mode defaults
  to instantaneous/Coulomb while retaining the proposal and evidence.
- No shared-core API or serialized preset migration is required for rollback.

## Validation gate

1. V2/V3/V4/V5/V7 contract and trajectory tests remain green.
2. Table contact remains energy non-increasing and frame-invariant.
3. Racket contact reports finite position, velocity, omega, dwell time,
   impulse, friction regime, finite-mass application, and wrist-brake data.
4. Candidate 47-preset forward-model re-solve is run only after this policy
   boundary passes engineering validation.
5. Legal gate, target-precision classification, holdout, and measured-input
   checks remain separate promotion gates.

## Non-claims

This checkpoint is not a claim that the candidate is video-calibrated, feels
like a real racket, or is ready for V8 mainline switching.
