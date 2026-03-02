# eichen — AI Doc Drift Detection

Your product ships. Your docs don't keep up. We catch the gap.

eichen is an AI agent that reads your existing product documentation, navigates your staging environment as a real user would, and tells you exactly where the UI no longer matches what the docs say.

**What you give us:** a staging URL + your existing written docs (Notion, Confluence, markdown, Jira ticket body)  
**What you get:** a structured report of every mismatch, with screenshots, posted to Slack or Jira

No code access. No test scripts. No changes to your deploy pipeline.

---

## How it works

```
Your docs (Notion / Confluence / markdown)
         │
         ▼
  AI agent parses every testable claim in the doc
         │
         ▼
  Playwright + Stagehand navigate the live staging app
         │
         ▼
  LLM compares observed UI to documented expectations
         │
         ▼
  Structured report → Slack / Jira / JSON
```

Two-phase design:
1. **Navigation** — Stagehand drives the browser autonomously, no hardcoded selectors
2. **Comparison** — LLM reads the live page state and grades each claim in the doc

---

## Why no code access

Feature flags (Split.io, LaunchDarkly) mean the codebase is not ground truth — the running UI is. A feature can exist in code but be invisible to most users. Documentation describes what users actually see, not what the code says. Matching docs to the live UI is both more accurate and vastly easier to sell: no security review, no legal approval, no repo access request.

If a customer has no existing written docs, that is a different problem (doc generation). We do not solve that today.

---

## Three tiers

| Tier | What | Status |
|---|---|---|
| **1. Drift detection** | Find where UI diverges from docs | Working — this POC |
| **2. CI integration** | Run on every deploy, block PRs, auto-comment | Architecturally ready |
| **3. Doc maintenance** | Agent proposes doc updates via PR when UI changes | Roadmap — the moat |

Tier 1 gets us in the door. Tier 3 is the uncontested category.

---

## Quick start (POC demo)

**Prerequisites:** Node.js 20+, Chrome, OpenAI or Anthropic API key

```bash
npm install
cd target-app && npm install && cd ..
cp .env.example .env        # add OPENAI_API_KEY or ANTHROPIC_API_KEY

# Terminal 1 — start demo app
npm run app

# Terminal 2 — run doc mode
npm run verify -- --doc docs/product/settings-page.md --url http://localhost:5173
```

### With authentication

```bash
npm run auth:save           # opens browser → log in manually → saves auth/session.json
npm run verify -- --suite suites/demo.yaml --auth auth/session.json
```

---

## Input formats

### Doc mode — point at any written doc

```bash
npm run verify -- --doc docs/product/settings-page.md --url http://localhost:5173
```

The doc is a normal product spec, not a test script:

```markdown
## Navigation
The top nav has three links: Dashboard, Settings, Help.
Settings links to /settings.

## Analytics section
Toggle is labeled "Enable Analytics".
On toggle, shows confirmation: "Analytics enabled successfully."
```

### Suite mode — structured YAML for repeatable CI runs

```yaml
target_url: https://staging.yourapp.com
suite: Settings regression

checks:
  - name: Settings nav link
    steps: Click the navigation link to the settings page
    expect: The link is labeled exactly "Settings"

  - name: Analytics toggle label
    steps: Find the toggle in the Analytics section
    expect: The toggle is labeled exactly "Enable Analytics"
```

```bash
npm run verify -- --suite suites/demo.yaml
```

---

## Output

Reports written to `reports/report-<timestamp>.json` with PNG screenshots per check.

```
Suite: Settings regression → http://localhost:5173

  ✗ Settings nav link
      expected: labeled exactly "Settings"
      actual:   labeled "Config"

  ✗ Analytics toggle label
      expected: labeled exactly "Enable Analytics"
      actual:   labeled "Enable Tracking"

  2 checks · 0 passed · 2 failed · $0.08 · 45s
  Report: reports/report-2026-03-02T10-00-00.json
```

**Exit codes:** `0` = all pass · `1` = findings found · `2` = runner error

---

## Scripts

| Command | What it does |
|---|---|
| `npm run app` | Start the demo React app on :5173 |
| `npm run verify -- --doc <path> --url <url>` | Doc mode |
| `npm run verify -- --suite <path>` | Suite mode |
| `npm run auth:save` | Save browser session for login-protected staging |
| `npm run validate` | Check repo structure without running the agent |

---

## Docs

| Document | What it covers |
|---|---|
| `docs/EXECUTIVE-SUMMARY.md` | Business case, market, roadmap |
| `docs/MVP-PLAN.md` | First-customer motion, build sequence, Navan research |
| `docs/COMPETITIVE-ANALYSIS.md` | Competitor landscape and moat |
| `docs/REFACTOR-PLAN.md` | Technical architecture and next build steps |
| `docs/SETUP.md` | Detailed install and troubleshooting |
