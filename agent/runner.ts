/**
 * Documentation Drift Detector - Unified Runner
 * 
 * Single entry point for running documentation verification against any staging environment.
 * Replaces verify.ts and verify-robust.ts with a clean, config-driven approach.
 * 
 * Usage:
 *   npm run verify
 * 
 * Configuration via environment variables:
 *   TARGET_URL          - The staging URL to test (required)
 *   SPEC_PATH           - Path to the specification file (required)
 *   AUTH_SESSION_PATH   - Path to saved Playwright session (optional)
 *   HEADLESS            - Run browser in headless mode (default: true)
 *   MAX_STEPS           - Agent step budget (default: 30)
 *   REPORTS_DIR         - Where to save JSON reports (default: ./reports)
 */

import dotenv from "dotenv";
dotenv.config();

import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import { chromium } from "playwright";

// ─── Configuration ────────────────────────────────────────────────────────────
const CONFIG = {
  targetUrl: process.env.TARGET_URL || "http://localhost:5173",
  specPath: process.env.SPEC_PATH || "./specs/dashboard.md",
  authSessionPath: process.env.AUTH_SESSION_PATH,
  headless: process.env.HEADLESS !== "false", // Default true unless explicitly set to "false"
  maxSteps: parseInt(process.env.MAX_STEPS || "30"),
  reportsDir: process.env.REPORTS_DIR || "./reports",
  model: process.env.OPENAI_API_KEY ? "openai/gpt-4o" : 
         process.env.ANTHROPIC_API_KEY ? "anthropic/claude-sonnet-4-5-20250929" : null,
};

// ─── Output Schema ────────────────────────────────────────────────────────────
const Finding = z.object({
  requirement: z.string().describe("What the spec says"),
  status: z.enum(["pass", "fail", "skip"]),
  actual: z.string().describe("What the UI showed"),
  screenshot: z.string().optional().describe("Screenshot path if captured"),
});

const RunReport = z.object({
  run_id: z.string(),
  target_url: z.string(),
  spec_path: z.string(),
  overall: z.enum(["pass", "fail", "error"]),
  duration_ms: z.number(),
  token_usage: z.object({
    prompt: z.number(),
    completion: z.number(),
    total: z.number(),
    estimated_cost_usd: z.number(),
  }),
  findings: z.array(Finding),
  agent_summary: z.string(),
  error: z.string().optional(),
});

type RunReport = z.infer<typeof RunReport>;
type Finding = z.infer<typeof Finding>;

// ─── Helper Functions ─────────────────────────────────────────────────────────
function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function estimateCost(promptTokens: number, completionTokens: number): number {
  // GPT-4o pricing: $2.50/1M input, $10/1M output
  const inputCost = (promptTokens / 1_000_000) * 2.50;
  const outputCost = (completionTokens / 1_000_000) * 10.00;
  return inputCost + outputCost;
}

