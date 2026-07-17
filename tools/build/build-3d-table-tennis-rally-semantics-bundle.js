const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "../..");
const files = [
  "shared-physics-core.js",
  "mainline-v2/trainer-state.js",
  "mainline-v2/physics-adapter.js",
  "mainline-v2/contact-policy.js",
  "mainline-v2/table-geometry.js",
  "tools/3d-table-tennis-rally-semantics.js",
];

const banner = [
  "/* Isolated semantics-aware rally bundle. Generated from read-only shared/mainline modules. */",
  "/* This bundle is for the tools/ preview only; it is not formal mainline code. */",
  "",
].join("\n");

const bundle = banner + files.map((file) => {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  return `\n/* BEGIN ${file} */\n${source}\n/* END ${file} */\n`;
}).join("\n");

fs.writeFileSync(path.join(__dirname, "3d-table-tennis-rally-semantics-bundle.js"), bundle);
console.log(`Wrote tools/3d-table-tennis-rally-semantics-bundle.js from ${files.length} sources.`);
