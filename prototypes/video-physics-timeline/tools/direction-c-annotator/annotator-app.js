(() => {
  "use strict";
  const contract = window.DirectionCAnnotationContract;
  const projection = window.VideoPhysicsProjection;
  const bridge = window.PrototypePhysicsBridge;
  const runtime = window.DirectionCAnnotatorPreviewRuntime;
  const { Experiment, STATES } = window.DirectionCExperiment;
  const dragApi = window.DirectionCEntryDrag;
  const $ = (id) => document.getElementById(id);
  const els = Object.fromEntries(["stage","videoFile","sourceName","videoFrame","video","overlay","entry","stepBack","playPause","stepForward","scrub","timeReadout","fps","contactTime","observationEnd","entryX","entryY","spinNote","setContact","setEnd","runPreview","saveDraft","copyJson","output","validation"].map((id) => [id, $(id)]));
  const ctx = els.overlay.getContext("2d");
  const fallbackProfile = { gravity_mps2: -4.2, hit_window_z_m: 1.32, initial_ball_state: { position_m: { x: .2, y: 1.05, z: .15 }, velocity_mps: { x: .35, y: -.4, z: 2.6 }, spin_rps: { x: 0, y: 8, z: -18 } } };
  let profile = fallbackProfile;
  let entry = { x: .313, y: .11 };
  let drag = null;
  let sourceVideo = contract.DEFAULT_SOURCE_VIDEO;
  let sourceUrl = null;
  let preview = null;
  let trajectoryAlpha = 1;
  let fadeStartMs = 0;
  const FADE_MS = 320;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : NaN;
  function fps() { return Math.max(1, Math.min(240, Math.round(finite(els.fps.value) || 60))); }
  function snap(seconds) { return Math.round(Math.max(0, seconds) * fps()) / fps(); }
  function setValidation(message, kind) { els.validation.textContent = message; els.validation.className = `validation ${kind || ""}`; }
  function readValues() {
    return { source_video: sourceVideo, fps: fps(), contact_time_sec: finite(els.contactTime.value), observation_end_sec: finite(els.observationEnd.value), entry_position: entry, spin_note: els.spinNote.value.trim() };
  }
  function makeDraft() { return contract.makeDraft(readValues()); }
  function updateOutput() {
    try { const draft = makeDraft(); els.output.value = JSON.stringify(draft, null, 2); setValidation("草稿格式有效；仍待教練審核。", "ok"); return draft; }
    catch (error) { els.output.value = ""; setValidation(error.message, "error"); return null; }
  }
  function projectionDeps() { return { projection, bridge, width: els.overlay.width, height: els.overlay.height }; }
  function setEntry(next) {
    entry = { x: clamp(finite(next.x), .02, .98), y: clamp(finite(next.y), .02, .98) };
    els.entry.style.left = `${entry.x * 100}%`; els.entry.style.top = `${entry.y * 100}%`;
    els.entryX.value = entry.x.toFixed(3); els.entryY.value = entry.y.toFixed(3);
    draw(); updateOutput();
  }
  function resizeCanvas() {
    const rect = els.stage.getBoundingClientRect();
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    els.overlay.width = Math.max(1, Math.round(rect.width * scale)); els.overlay.height = Math.max(1, Math.round(rect.height * scale));
    draw();
  }
  function trajectory() {
    try { return runtime.traceEntryTrajectory(entry, profile, projectionDeps()); }
    catch { return { points: [], bounces: [] }; }
  }
  function drawTable() {
    const w = els.overlay.width, h = els.overlay.height, layout = runtime.MOBILE_TABLE_LAYOUT, table = projection.tableGeometry(w, h, layout), cx = w / 2;
    ctx.clearRect(0, 0, w, h); ctx.fillStyle = "#04111acc"; ctx.fillRect(0, h * layout.farYRatio, w, h * (1 - layout.farYRatio));
    ctx.fillStyle = "#076d8f88"; ctx.beginPath(); ctx.moveTo(cx-table.farHalf,table.farY); ctx.lineTo(cx+table.farHalf,table.farY); ctx.lineTo(cx+table.nearHalf,table.nearY); ctx.lineTo(cx-table.nearHalf,table.nearY); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#dcf3ffb5"; ctx.lineWidth = Math.max(1, w / 520); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx,table.farY); ctx.lineTo(cx,table.nearY); ctx.stroke();
    const netY = table.farY + (table.nearY-table.farY)*.5; ctx.strokeStyle="#f0f8ffc9"; ctx.beginPath(); ctx.moveTo(cx-table.nearHalf*.75,netY); ctx.lineTo(cx+table.nearHalf*.75,netY); ctx.stroke();
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
      const { points, bounces } = trajectory();
      if (points.length) {
        ctx.globalAlpha = trajectoryAlpha;
        ctx.strokeStyle="#5eead4"; ctx.lineWidth=Math.max(2,els.overlay.width/280); ctx.setLineDash([els.overlay.width/70,els.overlay.width/95]); ctx.beginPath(); points.forEach((point,index)=>index?ctx.lineTo(point.x,point.y):ctx.moveTo(point.x,point.y)); ctx.stroke(); ctx.setLineDash([]);
        for (const point of bounces) { ctx.fillStyle="#ffd166"; ctx.beginPath(); ctx.arc(point.x,point.y,Math.max(4,els.overlay.width/90),0,Math.PI*2); ctx.fill(); }
        ctx.globalAlpha = 1;
      }
    }
    if (preview && preview.ballPoint) {
      const radius = Math.max(12, els.overlay.width / 30);
      ctx.save();
      ctx.shadowColor = "rgba(2,8,16,0.55)"; ctx.shadowBlur = Math.max(10, els.overlay.width / 50);
      ctx.fillStyle = "#fef9c3"; ctx.strokeStyle = "#0b1727"; ctx.lineWidth = Math.max(2, els.overlay.width / 300);
      ctx.beginPath(); ctx.arc(preview.ballPoint.x, preview.ballPoint.y, radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }
  function updateTime() { els.timeReadout.textContent = `${els.video.currentTime.toFixed(3)} / ${(els.video.duration || 0).toFixed(3)} s`; els.scrub.value = els.video.currentTime || 0; }
  function stopPreview() {
    const wasPreviewing = preview != null;
    if (preview) cancelAnimationFrame(preview.frameId);
    preview = null;
    els.videoFrame.classList.remove("c3-playing");
    if (wasPreviewing) fadeStartMs = performance.now();
    draw();
  }
  function previewLoop(nowMs) {
    if (!preview) return;
    const deltaSec = clamp((nowMs - preview.lastNowMs) / 1000, 0, .1);
    preview.lastNowMs = nowMs;
    // A source clip may end before the annotated observation window closes; a
    // finished video counts as having reached the observation end.
    const mediaTime = els.video.ended ? Math.max(els.video.currentTime, preview.endSec) : els.video.currentTime;
    const snapshot = preview.experiment.tick(mediaTime, nowMs);
    if (snapshot.showTrainingBall && !preview.ball) {
      try { preview.ball = runtime.createBallRun(entry, profile, projectionDeps()); }
      catch (error) { stopPreview(); setValidation(error.message, "error"); return; }
      els.videoFrame.classList.add("c3-playing");
    }
    if (preview.ball && !preview.ball.isStopped()) preview.ballPoint = preview.ball.step(deltaSec).screen;
    if (snapshot.state === STATES.TRAINING) els.video.pause();
    if (snapshot.state === STATES.COMPLETE) {
      els.video.pause();
      stopPreview();
      setValidation("C3 預覽完成：影片層已讓位，訓練球以 profile 真實物理跑完。", "ok");
      return;
    }
    draw();
    preview.frameId = requestAnimationFrame(previewLoop);
  }
  function runPreview() {
    try {
      const contact = finite(els.contactTime.value), end = finite(els.observationEnd.value);
      const experiment = new Experiment(contact, end);
      stopPreview();
      els.videoFrame.style.setProperty("--c3-fade-ms", `${Math.max(120, (end - contact) * 1000)}ms`);
      els.video.pause();
      els.video.currentTime = Math.max(0, contact - runtime.PREVIEW_LEAD_SEC);
      experiment.start("C3", performance.now());
      preview = { experiment, ball: null, ballPoint: null, lastNowMs: performance.now(), frameId: 0, endSec: end };
      els.video.play().catch(() => {});
      preview.frameId = requestAnimationFrame(previewLoop);
      setValidation("C3 預覽執行中：觀察 → 觸球後影片淡出 → 訓練球以 profile 真實物理從入射點入場。", "ok");
    } catch (error) { setValidation(error.message, "error"); }
  }
  function seekBy(frames) { stopPreview(); els.video.pause(); els.video.currentTime = clamp((els.video.currentTime || 0) + frames / fps(), 0, els.video.duration || Infinity); }
  function setCurrent(field) { field.value = snap(els.video.currentTime || 0).toFixed(3); updateOutput(); }
  function restoreDraft() {
    try { const saved = JSON.parse(localStorage.getItem(contract.draftStorageKey(sourceVideo))); if (!saved) return false; contract.validateAnnotation(saved); els.fps.value=saved.fps; els.contactTime.value=saved.contact_time_sec.toFixed(3); els.observationEnd.value=saved.observation_end_sec.toFixed(3); els.spinNote.value=saved.spin_note; setEntry(saved.entry_position); setValidation(`已還原「${sourceVideo}」的本機草稿。`, "ok"); return true; } catch { /* Storage is optional and invalid drafts are ignored. */ return false; }
  }
  function selectSourceFile(file) {
    if (!file) return;
    stopPreview();
    els.video.pause();
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    sourceUrl = URL.createObjectURL(file);
    sourceVideo = file.name;
    els.sourceName.value = sourceVideo;
    els.video.src = sourceUrl;
    updateOutput();
    if (!restoreDraft()) setValidation(`已載入「${sourceVideo}」；此來源尚無本機草稿。`, "ok");
  }
  async function loadProfile() {
    try { const response = await fetch("../../timeline-config.json", { cache:"no-store" }); if (!response.ok) return; const config=await response.json(); const found=config.serves.find((serve)=>serve.id===contract.PROFILE_ID); if (found && found.physics) profile=found.physics; if (!sourceUrl && !els.video.src) els.video.src="../../assets/serve-real-backspin-001.mp4"; }
    catch { if (!sourceUrl && !els.video.src) els.video.src="../../assets/serve-real-backspin-001.mp4"; }
    draw();
  }
  function setupDrag() {
    drag = dragApi.create({ getRect: () => els.stage.getBoundingClientRect(), onPosition: (position) => setEntry(position) });
    els.entry.addEventListener("pointerdown", (event) => { stopPreview(); if (drag.down(event)) { els.entry.setPointerCapture(event.pointerId); } });
    els.stage.addEventListener("pointermove", (event) => { drag.move(event); });
    for (const type of ["pointerup","pointercancel"]) els.stage.addEventListener(type, () => drag.up());
  }
  function bind() {
    els.videoFile.addEventListener("change", () => selectSourceFile(els.videoFile.files[0]));
    els.video.addEventListener("loadedmetadata", () => { els.scrub.max=els.video.duration; updateTime(); }); els.video.addEventListener("timeupdate", updateTime); els.video.addEventListener("seeked", draw); els.video.addEventListener("play",()=>els.playPause.textContent="暫停"); els.video.addEventListener("pause",()=>els.playPause.textContent="播放");
    els.playPause.addEventListener("click",()=>els.video.paused?els.video.play():els.video.pause()); els.stepBack.addEventListener("click",()=>seekBy(-1)); els.stepForward.addEventListener("click",()=>seekBy(1)); els.scrub.addEventListener("input",()=>{stopPreview();els.video.pause();els.video.currentTime=finite(els.scrub.value);});
    els.setContact.addEventListener("click",()=>setCurrent(els.contactTime)); els.setEnd.addEventListener("click",()=>setCurrent(els.observationEnd)); els.runPreview.addEventListener("click",runPreview);
    [els.fps,els.contactTime,els.observationEnd,els.spinNote].forEach((element)=>element.addEventListener("input",updateOutput)); [els.entryX,els.entryY].forEach((element)=>element.addEventListener("change",()=>setEntry({x:els.entryX.value,y:els.entryY.value})));
    els.saveDraft.addEventListener("click",()=>{const draft=updateOutput();if(!draft)return;try{localStorage.setItem(contract.draftStorageKey(sourceVideo),JSON.stringify(draft));setValidation(`「${sourceVideo}」的草稿已儲存在這台裝置；仍待教練審核。`,"ok");}catch{setValidation("無法使用本機儲存空間；仍可複製 JSON。","error");}});
    els.copyJson.addEventListener("click",async()=>{const draft=updateOutput();if(!draft)return;try{await navigator.clipboard.writeText(JSON.stringify(draft,null,2));setValidation("草稿 JSON 已複製。","ok");}catch{setValidation("瀏覽器未允許剪貼簿；請從下方文字框手動複製。","error");}});
    document.addEventListener("keydown",(event)=>{if(event.target.matches("input,textarea,button"))return;const jump=event.shiftKey?10:1;if(event.code==="Space"){event.preventDefault();els.playPause.click();}else if(event.key==="ArrowLeft"){event.preventDefault();seekBy(-jump);}else if(event.key==="ArrowRight"){event.preventDefault();seekBy(jump);}else if(event.key.toLowerCase()==="t")setCurrent(els.contactTime);else if(event.key.toLowerCase()==="e")setCurrent(els.observationEnd);});
    window.addEventListener("resize",resizeCanvas);
  }
  function init() { if (!contract || !projection || !bridge || !runtime || !Experiment || !dragApi) throw new Error("annotator dependencies did not load"); els.sourceName.value = sourceVideo; bind(); setupDrag(); setEntry(entry); resizeCanvas(); restoreDraft(); updateOutput(); loadProfile(); }
  try { init(); } catch (error) { setValidation(error.message, "error"); }
})();
