/**
 * Documentation Drift Detector — Runner
 *
 * Two modes:
 *
 *   Doc mode   — point at a doc and a URL, the agent reads the doc and figures
 *                out what to verify autonomously. This is the core thesis.
 *
 *                  npm run verify -- --doc docs/product/settings-page.md --url http://localhost:5173
 *
 *   Suite mode — structured YAML file with named checks. Useful for repeatable
 *                CI runs where you've already defined exactly what to test.
 *
 *                  npm run verify -- --suite suites/demo.yaml
 *
 * Only API keys come from .env. Everything else is on the command line or in
 * the suite file.
 */

import dotenv from "dotenv";
dotenv.config();

import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";

// ─── Types ────────────────────────────────────────────────────────────────────

// Suite mode schema
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

// Shared report types
type CheckResult = {
  name: string;
  status: "pass" | "fail" | "error";
  expected: string;
  actual: string;
  screenshot?: string;
};

type Report = {
  run_id: string;
  mode: "doc" | "suite";
  label: string;
  target_url: string;
  source: string; // doc path or suite file path
  overall: "pass" | "fail" | "error";
  duration_ms: number;
  token_usage: {
    prompt: number;
    completion: number;
    total: number;
    estimated_cost_usd: number;
  };
  checks: CheckResult[];
  error?: string;
};

// ─── Arg parsing ──────────────────────────────────────────────────────────────

type RunMode =
  | { mode: "doc"; docPath: string; targetUrl: string; headless: boolean; maxSteps: number; authSession?: string }
  | { mode: "suite"; suitePath: string };

