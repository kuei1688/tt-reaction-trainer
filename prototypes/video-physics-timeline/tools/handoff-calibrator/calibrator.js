(() => {
  "use strict";

  const FPS = 60;
  const CANVAS = Object.freeze({ width: 960, height: 540 });
  const STORAGE_KEY = "video-physics-handoff-calibrator:real_backspin_001:draft:v1";
  const SOURCE = window.HandoffDraftContract.ALLOWED_SOURCE;
  const els = Object.fromEntries([...document.querySelectorAll("[id]")].map((element) => [element.id, element]));
  let serve;
  let profiles = [];
  let anchor = null;
  let savedDraft = null;

  function snap(seconds) {
    return Math.round(Math.max(0, Number(seconds) || 0) * FPS) / FPS;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function currentProfile() {
    return profiles.find((profile) => profile.id === els.profile.value);
  }

  function currentProjection() {
    const profile = currentProfile();
    if (!profile) return null;
    return window.VideoPhysicsProjection.worldToScreen(
      profile.physics.initial_ball_state.position_m,
      window.PrototypePhysicsBridge.constants.table,
      CANVAS.width,
      CANVAS.height
    );
  }

  function rawDelta() {
    const point = currentProjection();
    if (!anchor || !point) return null;
    return Math.hypot(anchor.x * CANVAS.width - point.x, anchor.y * CANVAS.height - point.y);
  }

  function formatTime(seconds) {
    return `${snap(seconds).toFixed(3)} s · frame ${Math.round(snap(seconds) * FPS)}`;
  }

  function setVideoTime(seconds) {
    const duration = Number.isFinite(els.video.duration) ? els.video.duration : serve.video.expected_duration_sec;
    const next = clamp(snap(seconds), 0, snap(duration));
    els.video.currentTime = next;
    els.trigger.value = next.toFixed(6);
    render();
  }

  function drawMarker(element, point, className) {
    element.className = className;
    element.hidden = !point;
    if (!point) return;
    element.style.left = `${point.x * 100}%`;
    element.style.top = `${point.y * 100}%`;
  }

  function draft() {
    const delta = rawDelta();
    if (!anchor || delta === null) return null;
    return {
      schema_version: 1,
      status: "draft",
      source: { ...SOURCE },
      trigger: { time_sec: snap(els.trigger.value), fps: FPS },
      anchor_uv: { x: anchor.x, y: anchor.y },
      physics_profile_id: els.profile.value,
      measurement: {
        canvas_width_px: CANVAS.width,
        canvas_height_px: CANVAS.height,
        raw_delta_px: delta
      },
      created_at: new Date().toISOString()
    };
  }

  function render() {
    const projection = currentProjection();
    drawMarker(els.anchorMarker, anchor, "marker anchor-marker");
    drawMarker(els.physicsMarker, projection && { x: projection.x / CANVAS.width, y: projection.y / CANVAS.height }, "marker physics-marker");
    const delta = rawDelta();
    els.timeReadout.textContent = formatTime(els.video.currentTime || els.trigger.value);
    els.triggerReadout.textContent = formatTime(els.trigger.value);
    els.anchorReadout.textContent = anchor ? `${anchor.x.toFixed(4)}, ${anchor.y.toFixed(4)}` : "尚未標記";
    els.profileReadout.textContent = els.profile.value || "尚未選擇";
    els.projectionReadout.textContent = projection ? `${projection.x.toFixed(1)}, ${projection.y.toFixed(1)} px` : "—";
    els.deltaReadout.textContent = delta === null ? "先標記 anchor" : `${delta.toFixed(1)} px${delta >= 100 ? " · large delta" : ""}`;
    els.deltaReadout.classList.toggle("large", delta !== null && delta >= 100);
    els.saveDraft.disabled = !draft();
    els.exportDraft.disabled = !draft();
  }

  function applyDraft(value) {
    window.HandoffDraftContract.validateDraft(value);
    anchor = { ...value.anchor_uv };
    els.profile.value = value.physics_profile_id;
    setVideoTime(value.trigger.time_sec);
    render();
  }

  function saveLocal() {
    const value = draft();
    window.HandoffDraftContract.validateDraft(value);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    els.saveMessage.textContent = "已保存為本機草稿；未發布。";
  }

  function exportDraft() {
    const value = draft();
    window.HandoffDraftContract.validateDraft(value);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
    link.download = "real_backspin_001-handoff-draft.json";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function restoreSavedDraft() {
    if (!savedDraft) return;
    try {
      applyDraft(JSON.parse(savedDraft));
      els.saveMessage.textContent = "已重載本機草稿；未發布。";
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      els.saveMessage.textContent = "舊本機資料不符合草稿契約，已忽略。";
    }
  }

  async function initialize() {
    if (!window.VideoPhysicsProjection || !window.PrototypePhysicsBridge || !window.HandoffDraftContract) {
      throw new Error("校準器相依元件未載入");
    }
    const response = await fetch("../../timeline-config.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`無法讀取 prototype config（HTTP ${response.status}）`);
    const config = await response.json();
    serve = config.serves.find((item) => item.id === SOURCE.serve_id);
    profiles = config.serves.filter((item) => ["prototype_short", "prototype_long"].includes(item.id));
    if (!serve || serve.video.src !== SOURCE.video_src || profiles.length !== 2) throw new Error("prototype config 不符合 Phase 1 固定範圍");
    if (serve.video.generation_status !== "ready") throw new Error("探索性樣本狀態與已知例外不一致，停止校準");

    els.video.src = "../../assets/serve-real-backspin-001.mp4";
    els.video.addEventListener("loadedmetadata", () => {
      const duration = snap(els.video.duration);
      if (Math.abs(duration - serve.video.expected_duration_sec) > 1 / FPS) {
        throw new Error("影片 metadata 與既有 60 fps 時間語意不一致，停止校準");
      }
      els.trigger.max = duration;
      els.trigger.value = snap(serve.video.physics_trigger_time_sec).toFixed(6);
      els.video.currentTime = snap(serve.video.physics_trigger_time_sec);
      restoreSavedDraft();
      render();
    }, { once: true });
    els.video.load();

    for (const profile of profiles) {
      const option = document.createElement("option");
      option.value = profile.id;
      option.textContent = profile.label || profile.id;
      els.profile.append(option);
    }
    els.profile.value = "prototype_short";
    els.sourceReadout.textContent = `${serve.id} · 探索性 ready，未校準／不可發布`;
    els.video.addEventListener("timeupdate", render);
    els.stage.addEventListener("click", (event) => {
      const rect = els.stage.getBoundingClientRect();
      anchor = {
        x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
        y: clamp((event.clientY - rect.top) / rect.height, 0, 1)
      };
      render();
    });
    els.playToggle.addEventListener("click", () => (els.video.paused ? els.video.play() : els.video.pause()));
    els.stepBack.addEventListener("click", () => { els.video.pause(); setVideoTime((els.video.currentTime || 0) - 1 / FPS); });
    els.stepForward.addEventListener("click", () => { els.video.pause(); setVideoTime((els.video.currentTime || 0) + 1 / FPS); });
    els.trigger.addEventListener("change", () => { els.video.pause(); setVideoTime(els.trigger.value); });
    els.profile.addEventListener("change", render);
    els.saveDraft.addEventListener("click", saveLocal);
    els.exportDraft.addEventListener("click", exportDraft);
    els.importDraft.addEventListener("change", async () => {
      const file = els.importDraft.files[0];
      if (!file) return;
      try {
        applyDraft(JSON.parse(await file.text()));
        els.saveMessage.textContent = "已匯入有效草稿；仍為未發布。";
      } catch (error) {
        els.saveMessage.textContent = `匯入被拒絕：${error.message}`;
      }
      els.importDraft.value = "";
    });
    savedDraft = localStorage.getItem(STORAGE_KEY);
    render();
  }

  initialize().catch((error) => {
    els.error.hidden = false;
    els.error.textContent = `校準器停止：${error.message}`;
  });
})();
