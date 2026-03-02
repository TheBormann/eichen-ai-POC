# Documentation Drift Detector — Presentation Guide

This guide helps you present the POC effectively, with demo scripts and talking points structured around the three-tier value proposition.

---

## Opening: The Problem (2 minutes)

**The setup:**
"Product documentation drifts from reality. A PM writes a spec, engineering ships something slightly different, and nobody catches it until a customer complains or a support ticket gets filed."

**Why this is hard:**
- Manual testing is expensive and doesn't scale
- Traditional test automation requires developers to write tests
- Neither approach works when you don't have codebase access (e.g., Navan's customer security constraints)

**The thesis:**
"What if you could point an AI agent at a product doc and a live URL, and it just tells you what drifted?"

---

## Solution Overview (3 minutes)

### Core Value Proposition

**Three tiers of value:**

| Tier | What it does | Who cares | Status |
|---|---|---|---|
| **1. Drift Detection** | Finds where UI doesn't match spec | QA, PMs | ✅ POC proven |
| **2. CI Integration** | Runs on every deploy, blocks or warns | Engineering | ✅ Architecturally enabled |
| **3. Doc Maintenance** | Suggests spec updates when UI drifts | PMs, Tech Writers | 🎯 Differentiator |

### How It Works

**Doc Mode (Primary):**
- Input: Markdown document + URL
- Agent reads the doc autonomously
- Navigates the UI and verifies every claim
- Reports pass/fail per claim with exact quotes

**Suite Mode (Structured):**
- Input: YAML file with pre-defined checks
- Good for repeatable CI runs
- Deterministic, faster

**No codebase access required.** The agent only sees what a user sees.

---

## Live Demo Script

### Setup (Before Presenting)

```bash
# Terminal 1 — start demo app
cd eichen-ai-POC
npm run app

# Terminal 2 — ready to run commands
cd eichen-ai-POC
```

Keep both terminals visible, browser visible (headless=false).

---

### Demo 1: Doc Mode (5 minutes)

**Narrative:**
"Let me show you doc mode. This is a normal product spec written by a PM — not a test script."

**Action:**
```bash
# Show the document first
cat docs/product/settings-page.md
```

**What to highlight:**
- Written like a real spec (not test instructions)
- Contains specific claims: labels, routes, messages, behaviors
- No test automation code

**Action:**
```bash
# Run doc mode
npm run verify -- --doc docs/product/settings-page.md --url http://localhost:5173 --headless false
```

**Watch for:**
- Browser opens automatically
- Agent reads the doc
- Agent navigates autonomously (clicks Settings, toggles switches, etc.)
- Terminal prints structured findings with pass/fail per claim

**Expected output:**
```
  ✗ The top navigation bar includes a link labeled 'Settings'
      expected: Settings
      actual:   Link labeled "Config" instead

  ✓ The Settings link navigates to the /settings route

  ✗ When turned on, a confirmation message appears
      expected: Analytics enabled successfully.
      actual:   Message reads "Saved." instead
      
  ... (7 findings total, 3–4 failures)
```

**Talking points:**
- No test code was written — just point at a doc and a URL
- Agent figured out what to verify autonomously
- It quotes exactly what it saw (never paraphrases)
- Structured JSON report saved for CI integration

---

### Demo 2: Show the Report (2 minutes)

**Action:**
```bash
# Show the generated report
cat reports/report-*.json | jq .
```

**What to highlight:**
- Structured JSON output
- Per-check pass/fail with expected/actual values
- Token usage and cost estimate
- Exit codes (0 = pass, 1 = fail, 2 = error)
- Screenshots saved alongside report

**Talking point:**
"This is the output contract. CI systems can consume this, attach it to PRs, block deploys — whatever you need."

---

### Demo 3: Suite Mode (Optional, 2 minutes)

**Narrative:**
"If you want more control for repeatable CI runs, you can use suite mode with YAML."

**Action:**
```bash
# Show the suite file
cat suites/demo.yaml

# Run it
npm run verify -- --suite suites/demo.yaml
```

**What to highlight:**
- Pre-defined steps and expectations
- Faster and more deterministic
- Good for regression testing
- Still no codebase access required

---

## Product Vision: Beyond the POC (3 minutes)

### Tier 1: Drift Detection (Done)
**What we proved:**
- Agent autonomously reads docs and verifies UI
- Structured findings with exact discrepancies
- Works without codebase access

**Value:**
- QA teams catch drift before it reaches customers
- PMs verify features were actually shipped as specified

---

### Tier 2: CI Integration (Architecturally Enabled)

**The pitch:**
"The infrastructure is already there. The tool has clean exit codes and machine-readable JSON output — that's all a CI system needs."

**Use cases:**
- Developer merges PR → agent runs against staging → report attached to PR
- PM closes Jira ticket → agent verifies the spec was shipped
- Nightly runs against staging to catch regressions

