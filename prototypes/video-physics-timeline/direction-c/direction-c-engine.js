(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DirectionCExperiment = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const STATES = Object.freeze({
    IDLE: "IDLE",
    OBSERVING: "OBSERVING",
    FOLLOW_THROUGH: "FOLLOW_THROUGH",
    OVERLAP: "OVERLAP",
    EXITING: "EXITING",
    TRAINING: "TRAINING",
    COMPLETE: "COMPLETE"
  });

  const CANDIDATES = Object.freeze({
    C1: Object.freeze({ id: "C1", exitDurationMs: 0, overlapFade: false }),
    C2: Object.freeze({ id: "C2", exitDurationMs: 100, overlapFade: false }),
    C3: Object.freeze({ id: "C3", exitDurationMs: 0, overlapFade: true })
  });

  class Experiment {
    constructor(triggerTimeSec, observationEndTimeSec, options) {
      if (!Number.isFinite(triggerTimeSec) || triggerTimeSec < 0 ||
          !Number.isFinite(observationEndTimeSec) || observationEndTimeSec <= triggerTimeSec) {
        throw new Error("observation times must be ordered non-negative numbers");
      }
      const settings = options || {};
      this.triggerTimeSec = triggerTimeSec;
      this.observationEndTimeSec = observationEndTimeSec;
      this.trainingDurationMs = Number.isFinite(settings.trainingDurationMs) ? settings.trainingDurationMs : 1300;
      this.reset(0);
    }

    reset(nowMs) {
      this.state = STATES.IDLE;
      this.candidate = null;
      this.exitStartedAtMs = null;
      this.trainingStartedAtMs = null;
      this.events = [];
      this.nowMs = Number.isFinite(nowMs) ? nowMs : 0;
      return this.snapshot(this.nowMs);
    }

    start(candidateId, nowMs) {
      const candidate = CANDIDATES[candidateId];
      if (!candidate) throw new Error("candidate must be C1, C2, or C3");
      this.candidate = candidate;
      this.state = STATES.OBSERVING;
      this.nowMs = Number.isFinite(nowMs) ? nowMs : 0;
      this.exitStartedAtMs = null;
      this.trainingStartedAtMs = null;
      this.events = [{ type: "OBSERVATION_STARTED", nowMs: this.nowMs }];
      return this.snapshot(this.nowMs);
    }

    _startTraining(nowMs, state) {
      this.state = state || STATES.TRAINING;
      this.trainingStartedAtMs = nowMs;
      this.events.push({ type: "TRAINING_BALL_STARTED", nowMs });
    }

    tick(mediaTimeSec, nowMs) {
      this.nowMs = Number.isFinite(nowMs) ? nowMs : this.nowMs;
      if (this.state === STATES.OBSERVING && Number.isFinite(mediaTimeSec) && mediaTimeSec >= this.triggerTimeSec) {
        this.events.push({ type: "CONTACT_REACHED", nowMs: this.nowMs, mediaTimeSec });
        if (this.candidate.overlapFade) {
          this._startTraining(this.nowMs, STATES.OVERLAP);
          this.events.push({ type: "OVERLAP_FADE_STARTED", nowMs: this.nowMs });
        } else {
          this.state = STATES.FOLLOW_THROUGH;
          this.events.push({ type: "FOLLOW_THROUGH_STARTED", nowMs: this.nowMs });
        }
      }
      if (this.state === STATES.FOLLOW_THROUGH && Number.isFinite(mediaTimeSec) && mediaTimeSec >= this.observationEndTimeSec) {
        this.events.push({ type: "FOLLOW_THROUGH_FINISHED", nowMs: this.nowMs, mediaTimeSec });
        if (this.candidate.exitDurationMs === 0) this._startTraining(this.nowMs);
        else {
          this.state = STATES.EXITING;
          this.exitStartedAtMs = this.nowMs;
          this.events.push({ type: "VIDEO_EXIT_STARTED", nowMs: this.nowMs });
        }
      }
      if (this.state === STATES.EXITING && this.nowMs - this.exitStartedAtMs >= this.candidate.exitDurationMs) {
        this._startTraining(this.exitStartedAtMs + this.candidate.exitDurationMs);
      }
      if (this.state === STATES.OVERLAP && Number.isFinite(mediaTimeSec) && mediaTimeSec >= this.observationEndTimeSec) {
        this.state = STATES.TRAINING;
        this.events.push({ type: "OVERLAP_FADE_FINISHED", nowMs: this.nowMs, mediaTimeSec });
      }
      if (this.state === STATES.TRAINING && this.nowMs - this.trainingStartedAtMs >= this.trainingDurationMs) {
        this.state = STATES.COMPLETE;
        this.events.push({ type: "TRAINING_BALL_FINISHED", nowMs: this.nowMs });
      }
      return this.snapshot(this.nowMs);
    }

    snapshot(nowMs) {
      const time = Number.isFinite(nowMs) ? nowMs : this.nowMs;
      const trainingElapsedMs = this.trainingStartedAtMs === null ? 0 : Math.max(0, time - this.trainingStartedAtMs);
      return Object.freeze({
        state: this.state,
        candidateId: this.candidate ? this.candidate.id : null,
        showVideo: this.state === STATES.OBSERVING || this.state === STATES.FOLLOW_THROUGH || this.state === STATES.OVERLAP || this.state === STATES.EXITING,
        showTrainingBall: this.state === STATES.OVERLAP || this.state === STATES.TRAINING,
        trainingElapsedMs,
        eventCount: this.events.length
      });
    }
  }

  return Object.freeze({ STATES, CANDIDATES, Experiment });
});
