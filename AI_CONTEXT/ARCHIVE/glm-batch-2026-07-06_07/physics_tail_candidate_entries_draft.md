DRAFT: Physics tail candidate entries
#
# Status: draft only.
# This file is a candidate entry list and must not be treated as a final decision set.
# Last touched: 2026-07-06

# Physics Engine V2 Plan
> Candidate entries only. This file extracts proposals and review cues from the physics plan; it does not approve them as final decisions.

## 1. Model Decisions (DEC)

### DEC-001: `blend` Mechanism (Rebound-Sliding Coupling)
- **Description:** The rebound direction is a blend of the rigid body normal and the inverse of the ball's approach direction. This is the key to generating correct backspin without active upward swing.
- **Links:** [RES-001](#res-001), [EXP-001](#exp-001)

### DEC-002: Two-Stage Dynamic `blend`
- **Description:** `blend` is not constant during contact. It is low during compression (`blendCompress`) and high during release (`blendRelease`), matching the "brush to 6 o'clock" physical image.
- **Links:** [RES-002](#res-002), [EXP-002](#exp-002)

### DEC-003: Aiming/Physics Consistency
- **Description:** The aiming solver (`solveRacketVelXForTargetLandingX`) must use the exact same physics as the final collision calculation, including `blend`, `scale`, and `outputRescale`. This bug was caught 3 times.
- **Links:** [RES-003](#res-003), [EXP-003](#exp-003), [EXP-009](#exp-009)

### DEC-004: Internal `scale` and `outputRescale`
- **Description:** To overcome the "energy budget" tension, an internal `scale` factor is applied to both incoming and racket velocities. The output velocity is then rescaled by `outputRescale` (not simply divided by `scale`) to avoid unrealistic "bullet" trajectories. Spin is not rescaled.
- **Links:** [RES-004](#res-004), [EXP-004](#exp-004), [EXP-005](#exp-005), [EXP-008](#exp-008)

### DEC-005: Remove `tiltX` Hack, Restrict `blend` to y-z Plane
- **Description:** The `tiltX` hack to fix backhand sidespin was physically unreasonable (paddle rotating 60 degrees). The real fix is to restrict the `blend` calculation to the y-z plane, ignoring x-direction incoming velocity. Aiming is fully handled by the aiming mechanism.
- **Links:** [RES-005](#res-005), [EXP-006](#exp-006), [EXP-007](#exp-007)

### DEC-006: Current Best Parameter Set
- **Description:** `yRatio=-0.45, scale=2.0, tiltY=1.4, blendRelease=0.7, neutralMagBase=0.8~1.0, kAdapt=0.1~0.12, magFloor=0.3~0.4, outputRescale=1.4`. Result: `okCount=9, correctCount=14`.
- **Links:** [RES-006](#res-006), [EXP-009](#exp-009)

---

## 2. Physics Model Spec (RES)

### RES-001: `blend` Mechanism Spec
- **Formula:** `effectiveNormal = (1-blend) * rigidNormal + blend * (-approachDir)`
- **Description:** `blend` is the main driver for spin direction correctness. It couples the rebound direction with the tangential sliding direction.

### RES-002: Two-Stage `blend` Spec
- **Compression phase (`vN > 0`):** Use `blendCompress` (low, e.g., 0.1). Ball is sinking into the sponge, maintain rigid body behavior.
- **Release phase (`vN < 0`):** Use `blendRelease` (high, e.g., 0.7~0.9). Ball is being ejected, friction/brushing is active.

### RES-003: Aiming Mechanism Spec
- **Requirement:** `solveRacketVelXForTargetLandingX` must use `bounceTwoPhaseBlend` + `scale` + `outputRescale` internally. Any new mechanism affecting final velocity must be synced here.

### RES-004: `scale` and `outputRescale` Spec
- **`scale`:** Applied to `incomingVel` and `racketVel` before collision calculation. Represents internal physical effects (dwell acceleration, sponge elasticity).
- **`outputRescale`:** Applied to the output velocity (not spin) after collision. `outputRescale` != `scale`. Prevents "bullet-like" trajectories.

### RES-005: y-z Restricted `blend` Spec
- **Requirement:** When calculating `approachDir` for `blend`, only use y and z components of the relative velocity. Ignore x. This prevents x-direction incoming velocity from corrupting the topspin/backspin calculation.

### RES-006: Current Best Parameters
- `yRatio`: -0.45
- `scale`: 2.0
- `tiltY`: 1.4
- `blendRelease`: 0.7
- `neutralMagBase`: 0.8~1.0
- `kAdapt`: 0.1~0.12
- `magFloor`: 0.3~0.4
- `outputRescale`: 1.4

---

## 3. Experiment Log (EXP)

### EXP-001: `blend` Static Paddle Test
- **Setup:** Paddle completely static. Test `blend=0.6`.
- **Result:** `correctSpinFrac` jumped to 0.93-1.0. `singleOk` dropped.
- **Conclusion:** `blend` is the missing link for spin direction. [DEC-001](#dec-001), [RES-001](#res-001)

### EXP-002: Two-Stage `blend` Prototype
- **Setup:** Browser prototype with dynamic `blend`.
- **Result:** `blendRelease` 0.7~0.99 makes spin correct, but height drops at extreme values.
- **Conclusion:** Mechanism is valid, needs joint calibration with other params. [DEC-002](#dec-002), [RES-002](#res-002)

### EXP-003: Aiming Consistency Bug (1st time, for `blend`)
- **Setup:** `solveRacketVelXForTargetLandingX` was using old physics without `blend`.
- **Result:** Fixed, `singleOk` 10->11.
- **Conclusion:** Aiming and collision must use same physics. [DEC-003](#dec-003), [RES-003](#res-003)

### EXP-004: Phase B Sensitivity Test
- **Setup:** Test `tiltY`/`neutralMag`/`blendRelease` combinations.
- **Result:** No combination satisfies both net clearance and spin direction. Energy budget is insufficient.
- **Conclusion:** Need Stage 1 (scale factor) to increase energy budget. [DEC-004](#dec-004)

### EXP-005: `scale` Factor Test
- **Setup:** Apply `scale` to both incoming and racket velocities.
- **Result:** `okCount` 4-5, `correctCount` 11-12.
- **Conclusion:** Scale factor helps but needs output rescaling. [DEC-004](#dec-004), [RES-004](#res-004)

### EXP-006: Backhand Sidespin Diagnosis
- **Setup:** Diagnose spin direction error for backhand sidespin.
- **Result:** `tiltX` hack works but requires 60-degree paddle rotation, physically unreasonable.
- **Conclusion:** Need a better mechanism to fix backhand sidespin. [DEC-005](#dec-005)

### EXP-007: y-z Restricted `blend` Test
- **Setup:** Restrict `blend` calculation to y-z plane, `tiltX=0`.
- **Result:** Spin direction fixed cleanly. `correctCount` 14/14.
- **Conclusion:** `tiltX` hack is unnecessary. y-z restriction is the correct fix. [DEC-005](#dec-005), [RES-005](#res-005)

### EXP-008: Visual Check (Bullet Trajectory)
- **Setup:** Visual check of `backspin_long_forehand`.
- **Result:** Trajectory is "bullet-like" due to `scale` output not rescaled.
- **Conclusion:** Introduce `outputRescale` to rescale output velocity. [DEC-004](#dec-004), [RES-004](#res-004)

### EXP-009: Aiming Consistency Bug (3rd time, for `outputRescale`)
- **Setup:** `landingXFor` in Node script was using unscaled velocity for flight time estimation.
- **Result:** Fixed, `correctCount` 14/14, `okCount` 9/14.
- **Conclusion:** Aiming and collision must use same physics (including `outputRescale`). [DEC-003](#dec-003), [RES-003](#res-003), [DEC-006](#dec-006), [RES-006](#res-006)

### EXP-010: Remaining Net Failures Diagnosis
- **Setup:** Diagnose 5 remaining net failures.
- **Result:** 3 are short balls where force formula gives higher `neutralMag` (0.81~0.95).
- **Conclusion:** Force formula behavior for slow incoming balls needs investigation. [TODO-003](#todo-003)

---

## 4. Validation Plan (VALIDATION_PLAN)

1.  **Unit Test:** Verify `blend` mechanism with static paddle (EXP-001).
2.  **Visual Check:** Verify trajectory shape is realistic (no bullet trajectory) (EXP-008).
3.  **Full Validation:** Run 14-ball joint validation, target `okCount` -> 14, `correctCount` -> 14 (DEC-006).
4.  **Consistency Check:** Verify aiming solver uses same physics as collision (DEC-003).

---

## 5. TODOs (TODO)

### TODO-001: Implement Two-Stage `blend` in `return-studio.html`
- **Action:** Implement `blendCompress`/`blendRelease` in `bounceOffPlane`.
- **Links:** [DEC-002](#dec-002), [RES-002](#res-002), [EXP-002](#exp-002)

### TODO-002: Implement `scale` and `outputRescale` in `return-studio.html`
- **Action:** Apply `scale` to input velocities, `outputRescale` to output velocity.
- **Links:** [DEC-004](#dec-004), [RES-004](#res-004), [EXP-005](#exp-005), [EXP-008](#exp-008)

### TODO-003: Fix Force Formula for Short Balls
- **Action:** Investigate and fix force formula behavior for slow incoming balls (short balls).
- **Links:** [EXP-010](#exp-010)

### TODO-004: Remove `tiltX` Hack and Implement y-z Restricted `blend`
- **Action:** Remove `tiltX` code from `push-optimizer.js`. Implement y-z restricted `blend` in `return-studio.html`.
- **Links:** [DEC-005](#dec-005), [RES-005](#res-005), [EXP-006](#exp-006), [EXP-007](#exp-007)

### TODO-005: Run Full Joint Validation
- **Action:** Run 14-ball joint validation with the clean architecture.
- **Links:** [DEC-006](#dec-006), [RES-006](#res-006)

### TODO-006: Final Deployment Checks
- **Action:** Verify `PADDLE_BLEND=0` doesn't change existing behavior. Update formulas in `return-studio.html` and `game4.html`.
- **Links:** [DEC-003](#dec-003), [RES-003](#res-003)
# DRAFT: Physics tail candidate entries
#
# Status: draft only.
# This file is a candidate entry list and must not be treated as a final decision set.
# Last touched: 2026-07-06
