# POC Technical Outline

**Stack:** TypeScript · Stagehand v3 · React/Vite (dummy target)  
**Goal:** Prove an AI agent can detect drift between a human-written spec and a live UI

---

## What We Are Building

A command-line script that:

1. Reads a plain-text product specification from a local `.md` file
2. Opens a locally-running React app in a real Chrome browser
3. Executes every documented workflow using an AI agent
4. Reports exactly where the UI deviates from the spec

That is the entire scope. One script, one spec, one app, one report.

---

## How Stagehand v3 Works

Stagehand wraps Playwright with four AI primitives:

| Primitive | Purpose | When to use |
|---|---|---|
| `act()` | Execute a single natural-language action | Known, single steps |
| `extract()` | Pull typed structured data from the page | Reading state at a specific moment |
| `observe()` | Discover interactive elements on the page | Pre-flight checks, unknown pages |
| `agent()` | Autonomous multi-step reasoning | Full spec verification pass |

**Critical v3 API rule:** `act()`, `extract()`, and `observe()` are called on the **`stagehand` instance**. The **`page` object** is for standard Playwright navigation only.

```typescript
// Correct
const page = stagehand.context.pages()[0];
await page.goto("http://localhost:5173");          // Playwright — navigation
await stagehand.act("click the Settings button"); // Stagehand — AI action

// Wrong — will throw
await page.act("click the Settings button");
```

**Agent instantiation is two steps:**

```typescript
// Correct — agent() returns an instance, execute() runs the task
const agent = stagehand.agent({ model: "openai/gpt-4o", mode: "dom" });
const result = await agent.execute({ instruction: "...", maxSteps: 25 });

// Wrong — agent() does not accept an instruction directly
await stagehand.agent({ instruction: "..." });
```

---

## Repository Layout

```
eichen-ai-POC/
├── agent/
│   ├── verify.ts              # Demo script
│   ├── verify-robust.ts       # Production-grade script
│   ├── test-runner.ts         # End-to-end test harness
│   └── validate-structure.ts  # Code structure validator (no app needed)
├── specs/
│   └── dashboard.md           # Product spec — the agent's ground truth
├── target-app/                # Dummy React app with 4 intentional bugs
│   └── src/
│       ├── App.tsx            # Nav bug
│       └── pages/
│           ├── Dashboard.tsx
│           └── Settings.tsx   # Toggle, toast, validation bugs
├── docs/
│   ├── poc-outline.md         # This file
│   ├── MVP-PLAN.md            # What this becomes after the POC
│   ├── ROBUSTNESS.md          # verify-robust.ts rationale
│   └── SETUP-CHECKLIST.md    # Troubleshooting
├── .env.example
├── package.json
└── tsconfig.json
```

---

## The Spec (`specs/dashboard.md`)

Written in acceptance-criteria style — specific, quoted, unambiguous. Vague specs produce vague agent output. Every checkable fact is in quotes.

The spec describes a Settings page with an Analytics toggle and a Notifications section. The target app breaks four of those requirements deliberately.

**The 4 intentional bugs:**

| Spec requirement | App reality | Bug category |
|---|---|---|
| Nav link labeled "Settings" | Nav link says "Config" | Label drift |
| Toggle labeled "Enable Analytics" | Toggle says "Enable Tracking" | Label drift |
| Toast reads "Analytics enabled successfully." | Toast says "Saved." | Copy drift |
| Error message shown on invalid save | No error shown | Missing behaviour |

---

## The Agent Script (`agent/verify.ts`)

### Dependency setup

```bash
npm install @browserbasehq/stagehand zod dotenv
npm install -D typescript tsx @types/node
```

`dotenv` is a **runtime** dependency — not dev. Stagehand does not auto-load `.env`.

### Initialisation

```typescript
import dotenv from "dotenv";
dotenv.config(); // Must be called before importing Stagehand

import { Stagehand } from "@browserbasehq/stagehand";

const stagehand = new Stagehand({
  env: "LOCAL",
  model: "openai/gpt-4o",
  localBrowserLaunchOptions: { headless: false }, // Visible — important for demos
  verbose: 1,
});

await stagehand.init();
const page = stagehand.context.pages()[0]; // v3 — not stagehand.page
```

### Verification flow

The script uses all four primitives deliberately:

**Step A — `observe()`:** Sanity-check the nav before spending agent tokens. Cheap, deterministic.

