# Eichen AI — Documentation Drift Detector

> Human-written docs have the context. This keeps them accurate.

An AI agent reads a test suite, opens a staging UI in a real browser, executes every documented workflow, and reports exactly where the UI diverges from what the docs say.

**No codebase access required.** The agent only sees what a user sees.

---

## How It Works

You define test suites in YAML. Each suite targets a URL and contains one or more checks. Each check tells the agent what to do and what to verify.

```yaml
# suites/settings.yaml
target_url: http://localhost:5173
suite: Settings Page

checks:
  - name: Nav link label
    steps: Click the navigation link that leads to the settings page
    expect: The link is labeled exactly "Settings"

  - name: Analytics toggle label
    steps: Find the toggle in the Analytics section
    expect: The toggle is labeled exactly "Enable Analytics"

  - name: Save confirmation message
    steps: Enable the analytics toggle by clicking it
    expect: A confirmation message appears reading exactly "Analytics enabled successfully."
```

Run it:

```bash
npm run verify -- --suite suites/settings.yaml
```

Output:

```
Suite: Settings Page  →  http://localhost:5173

  ✗ Nav link label
      expected: labeled exactly "Settings"
      actual:   labeled "Config"

  ✗ Analytics toggle label
      expected: labeled exactly "Enable Analytics"
      actual:   labeled "Enable Tracking"

  ✗ Save confirmation message
      expected: "Analytics enabled successfully."
      actual:   "Saved."

  3 checks  ·  0 passed  ·  3 failed  ·  $0.14  ·  68s
  Report: reports/report-2026-03-01T23-01-22.json
```

---

## Quick Start

**Prerequisites:** Node.js 20+, Chrome, one API key (OpenAI or Anthropic)

```bash
# 1. Install
npm install
cd target-app && npm install && cd ..

# 2. Configure
cp .env.example .env
# Add OPENAI_API_KEY or ANTHROPIC_API_KEY

# 3. Start the demo app (terminal 1)
npm run app

# 4. Run a suite (terminal 2)
npm run verify -- --suite suites/demo.yaml
```

---

## Test Suite Format

Suites live in `suites/`. Each file is a YAML document:

```yaml
# Required
target_url: https://staging.yourapp.com   # URL to open
suite: Name of this suite                 # Human-readable label

# Optional
auth_session: ./auth/session.json         # Playwright storageState (for login-protected apps)
headless: true                            # true for CI, false to watch the browser
max_steps: 50                             # Agent step budget per check

checks:
  - name: Short descriptive name          # Appears in report and terminal output
    steps: |                              # What to do — plain English, the agent figures it out
      Navigate to the checkout page.
      Fill in the shipping address form.
      Click "Continue to payment".
    expect: |                             # What must be true — quoted exactly where precision matters
      The page heading reads exactly "Payment Details".
      A summary of the shipping address is visible.
```

**Writing good checks:**

- `steps` is the workflow. Write it like you'd describe it to a new employee.
- `expect` is the assertion. Use exact quotes for labels, messages, and headings.
- One check per logical thing you want to verify. Don't bundle unrelated things.
- If a check fails, the agent quotes exactly what it saw vs. what was expected.

---

## Authentication

For staging environments with login:

```bash
# 1. Save your session (one-time)
npm run auth:save
# Browser opens → log in manually → close browser
# Session saved to auth/session.json

# 2. Reference it in your suite
auth_session: ./auth/session.json

# 3. Run as normal
npm run verify -- --suite suites/my-suite.yaml
```

The session file stores cookies and localStorage. It is gitignored and never leaves your machine.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run app` | Start the demo React app on localhost:5173 |
| `npm run verify -- --suite <path>` | Run a test suite |
| `npm run auth:save` | Open browser, log in, save session |
| `npm run validate` | Check repo structure without running anything |

---

## Output

Every run writes to `reports/`:

- `report-<timestamp>.json` — full structured results, one entry per check
- `<timestamp>_<check-name>.png` — screenshot taken after each check

Exit codes: `0` = all checks passed · `1` = one or more checks failed · `2` = runner error

---

## Docs

- [Setup & Troubleshooting](docs/SETUP.md)
- [MVP Plan](docs/MVP-PLAN.md)
- [Architecture](docs/REFACTOR-PLAN.md)
