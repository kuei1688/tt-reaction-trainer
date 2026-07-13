(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DirectionCAnnotationContract = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DEFAULT_SOURCE_VIDEO = "serve-real-backspin-001.mp4";
  const PROFILE_ID = "prototype_short";
  const STORAGE_PREFIX = "direction-c-annotator:draft:";
  const ALLOWED_LENGTHS = new Set(["short", "long"]);
  const MAX_SOURCE_LENGTH = 200;

  function fail(message) { throw new Error(`Invalid Direction C annotation: ${message}`); }
  function plainObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
  function finite(value, name) {
    if (!Number.isFinite(value)) fail(`${name} must be a finite number`);
    return value;
  }
  function exactKeys(value, keys, name) {
    if (!plainObject(value)) fail(`${name} must be an object`);
    const actual = Object.keys(value);
    if (actual.length !== keys.length || actual.some((key) => !keys.includes(key))) fail(`${name} has unsupported fields`);
  }
  function normalizedPoint(value, name) {
    exactKeys(value, ["x", "y"], name);
    for (const axis of ["x", "y"]) {
      const coordinate = finite(value[axis], `${name}.${axis}`);
      if (coordinate < 0 || coordinate > 1) fail(`${name}.${axis} must be within 0..1`);
    }
  }
  // Sources are freely selectable local files; the draft only records the file
  // name so a coach can match it, it never claims the file was verified.
  function validSourceVideo(value) {
    if (typeof value !== "string" || !value.trim() || value.length > MAX_SOURCE_LENGTH) {
      fail(`source_video must be a non-empty string of at most ${MAX_SOURCE_LENGTH} characters`);
    }
    return value;
  }
  function draftStorageKey(sourceVideo) {
    return `${STORAGE_PREFIX}${encodeURIComponent(validSourceVideo(sourceVideo || DEFAULT_SOURCE_VIDEO))}:v1`;
  }
  function validateAnnotation(value) {
    exactKeys(value, [
      "annotation_status", "source_video", "fps", "contact_time_sec", "observation_end_sec",
      "entry_position", "spin_note", "preview_profile_id", "allowed_variants_draft"
    ], "annotation");
    if (value.annotation_status !== "draft") fail("annotation_status must be draft");
    validSourceVideo(value.source_video);
    if (!Number.isInteger(value.fps) || value.fps < 1 || value.fps > 240) fail("fps must be an integer from 1 to 240");
    const contact = finite(value.contact_time_sec, "contact_time_sec");
    const end = finite(value.observation_end_sec, "observation_end_sec");
    if (contact < 0 || end <= contact) fail("observation_end_sec must be after contact_time_sec");
    normalizedPoint(value.entry_position, "entry_position");
    if (typeof value.spin_note !== "string" || !value.spin_note.trim() || value.spin_note.length > 280) fail("spin_note must be 1..280 characters");
    if (value.preview_profile_id !== PROFILE_ID) fail(`preview_profile_id must be ${PROFILE_ID}`);
    exactKeys(value.allowed_variants_draft, ["length", "placement", "speed", "review_status"], "allowed_variants_draft");
    for (const key of ["length", "placement", "speed"]) {
      if (!Array.isArray(value.allowed_variants_draft[key]) || value.allowed_variants_draft[key].some((item) => typeof item !== "string")) {
        fail(`allowed_variants_draft.${key} must be a string array`);
      }
    }
    if (value.allowed_variants_draft.length.some((length) => !ALLOWED_LENGTHS.has(length))) fail("allowed_variants_draft.length contains an unknown value");
    if (value.allowed_variants_draft.review_status !== "pending_coach") fail("review_status must be pending_coach");
    return value;
  }
  function makeDraft(values) {
    return validateAnnotation({
      annotation_status: "draft",
      source_video: values.source_video || DEFAULT_SOURCE_VIDEO,
      fps: values.fps,
      contact_time_sec: values.contact_time_sec,
      observation_end_sec: values.observation_end_sec,
      entry_position: { x: values.entry_position.x, y: values.entry_position.y },
      spin_note: values.spin_note,
      preview_profile_id: PROFILE_ID,
      allowed_variants_draft: {
        length: values.length || ["short"], placement: values.placement || [], speed: values.speed || [], review_status: "pending_coach"
      }
    });
  }
  return Object.freeze({ DEFAULT_SOURCE_VIDEO, PROFILE_ID, draftStorageKey, validateAnnotation, makeDraft });
});
