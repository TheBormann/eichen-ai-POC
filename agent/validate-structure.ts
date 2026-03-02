/**
 * Structure Validator
 *
 * Checks that all required files are present and the demo app has its
 * intentional bugs. No API key or running app needed.
 *
 * Usage:
 *   npm run validate
 */

import * as fs from "fs";

interface Result {
  label: string;
  pass: boolean;
}

const results: Result[] = [];

function check(label: string, condition: boolean) {
  results.push({ label, pass: condition });
}

function exists(p: string) {
  return fs.existsSync(p);
}

function contains(p: string, s: string) {
  if (!fs.existsSync(p)) return false;
  return fs.readFileSync(p, "utf-8").includes(s);
}

// ─── File presence ────────────────────────────────────────────────────────────

check("agent/runner.ts",                  exists("./agent/runner.ts"));
check("agent/validate-structure.ts",      exists("./agent/validate-structure.ts"));
check("auth/save-session.ts",             exists("./auth/save-session.ts"));
check("auth/session.example.json",        exists("./auth/session.example.json"));
check("suites/demo.yaml",                 exists("./suites/demo.yaml"));
check("docs/product/settings-page.md",    exists("./docs/product/settings-page.md"));
check("target-app/src/App.tsx",           exists("./target-app/src/App.tsx"));
check("target-app/src/pages/Settings.tsx", exists("./target-app/src/pages/Settings.tsx"));

// ─── Demo app bugs ────────────────────────────────────────────────────────────

check('Bug 1: nav says "Config"',         contains("./target-app/src/App.tsx", ">Config<"));
check('Bug 2: toggle says "Enable Tracking"', contains("./target-app/src/pages/Settings.tsx", "Enable Tracking"));
check('Bug 3: toast says "Saved."',       contains("./target-app/src/pages/Settings.tsx", 'setToast("Saved.")'));
check("Bug 4: save handler does nothing", contains("./target-app/src/pages/Settings.tsx", "handleSavePreferences = () => {"));

// ─── Runner correctness ───────────────────────────────────────────────────────

check("runner supports doc mode",         contains("./agent/runner.ts", "mode: \"doc\""));
check("runner supports suite mode",       contains("./agent/runner.ts", "mode: \"suite\""));
check("runner loads YAML suite",          contains("./agent/runner.ts", "yaml.load"));
check("runner has try/finally cleanup",   contains("./agent/runner.ts", "} finally {") && contains("./agent/runner.ts", "stagehand.close()"));
check("runner has exit codes",            contains("./agent/runner.ts", "process.exit("));
check("runner uses stagehand.context.pages()", contains("./agent/runner.ts", "stagehand.context.pages()"));
check("runner uses stagehand.agent()",    contains("./agent/runner.ts", "stagehand.agent("));

// ─── Suite file ───────────────────────────────────────────────────────────────

check("demo suite has target_url",        contains("./suites/demo.yaml", "target_url:"));
check("demo suite has checks",            contains("./suites/demo.yaml", "checks:"));

// ─── Package config ───────────────────────────────────────────────────────────

const pkg = JSON.parse(fs.readFileSync("./package.json", "utf-8"));
check("script: verify",                   !!pkg.scripts?.verify);
check("script: auth:save",                !!pkg.scripts?.["auth:save"]);
check("script: validate",                 !!pkg.scripts?.validate);
check("dep: @browserbasehq/stagehand",    !!pkg.dependencies?.["@browserbasehq/stagehand"]);
// Note: check name updated to match actual API used in runner.ts
check("dep: js-yaml",                     !!pkg.dependencies?.["js-yaml"]);
check("dep: zod",                         !!pkg.dependencies?.zod);
check("dep: dotenv",                      !!pkg.dependencies?.dotenv);

// ─── Print results ────────────────────────────────────────────────────────────

console.log("═══════════════════════════════════════════");
console.log("  STRUCTURE VALIDATION");
console.log("═══════════════════════════════════════════\n");

for (const r of results) {
  console.log(`${r.pass ? "✓" : "✗"} ${r.label}`);
}

const passed = results.filter((r) => r.pass).length;
const failed = results.filter((r) => !r.pass).length;

console.log("\n───────────────────────────────────────────");
console.log(`Total: ${results.length}  ·  Passed: ${passed}  ·  Failed: ${failed}`);
console.log("═══════════════════════════════════════════\n");

if (failed === 0) {
  console.log("All checks passed. Ready to run:\n");
  console.log("  npm run app");
  console.log("  npm run verify -- --doc docs/product/settings-page.md --url http://localhost:5173");
  console.log("  npm run verify -- --suite suites/demo.yaml\n");
} else {
  console.log(`${failed} check(s) failed. Fix before running.\n`);
}

process.exit(failed > 0 ? 1 : 0);
