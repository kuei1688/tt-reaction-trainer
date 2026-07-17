(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(globalThis);
  } else {
    root.TableTennisRallySemantics = factory(root);
  }
}(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const TIME_DILATION = Math.sqrt(9.81 / 4.2);
  const TABLE = root.MainlineV2TableGeometry.PHYSICAL_TABLE_REFERENCE;
  const RACKET_DELAY_SIMULATION = 0.30;
  const DEFAULT_STEP_SIMULATION = TIME_DILATION / 120;

  const PHASES = Object.freeze({
    SERVE_FLIGHT: "serve-flight",
    OWN_TABLE_CONTACT: "own-table-contact",
    OPPONENT_FLIGHT: "opponent-flight",
    OPPONENT_TABLE_CONTACT: "opponent-table-contact",
    RECEIVER_APPROACH: "receiver-approach",
    RACKET_CONTACT: "racket-contact",
    RETURN_FLIGHT: "return-flight",
    OWN_RETURN_CONTACT: "own-return-contact",
    COMPLETE: "complete",
    FAILURE: "failure",
  });

  const SCENARIOS = Object.freeze({
    zero: Object.freeze({
      label: "zero spin",
      omega: Object.freeze({x: 0, y: 0, z: 0}),
      serveVelocity: Object.freeze({x: 0, y: 3.8, z: 0.95}),
    }),
    side: Object.freeze({
      label: "omega.y + side spin",
      omega: Object.freeze({x: 42, y: 70, z: -15}),
      serveVelocity: Object.freeze({x: 0.1, y: 3.8, z: 0.95}),
    }),
    mixed: Object.freeze({
      label: "mixed omega",
      omega: Object.freeze({x: 70, y: 70, z: -35}),
      serveVelocity: Object.freeze({x: 0.1, y: 3.8, z: 0.95}),
    }),
  });

  function vector(value) {
    const source = value || {};
    return {
      x: Number(source.x) || 0,
      y: Number(source.y) || 0,
      z: Number(source.z) || 0,
    };
  }

  function cloneBall(ball) {
    return root.MainlineV2State.cloneBallState(ball);
  }

  function clonePoint(point) {
    const source = point || {};
    return {x: Number(source.x) || 0, y: Number(source.y) || 0, z: Number(source.z) || 0};
  }

  function interpolateToTable(before, after) {
    const denominator = before.position.y - after.position.y;
    const fraction = Math.abs(denominator) > 1e-9
      ? (before.position.y - TABLE.surfaceY) / denominator
      : 1;
    const clamped = Math.max(0, Math.min(1, fraction));
    const position = {
      x: before.position.x + (after.position.x - before.position.x) * clamped,
      y: TABLE.surfaceY,
      z: before.position.z + (after.position.z - before.position.z) * clamped,
    };
    return root.MainlineV2State.createBallState({
      ...after,
      position,
    });
  }

  function crossesDownwardTable(before, after) {
    return before.position.y > TABLE.surfaceY &&
      after.position.y <= TABLE.surfaceY &&
      after.velocity.y < 0;
  }

  function inTable(point) {
    return Math.abs(point.x) <= TABLE.width / 2 + 1e-6 &&
      Math.abs(point.z) <= TABLE.length / 2 + 1e-6;
  }

  function sideForZ(z) {
    return z < 0 ? "server" : "receiver";
  }

  function createReturnRacketSurface(contactPolicy) {
    // The plane is intentionally explicit: it represents the receiver's
    // isolated return-facing plane, not a calibrated racket pose or preset.
    return Object.freeze({
      ...contactPolicy.racket,
      name: "isolated-receiver-return-plane",
      normal: {x: 0, y: 0, z: -1},
      surfaceVelocity: {x: 0, y: 0, z: -1},
      contactModel: "isolated-semantics-racket-return-plane",
    });
  }

  function createPreset(key, scenario) {
    return {
      schema: 2,
      id: `isolated-semantic-${key}`,
      type: "serve",
      start: {x: 0, y: 1, z: -1.1},
      firstBounce: {x: 0, y: TABLE.surfaceY, z: -0.29},
      secondBounce: {x: 0, y: TABLE.surfaceY, z: 0.4},
      variation: {
        velocity: vector(scenario.serveVelocity),
        spin3d: {schema: 2, omega: vector(scenario.omega)},
      },
      solve: {gravity: -4.2, timeToFirst: 0.74},
      tags: {
        source: "isolated-semantics-aware-rally-preview",
        scenario: key,
      },
    };
  }

  function createSimulator(key) {
    const scenario = SCENARIOS[key] || SCENARIOS.side;
    const core = root.MainlineV2Physics.resolveSharedCore(root);
    const scaleAdapter = root.MainlineV2Physics.createScaleAdapter({
      core,
      timeDilation: TIME_DILATION,
      simulationGravity: -4.2,
    });
    const contactPolicy = root.MainlineV2Contact.createContactPolicy();
    const returnRacket = createReturnRacketSurface(contactPolicy);
    const preset = createPreset(key, scenario);
    let ball = root.MainlineV2State.createBallState({
      position: preset.start,
      velocity: preset.variation.velocity,
      spin3d: preset.variation.spin3d,
    });
    let phase = PHASES.SERVE_FLIGHT;
    let physicalTimeSec = 0;
    let receiverElapsedSimulation = 0;
    let lastContact = null;
    const contacts = [];
    const events = [{
      type: "serve-start",
      side: "server",
      point: clonePoint(ball.position),
      time: 0,
    }];
    const trace = [{
      time: 0,
      phase,
      ball: cloneBall(ball),
    }];
    let failure = null;

    function addEvent(type, data) {
      const event = {
        type,
        time: physicalTimeSec,
        ...(data || {}),
      };
      events.push(event);
      return event;
    }

    function addTrace() {
      trace.push({
        time: physicalTimeSec,
        phase,
        ball: cloneBall(ball),
      });
    }

    function fail(reason, detail) {
      if (failure) return;
      failure = {reason, detail: detail || null};
      phase = PHASES.FAILURE;
      addEvent("semantic-failure", failure);
      addTrace();
    }

    function contactTable(expectedSide, label) {
      const actualSide = sideForZ(ball.position.z);
      const legalPosition = inTable(ball.position);
      const sideMatches = expectedSide === actualSide;
      if (!legalPosition || !sideMatches) {
        fail("illegal-table-side", {
          label,
          expectedSide,
          actualSide,
          position: clonePoint(ball.position),
          inTable: legalPosition,
        });
        return;
      }
      const response = root.MainlineV2Contact.solveContact({
        state: ball,
        surface: contactPolicy.table,
        mode: contactPolicy.table.mode,
      }, core);
      ball = response.state;
      lastContact = "table";
      contacts.push({
        kind: "table",
        label,
        side: actualSide,
        point: clonePoint(ball.position),
        omega: vector(ball.omega),
        diagnostics: response.diagnostics,
      });
      addEvent("table-contact", {
        label,
        side: actualSide,
        point: clonePoint(ball.position),
        omega: vector(ball.omega),
      });
    }

    function contactRacket() {
      if (sideForZ(ball.position.z) !== "receiver") {
        fail("receiver-contact-on-wrong-side", {position: clonePoint(ball.position)});
        return;
      }
      const response = root.MainlineV2Contact.solveContact({
        state: ball,
        surface: returnRacket,
        mode: returnRacket.mode,
      }, core);
      ball = response.state;
      lastContact = "racket";
      contacts.push({
        kind: "racket",
        label: "receiver-return",
        side: "receiver",
        point: clonePoint(ball.position),
        omega: vector(ball.omega),
        diagnostics: response.diagnostics,
      });
      addEvent("racket-contact", {
        label: "receiver-return",
        side: "receiver",
        point: clonePoint(ball.position),
        omega: vector(ball.omega),
      });
    }

    function transitionAfterTable() {
      const tableContactCount = contacts.filter((contact) => contact.kind === "table").length;
      if (tableContactCount === 1) {
        phase = PHASES.OPPONENT_FLIGHT;
      } else if (tableContactCount === 2) {
        phase = PHASES.RECEIVER_APPROACH;
        receiverElapsedSimulation = 0;
      } else if (tableContactCount === 3) {
        phase = PHASES.COMPLETE;
        addEvent("rally-complete", {
          status: "success",
          point: clonePoint(ball.position),
        });
      }
    }

    function step(dtSimulation) {
      if (phase === PHASES.COMPLETE || phase === PHASES.FAILURE) return snapshot();
      const dt = Number.isFinite(dtSimulation) && dtSimulation > 0
        ? dtSimulation
        : DEFAULT_STEP_SIMULATION;
      if (phase === PHASES.SERVE_FLIGHT || phase === PHASES.OPPONENT_FLIGHT || phase === PHASES.RETURN_FLIGHT) {
        const before = ball;
        const next = scaleAdapter.advanceSimulationState(ball, dt);
        physicalTimeSec += dt / TIME_DILATION;
        if ((phase === PHASES.OPPONENT_FLIGHT || phase === PHASES.RETURN_FLIGHT) &&
            ((before.position.z < 0 && next.position.z >= 0) ||
              (before.position.z > 0 && next.position.z <= 0))) {
          addEvent(phase === PHASES.OPPONENT_FLIGHT ? "serve-net-crossing" : "return-net-crossing", {
            point: clonePoint(next.position),
          });
        }
        if (crossesDownwardTable(before, next)) {
          ball = interpolateToTable(before, next);
          const expectedSide = phase === PHASES.SERVE_FLIGHT || phase === PHASES.RETURN_FLIGHT
            ? "server"
            : "receiver";
          const label = phase === PHASES.SERVE_FLIGHT
            ? "serve-first-bounce"
            : phase === PHASES.OPPONENT_FLIGHT
              ? "serve-second-bounce"
              : "return-to-server-table";
          contactTable(expectedSide, label);
          if (!failure) {
            addTrace();
            transitionAfterTable();
            if (phase === PHASES.RECEIVER_APPROACH) addEvent("receiver-can-return", {point: clonePoint(ball.position)});
          }
        } else {
          ball = next;
          addTrace();
        }
        return snapshot();
      }
      if (phase === PHASES.RECEIVER_APPROACH) {
        ball = scaleAdapter.advanceSimulationState(ball, dt);
        physicalTimeSec += dt / TIME_DILATION;
        receiverElapsedSimulation += dt;
        if (receiverElapsedSimulation >= RACKET_DELAY_SIMULATION) {
          contactRacket();
          if (!failure) {
            phase = PHASES.RETURN_FLIGHT;
            addEvent("return-start", {point: clonePoint(ball.position), omega: vector(ball.omega)});
          }
        }
        addTrace();
        return snapshot();
      }
      fail("unknown-phase", phase);
      return snapshot();
    }

    function snapshot() {
      const tableContacts = contacts.filter((contact) => contact.kind === "table");
      const racketContacts = contacts.filter((contact) => contact.kind === "racket");
      const checks = {
        firstBounceServerSide: Boolean(tableContacts[0] && tableContacts[0].side === "server"),
        secondBounceReceiverSide: Boolean(tableContacts[1] && tableContacts[1].side === "receiver"),
        racketAfterSecondBounce: Boolean(racketContacts[0] && tableContacts.length >= 2),
        returnLandsServerSide: Boolean(tableContacts[2] && tableContacts[2].side === "server"),
        allContactsInTable: contacts.filter((contact) => contact.kind === "table").every((contact) => inTable(contact.point)),
      };
      const semanticPass = Object.values(checks).every(Boolean) && !failure && phase === PHASES.COMPLETE;
      return {
        key,
        label: scenario.label,
        phase,
        status: semanticPass ? "pass" : failure ? "fail" : "running",
        physicalTimeSec,
        ball: cloneBall(ball),
        lastContact,
        contacts: contacts.map((contact) => ({
          kind: contact.kind,
          label: contact.label,
          side: contact.side,
          point: clonePoint(contact.point),
          omega: vector(contact.omega),
          diagnostics: contact.diagnostics,
        })),
        events: events.map((event) => ({...event, point: event.point ? clonePoint(event.point) : undefined})),
        trace: trace.map((sample) => ({time: sample.time, phase: sample.phase, ball: cloneBall(sample.ball)})),
        checks,
        failure,
        metadata: {
          coordinateContract: "world-space z<0 server half; z>0 receiver half",
          firstBounceMeaning: "actual table contact before net crossing",
          secondBounceMeaning: "actual receiver-side table contact before racket contact",
          returnMeaning: "actual server-side table contact after receiver racket contact",
          returnRacketAdapter: "isolated receiver-facing plane; not material calibration",
          timeDilation: TIME_DILATION,
        },
      };
    }

    return Object.freeze({
      PHASES,
      SCENARIOS,
      preset,
      step,
      snapshot,
    });
  }

  return Object.freeze({
    TIME_DILATION,
    TABLE,
    PHASES,
    SCENARIOS,
    createPreset,
    createSimulator,
  });
}));
