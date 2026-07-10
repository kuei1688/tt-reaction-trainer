import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const TOOLS_DIR = dirname(fileURLToPath(import.meta.url));
export const PROTOTYPE_DIR = resolve(TOOLS_DIR, "..");
export const CONFIG_PATH = resolve(PROTOTYPE_DIR, "timeline-config.json");
export const SETTINGS_PATH = resolve(TOOLS_DIR, "webm-render-settings.json");

const FONT = Object.freeze({
  "0": ["111", "101", "101", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "010", "010", "111"],
  "2": ["111", "001", "001", "111", "100", "100", "111"],
  "3": ["111", "001", "001", "111", "001", "001", "111"],
  "4": ["101", "101", "101", "111", "001", "001", "001"],
  "5": ["111", "100", "100", "111", "001", "001", "111"],
  "6": ["111", "100", "100", "111", "101", "101", "111"],
  "7": ["111", "001", "001", "010", "010", "010", "010"],
  "8": ["111", "101", "101", "111", "101", "101", "111"],
  "9": ["111", "101", "101", "111", "001", "001", "111"],
  "T": ["111", "010", "010", "010", "010", "010", "010"],
  "F": ["111", "100", "100", "110", "100", "100", "100"],
  ":": ["0", "1", "0", "0", "1", "0", "0"],
  ".": ["0", "0", "0", "0", "0", "0", "1"],
  " ": ["0", "0", "0", "0", "0", "0", "0"]
});

function assertFinite(value, name) {
  if (!Number.isFinite(value)) throw new Error(`${name} 必須是有限數字`);
}

function assertRgb(value, name) {
  if (!Array.isArray(value) || value.length !== 3 || value.some((channel) => !Number.isInteger(channel) || channel < 0 || channel > 255)) {
    throw new Error(`${name} 必須是三個 0..255 整數`);
  }
}

export async function loadProject() {
  const [configText, settingsText] = await Promise.all([
    readFile(CONFIG_PATH, "utf8"),
    readFile(SETTINGS_PATH, "utf8")
  ]);
  const config = JSON.parse(configText);
  const settings = JSON.parse(settingsText);
  validateRenderSettings(settings);
  for (const serve of config.serves || []) getFramePlan(serve, settings);
  return { config, settings, configText, settingsText };
}

export function validateRenderSettings(settings) {
  if (!settings || settings.schema_version !== 1) throw new Error("不支援的 render settings schema_version");
  for (const key of ["width", "height", "fps"]) {
    if (!Number.isInteger(settings[key]) || settings[key] <= 0) throw new Error(`${key} 必須是正整數`);
  }
  if (settings.width % 2 || settings.height % 2) throw new Error("yuv420p 的 width 與 height 必須是偶數");
  if (settings.codec !== "libvpx-vp9" || settings.pixel_format !== "yuv420p") {
    throw new Error("原型產生器固定使用 libvpx-vp9 / yuv420p");
  }
  if (!Number.isInteger(settings.crf) || settings.crf < 0 || settings.crf > 63) throw new Error("crf 必須介於 0 與 63");
  assertRgb(settings.ball?.rgb, "ball.rgb");
  assertRgb(settings.background?.top_rgb, "background.top_rgb");
  assertRgb(settings.background?.horizon_rgb, "background.horizon_rgb");
  assertRgb(settings.background?.table_rgb, "background.table_rgb");
  assertRgb(settings.background?.line_rgb, "background.line_rgb");
  assertRgb(settings.background?.timecode_rgb, "background.timecode_rgb");
  if (!Number.isInteger(settings.ball.radius_px) || settings.ball.radius_px < 2) throw new Error("ball.radius_px 太小");
  if (!Number.isFinite(settings.ball.centroid_threshold) || settings.ball.centroid_threshold <= 0) throw new Error("centroid_threshold 無效");
  return settings;
}

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

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function mix(a, b, t) { return a + (b - a) * t; }
function easeOutCubic(t) { return 1 - Math.pow(1 - clamp(t, 0, 1), 3); }

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

function blendPixel(buffer, width, height, x, y, rgb, alpha = 1) {
  const px = Math.floor(x);
  const py = Math.floor(y);
  if (px < 0 || py < 0 || px >= width || py >= height || alpha <= 0) return;
  const index = (py * width + px) * 3;
  if (alpha >= 1) {
    buffer[index] = rgb[0];
    buffer[index + 1] = rgb[1];
    buffer[index + 2] = rgb[2];
    return;
  }
  buffer[index] = Math.round(buffer[index] * (1 - alpha) + rgb[0] * alpha);
  buffer[index + 1] = Math.round(buffer[index + 1] * (1 - alpha) + rgb[1] * alpha);
  buffer[index + 2] = Math.round(buffer[index + 2] * (1 - alpha) + rgb[2] * alpha);
}

