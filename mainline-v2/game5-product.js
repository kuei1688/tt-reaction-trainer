(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.MainlineV2Game5Product = factory();
  }
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const PHASES = Object.freeze(["idle", "video", "serve", "return", "result"]);
  const TECHNIQUES = Object.freeze(["attack", "push"]);
  const SIDES = Object.freeze(["forehand", "backhand"]);
  const DIRECTIONS = Object.freeze([null, "left", "right"]);

  function finite(value, label) {
    if (!Number.isFinite(value)) throw new Error(`${label} must be finite`);
    return value;
  }

  function cloneVector(value) {
    return {x: value.x, y: value.y, z: value.z};
  }

  function cloneEvent(event) {
    return {...event};
  }

  function cameraFor(phase) {
    if (phase === "video") return {mode: "video", target: "serve"};
    if (phase === "serve") return {mode: "follow-ball", target: "ball"};
    if (phase === "return") return {mode: "return-follow", target: "return"};
    if (phase === "result") return {mode: "landing-focus", target: "landing"};
    return {mode: "home", target: "table"};
  }

  function createController(options) {
    const config = options || {};
    if (!config.round || !config.round.preset || !config.round.video) {
      throw new Error("Game 5 product controller requires a paired round");
    }
    if (typeof config.runtimeFactory !== "function") {
      throw new Error("Game 5 product controller requires runtimeFactory");
    }
    const now = typeof config.now === "function" ? config.now : () => Date.now();
    const swingDelayMs = Number.isFinite(config.swingDelayMs) && config.swingDelayMs >= 0
      ? config.swingDelayMs
      : 140;
    const dtSimulation = Number.isFinite(config.dtSimulation) && config.dtSimulation > 0
      ? config.dtSimulation
      : 1 / 120;
    const racketInterceptDurationSimulation = Number.isFinite(config.racketInterceptDurationSimulation) &&
      config.racketInterceptDurationSimulation > 0
      ? config.racketInterceptDurationSimulation
      : (Number.isFinite(config.racketDurationSimulation) && config.racketDurationSimulation > 0
        ? config.racketDurationSimulation
        : 0.3);
    const returnDurationSimulation = Number.isFinite(config.returnDurationSimulation) && config.returnDurationSimulation > 0
      ? config.returnDurationSimulation
      : 0.42;
    const netPlaneZ = Number.isFinite(config.netPlaneZ) ? config.netPlaneZ : 0;
    const trajectoryDiagnostics = config.trajectoryDiagnostics || null;
    const tableGeometry = config.tableGeometry || null;
    const onEvent = typeof config.onEvent === "function" ? config.onEvent : () => {};
    let runtime = null;
    let session = {
      phase: "idle",
      subphase: "ready",
      presetId: config.round.preset.id,
      videoId: config.round.video.id,
      videoSrc: config.round.video.src,
      selectedTechnique: null,
      selectedSide: null,
      selectedDirection: null,
      pendingSwing: null,
      swingReady: false,
      postTableElapsed: 0,
      racketInterceptPoint: null,
      netCrossed: false,
      netClearance: null,
      netPasses: null,
      netStatus: null,
      returnElapsed: 0,
      physics: null,
      camera: cameraFor("idle"),
      result: null,
      events: [],
    };

    function snapshot() {
      return {
        ...session,
        pendingSwing: session.pendingSwing && {...session.pendingSwing},
        racketInterceptPoint: session.racketInterceptPoint && {...session.racketInterceptPoint},
        physics: session.physics,
        camera: {...session.camera},
        result: session.result && {...session.result},
        events: session.events.map(cloneEvent),
      };
    }

    function emit(type, payload) {
      const event = {type, at: now(), ...(payload || {})};
      session = {...session, events: session.events.concat([event])};
      onEvent(event, snapshot());
      return event;
    }

    function setPhase(phase, subphase) {
      if (!PHASES.includes(phase)) throw new Error(`unsupported product phase: ${phase}`);
      session = {
        ...session,
        phase,
        subphase: subphase || phase,
        camera: cameraFor(phase),
      };
      emit("phase-change", {phase, subphase: session.subphase, camera: session.camera});
    }

    function setCamera(mode, target) {
      session = {...session, camera: {mode, target}};
      emit("camera-change", {camera: session.camera});
    }

    function syncPhysics() {
      session = {...session, physics: runtime ? runtime.snapshot() : null};
      return session.physics;
    }

    function checkNetCrossing(beforePhysics, afterPhysics) {
      if (session.netCrossed || !beforePhysics || !afterPhysics ||
          !beforePhysics.ball || !afterPhysics.ball) return;
      const before = beforePhysics.ball.position;
      const after = afterPhysics.ball.position;
      const crossing = trajectoryDiagnostics &&
        typeof trajectoryDiagnostics.netCrossing === "function"
        ? trajectoryDiagnostics.netCrossing(beforePhysics.ball, afterPhysics.ball, {
          ...(tableGeometry || {}),
          netZ: netPlaneZ,
        })
        : (() => {
          const deltaZ = after.z - before.z;
          if (!(before.z < netPlaneZ && after.z >= netPlaneZ) || !(deltaZ > 0)) return null;
          const fraction = (netPlaneZ - before.z) / deltaZ;
          return {
            point: {
              x: before.x + (after.x - before.x) * fraction,
              y: before.y + (after.y - before.y) * fraction,
              z: netPlaneZ,
            },
            fraction,
            clearance: null,
            passesNet: null,
            status: "unmeasured",
          };
        })();
      if (!crossing) return;
      session = {
        ...session,
        netCrossed: true,
        netClearance: crossing.clearance,
        netPasses: crossing.passesNet,
        netStatus: crossing.status,
      };
      emit("net-crossing", {
        point: crossing.point,
        fraction: crossing.fraction,
        clearance: crossing.clearance,
        passesNet: crossing.passesNet,
        status: crossing.status,
      });
    }

    function startRound() {
      if (session.phase !== "idle" && session.phase !== "result") {
        throw new Error(`cannot start round from ${session.phase}`);
      }
      runtime = config.runtimeFactory(config.round.preset);
      if (!runtime || typeof runtime.startServe !== "function") {
        throw new Error("runtimeFactory did not return a V2 runtime");
      }
      const physics = runtime.startServe();
      session = {
        phase: "idle",
        subphase: "ready",
        presetId: config.round.preset.id,
        videoId: config.round.video.id,
        videoSrc: config.round.video.src,
        selectedTechnique: null,
        selectedSide: null,
        selectedDirection: null,
        pendingSwing: null,
        swingReady: false,
        postTableElapsed: 0,
        racketInterceptPoint: null,
        netCrossed: false,
        netClearance: null,
        netPasses: null,
        netStatus: null,
        returnElapsed: 0,
        physics,
        camera: cameraFor("idle"),
        result: null,
        events: [],
      };
      emit("round-start", {
        presetId: config.round.preset.id,
        videoId: config.round.video.id,
        videoSrc: config.round.video.src,
      });
      setPhase("video", "video-playback");
      return snapshot();
    }

    function handoff(reason) {
      if (session.phase !== "video") throw new Error(`cannot handoff from ${session.phase}`);
      setPhase("serve", "serve-flight");
      emit("video-handoff", {
        reason: reason || "video-contact-time",
        videoId: config.round.video.id,
      });
      setCamera("follow-ball", "ball");
      return snapshot();
    }

    function chooseReturn(request) {
      const choice = request || {};
      if (session.phase !== "serve") throw new Error(`cannot choose return from ${session.phase}`);
      if (session.pendingSwing) throw new Error("return choice already selected");
      if (!TECHNIQUES.includes(choice.technique)) throw new Error(`unsupported technique: ${choice.technique}`);
      if (!SIDES.includes(choice.side)) throw new Error(`unsupported side: ${choice.side}`);
      if (!DIRECTIONS.includes(choice.direction == null ? null : choice.direction)) {
        throw new Error(`unsupported direction: ${choice.direction}`);
      }
      const pendingSwing = {
        technique: choice.technique,
        side: choice.side,
        direction: choice.direction == null ? null : choice.direction,
        fireAt: now() + swingDelayMs,
        fired: false,
      };
      session = {
        ...session,
        selectedTechnique: choice.technique,
        selectedSide: choice.side,
        selectedDirection: pendingSwing.direction,
        pendingSwing,
        swingReady: false,
      };
      emit("swing-start", {
        technique: choice.technique,
        side: choice.side,
        direction: pendingSwing.direction,
        delayMs: swingDelayMs,
      });
      setCamera("intercept", "racket");
      return snapshot();
    }

    function updateDirection(direction) {
      if (!DIRECTIONS.includes(direction == null ? null : direction)) {
        throw new Error(`unsupported direction: ${direction}`);
      }
      if (!session.pendingSwing || session.pendingSwing.fired) return snapshot();
      const resolved = direction == null ? null : direction;
      session = {
        ...session,
        selectedDirection: resolved,
        pendingSwing: {...session.pendingSwing, direction: resolved},
      };
      emit("direction-change", {direction: resolved});
      return snapshot();
    }

    function fail(reason, detail) {
      if (session.phase === "result") return snapshot();
      const result = {
        status: "failure",
        reason: reason || "round-failed",
        detail: detail || null,
        landing: null,
      };
      session = {...session, result};
      setPhase("result", "failure");
      emit("result", result);
      return snapshot();
    }

    function completeRacketContact() {
      if (!session.pendingSwing || session.pendingSwing.fired) return snapshot();
      session = {
        ...session,
        pendingSwing: {...session.pendingSwing, fired: true},
      };
      const swing = session.pendingSwing;
      try {
        const interceptPhysics = runtime.snapshot();
        const racketInterceptPoint = {
          x: interceptPhysics.ball.position.x,
          y: interceptPhysics.ball.position.y,
          z: interceptPhysics.ball.position.z,
          meaning: "raw-integrated-ball-state-at-racket-intercept-time",
          durationSimulation: racketInterceptDurationSimulation,
        };
        session = {...session, racketInterceptPoint};
        const racketState = runtime.contact("racket");
        syncPhysics();
        emit("racket-contact", {
          technique: swing.technique,
          side: swing.side,
          direction: swing.direction,
          interceptPoint: {...racketInterceptPoint},
          omega: cloneVector(racketState.ball.omega),
          contactModel: racketState.diagnostics.at(-1).contactModel,
        });
        const returnState = runtime.beginReturn();
        syncPhysics();
        emit("return-start", {omega: cloneVector(returnState.ball.omega)});
        setPhase("return", "return-flight");
        session = {...session, returnElapsed: 0};
        setCamera("return-follow", "return");
        return snapshot();
      } catch (error) {
        return fail("runtime-failure", error.message);
      }
    }

    function completeReturn() {
      const landing = {
        x: config.round.preset.secondBounce.x,
        y: config.round.preset.secondBounce.y,
        z: config.round.preset.secondBounce.z,
        kind: "validation-reference",
        validated: false,
        reference: "preset.secondBounce",
      };
      const result = {
        status: "success",
        reason: "return-validation-reference",
        detail: "Product completion only; secondBounce is a validation reference, not a trajectory target or measured landing.",
        landing,
      };
      const physics = runtime.finish({status: "v4-product-shell-complete", landing});
      session = {...session, physics, result};
      emit("landing-marker", landing);
      setPhase("result", "success");
      emit("result", result);
      return snapshot();
    }

    function step(dt) {
      const stepSimulation = Number.isFinite(dt) && dt > 0 ? dt : dtSimulation;
      if (!runtime || session.phase === "idle" || session.phase === "video" || session.phase === "result") {
        return snapshot();
      }
      try {
        const physics = runtime.snapshot();
        if (session.phase === "serve" && physics.phase === "serve" ||
            session.phase === "serve" && physics.phase === "flight" && physics.flightLeg === "serve") {
          const next = runtime.advanceFlight(stepSimulation);
          syncPhysics();
          session = {...session, subphase: "serve-flight"};
          if (next.ball.position.y <= config.round.preset.firstBounce.y) {
            const tableState = runtime.contact("table");
            syncPhysics();
            session = {...session, subphase: "post-table", postTableElapsed: 0};
            emit("table-bounce", {
              point: cloneVector(tableState.ball.position),
              omega: cloneVector(tableState.ball.omega),
              contactModel: tableState.diagnostics.at(-1).contactModel,
              tableCrossing: next.diagnostics.at(-1).tableCrossing || null,
            });
          }
          return snapshot();
        }
        const isPostTableContact = session.phase === "serve" &&
          ((physics.phase === "contact" && physics.lastContact === "table") ||
            (physics.phase === "flight" && physics.flightLeg === "post-table"));
        if (isPostTableContact) {
          const beforePhysics = physics;
          runtime.advanceFlight(stepSimulation);
          const afterPhysics = syncPhysics();
          checkNetCrossing(beforePhysics, afterPhysics);
          session = {
            ...session,
            subphase: "post-table",
            postTableElapsed: session.postTableElapsed + stepSimulation,
          };
          if (session.pendingSwing && !session.pendingSwing.fired && !session.swingReady &&
              now() >= session.pendingSwing.fireAt) {
            session = {...session, swingReady: true};
            emit("swing-ready", {
              technique: session.pendingSwing.technique,
              side: session.pendingSwing.side,
            });
            setCamera("intercept", "racket");
          }
          if (session.postTableElapsed >= racketInterceptDurationSimulation) {
            if (!session.pendingSwing) return fail("no-return-input", "沒有在擊球時間窗內選擇技術");
            if (now() >= session.pendingSwing.fireAt) return completeRacketContact();
          }
          return snapshot();
        }
        if (session.phase === "return") {
          const next = runtime.advanceReturn(stepSimulation);
          syncPhysics();
          session = {...session, returnElapsed: session.returnElapsed + stepSimulation};
          if (session.returnElapsed >= returnDurationSimulation) return completeReturn();
          return snapshot();
        }
      } catch (error) {
        return fail("runtime-failure", error.message);
      }
      return snapshot();
    }

    return Object.freeze({
      PHASES,
      startRound,
      handoff,
      chooseReturn,
      updateDirection,
      step,
      snapshot,
    });
  }

  return Object.freeze({PHASES, createController});
}));
