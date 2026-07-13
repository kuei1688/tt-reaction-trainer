(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.VideoLibraryContract = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VIDEO_EXTENSIONS = new Set([".mp4", ".webm", ".mov", ".avi", ".mkv"]);
  const COMPLETED_KEY = "video-library-shell:completed:v1";
  const DEFAULT_ENTRY = Object.freeze({ x: 0.313, y: 0.11 });
  const DEFAULT_FPS = 60;
  const DEFAULT_CONTACT = 1.283;
  const DEFAULT_OBSERVATION_END = 1.750;
  const DEFAULT_SPIN_NOTE = "";

  // ── Path helpers ──────────────────────────────────────────────

  function relativePath(file) {
    return file.webkitRelativePath || file.name;
  }

  // Extract the category (first folder under the selected root).
  // "images/contact_backspin/contact_backspin_001.mp4" → "contact_backspin"
  function categoryFromPath(path) {
    const parts = path.split(/[/\\]/);
    if (parts.length <= 2) return "uncategorized";
    return parts[1];
  }

  function isVideo(file) {
    const name = (file.name || "").toLowerCase();
    const dot = name.lastIndexOf(".");
    if (dot < 0) return false;
    return VIDEO_EXTENSIONS.has(name.substring(dot));
  }

  // ── Index building ────────────────────────────────────────────

  function buildIndex(files) {
    const videos = [];
    const categories = new Set();
    for (const file of files) {
      if (!isVideo(file)) continue;
      const path = relativePath(file);
      const category = categoryFromPath(path);
      categories.add(category);
      videos.push({
        name: file.name,
        path: path,
        category: category,
        size: file.size,
        id: file.name
      });
    }
    videos.sort(function (a, b) {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      return a.name.localeCompare(b.name);
    });
    return { videos: videos, categories: Array.from(categories).sort() };
  }

  // ── Completed-set tracking (localStorage) ─────────────────────

  function loadCompletedSet() {
    try {
      var raw = localStorage.getItem(COMPLETED_KEY);
      if (!raw) return new Set();
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? new Set(arr) : new Set();
    } catch (e) {
      return new Set();
    }
  }

  function saveCompletedSet(set) {
    try {
      localStorage.setItem(COMPLETED_KEY, JSON.stringify(Array.from(set)));
    } catch (e) {
      // localStorage may be unavailable (e.g. file:// in some browsers); ignore.
    }
  }

  function markCompleted(videoId) {
    var set = loadCompletedSet();
    set.add(videoId);
    saveCompletedSet(set);
  }

  function isCompleted(videoId) {
    return loadCompletedSet().has(videoId);
  }

  // ── Status resolution ─────────────────────────────────────────
  // draftStorageKeyFn is annotation-contract.draftStorageKey

  function videoStatus(videoId, draftStorageKeyFn) {
    if (isCompleted(videoId)) return "complete";
    try {
      if (localStorage.getItem(draftStorageKeyFn(videoId))) return "draft";
    } catch (e) {
      // localStorage unavailable
    }
    return "untouched";
  }

  function statusCounts(videos, draftStorageKeyFn) {
    var counts = { untouched: 0, draft: 0, complete: 0 };
    for (var i = 0; i < videos.length; i++) {
      counts[videoStatus(videos[i].id, draftStorageKeyFn)]++;
    }
    return counts;
  }

  // ── Batch manifest (export / import) ──────────────────────────

  function buildManifest(videos, draftStorageKeyFn) {
    var records = [];
    for (var i = 0; i < videos.length; i++) {
      var v = videos[i];
      var st = videoStatus(v.id, draftStorageKeyFn);
      var draft = null;
      if (st !== "untouched") {
        try {
          var raw = localStorage.getItem(draftStorageKeyFn(v.id));
          if (raw) draft = JSON.parse(raw);
        } catch (e) { /* skip */ }
      }
      records.push({
        id: v.id,
        name: v.name,
        category: v.category,
        path: v.path,
        status: st,
        draft: draft
      });
    }
    var counts = statusCounts(videos, draftStorageKeyFn);
    return {
      tool: "video-library-shell",
      version: 1,
      exported_at: new Date().toISOString(),
      total: records.length,
      completed: counts.complete,
      drafted: counts.draft,
      records: records
    };
  }

  function importManifest(manifest, draftStorageKeyFn) {
    if (!manifest || !Array.isArray(manifest.records)) return 0;
    var restored = 0;
    var completedSet = loadCompletedSet();
    for (var i = 0; i < manifest.records.length; i++) {
      var r = manifest.records[i];
      if (r.draft) {
        try {
          localStorage.setItem(draftStorageKeyFn(r.id), JSON.stringify(r.draft));
          restored++;
        } catch (e) { /* skip */ }
      }
      if (r.status === "complete") {
        completedSet.add(r.id);
      }
    }
    saveCompletedSet(completedSet);
    return restored;
  }

  return Object.freeze({
    VIDEO_EXTENSIONS: VIDEO_EXTENSIONS,
    COMPLETED_KEY: COMPLETED_KEY,
    DEFAULT_ENTRY: DEFAULT_ENTRY,
    DEFAULT_FPS: DEFAULT_FPS,
    DEFAULT_CONTACT: DEFAULT_CONTACT,
    DEFAULT_OBSERVATION_END: DEFAULT_OBSERVATION_END,
    DEFAULT_SPIN_NOTE: DEFAULT_SPIN_NOTE,
    relativePath: relativePath,
    categoryFromPath: categoryFromPath,
    isVideo: isVideo,
    buildIndex: buildIndex,
    loadCompletedSet: loadCompletedSet,
    saveCompletedSet: saveCompletedSet,
    markCompleted: markCompleted,
    isCompleted: isCompleted,
    videoStatus: videoStatus,
    statusCounts: statusCounts,
    buildManifest: buildManifest,
    importManifest: importManifest
  });
});
