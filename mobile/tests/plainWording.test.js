const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");
const root = path.join(__dirname, "..");
const forbidden = /\b(runtime|native|SQLite|JSON|app-owned|durable|archived|locally)\b/i;

// Follow local imports from the app's routes; never scan platform adapters or dev tools.
function routedFiles() {
  const seen = new Set();
  function visit(file) {
    if (seen.has(file) || /[\\/]dev[\\/]|repositories\.web\.ts$|webReportAdapters\.ts$/.test(file)) return;
    seen.add(file);
    const source = fs.readFileSync(file, "utf8");
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function imports(node) {
      const specifier = (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) ? node.moduleSpecifier
        : ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword ? node.arguments[0] : null;
      if (specifier && ts.isStringLiteral(specifier) && specifier.text.startsWith(".")) {
        const base = path.resolve(path.dirname(file), specifier.text);
        const target = [base + ".ts", base + ".tsx", path.join(base, "index.ts")].find(fs.existsSync);
        if (target) visit(target);
      }
      ts.forEachChild(node, imports);
    }
    imports(ast);
  }
  visit(path.join(root, "App.tsx"));
  return [...seen].filter((file) => file.includes(path.join("mobile", "src")));
}

function userFacing(node) {
  for (let child = node, parent = node.parent; parent; child = parent, parent = parent.parent) {
    if (ts.isNewExpression(parent) && ts.isIdentifier(parent.expression) && parent.expression.text === "Error") {
      if (parent.arguments?.[0] !== child) return false;
      for (let ancestor = parent.parent; ancestor; ancestor = ancestor.parent) {
        if (ts.isPropertyAssignment(ancestor) && ancestor.name.getText() === "cause") return false;
      }
      return true;
    }
    if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent) || ts.isTypeNode(parent) || ts.isThrowStatement(parent)) return false;
    if (ts.isPropertyAssignment(parent) && parent.name.getText() === "cause") return false;
  }
  const text = node.text || "";
  // Internal values are identifiers/paths, not display copy. SQL is never rendered.
  if (/^(?:SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|PRAGMA|DROP)\b/i.test(text.trim())) return false;
  if (ts.isJsxText(node) || ts.isJsxAttribute(node.parent)) return true;
  if (node.parent && ts.isPropertyAssignment(node.parent) && /^(message|title|label|body|heading|description)$/.test(node.parent.name.getText())) return true;
  return /\s/.test(text) && !/^[./]|^https?:|^application\//.test(text);
}

test("routed user-facing strings use plain wording", () => {
  const failures = [];
  for (const file of routedFiles()) {
    const ast = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function scan(node) {
      if ((ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node) || ts.isJsxText(node)) && userFacing(node) && forbidden.test(node.text) && !node.text.startsWith("The project is archived (hidden from lists and pickers)")) {
        failures.push(`${path.relative(root, file)}:${ast.getLineAndCharacterOfPosition(node.getStart()).line + 1}: ${node.text}`);
      }
      ts.forEachChild(node, scan);
    }
    scan(ast);
  }
  assert.deepEqual(failures, []);
});


test("wording scan checks Error messages and skips technical causes", () => {
  const source = [
    'throw new Error("Native runtime unavailable.", { cause: "SQLite failed." });',
    'const error = new Error(`JSON value ${value} is invalid.`, { cause: new Error("Durable storage failed.") });',
    'throw new Error("Please try again.", { cause: "Archived locally." });',
  ].join("\n");
  const ast = ts.createSourceFile("errors.ts", source, ts.ScriptTarget.Latest, true);
  const failures = [];
  function scan(node) {
    if ((ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) && userFacing(node) && forbidden.test(node.text)) {
      failures.push(node.text);
    }
    ts.forEachChild(node, scan);
  }
  scan(ast);
  assert.deepEqual(failures, ["Native runtime unavailable.", "JSON value "]);
});
