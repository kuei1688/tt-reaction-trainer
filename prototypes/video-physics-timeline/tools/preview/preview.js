import { clamp, formatTimecode, getBallPose, getFramePlan, mix } from "../webm-frame-math.mjs";

const $ = (id) => document.getElementById(id);
const els = Object.fromEntries(["previewCanvas", "sourceStatus", "validationStatus", "serveSelect", "startX", "startY", "anchorX", "anchorY", "triggerTime", "durationTime", "handoffTime", "frameStep", "frameRange", "frameReadout", "timeReadout", "handoffBand", "triggerMark", "backButton", "nextButton", "playButton", "timelineFile", "settingsFile", "outputJson", "copyButton", "importJson", "importButton"].map((id) => [id, $(id)]));
const ctx = els.previewCanvas.getContext("2d");
let config = null, settings = null, plan = null, frameIndex = 0, source = { timeline: "未載入", settings: "未載入" };
let playing = false, playbackStartedAt = 0, playbackStartFrame = 0, dragTarget = null;
const editable = [els.serveSelect, els.startX, els.startY, els.anchorX, els.anchorY, els.triggerTime, els.durationTime, els.handoffTime, els.frameRange, els.backButton, els.nextButton, els.playButton, els.copyButton];
const rgb = (value) => `rgb(${value.join(",")})`;
const activeServe = () => config?.serves.find((serve) => serve.id === els.serveSelect.value);

function setSourceStatus(message, error = false) { els.sourceStatus.textContent = message; els.sourceStatus.className = `notice${error ? " error" : " ok"}`; }
function setValidation(message = "") { els.validationStatus.hidden = !message; els.validationStatus.textContent = message; els.validationStatus.className = "notice error"; }
function setEnabled(enabled) { editable.forEach((element) => { element.disabled = !enabled; }); }
function updateSourceStatus() { setSourceStatus(`參數來源：${source.timeline}；render settings：${source.settings}`); }
function jsonText() { return config ? `${JSON.stringify(config, null, 2)}\n` : ""; }
function updateOutput() { els.outputJson.value = jsonText(); }
function numberValue(input) { return Number(input.value); }
function setUvInputs(serve) { const { start_uv: start } = serve.video.procedural_fallback; const anchor = serve.video.handoff.video_anchor_uv; els.startX.value = start.x; els.startY.value = start.y; els.anchorX.value = anchor.x; els.anchorY.value = anchor.y; }

function selectServe(id, resetFrame = true) {
  if (!config || !settings) return;
  const serve = config.serves.find((item) => item.id === id) || config.serves[0];
  els.serveSelect.value = serve.id;
  setUvInputs(serve);
  els.triggerTime.value = serve.video.physics_trigger_time_sec;
  els.durationTime.value = serve.video.expected_duration_sec;
  els.handoffTime.value = serve.video.handoff.duration_sec;
  validateAndRender(resetFrame);
}

function updateTimeline() {
  els.frameRange.max = String(Math.max(0, plan.frameCount - 1));
  frameIndex = clamp(frameIndex, 0, plan.frameCount - 1);
  els.frameRange.value = String(frameIndex);
  const denominator = Math.max(1, plan.frameCount - 1);
  const left = (plan.triggerFrame / denominator) * 100;
  const end = (Math.min(plan.handoffEndFrame, denominator) / denominator) * 100;
  els.triggerMark.style.left = `${left}%`;
  els.handoffBand.style.left = `${left}%`;
  els.handoffBand.style.width = `${Math.max(0, end - left)}%`;
  els.frameReadout.textContent = `Frame ${frameIndex} / ${plan.frameCount - 1} · trigger ${plan.triggerFrame}`;
  els.timeReadout.textContent = `${(frameIndex / settings.fps).toFixed(3)} s · ${formatTimecode(frameIndex / settings.fps, frameIndex)}`;
}

function drawTable() {
  const { width, height, background } = settings;
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, rgb(background.top_rgb)); gradient.addColorStop(1, rgb(background.horizon_rgb.map((value) => Math.round(value * 0.55))));
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
  const centerX = width / 2, farY = height * .34, nearY = height * .94, farHalf = width * .26, nearHalf = width * .47;
  ctx.fillStyle = rgb(background.table_rgb); ctx.beginPath(); ctx.moveTo(centerX - farHalf, farY); ctx.lineTo(centerX + farHalf, farY); ctx.lineTo(centerX + nearHalf, nearY); ctx.lineTo(centerX - nearHalf, nearY); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = rgb(background.line_rgb); ctx.lineWidth = 2; ctx.globalAlpha = .72; ctx.stroke(); ctx.globalAlpha = .6; ctx.beginPath(); ctx.moveTo(centerX, farY); ctx.lineTo(centerX, nearY); ctx.stroke();
  const netY = mix(farY, nearY, .5), netHalf = mix(farHalf, nearHalf, .5), netHeight = height * .075;
  ctx.globalAlpha = .2; ctx.fillRect(centerX - netHalf, netY - netHeight, netHalf * 2, netHeight); ctx.globalAlpha = .86; ctx.beginPath(); ctx.moveTo(centerX - netHalf, netY - netHeight); ctx.lineTo(centerX + netHalf, netY - netHeight); ctx.moveTo(centerX - netHalf, netY - netHeight - 5); ctx.lineTo(centerX - netHalf, netY + 4); ctx.moveTo(centerX + netHalf, netY - netHeight - 5); ctx.lineTo(centerX + netHalf, netY + 4); ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawPath(serve) { ctx.beginPath(); for (let frame = 0; frame < plan.frameCount; frame += 1) { const pose = getBallPose(serve, settings, frame); if (frame === 0) ctx.moveTo(pose.x, pose.y); else ctx.lineTo(pose.x, pose.y); } ctx.strokeStyle = "#4dd8f0"; ctx.globalAlpha = .55; ctx.lineWidth = 2; ctx.stroke(); ctx.globalAlpha = 1; }
