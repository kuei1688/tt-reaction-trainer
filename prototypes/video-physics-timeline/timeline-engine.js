(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.VideoPhysicsTimeline = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const STATES = Object.freeze({
    IDLE: "IDLE",
    SERVE_VIDEO: "SERVE_VIDEO",
    PHYSICS_SERVE: "PHYSICS_SERVE",
    AWAIT_PLAYER_HIT: "AWAIT_PLAYER_HIT",
    OPPONENT_SEQUENCE: "OPPONENT_SEQUENCE",
    COMPLETE: "COMPLETE",
    ERROR: "ERROR"
  });

  const SUBSTATES = Object.freeze({
    PREP: "PREP",
    COUNTER_DELAY: "COUNTER_DELAY",
    COUNTER_RETURN: "COUNTER_RETURN"
  });

  const DIRECTIONS = Object.freeze(["left", "center", "right"]);
  const REQUIRED_EVENTS = Object.freeze([
    "START", "VIDEO_TRIGGER_REACHED", "BALL_ENTERED_HIT_WINDOW", "PLAYER_HIT",
    "PREP_FINISHED", "COUNTER_DELAY_FINISHED", "COUNTER_CONTACT",
    "RALLY_COMPLETE", "RESET", "CONFIG_ERROR"
  ]);

  function isFiniteNonNegative(value) {
    return Number.isFinite(value) && value >= 0;
  }

  function assertObject(value, path) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`${path} 必須是物件`);
    }
  }

  function assertTime(value, path) {
    if (!isFiniteNonNegative(value)) throw new Error(`${path} 必須是有限且不小於零的數字`);
  }

  function assertPrototypeAssetPath(value, path) {
    if (typeof value !== "string" || !value.startsWith("./assets/") || value.includes("..")) {
      throw new Error(`${path} 必須指向 ./assets/ 下的原型素材`);
    }
    const normalized = value.toLowerCase().replaceAll("\\", "/");
    if (normalized.includes("videos.json") || normalized.includes("images/") || normalized.endsWith(".html")) {
      throw new Error(`${path} 不得引用正式素材或頁面`);
    }
  }

  function validateVector(vector, path) {
    assertObject(vector, path);
    for (const axis of ["x", "y", "z"]) {
      if (!Number.isFinite(vector[axis])) throw new Error(`${path}.${axis} 必須是有限數字`);
    }
  }

  function validateConfig(config) {
    assertObject(config, "config");
    if (config.schema_version !== 1) throw new Error("不支援的 schema_version");
    if (!Array.isArray(config.serves) || config.serves.length < 2) {
      throw new Error("serves 至少需要兩筆原型資料");
    }

    const ids = new Set();
    for (const [index, serve] of config.serves.entries()) {
      const base = `serves[${index}]`;
      assertObject(serve, base);
      if (typeof serve.id !== "string" || !serve.id.trim()) throw new Error(`${base}.id 必須是非空字串`);
      if (ids.has(serve.id)) throw new Error(`serve id 重複：${serve.id}`);
      ids.add(serve.id);

      assertObject(serve.video, `${base}.video`);
      assertPrototypeAssetPath(serve.video.src, `${base}.video.src`);
      if (!["pending_generation", "ready"].includes(serve.video.generation_status)) {
        throw new Error(`${base}.video.generation_status 無效`);
      }
      assertTime(serve.video.expected_duration_sec, `${base}.video.expected_duration_sec`);
      assertTime(serve.video.physics_trigger_time_sec, `${base}.video.physics_trigger_time_sec`);
      if (serve.video.physics_trigger_time_sec >= serve.video.expected_duration_sec) {
        throw new Error(`${base}.video.physics_trigger_time_sec 必須小於 expected_duration_sec`);
      }
      if (serve.video.generation_status === "pending_generation") {
        assertObject(serve.video.procedural_fallback, `${base}.video.procedural_fallback`);
        assertObject(serve.video.procedural_fallback.start_uv, `${base}.video.procedural_fallback.start_uv`);
        for (const axis of ["x", "y"]) {
          const value = serve.video.procedural_fallback.start_uv[axis];
          if (!Number.isFinite(value) || value < 0 || value > 1) {
            throw new Error(`${base}.video.procedural_fallback.start_uv.${axis} 必須介於 0 與 1`);
          }
        }
      }

      assertObject(serve.video.handoff, `${base}.video.handoff`);
      if (serve.video.handoff.mode !== "crossfade") throw new Error(`${base}.video.handoff.mode 目前只支援 crossfade`);
      assertTime(serve.video.handoff.duration_sec, `${base}.video.handoff.duration_sec`);
      const anchor = serve.video.handoff.video_anchor_uv;
      assertObject(anchor, `${base}.video.handoff.video_anchor_uv`);
      for (const axis of ["x", "y"]) {
        if (!Number.isFinite(anchor[axis]) || anchor[axis] < 0 || anchor[axis] > 1) {
          throw new Error(`${base}.video.handoff.video_anchor_uv.${axis} 必須介於 0 與 1`);
        }
      }

      assertObject(serve.physics, `${base}.physics`);
      const ball = serve.physics.initial_ball_state;
      assertObject(ball, `${base}.physics.initial_ball_state`);
      validateVector(ball.position_m, `${base}.physics.initial_ball_state.position_m`);
      validateVector(ball.velocity_mps, `${base}.physics.initial_ball_state.velocity_mps`);
      validateVector(ball.spin_rps, `${base}.physics.initial_ball_state.spin_rps`);

      assertObject(serve.opponent_responses, `${base}.opponent_responses`);
      for (const direction of DIRECTIONS) {
        const response = serve.opponent_responses[direction];
        assertObject(response, `${base}.opponent_responses.${direction}`);
        assertPrototypeAssetPath(response.prep_asset_src, `${base}.opponent_responses.${direction}.prep_asset_src`);
        assertPrototypeAssetPath(response.counter_asset_src, `${base}.opponent_responses.${direction}.counter_asset_src`);
        assertTime(response.prep_duration_sec, `${base}.opponent_responses.${direction}.prep_duration_sec`);
        assertTime(response.counter_delay_sec, `${base}.opponent_responses.${direction}.counter_delay_sec`);
        if (typeof response.return_ball_profile !== "string" || !response.return_ball_profile) {
          throw new Error(`${base}.opponent_responses.${direction}.return_ball_profile 必須是非空字串`);
        }
      }
    }
    return config;
  }

  class TimelineEngine {
    constructor(config, options) {
      this.options = options || {};
      this.eventSequence = 0;
      this.sessionId = 0;
      this.eventLog = [];
      this.state = STATES.IDLE;
      this.substate = null;
      this.serve = null;
      this.direction = null;
      this.response = null;
      this.phaseStartedAtMs = 0;
      try {
        this.config = validateConfig(config);
      } catch (error) {
        this.config = null;
        this.state = STATES.ERROR;
        this.error = error;
        this._record("CONFIG_ERROR", 0, { message: error.message });
      }
    }

    _record(type, nowMs, detail) {
      const event = Object.freeze({
        id: `${this.sessionId}-${++this.eventSequence}`,
        sessionId: this.sessionId,
        type,
        nowMs,
        state: this.state,
        substate: this.substate,
        detail: detail || null
      });
      this.eventLog.push(event);
      if (typeof this.options.onEvent === "function") this.options.onEvent(event, this.getSnapshot(nowMs));
      return event;
    }

    _effect(type, detail) {
      if (typeof this.options.onEffect === "function") {
        this.options.onEffect(Object.freeze({ type, sessionId: this.sessionId, detail: detail || null }));
      }
    }

    _validSession(sessionId) {
      return sessionId === undefined || sessionId === this.sessionId;
    }

    start(serveId, direction, nowMs) {
      const time = Number.isFinite(nowMs) ? nowMs : 0;
      if (!this.config || this.state === STATES.ERROR) return false;
      if (!DIRECTIONS.includes(direction)) return false;
      const serve = this.config.serves.find((item) => item.id === serveId);
      if (!serve) return false;

      this.sessionId += 1;
      this.eventSequence = 0;
      this.eventLog = [];
      this.serve = serve;
      this.direction = direction;
      this.response = serve.opponent_responses[direction];
      this.state = STATES.SERVE_VIDEO;
      this.substate = null;
      this.phaseStartedAtMs = time;
      this._record("START", time, { serveId, direction });
      this._effect("START_MEDIA", { serve });
      return true;
    }

    reset(nowMs) {
      const time = Number.isFinite(nowMs) ? nowMs : 0;
      this.sessionId += 1;
      this.eventSequence = 0;
      this.eventLog = [];
      this.state = this.config ? STATES.IDLE : STATES.ERROR;
      this.substate = null;
      this.serve = null;
      this.direction = null;
      this.response = null;
      this.phaseStartedAtMs = time;
      this._record("RESET", time);
      this._effect("RESET_ADAPTERS");
      return true;
    }

    tick(mediaTimeSec, nowMs) {
      const time = Number.isFinite(nowMs) ? nowMs : 0;
      if (this.state === STATES.SERVE_VIDEO && Number.isFinite(mediaTimeSec) &&
          mediaTimeSec >= this.serve.video.physics_trigger_time_sec) {
        this.state = STATES.PHYSICS_SERVE;
        this.phaseStartedAtMs = time;
        this._record("VIDEO_TRIGGER_REACHED", time, { mediaTimeSec });
        this._effect("START_PHYSICS_SERVE", {
          handoff: this.serve.video.handoff,
          initialBallState: this.serve.physics.initial_ball_state
        });
      }

      if (this.state === STATES.OPPONENT_SEQUENCE && this.substate === SUBSTATES.PREP) {
        if (time - this.phaseStartedAtMs >= this.response.prep_duration_sec * 1000) {
          this.substate = SUBSTATES.COUNTER_DELAY;
          this.phaseStartedAtMs += this.response.prep_duration_sec * 1000;
          this._record("PREP_FINISHED", time);
        }
      }

      if (this.state === STATES.OPPONENT_SEQUENCE && this.substate === SUBSTATES.COUNTER_DELAY) {
        if (time - this.phaseStartedAtMs >= this.response.counter_delay_sec * 1000) {
          this._record("COUNTER_DELAY_FINISHED", time);
          this.substate = SUBSTATES.COUNTER_RETURN;
          this.phaseStartedAtMs += this.response.counter_delay_sec * 1000;
          this._record("COUNTER_CONTACT", time, { returnBallProfile: this.response.return_ball_profile });
          this._effect("OPPONENT_COUNTER", { response: this.response });
        }
      }
      return this.getSnapshot(time);
    }

    dispatch(type, payload) {
      const data = payload || {};
      const nowMs = Number.isFinite(data.nowMs) ? data.nowMs : 0;
      if (!this._validSession(data.sessionId)) return false;

      if (type === "BALL_ENTERED_HIT_WINDOW" && this.state === STATES.PHYSICS_SERVE) {
        this.state = STATES.AWAIT_PLAYER_HIT;
        this.phaseStartedAtMs = nowMs;
        this._record(type, nowMs);
        return true;
      }
      if (type === "PLAYER_HIT" && this.state === STATES.AWAIT_PLAYER_HIT) {
        this.state = STATES.OPPONENT_SEQUENCE;
        this.substate = SUBSTATES.PREP;
        this.phaseStartedAtMs = nowMs;
        this._record(type, nowMs, { direction: this.direction });
        this._effect("PLAYER_RETURN", { response: this.response });
        this._effect("OPPONENT_PREP", { response: this.response });
        return true;
      }
      if (type === "RALLY_COMPLETE" && this.state === STATES.OPPONENT_SEQUENCE &&
          this.substate === SUBSTATES.COUNTER_RETURN) {
        this.state = STATES.COMPLETE;
        this.substate = null;
        this.phaseStartedAtMs = nowMs;
        this._record(type, nowMs);
        return true;
      }
      return false;
    }

    getSnapshot(nowMs) {
      const time = Number.isFinite(nowMs) ? nowMs : 0;
      const timedState = [
        STATES.SERVE_VIDEO,
        STATES.PHYSICS_SERVE,
        STATES.AWAIT_PLAYER_HIT,
        STATES.OPPONENT_SEQUENCE
      ].includes(this.state);
      return Object.freeze({
        state: this.state,
        substate: this.substate,
        sessionId: this.sessionId,
        serveId: this.serve ? this.serve.id : null,
        direction: this.direction,
        phaseElapsedSec: timedState ? Math.max(0, (time - this.phaseStartedAtMs) / 1000) : 0,
        eventCount: this.eventLog.length,
        error: this.error ? this.error.message : null
      });
    }
  }

  return Object.freeze({ STATES, SUBSTATES, DIRECTIONS, REQUIRED_EVENTS, TimelineEngine, validateConfig });
});
