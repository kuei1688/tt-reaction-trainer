# Formal migration checkpoint — 2026-07-16

This checkpoint records the first authorized red-line integration after the immutable Phase 0 baseline and isolated Phase 1/2 prototype.

Implemented in the working tree:

- schema-2 physical spin uses world-space `omega`; legacy schema-1 and `{topspin, sidespin}` inputs are converted only at an explicit boundary;
- page simulation velocity, spin, gravity, and time dilation pass through a real-scale flight bridge;
- `shared-physics-core.js` contains an arbitrary-plane contact-point impulse solver with finite mass/inertia, normal restitution, and bounded 2D Coulomb friction;
- `shared-physics-core.js` also contains a generic spring-damper compliant contact mode that reuses the same contact-point and friction definitions; page-specific two-stage dwell-time adapters remain separate pending measurement validation;
- spin3d table bounces in Game 4, Game 5, Return Studio, and Physics Studio route through the shared table contact path;
- racket-plane adapters in Game 4, Game 5, and Return Studio route instantaneous contact through the same shared solver;
- `physics-presets.json`, `serve-generator.html`, and the contract test use schema 2 without retaining `axialSpin` in physical state.

Validation passed for the shared contact core, flight core, spin core, isolated prototype, serve-generator contract, both read-only page loaders, Game 5 MVP automated validation, and inline JavaScript parsing for all five pages. Game 5 still reports the documented PHYS-02 warning that attack contact remains an approximation.

The 47-preset batch result is intentionally split into two claims. The common legal-serve gate passed 47/47 for both `game4.html` and `physics-studio.html`, and the cross-check passed 47/47. The target-precision diagnostics reported 91 passes and 50 failures; those failures are expected model-change evidence, not a reason to silently retune parameters or tolerances. No physical calibration claim is made.

R1 follow-up: Game 4, Game 5, and Return Studio now reuse `physics3dApplyCompliantContactImpulse` for substepped tangential contact impulse, with cached basis/state objects to keep the research batch tractable. Their page-specific two-stage normal dwell-time, finite-racket-mass, and wrist-brake behavior remains an explicit adapter boundary; full normal-force unification is not yet complete. The return-studio research batch produced 188/188 results with zero exceptions and an observed 88/188 success indicator.

Canonical omega cross-page follow-up: `tools/physics-3d-cross-page-e2e.test.js` now checks Game 4, Game 5, and Return Studio across `serve -> flight -> table -> racket -> return`. It requires explicit `spin3d` handoffs while retaining legacy `spin` for compatibility, and checks that Return Studio's z-mirror transforms the axial vector with `omega.x` and `omega.y` sign reversal while preserving `omega.z`. The test passes on a mixed non-zero omega preset. This is data-flow evidence only; no calibration or physical-truth claim is made.

The next required work is full compliant-contact unification of the normal-force evolution, measured calibration/holdout evaluation, preset re-solving, and manual Game 5/page visual verification.