function fillRect(buffer, width, height, x, y, rectWidth, rectHeight, rgb, alpha = 1) {
  const left = Math.max(0, Math.floor(x));
  const top = Math.max(0, Math.floor(y));
  const right = Math.min(width, Math.ceil(x + rectWidth));
  const bottom = Math.min(height, Math.ceil(y + rectHeight));
  for (let py = top; py < bottom; py += 1) {
    for (let px = left; px < right; px += 1) blendPixel(buffer, width, height, px, py, rgb, alpha);
  }
}

function drawCircle(buffer, width, height, centerX, centerY, radius, rgb, alpha = 1) {
  const left = Math.floor(centerX - radius - 1);
  const right = Math.ceil(centerX + radius + 1);
  const top = Math.floor(centerY - radius - 1);
  const bottom = Math.ceil(centerY + radius + 1);
  const radiusSquared = radius * radius;
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      const dx = x + 0.5 - centerX;
      const dy = y + 0.5 - centerY;
      if (dx * dx + dy * dy <= radiusSquared) blendPixel(buffer, width, height, x, y, rgb, alpha);
    }
  }
}

function drawLine(buffer, width, height, x1, y1, x2, y2, thickness, rgb, alpha = 1) {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
  for (let step = 0; step <= steps; step += 1) {
    const t = steps === 0 ? 0 : step / steps;
    drawCircle(buffer, width, height, mix(x1, x2, t), mix(y1, y2, t), thickness / 2, rgb, alpha);
  }
}

export function createStaticFrame(settings) {
  const { width, height } = settings;
  const buffer = Buffer.alloc(width * height * 3);
  const horizon = Math.round(height * 0.55);
  for (let y = 0; y < height; y += 1) {
    let rgb;
    if (y < horizon) {
      const t = y / Math.max(1, horizon - 1);
      rgb = settings.background.top_rgb.map((channel, index) => Math.round(mix(channel, settings.background.horizon_rgb[index], t)));
    } else {
      const t = (y - horizon) / Math.max(1, height - horizon - 1);
      rgb = settings.background.table_rgb.map((channel) => Math.round(channel * (1 - t * 0.36)));
    }
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 3;
      buffer[index] = rgb[0];
      buffer[index + 1] = rgb[1];
      buffer[index + 2] = rgb[2];
    }
  }
  const line = settings.background.line_rgb;
  drawLine(buffer, width, height, width * 0.07, height * 0.55, width * 0.93, height * 0.55, 2, line, 0.68);
  drawLine(buffer, width, height, width * 0.93, height * 0.55, width * 0.76, height * 0.97, 2, line, 0.68);
  drawLine(buffer, width, height, width * 0.76, height * 0.97, width * 0.24, height * 0.97, 2, line, 0.68);
  drawLine(buffer, width, height, width * 0.24, height * 0.97, width * 0.07, height * 0.55, 2, line, 0.68);
  drawLine(buffer, width, height, width * 0.5, height * 0.55, width * 0.5, height * 0.97, 2, line, 0.55);
  fillRect(buffer, width, height, 0, height * 0.515, width, 3, line, 0.2);
  return buffer;
}

