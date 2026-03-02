/**
 * Documentation Drift Detector — Runner
 *
 * Loads a YAML test suite, runs each check against the target URL using an AI
 * agent, and writes a structured JSON report.
 *
 * Usage:
 *   npm run verify -- --suite suites/demo.yaml
 *
 * The suite file controls all configuration (URL, auth, headless, max_steps).
 * Only API keys come from .env.
 */

import dotenv from "dotenv";
dotenv.config();

import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";

// ─── Suite Schema ─────────────────────────────────────────────────────────────

const CheckSchema = z.object({
  name: z.string(),
  steps: z.string(),
  expect: z.string(),
});

const SuiteSchema = z.object({
  suite: z.string(),
  target_url: z.string().url(),
  auth_session: z.string().optional(),
  headless: z.boolean().optional().default(true),
  max_steps: z.number().int().positive().optional().default(50),
  checks: z.array(CheckSchema).min(1),
});

type Suite = z.infer<typeof SuiteSchema>;
type Check = z.infer<typeof CheckSchema>;

// ─── Report Schema ────────────────────────────────────────────────────────────

const CheckResultSchema = z.object({
  name: z.string(),
  status: z.enum(["pass", "fail", "error"]),
  expected: z.string(),
  actual: z.string(),
  screenshot: z.string().optional(),
});

const ReportSchema = z.object({
  run_id: z.string(),
  suite: z.string(),
  target_url: z.string(),
  suite_file: z.string(),
  overall: z.enum(["pass", "fail", "error"]),
  duration_ms: z.number(),
  token_usage: z.object({
    prompt: z.number(),
    completion: z.number(),
    total: z.number(),
    estimated_cost_usd: z.number(),
  }),
  checks: z.array(CheckResultSchema),
  error: z.string().optional(),
});

