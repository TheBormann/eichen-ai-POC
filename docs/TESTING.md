# How to Test the POC

There are multiple ways to test this depending on what you have available.

---

## Option 1: Full Test (Requires API Key)

This runs the complete end-to-end verification.

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

**2. Configure API key:**
```bash
cp .env.example .env
# Edit .env and add one of these:
# OPENAI_API_KEY=sk-...
# ANTHROPIC_API_KEY=sk-ant-...
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
[observe] Nav elements found: ['Dashboard', 'Config', 'Help']

[extract] Settings page state: {
  "page_title": "Settings",
  "sections": [...]
}

[agent] Completed: true
[agent] Actions taken: 8-12

═══════════════════════════════════════════
  VERIFICATION REPORT
═══════════════════════════════════════════
  Agent Status: ✓ COMPLETED
  Success: ✗ FAIL

  Agent Message:
  Found discrepancies: Nav link says "Config" not "Settings",
  toggle says "Enable Tracking" not "Enable Analytics",
  toast says "Saved." not "Analytics enabled successfully."
  
[metrics] Total tokens: 4000-8000
[metrics] Inference time: 8000-15000ms
```

**What this proves:** The agent successfully detected all 4 intentional bugs.

---

## Option 2: Robust Version Test (Requires API Key)

Tests the production-grade script with screenshots and JSON reports.

```bash
# Terminal 1
npm run app

# Terminal 2
npm run verify:robust
```

### Expected Result

Same as Option 1, but also creates:
- `screenshots/` directory with PNG files
- `screenshots/report-{timestamp}.json` with structured results

**What this proves:** Production features (screenshots, JSON reports, retries) work.

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

Or set the path manually in `agent/verify.ts`:
```typescript
localBrowserLaunchOptions: {
  headless: false,
  executablePath: '/path/to/chrome'
}
```

---

## What Each Test Proves

| Test | API Key Required | What It Validates |
|---|---|---|
| Structure Validation | ❌ No | Code structure, bugs present, API usage |
| Manual App Test | ❌ No | React app runs, bugs are visible |
| Full Verification | ✅ Yes | Agent detects bugs end-to-end |
| Robust Version | ✅ Yes | Screenshots, JSON reports, retries |
| Test Runner | ✅ Yes | Automated test harness works |

For a quick demo without an API key: **Run Option 3 + Option 4**  
For full validation: **Run Option 1 or Option 2**

---

## Cost Estimate

Each full verification run costs:
- OpenAI GPT-4o: ~4,000-8,000 tokens ≈ **$0.02-0.04**
- Anthropic Claude Sonnet: ~4,000-8,000 tokens ≈ **$0.024-0.048**

Running 10 test iterations ≈ **$0.20-0.50** total