**Implementation:**
No new features needed. Just wrap the existing CLI in a GitHub Action / Jenkins plugin / GitLab CI job.

**Example GitHub Action:**
```yaml
- name: Verify product specs
  run: npm run verify -- --doc docs/product/*.md --url ${{ env.STAGING_URL }}
  
- name: Upload reports
  uses: actions/upload-artifact@v3
  with:
    name: drift-reports
    path: reports/
```

---

### Tier 3: Doc Maintenance (The Differentiator)

**The bigger problem:**
"Finding UI bugs is a crowded space. But keeping docs accurate is an unsolved, chronic problem."

**What this could be:**
Instead of just reporting drift, the agent outputs recommendations:

**Example output:**
```json
{
  "finding": {
    "claim": "Button labeled 'Save Changes'",
    "status": "fail",
    "expected": "Save Changes",
    "actual": "Save",
    "recommendation": {
      "type": "update_doc",
      "suggested_change": "Change 'Save Changes' to 'Save' in line 23 of settings-page.md",
      "confidence": "high"
    }
  }
}
```

**Or:**
```json
{
  "finding": {
    "type": "missing_from_spec",
    "actual": "Export to CSV button appears in the UI but is not mentioned in the spec",
    "recommendation": {
      "type": "add_to_doc",
      "suggested_addition": "## Data Export\nThe dashboard includes an 'Export to CSV' button...",
      "insert_after": "line 45"
    }
  }
}
```

**The vision:**
- Agent creates PRs to update docs when UI drifts
- Tech writers review and merge (or reject if UI is wrong)
- Documentation stays accurate automatically

**This is what makes it a product, not just a QA script.**

---

## Key Talking Points

### For QA / PMs
- "No test code to maintain — just write normal product docs"
- "Catches drift before it reaches customers"
- "Works without codebase access (critical for Navan use case)"

### For Engineering
- "Clean exit codes and JSON output — plugs into any CI system"
- "No flaky selectors — agent uses DOM reasoning, not brittle XPath"
- "Runs against staging, never production"

### For Leadership
- "Three-tier product roadmap: detection → CI integration → doc maintenance"
- "Tier 1 proven with this POC"
- "Tier 2 is packaging work, not new features"
- "Tier 3 is the real differentiator — nobody else is solving living documentation"

---

## Common Questions

**Q: What if the doc is ambiguous?**  
A: That's actually valuable feedback. If the agent can't verify a claim, the spec probably needs to be more specific. (This becomes a Tier 3 feature: "This section is ambiguous — clarify or split into multiple claims.")

**Q: How does it handle dynamic content?**  
A: The agent uses Stagehand's DOM reasoning, which is more robust than traditional selectors. It can find elements by semantic meaning, not just IDs or classes. For highly dynamic content (real-time data), suite mode lets you define explicit expectations.

**Q: What about authentication?**  
A: We support saved browser sessions (Playwright storage state). Run `npm run auth:save` once, log in manually, and the agent reuses that session. The session file is gitignored and never leaves your machine.

**Q: What's the cost per run?**  
A: Doc mode on this demo costs ~$0.02–0.05 per run (GPT-4o). Suite mode is faster and cheaper (~$0.01 per check). For a 20-check suite, expect $0.20–0.50 per full run.

**Q: Can it test user flows, not just static pages?**  
A: Yes. Doc mode is fully autonomous — it navigates, clicks, fills forms, etc. Suite mode gives you explicit control over multi-step workflows. Both support complex interactions.

**Q: What if the UI changes frequently?**  
A: That's the point. Traditional tests break when the UI changes. This tool adapts because it uses semantic reasoning, not brittle selectors. And when drift happens, it tells you exactly what changed.

---

## Closing: Next Steps

**If this POC resonates:**

1. **Immediate:** Run it on a real internal spec (Settings page, onboarding flow, etc.)
2. **Short-term:** Package as a GitHub Action for one team's CI pipeline
3. **Medium-term:** Build Tier 3 (doc maintenance) — the real product differentiator

**The thesis is proven.** The infrastructure is ready. The roadmap is clear.

---

## Appendix: Troubleshooting During Demo

**If the demo app isn't running:**
```bash
# Check if it's running
curl -I http://localhost:5173

# Restart if needed
npm run app
```

**If the agent times out:**
- Normal for first run (model cold start)
- Increase `--max-steps 150` if needed
- Check internet connection (agent makes API calls)

**If findings look wrong:**
- Check the demo app still has its intentional bugs (run `npm run validate`)
- Verify you're running against localhost:5173, not a different port

**If token costs show $0.0000:**
- This is expected (metrics collection from Stagehand doesn't always work in LOCAL mode)
- Actual cost is visible in your OpenAI/Anthropic dashboard
