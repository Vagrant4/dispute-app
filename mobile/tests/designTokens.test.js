const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");
const mobile = path.join(__dirname, "..");
function screens(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? screens(path.join(dir, entry.name)) : entry.name.endsWith(".tsx") ? [path.join(dir, entry.name)] : []);
}
// OpenStreetMap requires the real copyright sign in its attribution.
const exceptions = new Map([
  [`${path.join(mobile, "src/screens/LocationMap.native.tsx")}:emoji`, "required map attribution"],
]);
function violations(source, file) {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const errors = [];
  function scan(node) {
    if (ts.isPropertyAssignment(node)) {
      const key = node.name.getText(ast).replace(/["']/g, "");
      const value = node.initializer;
      if (/^(fontSize|fontWeight|lineHeight|(?:padding|margin)\w*|(?:row|column)?[Gg]ap|border\w*Radius)$/.test(key) && (ts.isNumericLiteral(value) || ts.isPrefixUnaryExpression(value) || (key === "fontWeight" && ts.isStringLiteral(value)))) {
        if (![0, 1, 2].includes(Number(value.getText(ast))) || key === "fontSize") errors.push(`${key}: ${value.getText(ast)}`);
      }
      if (key === "textTransform" && ts.isStringLiteral(value) && value.text === "uppercase") errors.push("uppercase");
    }
    if ((ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node) || ts.isJsxText(node)) && /\p{Extended_Pictographic}/u.test(node.text)) errors.push("emoji");
    ts.forEachChild(node, scan);
  }
  scan(ast);
  return errors.filter((error) => !exceptions.has(`${file}:${error}`));
}
test("screens, shared styles and tab bar use tokens and plain text", () => {
  const files = [...screens(path.join(mobile, "src/screens")), path.join(mobile, "src/styles.ts"), path.join(mobile, "App.tsx")];
  for (const file of files) assert.deepEqual(violations(fs.readFileSync(file, "utf8"), file), [], path.relative(mobile, file));
});
test("token guard rejects literal styles, emoji and uppercase", () => {
  for (const source of ['const s = { fontSize: 16 };', 'const s = { paddingTop: 16 };', 'const s = { margin: -8 };', 'const s = { gap: 8 };', 'const s = { textTransform: "uppercase" };', 'const s = "\u{1F4CD}";', '<Text>\u{1F4F7}</Text>']) assert.ok(violations(source, "fixture.tsx").length, source);
  assert.deepEqual(violations('const s = { padding: space.md, margin: 0, gap: 2, borderWidth: StyleSheet.hairlineWidth, ...type.body };', "fixture.tsx"), []);
});
test("design scales retain the five readable type levels and shared dimensions", () => {
  const source = fs.readFileSync(path.join(mobile, "src/theme/tokens.ts"), "utf8");
  assert.match(source, /body: \{ fontSize: 16, fontWeight: "400", lineHeight: 24 \}/);
  assert.match(source, /caption: \{ fontSize: 13, fontWeight: "500", lineHeight: 18 \}/);
  assert.match(source, /xs: 4, sm: 8, md: 16, lg: 24, xl: 32/);
  assert.match(source, /sm: 8, md: 14, lg: 20, pill: 999/);
  assert.match(source, /height: 52, radius: radius.md/);
});
