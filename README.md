# Eichen AI — Documentation Drift Detector

> Human-written docs have the context. This tool keeps them accurate.

---

## The Problem

Fast-shipping teams update their UI constantly. Documentation — even when written by people who understand the product deeply — goes stale within days. The gap is not a writing problem. It is a verification problem: nobody checks whether what the docs say matches what the product actually does.

The current workflow at companies like Navan: ship the feature, ignore the docs until a support ticket arrives.

---

## What This Does

An AI agent reads a plain-text product specification, opens a staging or demo UI in a real browser, executes every documented workflow, and reports exactly where the UI diverges from the spec.

**No codebase access required.** The agent only sees what a user sees.

```
Spec says:  Toggle labeled "Enable Analytics"
UI shows:   Toggle labeled "Enable Tracking"
Result:     ✗ FAIL — label drift detected
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
# Edit .env — add your API key and configure:
#   TARGET_URL=http://localhost:5173
#   SPEC_PATH=./specs/dashboard.md
#   HEADLESS=false

# 3. Start the demo app (terminal 1)
npm run app

# 4. Run the agent (terminal 2)
npm run verify
```

The agent opens Chrome, navigates the app, compares it against the spec, and generates:
- Structured JSON report in `reports/`
- Screenshot of initial state
- Exit code: 0 (pass), 1 (drift), 2 (error)

---

## Repository Structure

```
eichen-ai-POC/
├── agent/
│   └── runner.ts            # Unified verification runner
├── auth/
│   ├── save-session.ts      # Helper to save login sessions
│   └── session.example.json # Template for auth sessions
├── specs/
│   └── dashboard.md         # The spec the agent verifies against
├── reports/                 # Generated JSON reports and screenshots (gitignored)
├── target-app/              # Dummy React app with 4 intentional bugs
└── docs/
    ├── REFACTOR-PLAN.md     # Architecture decisions
    ├── MVP-PLAN.md          # What comes after this POC
    └── TESTING.md           # Testing guide
```

---

## The Bugs in the Demo App

The `target-app` is intentionally broken in four ways:

| Spec says | App does | Type |
|---|---|---|
| Nav link: "Settings" | Nav link: "Config" | Label drift |
| Toggle: "Enable Analytics" | Toggle: "Enable Tracking" | Label drift |
| Toast: "Analytics enabled successfully." | Toast: "Saved." | Copy drift |
| Error shown when saving with no selection | No error shown | Missing behaviour |

The agent should catch all four.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run app` | Start the target React app on localhost:5173 |
| `npm run verify` | Run verification against configured TARGET_URL |
| `npm run auth:save` | Open browser to save login session (for auth-protected apps) |
| `npm run validate` | Check code structure without running the app |

## Authentication

For staging environments with login:

```bash
# 1. Configure the login URL in .env
AUTH_SESSION_PATH=./auth/session.json

# 2. Open browser and login manually
npm run auth:save
# Browser opens → login → close browser
# Session saved to auth/session.json

# 3. Run verification (uses saved session)
npm run verify
```

---

## Testing

**Quick validation:**
```bash
npm run validate           # Checks code structure (no API needed)
npm run app               # Starts target app
npm run verify            # Runs full verification (requires API key)
```

The runner generates:
- JSON report in `reports/report-<timestamp>.json`
- Initial screenshot in `reports/<timestamp>_initial-state.png`
- Exit codes: 0 (pass), 1 (drift detected), 2 (error)

See **[Testing Guide](docs/TESTING.md)** for detailed testing instructions.

---

## Docs

- **[Evaluation](EVALUATION.md)** ⭐ — Comprehensive POC assessment and grade
- **[Action Plan](ACTION-PLAN.md)** — Prioritized next steps to MVP
- **[Refactor Plan](docs/REFACTOR-PLAN.md)** — Architecture decisions and design rationale
- **[MVP Plan](docs/MVP-PLAN.md)** — What this becomes after the POC
- **[Testing Guide](docs/TESTING.md)** — How to test and validate
- **[POC Outline](docs/poc-outline.md)** — Original POC design and learnings
- **[Setup Checklist](docs/SETUP-CHECKLIST.md)** — Troubleshooting and verification steps
