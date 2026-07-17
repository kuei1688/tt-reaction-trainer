(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.MainlineV2ProductData = factory();
  }
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function finite(value, label) {
    if (!Number.isFinite(value)) throw new Error(`${label} must be finite`);
    return value;
  }

  function canonicalizeVideo(raw, index) {
    const label = raw && (raw.id || raw.src) || `video[${index}]`;
    if (!raw || typeof raw !== "object") throw new Error(`${label} must be an object`);
    if (raw.kind !== "video" || raw.reviewStatus !== "approved") {
      throw new Error(`${label} must be an approved video`);
    }
    if (!raw.id || typeof raw.id !== "string") throw new Error(`${label} is missing id`);
    if (!raw.src || typeof raw.src !== "string") throw new Error(`${label} is missing src`);
    return Object.freeze({
      id: raw.id,
      src: raw.src,
      kind: "video",
      spinType: raw.spinType == null ? "" : String(raw.spinType),
      reviewStatus: "approved",
      contactTimeSec: Number.isFinite(raw.contact_time_sec) ? finite(raw.contact_time_sec, `${label}.contact_time_sec`) : null,
    });
  }

  function loadVideoCollection(document) {
    const raw = Array.isArray(document) ? document : document && document.videos;
    if (!Array.isArray(raw) || raw.length === 0) {
      throw new Error("video document must contain an array");
    }
    const videos = raw
      .filter((entry) => entry && entry.kind === "video" && entry.reviewStatus === "approved")
      .map(canonicalizeVideo);
    if (videos.length === 0) throw new Error("video document contains no approved videos");
    const ids = new Set();
    for (const video of videos) {
      if (ids.has(video.id)) throw new Error(`duplicate approved video id: ${video.id}`);
      ids.add(video.id);
    }
    return videos;
  }

  function buildRoundCatalog(presets, videos) {
    if (!Array.isArray(presets) || presets.length === 0) {
      throw new Error("canonical presets are required for product rounds");
    }
    const videoById = new Map((videos || []).map((video) => [video.id, video]));
    const usedVideoIds = new Set();
    return presets.map((preset) => {
      const videoId = preset.tags && preset.tags.videoId;
      if (!videoId) throw new Error(`${preset.id} is missing canonical tags.videoId`);
      const video = videoById.get(videoId);
      if (!video) throw new Error(`${preset.id} has no approved video for ${videoId}`);
      if (usedVideoIds.has(videoId)) throw new Error(`videoId is not 1:1: ${videoId}`);
      usedVideoIds.add(videoId);
      return Object.freeze({preset, video});
    });
  }

  function findMixedRound(rounds) {
    return (rounds || []).find((round) => {
      const omega = round.preset.variation.spin3d.omega;
      return Math.abs(omega.x) > 0 && Math.abs(omega.y) > 0;
    }) || null;
  }

  async function loadVideoFile(url, fetchImplementation) {
    const fetcher = fetchImplementation || (typeof fetch === "function" ? fetch : null);
    if (!fetcher) throw new Error("fetch is required to load product video data");
    const response = await fetcher(url);
    if (!response.ok) throw new Error(`video request failed: ${response.status}`);
    return loadVideoCollection(await response.json());
  }

  return Object.freeze({
    canonicalizeVideo,
    loadVideoCollection,
    buildRoundCatalog,
    findMixedRound,
    loadVideoFile,
  });
}));
