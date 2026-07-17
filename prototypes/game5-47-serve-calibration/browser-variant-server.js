#!/usr/bin/env node

// Local-only browser review server for Game 5 calibration candidates.
// It serves temporary source variants in memory and never writes game5.html.

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..", "..");
const SOURCE = path.join(ROOT, "game5.html");
const PORT = 4174;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
};

const VARIANTS = {
  "baseline": {},
  "attack-y-0.15-delay-60": {attackY: 0.15, swingDelayMs: 60},
  "attack-y-0-delay-40": {attackY: 0, swingDelayMs: 40},
  "attack-y-0.45-delay-100": {attackY: 0.45, swingDelayMs: 100},
  "push-c-2.9": {pushCompensationC: 2.9},
};

function replaceOnce(source, pattern, replacement, label) {
  if (!pattern.test(source)) throw new Error(`Could not override ${label}.`);
  return source.replace(pattern, replacement);
}

function variantSource(name, fixedServeId = null) {
  const params = VARIANTS[name];
  if (!params) return null;
  let source = fs.readFileSync(SOURCE, "utf8");
  if (params.attackY != null) {
    source = replaceOnce(
      source,
      /techniqueVel:\{x:0, y:-0\.234, z:-1\}/g,
      `techniqueVel:{x:0, y:${params.attackY}, z:-1}`,
      "attack techniqueVel.y"
    );
  }
  if (params.swingDelayMs != null) {
    source = replaceOnce(
      source,
      /const SWING_DELAY_MS = [^;]+;/,
      `const SWING_DELAY_MS = ${params.swingDelayMs};`,
      "SWING_DELAY_MS"
    );
  }
  if (params.pushCompensationC != null) {
    source = replaceOnce(
      source,
      /const SIDESPIN_COMPENSATION_C = [^;]+;/,
      `const SIDESPIN_COMPENSATION_C = ${params.pushCompensationC};`,
      "SIDESPIN_COMPENSATION_C"
    );
  }
  if (fixedServeId) {
    const fixedVideoId = fixedServeId.replace(/^serve_/, "");
    const fixedRoundFunction = `function pickRoundForNextServe(){
  const fixedPreset = presets.find(p => p.id === ${JSON.stringify(fixedServeId)});
  const fixedVideo = Object.values(videoLibrary).flat().find(v => v.id === ${JSON.stringify(fixedVideoId)});
  return fixedPreset && fixedVideo ? {preset: fixedPreset, video: fixedVideo} : null;
}`;
    source = source.replace(
      /function pickRoundForNextServe\(\)\{[\s\S]*?\r?\n\}\r?\n\/\/ 方向 C 影片配置/,
      `${fixedRoundFunction}\n// 方向 C 影片配置`
    );
  }
  return source.replace("<head>", "<head><base href=\"/\">");
}

function safePath(requestPath) {
  const decoded = decodeURIComponent(requestPath.split("?")[0]);
  const resolved = path.resolve(ROOT, `.${decoded === "/" ? "/game5.html" : decoded}`);
  return resolved.startsWith(`${ROOT}${path.sep}`) ? resolved : null;
}

http.createServer((request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host || `127.0.0.1:${PORT}`}`);
  const requestPath = decodeURIComponent(requestUrl.pathname);
  const variantMatch = requestPath.match(/^\/variant\/([^/]+)\/?$/);
  if (variantMatch) {
    try {
      const source = variantSource(variantMatch[1], requestUrl.searchParams.get("fixed"));
      if (!source) {
        response.writeHead(404);
        response.end("Unknown variant");
        return;
      }
      response.writeHead(200, {
        "Content-Type": MIME[".html"],
        "Cache-Control": "no-store",
      });
      response.end(source);
    } catch (error) {
      response.writeHead(500);
      response.end(error.message);
    }
    return;
  }

  const filePath = safePath(requestPath);
  if (!filePath) {
    response.writeHead(403);
    response.end();
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    response.writeHead(200, {
      "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    response.end(data);
  });
}).listen(PORT, "127.0.0.1", () => {
  console.log(`Game 5 browser variant server listening on http://127.0.0.1:${PORT}`);
});
