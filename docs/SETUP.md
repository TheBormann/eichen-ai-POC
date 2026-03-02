# Setup & Troubleshooting

## Prerequisites

- Node.js 20+
- Chrome installed
- OpenAI or Anthropic API key

## Install

```bash
npm install
cd target-app && npm install && cd ..
cp .env.example .env
# Edit .env — add OPENAI_API_KEY or ANTHROPIC_API_KEY
```

## Run the demo

```bash
# Terminal 1 — start the demo app
npm run app

# Terminal 2 — run the demo suite
npm run verify -- --suite suites/demo.yaml
```

Expected: agent opens Chrome, navigates the app, prints a report with 3–4 failures, exits with code 1.

## Verify without an API key

```bash
npm run validate
# Checks that all files are present and the demo app has its intentional bugs
```

## The demo app

`target-app/` is a React app intentionally broken in four ways. It is the target for `suites/demo.yaml`.

| Spec says | App does |
|---|---|
| Nav link: "Settings" | Nav link: "Config" |
| Toggle: "Enable Analytics" | Toggle: "Enable Tracking" |
| Toast: "Analytics enabled successfully." | Toast: "Saved." |
| Error shown on invalid save | No error shown |

---

## Troubleshooting

**`Cannot find module '@browserbasehq/stagehand'`**  
Run `npm install` in the project root, not inside `target-app/`.

**`ECONNREFUSED localhost:5173`**  
Start the demo app first: `npm run app`. Wait for the "Local:" line before running the agent.

**`No API key found`**  
Check that `.env` exists and has `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` set. Copy from `.env.example` if missing.

**Chrome not found**  
Install Chrome from google.com/chrome. Or set `executablePath` in the suite file under `browser_options`.

**Agent times out or stops early**  
Increase `max_steps` in your suite file. Complex flows may need 50–100.

**`AUTH_SESSION_PATH file not found`**  
Run `npm run auth:save` first to create the session file, or remove `auth_session` from your suite if the app is public.