type CheckResult = z.infer<typeof CheckResultSchema>;
type Report = z.infer<typeof ReportSchema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseSuiteFile(suitePath: string): Suite {
  if (!fs.existsSync(suitePath)) {
    throw new Error(`Suite file not found: ${suitePath}`);
  }
  const raw = yaml.load(fs.readFileSync(suitePath, "utf-8"));
  const parsed = SuiteSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Invalid suite file:\n${parsed.error.toString()}`);
  }
  return parsed.data;
}

function parseSuiteArg(): string {
  const idx = process.argv.indexOf("--suite");
  if (idx === -1 || !process.argv[idx + 1]) {
    throw new Error(
      "Required argument missing: --suite <path>\n  Example: npm run verify -- --suite suites/demo.yaml"
    );
  }
  return process.argv[idx + 1];
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function estimateCost(prompt: number, completion: number): number {
  // GPT-4o: $2.50/1M input, $10/1M output
  return (prompt / 1_000_000) * 2.5 + (completion / 1_000_000) * 10;
}

async function saveScreenshot(page: any, label: string, reportsDir: string): Promise<string> {
  ensureDir(reportsDir);
  const filename = `${new Date().toISOString().replace(/[:.]/g, "-")}_${slugify(label)}.png`;
  const filepath = path.join(reportsDir, filename);
  await page.screenshot({ path: filepath, fullPage: true });
  return filepath;
}

function detectModel(): string {
  if (process.env.OPENAI_API_KEY) return "openai/gpt-4o";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic/claude-sonnet-4-5-20250929";
  throw new Error("No API key found. Set OPENAI_API_KEY or ANTHROPIC_API_KEY in .env");
}

// ─── Core: run one check ──────────────────────────────────────────────────────

async function runCheck(
  stagehand: Stagehand,
  check: Check,
  suite: Suite,
  model: string,
  reportsDir: string
): Promise<CheckResult> {
  const page = stagehand.context.pages()[0];

  // Navigate fresh for each check so they are independent
  await page.goto(suite.target_url, { waitUntil: "networkidle", timeout: 30_000 });
  await page.waitForTimeout(1_000);

  const agent = stagehand.agent({
    model,
    systemPrompt:
      "You are a documentation QA agent verifying a live UI against a specification. " +
      "RULES: " +
      "- Quote UI text exactly as you see it. Never paraphrase. " +
      "- If you cannot find an element mentioned in the check, that is a fail. " +
      "- Only check what is explicitly described. Do not invent additional requirements.",
    mode: "dom",
  });

  const instruction = `
You are verifying one specific check against the UI.

STEPS (what to do):
${check.steps.trim()}

VERIFY (what must be true):
${check.expect.trim()}

The application is loaded at: ${suite.target_url}

Perform the steps, then verify the expectation.
End your response with one of:
  RESULT: PASS — <what you saw>
  RESULT: FAIL — expected <expected>, saw <actual>
`.trim();

  let agentResult: any;
  try {
    agentResult = await agent.execute({
      instruction,
      maxSteps: suite.max_steps,
    });
  } catch (err) {
    const screenshot = await saveScreenshot(page, `${check.name}-error`, reportsDir).catch(() => undefined);
    return {
      name: check.name,
      status: "error",
      expected: check.expect.trim(),
      actual: err instanceof Error ? err.message : String(err),
      screenshot,
    };
  }

  const screenshot = await saveScreenshot(page, check.name, reportsDir).catch(() => undefined);
  const message: string = agentResult.message || "";

  // Parse structured result from the agent's message
  const resultLine = message.split("\n").find((l: string) => l.trim().startsWith("RESULT:"));
  let status: "pass" | "fail" = "fail";
  let actual = "No result returned";

  if (resultLine) {
    const isPass = resultLine.includes("PASS");
    status = isPass ? "pass" : "fail";
    // Extract everything after the em-dash or hyphen
    const dashIdx = resultLine.search(/[—–-]/);
    actual = dashIdx !== -1 ? resultLine.slice(dashIdx + 1).trim() : resultLine.replace(/RESULT:\s*(PASS|FAIL)\s*/, "").trim();
  } else {
    // Fallback: use the full agent message summary
    const lowerMsg = message.toLowerCase();
    const hasFail =
      lowerMsg.includes("fail") ||
      lowerMsg.includes("does not match") ||
      lowerMsg.includes("instead") ||
      lowerMsg.includes("not present") ||
      lowerMsg.includes("not found") ||
      lowerMsg.includes("no error") ||
      lowerMsg.includes("nothing") ||
      (!agentResult.success && message.length > 0);
    status = hasFail ? "fail" : "pass";
    // Use a sentence that contains "saw", "found", "shows", or "labeled" to extract the actual value
    const sentences = message.split(/[.\n]/);
    const relevantSentence = sentences.find(
      (s: string) => /\b(saw|found|shows|labeled|says|reads|appears|instead|displayed)\b/i.test(s)
    );
    actual = relevantSentence?.trim() || message.slice(0, 300).trim() || "No details returned";
  }

  return {
    name: check.name,
    status,
    expected: check.expect.trim(),
    actual,
    screenshot,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();
  const runId = new Date().toISOString();
  const reportsDir = "./reports";

  // Parse args and load suite
  const suitePath = parseSuiteArg();
  const suite = parseSuiteFile(suitePath);
  const model = detectModel();

  console.log("═══════════════════════════════════════════");
  console.log(`  ${suite.suite}`);
  console.log("═══════════════════════════════════════════");
  console.log(`  Target:  ${suite.target_url}`);
  console.log(`  Suite:   ${suitePath}`);
  console.log(`  Checks:  ${suite.checks.length}`);
  console.log(`  Model:   ${model}`);
  console.log(`  Auth:    ${suite.auth_session ?? "none"}\n`);

  // Health-check the target
  process.stdout.write("[health] Checking target... ");
  try {
    const res = await fetch(suite.target_url, { method: "HEAD" });
    if (!res.ok && res.status !== 304) throw new Error(`HTTP ${res.status}`);
    console.log("✓\n");
  } catch (err) {
    console.log("✗");
    throw new Error(`Target not reachable: ${suite.target_url}\n  ${err}`);
  }

  // Init Stagehand — pass auth storageState directly via localBrowserLaunchOptions
  const authSessionPath = suite.auth_session;
  const hasAuth = !!authSessionPath && fs.existsSync(authSessionPath);

  const stagehand = new Stagehand({
    env: "LOCAL",
    model,
    localBrowserLaunchOptions: {
      headless: suite.headless,
    },
    verbose: 0,
  });

  await stagehand.init();

  // Load auth session into the existing context (avoid closing/relaunching Stagehand)
  if (hasAuth) {
    try {
      await stagehand.context.addCookies(
        JSON.parse(fs.readFileSync(authSessionPath!, "utf-8")).cookies ?? []
      );
      console.log(`[auth] Session loaded from ${authSessionPath}\n`);
    } catch {
      console.log(`[auth] Warning: could not load session from ${authSessionPath}\n`);
    }
  }

  const checkResults: CheckResult[] = [];

  try {
    for (let i = 0; i < suite.checks.length; i++) {
      const check = suite.checks[i];
      process.stdout.write(`  [${i + 1}/${suite.checks.length}] ${check.name} ... `);

      const result = await runCheck(stagehand, check, suite, model, reportsDir);
      checkResults.push(result);

      const icon = result.status === "pass" ? "✓" : result.status === "error" ? "!" : "✗";
      console.log(icon);

      if (result.status !== "pass") {
        const expectedFirst = result.expected.split("\n")[0].trim();
        console.log(`        expected: ${expectedFirst}`);
        console.log(`        actual:   ${result.actual}`);
      }
    }
  } finally {
    await stagehand.close().catch(() => {});
  }

  // Collect metrics
  let totalPrompt = 0;
  let totalCompletion = 0;
  try {
    const metrics = (stagehand as any).metrics;
    totalPrompt = metrics?.totalPromptTokens ?? 0;
    totalCompletion = metrics?.totalCompletionTokens ?? 0;
  } catch {
    // metrics not always available
  }

  const duration = Date.now() - startTime;
  const passed = checkResults.filter((r) => r.status === "pass").length;
  const failed = checkResults.filter((r) => r.status !== "pass").length;
  const overall: "pass" | "fail" | "error" =
    checkResults.some((r) => r.status === "error") ? "error" : failed > 0 ? "fail" : "pass";

  const report: Report = {
    run_id: runId,
    suite: suite.suite,
    target_url: suite.target_url,
    suite_file: suitePath,
    overall,
    duration_ms: duration,
    token_usage: {
      prompt: totalPrompt,
      completion: totalCompletion,
      total: totalPrompt + totalCompletion,
      estimated_cost_usd: estimateCost(totalPrompt, totalCompletion),
    },
    checks: checkResults,
  };

  // Write report
  ensureDir(reportsDir);
  const reportPath = path.join(reportsDir, `report-${runId.replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  // Print summary
  console.log("\n───────────────────────────────────────────");
  console.log(
    `  ${overall.toUpperCase()}  ·  ${suite.checks.length} checks  ·  ${passed} passed  ·  ${failed} failed`
  );
  console.log(
    `  ${(duration / 1000).toFixed(1)}s  ·  $${estimateCost(totalPrompt, totalCompletion).toFixed(4)}`
  );
  console.log(`  Report: ${reportPath}`);
  console.log("═══════════════════════════════════════════\n");

  process.exit(overall === "pass" ? 0 : overall === "fail" ? 1 : 2);
}

main().catch((err) => {
  console.error("\nFatal error:", err instanceof Error ? err.message : err);
  process.exit(2);
});
