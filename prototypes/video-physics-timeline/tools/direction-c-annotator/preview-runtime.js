(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DirectionCAnnotatorPreviewRuntime = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // The same stage geometry feeds drawTable(), worldToScreen and screenToWorld,
  // so the drawn table and the physics projection cannot drift apart.
  const MOBILE_TABLE_LAYOUT = Object.freeze({ farYRatio: 0.50, nearYRatio: 0.91, farHalfRatio: 0.26, nearHalfRatio: 0.46 });

  // How far before the annotated contact the preview starts playback, so the
  // OBSERVING state is visible before the C3 overlap fade begins.
  const PREVIEW_LEAD_SEC = 1.0;

  function requireDeps(deps) {
    if (!deps || !deps.projection || !deps.bridge || !Number.isFinite(deps.width) || !Number.isFinite(deps.height)) {
      throw new Error("projection, bridge, width and height are required");
    }
  }

  function requireProfile(profile) {
    const initial = profile && profile.initial_ball_state;
    if (!initial || !initial.position_m || !Number.isFinite(initial.position_m.y)) {
      throw new Error("profile.initial_ball_state.position_m.y is required");
    }
    return initial;
  }

  // Entry UV → world x/z at the profile's launch height. The entry point is a
  // Direction C product semantic; only position is overridden — velocity, spin
  // and gravity always come from the selected profile.
  function entryWorldPosition(entryUV, profile, deps) {
    requireDeps(deps);
    const initial = requireProfile(profile);
    const table = deps.bridge.constants.table;
    return deps.projection.screenToWorld(
      { x: entryUV.x * deps.width, y: entryUV.y * deps.height },
      table, deps.width, deps.height,
      { ...MOBILE_TABLE_LAYOUT, heightM: initial.position_m.y }
    );
  }

  function createEntryWorld(entryUV, profile, deps) {
    const initial = requireProfile(profile);
    return deps.bridge.createWorld({
      position_m: entryWorldPosition(entryUV, profile, deps),
      velocity_mps: initial.velocity_mps,
      spin_rps: initial.spin_rps
    }, profile);
  }

  function project(position, deps) {
    return deps.projection.worldToScreen(position, deps.bridge.constants.table, deps.width, deps.height, MOBILE_TABLE_LAYOUT);
  }

  // Static overlay polyline: run the profile physics from the entry point and
  // project every step onto the stage.
  function traceEntryTrajectory(entryUV, profile, deps, options) {
    const settings = options || {};
    const maxSteps = Number.isFinite(settings.maxSteps) ? settings.maxSteps : 84;
    const stepSec = Number.isFinite(settings.stepSec) ? settings.stepSec : 1 / 60;
    const world = createEntryWorld(entryUV, profile, deps);
    const points = [project(world.position, deps)];
    const bounces = [];
    for (let i = 0; i < maxSteps && !world.stopped; i += 1) {
      const snapshot = deps.bridge.stepWorld(world, stepSec);
      points.push(project(snapshot.position, deps));
      for (const event of snapshot.events) {
        if (event.type === "TABLE_BOUNCE") bounces.push(project(event.detail, deps));
      }
    }
    return { points, bounces, stopped: world.stopped, stopReason: world.stopReason };
  }

  // Incremental stepper for the animated preview ball: same physics world,
  // stepped by real frame deltas while the Experiment state machine runs.
  function createBallRun(entryUV, profile, deps) {
    const world = createEntryWorld(entryUV, profile, deps);
    return Object.freeze({
      step(deltaSec) {
        const snapshot = deps.bridge.stepWorld(world, deltaSec);
        return {
          screen: project(snapshot.position, deps),
          events: snapshot.events,
          stopped: snapshot.stopped,
          stopReason: snapshot.stopReason
        };
      },
      isStopped() { return world.stopped; }
    });
  }

  return Object.freeze({ MOBILE_TABLE_LAYOUT, PREVIEW_LEAD_SEC, entryWorldPosition, createEntryWorld, traceEntryTrajectory, createBallRun });
});
