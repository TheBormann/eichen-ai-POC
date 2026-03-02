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

## Current Architecture

`agent/runner.ts` replaced the original two-script POC. It:
- Loads a YAML test suite (`suites/*.yaml`)
- Handles authentication via saved Playwright session
- Runs one agent pass per check with an explicit output schema
- Writes structured JSON to `reports/`
- Exits with the correct code (0 = pass, 1 = drift, 2 = error)

---

## Repository Layout

```
eichen-ai-POC/
├── agent/
│   └── runner.ts              # Verification runner — loads suite, runs checks, writes report
├── auth/
│   ├── save-session.ts        # One-time helper: open browser → log in → save session
│   └── session.example.json   # Template showing storageState shape
├── suites/
│   └── demo.yaml              # Example suite for the demo app
├── reports/                   # Generated at runtime (gitignored)
├── target-app/                # Demo React app with 4 intentional bugs
└── .env.example               # API keys only — suite config lives in the suite file
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

## Agent Prompt Design

Each check runs a focused single-purpose agent pass. The system prompt establishes the rules; the instruction contains the specific check:

```typescript
systemPrompt: `You are a documentation QA agent verifying a live UI against a spec.
  RULES:
  - Quote UI text exactly as it appears. Never paraphrase.
  - If you cannot find an element the check mentions, that is a FAIL.
  - Do not check anything not mentioned in the check description.`

instruction: `
  STEPS: ${check.steps}
  VERIFY: ${check.expect}
  
  Return: status (pass/fail), what you saw, what was expected.
`
```

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

## Next Build Steps

1. **Test on real staging** — Auth session + real app + real spec → first real drift detection
2. **Slack output** — Post report summary to a webhook on every run
3. **Spec from Notion** — Add `spec_source: notion` + `notion_page_id` to suite file; runner fetches the page and uses it as the check content
4. **Scheduling** — GitHub Action that runs suites on every deploy; exit code 1 opens an issue

---

## Status

- [x] Auth helper built (`auth/save-session.ts`)
- [x] Unified runner built (`agent/runner.ts`)
- [x] YAML suite format implemented (`suites/`)
- [x] Structured JSON reports with per-check findings
- [x] Exit codes: 0 pass / 1 drift / 2 error
- [ ] Tested on real staging URL with auth
- [ ] Slack output
- [ ] Spec from Notion
