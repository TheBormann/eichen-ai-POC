import dotenv from "dotenv";
dotenv.config();

import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import * as fs from "fs";

// ─── 1. Define the output schema ──────────────────────────────────────────────
// Using a Zod schema means we get typed, structured output — not free-form text.
// The agent will populate these fields based on what it finds in the UI.
const VerificationReport = z.object({
  overall_pass: z
    .boolean()
    .describe("true if the UI matches the spec in every checked area, false if any discrepancy was found"),
  checked_items: z
    .array(
      z.object({
        spec_requirement: z.string().describe("The exact requirement from the spec"),
        ui_actual: z.string().describe("What the UI actually showed or did"),
        passed: z.boolean().describe("Whether the UI matched the spec requirement"),
      })
    )
    .describe("A line-by-line comparison of each spec requirement against the UI"),
  summary: z
    .string()
    .describe("A one-paragraph human-readable summary of the verification result"),
});

type VerificationReport = z.infer<typeof VerificationReport>;

// ─── 2. Main ──────────────────────────────────────────────────────────────────
async function main() {
  // Load the spec
  const spec = fs.readFileSync("./specs/dashboard.md", "utf-8");

  // Initialise Stagehand in LOCAL mode (no Browserbase account needed)
  const stagehand = new Stagehand({
    env: "LOCAL",
    // Pick one. "openai/gpt-4o" is reliable; "anthropic/claude-sonnet-4-5-20250929"
    // is excellent but may cost slightly more per run.
    model: "openai/gpt-4o",
    // headless: false means the browser window is VISIBLE during the demo.
    // Set to true if you just want terminal output without a visible browser.
    localBrowserLaunchOptions: {
      headless: false,
    },
    verbose: 1, // 0 = quiet, 1 = normal, 2 = debug
  });

  await stagehand.init();

  // In v3 the page is accessed via context, not stagehand.page
  const page = stagehand.context.pages()[0];

  try {
    // Navigate to the dummy app
    await page.goto("http://localhost:5173");

    // ─── Step A: Use `observe` to sanity-check the nav before the agent runs ──
    // This is a deterministic guard — if the nav is completely broken we know
    // immediately before burning agent tokens.
    const navElements = await stagehand.observe("Find all navigation links in the top nav bar");
    console.log("\n[observe] Nav elements found:", navElements.map((e) => e.description));

    // ─── Step B: Use `act` for the specific deterministic steps ───────────────
    // These are single, targeted actions. We don't need the agent for these.
    // act() is cheaper and more reliable than agent() for known, simple steps.
    await stagehand.act("click the link that leads to the Settings page");

    // ─── Step C: Use `extract` to pull the current state of the Settings page ─
    // We read what is actually on the page before asking the agent to verify.
    const settingsState = await stagehand.extract(
      "Extract the current state of the Settings page",
      z.object({
        page_title: z.string().describe("The h1 heading on the page"),
        sections: z.array(
          z.object({
            heading: z.string().describe("Section h2 heading"),
            toggle_label: z.string().optional().describe("Label of any checkbox/toggle in this section"),
            button_label: z.string().optional().describe("Label of any button in this section"),
          })
        ),
      })
    );
    console.log("\n[extract] Settings page state:", JSON.stringify(settingsState, null, 2));

    // ─── Step D: Interact with the toggle and capture the toast ───────────────
    await stagehand.act("click the checkbox or toggle in the Analytics section");

    const toastText = await stagehand.extract(
      "Extract the confirmation message or toast that appeared after clicking the toggle",
      z.object({
        message: z.string().optional().describe("The confirmation text shown, if any"),
      })
    );
    console.log("\n[extract] Toast/confirmation:", toastText);

    // ─── Step E: Agent-level verification pass ────────────────────────────────
    // Now we hand the full spec to the agent and ask it to produce a structured
    // report. It has full autonomy to look around the page.
    // NOTE: agent() returns an AgentInstance. You call .execute() on it.
    const agent = stagehand.agent({
      model: "openai/gpt-4o",
      systemPrompt:
        "You are a meticulous QA engineer. You check UIs against product specifications " +
        "and report every discrepancy precisely. You never make assumptions — if a label " +
        "is wrong, you quote exactly what the UI says and exactly what the spec says.",
      mode: "dom", // "dom" is the default; works with any model and is most reliable
    });

    const agentResult = await agent.execute({
      instruction: `
        You are verifying whether this UI matches the following product specification.
        
        SPECIFICATION:
        ---
        ${spec}
        ---
        
        Instructions:
        1. Navigate around the app as needed to check every requirement in the spec.
        2. For each requirement, record what the spec says, what the UI actually shows, 
           and whether they match.
        3. Be exact when quoting labels, button text, and messages. Do not paraphrase.
        4. When you are done checking all requirements, call the task complete.
        
        The app is already open at http://localhost:5173.
      `,
      maxSteps: 25,
      // Structured output via Zod schema (requires experimental: true in constructor
      // if using the output param; here we extract separately below for stability)
    });

    console.log("\n[agent] Raw result:", agentResult.message);
    console.log("[agent] Completed:", agentResult.completed);
    console.log("[agent] Actions taken:", agentResult.actions.length);

    // ─── Step F: Parse agent actions into a structured report ─────────────────
    // For this POC, we'll display the agent's findings from its action log.
    // In production, use the `output` parameter in agent.execute() with a Zod schema.
    console.log("\n");
    console.log("═══════════════════════════════════════════");
    console.log("  VERIFICATION REPORT");
    console.log("═══════════════════════════════════════════");
    console.log(`  Agent Status: ${agentResult.completed ? "✓ COMPLETED" : "⚠ INCOMPLETE"}`);
    console.log(`  Success: ${agentResult.success ? "✓ PASS" : "✗ FAIL"}`);
    console.log("─────────────────────────────────────────");
    console.log("\n  Agent Message:");
    console.log(`  ${agentResult.message}`);
    console.log("\n─────────────────────────────────────────");
    console.log("  Actions Taken:");
    agentResult.actions.forEach((action, idx) => {
      console.log(`\n  ${idx + 1}. ${action.type}`);
      if (action.instruction) console.log(`     Instruction: ${action.instruction}`);
      if (action.reasoning) console.log(`     Reasoning: ${action.reasoning}`);
    });
    console.log("\n═══════════════════════════════════════════\n");

    // Cost tracking (useful to show in demos)
    const metrics = await stagehand.metrics;
    console.log(
      `[metrics] Total tokens: ${metrics.totalPromptTokens + metrics.totalCompletionTokens}`
    );
    console.log(`[metrics] Inference time: ${metrics.totalInferenceTimeMs}ms`);
  } finally {
    // Always close — even if an error was thrown
    await stagehand.close();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
