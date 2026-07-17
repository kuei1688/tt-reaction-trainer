# Formal migration failure classification — 2026-07-16

## Engineering gates that passed

- schema-2 omega state and one-time legacy conversion;
- Magnus direction and real-scale flight bridge;
- arbitrary-plane contact response, rolling condition, bounded friction, and fixed-plane energy non-increase;
- page-loader dependency closure with zero missing or unresolved symbols;
- five target pages parse their inline JavaScript;
- 47/47 legal-serve gate for `game4.html` and `physics-studio.html`;
- 47/47 cross-check between the two serve paths.

## Expected model-change diagnostics

The serve batch reports 50 target-precision failures, mostly `net_clearance_too_low`, `first_bounce_off_target`, and `second_bounce_off_target`. They occur while the common legal-serve gate remains 47/47 and the cross-check remains 47/47. Classification: forward-model behavior changed as a result of the shared schema/contact migration; this is calibration evidence, not an implementation crash.

## Still blocked on evidence

- No measured trajectory/spin dataset was introduced in this checkpoint; the shared compliant mode is therefore a generic engineering kernel, not a fitted rubber/sponge model.
- No Magnus, friction, restitution, blend, or preset geometry tuning was performed to suppress the target-precision failures.
- The duplicated substepped compliance path is not yet fully expressed through a shared compliant solver.
- Game 5 visual/feel and left/right input behavior still require manual review.
