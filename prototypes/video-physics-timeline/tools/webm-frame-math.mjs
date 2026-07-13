// Browser-compatible frame math. This module is the single source of truth for
// the procedural ball path used by both the WebM generator and its previewer.
export function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
export function mix(a, b, t) { return a + (b - a) * t; }
export function easeOutCubic(t) { return 1 - Math.pow(1 - clamp(t, 0, 1), 3); }

export function getFramePlan(serve, settings) {
  if (!serve?.video?.procedural_fallback?.start_uv || !serve.video.handoff?.video_anchor_uv) {
    throw new Error(`${serve?.id || "serve"} 缺少程序化軌跡或 handoff anchor`);
  }
  const durationFramesFloat = serve.video.expected_duration_sec * settings.fps;
  const triggerFrameFloat = serve.video.physics_trigger_time_sec * settings.fps;
  if (Math.abs(durationFramesFloat - Math.round(durationFramesFloat)) > 1e-9) {
    throw new Error(`${serve.id} duration 無法精確對齊 ${settings.fps} fps`);
  }
  if (Math.abs(triggerFrameFloat - Math.round(triggerFrameFloat)) > 1e-9) {
    throw new Error(`${serve.id} trigger 無法精確對齊 ${settings.fps} fps`);
  }
  const frameCount = Math.round(durationFramesFloat);
  const triggerFrame = Math.round(triggerFrameFloat);
  if (triggerFrame < 0 || triggerFrame >= frameCount) throw new Error(`${serve.id} trigger frame 超出影片範圍`);
  return Object.freeze({
    frameCount,
    triggerFrame,
    handoffEndFrame: Math.ceil((serve.video.physics_trigger_time_sec + serve.video.handoff.duration_sec) * settings.fps),
    anchorPx: Object.freeze({
      x: serve.video.handoff.video_anchor_uv.x * settings.width,
      y: serve.video.handoff.video_anchor_uv.y * settings.height
    })
  });
}

export function getBallPose(serve, settings, frameIndex) {
  const timeSec = frameIndex / settings.fps;
  const triggerSec = serve.video.physics_trigger_time_sec;
  const start = serve.video.procedural_fallback.start_uv;
  const anchor = serve.video.handoff.video_anchor_uv;
  const progress = easeOutCubic(triggerSec === 0 ? 1 : timeSec / triggerSec);
  const xUv = mix(start.x, anchor.x, progress);
  const yUv = mix(start.y, anchor.y, progress) - Math.sin(progress * Math.PI) * 0.12;
  const alpha = timeSec <= triggerSec
    ? 1
    : 1 - clamp((timeSec - triggerSec) / serve.video.handoff.duration_sec, 0, 1);
  return Object.freeze({ x: xUv * settings.width, y: yUv * settings.height, alpha, timeSec });
}

export function formatTimecode(timeSec, frameIndex) {
  const totalMs = Math.round(timeSec * 1000);
  const minutes = Math.floor(totalMs / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const milliseconds = totalMs % 1000;
  return `T${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")} F${String(frameIndex).padStart(4, "0")}`;
}
