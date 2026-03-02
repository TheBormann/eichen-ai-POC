# Action Plan

Based on the evaluation in `EVALUATION.md`, here's your prioritized action plan.

---

## 🔴 Critical (Fix Before Customer Demo)

### 1. Fix Auth Session Bug (30 min)
**File:** `agent/runner.ts:166-185`

**Problem:** When `AUTH_SESSION_PATH` is set, the code closes Stagehand and relaunches raw Playwright, breaking the `stagehand.agent()` call.

**Test:**
```bash
# Create dummy session
echo '{"cookies":[],"origins":[]}' > auth/session.json

# Try to run
AUTH_SESSION_PATH=./auth/session.json npm run verify

# Expected: Crashes at line 208
# Actual: Should work
```

**Fix Option A (Quick):** Comment out auth code, document as "coming soon"
**Fix Option B (Correct):** Check if Stagehand v3 supports `storageState` in init options

---

### 2. Fix Structured Findings (45 min)
**File:** `agent/runner.ts:248-267`

**Problem:** Findings array populated by string heuristics (`line.includes('FAIL')`), doesn't parse agent output reliably.

**Current output:**
```json
"findings": []  // Even when drift detected
```

**Fix:** Use Stagehand's structured output:
```typescript
const agentResult = await agent.execute({
  instruction: "...",
  output: z.object({
    findings: z.array(z.object({
      requirement: z.string(),
      expected: z.string(),
      actual: z.string(),
      status: z.enum(["pass", "fail"]),
    }))
  }),
  maxSteps: CONFIG.maxSteps,
});

// Now agentResult.output.findings is strongly typed
report.findings = agentResult.output.findings;
```

**Verify:**
```bash
npm run verify
cat reports/report-*.json | jq '.findings'
# Should show array of finding objects, not []
```

---

### 3. Test on Real Staging (1 hour)
**Goal:** Prove it works outside localhost

**Steps:**
1. Pick a publicly accessible staging URL (yours or a demo site)
2. Write a 5-line spec for one visible element
3. Intentionally break the staging environment (change a label)
4. Run `npm run verify`
5. Confirm drift is detected and reported

**Success criteria:**
- Agent navigates the page ✅
- Report shows `"overall": "fail"` ✅
- Findings array lists the broken element ✅

---

## 🟡 Important (MVP Readiness)

### 4. Add Retry Logic (30 min)
**File:** `agent/runner.ts:355-358`

**Change:**
```typescript
// Before
main().catch((err) => {
  console.error("\nFatal error:", err);
  process.exit(2);
});

// After
async function runWithRetry(maxAttempts = 3) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await main();
      return;
    } catch (err) {
      if (i === maxAttempts - 1) {
        console.error("\nFatal error after", maxAttempts, "attempts:", err);
        process.exit(2);
      }
      console.log(`\n[retry] Attempt ${i + 1}/${maxAttempts} failed. Retrying in 2s...`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

runWithRetry();
```

**Why:** Transient failures (network timeouts, rate limits) shouldn't kill CI runs.

---

### 5. Update Validation Script (1 hour)
**File:** `agent/validate-structure.ts`

**Problem:** Checks for deleted files (`verify.ts`, `verify-robust.ts`)

**Fix:** Rewrite checks for new architecture:
```typescript
const checks = [
  { name: "Runner exists", test: () => fs.existsSync("agent/runner.ts") },
  { name: "Auth helper exists", test: () => fs.existsSync("auth/save-session.ts") },
  { name: "Runner has exit codes", test: () => {
    const code = fs.readFileSync("agent/runner.ts", "utf-8");
    return code.includes("process.exit(exitCode)");
  }},
  { name: "Runner has try/finally", test: () => {
    const code = fs.readFileSync("agent/runner.ts", "utf-8");
    return code.includes("try {") && code.includes("} finally {");
  }},
  // ... etc
];
```

**Verify:**
```bash
npm run validate
# Should show: Total: 25 | Passed: 25 | Failed: 0
```

---

### 6. Record Demo Video (30 min)
**Goal:** 60-second screen capture for customer pitches

**Script:**
1. Show `specs/dashboard.md` (5s)
2. Show `target-app` with bugs highlighted (10s)
3. Run `npm run verify` (30s)
4. Show generated report highlighting detected bugs (15s)

**Tools:** QuickTime (Mac), OBS (cross-platform), or Loom

**Deliverable:** Upload to YouTube/Loom, add link to README

---

## 🟢 Nice-to-Have (Post-MVP)

### 7. Parallel Spec Execution
Support multiple specs in one run:
```bash
SPEC_DIR=./specs npm run verify
# Runs all *.md files in specs/, generates combined report
```

### 8. Jira/Slack Integration
POST report JSON to webhook:
```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/... npm run verify
# Posts drift report to #qa-alerts channel
```

### 9. Browserbase Cloud Support
For customers without local Chrome:
```bash
BROWSERBASE_API_KEY=... npm run verify
# Runs in cloud browser instead of localhost
```

---

## Timeline

| Task | Priority | Time | Cumulative |
|------|----------|------|------------|
| Fix auth bug | 🔴 | 30m | 30m |
| Fix structured findings | 🔴 | 45m | 1h 15m |
| Test on real staging | 🔴 | 1h | 2h 15m |
| Add retry logic | 🟡 | 30m | 2h 45m |
| Update validation script | 🟡 | 1h | 3h 45m |
| Record demo video | 🟡 | 30m | 4h 15m |

**Total time to MVP-ready:** ~4 hours

---

## Success Metrics

**POC → MVP Milestone:**
- [ ] Runs successfully against 1 real staging URL (not localhost)
- [ ] Detects 1 intentional drift (label/copy/validation change)
- [ ] Generates report with populated `findings` array
- [ ] Handles auth via saved session (no hardcoded creds)
- [ ] Retries transient failures automatically
- [ ] Demo video recorded and shared

**When all checkboxes = ✅, you're ready to onboard a paying customer.**

---

## Questions to Answer

1. **Does Stagehand v3 support `storageState` in init?**
   - Check docs: https://docs.stagehand.dev
   - Or file issue: https://github.com/browserbase/stagehand

2. **What's the structured output API in Stagehand v3?**
   - Look for `output` parameter in `agent.execute()`
   - Test with simple example before full rewrite

3. **Do you have access to a real staging environment?**
   - If yes: Use that for testing
   - If no: Deploy target-app to Vercel/Netlify as fake staging

---

## Next Steps

1. Read `EVALUATION.md` fully
2. Pick the top 3 critical tasks
3. Block 2-3 hours to fix them
4. Test on a real staging URL
5. Iterate based on what breaks

**Then:** Ship to first customer and learn from reality.
