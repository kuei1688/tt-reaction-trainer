# Phase 1/2 failure classification

## Passed prototype gates

- schema-2 physical spin has no retained `axialSpin` scalar.
- Legacy schema-1 and legacy `{topspin, sidespin}` inputs are handled only at an explicit boundary.
- Flight uses the resolved world-space omega directly.
- Fixed-table and moving-racket contacts share the same normal/tangent impulse math.
- Friction is bounded by a 2D Coulomb cone and does not add kinetic energy in the fixed-plane case tested.
- Rotating the coordinate frame rotates the response consistently.

## Remaining gaps

- The prototype's compliant mode is an engineering spring-damper experiment, not a fitted rubber/sponge model.
- No measured trajectory or spin data was used.
- No formal page, solver, preset, or video data was migrated.
- Legacy compatibility equivalence for all existing page snapshots is not established because the prototype is intentionally isolated.
