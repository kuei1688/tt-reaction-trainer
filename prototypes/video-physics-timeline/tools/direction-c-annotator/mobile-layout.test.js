"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.resolve(__dirname, "index.html"), "utf8");
const app = fs.readFileSync(path.resolve(__dirname, "annotator-app.js"), "utf8");
const runtime = require("./preview-runtime.js");

assert.match(html, /aspect-ratio:9\/16/);
assert.match(html, /top:3\.8%;[^}]*height:43%/);
assert.equal(runtime.MOBILE_TABLE_LAYOUT.farYRatio, 0.50);
assert.match(app, /runtime\.MOBILE_TABLE_LAYOUT/, "the app must draw with the shared runtime layout");
assert.match(app, /ctx\.fillRect\(0, h \* layout\.farYRatio, w, h \* \(1 - layout\.farYRatio\)\)/);

const videoBottom = .038 + .43;
const tableTop = runtime.MOBILE_TABLE_LAYOUT.farYRatio;
assert.ok(videoBottom < tableTop, "the C3 video card must end above the table surface");
console.log("ok - mobile C3 video card ends before the table begins");
