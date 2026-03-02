# How to Test the POC

There are multiple ways to test this depending on what you have available.

---

## Option 1: Full Test (Requires API Key)

This runs the complete end-to-end verification with the unified runner.

### Prerequisites
- Node.js 20+
- Chrome installed
- OpenAI **or** Anthropic API key

### Steps

**1. Install dependencies:**
```bash
npm install
cd target-app && npm install && cd ..
```

**2. Configure:**
```bash
cp .env.example .env
# Edit .env and configure:
# OPENAI_API_KEY=sk-...           (or ANTHROPIC_API_KEY)
# TARGET_URL=http://localhost:5173
# SPEC_PATH=./specs/dashboard.md
# HEADLESS=false
```

**3. Start target app (terminal 1):**
```bash
npm run app
```
Wait for: `Local: http://localhost:5173`

**4. Run verification (terminal 2):**
```bash
npm run verify
```

### Expected Result

Chrome opens, navigates to the app, clicks around, then closes. Terminal shows:

```
═══════════════════════════════════════════
  DOCUMENTATION DRIFT DETECTOR
═══════════════════════════════════════════

[config] Target:   http://localhost:5173
[config] Spec:     ./specs/dashboard.md
[config] Headless: false

[agent] Starting verification pass...

═══════════════════════════════════════════
  VERIFICATION REPORT
═══════════════════════════════════════════
  Status: FAIL
  Duration: 60-70s
  Tokens: 50,000-52,000
  Cost: $0.12-0.14

  Agent Summary:
  The UI was verified against the specification. Failures found
  in label, link, and message text standards.

  Report saved: reports/report-<timestamp>.json
═══════════════════════════════════════════
```

Generated files:
- `reports/report-<timestamp>.json` — structured verification results
- `reports/<timestamp>_initial-state.png` — screenshot of starting state

**What this proves:** The agent successfully detected drift. Exit code: 1

---

## Option 2: Test with Authentication

Tests the authentication flow for staging environments that require login.

### Steps

**1. Configure auth in .env:**
```bash
# Set the target URL to a staging environment with login
TARGET_URL=https://staging.example.com
AUTH_SESSION_PATH=./auth/session.json
```

**2. Save login session:**
```bash
npm run auth:save
```
Browser opens → manually log in → close browser when done. Session saved to `auth/session.json`.

**3. Run verification:**
```bash
npm run verify
```

Runner loads the saved session automatically via Playwright's `storageState`.

### Expected Result

Agent navigates the authenticated app without needing to log in again.

**What this proves:** Authentication persistence works for real-world staging environments.

---

## Option 3: Structure Validation (No API Key Needed)

Tests that all code is present and correct without running the agent.

```bash
npm run validate
```

### Expected Result

```
═══════════════════════════════════════════
  POC STRUCTURE VALIDATION
═══════════════════════════════════════════

✓ Spec file exists
✓ Original verify script exists
✓ Robust verify script exists
✓ Test runner exists
✓ Target app exists
✓ Settings page exists
✓ Bug 1: Nav says Config (not Settings)
✓ Bug 2: Toggle says Enable Tracking
✓ Bug 3: Toast says Saved
✓ Uses correct page access (context.pages())
✓ Agent is instantiated correctly
✓ Has try/finally for cleanup
✓ Robust version has retry logic
✓ Robust version has health check
✓ Robust version has screenshot function
✓ Robust version parses spec
✓ Robust version has structured report
✓ Robust version saves JSON report
✓ Robust version has exit codes
✓ Package has agent script
✓ Package has robust agent script
✓ Package has test script
✓ Has Stagehand dependency
✓ Has Zod dependency
✓ Has dotenv dependency

────────────────────────────────────────────────────────────
Total: 25 | Passed: 25 | Failed: 0
════════════════════════════════════════════════════════════

✓ ALL STRUCTURE CHECKS PASSED
```

**What this proves:** All code is in place, bugs are present, APIs are used correctly.

---

## Option 4: Manual App Testing (No API Key Needed)

Just verify the target app works.

```bash
npm install
cd target-app && npm install && cd ..
npm run app
```

Then manually open `http://localhost:5173` in your browser.

### Manual Verification Checklist

- [ ] See "Dashboard" page
- [ ] Nav shows: "Dashboard" | "Config" | "Help"
- [ ] Click "Config" → goes to Settings page
- [ ] Settings page has "Analytics" section
- [ ] Toggle is labeled "Enable Tracking" ❌ (should be "Enable Analytics")
- [ ] Click toggle → toast appears
- [ ] Toast says "Saved." ❌ (should be "Analytics enabled successfully.")
- [ ] Settings page has "Notifications" section
- [ ] Button labeled "Save Preferences" exists
- [ ] Click button → nothing happens ❌ (should show error)

**What this proves:** The target app and all 4 bugs are present.

---

## Option 5: Quick Smoke Test

Fastest way to verify everything is wired up correctly.

```bash
npm run validate && npm run app &
sleep 3
curl -I http://localhost:5173
```

If you see `HTTP/1.1 200 OK`, the stack is working.

---

## Troubleshooting

### "Cannot find module"
```bash
# Make sure you installed in both places
npm install
cd target-app && npm install
```

### "ECONNREFUSED localhost:5173"
```bash
# Start the app first
npm run app
# Wait for "Local: http://localhost:5173"
# Then run the agent in a different terminal
```

### "Missing API key"
```bash
# Check .env exists
ls -la .env

# Check it has a key
cat .env | grep API_KEY

# If not:
cp .env.example .env
# Then edit .env with your actual key
```

### Chrome not found
Install Chrome from https://www.google.com/chrome/

Or set the path manually in `agent/runner.ts`:
```typescript
localBrowserLaunchOptions: {
  headless: config.headless,
  executablePath: '/path/to/chrome'
}
```

### "AUTH_SESSION_PATH file not found"
This is expected if you haven't saved a session yet. Either:
- Remove `AUTH_SESSION_PATH` from `.env` if testing against a public URL
- Run `npm run auth:save` first to create the session file

---

## What Each Test Proves

| Test | API Key Required | What It Validates |
|---|---|---|
| Structure Validation | ❌ No | Code structure, bugs present, API usage |
| Manual App Test | ❌ No | React app runs, bugs are visible |
| Full Verification | ✅ Yes | Agent detects bugs end-to-end |
| Authentication Flow | ✅ Yes | Session persistence for staging environments |
| Quick Smoke Test | ❌ No | Stack is wired up correctly |

For a quick demo without an API key: **Run Option 3 + Option 4**  
For full validation: **Run Option 1**  
For auth testing: **Run Option 2**

---

## Cost Estimate

Each full verification run costs:
- OpenAI GPT-4o: ~50,000-52,000 tokens ≈ **$0.12-0.14**
- Anthropic Claude Sonnet: ~50,000-52,000 tokens ≈ **$0.15-0.16**

Running 10 test iterations ≈ **$1.20-1.60** total

Note: Token usage is higher with the agent-based approach compared to manual `act()`/`extract()` calls, but provides autonomous multi-step reasoning.
