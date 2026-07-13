"use strict";

const assert = require("node:assert/strict");
const { STATES, Experiment } = require("./direction-c-engine.js");
let passed = 0;

function test(name, fn) {
  fn();
  passed += 1;
  console.log(`ok ${passed} - ${name}`);
}

test("C1 preserves the follow-through, then starts exactly one training ball", () => {
  const experiment = new Experiment(4.3, 4.583333);
  experiment.start("C1", 0);
  assert.equal(experiment.tick(4.299, 4299).showTrainingBall, false);
  const snapshot = experiment.tick(4.3, 4300);
  assert.equal(snapshot.state, STATES.FOLLOW_THROUGH);
  assert.equal(snapshot.showVideo, true);
  assert.equal(snapshot.showTrainingBall, false);
  const training = experiment.tick(4.583333, 4583);
  assert.equal(training.state, STATES.TRAINING);
  assert.equal(training.showVideo, false);
  assert.equal(training.showTrainingBall, true);
  assert.equal(experiment.events.filter((event) => event.type === "TRAINING_BALL_STARTED").length, 1);
});

test("C2 keeps the video through follow-through and only adds its explicit 100 ms exit afterwards", () => {
  const experiment = new Experiment(4.3, 4.583333);
  experiment.start("C2", 0);
  assert.equal(experiment.tick(4.3, 4300).state, STATES.FOLLOW_THROUGH);
  assert.equal(experiment.tick(4.5, 4500).showTrainingBall, false);
  assert.equal(experiment.tick(4.583333, 4583).state, STATES.EXITING);
  assert.equal(experiment.tick(4.583333, 4682).showTrainingBall, false);
  const snapshot = experiment.tick(4.583333, 4683);
  assert.equal(snapshot.state, STATES.TRAINING);
  assert.equal(snapshot.showVideo, false);
  assert.equal(snapshot.showTrainingBall, true);
});

test("C3 deliberately overlaps a fading video and training ball for visual-interference review", () => {
  const experiment = new Experiment(4.3, 4.583333);
  experiment.start("C3", 0);
  const overlap = experiment.tick(4.3, 4300);
  assert.equal(overlap.state, STATES.OVERLAP);
  assert.equal(overlap.showVideo, true);
  assert.equal(overlap.showTrainingBall, true);
  const training = experiment.tick(4.583333, 4583);
  assert.equal(training.state, STATES.TRAINING);
  assert.equal(training.showVideo, false);
  assert.equal(training.showTrainingBall, true);
  assert.equal(experiment.events.filter((event) => event.type === "TRAINING_BALL_STARTED").length, 1);
});

test("C1 and C2 never show the training ball while the observation video is visible", () => {
  for (const candidate of ["C1", "C2"]) {
    const experiment = new Experiment(4.3, 4.583333);
    experiment.start(candidate, 0);
    for (const [mediaTime, nowMs] of [[0, 0], [4.2, 4200], [4.3, 4300], [4.5, 4500], [4.583333, 4583], [4.583333, 4683]]) {
      const snapshot = experiment.tick(mediaTime, nowMs);
      assert.equal(snapshot.showVideo && snapshot.showTrainingBall, false);
    }
  }
});

test("reset clears the candidate and all visible balls", () => {
  const experiment = new Experiment(4.3, 4.583333);
  experiment.start("C1", 0);
  experiment.tick(4.3, 4300);
  const snapshot = experiment.reset(5000);
  assert.equal(snapshot.state, STATES.IDLE);
  assert.equal(snapshot.candidateId, null);
  assert.equal(snapshot.showVideo, false);
  assert.equal(snapshot.showTrainingBall, false);
});

console.log(`# ${passed} tests passed`);
