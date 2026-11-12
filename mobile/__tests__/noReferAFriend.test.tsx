import fs from "node:fs";
import path from "node:path";

test("mobile UI has no referral route, copy, entry point, or module", () => {
  const root = path.resolve(__dirname, "..");
  const files = ["App.tsx", ...fs.readdirSync(path.join(root, "src/screens")).filter((name) => name.endsWith(".tsx")).map((name) => `src/screens/${name}`)];
  const source = files.map((file) => fs.readFileSync(path.join(root, file), "utf8")).join("\n");
  expect(source).not.toMatch(/Refer a friend|ReferralScreen|referral route/i);
  expect(fs.existsSync(path.join(root, "src/referrals"))).toBe(false);
});
