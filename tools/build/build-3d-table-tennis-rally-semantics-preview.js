const fs = require("fs");
const path = require("path");

const htmlPath = path.join(__dirname, "3d-table-tennis-rally-semantics-preview.html");
const bundlePath = path.join(__dirname, "3d-table-tennis-rally-semantics-bundle.js");
const html = fs.readFileSync(htmlPath, "utf8");
const bundle = fs.readFileSync(bundlePath, "utf8");
const inlineScript = `<script id="semantics-bundle">\n/* BEGIN INLINE SEMANTICS BUNDLE */\n${bundle}\n/* END INLINE SEMANTICS BUNDLE */\n</script>`;
const externalScript = '<script src="3d-table-tennis-rally-semantics-bundle.js"></script>';
const inlineScriptPattern = /<script id="semantics-bundle">[\s\S]*?<\/script>/;

let output;
if (inlineScriptPattern.test(html)) {
  output = html.replace(inlineScriptPattern, inlineScript);
} else if (html.includes(externalScript)) {
  output = html.replace(externalScript, inlineScript);
} else {
  throw new Error("preview HTML has no semantics bundle slot");
}

fs.writeFileSync(htmlPath, output);
console.log("Inlined semantics bundle into tools/3d-table-tennis-rally-semantics-preview.html");
