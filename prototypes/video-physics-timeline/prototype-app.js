(function () {
  "use strict";

  const api = window.VideoPhysicsTimeline;
  const physicsBridge = window.PrototypePhysicsBridge;
  const projection = window.VideoPhysicsProjection;
  const els = {
    video: document.getElementById("serveVideo"),
    canvas: document.getElementById("timelineCanvas"),
    stageShell: document.getElementById("stageShell"),
    opponent: document.getElementById("opponentPose"),
    mediaMode: document.getElementById("mediaMode"),
    stageReadout: document.getElementById("stageReadout"),
    serveSelect: document.getElementById("serveSelect"),
    start: document.getElementById("startButton"),
    hit: document.getElementById("hitButton"),
    reset: document.getElementById("resetButton"),
    phase: document.getElementById("phaseMetric"),
    substate: document.getElementById("substateMetric"),
    media: document.getElementById("mediaMetric"),
    elapsed: document.getElementById("elapsedMetric"),
    session: document.getElementById("sessionMetric"),
    delta: document.getElementById("deltaMetric"),
    physics: document.getElementById("physicsMetric"),
    velocity: document.getElementById("velocityMetric"),
    contact: document.getElementById("contactMetric"),
    eventLog: document.getElementById("eventLog"),
    eventCount: document.getElementById("eventCount"),
    status: document.getElementById("statusLine")
  };
  const ctx = els.canvas.getContext("2d");
  let config = null;
  let engine = null;
  let frameId = 0;
  let logBaseMs = 0;

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function mix(a, b, t) { return a + (b - a) * t; }
  function ease(t) { return 1 - Math.pow(1 - clamp(t, 0, 1), 3); }

  function tableGeometry(width, height) {
    return {
      farY: height * 0.34,
      nearY: height * 0.94,
      farHalf: width * 0.26,
      nearHalf: width * 0.47
    };
  }

  function drawTableScene(width, height) {
    const geometry = tableGeometry(width, height);
    const centerX = width / 2;
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#071426");
    gradient.addColorStop(0.58, "#0d2840");
    gradient.addColorStop(1, "#07111e");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#075985";
    ctx.beginPath();
    ctx.moveTo(centerX - geometry.farHalf, geometry.farY);
    ctx.lineTo(centerX + geometry.farHalf, geometry.farY);
    ctx.lineTo(centerX + geometry.nearHalf, geometry.nearY);
    ctx.lineTo(centerX - geometry.nearHalf, geometry.nearY);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(226,232,240,.72)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(centerX, geometry.farY);
    ctx.lineTo(centerX, geometry.nearY);
    ctx.stroke();

    const netDepth = 0.5;
    const netY = mix(geometry.farY, geometry.nearY, netDepth);
    const netHalf = mix(geometry.farHalf, geometry.nearHalf, netDepth);
    const netHeight = height * 0.075;
    ctx.fillStyle = "rgba(203,213,225,.2)";
    ctx.fillRect(centerX - netHalf, netY - netHeight, netHalf * 2, netHeight);
    ctx.strokeStyle = "rgba(226,232,240,.86)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX - netHalf, netY - netHeight);
    ctx.lineTo(centerX + netHalf, netY - netHeight);
    ctx.moveTo(centerX - netHalf, netY - netHeight - 5);
    ctx.lineTo(centerX - netHalf, netY + 4);
    ctx.moveTo(centerX + netHalf, netY - netHeight - 5);
    ctx.lineTo(centerX + netHalf, netY + 4);
    ctx.stroke();
    ctx.strokeStyle = "rgba(226,232,240,.22)";
    ctx.lineWidth = 1;
    for (let row = 1; row < 4; row += 1) {
      const y = netY - netHeight + row * netHeight / 4;
      ctx.beginPath();
      ctx.moveTo(centerX - netHalf, y);
      ctx.lineTo(centerX + netHalf, y);
      ctx.stroke();
    }
    for (let column = 1; column < 12; column += 1) {
      const x = centerX - netHalf + column * netHalf * 2 / 12;
      ctx.beginPath();
      ctx.moveTo(x, netY - netHeight);
      ctx.lineTo(x, netY);
      ctx.stroke();
    }
  }

  function worldToScreen(position, width, height) {
    return projection.worldToScreen(position, physicsBridge.constants.table, width, height);
  }

  class MediaAdapter {
    constructor(video) {
      this.video = video;
      this.mode = "pending";
      this.serve = null;
      this.currentTimeSec = 0;
      this.startedAtMs = 0;
      this.running = false;
    }

    async prepare(serve) {
      this.reset();
      this.serve = serve;
      if (serve.video.generation_status === "pending_generation") {
        this.mode = "procedural";
        this.video.style.display = "none";
        els.mediaMode.textContent = "程序化媒體 · shared-core physics";
        return;
      }

      this.mode = "video";
      this.video.style.display = "block";
      this.video.src = serve.video.src;
      await new Promise((resolve, reject) => {
        const ready = () => { cleanup(); resolve(); };
        const fail = () => { cleanup(); reject(new Error(`無法載入 ${serve.video.src}`)); };
        const cleanup = () => {
          this.video.removeEventListener("loadedmetadata", ready);
          this.video.removeEventListener("error", fail);
        };
        this.video.addEventListener("loadedmetadata", ready);
        this.video.addEventListener("error", fail);
        this.video.load();
      });
      if (!Number.isFinite(this.video.duration) || serve.video.physics_trigger_time_sec >= this.video.duration) {
        throw new Error("physics trigger 必須小於實際影片長度");
      }
      els.mediaMode.textContent = "真實 WebM media clock";
    }

    start(nowMs) {
      this.currentTimeSec = 0;
      this.startedAtMs = nowMs;
      this.running = true;
      if (this.mode === "video") {
        this.video.currentTime = 0;
        const playPromise = this.video.play();
        if (playPromise) playPromise.catch((error) => showError(`影片播放失敗：${error.message}`));
      }
    }

    tick(nowMs) {
      if (!this.running || !this.serve) return this.currentTimeSec;
      if (this.mode === "video") this.currentTimeSec = this.video.currentTime;
      else this.currentTimeSec = Math.min((nowMs - this.startedAtMs) / 1000, this.serve.video.expected_duration_sec);
      return this.currentTimeSec;
    }

    reset() {
      this.running = false;
      this.currentTimeSec = 0;
      this.video.pause();
      this.video.removeAttribute("src");
      this.video.load();
      this.video.style.display = "none";
    }

    draw(width, height) {
      if (this.mode === "video") return;
      drawTableScene(width, height);
      if (!this.serve || !this.running) return;

      const video = this.serve.video;
      const start = video.procedural_fallback.start_uv;
      const anchor = video.handoff.video_anchor_uv;
      const progress = ease(this.currentTimeSec / video.physics_trigger_time_sec);
      let alpha = 1;
      if (this.currentTimeSec >= video.physics_trigger_time_sec) {
        alpha = 1 - clamp((this.currentTimeSec - video.physics_trigger_time_sec) / video.handoff.duration_sec, 0, 1);
      }
      const x = mix(start.x, anchor.x, progress) * width;
      const y = (mix(start.y, anchor.y, progress) - Math.sin(progress * Math.PI) * 0.12) * height;
      drawBall(x, y, 10, alpha, "#f8fafc");

      ctx.fillStyle = "rgba(226,232,240,.7)";
      ctx.font = "600 14px ui-monospace, monospace";
      ctx.fillText(`${video.procedural_fallback.label}  ${this.currentTimeSec.toFixed(3)}s`, 22, height - 22);
    }
  }

  class PhysicsAdapter {
    constructor(dispatch) {
      this.dispatch = dispatch;
      this.reset();
    }

    reset() {
      this.mode = "idle";
      this.sessionId = 0;
      this.startedAtMs = 0;
      this.lastTickAtMs = 0;
      this.anchor = null;
      this.position = null;
      this.velocity = null;
      this.world = null;
      this.physicsSettings = null;
      this.handoffOffset = null;
      this.handoffDurationMs = 0;
      this.completeSent = false;
      this.paused = false;
      this.lastContact = "none";
      this.overlayDeltaPx = null;
    }

    startServe(effect, nowMs) {
      const anchorUv = effect.detail.handoff.video_anchor_uv;
      this.sessionId = effect.sessionId;
      this.mode = "serve";
      this.startedAtMs = nowMs;
      this.lastTickAtMs = nowMs;
      this.anchor = { x: anchorUv.x * els.canvas.width, y: anchorUv.y * els.canvas.height };
      this.physicsSettings = effect.detail.physics;
      this.world = physicsBridge.createWorld(effect.detail.initialBallState, effect.detail.physics);
      this.position = { ...this.world.position };
      this.velocity = { ...this.world.velocity };
      const projected = worldToScreen(this.position, els.canvas.width, els.canvas.height);
      this.handoffOffset = { x: this.anchor.x - projected.x, y: this.anchor.y - projected.y };
      this.handoffDurationMs = effect.detail.handoff.duration_sec * 1000;
      this.completeSent = false;
      this.paused = false;
      this.lastContact = "none";
      this.overlayDeltaPx = Math.hypot(this.handoffOffset.x, this.handoffOffset.y);
    }

    playerReturn(effect, nowMs) {
      this.mode = "player-return";
      this.sessionId = effect.sessionId;
      this.startedAtMs = nowMs;
      this.lastTickAtMs = nowMs;
      const returnState = physicsBridge.makeReturnInitialState(this.position, effect.detail.direction, false);
      this.world = physicsBridge.createWorld(returnState, effect.detail.physics);
      this.position = { ...this.world.position };
      this.velocity = { ...this.world.velocity };
      this.physicsSettings = effect.detail.physics;
      this.handoffOffset = null;
      this.paused = false;
      this.completeSent = false;
    }

    opponentCounter(effect, nowMs) {
      this.mode = "counter-return";
      this.sessionId = effect.sessionId;
      this.startedAtMs = nowMs;
      this.lastTickAtMs = nowMs;
      const returnState = physicsBridge.makeReturnInitialState(this.position, effect.detail.direction, true);
      this.world = physicsBridge.createWorld(returnState, effect.detail.physics);
      this.position = { ...this.world.position };
      this.velocity = { ...this.world.velocity };
      this.physicsSettings = effect.detail.physics;
      this.handoffOffset = null;
      this.paused = false;
      this.completeSent = false;
    }

    tick(nowMs) {
      if (!this.world || this.paused || this.mode === "idle") return;
      const deltaSec = Math.max(0, (nowMs - this.lastTickAtMs) / 1000);
      this.lastTickAtMs = nowMs;
      const snapshot = physicsBridge.stepWorld(this.world, deltaSec);
      this.position = { ...snapshot.position };
      this.velocity = { ...snapshot.velocity };
      for (const event of snapshot.events) {
        if (event.type === "TABLE_BOUNCE") this.lastContact = `table × ${snapshot.bounces}`;
        if (event.type === "NET_CROSSED") this.lastContact = "net crossed";
        if (event.type === "NET_HIT") this.lastContact = "net hit";
        if (this.mode === "serve" && event.type === "HIT_WINDOW_ENTERED") {
          this.paused = true;
          this.dispatch("BALL_ENTERED_HIT_WINDOW", { sessionId: this.sessionId, nowMs });
        }
        if (this.mode === "counter-return" && event.type === "HIT_WINDOW_ENTERED" && !this.completeSent) {
          this.completeSent = true;
          this.paused = true;
          this.dispatch("RALLY_COMPLETE", { sessionId: this.sessionId, nowMs });
        }
      }
      if (this.mode === "counter-return" && snapshot.stopped && !this.completeSent) {
        this.completeSent = true;
        this.dispatch("RALLY_COMPLETE", { sessionId: this.sessionId, nowMs });
      }
    }

    draw(nowMs) {
      if (!this.position || this.mode === "idle") return;
      const projected = worldToScreen(this.position, els.canvas.width, els.canvas.height);
      let alpha = 1;
      let x = projected.x;
      let y = projected.y;
      if (this.mode === "serve" && this.handoffDurationMs > 0) {
        const progress = clamp((nowMs - this.startedAtMs) / this.handoffDurationMs, 0, 1);
        alpha = progress;
        if (this.handoffOffset) {
          x += this.handoffOffset.x * (1 - progress);
          y += this.handoffOffset.y * (1 - progress);
        }
      }
      drawBall(x, y, 10, alpha, "#fbbf24");
    }

    telemetry() {
      return {
        position: this.position,
        velocity: this.velocity,
        bounces: this.world ? this.world.bounces : 0,
        contact: this.lastContact
      };
    }
  }

  function drawBall(x, y, radius, alpha, color) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const media = new MediaAdapter(els.video);
  const physics = new PhysicsAdapter((type, payload) => {
    if (engine) engine.dispatch(type, payload);
  });

  function onEffect(effect) {
    const nowMs = performance.now();
    if (effect.type === "START_MEDIA") {
      physics.reset();
      els.opponent.classList.remove("visible");
      media.start(nowMs);
    }
    if (effect.type === "START_PHYSICS_SERVE") physics.startServe(effect, nowMs);
    if (effect.type === "PLAYER_RETURN") physics.playerReturn(effect, nowMs);
    if (effect.type === "OPPONENT_PREP") {
      els.opponent.src = effect.detail.response.prep_asset_src;
      els.opponent.classList.add("visible");
    }
    if (effect.type === "OPPONENT_COUNTER") {
      els.opponent.src = effect.detail.response.counter_asset_src;
      physics.opponentCounter(effect, nowMs);
    }
    if (effect.type === "RESET_ADAPTERS") {
      media.reset();
      physics.reset();
      els.opponent.classList.remove("visible");
      els.mediaMode.textContent = "選擇來源後按 Start";
    }
  }

  function onEvent(event) {
    if (event.type === "START" || event.type === "RESET") {
      logBaseMs = event.nowMs;
      els.eventLog.textContent = "";
    }
    if (els.eventLog.querySelector(".empty-log")) els.eventLog.textContent = "";
    const item = document.createElement("li");
    const time = document.createElement("span");
    const name = document.createElement("span");
    const id = document.createElement("span");
    time.className = "event-time";
    name.className = "event-name";
    id.className = "event-id";
    time.textContent = `${Math.max(0, (event.nowMs - logBaseMs) / 1000).toFixed(3)}s`;
    name.textContent = event.type;
    id.textContent = event.id;
    item.append(time, name, id);
    els.eventLog.prepend(item);
    els.eventCount.textContent = `${engine ? engine.eventLog.length : 1} events`;
  }

  async function start() {
    clearError();
    const serve = config.serves.find((item) => item.id === els.serveSelect.value);
    const direction = document.querySelector('input[name="direction"]:checked').value;
    els.start.disabled = true;
    try {
      await media.prepare(serve);
      engine.start(serve.id, direction, performance.now());
      els.reset.disabled = false;
      els.serveSelect.disabled = true;
    } catch (error) {
      showError(error.message);
      els.start.disabled = false;
    }
  }

  function reset() {
    if (engine) engine.reset(performance.now());
    els.serveSelect.disabled = false;
    els.start.disabled = false;
    els.hit.disabled = true;
    els.reset.disabled = true;
    els.eventLog.innerHTML = '<li class="empty-log">Start 後會顯示具 session 隔離的事件。</li>';
    els.eventCount.textContent = "0 events";
    clearError();
  }

  function showError(message) {
    els.status.textContent = message;
    els.status.classList.add("error");
  }

  function clearError() {
    els.status.innerHTML = '隔離 bridge 已載入 shared physics core；正式核心本身未修改。<a class="spec-link" href="./SPEC.md">閱讀規格</a>';
    els.status.classList.remove("error");
  }

  function updateUI(nowMs, snapshot) {
    els.phase.textContent = snapshot.state;
    els.substate.textContent = snapshot.substate || "—";
    els.media.textContent = `${media.currentTimeSec.toFixed(3)} s`;
    els.elapsed.textContent = `${snapshot.phaseElapsedSec.toFixed(3)} s`;
    els.session.textContent = String(snapshot.sessionId);
    els.delta.textContent = physics.overlayDeltaPx === null ? "—" : `${physics.overlayDeltaPx.toFixed(1)} px`;
    els.delta.classList.toggle("good", physics.overlayDeltaPx !== null && physics.overlayDeltaPx <= 8);
    const telemetry = physics.telemetry();
    els.physics.textContent = telemetry.position
      ? `${telemetry.position.x.toFixed(2)}, ${telemetry.position.y.toFixed(2)}, ${telemetry.position.z.toFixed(2)} m`
      : "—";
    els.velocity.textContent = telemetry.velocity
      ? `${telemetry.velocity.x.toFixed(2)}, ${telemetry.velocity.y.toFixed(2)}, ${telemetry.velocity.z.toFixed(2)} m/s`
      : "—";
    els.contact.textContent = telemetry.position ? `${telemetry.contact} · b${telemetry.bounces}` : "—";
    els.stageReadout.textContent = `${snapshot.substate || snapshot.state} · ${media.currentTimeSec.toFixed(3)}s`;
    els.hit.disabled = snapshot.state !== api.STATES.AWAIT_PLAYER_HIT;
    els.start.disabled = !config || ![api.STATES.IDLE, api.STATES.COMPLETE].includes(snapshot.state);
    if (snapshot.state === api.STATES.COMPLETE) els.serveSelect.disabled = false;

    const order = [api.STATES.SERVE_VIDEO, api.STATES.PHYSICS_SERVE, api.STATES.AWAIT_PLAYER_HIT, api.STATES.OPPONENT_SEQUENCE];
    const activeIndex = order.indexOf(snapshot.state);
    document.querySelectorAll(".phase-step").forEach((element, index) => {
      element.classList.toggle("active", index === activeIndex);
      element.classList.toggle("complete", snapshot.state === api.STATES.COMPLETE || (activeIndex >= 0 && index < activeIndex));
    });
  }

  function loop(nowMs) {
    const mediaTime = media.tick(nowMs);
    const snapshot = engine ? engine.tick(mediaTime, nowMs) : { state: "IDLE", substate: null, sessionId: 0, phaseElapsedSec: 0 };
    physics.tick(nowMs);
    ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
    media.draw(els.canvas.width, els.canvas.height);
    physics.draw(nowMs);
    updateUI(nowMs, snapshot);
    frameId = requestAnimationFrame(loop);
  }

  function resizeCanvas() {
    const rect = els.stageShell.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    els.canvas.width = Math.max(1, Math.round(rect.width * dpr));
    els.canvas.height = Math.max(1, Math.round(rect.height * dpr));
  }

  async function init() {
    try {
      if (!physicsBridge || !projection) throw new Error("shared physics bridge 或 projection helper 未載入");
      const response = await fetch("./timeline-config.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`設定檔載入失敗：HTTP ${response.status}`);
      config = await response.json();
      api.validateConfig(config);
      engine = new api.TimelineEngine(config, { onEvent, onEffect });
      for (const serve of config.serves) {
        const option = document.createElement("option");
        option.value = serve.id;
        option.textContent = `${serve.label} · trigger ${serve.video.physics_trigger_time_sec.toFixed(2)}s`;
        els.serveSelect.append(option);
      }
      els.serveSelect.disabled = false;
      els.start.disabled = false;
      els.mediaMode.textContent = "選擇來源後按 Start";
    } catch (error) {
      showError(`CONFIG_ERROR：${error.message}`);
      els.mediaMode.textContent = "設定錯誤";
    }
    resizeCanvas();
    frameId = requestAnimationFrame(loop);
  }

  els.start.addEventListener("click", start);
  els.hit.addEventListener("click", () => engine.dispatch("PLAYER_HIT", { sessionId: engine.sessionId, nowMs: performance.now() }));
  els.reset.addEventListener("click", reset);
  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("beforeunload", () => cancelAnimationFrame(frameId));
  init();
})();
