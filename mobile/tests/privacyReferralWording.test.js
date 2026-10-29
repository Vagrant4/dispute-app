const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");
const vm = require("node:vm");
const root = path.join(__dirname, "..", "src");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const referral = read("screens/ReferralScreen.tsx");
const banned = /\b(sync|tokens?|server|cloud|trackers?|backend|database|uploads?|API|SDK)\b|^\s*Loading\s*$/i;

test("privacy and referral display copy avoids technical words and bare loading", () => {
  for (const file of ["screens/PrivacyScreen.tsx", "screens/DeleteAccountScreen.tsx", "screens/ReferralScreen.tsx", "screenContent.ts"]) {
    const ast = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function scan(node) {
      if (file === "screenContent.ts" && ts.isVariableDeclaration(node) && node.name.getText() !== "privacyContent") return;
      if ((ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateTail(node) || ts.isTemplateMiddle(node) || ts.isJsxText(node)) &&
          !ts.isImportDeclaration(node.parent) && !/^https?:|^\.\.?\//.test(node.text)) {
        assert.equal(banned.test(node.text), false, `${file}: ${node.text}`);
      }
      ts.forEachChild(node, scan);
    }
    scan(ast);
  }
});

test("referral wording preserves qualification and reward rules", () => {
  for (const text of ["two paid months", "Five counted referrals earn one free month", "recorded first", "store-approved way", "reuse a registered phone number do not count", "Rewards may be checked before they are given"]) {
    assert.ok(referral.includes(text), text);
  }
  for (const field of ["qualifiedCount", "earnedRewardMonths", "rewardMessage", "shareUrl"]) assert.ok(referral.includes(field));
});

test("referral code keeps its slot through loading, failure, retry and success", async () => {
  const hooks = [];
  let cursor = 0;
  let effect;
  let resolveFetch;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = initial;
      return [hooks[index], (value) => { hooks[index] = value; }];
    },
    useEffect(fn) { effect ??= fn; },
    createElement(type, props, ...children) { return { type, props: props || {}, children }; },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(referral, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText, {
    exports, React: react,
    require(name) {
      if (name === "react") return react;
      if (name === "react-native") return { Text: "Text", View: "View", Pressable: "Pressable", Share: {} };
      if (name === "../styles") return { styles: new Proxy({}, { get: (_, key) => key }) };
      if (name === "../referrals/referralClient") return { fetchReferralSummary: () => new Promise((resolve) => { resolveFetch = resolve; }) };
      throw new Error(name);
    },
  });
  const render = () => { cursor = 0; return exports.ReferralScreen(); };
  function nodes(tree) { return !tree || typeof tree !== "object" ? [] : [tree, ...tree.children.flatMap(nodes)]; }
  function text(tree) { return !tree || typeof tree !== "object" ? String(tree ?? "") : tree.children.map(text).join(""); }
  const slot = (tree) => nodes(tree).find((node) => node.props.style?.includes?.("referralCodeSlot"));
  let tree = render();
  assert.equal(text(slot(tree)), "Getting your code…");
  effect();
  resolveFetch({ ok: false, message: "Technical failure" });
  await new Promise(setImmediate);
  tree = render();
  assert.equal(text(slot(tree)), "Connect to the internet to see your code");
  const retry = nodes(tree).find((node) => node.type === "Pressable" && text(node) === "Try again");
  assert.ok(retry);
  retry.props.onPress();
  assert.equal(text(slot(render())), "Getting your code…");
  resolveFetch({ ok: true, referral: { code: "ABC123", shareUrl: "https://example.test", qualifiedCount: 2, earnedRewardMonths: 1, rewardMessage: "Reward ready" } });
  await new Promise(setImmediate);
  tree = render();
  assert.equal(text(slot(tree)), "ABC123");
  assert.equal(nodes(tree).some((node) => node.type === "Pressable" && text(node) === "Try again"), false);
  assert.match(read("styles.ts"), /referralCodeSlot: \{ height: 48 \}/);
  assert.match(referral, /onPress=\{\(\) => void loadReferral\(\)\}/);
});
