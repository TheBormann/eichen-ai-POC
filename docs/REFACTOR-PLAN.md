# Architecture

## Current state

`agent/runner.ts` is the unified runner. It:
- Loads a YAML test suite (`suites/*.yaml`)
- Handles authentication via saved Playwright session
- Runs one agent pass per check with an explicit output schema
- Writes structured JSON to `reports/`
- Exits with the correct code: `0` = pass, `1` = drift found, `2` = runner error

The POC proves the loop works on a controlled dummy app. The dummy app was designed to make it work — planted bugs, spec written to match the exact code structure, no auth, localhost only.

**What breaks on a real staging URL:**
1. Auth — every real staging environment has a login
2. Spec input — currently hardcoded path, no way to pull from Notion/Confluence/Jira
3. Unknown UI complexity — the agent may behave differently on unfamiliar real apps
4. No output channel — report goes to a local JSON file, not Slack or Jira

These are the four things the next build sprint must solve. None of them require redesigning the core loop.

---

## Repository layout

```
eichen-ai-POC/
├── agent/
│   └── runner.ts              # Core runner — loads suite, runs checks, writes report
├── auth/
│   ├── save-session.ts        # One-time helper: open browser → log in → save session
│   └── session.example.json   # Template showing storageState shape
├── suites/
│   └── demo.yaml              # Example suite for the demo app
├── reports/                   # Generated at runtime (gitignored)
├── target-app/                # Demo React app with intentional bugs
├── docs/
│   └── product/
│       └── settings-page.md   # Example PM-style spec used as agent input
└── .env.example               # API keys — suite config lives in the suite file, not here
```

---

## Auth strategy

Playwright's `storageState` pattern handles auth without storing credentials in code.

**How it works:**
1. `auth/save-session.ts` opens a browser, lets you log in manually, saves cookies and localStorage to `auth/session.json`
2. The main runner loads `session.json` at startup — the browser context already has valid cookies, no login step needed
3. `auth/session.json` is gitignored and never leaves the machine

```typescript
// In runner.ts
const context = await browser.newContext({
  storageState: process.env.AUTH_SESSION_PATH || undefined,
});
```

This works with any auth method — SSO, MFA, magic links — because a human does the initial login.

---

## Staging vs. production

**Always staging. Never production.**

The agent clicks things, fills forms, triggers state changes. On production that means real user data being modified, analytics events firing, emails potentially sending. Staging exists precisely for this purpose.

Post-MVP exception: read-only verification on production (observe and extract only, no clicking). Requires explicit user opt-in per run. Not in scope now.

---

## Agent prompt design

Each check runs a single focused agent pass. System prompt establishes the rules; the instruction contains the specific check:

```typescript
systemPrompt: `You are a documentation QA agent verifying a live UI against a spec.
  RULES:
  - Quote UI text exactly as it appears. Never paraphrase.
  - If you cannot find an element the check mentions, that is a FAIL.
  - Do not verify anything not mentioned in the check.`

instruction: `
  STEPS: ${check.steps}
  VERIFY: ${check.expect}
  
  Return: status (pass/fail), what you saw, what was expected.
`
```

---

## Output contract

One JSON file per run:

```typescript
interface RunReport {
  run_id: string;           // ISO timestamp
  target_url: string;       // URL tested
  spec_path: string;        // Spec used as input
  overall: "pass" | "fail" | "error";
  duration_ms: number;
  token_usage: {
    prompt: number;
    completion: number;
    total: number;
    estimated_cost_usd: number;
  };
  findings: Array<{
    requirement: string;    // What the spec claims
    status: "pass" | "fail" | "skip";
    actual: string;         // What the UI showed
    screenshot?: string;    // Path to PNG if captured
  }>;
  agent_summary: string;    // Agent's natural language summary
  error?: string;           // Only if overall === "error"
}
```

This shape is stable enough to parse in CI, post to Slack, or store in a database.

---

## Next build steps

- [ ] Test on a real staging URL — auth session + real app + real spec → first real drift detection
- [ ] Notion spec pull — add `spec_source: notion` + `notion_page_id` to suite file; runner fetches the page and uses it as the check content
- [ ] Slack output — post report summary to a webhook on run completion
- [ ] GitHub Action — run suites on every deploy; exit code 1 posts a comment or opens an issue

---

## Status

- [x] Auth helper (`auth/save-session.ts`)
- [x] Unified runner (`agent/runner.ts`)
- [x] YAML suite format (`suites/`)
- [x] Structured JSON reports with per-check findings
- [x] Exit codes: 0 pass / 1 drift / 2 error
- [ ] Tested on real staging URL with SSO auth
- [ ] Notion spec pull
- [ ] Slack output
- [ ] GitHub Actions integration
