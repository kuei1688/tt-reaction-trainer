# Visual / manual check record

Date: 2026-07-15

## Automated geometry evidence

- E-01 records paired `+omega.y` / `-omega.y` net and bounce coordinates in `3d_physics_test_plan_raw.json`; the paired x sums are 0 at the tested magnitudes.
- E-04 records 47 trajectories, each with two bounces and no `netHit` result.
- E-07 records canonical `omega.y` contact sweeps without using the legacy `sidespin` value as the sweep input.

## Browser visual check

The requested 360×800 and desktop visual inspection was not completed. The in-app browser could not reach the localhost-only test server, and the browser security policy rejected direct `file:///` navigation. Binding the server to `0.0.0.0` was rejected because it would expose the workspace beyond the local visual check scope.

Therefore there is no screenshot or visual-pass claim in this baseline. The remaining checks are: inspect `+omega.y`/`-omega.y` curves in a permitted local browser, verify the bounce marker against the plotted `points`, and confirm Game 5 left/right input semantics against the video metadata.
