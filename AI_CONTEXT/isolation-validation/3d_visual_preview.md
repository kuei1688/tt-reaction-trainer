# Isolated 3D physics behavior preview

Date: 2026-07-16

## Purpose

This is an isolated visual sanity check for the simple, vector-consistent 3D physics direction. It is not a calibration run and is not an acceptance gate against the 2017 external experiment.

Tool:

- `tools/3d-physics-behavior-preview.html`

The preview reads the existing shared physics core and mainline-v2 state helpers without editing them. It exposes the same canonical BallState/omega semantics used by the isolated qualitative checks: 3D position and velocity, world-space angular velocity, table plane normal, contact-point velocity, flight Magnus term, and plane contact response.

## Scenarios shown

- zero spin
- positive and negative x-axis spin
- positive and negative y-axis side spin
- mixed spin
- mixed spin against a tilted table normal

The canvas is a compact 2D projection of the 3D state so that the trajectory, table plane, velocity vector, bounce markers, omega, and contact count can be inspected together. The projection is for understanding behavior, not for replacing a 3D renderer.

## Browser validation

- Preview loaded successfully from the local server with HTTP 200.
- Initial render showed the table plane, ball, velocity vector, and faint planned trajectory.
- Scenario selection changed the readouts to `omega.y +` side spin.
- One-step advance changed the BallState position.
- Play/pause worked; during the side-spin run the lateral readout changed to approximately `0.023 m`, showing the expected signed lateral flight effect.
- No formal page, shared core, mainline-v2, or preset file was modified by this preview step.

## Interpretation and boundary

This confirms that the simple model is visually representable and that the principal 3D effects are observable in one consistent state path. It does not establish material parameters, exact contact-regime identification, or numerical agreement with the external report. Any future product integration should be a separately authorized R1 change after the current scope is accepted.

## Playback timing correction

The first visual review correctly noticed that the ball appeared to fall too slowly. The isolated preview was using the real gravity value `-9.81 m/s²`, but the animation advanced only two `1/240 s` samples per requestAnimationFrame, which made playback approximately `0.5×` real time at 60 FPS. The preview now uses elapsed wall-clock time at `PLAYBACK_RATE = 1`; this changes only presentation timing, not gravity or the physics state.
