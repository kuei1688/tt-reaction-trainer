(function (root) {
  "use strict";

  const ALLOWED_SOURCE = Object.freeze({
    serve_id: "real_backspin_001",
    video_src: "./assets/serve-real-backspin-001.mp4"
  });
  const ALLOWED_TOP_LEVEL = new Set([
    "schema_version", "status", "source", "trigger", "anchor_uv",
    "physics_profile_id", "measurement", "created_at"
  ]);

  function fail(message) {
    throw new Error(`Invalid handoff draft: ${message}`);
  }

  function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function exactKeys(value, keys, name) {
    if (!isPlainObject(value)) fail(`${name} must be an object`);
    const actual = Object.keys(value);
    if (actual.length !== keys.length || actual.some((key) => !keys.includes(key))) {
      fail(`${name} has unsupported fields`);
    }
  }

  function finiteNumber(value, name) {
    if (!Number.isFinite(value)) fail(`${name} must be a finite number`);
    return value;
  }

  function validateDraft(value) {
    if (!isPlainObject(value)) fail("draft must be an object");
    for (const key of Object.keys(value)) {
      if (!ALLOWED_TOP_LEVEL.has(key)) fail(`unsupported top-level field ${key}`);
    }
    exactKeys(value, [...ALLOWED_TOP_LEVEL], "draft");
    if (value.schema_version !== 1) fail("schema_version must be 1");
    if (value.status !== "draft") fail("status must be draft");

    exactKeys(value.source, ["serve_id", "video_src"], "source");
    if (value.source.serve_id !== ALLOWED_SOURCE.serve_id || value.source.video_src !== ALLOWED_SOURCE.video_src) {
      fail("source must be the approved real_backspin_001 sample");
    }

    exactKeys(value.trigger, ["time_sec", "fps"], "trigger");
    const timeSec = finiteNumber(value.trigger.time_sec, "trigger.time_sec");
    if (value.trigger.fps !== 60 || Math.abs(timeSec * value.trigger.fps - Math.round(timeSec * value.trigger.fps)) > 1e-7) {
      fail("trigger must align to a 60 fps frame");
    }

    exactKeys(value.anchor_uv, ["x", "y"], "anchor_uv");
    for (const axis of ["x", "y"]) {
      const coordinate = finiteNumber(value.anchor_uv[axis], `anchor_uv.${axis}`);
      if (coordinate < 0 || coordinate > 1) fail(`anchor_uv.${axis} must be within 0..1`);
    }

    if (!["prototype_short", "prototype_long"].includes(value.physics_profile_id)) {
      fail("physics_profile_id must be an approved gameplay-approximation profile");
    }

    exactKeys(value.measurement, ["canvas_width_px", "canvas_height_px", "raw_delta_px"], "measurement");
    for (const key of ["canvas_width_px", "canvas_height_px"]) {
      if (!Number.isInteger(value.measurement[key]) || value.measurement[key] <= 0) fail(`measurement.${key} must be a positive integer`);
    }
    if (finiteNumber(value.measurement.raw_delta_px, "measurement.raw_delta_px") < 0) {
      fail("measurement.raw_delta_px must be non-negative");
    }
    if (typeof value.created_at !== "string" || Number.isNaN(Date.parse(value.created_at))) fail("created_at must be ISO-8601");
    return value;
  }

  const api = Object.freeze({ ALLOWED_SOURCE, validateDraft });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.HandoffDraftContract = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
