# Refactor Plan

## Is the POC Good Enough?

No. It proves the thesis. It does not come close to running against a real staging environment.

It worked against the dummy app because the dummy app was designed to make it work — we planted the bugs, wrote the spec to match our exact code structure, and ran it on localhost with no auth.

The moment you point it at a real staging URL, four things break immediately:

1. **Auth** — Every real staging environment has a login. The agent has no way in.
2. **Spec input** — The spec path is hardcoded. There is no way to pass a different spec without editing code.
3. **Brittle manual comparison** — `verify-robust.ts` hardcodes field names like `"Enable Analytics"` and `"Settings"` in the comparison logic. This only works on the dummy app.
4. **Two scripts, two configs, two output formats** — `verify.ts` and `verify-robust.ts` have drifted apart. Maintaining both is wasteful and confusing.

There is also a deeper architectural flaw: `verify-robust.ts` runs a manual `observe` → `act` → `extract` → `extract` pass *and then* runs an agent pass. This is redundant. The agent can do the full verification in one pass. The manual steps add LLM cost and complexity without adding reliability.

---

## Staging vs Production

**Always staging. Never production.**

The agent clicks things, fills forms, triggers state changes. On production that means:
- Real user data being modified
- Analytics events being fired
- Emails potentially being sent
- State changes being logged

Staging exists precisely for this purpose. If a customer doesn't have a staging environment, the conversation starts there — not with us changing what we build.

The one partial exception: **read-only verification on production** (observe + extract only, no act/agent). This is a post-MVP consideration and requires explicit user opt-in per run.

---

## What Needs to Be Rebuilt

### Delete

- `agent/verify.ts` — superseded
- `agent/verify-robust.ts` — superseded
- `agent/test-runner.ts` — depends on the above, rebuild as part of the runner
- `agent/validate-structure.ts` — useful but needs updating

### Keep

- `specs/dashboard.md` — good format, keep as the canonical example
- `target-app/` — the dummy app, no changes needed
- All docs — updated separately

### Build

A single `agent/runner.ts` that:
- Accepts config via environment variables (URL, spec path, auth strategy)
- Handles authentication via saved session state (no credentials in code)
- Runs one focused agent pass with a well-engineered prompt
- Outputs structured JSON to a `reports/` directory
- Prints a clean human-readable report to stdout
- Exits with the correct code (0 = pass, 1 = drift, 2 = error)

---

## The New Architecture

```
eichen-ai-POC/
├── agent/
│   └── runner.ts              # Single entry point, replaces both verify scripts
├── auth/
│   └── session.example.json   # Example of what a saved auth state looks like
├── specs/
│   └── dashboard.md           # The example spec
├── reports/                   # Generated at runtime, gitignored
├── target-app/                # Unchanged
└── .env.example               # Updated with all config options
```

---

## Configuration (`.env`)

Everything the runner needs is driven by environment variables. No hardcoded paths or URLs anywhere in the code.

```bash
# Required
OPENAI_API_KEY=sk-proj-...       # Or ANTHROPIC_API_KEY

# Target
TARGET_URL=https://staging.yourapp.com   # Any URL — localhost or real staging
SPEC_PATH=./specs/dashboard.md           # Path to the spec file

# Auth (optional — leave blank for public apps)
AUTH_SESSION_PATH=./auth/session.json    # Playwright storageState file

# Behaviour
HEADLESS=true                            # true for CI, false for demos
MAX_STEPS=30                             # Agent step budget
REPORTS_DIR=./reports                    # Where to write JSON reports
```

---

## Auth Strategy

The correct pattern for handling authentication without storing credentials in code is Playwright's `storageState`.

**How it works:**

1. A one-time `auth/save-session.ts` script opens the browser, lets you log in manually, then saves the cookies and localStorage to `auth/session.json`.
2. The main runner loads `session.json` at startup. The browser context already has valid cookies — no login step needed.
3. `auth/session.json` is gitignored. It never leaves the developer's machine.

This is the right pattern for two reasons:
- Credentials never touch the codebase or environment variables
- Works with any auth system (SSO, MFA, magic links) because a human does the initial login

```typescript
// In runner.ts
const context = await browser.newContext({
  storageState: process.env.AUTH_SESSION_PATH || undefined,
});
```

---

