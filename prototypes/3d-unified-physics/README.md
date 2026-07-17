# 3D unified physics prototype

This directory is an isolated Phase 1/2 experiment for
`docs/3D_PHYSICS_UNIFIED_MIGRATION_PLAN.md`.

It intentionally does not modify or import the formal page implementations.
The prototype separates:

- `canonical-spin.js`: input-boundary conversion into a schema-2,
  world-space `omega` vector. `axialSpin` is consumed once during conversion
  and is not retained in the physical state.
- `contact-solver.js`: one plane-contact kernel for fixed tables and moving
  racket planes. It uses contact-point velocity, finite mass/inertia, normal
  restitution, and a 2D Coulomb friction cone.
- `flight-kernel.js`: a real-scale flight step using gravity, optional drag,
  and `omega x velocity` Magnus acceleration. Playback time scaling is outside
  this kernel.

The tests are mathematical/prototype checks only. They do not establish
video-calibrated physical truth, preset correctness, or Trainer readiness.

Run from the repository root:

```text
node tools/physics-3d-unified-prototype.test.js
```
