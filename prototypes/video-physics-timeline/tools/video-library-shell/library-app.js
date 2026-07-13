(() => {
  "use strict";

  // ── Dependencies ──────────────────────────────────────────────
  const lib = window.VideoLibraryContract;
  const contract = window.DirectionCAnnotationContract;
  const projection = window.VideoPhysicsProjection;
  const bridge = window.PrototypePhysicsBridge;
  const runtime = window.DirectionCAnnotatorPreviewRuntime;
  const { Experiment, STATES } = window.DirectionCExperiment;
  const dragApi = window.DirectionCEntryDrag;
  const $ = (id) => document.getElementById(id);

  // ── DOM refs ──────────────────────────────────────────────────
  const libEls = Object.fromEntries([
    "libraryPanel","intakeZone","folderInput","intakeHint","libraryContent",
    "searchInput","categoryFilter","statusFilter","progressDone","progressTotal",
    "gridContainer","exportBtn","importBtn","importInput","rescanBtn"
  ].map((id) => [id, $(id)]));
  const annEls = Object.fromEntries([
    "annotatorPanel","backToLibrary","annotatorTitle","stage","videoFrame","video",
    "overlay","entry","stepBack","playPause","stepForward","scrub","timeReadout",
    "sourceName","fps","contactTime","observationEnd","entryX","entryY","spinNote",
    "setContact","setEnd","runPreview","saveDraft","markComplete","copyJson",
    "output","validation"
  ].map((id) => [id, $(id)]));
  const ctx = annEls.overlay.getContext("2d");

  // ── State ─────────────────────────────────────────────────────
  const fallbackProfile = { gravity_mps2: -4.2, hit_window_z_m: 1.32, initial_ball_state: { position_m: { x: .2, y: 1.05, z: .15 }, velocity_mps: { x: .35, y: -.4, z: 2.6 }, spin_rps: { x: 0, y: 8, z: -18 } } };
  let profile = fallbackProfile;
  let entry = { x: .313, y: .11 };
  let drag = null;
  let sourceVideo = "";
  let sourceUrl = null;
  let preview = null;
  let trajectoryAlpha = 1;
  let fadeStartMs = 0;
  const FADE_MS = 320;

  // Library state
  let fileMap = {};
  let videoIndex = [];
  let allCategories = [];
  let thumbnailQueue = [];
  let thumbProcessing = 0;
  const MAX_THUMB_PARALLEL = 3;

  // ── Utility ───────────────────────────────────────────────────
  const clamp = (v, mn, mx) => Math.max(mn, Math.min(mx, v));
  const finite = (v) => Number.isFinite(Number(v)) ? Number(v) : NaN;
  function fps() { return Math.max(1, Math.min(240, Math.round(finite(annEls.fps.value) || 60))); }
  function snap(s) { return Math.round(Math.max(0, s) * fps()) / fps(); }
  function setValidation(msg, kind) { annEls.validation.textContent = msg; annEls.validation.className = "validation " + (kind || ""); }

  const CATEGORY_COLORS = ["#f59e0b","#3b82f6","#a855f7","#22c55e","#ef4444","#06b6d4","#ec4899","#eab308"];
  function categoryColor(cat) {
    const idx = allCategories.indexOf(cat);
    return CATEGORY_COLORS[idx % CATEGORY_COLORS.length] || "#6b7280";
  }

  // Find a card by video id without CSS.escape (safe for filenames with dots)
  function findCard(videoId) {
    const cards = libEls.gridContainer.querySelectorAll(".vcard");
    for (let i = 0; i < cards.length; i++) {
      if (cards[i].dataset.videoId === videoId) return cards[i];
    }
    return null;
  }

  // ═══════════════════════════════════════════════════════════════
  //  LIBRARY MODE
  // ═══════════════════════════════════════════════════════════════

  function handleFolderSelect() {
    const files = libEls.folderInput.files;
    if (!files || !files.length) return;
    libEls.intakeHint.textContent = "正在讀取資料夾…";
    const index = lib.buildIndex(files);
    if (index.videos.length === 0) {
      libEls.intakeHint.textContent = "選取的資料夾裡沒有找到影片檔（MP4 / WebM / MOV）。";
      return;
    }
    fileMap = {};
    for (const f of files) {
      if (lib.isVideo(f)) fileMap[f.name] = f;
    }
    videoIndex = index.videos;
    allCategories = index.categories;
    libEls.intakeZone.hidden = true;
    libEls.libraryContent.hidden = false;
    populateCategoryFilter();
    renderGrid();
    loadProfile();
  }

  function populateCategoryFilter() {
    const sel = libEls.categoryFilter;
    sel.innerHTML = '<option value="">全部類別</option>';
    for (const cat of allCategories) {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = cat + " (" + videoIndex.filter(v => v.category === cat).length + ")";
      sel.appendChild(opt);
    }
  }

  function getFilteredVideos() {
    const q = libEls.searchInput.value.trim().toLowerCase();
    const cat = libEls.categoryFilter.value;
    const st = libEls.statusFilter.value;
    return videoIndex.filter((v) => {
      if (q && !v.name.toLowerCase().includes(q)) return false;
      if (cat && v.category !== cat) return false;
      if (st) {
        const vs = lib.videoStatus(v.id, contract.draftStorageKey);
        if (vs !== st) return false;
      }
      return true;
    });
  }

  function updateProgress() {
    const counts = lib.statusCounts(videoIndex, contract.draftStorageKey);
    libEls.progressDone.textContent = counts.draft + counts.complete;
    libEls.progressTotal.textContent = videoIndex.length;
  }

  function renderGrid() {
    const videos = getFilteredVideos();
    const container = libEls.gridContainer;
    container.innerHTML = "";
    updateProgress();

    const groups = {};
    for (const v of videos) {
      if (!groups[v.category]) groups[v.category] = [];
      groups[v.category].push(v);
    }

    for (const cat of allCategories) {
      if (!groups[cat]) continue;
      const groupEl = document.createElement("div");
      groupEl.className = "category-group";

      const header = document.createElement("div");
      header.className = "category-header";
      const bar = document.createElement("span");
      bar.className = "category-bar";
      bar.style.background = categoryColor(cat);
      bar.style.color = categoryColor(cat);
      header.appendChild(bar);
      header.appendChild(document.createTextNode(cat));
      const cnt = document.createElement("span");
      cnt.className = "category-count";
      cnt.textContent = groups[cat].length + " 支";
      header.appendChild(cnt);
      groupEl.appendChild(header);

      const grid = document.createElement("div");
      grid.className = "grid";
      for (const v of groups[cat]) {
        grid.appendChild(createCard(v));
      }
      groupEl.appendChild(grid);
      container.appendChild(groupEl);
    }

    if (videos.length === 0) {
      container.innerHTML = '<p class="muted" style="text-align:center;padding:30px">沒有符合篩選條件的影片。</p>';
    }

    thumbnailQueue = videos.slice();
    processThumbnails();
  }

  function createCard(v) {
    const status = lib.videoStatus(v.id, contract.draftStorageKey);
    const card = document.createElement("div");
    card.className = "vcard " + status;
    card.dataset.videoId = v.id;

    const badge = document.createElement("span");
    badge.className = "badge " + status;
    card.appendChild(badge);

    const thumb = document.createElement("div");
    thumb.className = "thumb";
    const ph = document.createElement("span");
    ph.className = "placeholder";
    ph.textContent = "\u25B6";
    thumb.appendChild(ph);
    card.appendChild(thumb);

    const meta = document.createElement("div");
    meta.className = "meta";
    const fname = document.createElement("div");
    fname.className = "fname";
    fname.textContent = v.name;
    meta.appendChild(fname);
    const dur = document.createElement("div");
    dur.className = "duration";
    dur.textContent = Math.round(v.size / 1024) + " KB";
    meta.appendChild(dur);
    card.appendChild(meta);

    card.addEventListener("click", () => openAnnotator(v.id));
    return card;
  }

  // ── Thumbnail generation (lazy, queued) ───────────────────────
  function processThumbnails() {
    while (thumbProcessing < MAX_THUMB_PARALLEL && thumbnailQueue.length > 0) {
      const v = thumbnailQueue.shift();
      const file = fileMap[v.id];
      if (!file) continue;
      thumbProcessing++;
      generateThumbnail(file, v.id).then((dataUrl) => {
        thumbProcessing--;
        const card = findCard(v.id);
        if (card && dataUrl) {
          const thumb = card.querySelector(".thumb");
          thumb.innerHTML = "";
          const img = document.createElement("img");
          img.src = dataUrl;
          thumb.appendChild(img);
        }
        processThumbnails();
      }).catch(() => { thumbProcessing--; processThumbnails(); });
    }
  }

  function generateThumbnail(file, videoId) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const vid = document.createElement("video");
      vid.muted = true;
      vid.playsInline = true;
      vid.preload = "auto";
      vid.src = url;
      // Attach to DOM (hidden) so browsers will actually load and decode frames
      vid.style.cssText = "position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px;";
      document.body.appendChild(vid);

      let settled = false;
      const cleanup = () => {
        URL.revokeObjectURL(url);
        vid.removeAttribute("src");
        try { vid.load(); } catch (e) {}
        if (vid.parentNode) vid.parentNode.removeChild(vid);
      };
      const fail = () => { if (settled) return; settled = true; cleanup(); reject(); };
      const succeed = (d) => { if (settled) return; settled = true; cleanup(); resolve(d); };

      vid.addEventListener("error", fail);
      // Use loadedmetadata (fires after metadata is parsed), then seek to
      // force the browser to decode and display a frame.
      vid.addEventListener("loadedmetadata", () => {
        const dur = vid.duration || 0;
        const t = dur > 0.5 ? dur * 0.1 : 0.05;
        try { vid.currentTime = t; } catch (e) { fail(); }
      });
      vid.addEventListener("seeked", () => {
        try {
          const c = document.createElement("canvas");
          c.width = 90; c.height = 160;
          const cx2 = c.getContext("2d");
          cx2.drawImage(vid, 0, 0, c.width, c.height);
          succeed(c.toDataURL("image/jpeg", 0.6));
        } catch (e) { fail(); }
      });
      setTimeout(fail, 10000);
    });
  }

  // ── Export / Import ───────────────────────────────────────────
  function exportManifest() {
    const manifest = lib.buildManifest(videoIndex, contract.draftStorageKey);
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "video-library-drafts-" + new Date().toISOString().slice(0, 10) + ".json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport() {
    const file = libEls.importInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const manifest = JSON.parse(reader.result);
        const restored = lib.importManifest(manifest, contract.draftStorageKey);
        renderGrid();
        alert("已匯入 " + restored + " 份草稿。");
      } catch (e) {
        alert("匯入失敗：檔案格式不正確。");
      }
    };
    reader.readAsText(file);
    libEls.importInput.value = "";
  }

  // ═══════════════════════════════════════════════════════════════
  //  ANNOTATOR MODE
  // ═══════════════════════════════════════════════════════════════

  function openAnnotator(videoId) {
    const file = fileMap[videoId];
    if (!file) return;
    libEls.libraryPanel.hidden = true;
    annEls.annotatorPanel.hidden = false;
    annEls.annotatorTitle.textContent = videoId;
    resizeCanvas();
    selectSourceFile(file);
  }

  function backToLibrary() {
    stopPreview();
    annEls.video.pause();
    if (sourceUrl) { URL.revokeObjectURL(sourceUrl); sourceUrl = null; }
    annEls.video.removeAttribute("src");
    try { annEls.video.load(); } catch (e) {}
    annEls.annotatorPanel.hidden = true;
    libEls.libraryPanel.hidden = false;
    renderGrid();
  }

  // ── Annotator core ────────────────────────────────────────────
  function readValues() {
    return {
      source_video: sourceVideo,
      fps: fps(),
      contact_time_sec: finite(annEls.contactTime.value),
      observation_end_sec: finite(annEls.observationEnd.value),
      entry_position: entry,
      spin_note: annEls.spinNote.value.trim() || "需由教練複核。"
    };
  }
  function makeDraft() { return contract.makeDraft(readValues()); }
  function updateOutput() {
    try {
      const draft = makeDraft();
      annEls.output.value = JSON.stringify(draft, null, 2);
      setValidation("草稿格式有效；仍待教練審核。", "ok");
      return draft;
    } catch (error) {
      annEls.output.value = "";
      setValidation(error.message, "error");
      return null;
    }
  }
  function projectionDeps() {
    return { projection, bridge, width: annEls.overlay.width, height: annEls.overlay.height };
  }
  function setEntry(next) {
    entry = { x: clamp(finite(next.x), .02, .98), y: clamp(finite(next.y), .02, .98) };
    annEls.entry.style.left = (entry.x * 100) + "%";
    annEls.entry.style.top = (entry.y * 100) + "%";
    annEls.entryX.value = entry.x.toFixed(3);
    annEls.entryY.value = entry.y.toFixed(3);
    draw(); updateOutput();
  }
  function resizeCanvas() {
    const rect = annEls.stage.getBoundingClientRect();
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    annEls.overlay.width = Math.max(1, Math.round(rect.width * scale));
    annEls.overlay.height = Math.max(1, Math.round(rect.height * scale));
    draw();
  }
  function trajectory() {
    try { return runtime.traceEntryTrajectory(entry, profile, projectionDeps()); }
    catch (e) { return { points: [], bounces: [] }; }
  }
  function drawTable() {
    const w = annEls.overlay.width, h = annEls.overlay.height;
    const layout = runtime.MOBILE_TABLE_LAYOUT;
    const table = projection.tableGeometry(w, h, layout);
    const cx = w / 2;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#04111acc";
    ctx.fillRect(0, h * layout.farYRatio, w, h * (1 - layout.farYRatio));
    ctx.fillStyle = "#076d8f88";
    ctx.beginPath();
    ctx.moveTo(cx - table.farHalf, table.farY);
    ctx.lineTo(cx + table.farHalf, table.farY);
    ctx.lineTo(cx + table.nearHalf, table.nearY);
    ctx.lineTo(cx - table.nearHalf, table.nearY);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#dcf3ffb5"; ctx.lineWidth = Math.max(1, w / 520); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, table.farY); ctx.lineTo(cx, table.nearY); ctx.stroke();
    const netY = table.farY + (table.nearY - table.farY) * .5;
    ctx.strokeStyle = "#f0f8ffc9";
    ctx.beginPath(); ctx.moveTo(cx - table.nearHalf * .75, netY); ctx.lineTo(cx + table.nearHalf * .75, netY); ctx.stroke();
  }
  function draw() {
    drawTable();
    const inPreview = preview != null;
    if (inPreview) { trajectoryAlpha = 0; fadeStartMs = 0; }
    else if (fadeStartMs) {
      const t = Math.min(1, (performance.now() - fadeStartMs) / FADE_MS);
      trajectoryAlpha = t;
      if (t < 1) requestAnimationFrame(() => draw()); else fadeStartMs = 0;
    } else trajectoryAlpha = 1;
    if (trajectoryAlpha > 0.01) {
      const traj = trajectory();
      if (traj.points.length) {
        ctx.globalAlpha = trajectoryAlpha;
        ctx.strokeStyle = "#5eead4";
        ctx.lineWidth = Math.max(2, annEls.overlay.width / 280);
        ctx.setLineDash([annEls.overlay.width / 70, annEls.overlay.width / 95]);
        ctx.beginPath();
        traj.points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
        ctx.stroke(); ctx.setLineDash([]);
        for (const p of traj.bounces) {
          ctx.fillStyle = "#ffd166";
          ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(4, annEls.overlay.width / 90), 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }
    if (preview && preview.ballPoint) {
      const r = Math.max(12, annEls.overlay.width / 30);
      ctx.save();
      ctx.shadowColor = "rgba(2,8,16,0.55)";
      ctx.shadowBlur = Math.max(10, annEls.overlay.width / 50);
      ctx.fillStyle = "#fef9c3"; ctx.strokeStyle = "#0b1727";
      ctx.lineWidth = Math.max(2, annEls.overlay.width / 300);
      ctx.beginPath(); ctx.arc(preview.ballPoint.x, preview.ballPoint.y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }
  function updateTime() {
    annEls.timeReadout.textContent = annEls.video.currentTime.toFixed(3) + " / " + (annEls.video.duration || 0).toFixed(3) + " s";
    annEls.scrub.value = annEls.video.currentTime || 0;
  }
  function stopPreview() {
    const wasPreviewing = preview != null;
    if (preview) cancelAnimationFrame(preview.frameId);
    preview = null;
    annEls.videoFrame.classList.remove("c3-playing");
    if (wasPreviewing) fadeStartMs = performance.now();
    draw();
  }
  function previewLoop(nowMs) {
    if (!preview) return;
    const deltaSec = clamp((nowMs - preview.lastNowMs) / 1000, 0, .1);
    preview.lastNowMs = nowMs;
    const mediaTime = annEls.video.ended ? Math.max(annEls.video.currentTime, preview.endSec) : annEls.video.currentTime;
    const snapshot = preview.experiment.tick(mediaTime, nowMs);
    if (snapshot.showTrainingBall && !preview.ball) {
      try { preview.ball = runtime.createBallRun(entry, profile, projectionDeps()); }
      catch (error) { stopPreview(); setValidation(error.message, "error"); return; }
      annEls.videoFrame.classList.add("c3-playing");
    }
    if (preview.ball && !preview.ball.isStopped()) preview.ballPoint = preview.ball.step(deltaSec).screen;
    if (snapshot.state === STATES.TRAINING) annEls.video.pause();
    if (snapshot.state === STATES.COMPLETE) {
      annEls.video.pause(); stopPreview();
      setValidation("C3 預覽完成：影片層已讓位，訓練球以 profile 真實物理跑完。", "ok");
      return;
    }
    draw();
    preview.frameId = requestAnimationFrame(previewLoop);
  }
  function runPreview() {
    try {
      const contact = finite(annEls.contactTime.value);
      const end = finite(annEls.observationEnd.value);
      const experiment = new Experiment(contact, end);
      stopPreview();
      annEls.videoFrame.style.setProperty("--c3-fade-ms", Math.max(120, (end - contact) * 1000) + "ms");
      annEls.video.pause();
      annEls.video.currentTime = Math.max(0, contact - runtime.PREVIEW_LEAD_SEC);
      experiment.start("C3", performance.now());
      preview = { experiment, ball: null, ballPoint: null, lastNowMs: performance.now(), frameId: 0, endSec: end };
      annEls.video.play().catch(() => {});
      preview.frameId = requestAnimationFrame(previewLoop);
      setValidation("C3 預覽執行中：觀察 → 觸球後影片淡出 → 訓練球以 profile 真實物理從入射點入場。", "ok");
    } catch (error) { setValidation(error.message, "error"); }
  }
  function seekBy(frames) {
    stopPreview(); annEls.video.pause();
    annEls.video.currentTime = clamp((annEls.video.currentTime || 0) + frames / fps(), 0, annEls.video.duration || Infinity);
  }
  function setCurrent(field) { field.value = snap(annEls.video.currentTime || 0).toFixed(3); updateOutput(); }

  function restoreDraft() {
    try {
      const saved = JSON.parse(localStorage.getItem(contract.draftStorageKey(sourceVideo)));
      if (!saved) return false;
      contract.validateAnnotation(saved);
      annEls.fps.value = saved.fps;
      annEls.contactTime.value = saved.contact_time_sec.toFixed(3);
      annEls.observationEnd.value = saved.observation_end_sec.toFixed(3);
      annEls.spinNote.value = saved.spin_note;
      setEntry(saved.entry_position);
      setValidation("已還原「" + sourceVideo + "」的本機草稿。", "ok");
      return true;
    } catch (e) { return false; }
  }

  function selectSourceFile(file) {
    if (!file) return;
    stopPreview();
    annEls.video.pause();
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    sourceUrl = URL.createObjectURL(file);
    sourceVideo = file.name;
    annEls.sourceName.value = sourceVideo;
    annEls.video.src = sourceUrl;
    annEls.video.load();
    // Reset annotation fields to defaults
    annEls.fps.value = lib.DEFAULT_FPS;
    annEls.contactTime.value = lib.DEFAULT_CONTACT;
    annEls.observationEnd.value = lib.DEFAULT_OBSERVATION_END;
    annEls.spinNote.value = "需由教練複核。";
    setEntry(lib.DEFAULT_ENTRY);
    updateOutput();
    if (!restoreDraft()) {
      setValidation("已載入「" + sourceVideo + "」。請用 T / E 鍵標記接觸幀和觀察結束幀。", "ok");
    }
  }

  async function loadProfile() {
    try {
      const response = await fetch("../../timeline-config.json", { cache: "no-store" });
      if (!response.ok) return;
      const config = await response.json();
      const found = config.serves.find((serve) => serve.id === contract.PROFILE_ID);
      if (found && found.physics) profile = found.physics;
    } catch (e) { /* use fallback profile */ }
    draw();
  }

  function setupDrag() {
    drag = dragApi.create({ getRect: () => annEls.stage.getBoundingClientRect(), onPosition: (pos) => setEntry(pos) });
    annEls.entry.addEventListener("pointerdown", (event) => {
      stopPreview();
      if (drag.down(event)) annEls.entry.setPointerCapture(event.pointerId);
    });
    annEls.stage.addEventListener("pointermove", (event) => { drag.move(event); });
    for (const type of ["pointerup", "pointercancel"]) annEls.stage.addEventListener(type, () => drag.up());
  }

  // ── Save / Mark complete / Copy ───────────────────────────────
  function saveDraft() {
    const draft = updateOutput();
    if (!draft) return;
    try {
      localStorage.setItem(contract.draftStorageKey(sourceVideo), JSON.stringify(draft));
      setValidation("「" + sourceVideo + "」的草稿已儲存。", "ok");
    } catch (e) {
      setValidation("無法使用本機儲存空間；仍可複製 JSON。", "error");
    }
  }

  function markComplete() {
    const draft = updateOutput();
    if (!draft) return;
    try {
      localStorage.setItem(contract.draftStorageKey(sourceVideo), JSON.stringify(draft));
      lib.markCompleted(sourceVideo);
      setValidation("「" + sourceVideo + "」已標記完成。", "ok");
    } catch (e) {
      setValidation("無法使用本機儲存空間。", "error");
    }
  }

  async function copyJson() {
    const draft = updateOutput();
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(draft, null, 2));
      setValidation("草稿 JSON 已複製。", "ok");
    } catch (e) {
      setValidation("瀏覽器未允許剪貼簿；請從下方文字框手動複製。", "error");
    }
  }

  // ── Bind events ───────────────────────────────────────────────
  function bindLibrary() {
    libEls.folderInput.addEventListener("change", handleFolderSelect);
    libEls.searchInput.addEventListener("input", renderGrid);
    libEls.categoryFilter.addEventListener("change", renderGrid);
    libEls.statusFilter.addEventListener("change", renderGrid);
    libEls.exportBtn.addEventListener("click", exportManifest);
    libEls.importBtn.addEventListener("click", () => libEls.importInput.click());
    libEls.importInput.addEventListener("change", handleImport);
    libEls.rescanBtn.addEventListener("click", () => {
      libEls.libraryContent.hidden = true;
      libEls.intakeZone.hidden = false;
      libEls.intakeHint.textContent = "";
      libEls.folderInput.value = "";
    });
  }

  function bindAnnotator() {
    annEls.backToLibrary.addEventListener("click", backToLibrary);
    annEls.video.addEventListener("loadedmetadata", () => {
      annEls.scrub.max = annEls.video.duration;
      updateTime();
      // Force first frame to display by seeking slightly forward
      if (annEls.video.currentTime < 0.01) {
        annEls.video.currentTime = 0.01;
      }
    });
    annEls.video.addEventListener("timeupdate", updateTime);
    annEls.video.addEventListener("seeked", draw);
    annEls.video.addEventListener("play", () => { annEls.playPause.textContent = "暫停"; });
    annEls.video.addEventListener("pause", () => { annEls.playPause.textContent = "播放"; });
    annEls.playPause.addEventListener("click", () => { annEls.video.paused ? annEls.video.play() : annEls.video.pause(); });
    annEls.stepBack.addEventListener("click", () => seekBy(-1));
    annEls.stepForward.addEventListener("click", () => seekBy(1));
    annEls.scrub.addEventListener("input", () => { stopPreview(); annEls.video.pause(); annEls.video.currentTime = finite(annEls.scrub.value); });
    annEls.setContact.addEventListener("click", () => setCurrent(annEls.contactTime));
    annEls.setEnd.addEventListener("click", () => setCurrent(annEls.observationEnd));
    annEls.runPreview.addEventListener("click", runPreview);
    [annEls.fps, annEls.contactTime, annEls.observationEnd, annEls.spinNote].forEach((el) => el.addEventListener("input", updateOutput));
    [annEls.entryX, annEls.entryY].forEach((el) => el.addEventListener("change", () => setEntry({ x: annEls.entryX.value, y: annEls.entryY.value })));
    annEls.saveDraft.addEventListener("click", saveDraft);
    annEls.markComplete.addEventListener("click", markComplete);
    annEls.copyJson.addEventListener("click", copyJson);
    document.addEventListener("keydown", (event) => {
      if (annEls.annotatorPanel.hidden) return;
      if (event.target.matches("input,textarea,button")) return;
      const jump = event.shiftKey ? 10 : 1;
      if (event.code === "Space") { event.preventDefault(); annEls.playPause.click(); }
      else if (event.key === "ArrowLeft") { event.preventDefault(); seekBy(-jump); }
      else if (event.key === "ArrowRight") { event.preventDefault(); seekBy(jump); }
      else if (event.key.toLowerCase() === "t") setCurrent(annEls.contactTime);
      else if (event.key.toLowerCase() === "e") setCurrent(annEls.observationEnd);
    });
    window.addEventListener("resize", () => { if (!annEls.annotatorPanel.hidden) resizeCanvas(); });
  }

  // ── Init ──────────────────────────────────────────────────────
  function init() {
    if (!lib || !contract || !projection || !bridge || !runtime || !Experiment || !dragApi)
      throw new Error("dependencies did not load");
    bindLibrary();
    bindAnnotator();
    setupDrag();
    setEntry(entry);
    const supportsDir = "webkitdirectory" in document.createElement("input");
    if (!supportsDir) {
      libEls.intakeHint.textContent = "注意：你的瀏覽器可能不支援資料夾選擇。建議使用 Chrome 或 Edge。";
    }
  }

  try { init(); } catch (error) {
    if (annEls.validation) setValidation(error.message, "error");
    console.error(error);
  }
})();