function drawStart(start) { const x = start.x * settings.width, y = start.y * settings.height; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.stroke(); }
function drawAnchor(anchor) { const x = anchor.x * settings.width, y = anchor.y * settings.height; ctx.strokeStyle = "#ffd166"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 10, y); ctx.lineTo(x + 10, y); ctx.moveTo(x, y - 10); ctx.lineTo(x, y + 10); ctx.stroke(); }
function render() { if (!plan) return; const serve = activeServe(); drawTable(); drawPath(serve); drawStart(serve.video.procedural_fallback.start_uv); drawAnchor(serve.video.handoff.video_anchor_uv); const pose = getBallPose(serve, settings, frameIndex); ctx.globalAlpha = pose.alpha; ctx.fillStyle = rgb(settings.ball.rgb); ctx.shadowColor = rgb(settings.ball.rgb); ctx.shadowBlur = 14; ctx.beginPath(); ctx.arc(pose.x, pose.y, settings.ball.radius_px, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.fillStyle = rgb(settings.background.timecode_rgb); ctx.font = "600 14px ui-monospace, monospace"; ctx.fillText(formatTimecode(pose.timeSec, frameIndex), 14, settings.height - 15); updateTimeline(); }

function snapToFrame(value) { return Math.round(value * settings.fps) / settings.fps; }
function validateAndRender(resetFrame = false) {
  if (!config || !settings) return;
  const serve = activeServe();
  try {
    if (!(serve.video.handoff.duration_sec > 0)) throw new Error("handoff.duration_sec 必須大於 0");
    plan = getFramePlan(serve, settings);
    if (resetFrame) frameIndex = 0;
    setValidation(""); updateTimeline(); render(); updateOutput();
  } catch (error) { plan = null; playing = false; els.playButton.textContent = "播放"; setValidation(error.message); }
}
function updateUv(axis, field, input) { const value = numberValue(input); if (!Number.isFinite(value)) return; const video = activeServe().video; const point = field === "procedural_fallback" ? video.procedural_fallback.start_uv : video.handoff.video_anchor_uv; point[axis] = clamp(value, 0, 1); setUvInputs(activeServe()); validateAndRender(); }
function updateFrameTime(property, input, message) { const raw = numberValue(input); if (!Number.isFinite(raw)) return; const snapped = snapToFrame(raw); activeServe().video[property] = snapped; input.value = snapped; validateAndRender(); if (Math.abs(raw - snapped) > 1e-9) setValidation(`${message} 已吸附到 ${snapped.toFixed(6)} 秒（${settings.fps} fps frame 邊界）。`); }

function canvasUv(event) { const rect = els.previewCanvas.getBoundingClientRect(); return { x: clamp((event.clientX - rect.left) / rect.width, 0, 1), y: clamp((event.clientY - rect.top) / rect.height, 0, 1) }; }
function chooseDragTarget(event) { const uv = canvasUv(event), serve = activeServe(), start = serve.video.procedural_fallback.start_uv, anchor = serve.video.handoff.video_anchor_uv; const distance = (point) => Math.hypot((point.x - uv.x) * settings.width, (point.y - uv.y) * settings.height); const startDistance = distance(start), anchorDistance = distance(anchor); if (Math.min(startDistance, anchorDistance) > 22) return null; return startDistance <= anchorDistance ? "start_uv" : "video_anchor_uv"; }
function drag(event) { if (!dragTarget) return; const uv = canvasUv(event), point = dragTarget === "start_uv" ? activeServe().video.procedural_fallback.start_uv : activeServe().video.handoff.video_anchor_uv; point.x = uv.x; point.y = uv.y; setUvInputs(activeServe()); validateAndRender(); }

function playback(now) { if (!playing || !plan) return; frameIndex = Math.min(plan.frameCount - 1, playbackStartFrame + Math.floor(((now - playbackStartedAt) / 1000) * settings.fps)); render(); if (frameIndex >= plan.frameCount - 1) { playing = false; els.playButton.textContent = "播放"; return; } requestAnimationFrame(playback); }
function togglePlayback() { if (!plan) return; if (playing) { playing = false; els.playButton.textContent = "播放"; return; } if (frameIndex >= plan.frameCount - 1) frameIndex = 0; playing = true; playbackStartedAt = performance.now(); playbackStartFrame = frameIndex; els.playButton.textContent = "暫停"; requestAnimationFrame(playback); }

async function loadJsonFile(input, type) { const file = input.files[0]; if (!file) return; try { const value = JSON.parse(await file.text()); if (type === "timeline") { loadConfig(value, `手動載入：${file.name}`); } else { settings = value; source.settings = `手動載入：${file.name}`; finishLoading(); } } catch (error) { setSourceStatus(`JSON 載入失敗：${error.message}`, true); } }
function loadConfig(value, label) { if (!value || !Array.isArray(value.serves) || !value.serves.length) throw new Error("timeline-config.json 缺少 serves"); config = value; source.timeline = label; els.serveSelect.replaceChildren(...config.serves.map((serve) => new Option(serve.label || serve.id, serve.id))); finishLoading(); }
function finishLoading() { if (!config || !settings) { updateSourceStatus(); return; } if (!Number.isInteger(settings.width) || !Number.isInteger(settings.height) || !Number.isInteger(settings.fps)) throw new Error("render settings 缺少有效 width、height、fps"); els.previewCanvas.width = settings.width; els.previewCanvas.height = settings.height; els.frameStep.textContent = `step ${1 / settings.fps}`; [els.triggerTime, els.durationTime].forEach((input) => { input.step = String(1 / settings.fps); }); setEnabled(true); updateSourceStatus(); selectServe(els.serveSelect.value || config.serves[0].id); }

els.serveSelect.addEventListener("change", () => { playing = false; els.playButton.textContent = "播放"; selectServe(els.serveSelect.value); });
els.startX.addEventListener("input", () => updateUv("x", "procedural_fallback", els.startX)); els.startY.addEventListener("input", () => updateUv("y", "procedural_fallback", els.startY));
els.anchorX.addEventListener("input", () => updateUv("x", "handoff", els.anchorX)); els.anchorY.addEventListener("input", () => updateUv("y", "handoff", els.anchorY));
els.triggerTime.addEventListener("change", () => updateFrameTime("physics_trigger_time_sec", els.triggerTime, "Trigger 時間")); els.durationTime.addEventListener("change", () => updateFrameTime("expected_duration_sec", els.durationTime, "影片長度"));
els.handoffTime.addEventListener("input", () => { const value = numberValue(els.handoffTime); if (Number.isFinite(value)) { activeServe().video.handoff.duration_sec = value; validateAndRender(); } });
els.frameRange.addEventListener("input", () => { frameIndex = Number(els.frameRange.value); render(); }); els.backButton.addEventListener("click", () => { frameIndex = Math.max(0, frameIndex - 1); render(); }); els.nextButton.addEventListener("click", () => { frameIndex = Math.min(plan.frameCount - 1, frameIndex + 1); render(); }); els.playButton.addEventListener("click", togglePlayback);
window.addEventListener("keydown", (event) => { if (!plan || ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) return; if (event.key === "ArrowLeft") { event.preventDefault(); frameIndex = Math.max(0, frameIndex - 1); render(); } if (event.key === "ArrowRight") { event.preventDefault(); frameIndex = Math.min(plan.frameCount - 1, frameIndex + 1); render(); } });
els.previewCanvas.addEventListener("pointerdown", (event) => { dragTarget = chooseDragTarget(event); if (dragTarget) { els.previewCanvas.setPointerCapture(event.pointerId); drag(event); } }); els.previewCanvas.addEventListener("pointermove", drag); els.previewCanvas.addEventListener("pointerup", () => { dragTarget = null; }); els.previewCanvas.addEventListener("pointercancel", () => { dragTarget = null; });
els.timelineFile.addEventListener("change", () => loadJsonFile(els.timelineFile, "timeline")); els.settingsFile.addEventListener("change", () => loadJsonFile(els.settingsFile, "settings"));
els.copyButton.addEventListener("click", async () => { try { await navigator.clipboard.writeText(jsonText()); els.copyButton.textContent = "已複製"; setTimeout(() => { els.copyButton.textContent = "複製到剪貼簿"; }, 1200); } catch { els.outputJson.focus(); els.outputJson.select(); document.execCommand("copy"); } });
els.importButton.addEventListener("click", () => { try { loadConfig(JSON.parse(els.importJson.value), "貼上 JSON"); } catch (error) { setSourceStatus(`貼上 JSON 無法載入：${error.message}`, true); } });

Promise.all([fetch("../../timeline-config.json", { cache: "no-store" }), fetch("../webm-render-settings.json", { cache: "no-store" })]).then(async ([timelineResponse, settingsResponse]) => { if (!timelineResponse.ok || !settingsResponse.ok) throw new Error(`HTTP ${!timelineResponse.ok ? timelineResponse.status : settingsResponse.status}`); const [timeline, renderSettings] = await Promise.all([timelineResponse.json(), settingsResponse.json()]); settings = renderSettings; source.settings = "已載入 webm-render-settings.json"; loadConfig(timeline, "已載入 timeline-config.json"); }).catch((error) => { setEnabled(false); setSourceStatus(`自動載入失敗：${error.message}。請以 HTTP 服務開啟，或使用下方手動載入／貼上 JSON。`, true); });
