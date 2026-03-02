# Eichen AI — Documentation Drift Detector

> Human-written docs have the context. This keeps them accurate.

An AI agent reads your product documentation, opens a staging UI in a real browser, and reports exactly where the UI diverges from what the docs say.

**No codebase access required.** The agent only sees what a user sees.

---

## How It Works

### Doc Mode (Primary)

Point the agent at a markdown document and a URL. It reads the doc autonomously, figures out what to verify, navigates the UI, and reports discrepancies.

```bash
npm run verify -- --doc docs/product/settings-page.md --url http://localhost:5173
```

The document is written like a normal product spec (not a test script):

```markdown
# Settings Page

The top navigation bar includes a link labeled "Settings".
Clicking this link navigates to the /settings route.

## Analytics Section
The Analytics section contains a toggle labeled "Enable Analytics".
When turned on, a confirmation message appears: "Analytics enabled successfully."
```

The agent autonomously:
1. Reads the entire document
2. Identifies every testable claim (labels, routes, messages, behaviors)
3. Navigates the UI to verify each claim
4. Reports pass/fail for each one

Output:

```
  ✗ The top navigation bar includes a link labeled 'Settings'
      expected: Settings
      actual:   Link labeled "Config" instead

  ✓ The Settings link navigates to the /settings route

  ✗ When turned on, a confirmation message appears
      expected: Analytics enabled successfully.
      actual:   Message reads "Saved." instead
```

### Suite Mode (Structured)

For repeatable CI runs where you've already defined exactly what to test, use YAML suites:

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

# 4. Run doc mode (terminal 2)
npm run verify -- --doc docs/product/settings-page.md --url http://localhost:5173

# Or run a structured suite
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
| `npm run verify -- --doc <path> --url <url>` | Run doc mode (autonomous verification) |
| `npm run verify -- --suite <path>` | Run suite mode (structured YAML checks) |
| `npm run auth:save` | Open browser, log in, save session |
| `npm run validate` | Check repo structure without running anything |

### Doc Mode Options

```bash
npm run verify -- --doc <path> --url <url> [options]

Options:
  --headless false     Show browser (default: true)
  --max-steps 150      Agent step budget (default: 100)
  --auth <path>        Use saved auth session
```

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