## The Agent Prompt — What's Wrong Now and How to Fix It

The current prompt dumps the entire spec into an instruction and tells the agent to "check every requirement." This is vague and produces inconsistent results.

The better approach is to give the agent a **structured task** with an **explicit output contract**:

```typescript
const instruction = `
  You are a documentation QA agent. Your job is to verify whether a live UI
  matches a product specification exactly.

  RULES:
  - Quote UI text exactly as it appears. Never paraphrase.
  - For every requirement you check, record: what the spec says, what you saw,
    and whether they match.
  - If you cannot find a UI element the spec mentions, that is a FAIL.
  - Do not invent requirements that are not in the spec.
  - Navigate to every page mentioned in the spec before concluding.

  SPECIFICATION:
  ---
  ${spec}
  ---

  When done, summarise every requirement you checked with pass/fail and exact quotes.
`;
```

The key changes from the current prompt:
- Explicit quoting rule — reduces hallucination
- "Cannot find element = FAIL" — prevents the agent from skipping missing elements
- "Do not invent requirements" — prevents the agent from checking things not in the spec
- "Navigate to every page" — ensures full coverage

---

## The Output Contract

The runner should emit a single JSON file per run with this shape:

```typescript
interface RunReport {
  run_id: string;          // ISO timestamp
  target_url: string;      // The URL that was tested
  spec_path: string;       // The spec that was used
  overall: "pass" | "fail" | "error";
  duration_ms: number;
  token_usage: {
    prompt: number;
    completion: number;
    total: number;
    estimated_cost_usd: number;
  };
  findings: Array<{
    requirement: string;   // What the spec says
    status: "pass" | "fail" | "skip";
    actual: string;        // What the UI showed
    screenshot?: string;   // Path to screenshot if captured
  }>;
  agent_summary: string;   // Agent's natural language summary
  error?: string;          // If overall === "error"
}
```

This shape is stable enough to parse in a CI pipeline, post to Slack, or store in a database.

---

## Build Order

### Step 1 — Auth helper (1 day)

Build `auth/save-session.ts`. This is a prerequisite for testing against any real staging URL.

```bash
npm run auth:save  # Opens browser, you log in, session saved to auth/session.json
```

### Step 2 — Unified runner (2 days)

Build `agent/runner.ts` with:
- Full env-var config (URL, spec path, auth, headless, maxSteps)
- Auth via `storageState`
- Single agent pass with improved prompt
- Structured JSON report output
- Clean terminal output
- Correct exit codes

Delete `verify.ts`, `verify-robust.ts`.

### Step 3 — Test against real staging (1–2 days)

Point `TARGET_URL` at a real staging environment. This reveals:
- Whether the auth session approach works for the customer's stack
- How the agent behaves on a real complex app vs the dummy
- What `maxSteps` budget is needed for real flows

This is the most important test. The dummy app tells us nothing about real-world performance.

### Step 4 — Slack output (1 day)

Add a `--notify slack` flag that posts the report to a webhook URL. The report message should include:
- Pass/fail status
- Number of drifted requirements
- The specific failures with exact quotes
- A link to the full JSON report

### Step 5 — Spec from Notion (1–2 days)

Add `SPEC_SOURCE=notion` + `NOTION_PAGE_ID` env vars. Fetch the page content via the Notion API and pass it as the spec string. The runner itself does not change — only the spec loading step.

---

## What This Is Not Yet

After this refactor, the tool is still:
- A command-line script run manually
- Pointed at one URL and one spec at a time
- Without a scheduling mechanism

That is fine. The next layer (scheduling, multi-spec, web UI) comes after a real customer has validated that a single run against their staging environment produces useful output. Do not build the platform before the tool works.

---

## Updated Definition of Done

- [ ] `npm run auth:save` works and produces `auth/session.json`
- [ ] `runner.ts` accepts `TARGET_URL`, `SPEC_PATH`, `AUTH_SESSION_PATH` from env
- [ ] Runner works against `localhost:5173` (dummy app, no auth)
- [ ] Runner works against a real staging URL with saved auth session
- [ ] JSON report is written to `reports/` on every run
- [ ] Exit code 0 on pass, 1 on drift, 2 on runner error
- [ ] `verify.ts` and `verify-robust.ts` deleted
- [ ] All docs updated to reflect the new single-script approach