```typescript
const navElements = await stagehand.observe("Find all navigation links in the top nav bar");
console.log("[observe] Nav links found:", navElements.map(e => e.description));
```

**Step B — `act()`:** Navigate to Settings. Single known action, no need for a full agent.

```typescript
await stagehand.act("click the link that leads to the Settings page");
```

**Step C — `extract()`:** Pull the current page state into a typed object.

```typescript
const settingsState = await stagehand.extract(
  "Extract all sections, labels and button text from this page",
  z.object({
    page_title: z.string(),
    sections: z.array(z.object({
      heading: z.string(),
      toggle_label: z.string().optional(),
      button_label: z.string().optional(),
    })),
  })
);
```

**Step D — `act()` + `extract()`:** Click the toggle, then read what happened.

```typescript
await stagehand.act("click the checkbox in the Analytics section");
const toast = await stagehand.extract(
  "Extract any confirmation message that appeared",
  z.object({ message: z.string().optional() })
);
```

**Step E — `agent()`:** Full multi-step spec verification pass.

```typescript
const agent = stagehand.agent({
  model: "openai/gpt-4o",
  systemPrompt: "You are a QA engineer. Quote UI labels exactly. Never paraphrase.",
  mode: "dom",
});

const result = await agent.execute({
  instruction: `
    Verify the UI against this spec:
    ${spec}
    
    For each requirement: navigate, check, quote what you see, mark pass or fail.
  `,
  maxSteps: 25,
});
```

### Always clean up

```typescript
try {
  // ... all verification steps
} finally {
  await stagehand.close(); // Runs even if an exception is thrown
}
```

---

## Running

```bash
# Terminal 1 — target app
npm run app          # http://localhost:5173

# Terminal 2 — agent
cp .env.example .env # Add your API key
npm run verify
```

### Expected output (abridged)

```
[observe] Nav links found: ['Dashboard', 'Config', 'Help']

[extract] {
  "page_title": "Settings",
  "sections": [
    { "heading": "Analytics", "toggle_label": "Enable Tracking" },
    { "heading": "Notifications", "button_label": "Save Preferences" }
  ]
}

[extract] Toast: { "message": "Saved." }

[agent] Completed: true | Actions: 9

═══════════════════════════════════════════
  VERIFICATION REPORT
═══════════════════════════════════════════
  Agent Status: ✓ COMPLETED
  Success: ✗ FAIL

  Agent Message:
  Nav link reads "Config" not "Settings". Toggle reads "Enable Tracking"
  not "Enable Analytics". Toast reads "Saved." not "Analytics enabled
  successfully." No error appeared after clicking Save Preferences.

[metrics] Tokens: 4,821 | Time: 12.3s
```

---

## Known Limitations

| Issue | Impact | Mitigation |
|---|---|---|
| Agent non-determinism | Same script can give different results run-to-run | Use `act()` for known steps; reserve `agent()` for reasoning |
| No structured output from agent | `agentResult.message` is free text | Use `verify-robust.ts` which does programmatic comparison |
| Chrome required | `env: "LOCAL"` needs Chrome installed | Install Chrome; or switch to Browserbase for cloud runs |
| Spec quality matters | Vague spec → vague findings | Write requirements in acceptance-criteria style with exact quotes |
| `maxSteps` cap | Agent stops if spec has many requirements | Set `maxSteps: 30+` for larger specs |

---

## Out of Scope for This POC

| Feature | Why excluded |
|---|---|
| Jira / GitHub integration | Standard REST — not the hard part |
| Authentication / OAuth | Not relevant to the core thesis |
| CI/CD triggers | Infrastructure concern, not product |
| Multi-flow coverage | One flow done well beats five done poorly |
| Database / persistence | Console output is enough for this stage |
| Browserbase cloud | LOCAL keeps the dependency count minimal |

---

## Definition of Done

- [ ] `target-app` runs on `http://localhost:5173` without errors
- [ ] All 4 intentional bugs are present in the app
- [ ] `specs/dashboard.md` is written in specific, quoted acceptance-criteria style
- [ ] `npm run verify` completes and prints a report showing failures
- [ ] `npm run validate` passes all 25 structure checks
- [ ] Browser is always closed (try/finally)
- [ ] `.env` is in `.gitignore`; `.env.example` is committed
- [ ] One full run completes in under 90 seconds