function parseArgs(): RunMode {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : undefined;
  };

  const docPath = get("--doc");
  const targetUrl = get("--url");
  const suitePath = get("--suite");

  if (docPath && targetUrl) {
    return {
      mode: "doc",
      docPath,
      targetUrl,
      headless: get("--headless") !== "false",
      maxSteps: parseInt(get("--max-steps") ?? "100"),
      authSession: get("--auth"),
    };
  }

  if (suitePath) {
    return { mode: "suite", suitePath };
  }

  throw new Error(
    "Usage:\n" +
    "  Doc mode:   npm run verify -- --doc <path> --url <url> [--headless false] [--auth ./auth/session.json]\n" +
    "  Suite mode: npm run verify -- --suite <path>"
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function estimateCost(prompt: number, completion: number) {
  return (prompt / 1_000_000) * 2.5 + (completion / 1_000_000) * 10;
}

function detectModel() {
  if (process.env.OPENAI_API_KEY) return "openai/gpt-4o";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic/claude-sonnet-4-5-20250929";
  throw new Error("No API key found. Set OPENAI_API_KEY or ANTHROPIC_API_KEY in .env");
}

async function screenshot(page: any, label: string, dir: string): Promise<string> {
  ensureDir(dir);
  const p = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}_${slugify(label)}.png`);
  await page.screenshot({ path: p, fullPage: true });
  return p;
}

async function healthCheck(url: string) {
  try {
    const res = await fetch(url, { method: "HEAD" });
    if (!res.ok && res.status !== 304) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    throw new Error(`Target not reachable: ${url}\n  ${err}`);
  }
}

async function initStagehand(model: string, headless: boolean, authSession?: string): Promise<Stagehand> {
  const sh = new Stagehand({ env: "LOCAL", model, localBrowserLaunchOptions: { headless }, verbose: 0 });
  await sh.init();
  if (authSession && fs.existsSync(authSession)) {
    try {
      const cookies = JSON.parse(fs.readFileSync(authSession, "utf-8")).cookies ?? [];
      await sh.context.addCookies(cookies);
      console.log(`[auth] Loaded session from ${authSession}\n`);
    } catch {
      console.log(`[auth] Warning: could not load session from ${authSession}\n`);
    }
  }
  return sh;
}

function collectMetrics(stagehand: Stagehand) {
  try {
    const m = (stagehand as any).metrics;
    return { prompt: m?.totalPromptTokens ?? 0, completion: m?.totalCompletionTokens ?? 0 };
  } catch {
    return { prompt: 0, completion: 0 };
  }
}

// ─── Doc mode ─────────────────────────────────────────────────────────────────
//
// The agent receives the full document and the live URL. It reads the doc,
// decides what to navigate and verify, then reports every discrepancy it finds.
// No pre-decomposed checks — this is fully autonomous.

async function runDocMode(
  stagehand: Stagehand,
  docPath: string,
  targetUrl: string,
  maxSteps: number,
  reportsDir: string
): Promise<CheckResult[]> {
  const doc = fs.readFileSync(docPath, "utf-8");
  const page = stagehand.context.pages()[0];

  await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 30_000 });
  await page.waitForTimeout(1_000);
  await screenshot(page, "initial-state", reportsDir);

  // Phase 1: Agent navigates the UI and collects observations
  const agent = stagehand.agent({
    model: detectModel(),
    systemPrompt:
      "You are a documentation QA agent. You will receive a product document and access to a live UI. " +
      "Your job is to check every specific claim the document makes about labels, text, links, and behaviour. " +
      "Quote UI text exactly as you see it — never paraphrase. " +
      "Report every discrepancy you find.",
    mode: "dom",
  });

  const result = await agent.execute({
    instruction: `
Read this product document, then navigate the live UI at ${targetUrl} and verify every claim it makes.

DOCUMENT:
---
${doc}
---

Your task:
1. Check the navigation bar and all visible labels
2. Navigate to every page the document describes
3. For each claim in the document, check the exact label, message, or behaviour
4. Try interactions like clicking buttons, toggling switches, and submitting forms
5. Report what you see: quote exact text from the UI, note any differences from the document

Be thorough. Check everything the document mentions.
`.trim(),
    maxSteps,
  });

  const observations: string = result.message || "";
  
  // Phase 2: Structure the findings using a direct LLM call
  // (Stagehand agent doesn't reliably format output in LOCAL mode)
  const model = detectModel();
  const apiKey = model.includes("openai") ? process.env.OPENAI_API_KEY : process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    throw new Error("No API key found for structuring findings");
  }

  let structuredFindings: any;
  
  if (model.includes("openai")) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a QA analyst. You receive a product document and observations from testing a live UI. Your job is to compare them and output structured findings in JSON format."
          },
          {
            role: "user",
            content: `
PRODUCT DOCUMENT:
---
${doc}
---

OBSERVATIONS FROM TESTING THE LIVE UI:
---
${observations}
---

Compare the document to the observations. For each specific claim in the document (labels, messages, buttons, behaviors), output a JSON array of findings.

Each finding should have:
- "claim": the specific claim from the document
- "status": "pass" or "fail"
- "expected": what the document says
- "actual": what was observed in the UI (quote exact text)

Output ONLY valid JSON in this format:
{
  "findings": [
    {"claim": "...", "status": "pass", "expected": "...", "actual": "..."},
    {"claim": "...", "status": "fail", "expected": "...", "actual": "..."}
  ]
}
`
          }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    structuredFindings = JSON.parse(data.choices[0].message.content);
  } else {
    // Anthropic
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: `
PRODUCT DOCUMENT:
---
${doc}
---

OBSERVATIONS FROM TESTING THE LIVE UI:
---
${observations}
---

Compare the document to the observations. For each specific claim in the document (labels, messages, buttons, behaviors), output a JSON array of findings.

Each finding should have:
- "claim": the specific claim from the document
- "status": "pass" or "fail"
- "expected": what the document says
- "actual": what was observed in the UI (quote exact text)

Output ONLY valid JSON in this format:
{
  "findings": [
    {"claim": "...", "status": "pass", "expected": "...", "actual": "..."},
    {"claim": "...", "status": "fail", "expected": "...", "actual": "..."}
  ]
}
`
          }
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.content[0].text;
    // Extract JSON from markdown code blocks if present
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
    structuredFindings = JSON.parse(jsonMatch ? jsonMatch[1] : content);
  }

  // Convert to CheckResult format
  if (structuredFindings.findings && Array.isArray(structuredFindings.findings)) {
    return structuredFindings.findings.map((f: any): CheckResult => ({
      name: f.claim.slice(0, 80),
      status: f.status === "pass" ? "pass" : "fail",
      expected: f.expected,
      actual: f.actual,
    }));
  }

  // Fallback if structuring failed
  return [{
    name: "Document verification",
    status: "fail",
    expected: "UI matches document",
    actual: observations.slice(0, 600).trim() || "Agent completed without observations",
  }];
}

// ─── Suite mode ───────────────────────────────────────────────────────────────
//
// Each check in the YAML defines explicit steps and expectations. The agent
// runs one focused pass per check. Good for repeatable CI verification where
// you already know exactly what to test.

async function runSuiteCheck(
  stagehand: Stagehand,
  check: Check,
  targetUrl: string,
  maxSteps: number,
  reportsDir: string
): Promise<CheckResult> {
  const page = stagehand.context.pages()[0];

  await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 30_000 });
  await page.waitForTimeout(1_000);

  const agent = stagehand.agent({
    model: detectModel(),
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

The application is loaded at: ${targetUrl}

Perform the steps, then verify the expectation.
End your response with one of:
  RESULT: PASS — <what you saw>
  RESULT: FAIL — expected: <expected>, saw: <actual>
`.trim();

  let agentResult: any;
  try {
    agentResult = await agent.execute({ instruction, maxSteps });
  } catch (err) {
    const sc = await screenshot(page, `${check.name}-error`, reportsDir).catch(() => undefined);
    return { name: check.name, status: "error", expected: check.expect.trim(), actual: String(err), screenshot: sc };
  }

  const sc = await screenshot(page, check.name, reportsDir).catch(() => undefined);
  const message: string = agentResult.message || "";

  const resultLine = message.split("\n").find((l: string) => l.trim().startsWith("RESULT:"));
  let status: "pass" | "fail" = "fail";
  let actual = "No result returned";

  if (resultLine) {
    status = resultLine.includes("PASS") ? "pass" : "fail";
    const dashIdx = resultLine.search(/[—–-]/);
    actual = dashIdx !== -1 ? resultLine.slice(dashIdx + 1).trim() : resultLine.replace(/RESULT:\s*(PASS|FAIL)\s*/, "").trim();
  } else {
    const lower = message.toLowerCase();
    const hasFail = lower.includes("fail") || lower.includes("does not match") ||
      lower.includes("instead") || lower.includes("not present") ||
      lower.includes("not found") || lower.includes("no error") ||
      lower.includes("nothing") || (!agentResult.success && message.length > 0);
    status = hasFail ? "fail" : "pass";
    const sentences = message.split(/[.\n]/);
    const relevant = sentences.find((s: string) =>
      /\b(saw|found|shows|labeled|says|reads|appears|instead|displayed)\b/i.test(s)
    );
    actual = relevant?.trim() || message.slice(0, 300).trim() || "No details returned";
  }

  return { name: check.name, status, expected: check.expect.trim(), actual, screenshot: sc };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();
  const runId = new Date().toISOString();
  const reportsDir = "./reports";
  const args = parseArgs();
  const model = detectModel();

  let label: string;
  let targetUrl: string;
  let source: string;
  let headless: boolean;
  let maxSteps: number;
  let authSession: string | undefined;
  let suite: Suite | undefined;

  if (args.mode === "doc") {
    if (!fs.existsSync(args.docPath)) throw new Error(`Doc file not found: ${args.docPath}`);
    label = path.basename(args.docPath, path.extname(args.docPath));
    targetUrl = args.targetUrl;
    source = args.docPath;
    headless = args.headless;
    maxSteps = args.maxSteps;
    authSession = args.authSession;
  } else {
    if (!fs.existsSync(args.suitePath)) throw new Error(`Suite file not found: ${args.suitePath}`);
    const raw = yaml.load(fs.readFileSync(args.suitePath, "utf-8"));
    const parsed = SuiteSchema.safeParse(raw);
    if (!parsed.success) throw new Error(`Invalid suite file:\n${parsed.error.toString()}`);
    suite = parsed.data;
    label = suite.suite;
    targetUrl = suite.target_url;
    source = args.suitePath;
    headless = suite.headless;
    maxSteps = suite.max_steps;
    authSession = suite.auth_session;
  }

  // Header
  console.log("═══════════════════════════════════════════");
  console.log(`  ${label}`);
  console.log("═══════════════════════════════════════════");
  console.log(`  Mode:    ${args.mode === "doc" ? "doc (autonomous)" : "suite"}`);
  console.log(`  Target:  ${targetUrl}`);
  console.log(`  Source:  ${source}`);
  console.log(`  Model:   ${model}`);
  if (args.mode === "suite" && suite) console.log(`  Checks:  ${suite.checks.length}`);
  console.log(`  Auth:    ${authSession ?? "none"}\n`);

  // Health check
  process.stdout.write("[health] Checking target... ");
  await healthCheck(targetUrl);
  console.log("✓\n");

  const stagehand = await initStagehand(model, headless, authSession);

  let checkResults: CheckResult[] = [];

  try {
    if (args.mode === "doc") {
      console.log("[agent] Reading document and verifying UI autonomously...\n");
      checkResults = await runDocMode(stagehand, args.docPath, targetUrl, maxSteps, reportsDir);
    } else if (suite) {
      for (let i = 0; i < suite.checks.length; i++) {
        const check = suite.checks[i];
        process.stdout.write(`  [${i + 1}/${suite.checks.length}] ${check.name} ... `);
        const result = await runSuiteCheck(stagehand, check, targetUrl, maxSteps, reportsDir);
        checkResults.push(result);
        const icon = result.status === "pass" ? "✓" : result.status === "error" ? "!" : "✗";
        console.log(icon);
        if (result.status !== "pass") {
          console.log(`        expected: ${result.expected.split("\n")[0].trim()}`);
          console.log(`        actual:   ${result.actual}`);
        }
      }
    }
  } finally {
    await stagehand.close().catch(() => {});
  }

  // Metrics & report
  const { prompt, completion } = collectMetrics(stagehand);
  const duration = Date.now() - startTime;
  const passed = checkResults.filter((r) => r.status === "pass").length;
  const failed = checkResults.filter((r) => r.status !== "pass").length;
  const overall: "pass" | "fail" | "error" =
    checkResults.some((r) => r.status === "error") ? "error" : failed > 0 ? "fail" : "pass";

  // Print doc-mode findings inline
  if (args.mode === "doc") {
    for (const r of checkResults) {
      const icon = r.status === "pass" ? "✓" : "✗";
      console.log(`  ${icon} ${r.name}`);
      if (r.status !== "pass") {
        console.log(`      expected: ${r.expected}`);
        console.log(`      actual:   ${r.actual}`);
      }
    }
    console.log();
  }

  const report: Report = {
    run_id: runId,
    mode: args.mode,
    label,
    target_url: targetUrl,
    source,
    overall,
    duration_ms: duration,
    token_usage: { prompt, completion, total: prompt + completion, estimated_cost_usd: estimateCost(prompt, completion) },
    checks: checkResults,
  };

  ensureDir(reportsDir);
  const reportPath = path.join(reportsDir, `report-${runId.replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log("───────────────────────────────────────────");
  console.log(`  ${overall.toUpperCase()}  ·  ${checkResults.length} findings  ·  ${passed} passed  ·  ${failed} failed`);
  console.log(`  ${(duration / 1000).toFixed(1)}s  ·  $${estimateCost(prompt, completion).toFixed(4)}`);
  console.log(`  Report: ${reportPath}`);
  console.log("═══════════════════════════════════════════\n");

  process.exit(overall === "pass" ? 0 : overall === "fail" ? 1 : 2);
}

main().catch((err) => {
  console.error("\nFatal error:", err instanceof Error ? err.message : err);
  process.exit(2);
});
