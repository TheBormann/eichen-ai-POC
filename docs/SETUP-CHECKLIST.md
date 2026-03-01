# Setup Checklist

## Prerequisites

- [ ] Node.js 20+ (`node --version`)
- [ ] Chrome installed
- [ ] OpenAI **or** Anthropic API key

## Installation

```bash
npm install
cd target-app && npm install && cd ..
cp .env.example .env
# Edit .env — add OPENAI_API_KEY or ANTHROPIC_API_KEY
```

## Verify it works

**Step 1 — check structure (no app needed):**
```bash
npm run validate
# Expected: 25/25 checks passed
```

**Step 2 — run the target app:**
```bash
npm run app
# Expected: server on http://localhost:5173
```

Manually open the URL and confirm:
- You see a "Dashboard" page
- Nav shows "Dashboard", "Config" (bug), "Help"
- Settings page has "Enable Tracking" toggle (bug)
- Clicking toggle shows "Saved." toast (bug)

**Step 3 — run the agent:**
```bash
npm run verify
# Expected: Chrome opens, navigates, prints FAIL report
```

---

## Common Issues

**`Cannot find module '@browserbasehq/stagehand'`**  
→ Run `npm install` in the project root (not inside target-app)

**`ECONNREFUSED localhost:5173`**  
→ Start the target app first with `npm run app`

**`Missing API key` or `MissingLLMConfigurationError`**  
→ Check that `.env` exists and contains a valid key. Stagehand does not auto-load `.env` — the script calls `dotenv.config()` explicitly.

**Chrome not found**  
→ Install Chrome, or set `localBrowserLaunchOptions.executablePath` in `verify.ts`

**`TypeError: stagehand.page is undefined`**  
→ Outdated code. Use `stagehand.context.pages()[0]` — this is the v3 API.

**Agent times out or stops mid-verification**  
→ Increase `maxSteps` (default 25). A large spec may need 30+.
