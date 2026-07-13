import assert from "node:assert/strict";
import { resolve } from "node:path";
import {
  PROTOTYPE_DIR,
  contentHashes,
  createStaticFrame,
  findColorCentroid,
  formatTimecode,
  getBallPose,
  getFramePlan,
  loadProject,
  outputPathForServe,
  renderFrame,
  sha256,
  validateRenderSettings
} from "./webm-core.mjs";

let passed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`ok ${passed} - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

const { config, settings } = await loadProject();

await test("render settings 合法且固定為 VP9 / yuv420p", () => {
  assert.equal(validateRenderSettings(settings), settings);
  assert.equal(settings.codec, "libvpx-vp9");
  assert.equal(settings.pixel_format, "yuv420p");
});

await test("短版與長版 duration、trigger 精確對齊 60 fps", () => {
  const shortPlan = getFramePlan(config.serves[0], settings);
  const longPlan = getFramePlan(config.serves[1], settings);
  assert.deepEqual([shortPlan.frameCount, shortPlan.triggerFrame], [120, 75]);
  assert.deepEqual([longPlan.frameCount, longPlan.triggerFrame], [192, 126]);
});

await test("trigger frame 的 raw RGB 球質心誤差不超過 1 px", () => {
  const background = createStaticFrame(settings);
  for (const serve of config.serves) {
    const plan = getFramePlan(serve, settings);
    const frame = renderFrame(serve, settings, plan.triggerFrame, background);
    const centroid = findColorCentroid(frame, settings, plan.anchorPx, { threshold: 0 });
    assert.ok(centroid.count > 20);
    assert.ok(centroid.errorPx <= 1, `${serve.id}: ${centroid.errorPx}`);
  }
});

await test("handoff 結束後 raw RGB frame 不再含有影片球點", () => {
  const background = createStaticFrame(settings);
  for (const serve of config.serves) {
    const plan = getFramePlan(serve, settings);
    if (plan.handoffEndFrame >= plan.frameCount) continue;
    const frame = renderFrame(serve, settings, plan.handoffEndFrame, background);
    const centroid = findColorCentroid(frame, settings, plan.anchorPx, { threshold: 0 });
    assert.equal(centroid.count, 0);
  }
});

await test("Node bitmap 時間碼格式固定且包含 frame index", () => {
  assert.equal(formatTimecode(1.25, 75), "T00:01.250 F0075");
  assert.equal(formatTimecode(62.005, 3720), "T01:02.005 F3720");
});

await test("相同輸入 frame 的 RGB bytes 完全相同", () => {
  const serve = config.serves[0];
  const background = createStaticFrame(settings);
  const first = renderFrame(serve, settings, 42, background);
  const second = renderFrame(serve, settings, 42, background);
  assert.equal(sha256(first), sha256(second));
});

await test("不同 frame 的時間碼或軌跡會改變內容 hash", () => {
  const serve = config.serves[0];
  const background = createStaticFrame(settings);
  assert.notEqual(sha256(renderFrame(serve, settings, 41, background)), sha256(renderFrame(serve, settings, 42, background)));
});

await test("trigger 無法對齊 frame 時會明確失敗", () => {
  const invalid = structuredClone(config.serves[0]);
  invalid.video.physics_trigger_time_sec = 1.251;
  assert.throws(() => getFramePlan(invalid, settings), /無法精確對齊/);
});

await test("球在 trigger frame 精確回到設定 anchor", () => {
  for (const serve of config.serves) {
    const plan = getFramePlan(serve, settings);
    const pose = getBallPose(serve, settings, plan.triggerFrame);
    assert.ok(Math.abs(pose.x - plan.anchorPx.x) < 1e-9);
    assert.ok(Math.abs(pose.y - plan.anchorPx.y) < 1e-9);
    assert.equal(pose.alpha, 1);
  }
});

await test("輸出路徑只落在原型 assets 目錄", () => {
  for (const serve of config.serves) {
    assert.ok(outputPathForServe(serve).startsWith(resolve(PROTOTYPE_DIR, "assets")));
  }
});

await test("physics-only 調整不會改變 WebM render input hash", async () => {
  const configText = JSON.stringify(config);
  const changed = structuredClone(config);
  changed.serves[0].physics.gravity_mps2 = -9.81;
  const settingsText = JSON.stringify(settings);
  assert.equal(
    contentHashes(configText, settingsText).render_inputs_sha256,
    contentHashes(JSON.stringify(changed), settingsText).render_inputs_sha256
  );
});

console.log(`# ${passed} tests passed`);