async function saveScreenshot(page: any, name: string, reportsDir: string): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${timestamp}_${name}.png`;
  const filepath = path.join(reportsDir, filename);
  
  ensureDir(reportsDir);
  await page.screenshot({ path: filepath, fullPage: true });
  
  return filepath;
}

async function waitForApp(url: string, maxAttempts = 5): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (response.ok || response.status === 304) {
        return true;
      }
    } catch (err) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  return false;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const startTime = Date.now();
  const runId = new Date().toISOString();
  
  console.log("═══════════════════════════════════════════");
  console.log("  DOCUMENTATION DRIFT DETECTOR");
  console.log("═══════════════════════════════════════════\n");
  
  // Validate config
  if (!CONFIG.model) {
    throw new Error("No API key found. Set OPENAI_API_KEY or ANTHROPIC_API_KEY in .env");
  }
  
  if (!fs.existsSync(CONFIG.specPath)) {
    throw new Error(`Spec file not found: ${CONFIG.specPath}`);
  }
  
  console.log(`[config] Target:   ${CONFIG.targetUrl}`);
  console.log(`[config] Spec:     ${CONFIG.specPath}`);
  console.log(`[config] Auth:     ${CONFIG.authSessionPath || "none (public app)"}`);
  console.log(`[config] Headless: ${CONFIG.headless}`);
  console.log(`[config] Model:    ${CONFIG.model}`);
  console.log(`[config] Max steps: ${CONFIG.maxSteps}\n`);
  
  // Load spec
  const spec = fs.readFileSync(CONFIG.specPath, "utf-8");
  console.log(`[spec] Loaded specification (${spec.length} characters)\n`);
  
  // Check if app is reachable
  console.log("[health] Checking if target is reachable...");
  const appReady = await waitForApp(CONFIG.targetUrl);
  if (!appReady) {
    throw new Error(`Target not responding: ${CONFIG.targetUrl}`);
  }
  console.log("[health] ✓ Target is reachable\n");
  
  // Initialize Stagehand
  console.log("[stagehand] Initializing...");
  
  // Check if we need to load auth session
  let storageState: any = undefined;
  if (CONFIG.authSessionPath && fs.existsSync(CONFIG.authSessionPath)) {
    console.log(`[auth] Loading session from ${CONFIG.authSessionPath}`);
    storageState = JSON.parse(fs.readFileSync(CONFIG.authSessionPath, "utf-8"));
  }
  
  const stagehand = new Stagehand({
    env: "LOCAL",
    model: CONFIG.model,
    localBrowserLaunchOptions: {
      headless: CONFIG.headless,
    },
    verbose: CONFIG.headless ? 0 : 1,
  });

  await stagehand.init();
  
  // If we have a saved session, we need to apply it to the context
  // Stagehand doesn't directly support storageState, so we'll reload context if needed
  let page: any;
  if (storageState) {
    // Close the default context and create a new one with auth
    await stagehand.close();
    
    const browser = await chromium.launch({
      headless: CONFIG.headless,
      channel: "chrome",
    });
    
    const context = await browser.newContext({
      storageState: CONFIG.authSessionPath,
    });
    
    page = await context.newPage();
    console.log("[auth] ✓ Session loaded\n");
  } else {
    page = stagehand.context.pages()[0];
  }
  
  let report: RunReport;
  
  try {
    // Navigate to target
    console.log(`[navigate] Going to ${CONFIG.targetUrl}...`);
    await page.goto(CONFIG.targetUrl, { 
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    
    // Wait for React/SPA to hydrate
    await page.waitForTimeout(2000);
    console.log("[navigate] ✓ Page loaded\n");
    
    // Save initial screenshot
    const screenshotPath = await saveScreenshot(page, "initial-state", CONFIG.reportsDir);
    console.log(`[screenshot] Saved: ${screenshotPath}\n`);
    
    // Run agent verification
    console.log("[agent] Starting verification pass...\n");
    
    const agent = stagehand.agent({
      model: CONFIG.model,
      systemPrompt:
        "You are a documentation QA agent. Your job is to verify whether a live UI " +
        "matches a product specification exactly. " +
        "RULES: " +
        "- Quote UI text exactly as it appears. Never paraphrase. " +
        "- For every requirement you check, record: what the spec says, what you saw, and whether they match. " +
        "- If you cannot find a UI element the spec mentions, that is a FAIL. " +
        "- Do not invent requirements that are not in the spec. " +
        "- Navigate to every page mentioned in the spec before concluding.",
      mode: "dom",
    });

    const agentResult = await agent.execute({
      instruction: `
        You are verifying whether this UI matches the following product specification.
        
        SPECIFICATION:
        ---
        ${spec}
        ---
        
        For EACH requirement in the specification:
        1. Navigate to the relevant page/section
        2. Check if the UI matches what the spec describes
        3. Quote exactly what you see vs. what was expected
        4. Mark as pass or fail
        
        When done, summarize every requirement you checked with pass/fail and exact quotes.
        
        The application is already loaded at: ${CONFIG.targetUrl}
      `,
      maxSteps: CONFIG.maxSteps,
    });

    console.log(`\n[agent] Completed: ${agentResult.completed}`);
    console.log(`[agent] Success: ${agentResult.success}`);
    console.log(`[agent] Actions taken: ${agentResult.actions.length}\n`);
    
    // Parse findings from agent message
    // This is a simple heuristic - in production you'd use the output parameter
    const findings: Finding[] = [];
    const lines = agentResult.message?.split('\n') || [];
    
    for (const line of lines) {
      if (line.includes('FAIL') || line.includes('✗') || line.includes('does not match')) {
        findings.push({
          requirement: line.trim(),
          status: "fail",
          actual: "See agent summary",
        });
      } else if (line.includes('PASS') || line.includes('✓') || line.includes('matches')) {
        findings.push({
          requirement: line.trim(),
          status: "pass",
          actual: "Matches specification",
        });
      }
    }
    
    // Get metrics
    const metrics = await stagehand.metrics;
    const duration = Date.now() - startTime;
    
    report = {
      run_id: runId,
      target_url: CONFIG.targetUrl,
      spec_path: CONFIG.specPath,
      overall: agentResult.success ? "pass" : "fail",
      duration_ms: duration,
      token_usage: {
        prompt: metrics.totalPromptTokens,
        completion: metrics.totalCompletionTokens,
        total: metrics.totalPromptTokens + metrics.totalCompletionTokens,
        estimated_cost_usd: estimateCost(metrics.totalPromptTokens, metrics.totalCompletionTokens),
      },
      findings,
      agent_summary: agentResult.message || "No summary provided",
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    report = {
      run_id: runId,
      target_url: CONFIG.targetUrl,
      spec_path: CONFIG.specPath,
      overall: "error",
      duration_ms: duration,
      token_usage: {
        prompt: 0,
        completion: 0,
        total: 0,
        estimated_cost_usd: 0,
      },
      findings: [],
      agent_summary: "",
      error: errorMessage,
    };
  } finally {
    await stagehand.close().catch(() => {});
  }
  
  // Save report
  ensureDir(CONFIG.reportsDir);
  const reportFilename = `report-${runId.replace(/[:.]/g, '-')}.json`;
  const reportPath = path.join(CONFIG.reportsDir, reportFilename);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  // Print report
  console.log("\n");
  console.log("═══════════════════════════════════════════");
  console.log("  VERIFICATION REPORT");
  console.log("═══════════════════════════════════════════");
  console.log(`  Status: ${report.overall.toUpperCase()}`);
  console.log(`  Duration: ${(report.duration_ms / 1000).toFixed(1)}s`);
  console.log(`  Tokens: ${report.token_usage.total.toLocaleString()}`);
  console.log(`  Cost: $${report.token_usage.estimated_cost_usd.toFixed(4)}`);
  console.log("─────────────────────────────────────────\n");
  
  if (report.error) {
    console.log(`  ERROR: ${report.error}\n`);
  } else {
    console.log("  Agent Summary:");
    console.log(`  ${report.agent_summary}\n`);
    
    if (report.findings.length > 0) {
      console.log("  Findings:");
      report.findings.forEach((f, idx) => {
        const icon = f.status === "pass" ? "✓" : f.status === "fail" ? "✗" : "⊙";
        console.log(`  ${icon} ${f.requirement.substring(0, 80)}${f.requirement.length > 80 ? '...' : ''}`);
      });
      console.log();
    }
  }
  
  console.log("─────────────────────────────────────────");
  console.log(`  Report saved: ${reportPath}`);
  console.log("═══════════════════════════════════════════\n");
  
  // Exit codes: 0 = pass, 1 = drift detected, 2 = error
  const exitCode = report.overall === "pass" ? 0 : report.overall === "fail" ? 1 : 2;
  process.exit(exitCode);
}

main().catch((err) => {
  console.error("\nFatal error:", err);
  process.exit(2);
});
