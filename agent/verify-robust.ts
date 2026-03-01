import dotenv from "dotenv";
dotenv.config();

import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

// ─── Configuration ────────────────────────────────────────────────────────────
const CONFIG = {
  targetUrl: process.env.TARGET_URL || "http://localhost:5173",
  specPath: "./specs/dashboard.md",
  screenshotDir: "./screenshots",
  maxRetries: 3,
  navigationTimeout: 10000,
  models: [
    process.env.OPENAI_API_KEY ? "openai/gpt-4o" : null,
    process.env.ANTHROPIC_API_KEY ? "anthropic/claude-sonnet-4-5-20250929" : null,
  ].filter(Boolean) as string[],
};

// ─── Schemas ──────────────────────────────────────────────────────────────────
const VerificationItem = z.object({
  requirement: z.string().describe("The exact requirement from the spec"),
  expected: z.string().describe("What the spec says should happen"),
  actual: z.string().describe("What the UI actually showed"),
  passed: z.boolean().describe("Whether this requirement passed"),
});

const VerificationReport = z.object({
  overall_pass: z.boolean(),
  total_requirements: z.number(),
  passed_count: z.number(),
  failed_count: z.number(),
  items: z.array(VerificationItem),
  summary: z.string(),
  timestamp: z.string(),
});

type VerificationReport = z.infer<typeof VerificationReport>;

// ─── Helper Functions ─────────────────────────────────────────────────────────
async function waitForApp(url: string, maxAttempts = 5): Promise<boolean> {
  console.log(`[health] Checking if ${url} is ready...`);
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (response.ok || response.status === 304) {
        console.log(`[health] ✓ App is ready`);
        return true;
      }
    } catch (err) {
      console.log(`[health] Attempt ${i + 1}/${maxAttempts} failed, retrying...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.error(`[health] ✗ App not responding after ${maxAttempts} attempts`);
  return false;
}

async function ensureDir(dir: string): Promise<void> {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function saveScreenshot(page: any, name: string): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${timestamp}_${name}.png`;
  const filepath = path.join(CONFIG.screenshotDir, filename);
  
  await ensureDir(CONFIG.screenshotDir);
  await page.screenshot({ path: filepath, fullPage: true });
  
  console.log(`[screenshot] Saved: ${filepath}`);
  return filepath;
}

async function retryOperation<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries = CONFIG.maxRetries
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[retry] ${operationName} - attempt ${attempt}/${maxRetries}`);
      return await operation();
    } catch (err) {
      lastError = err as Error;
      console.warn(`[retry] ${operationName} failed:`, err instanceof Error ? err.message : err);
      
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`[retry] Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw new Error(`${operationName} failed after ${maxRetries} attempts: ${lastError?.message}`);
}

// ─── Parse Spec into Requirements ────────────────────────────────────────────
interface Requirement {
  section: string;
  description: string;
  expected: string;
}

