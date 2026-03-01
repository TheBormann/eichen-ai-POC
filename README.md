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
# Edit .env — add OPENAI_API_KEY or ANTHROPIC_API_KEY

# 3. Start the demo app (terminal 1)
npm run app

# 4. Run the agent (terminal 2)
npm run verify
```

The agent opens Chrome, navigates the app, compares it against `specs/dashboard.md`, and prints a structured report.

---

## Repository Structure

```
eichen-ai-POC/
├── agent/
│   ├── verify.ts            # Demo script — clear output, shows reasoning
│   └── verify-robust.ts     # Production script — retries, JSON reports, screenshots
├── specs/
│   └── dashboard.md         # The spec the agent verifies against
├── target-app/              # Dummy React app with 4 intentional bugs
└── docs/
    ├── poc-outline.md       # Technical architecture and implementation detail
    ├── MVP-PLAN.md          # What comes after this POC
    └── ROBUSTNESS.md        # Why verify-robust.ts exists and what it adds
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
| `npm run verify` | Run the demo verification script |
| `npm run verify:robust` | Run the production-grade script (recommended) |
| `npm run validate` | Check code structure without running the app |
| `npm test` | End-to-end test suite |

---

## Docs

- **[Technical Architecture](docs/poc-outline.md)** — How the agent is built, API usage, design decisions
- **[MVP Plan](docs/MVP-PLAN.md)** — What this becomes after the POC
- **[Robustness](docs/ROBUSTNESS.md)** — What `verify-robust.ts` adds and why
- **[Setup Checklist](docs/SETUP-CHECKLIST.md)** — Troubleshooting and verification steps
