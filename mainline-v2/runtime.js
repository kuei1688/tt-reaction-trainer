(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.MainlineV2Runtime = factory();
  }
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function createRuntime(options) {
    const config = options || {};
    if (!config.core) throw new Error("v2 runtime requires shared core");
    if (!config.preset) throw new Error("v2 runtime requires canonical preset");
    if (!config.scaleAdapter) throw new Error("v2 runtime requires scale adapter");
    if (!config.contactPolicy) throw new Error("v2 runtime requires contact policy");
    if (!config.stateApi) throw new Error("v2 runtime requires state API");
    if (!config.serveData || typeof config.serveData.deriveServeVelocity !== "function") {
      throw new Error("v2 runtime requires canonical serve-data adapter");
    }

    const {core, preset, scaleAdapter, contactPolicy, stateApi, serveData} = config;
    const trajectoryDiagnostics = config.trajectoryDiagnostics || null;
    const tableGeometry = config.tableGeometry || null;
    let session = stateApi.createTrainerState(preset.id);

    function cloneVector(value) {
      return {x: value.x, y: value.y, z: value.z};
    }

    function diagnostic(stage, ball, extra) {
      return {
        stage,
        velocity: cloneVector(ball.velocity),
        omega: cloneVector(ball.omega),
        scale: {
          state: "real-scale",
          timeDilation: scaleAdapter.timeDilation,
          simulationGravity: scaleAdapter.simulationGravity,
          realGravity: scaleAdapter.realGravity,
        },
        ...(extra || {}),
      };
    }

    function record(phase, ball, extra, sampleMeta, patch) {
      const entry = diagnostic(phase, ball, extra);
      session = stateApi.withBall(session, phase, ball, entry, {
        ...(sampleMeta || {}),
        diagnostic: entry,
      });
      if (patch) session = {...session, ...patch};
      return snapshot();
    }

    function requirePhase(condition, message) {
      if (!condition) throw new Error(message);
    }

    function interpolateBall(before, after, fraction) {
      const t = Math.max(0, Math.min(1, fraction));
      const lerp = (a, b) => a + (b - a) * t;
      return stateApi.createBallState({
        position: {
          x: lerp(before.position.x, after.position.x),
          y: lerp(before.position.y, after.position.y),
          z: lerp(before.position.z, after.position.z),
        },
        velocity: after.velocity,
        spin3d: {schema: 2, omega: after.omega},
        mass: after.mass,
        inertia: after.inertia,
      });
    }

    function crossDownwardHeight(before, after, height) {
      return before.position.y > height && after.position.y <= height && after.velocity.y < 0;
    }

    function advanceToTable(options) {
      const config = options || {};
      requirePhase(
        session.ball && (session.phase === "serve" || session.phase === "flight") && session.flightLeg === "serve",
        `cannot advance to table from phase ${session.phase}/${session.flightLeg}`
      );
      const height = Number.isFinite(config.height) ? config.height : preset.firstBounce.y;
      const dt = Number.isFinite(config.stepSimulation) && config.stepSimulation > 0
        ? config.stepSimulation
        : 1 / 240;
      const maxSteps = Number.isFinite(config.maxSteps) ? Math.floor(config.maxSteps) : 1200;
      let before = stateApi.cloneBallState(session.ball);
      let elapsed = 0;
      for (let index = 0; index < maxSteps; index += 1) {
        const after = scaleAdapter.advanceSimulationState(before, dt);
        if (crossDownwardHeight(before, after, height)) {
          const fraction = (before.position.y - height) /
            (before.position.y - after.position.y);
          const eventBall = interpolateBall(before, after, fraction);
          eventBall.position.y = height;
          const tableCrossing = trajectoryDiagnostics &&
            typeof trajectoryDiagnostics.tableCrossing === "function"
            ? trajectoryDiagnostics.tableCrossing(before, after, tableGeometry, height)
            : null;
          return record("flight", eventBall, {
            event: "flight-to-table",
            target: "table",
            durationSimulation: elapsed + dt * fraction,
            ...(tableCrossing ? {tableCrossing} : {}),
          }, {leg: "serve", event: "flight-to-table", target: "table"});
        }
        before = after;
        elapsed += dt;
      }
      throw new Error(`serve flight did not reach table height ${height}`);
    }

    function snapshot() {
      return {
        ...session,
        ball: session.ball && stateApi.cloneBallState(session.ball),
        samples: session.samples.map((sample) => ({
          ...sample,
          ball: stateApi.cloneBallState(sample.ball),
        })),
        diagnostics: session.diagnostics.map((diagnostic) => ({...diagnostic})),
      };
    }

    function startServe() {
      const serveVelocity = serveData.deriveServeVelocity(preset, {
        timeDilation: scaleAdapter.timeDilation,
        realGravity: scaleAdapter.realGravity,
        solveLaunchVelocity: scaleAdapter.solveLaunchVelocity,
      });
      const hasProvidedVelocity = Boolean(
        preset.variation && preset.variation.velocity &&
        Math.hypot(
          preset.variation.velocity.x,
          preset.variation.velocity.y,
          preset.variation.velocity.z
        ) > 1e-9
      );
      session = stateApi.startServe(session, preset, serveVelocity);
      return record("serve", session.ball, {
        event: "serve-start",
        velocitySource: hasProvidedVelocity
          ? "preset-real-scale"
          : "3d-forward-solved-real-scale",
      }, {leg: "serve", event: "serve-start"});
    }

    function advanceFlight(dtSimulation) {
      const canAdvance = session.ball &&
        (session.phase === "serve" || session.phase === "flight" ||
          (session.phase === "contact" && session.lastContact === "table"));
      if (!canAdvance) {
        throw new Error(`cannot advance flight from phase ${session.phase}`);
      }
      const nextBall = scaleAdapter.advanceSimulationState(session.ball, dtSimulation);
      const nextLeg = session.phase === "contact" ? "post-table" : session.flightLeg;
      const tableCrossing = trajectoryDiagnostics &&
        typeof trajectoryDiagnostics.tableCrossing === "function"
        ? trajectoryDiagnostics.tableCrossing(session.ball, nextBall, tableGeometry, preset.firstBounce.y)
        : null;
      return record("flight", nextBall, {
        event: "flight-step",
        leg: nextLeg,
        dtSimulation,
        ...(tableCrossing ? {tableCrossing} : {}),
      }, {leg: nextLeg, event: "flight-step"}, {flightLeg: nextLeg});
    }

    function advanceToRacket(options) {
      const config = options || {};
      requirePhase(
        session.ball && session.phase === "contact" && session.lastContact === "table",
        `cannot advance to racket from phase ${session.phase}/${session.lastContact}`
      );
      const durationSimulation = Number.isFinite(config.durationSimulation) && config.durationSimulation > 0
        ? config.durationSimulation
        : 0.3;
      const nextBall = scaleAdapter.advanceSimulationState(session.ball, durationSimulation);
      const interceptReference = config.interceptReference || {
        x: nextBall.position.x,
        y: nextBall.position.y,
        z: nextBall.position.z,
        meaning: "raw-integrated-ball-state-at-racket-intercept-time",
      };
      return record("flight", nextBall, {
        event: "flight-to-racket",
        leg: "post-table",
        durationSimulation,
        interceptReference: {
          x: interceptReference.x,
          y: interceptReference.y,
          z: interceptReference.z,
          meaning: interceptReference.meaning || "independent-racket-intercept-reference",
        },
      }, {leg: "post-table", event: "flight-to-racket", target: "racket"}, {flightLeg: "post-table"});
    }

    function contact(kind) {
      const contactKind = kind || "table";
      const validTable = contactKind === "table" && session.phase === "flight" && session.flightLeg === "serve";
      const validRacket = contactKind === "racket" && session.phase === "flight" && session.flightLeg === "post-table";
      if (!session.ball || (!validTable && !validRacket)) {
        throw new Error(`cannot contact from phase ${session.phase}`);
      }
      const surface = contactPolicy[contactKind];
      if (!surface) throw new Error(`unknown contact surface: ${contactKind}`);
      const response = config.contactApi.solveContact({
        state: session.ball,
        surface,
        mode: surface.mode,
      }, core);
      return record("contact", response.state, {
        contact: contactKind,
        surface: surface.name,
        adapter: surface.adapter || "shared-plane-contact",
        ...response.diagnostics,
      }, {contact: contactKind, event: "contact", leg: session.flightLeg}, {
        lastContact: contactKind,
        contactCount: session.contactCount + 1,
      });
    }

    function beginReturn() {
      requirePhase(
        session.ball && session.phase === "contact" && session.lastContact === "racket",
        `cannot begin return from phase ${session.phase}/${session.lastContact}`
      );
      return record("return", session.ball, {
        event: "return-start",
      }, {leg: "return", event: "return-start"}, {flightLeg: "return"});
    }

    function advanceReturn(dtSimulation) {
      requirePhase(session.ball && session.phase === "return", `cannot advance return from phase ${session.phase}`);
      const nextBall = scaleAdapter.advanceSimulationState(session.ball, dtSimulation);
      return record("return", nextBall, {
        event: "return-flight",
        dtSimulation,
      }, {leg: "return", event: "return-flight"});
    }

    function finish(result) {
      if (session.phase !== "return") {
        throw new Error(`cannot finish from phase ${session.phase}`);
      }
      session = stateApi.setResult(session, result || {status: "pending"});
      return snapshot();
    }

    return Object.freeze({
      startServe,
      advanceFlight,
      advanceToTable,
      advanceToRacket,
      contact,
      beginReturn,
      advanceReturn,
      finish,
      snapshot,
    });
  }

  return Object.freeze({createRuntime});
}));