export function formatTimecode(timeSec, frameIndex) {
  const totalMs = Math.round(timeSec * 1000);
  const minutes = Math.floor(totalMs / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const milliseconds = totalMs % 1000;
  return `T${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")} F${String(frameIndex).padStart(4, "0")}`;
}

function drawBitmapText(buffer, width, height, text, x, y, scale, rgb) {
  let cursor = x;
  for (const character of text) {
    const glyph = FONT[character];
    if (!glyph) throw new Error(`時間碼包含不支援的字元：${character}`);
    const glyphWidth = glyph[0].length;
    for (let row = 0; row < glyph.length; row += 1) {
      for (let column = 0; column < glyphWidth; column += 1) {
        if (glyph[row][column] === "1") fillRect(buffer, width, height, cursor + column * scale, y + row * scale, scale, scale, rgb);
      }
    }
    cursor += (glyphWidth + 1) * scale;
  }
}

export function renderFrame(serve, settings, frameIndex, staticFrame) {
  const plan = getFramePlan(serve, settings);
  if (!Number.isInteger(frameIndex) || frameIndex < 0 || frameIndex >= plan.frameCount) throw new Error("frameIndex 超出範圍");
  const frame = Buffer.from(staticFrame || createStaticFrame(settings));
  const pose = getBallPose(serve, settings, frameIndex);
  const timecode = formatTimecode(pose.timeSec, frameIndex);
  fillRect(frame, settings.width, settings.height, 12, settings.height - 31, 226, 23, [2, 6, 23], 0.78);
  drawBitmapText(frame, settings.width, settings.height, timecode, 19, settings.height - 26, 2, settings.background.timecode_rgb);
  drawCircle(frame, settings.width, settings.height, pose.x, pose.y, settings.ball.radius_px, settings.ball.rgb, pose.alpha);
  return frame;
}

export function findColorCentroid(rgbFrame, settings, expected, options = {}) {
  const width = settings.width;
  const height = settings.height;
  if (!Buffer.isBuffer(rgbFrame) || rgbFrame.length !== width * height * 3) throw new Error("RGB frame 尺寸不符");
  const target = settings.ball.rgb;
  const threshold = options.threshold ?? settings.ball.centroid_threshold;
  const roiRadius = options.roiRadius ?? settings.ball.centroid_roi_radius_px;
  const thresholdSquared = threshold * threshold;
  const left = Math.max(0, Math.floor(expected.x - roiRadius));
  const right = Math.min(width - 1, Math.ceil(expected.x + roiRadius));
  const top = Math.max(0, Math.floor(expected.y - roiRadius));
  const bottom = Math.min(height - 1, Math.ceil(expected.y + roiRadius));
  let count = 0;
  let sumX = 0;
  let sumY = 0;
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      const index = (y * width + x) * 3;
      const dr = rgbFrame[index] - target[0];
      const dg = rgbFrame[index + 1] - target[1];
      const db = rgbFrame[index + 2] - target[2];
      if (dr * dr + dg * dg + db * db <= thresholdSquared) {
        count += 1;
        sumX += x + 0.5;
        sumY += y + 0.5;
      }
    }
  }
  if (!count) return Object.freeze({ count: 0, x: null, y: null, errorPx: Infinity });
  const x = sumX / count;
  const y = sumY / count;
  return Object.freeze({ count, x, y, errorPx: Math.hypot(x - expected.x, y - expected.y) });
}

export function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

export async function sha256File(path) {
  return sha256(await readFile(path));
}

function runSync(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: options.binary ? null : "utf8",
    maxBuffer: options.maxBuffer || 16 * 1024 * 1024,
    windowsHide: true
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const stderr = Buffer.isBuffer(result.stderr) ? result.stderr.toString("utf8") : result.stderr;
    throw new Error(`${command} 失敗：${String(stderr || "unknown error").trim()}`);
  }
  return result.stdout;
}

export function inspectExecutable(command) {
  try {
    const output = runSync(command, ["-version"]);
    return String(output).split(/\r?\n/, 1)[0].trim();
  } catch (error) {
    if (error.code === "ENOENT") return null;
    return null;
  }
}

export function resolveTooling(env = process.env) {
  const ffmpeg = env.FFMPEG_PATH || "ffmpeg";
  const ffprobe = env.FFPROBE_PATH || "ffprobe";
  return Object.freeze({
    ffmpeg,
    ffprobe,
    ffmpegVersion: inspectExecutable(ffmpeg),
    ffprobeVersion: inspectExecutable(ffprobe)
  });
}

function parseRate(rate) {
  const [numerator, denominator] = String(rate || "0/1").split("/").map(Number);
  return denominator ? numerator / denominator : 0;
}

export function probeWebm(path, tooling) {
  const output = runSync(tooling.ffprobe, [
    "-v", "error", "-count_frames", "-show_streams", "-show_format", "-of", "json", path
  ]);
  return JSON.parse(output);
}

export function decodeFrame(path, frameIndex, settings, tooling) {
  const output = runSync(tooling.ffmpeg, [
    "-v", "error", "-i", path,
    "-vf", `select=eq(n\\,${frameIndex})`,
    "-vsync", "0", "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"
  ], { binary: true, maxBuffer: settings.width * settings.height * 4 + 1024 * 1024 });
  if (output.length !== settings.width * settings.height * 3) throw new Error(`無法解出 frame ${frameIndex}`);
  return output;
}

export function decodedFrameDigest(path, tooling) {
  const output = runSync(tooling.ffmpeg, [
    "-v", "error", "-i", path, "-map", "0:v:0", "-pix_fmt", "rgb24",
    "-f", "framemd5", "-hash", "sha256", "pipe:1"
  ]);
  const hashes = String(output).split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.slice(line.lastIndexOf(",") + 1).trim());
  if (!hashes.length) throw new Error("framemd5 沒有解碼 frame");
  return Object.freeze({ frameCount: hashes.length, sha256: sha256(`${hashes.join("\n")}\n`) });
}