function parseSpec(specText: string): Requirement[] {
  const requirements: Requirement[] = [];
  const lines = specText.split('\n');
  let currentSection = '';
  
  for (const line of lines) {
    // Track sections
    if (line.startsWith('## ')) {
      currentSection = line.replace('## ', '').trim();
    }
    
    // Parse requirements from list items and numbered steps
    if (line.match(/^[-\d].+/)) {
      const cleaned = line.replace(/^[-\d]+\.?\s*/, '').trim();
      
      // Extract quoted text as expected values
      const quotes = cleaned.match(/"([^"]+)"/g);
      const expected = quotes ? quotes.map(q => q.replace(/"/g, '')).join(', ') : cleaned;
      
      requirements.push({
        section: currentSection,
        description: cleaned,
        expected: expected,
      });
    }
  }
  
  console.log(`[spec] Parsed ${requirements.length} requirements from spec`);
  return requirements;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  UI DRIFT DETECTOR - ROBUST VERSION");
  console.log("═══════════════════════════════════════════\n");
  
  // Validate configuration
  if (CONFIG.models.length === 0) {
    throw new Error("No API keys found. Set OPENAI_API_KEY or ANTHROPIC_API_KEY in .env");
  }
  console.log(`[config] Using model: ${CONFIG.models[0]}`);
  console.log(`[config] Target URL: ${CONFIG.targetUrl}`);
  console.log(`[config] Spec path: ${CONFIG.specPath}\n`);
  
  // Load and parse spec
  const spec = fs.readFileSync(CONFIG.specPath, "utf-8");
  const requirements = parseSpec(spec);
  
  // Wait for target app to be ready
  const appReady = await waitForApp(CONFIG.targetUrl);
  if (!appReady) {
    throw new Error("Target application is not responding. Start it with: npm run app");
  }
  
  // Initialize Stagehand
  console.log("\n[stagehand] Initializing...");
  const stagehand = new Stagehand({
    env: "LOCAL",
    model: CONFIG.models[0],
    localBrowserLaunchOptions: {
      headless: false,
    },
    verbose: 1,
    domSettleTimeout: 5000,
  });

  await stagehand.init();
  const page = stagehand.context.pages()[0];
  
  try {
    // Navigate with retry
    await retryOperation(
      async () => {
        await page.goto(CONFIG.targetUrl, { 
          waitUntil: 'networkidle',
          timeout: CONFIG.navigationTimeout 
        });
      },
      "Navigation to target app"
    );
    
    await saveScreenshot(page, "01-initial-load");
    
    // ─── Step 1: Verify Navigation ────────────────────────────────────────────
    console.log("\n[step 1] Verifying navigation...");
    const navElements = await retryOperation(
      () => stagehand.observe("Find all navigation links in the top nav bar"),
      "Observe navigation"
    );
    
    console.log(`[step 1] Found ${navElements.length} nav elements:`, 
      navElements.map(e => e.description));
    
    // ─── Step 2: Navigate to Settings ─────────────────────────────────────────
    console.log("\n[step 2] Navigating to Settings page...");
    await retryOperation(
      () => stagehand.act("click the link in the navigation that goes to Settings or Config page"),
      "Navigate to Settings"
    );
    
    await page.waitForTimeout(1000); // Let page settle
    await saveScreenshot(page, "02-settings-page");
    
    // ─── Step 3: Extract Page State ───────────────────────────────────────────
    console.log("\n[step 3] Extracting page state...");
    const settingsState = await retryOperation(
      () => stagehand.extract(
        "Extract all sections, labels, and button text from this page",
        z.object({
          page_title: z.string(),
          navigation_links: z.array(z.string()),
          sections: z.array(z.object({
            heading: z.string(),
            toggle_label: z.string().optional(),
            button_label: z.string().optional(),
          })),
        })
      ),
      "Extract page state"
    );
    
    console.log("[step 3] Page state:", JSON.stringify(settingsState, null, 2));
    
    // ─── Step 4: Test Toggle Interaction ──────────────────────────────────────
    console.log("\n[step 4] Testing analytics toggle...");
    await retryOperation(
      () => stagehand.act("click the checkbox in the Analytics section"),
      "Click analytics toggle"
    );
    
    await page.waitForTimeout(1000); // Wait for toast
    await saveScreenshot(page, "03-after-toggle");
    
    const toastText = await retryOperation(
      () => stagehand.extract(
        "Extract any confirmation message or toast that appeared",
        z.object({
          message: z.string().optional(),
        })
      ),
      "Extract toast message"
    );
    
    console.log("[step 4] Toast text:", toastText);
    
    // ─── Step 5: Run Agent Verification ───────────────────────────────────────
    console.log("\n[step 5] Running full agent verification...");
    
    // Navigate back to home first
    await page.goto(CONFIG.targetUrl);
    await page.waitForTimeout(500);
    
    const agent = stagehand.agent({
      model: CONFIG.models[0],
      systemPrompt:
        "You are a QA automation engineer. Compare the UI against the specification. " +
        "For each requirement, state exactly what you found and whether it matches. " +
        "Quote labels and text exactly as they appear.",
      mode: "dom",
    });

    const agentResult = await agent.execute({
      instruction: `
        Verify this UI against the specification below.
        
        SPECIFICATION:
        ${spec}
        
        For EACH requirement in the spec:
        1. Navigate to the relevant page/section
        2. Check if the UI matches what the spec describes
        3. Record exact quotes of what you see vs. what was expected
        4. Mark as pass or fail
        
        Be thorough and check every single requirement.
      `,
      maxSteps: 30,
    });

    console.log("[step 5] Agent completed:", agentResult.completed);
    console.log("[step 5] Success:", agentResult.success);
    console.log("[step 5] Actions:", agentResult.actions.length);
    
    await saveScreenshot(page, "04-final-state");
    
    // ─── Step 6: Manual Verification against Parsed Requirements ──────────────
    console.log("\n[step 6] Comparing against parsed requirements...");
    
    const verificationItems: z.infer<typeof VerificationItem>[] = [];
    
    // Check nav link
    const navReq = requirements.find(r => r.description.includes('Settings'));
    if (navReq) {
      const hasSettingsLink = settingsState.navigation_links?.some(link => 
        link.toLowerCase().includes('settings')
      );
      verificationItems.push({
        requirement: navReq.description,
        expected: "Settings",
        actual: hasSettingsLink ? "Settings found" : "Settings NOT found (found: " + 
          settingsState.navigation_links?.join(', ') + ")",
        passed: hasSettingsLink,
      });
    }
    
    // Check analytics toggle label
    const analyticsSection = settingsState.sections?.find(s => 
      s.heading?.toLowerCase().includes('analytics')
    );
    const analyticsReq = requirements.find(r => r.expected.includes('Enable Analytics'));
    if (analyticsReq && analyticsSection) {
      const passed = analyticsSection.toggle_label === 'Enable Analytics';
      verificationItems.push({
        requirement: analyticsReq.description,
        expected: "Enable Analytics",
        actual: analyticsSection.toggle_label || "NO LABEL FOUND",
        passed,
      });
    }
    
    // Check toast message
    const toastReq = requirements.find(r => r.expected.includes('Analytics enabled successfully'));
    if (toastReq) {
      const passed = toastText.message === 'Analytics enabled successfully.';
      verificationItems.push({
        requirement: toastReq.description,
        expected: "Analytics enabled successfully.",
        actual: toastText.message || "NO MESSAGE",
        passed,
      });
    }
    
    const passedCount = verificationItems.filter(item => item.passed).length;
    const failedCount = verificationItems.filter(item => !item.passed).length;
    
    const report: VerificationReport = {
      overall_pass: failedCount === 0,
      total_requirements: verificationItems.length,
      passed_count: passedCount,
      failed_count: failedCount,
      items: verificationItems,
      summary: agentResult.message || "Verification complete",
      timestamp: new Date().toISOString(),
    };
    
    // ─── Print Report ──────────────────────────────────────────────────────────
    console.log("\n");
    console.log("═══════════════════════════════════════════");
    console.log("  VERIFICATION REPORT");
    console.log("═══════════════════════════════════════════");
    console.log(`  Overall: ${report.overall_pass ? "✓ PASS" : "✗ FAIL"}`);
    console.log(`  Requirements: ${report.total_requirements}`);
    console.log(`  Passed: ${report.passed_count}`);
    console.log(`  Failed: ${report.failed_count}`);
    console.log("─────────────────────────────────────────");
    
    report.items.forEach((item, idx) => {
      const icon = item.passed ? "✓" : "✗";
      console.log(`\n  ${icon} Requirement ${idx + 1}:`);
      console.log(`     ${item.requirement}`);
      if (!item.passed) {
        console.log(`     Expected: "${item.expected}"`);
        console.log(`     Actual:   "${item.actual}"`);
      }
    });
    
    console.log("\n─────────────────────────────────────────");
    console.log("  Summary:");
    console.log(`  ${report.summary}`);
    console.log("═══════════════════════════════════════════\n");
    
    // Save report
    const reportPath = path.join(CONFIG.screenshotDir, `report-${report.timestamp.replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`[report] Saved to: ${reportPath}\n`);
    
    // Metrics
    const metrics = await stagehand.metrics;
    console.log(`[metrics] Total tokens: ${metrics.totalPromptTokens + metrics.totalCompletionTokens}`);
    console.log(`[metrics] Inference time: ${metrics.totalInferenceTimeMs}ms`);
    console.log(`[metrics] Screenshots: ${CONFIG.screenshotDir}/\n`);
    
    // Exit code based on results
    process.exit(report.overall_pass ? 0 : 1);
    
  } catch (error) {
    console.error("\n[error] Verification failed:", error);
    await saveScreenshot(page, "error-state").catch(() => {});
    throw error;
  } finally {
    await stagehand.close();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
