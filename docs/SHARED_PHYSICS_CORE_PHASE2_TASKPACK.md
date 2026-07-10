# Shared Physics Core Phase 2 Taskpack (Updated)

## Trigger

Phase 1 was approved on 2026-07-09 and implemented in commit 733d5ce.

## Phase 2 Extension (Approved 2026-07-10, Implemented in commit 273a254)

The user approved extraction of 12 additional symbols on 2026-07-10, after Claude boundary review identified that the original Phase 2 taskpack only covered Phase 1 symbols.

### Approved constants (8)

- TABLE
- BALL_RADIUS
- BALL_MASS
- BALL_INERTIA_ALPHA
- BALL_INERTIA
- MAX_TABLE_BOUNCES
- NET_COLLISION
- OBLIQUE_ANGLE_DEG

### Approved functions (4)

- clamp()
- horizontalImpactSpeed()
- spinSurfaceSpeed()
- ounceWithSpinPhysical() (game4/return-studio version with epsilon/
egime return fields)

### Explicitly NOT extracted

- BALL_RENDER_RADIUS (values differ across 3 HTML files: game4=0.022, physics-studio=0.034, return-studio=0.03; extracting would change visual ball size)
- PADDLE_BLEND, computeBlendedNormal(), ounceOffPlaneSubstepped(), PADDLE_WRIST_BRAKE_RATE
- All adaptive push formulas
- All ball-racket contact mechanics
- All loop/direct model logic
- clone() (game4/return-studio have clone, physics-studio has cloneVec; also used by non-physics UI code)
- solveVelocity, solveBaseVelocity, solveServeBounceVelocity (physics-studio uses state param, game4 uses preset param)

### Files modified

- shared-physics-core.js (added 8 constants + 4 functions)
- game4.html (removed inline definitions)
- physics-studio.html (removed inline definitions)
- 
eturn-studio.html (removed inline definitions)
- 	ools/consistency-whitelist.json (added 12 rules)
- 	ools/load-game4-physics.js (added evaluateSharedCoreValues(), updated SHARED_CORE_CONSTANTS/SHARED_CORE_FUNCTIONS/SHARED_CORE_EXPECTED_VALUES, added Phase 1+2 symbols to 
untimeExternals)
- 	ools/batch-validation.test.js (updated expected values/fingerprints, fixed deepRoundedEqual to sort keys, replaced ounceWithSpinPhysical proxy extraction with proxy module version)
- 	ools/serve-batch-validation.test.js (new: VAL-003 serve batch validation)

### Validation results (2026-07-10)

- cross-file-consistency-check.js: 14 constants + 6 functions, all passed
- physics-v2-contact-mechanics.js: 13/0
- 
acket-contact-mechanics.js: all passed
- atch-validation.test.js: 14/0
- serve-batch-validation.test.js: cross-check 16/16, exit 0
- Inline JS syntax check: OK

## Original Phase 1 Symbols (for reference)

### Constants (5)

- EPSILON_VERTICAL
- EPSILON_OBLIQUE
- EPSILON_MIN
- SPIN_EPSILON_REFERENCE
- CONTACT_FRICTION_MU

### Functions (2)

- dynamicEpsilon()
- ounceTangentialAxis()