export async function verifyWebm(path, serve, settings, tooling) {
  if (!tooling.ffmpegVersion || !tooling.ffprobeVersion) throw new Error("找不到 FFmpeg／FFprobe；請先執行 --doctor");
  const plan = getFramePlan(serve, settings);
  const probe = probeWebm(path, tooling);
  const videoStreams = probe.streams.filter((stream) => stream.codec_type === "video");
  const audioStreams = probe.streams.filter((stream) => stream.codec_type === "audio");
  if (videoStreams.length !== 1 || audioStreams.length !== 0) throw new Error(`${serve.id} 必須恰有一軌視訊且沒有音訊`);
  const stream = videoStreams[0];
  if (stream.codec_name !== "vp9") throw new Error(`${serve.id} codec 不是 VP9`);
  if (stream.width !== settings.width || stream.height !== settings.height) throw new Error(`${serve.id} 解析度不符`);
  if (stream.pix_fmt !== settings.pixel_format) throw new Error(`${serve.id} pixel format 不符`);
  const actualFps = parseRate(stream.avg_frame_rate);
  if (Math.abs(actualFps - settings.fps) > 1e-6) throw new Error(`${serve.id} fps 不符：${actualFps}`);
  const durationSec = Number(probe.format.duration ?? stream.duration);
  if (!Number.isFinite(durationSec) || Math.abs(durationSec - serve.video.expected_duration_sec) > 1 / settings.fps + 1e-6) {
    throw new Error(`${serve.id} duration 不符：${durationSec}`);
  }
  if (stream.nb_read_frames && Number(stream.nb_read_frames) !== plan.frameCount) throw new Error(`${serve.id} frame count 不符`);

  const triggerFrame = decodeFrame(path, plan.triggerFrame, settings, tooling);
  const centroid = findColorCentroid(triggerFrame, settings, plan.anchorPx);
  if (centroid.count < 20 || centroid.errorPx > 1) {
    throw new Error(`${serve.id} trigger 質心誤差 ${centroid.errorPx.toFixed(3)} px`);
  }
  let postHandoffColorPixels = 0;
  if (plan.handoffEndFrame < plan.frameCount) {
    const postFrame = decodeFrame(path, plan.handoffEndFrame, settings, tooling);
    postHandoffColorPixels = findColorCentroid(postFrame, settings, plan.anchorPx).count;
    if (postHandoffColorPixels > 3) throw new Error(`${serve.id} handoff 後仍偵測到影片球點`);
  }
  const decoded = decodedFrameDigest(path, tooling);
  if (decoded.frameCount !== plan.frameCount) throw new Error(`${serve.id} 解碼 frame 數不符`);
  return Object.freeze({
    serve_id: serve.id,
    path: serve.video.src,
    codec: stream.codec_name,
    pixel_format: stream.pix_fmt,
    width: stream.width,
    height: stream.height,
    fps: actualFps,
    duration_sec: durationSec,
    frame_count: decoded.frameCount,
    trigger_frame: plan.triggerFrame,
    handoff_end_frame: plan.handoffEndFrame,
    centroid: {
      count: centroid.count,
      x: Number(centroid.x.toFixed(4)),
      y: Number(centroid.y.toFixed(4)),
      expected_x: plan.anchorPx.x,
      expected_y: plan.anchorPx.y,
      error_px: Number(centroid.errorPx.toFixed(4))
    },
    post_handoff_ball_pixels: postHandoffColorPixels,
    file_sha256: await sha256File(path),
    decoded_frames_sha256: decoded.sha256
  });
}

export function outputPathForServe(serve) {
  const path = resolve(PROTOTYPE_DIR, serve.video.src);
  const assetsRoot = resolve(PROTOTYPE_DIR, "assets");
  const relativePath = relative(assetsRoot, path);
  if (!relativePath || relativePath.startsWith("..") || isAbsolute(relativePath)) throw new Error(`${serve.id} 輸出路徑不在 assets/`);
  return path;
}

export function selectServes(config, serveId) {
  if (!Array.isArray(config.serves)) throw new Error("timeline-config.json 缺少 serves");
  if (!serveId) return config.serves;
  const serve = config.serves.find((item) => item.id === serveId);
  if (!serve) throw new Error(`找不到 serve：${serveId}`);
  return [serve];
}

export function contentHashes(configText, settingsText) {
  return Object.freeze({ config_sha256: sha256(configText), render_settings_sha256: sha256(settingsText) });
}
