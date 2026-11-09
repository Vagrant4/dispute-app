const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");
const src = path.join(__dirname, "..", "src");
const styles = fs.readFileSync(path.join(src, "styles.ts"), "utf8");

test("readability colours and disabled states use solid colours", () => {
  assert.match(styles, /border: "#5F6B5F"/);
  assert.match(styles, /placeholder: "#8A9487"/);
  assert.match(styles, /disabledButton: \{\s*backgroundColor: theme.colors.surfaceMuted,\s*borderColor: theme.colors.border/);
  assert.match(styles, /disabledButtonText: \{ color: theme.colors.placeholder/);
  assert.doesNotMatch(styles, /disabled\w*:\s*\{[^}]*opacity:\s*(?:0?\.\d+|0)\b/is);
});

test("every input uses the readable placeholder colour", () => {
  for (const file of fs.readdirSync(path.join(src, "screens")).filter((file) => file.endsWith(".tsx"))) {
    const source = fs.readFileSync(path.join(src, "screens", file), "utf8");
    const ast = ts.createSourceFile(file, source, 99, true, ts.ScriptKind.TSX);
    function scan(node) {
      if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(ast) === "TextInput") {
        assert.ok(node.attributes.properties.some((prop) => prop.name?.getText(ast) === "placeholderTextColor" && prop.initializer?.getText(ast) === "{theme.colors.placeholder}"), file);
      }
      ts.forEachChild(node, scan);
    }
    scan(ast);
  }
});


test("disabled controls use disabled text colours and no opacity dimming", () => {
  function files(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? files(path.join(dir, entry.name)) : /\.tsx?$/.test(entry.name) ? [path.join(dir, entry.name)] : []); }
  for (const file of files(src)) {
    const source = fs.readFileSync(file, "utf8");
    const ast = ts.createSourceFile(file, source, 99, true, ts.ScriptKind.TSX);
    function scan(node) {
      if (ts.isPropertyAssignment(node) && node.name.getText(ast) === "opacity" && Number(node.initializer.getText(ast)) < 1) {
        assert.doesNotMatch(node.parent.parent.getText(ast), /disabled/i, file);
      }
      if (ts.isJsxOpeningElement(node) && node.tagName.getText(ast) === "Pressable" && node.attributes.properties.some((prop) => prop.name?.getText(ast) === "disabled") && !node.getText(ast).includes("styles.todayEvidenceRow")) {
        assert.match(node.getText(ast), /styles.disabledButton/, file);
        assert.match(node.parent.getText(ast), /styles.disabledButtonText|styles.locationReticle(?:Circle|Line)Disabled/, file);
      }
      ts.forEachChild(node, scan);
    }
    scan(ast);
  }
});

test("Clock out danger and halo tokens preserve contrast", () => {
  const colors = Object.fromEntries([...styles.matchAll(/(\w+): "(#[0-9A-F]{6})"/g)].map((m) => [m[1], m[2]]));
  function luminance(hex) { const c = hex.slice(1).match(/../g).map((v) => parseInt(v, 16) / 255).map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return c[0] * .2126 + c[1] * .7152 + c[2] * .0722; }
  function contrast(a, b) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
  assert.equal(colors.danger, "#D93F44");
  assert.equal(colors.dangerHalo, "#2A1416");
  assert.equal(colors.primaryHalo, "#1B2410");
  assert.ok(Number(contrast(colors.onDanger, colors.danger).toFixed(2)) >= 4.43);
  assert.ok(contrast(colors.background, colors.danger) >= 4.3);
});
