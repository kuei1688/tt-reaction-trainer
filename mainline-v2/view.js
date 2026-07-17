(function (root) {
  "use strict";

  function $(id) {
    return document.getElementById(id);
  }

  function formatVector(value) {
    if (!value) return "—";
    return `(${value.x.toFixed(2)}, ${value.y.toFixed(2)}, ${value.z.toFixed(2)})`;
  }

  function formatOmega(omega) {
    return `${formatVector(omega)} rad/s`;
  }

  function cameraLabel(camera) {
    return camera ? `${camera.mode} → ${camera.target}` : "home";
  }

  const RACKET_PRESENTATION_OFFSET = Object.freeze({x: 0.18, y: 0, z: 0});
  const NET_PLANE_Z = 0;

  function setProjectedPosition(element, projected) {
    if (!element || !projected) return;
    element.style.left = `${projected.x}px`;
    element.style.top = `${projected.y}px`;
  }

  function positionBall(ball, element, projector) {
    if (!ball || !ball.position || !element || !projector) return;
    setProjectedPosition(element, projector.projectWorld(ball.position));
  }

  function positionRacket(ball, element, projector) {
    if (!ball || !ball.position || !element || !projector) return;
    // The offset is a presentation-space hold position. It is not fed back
    // into the canonical ball state or the racket contact solver.
    setProjectedPosition(element, projector.projectWorld({
      x: ball.position.x + RACKET_PRESENTATION_OFFSET.x,
      y: ball.position.y + RACKET_PRESENTATION_OFFSET.y,
      z: ball.position.z + RACKET_PRESENTATION_OFFSET.z,
    }));
  }

  function positionLanding(landing, element, projector) {
    if (!landing || !element || !projector) return;
    setProjectedPosition(element, projector.projectTablePoint({
      x: landing.x,
      y: projector.physical.surfaceY,
      z: landing.z,
    }));
  }

  function createRuntime(preset) {
    const core = root.MainlineV2Physics.resolveSharedCore(root);
    const scaleAdapter = root.MainlineV2Physics.createScaleAdapter({
      core,
      timeDilation: Math.sqrt(9.81 / 4.2),
      simulationGravity: -4.2,
    });
    return root.MainlineV2Runtime.createRuntime({
      core,
      preset,
      scaleAdapter,
      contactPolicy: root.MainlineV2Contact.createContactPolicy(),
      contactApi: root.MainlineV2Contact,
      stateApi: root.MainlineV2State,
      serveData: root.MainlineV2ServeData,
      trajectoryDiagnostics: root.MainlineV2TrajectoryDiagnostics,
      tableGeometry: root.MainlineV2TableGeometry.PHYSICAL_TABLE_REFERENCE,
    });
  }

  async function boot() {
    const status = $("status");
    const phaseBadge = $("phaseBadge");
    const cameraBadgeTop = $("cameraBadgeTop");
    const cameraBadge = $("cameraBadge");
    const details = $("details");
    const startButton = $("startButton");
    const pushButton = $("pushButton");
    const attackButton = $("attackButton");
    const inputHint = $("inputHint");
    const resultText = $("resultText");
    const omegaSemantic = $("omegaSemantic");
    const omegaX = $("omegaX");
    const omegaY = $("omegaY");
    const omegaZ = $("omegaZ");
    const omegaMagnitude = $("omegaMagnitude");
    const motionState = $("motionState");
    const motionPhase = $("motionPhase");
    const motionPosition = $("motionPosition");
    const motionVelocity = $("motionVelocity");
    const motionSpeed = $("motionSpeed");
    const motionContact = $("motionContact");
    const motionContactCount = $("motionContactCount");
    const trace = $("trace");
    const video = $("serveVideo");
    const videoNote = $("videoNote");
    const tablePanel = $("tablePanel");
    const tableSurface = $("tableSurface");
    const tableCenterLine = $("tableCenterLine");
    const tableNet = $("tableNet");
    const ball = $("ball");
    const racket = $("racket");
    const landingMarker = $("landingMarker");
    const techniqueButtons = [pushButton, attackButton];
    let controller = null;
    let round = null;
    let rafId = 0;
    let videoTimer = 0;
    let videoHandoff = false;
    let videoHandlers = [];
    let gesture = null;
    let tableProjector = null;
    let tableGeometryWidth = 0;
    let tableGeometryHeight = 0;

    function applyGeometrySegment(element, segment) {
      if (!element || !segment) return;
      const dx = segment.b.x - segment.a.x;
      const dy = segment.b.y - segment.a.y;
      const length = Math.hypot(dx, dy);
      element.style.left = `${segment.a.x}px`;
      element.style.top = `${segment.a.y}px`;
      element.style.width = `${length}px`;
      element.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
    }

    function renderTableGeometry() {
      if (!tablePanel || !root.MainlineV2TableGeometry) return;
      const width = tablePanel.clientWidth;
      const height = tablePanel.clientHeight;
      if (!width || !height) return;
      if (tableProjector && width === tableGeometryWidth && height === tableGeometryHeight) return;

      tableProjector = root.MainlineV2TableGeometry.createProjector({width, height});
      tableGeometryWidth = width;
      tableGeometryHeight = height;
      const polygon = tableProjector.tablePolygon()
        .map((projected) => `${projected.x}px ${projected.y}px`)
        .join(", ");
      tableSurface.style.clipPath = `polygon(${polygon})`;
      applyGeometrySegment(tableCenterLine, tableProjector.centerSegment());
      applyGeometrySegment(tableNet, tableProjector.netSegment());
    }

    let statusText = "Loading paired round…";

    function setStatus(text, error) {
      statusText = text;
      status.textContent = text;
      status.classList.toggle("error", Boolean(error));
    }

    function triggerAnimation(element, className) {
      if (!element) return;
      element.classList.remove(className);
      void element.offsetWidth;
      element.classList.add(className);
      window.setTimeout(() => element.classList.remove(className), 360);
    }

    function renderDetails(state) {
      const physics = state && state.physics;
      const rows = [
        ["Preset", state ? state.presetId : "—"],
        ["Video", state ? state.videoId : "—"],
        ["Technique", state && state.selectedTechnique || "—"],
        ["Direction", state && state.selectedDirection || "—"],
        ["Product phase", state ? state.phase : "idle"],
        ["Physics phase", physics ? `${physics.phase}/${physics.flightLeg || "—"}` : "—"],
        ["Camera", cameraLabel(state && state.camera)],
        ["Omega", physics ? formatOmega(physics.ball.omega) : "—"],
      ];
      details.innerHTML = rows.map(([label, value]) =>
        `<dt>${label}</dt><dd><code>${String(value)}</code></dd>`).join("");
    }

    function renderOmegaHud(state) {
      const omega = state && state.physics && state.physics.ball && state.physics.ball.omega;
      if (!omega) {
        omegaSemantic.textContent = "尚未有球";
        [omegaX, omegaY, omegaZ, omegaMagnitude].forEach((element) => { element.textContent = "—"; });
        return;
      }
      const model = root.MainlineV2OmegaHud.createModel(omega);
      omegaSemantic.textContent = model.semanticLabel;
      omegaX.textContent = model.formatted.x;
      omegaY.textContent = model.formatted.y;
      omegaZ.textContent = model.formatted.z;
      omegaMagnitude.textContent = model.formatted.magnitude;
    }

    function renderMotionHud(state) {
      const model = root.MainlineV2MotionHud.createModel({
        productPhase: state && state.phase,
        subphase: state && state.subphase,
        physics: state && state.physics,
      });
      motionState.textContent = model.stateLabel;
      motionPhase.textContent = model.physicsLabel;
      motionContact.textContent = model.contactLabel;
      motionContactCount.textContent = model.hasBall ? String(model.contactCount) : "—";
      motionPosition.textContent = model.formatted.position;
      motionVelocity.textContent = model.formatted.velocity;
      motionSpeed.textContent = model.formatted.speed;
    }

    function renderTrace(state) {
      const events = state && state.events || [];
      trace.textContent = events.slice(-24).map((event, index) => {
        const payload = Object.entries(event)
          .filter(([key]) => key !== "type" && key !== "at")
          .map(([key, value]) => `${key}=${typeof value === "object" ? JSON.stringify(value) : value}`)
          .join(" ");
        return `${events.length - Math.min(events.length, 24) + index + 1}. ${event.type}${payload ? ` ${payload}` : ""}`;
      }).join("\n") || "No round events yet.";
    }

    function render() {
      if (!controller) return;
      const state = controller.snapshot();
      const camera = cameraLabel(state.camera);
      phaseBadge.textContent = state.phase;
      cameraBadgeTop.textContent = `camera: ${camera}`;
      cameraBadge.textContent = `camera: ${camera}`;
      tablePanel.className = `table-panel camera-${state.camera.mode}`;
      renderTableGeometry();
      positionBall(state.physics && state.physics.ball, ball, tableProjector);
      const showRacket = Boolean(state.pendingSwing) || state.phase === "return";
      racket.classList.toggle("visible", showRacket);
      positionRacket(state.physics && state.physics.ball, racket, tableProjector);
      if (state.result && state.result.landing) {
        landingMarker.hidden = false;
        landingMarker.classList.toggle("bad", state.result.status !== "success");
        positionLanding(state.result.landing, landingMarker, tableProjector);
      } else {
        landingMarker.hidden = true;
      }
      const canChoose = state.phase === "serve" && !state.pendingSwing;
      techniqueButtons.forEach((button) => { button.disabled = !canChoose; });
      startButton.disabled = false;
      startButton.textContent = state.phase === "idle" || state.phase === "result" ? "開始發球" : "進行中";
      inputHint.textContent = state.phase === "serve"
        ? (state.pendingSwing ? "揮拍延遲已啟動；滑動可改變回球方向。" : "選擇切球或攻球；按住按鈕左右滑動可指定方向。")
        : "影片接觸時間到達後，球會交接給 canonical V2/V3 runtime。";
      if (state.result) {
        resultText.textContent = state.result.status === "success"
          ? "回合完成（落點目前是 target reference）"
          : `回合失敗：${state.result.reason}`;
        resultText.className = `result ${state.result.status === "success" ? "ok" : "bad"}`;
      } else {
        resultText.textContent = "";
        resultText.className = "result";
      }
      renderMotionHud(state);
      renderOmegaHud(state);
      renderDetails(state);
      renderTrace(state);
    }

    window.addEventListener("resize", () => render(), {passive: true});

    function stopVideoTimer() {
      if (videoTimer) window.clearTimeout(videoTimer);
      videoTimer = 0;
    }

    function handoffVideo(reason) {
      if (videoHandoff || !controller || controller.snapshot().phase !== "video") return;
      videoHandoff = true;
      stopVideoTimer();
      video.pause();
      video.classList.add("exiting");
      window.setTimeout(() => video.classList.remove("exiting"), 280);
      try {
        controller.handoff(reason);
        videoNote.textContent = `Video handoff: ${reason}`;
        setStatus("影片已交接，等待球到達桌面", false);
        render();
      } catch (error) {
        setStatus(`Video handoff failed: ${error.message}`, true);
      }
    }

    function armVideo(videoEntry) {
      videoHandoff = false;
      stopVideoTimer();
      videoHandlers.forEach(([type, handler]) => video.removeEventListener(type, handler));
      videoHandlers = [];
      video.classList.remove("exiting");
      videoNote.textContent = "影片播放中";
      video.src = `../${videoEntry.src}`;
      video.currentTime = 0;
      const triggerAt = () => Number.isFinite(videoEntry.contactTimeSec)
        ? videoEntry.contactTimeSec
        : (Number.isFinite(video.duration) ? video.duration * 0.7 : 0.7);
      const onTime = () => {
        if (video.currentTime >= triggerAt()) handoffVideo("video-contact-time");
      };
      const onError = () => handoffVideo("video-error");
      video.addEventListener("timeupdate", onTime);
      video.addEventListener("loadedmetadata", onTime, {once: true});
      video.addEventListener("error", onError, {once: true});
      videoHandlers = [["timeupdate", onTime], ["loadedmetadata", onTime], ["error", onError]];
      video.load();
      const playResult = video.play();
      if (playResult && typeof playResult.catch === "function") {
        playResult.catch(() => handoffVideo("video-play-fallback"));
      }
      videoTimer = window.setTimeout(() => handoffVideo("video-timeout"), 2400);
    }

    function startPhysicsLoop() {
      if (rafId) return;
      const tick = () => {
        rafId = 0;
        if (!controller) return;
        const phase = controller.snapshot().phase;
        if (phase === "serve" || phase === "return") controller.step(1 / 120);
        render();
        if (controller.snapshot().phase !== "result") rafId = window.requestAnimationFrame(tick);
      };
      rafId = window.requestAnimationFrame(tick);
    }

    function beginSwing(technique) {
      if (!controller) return;
      const state = controller.snapshot();
      if (state.phase !== "serve" || state.pendingSwing) return;
      const x = state.physics && state.physics.ball ? state.physics.ball.position.x : 0;
      controller.chooseReturn({
        technique,
        side: x < 0 ? "backhand" : "forehand",
        direction: gesture && gesture.direction || null,
      });
      setStatus("揮拍延遲已啟動", false);
      render();
    }

    function onPointerDown(event) {
      const button = event.currentTarget;
      gesture = {pointerId: event.pointerId, startX: event.clientX, direction: null};
      if (button.setPointerCapture) button.setPointerCapture(event.pointerId);
    }

    function onPointerMove(event) {
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      const dx = event.clientX - gesture.startX;
      const direction = dx <= -24 ? "left" : dx >= 24 ? "right" : null;
      if (direction !== gesture.direction) {
        gesture.direction = direction;
        if (controller && controller.snapshot().pendingSwing) controller.updateDirection(direction);
        render();
      }
    }

    function clearGesture(event) {
      if (gesture && (!event || gesture.pointerId === event.pointerId)) gesture = null;
    }

    try {
      const core = root.MainlineV2Physics.resolveSharedCore(root);
      const [presets, videos] = await Promise.all([
        root.MainlineV2ServeData.loadPresetFile("../physics-presets.json"),
        root.MainlineV2ProductData.loadVideoFile("../videos.json"),
      ]);
      const rounds = root.MainlineV2ProductData.buildRoundCatalog(presets, videos);
      round = root.MainlineV2ProductData.findMixedRound(rounds);
      if (!round) throw new Error("no paired mixed-spin product round found");
      controller = root.MainlineV2Game5Product.createController({
        round,
        runtimeFactory: createRuntime,
        swingDelayMs: 140,
        dtSimulation: 1 / 120,
        racketInterceptDurationSimulation: 0.3,
        returnDurationSimulation: 0.42,
        netPlaneZ: NET_PLANE_Z,
        trajectoryDiagnostics: root.MainlineV2TrajectoryDiagnostics,
        tableGeometry: root.MainlineV2TableGeometry.PHYSICAL_TABLE_REFERENCE,
        onEvent: (event) => {
          if (event.type === "round-start") setStatus("配對影片已載入", false);
          if (event.type === "video-handoff") setStatus("影片已交接，等待桌面反彈", false);
          if (event.type === "table-bounce") {
            setStatus("桌面反彈，請輸入回球", false);
            triggerAnimation(ball, "bounce");
          }
          if (event.type === "net-crossing") {
            setStatus("球已過網", false);
            triggerAnimation(ball, "net-crossing");
          }
          if (event.type === "swing-start") setStatus("揮拍延遲已啟動", false);
          if (event.type === "racket-contact") {
            setStatus("球拍接觸", false);
            triggerAnimation(racket, "hit");
            triggerAnimation(ball, "hit");
          }
          if (event.type === "result") {
            setStatus(event.status === "success" ? "回合完成" : `回合失敗：${event.reason}`, event.status !== "success");
            if (event.status !== "success") triggerAnimation(racket, "whiff");
          }
          render();
        },
      });
      void core;
      setStatus(`已載入 ${round.preset.id} / ${round.video.id}`, false);
      startButton.disabled = false;
      startButton.addEventListener("click", () => {
        try {
          if (controller.snapshot().phase === "idle" || controller.snapshot().phase === "result") {
            controller.startRound();
            armVideo(round.video);
            startPhysicsLoop();
            render();
          }
        } catch (error) {
          setStatus(`回合啟動失敗：${error.message}`, true);
          render();
        }
      });
      techniqueButtons.forEach((button) => {
        button.addEventListener("pointerdown", onPointerDown);
        button.addEventListener("pointermove", onPointerMove);
        button.addEventListener("pointerup", clearGesture);
        button.addEventListener("pointercancel", clearGesture);
        button.addEventListener("click", () => beginSwing(button.dataset.technique));
      });
      render();
    } catch (error) {
      setStatus(`V6 product shell failed to load: ${error.message}`, true);
      trace.textContent = error.stack || error.message;
      startButton.disabled = true;
    }
  }

  if (typeof document !== "undefined") boot();
}(typeof globalThis !== "undefined" ? globalThis : this));
