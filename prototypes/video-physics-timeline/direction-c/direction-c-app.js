(() => {
  "use strict";

  const { Experiment, STATES } = window.DirectionCExperiment;
  const entryDragApi = window.DirectionCEntryDrag;
  const ENTRY_STORAGE_KEY = "video-physics-direction-c:entry-position:v1";
  const els = Object.fromEntries([...document.querySelectorAll("[id]")].map((element) => [element.id, element]));
  const ctx = els.table.getContext("2d");
  let candidateId = "C1";
  let experiment = null;
  let triggerTimeSec = null;
  let observationEndTimeSec = null;
  let frameId = 0;
  let entryPosition = { x: 0.313, y: 0.11 };
  let entryDrag = null;

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

  function setEntryPosition(position, save) {
    entryPosition = {
      x: clamp(position.x, 0.03, 0.97),
      y: clamp(position.y, 0.03, 0.97)
    };
    els.entry.style.left = `${entryPosition.x * 100}%`;
    els.entry.style.top = `${entryPosition.y * 100}%`;
    els.entryLabel.style.left = `${clamp(entryPosition.x - 0.25, 0.03, 0.72) * 100}%`;
    els.entryLabel.style.top = `${clamp(entryPosition.y + 0.035, 0.03, 0.9) * 100}%`;
    if (save) {
      try { localStorage.setItem(ENTRY_STORAGE_KEY, JSON.stringify(entryPosition)); } catch { /* Local storage is optional for this experiment. */ }
    }
  }

  function restoreEntryPosition() {
    try {
      const stored = JSON.parse(localStorage.getItem(ENTRY_STORAGE_KEY));
      if (stored && Number.isFinite(stored.x) && Number.isFinite(stored.y)) setEntryPosition(stored, false);
      else setEntryPosition(entryPosition, false);
    } catch {
      setEntryPosition(entryPosition, false);
    }
  }

  function setupEntryDrag() {
    entryDrag = entryDragApi.create({
      getRect: () => els.stage.getBoundingClientRect(),
      onPosition: (position) => setEntryPosition(position, true)
    });
    els.stage.addEventListener("mousedown", (event) => entryDrag.down(event));
    document.addEventListener("mousemove", (event) => entryDrag.move(event));
    document.addEventListener("mouseup", () => entryDrag.up());
  }

  function drawTable() {
    const { width, height } = els.table;
    const centerX = width / 2;
    ctx.clearRect(0, 0, width, height);
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, "#071727"); sky.addColorStop(.57, "#123d59"); sky.addColorStop(1, "#07131f");
    ctx.fillStyle = sky; ctx.fillRect(0, 0, width, height);
    const farY = height * .50, nearY = height * .91, farHalf = width * .26, nearHalf = width * .46;
    ctx.fillStyle = "#075985";
    ctx.beginPath(); ctx.moveTo(centerX - farHalf, farY); ctx.lineTo(centerX + farHalf, farY); ctx.lineTo(centerX + nearHalf, nearY); ctx.lineTo(centerX - nearHalf, nearY); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#d9efffbb"; ctx.lineWidth = 2; ctx.stroke();
    const netY = height * .68, netHalf = width * .36, netHeight = height * .055;
    ctx.fillStyle = "#cbd5e133"; ctx.fillRect(centerX - netHalf, netY - netHeight, netHalf * 2, netHeight);
    ctx.strokeStyle = "#e5f3ffdd"; ctx.beginPath(); ctx.moveTo(centerX - netHalf, netY - netHeight); ctx.lineTo(centerX + netHalf, netY - netHeight); ctx.stroke();
    ctx.strokeStyle = "#d9efff99"; ctx.beginPath(); ctx.moveTo(centerX, farY); ctx.lineTo(centerX, nearY); ctx.stroke();
  }

  function setCandidate(next) {
    candidateId = next;
    els.c1.setAttribute("aria-pressed", String(next === "C1"));
    els.c2.setAttribute("aria-pressed", String(next === "C2"));
    els.c3.setAttribute("aria-pressed", String(next === "C3"));
  }

  function resetVisuals() {
    cancelAnimationFrame(frameId);
    els.trainingBall.hidden = true;
    els.videoFrame.hidden = false;
    els.videoFrame.classList.remove("exiting", "overlap-fade");
    els.serveVideo.pause();
    els.serveVideo.currentTime = 0;
    els.status.classList.remove("training");
    els.status.textContent = "桌面待命；影片與收拍期間沒有可玩球。";
  }

  function trainingBallPosition(elapsedMs) {
    const t = Math.max(0, Math.min(1, elapsedMs / 1300));
    return {
      x: entryPosition.x * els.table.width + 80 * t,
      y: entryPosition.y * els.table.height + 470 * t - Math.sin(t * Math.PI) * 24
    };
  }

  function render(snapshot) {
    if (snapshot.state === STATES.EXITING) {
      els.serveVideo.pause();
      els.videoFrame.classList.add("exiting");
      els.status.textContent = "收拍觀察結束；接球桌面不中斷。";
    }
    if (snapshot.state === STATES.FOLLOW_THROUGH) {
      els.status.textContent = "觸球後：持續觀察收拍、重心與回位；暫不進入反應。";
    }
    if (snapshot.state === STATES.OVERLAP) {
      els.videoFrame.classList.add("overlap-fade");
      els.trainingBall.hidden = false;
      els.status.classList.add("training");
      els.status.textContent = "C3 測試：影片淡出與訓練球重疊，請觀察干擾。";
    }
    if (snapshot.state === STATES.OVERLAP || snapshot.state === STATES.TRAINING) {
      if (snapshot.state === STATES.TRAINING) {
        els.serveVideo.pause();
        els.videoFrame.hidden = true;
      }
      els.trainingBall.hidden = false;
      els.status.classList.add("training");
      if (snapshot.state === STATES.TRAINING) els.status.textContent = "現在：一顆訓練球進入可玩區";
      const point = trainingBallPosition(snapshot.trainingElapsedMs);
      els.trainingBall.style.left = `${point.x / els.table.width * 100}%`;
      els.trainingBall.style.top = `${point.y / els.table.height * 100}%`;
    }
    if (snapshot.state === STATES.COMPLETE) {
      els.trainingBall.hidden = true;
      els.status.textContent = "本次觀察結束；可重設後比較另一種切鏡。";
      els.start.disabled = false;
    }
  }

  function loop(nowMs) {
    if (!experiment) return;
    const snapshot = experiment.tick(els.serveVideo.currentTime, nowMs);
    render(snapshot);
    if ([STATES.OBSERVING, STATES.FOLLOW_THROUGH, STATES.OVERLAP, STATES.EXITING, STATES.TRAINING].includes(snapshot.state)) {
      frameId = requestAnimationFrame(loop);
    }
  }

  function start() {
    if (!experiment) return;
    resetVisuals();
    experiment.start(candidateId, performance.now());
    els.status.textContent = "觀察拍型、觸球與後續收拍；接球桌面保持可見。";
    els.start.disabled = true;
    els.serveVideo.play().catch(() => { els.status.textContent = "影片需要由瀏覽器允許播放後才能開始。"; els.start.disabled = false; });
    frameId = requestAnimationFrame(loop);
  }

  async function initialize() {
    drawTable();
    if (!entryDragApi) throw new Error("entry drag controller failed to load");
    restoreEntryPosition();
    setupEntryDrag();
    const response = await fetch("../timeline-config.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Could not load timeline config (HTTP ${response.status})`);
    const config = await response.json();
    const sample = config.serves.find((serve) => serve.id === "real_backspin_001");
    const profile = config.serves.find((serve) => serve.id === "prototype_short");
    if (!sample || !profile || sample.video.generation_status !== "ready") throw new Error("The fixed prototype sample is unavailable.");
    triggerTimeSec = sample.video.physics_trigger_time_sec;
    observationEndTimeSec = sample.video.expected_duration_sec;
    experiment = new Experiment(triggerTimeSec, observationEndTimeSec);
    els.serveVideo.src = "../assets/serve-real-backspin-001.mp4";
    els.readout.textContent = `固定樣本：${sample.id} · 固定測試來球：${profile.id} · 觸球 ${triggerTimeSec.toFixed(3)} s，收拍觀察至 ${observationEndTimeSec.toFixed(3)} s`;
    els.c1.addEventListener("click", () => setCandidate("C1"));
    els.c2.addEventListener("click", () => setCandidate("C2"));
    els.c3.addEventListener("click", () => setCandidate("C3"));
    els.videoFrame.style.setProperty("--overlap-fade-ms", `${Math.round((observationEndTimeSec - triggerTimeSec) * 1000)}ms`);
    els.start.addEventListener("click", start);
    els.reset.addEventListener("click", () => { experiment.reset(performance.now()); resetVisuals(); els.start.disabled = false; });
  }

  initialize().catch((error) => {
    els.status.classList.add("error");
    els.status.textContent = `實驗無法初始化：${error.message}`;
    els.start.disabled = true;
  });
})();
