# 2017 External Bounce/Spin Coordinate, Measurement, and Contact-Regime Review

Date: 2026-07-16
Status: `REVIEW COMPLETE / NOT CALIBRATED`

This review uses the user-provided
`C:\Users\Kevin\Downloads\2017_G0500606.pdf`, its extracted text, and visual
inspection of pages 2-5, especially Figs. 1-7. It does not change the
mainline-v2 contract or any physics parameter.

## 1. Confirmed measurement semantics

| Source quantity | Review result | Mainline-v2 implication | Confidence |
|---|---|---|---|
| `lower_disk_level` | Apparatus control variable: lower rotating disk level, not ball spin. | Keep it as source metadata, never as `omega`. | Confirmed by pp. 1-2 and Fig. 5-7 x-axes. |
| `Velocity Speed [m/s]` / 球の速さ | Scalar translational speed magnitude, not a named world component. | It can constrain `norm(velocity)`; `v.x` and the horizontal direction remain unknown. | Confirmed by Fig. 7 and conclusion text. |
| Incident/reflection angle | Scalar trajectory angle relative to the table plane is the high-confidence interpretation: values are about 14-23 degrees and the text compares incident and reflection angle over a horizontal table. The paper does not print the exact angle formula or signed direction. | Use a positive angle magnitude for screening; do not claim a signed world-space angle was measured. | Inferred from Fig. 5 and pp. 2-3; formula not explicit. |
| Rotation number [rps] / 回転数 | Spin-rate magnitude. The paper explains that the image method also estimates rotation axis, but Figs. 6-7 do not report the axis or sign. | Convert magnitude with `2π`; do not treat `omega.x`, its sign, or zero `omega.y/z` as measured facts. | Magnitude and unit confirmed; vector axis/sign not reported. |
| Before/after markers | Red is immediately before landing; green is immediately after landing. | The V8/V9 phase mapping is correct. | Confirmed on p. 2 and Figs. 5-7. |
| `Just After Shot` curve | Separate launch-state reference curve in Figs. 6-7, not the immediately-before-landing marker. | Do not mix it into the impact input or after-contact target. | Confirmed visually in Figs. 6-7. |

The PDF describes one-camera 3D reconstruction from the ball image, shadow,
light position, and a marked cross on the ball. That establishes that 3D
position and surface-marker motion were reconstructed, but it does not expose
the resulting world-coordinate vector or sign convention in the reported
figures.

## 2. Coordinate mapping review

The paper's Fig. 1 shows a calibration coordinate drawn on the table surface.
It is a paper/table calibration frame, not the mainline-v2 frame. The reported
figures do not define a canonical vertical axis, table normal sign, travel
direction, lateral direction, or signed rotation convention.

The current V8/V9 mapping is therefore correctly classified as a proxy:

```text
mainline-v2 table normal: +Y
incoming proxy velocity:  {x: 0, y: -speed*sin(angle), z: speed*cos(angle)}
incoming proxy omega:     {x: sign*2π*rps, y: 0, z: 0}
```

What is safe to carry into a normalized evidence row:

- `translation_speed_mps`: yes, as a scalar speed magnitude.
- `trajectory_angle_deg`: yes, as an unsigned table-plane angle with
  `angle_reference = table_plane_inferred`.
- `rotation_rate_rps` and `omega_magnitude_rad_per_s`: yes, as magnitudes.
- `velocity` vector: only as a benchmark-assumption proxy, not as measured
  source state.
- `omega` vector, `omega_axis`, and sign: not recoverable from Figs. 5-7.
- lateral velocity and any mixed/gyro/side component: not recoverable from the
  digitized rows.

The positive `omega.x` working sign remains useful because it reproduces the
external qualitative spin/speed directions in V8/V9. It must remain labelled
`working_sign_inference`, not `source_coordinate_sign`.

## 3. Pairing and uncertainty review

Figs. 5-7 plot multiple red and green markers at the same disk level. The
current CSV preserves min/max ranges per level and phase, but not a trial ID or
red-to-green pair. The paper also adjusts launch height so the ball lands while
holding launch angle constant; this means the level groups are experimental
conditions, not a single one-dimensional physical parameter.

Consequences:

- V9's independent full-factorial input grid is a valid feasibility screen.
- It is not a reconstruction of the paper's paired per-ball observations.
- The digitization uncertainty notes are plot-reading uncertainty, not the
  original experiment's standard deviation or instrument error.
- A scalar after value such as level 2 speed `9.0 m/s` should not be treated as
  a precise paired target without an original data table or trial linkage.

## 4. Contact-regime review

The 2017 PDF reports trajectories, speed, angle, rotation number, and a
qualitative explanation involving ball deformation and conversion between
rotational and translational energy. It does **not** report:

- contact force or normal-force time history;
- contact dwell time;
- contact-point slip velocity;
- friction coefficient;
- a sliding, rolling, or rolling-without-sliding label.

Therefore the external contact regime for this source must be recorded as
`not_reported`, not `sliding` or `rolling`.

The mainline-v2 `frictionRegime` is a model diagnostic derived from the solved
normal and tangent impulses. V9 classified all 3,240 fixed-policy samples as
`sliding`; this means only that the current candidate response is in its
sliding branch for these proxy inputs. It is not an observation that the 2017
experiment was sliding. The separate 47-preset mainline audit producing both
sliding and rolling cases confirms that the diagnostic is not hard-coded, but
does not validate either label against the 2017 paper.

The paper's deformation explanation is compatible with several contact models,
including a sliding contact with substantial spin transfer. It cannot identify
which model branch or which friction/compliance parameters produced the result.

## 5. Review decision

The V9 mismatch is now classified as a combination of:

1. **Source-state underdetermination**: scalar speed/angle/spin magnitude are
   available, but the full velocity vector and signed omega axis are not.
2. **Pairing underdetermination**: the figure ranges do not preserve trial
   pairing between before and after markers.
3. **External-regime underdetermination**: the 2017 source has no direct
   sliding/rolling observation or contact-force measurement.
4. **Remaining model mismatch**: even after input-range uncertainty is
   propagated, no sampled input matches angle, rotation, and speed together.

This is not enough evidence to tune friction, restitution, dwell, spring,
damping, or spin-transfer parameters. The correct normalized external row
semantics should use:

```text
angle_reference = table_plane_inferred
omega_magnitude = measured_rotation_rate * 2π
omega_vector = not_reported
omega_axis = not_reported
source_coordinate_sign = not_reported
contact_regime_external = not_reported
contact_regime_model = model_output_only
pairing_status = level_range_unpaired
measurement_error = plot_reading_uncertainty_only
```

## 6. Safe next gate

The next isolated benchmark should be a **semantics-aware representability
screen**, not parameter fitting. It should report separate cases for:

- table-plane angle versus the alternative table-normal angle convention;
- planar `v.x = 0` versus bounded unknown lateral velocity;
- `omega.x` sign and an explicitly unknown spin-axis label;
- external regime `not_reported` versus model regime output.

Only if the source semantics are sufficiently constrained and a holdout shows a
stable mismatch should an R1 candidate contact-model proposal be written. No
formal file promotion is authorized by this review.

