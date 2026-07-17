const assert = require("node:assert/strict");
const fs = require("node:fs");

const html = fs.readFileSync("serve-generator.html", "utf8");
const videos = JSON.parse(fs.readFileSync("videos.json", "utf8"));
const presets = JSON.parse(fs.readFileSync("physics-presets.json", "utf8")).serves;

assert.ok(!html.includes("const isLeftCurving = rule.sidespin > 0"),
  "the generator must not infer curve direction by mirroring from the spin sign");
assert.ok(!html.includes("start.x = -start.x"),
  "the generator must not mirror the position template from the spin sign");
assert.ok(html.includes('curveDirection: "right"'),
  "left-spin rules must declare their rightward curve explicitly");
assert.ok(html.includes('curveDirection: "left"'),
  "right-spin rules must declare their leftward curve explicitly");

const expected = {
  contact_sidebackspin_left: { sideName: "left", curveDirection: "right", sign: -1 },
  contact_sidebackspin_right: { sideName: "right", curveDirection: "left", sign: 1 },
  contact_sidespin_left: { sideName: "left", curveDirection: "right", sign: -1 },
  contact_sidespin_right: { sideName: "right", curveDirection: "left", sign: 1 }
};

const approvedVideos = videos.filter(video =>
  video.kind === "video" && video.reviewStatus === "approved"
);
assert.equal(presets.length, approvedVideos.length,
  "replace-mode output must contain one preset per approved video");

const byVideoId = new Map();
for (const preset of presets) {
  const videoId = preset.tags && preset.tags.videoId;
  assert.ok(videoId, `preset ${preset.id} is missing tags.videoId`);
  assert.equal(byVideoId.has(videoId), false, `duplicate preset for ${videoId}`);
  byVideoId.set(videoId, preset);
  assert.equal(preset.label.startsWith("undefined"), false,
    `preset ${preset.id} has an undefined label`);
}

for (const video of approvedVideos) {
  const preset = byVideoId.get(video.id);
  assert.ok(preset, `missing generated preset for ${video.id}`);
  const rule = expected[video.spinType];
  if (rule) {
    assert.equal(preset.tags.sideName, rule.sideName, `${video.id}: side name`);
    assert.equal(preset.tags.curveDirection, rule.curveDirection, `${video.id}: curve direction`);
    assert.equal(Math.sign(preset.variation.spin.sidespin), rule.sign, `${video.id}: spin sign`);
    const expectedMagnitude = preset.tags.length === "short" ? 150.8 : 125.66;
    assert.equal(Math.abs(preset.variation.spin.sidespin), expectedMagnitude,
      `${video.id}: sidespin magnitude`);
    assert.ok(preset.variation.spin3d, `${video.id}: missing canonical spin3d`);
    assert.equal(preset.variation.spin3d.schema, 2, `${video.id}: spin3d schema`);
    assert.equal(preset.variation.spin3d.omega.y, rule.sideName === "left" ? expectedMagnitude : -expectedMagnitude,
      `${video.id}: canonical omega.y sign`);
    assert.equal(preset.variation.spin3d.omega.z, 0, `${video.id}: axial world omega.z must be explicit`);
    assert.equal(Object.prototype.hasOwnProperty.call(preset.variation.spin3d, "axialSpin"), false,
      `${video.id}: physical spin must not retain axialSpin`);
  } else {
    assert.equal(preset.tags.sideName, null, `${video.id}: non-side spin sideName`);
    assert.equal(preset.tags.curveDirection, "none", `${video.id}: non-side spin curve`);
    assert.ok(preset.variation.spin3d, `${video.id}: missing canonical spin3d`);
    assert.equal(preset.variation.spin3d.omega.y, 0, `${video.id}: non-side omega.y`);
    assert.equal(Object.prototype.hasOwnProperty.call(preset.variation.spin3d, "axialSpin"), false,
      `${video.id}: non-side physical spin must not retain axialSpin`);
  }

  if (preset.tags.length === "long" && preset.tags.placement === "backhand") {
    assert.deepEqual(preset.start, {x: 0.32, y: 0.95, z: -1.52}, `${video.id}: safe long start template`);
    assert.deepEqual(preset.firstBounce, {x: 0.36, y: 0.78, z: -0.89}, `${video.id}: safe long first-bounce template`);
    assert.deepEqual(preset.secondBounce, {x: 0.55, y: 0.78, z: 1.17}, `${video.id}: safe long second-bounce template`);
  }
  if (preset.tags.length === "short" && preset.tags.placement === "backhand") {
    assert.equal(preset.firstBounce.z, -0.45, `${video.id}: safe short first-bounce depth`);
  }
}

console.log(`serve-generator contract OK: ${presets.length} approved videos checked`);
