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
      if (ts.isJsxOpeningElement(node) && node.tagName.getText(ast) === "Pressable" && node.attributes.properties.some((prop) => prop.name?.getText(ast) === "disabled")) {
        assert.match(node.getText(ast), /styles.disabledButton/, file);
        assert.match(node.parent.getText(ast), /styles.disabledButtonText/, file);
      }
      ts.forEachChild(node, scan);
    }
    scan(ast);
  }
});
