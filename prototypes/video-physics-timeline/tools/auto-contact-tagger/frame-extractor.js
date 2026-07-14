'use strict';
// frame-extractor.js
// ffmpeg/ffprobe 抽幀封裝。偵測工具路徑（PATH -> 常見安裝位置 -> --ffmpeg 覆寫）。
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const FALLBACK_DIRS = ['C:\\Program Files (x86)\\Vcows'];

function fallbackCandidates() {
  const list = [];
  for (const d of FALLBACK_DIRS) if (fs.existsSync(d)) list.push(d);
  const capcut = path.join(os.homedir(), 'AppData\\Local\\CapCut\\Apps');
  if (fs.existsSync(capcut)) {
    try { for (const sub of fs.readdirSync(capcut)) list.push(path.join(capcut, sub)); } catch (e) {}
  }
  return list;
}

function findInPath(name) {
  try {
    const out = process.platform === 'win32'
      ? execFileSync('where', [name], { encoding: 'utf8', stdio: ['ignore','pipe','ignore'] }).split(/\r?\n/).map(s => s.trim()).filter(Boolean)
      : execFileSync('which', [name], { encoding: 'utf8', stdio: ['ignore','pipe','ignore'] }).trim().split(/\n/).filter(Boolean);
    if (out.length) return out[0];
  } catch (e) {}
  return null;
}

function findTool(name, override) {
  if (override) return override;
  const inPath = findInPath(name);
  if (inPath) return inPath;
  const exe = process.platform === 'win32' ? (name + '.exe') : name;
  for (const dir of fallbackCandidates()) {
    const p = path.join(dir, exe);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix || 'auto-contact-tagger-'));
}

function evalFps(frac) {
  if (!frac || frac === '0/0') return null;
  const m = /^(\d+)\/(\d+)$/.exec(frac);
  if (!m) return null;
  const d = parseInt(m[2], 10);
  return d ? parseInt(m[1], 10) / d : null;
}

function probeVideo(video) {
  const ffprobe = findTool('ffprobe', null);
  if (!ffprobe) return null;
  try {
    const json = execFileSync(ffprobe,
      ['-v', 'error', '-select_streams', 'v:0', '-print_format', 'json', '-show_streams', video],
      { encoding: 'utf8', stdio: ['ignore','pipe','ignore'] });
    const s = JSON.parse(json).streams[0];
    const fps = evalFps(s.avg_frame_rate) || evalFps(s.r_frame_rate) || 60;
    const nb = s.nb_frames ? parseInt(s.nb_frames, 10) : null;
    const dur = s.duration ? parseFloat(s.duration) : null;
    return { fps: fps, nbFrames: nb, duration: dur };
  } catch (e) {
    return null;
  }
}

function extractAllFrames(ffmpeg, video, fps, outDir) {
  // 抽出整段影片每一幀（本工具素材都是 ~5s 短片，全抽成本低且避免 seek 誤差）。
  execFileSync(ffmpeg,
    ['-y', '-i', video, '-vf', 'fps=' + fps, '-q:v', '2', path.join(outDir, 'frame_%05d.jpg')],
    { stdio: ['ignore', 'ignore', 'pipe'] });
  const files = fs.readdirSync(outDir).filter(fn => /^frame_\d+\.jpg$/.test(fn)).sort();
  // frame_%05d 從 1 開始；index 0-based = 序號 - 1；timeSec = index / fps
  return files.map((fn, i) => ({ index: i, timeSec: i / fps, path: path.join(outDir, fn) }));
}

module.exports = {
  findTool: findTool,
  makeTempDir: makeTempDir,
  probeVideo: probeVideo,
  extractAllFrames: extractAllFrames,
  evalFps: evalFps
};