# Pitch Deck Outline

15 slides. Use this as the skeleton — add visuals and personalise the team slide.

---

## Slide 1 — Title
- **Name:** eichen
- **Tagline:** The AI agent that keeps your product docs accurate automatically
- Contact / date

---

## Slide 2 — The problem
**Headline:** Product docs lie. Nobody notices until customers complain.

- PM writes: "Button labeled 'Save Changes'"
- Engineering ships: button labeled "Save"
- Nobody catches it → customer confusion → support tickets

Every B2B SaaS company has this problem. Nobody has solved it.

---

## Slide 3 — Why it stays unsolved
Three columns, all failing:

| Manual testing | Traditional automation | Current reality |
|---|---|---|
| Expensive | Requires developers to write tests | Nobody updates minor changes |
| Doesn't scale | Needs codebase access | Wait for support tickets |
| Always out of date | Brittle, breaks when UI changes | Docs slowly become worthless |

---

## Slide 4 — The solution
**Headline:** Give us a staging URL and your existing docs. We tell you what drifted.

How it works:
1. Agent reads your product doc (Notion, Confluence, Jira, markdown)
2. Opens a browser and navigates your staging environment autonomously
3. Verifies every claim: labels, messages, navigation, workflows
4. Reports exact discrepancies with pass/fail per claim

No code. No test scripts. No codebase access required.

---

## Slide 5 — Live output
Show terminal output from the POC:

```
✗ Navigation link labeled 'Settings'
   expected: Settings
   actual:   Config

✓ Settings link navigates to /settings

✗ Confirmation message after toggle
   expected: Analytics enabled successfully.
   actual:   Saved.
```

7 findings in 60 seconds. Quotes exactly what it saw.

---

## Slide 6 — Three tiers of value
Staircase or pyramid diagram:

| Tier | What | Status |
|---|---|---|
| **1. Drift detection** | Find where UI diverges from docs | Working today |
| **2. CI integration** | Run on every deploy, block PRs | Architecture ready |
| **3. Doc maintenance** | Agent proposes doc updates via PR | The moat |

Tier 1 gets us in the door. Tier 3 wins the category.

---

## Slide 7 — Why we win
**Headline:** The only solution that works without codebase access

vs. Cypress / Playwright: require developers + codebase access. We require neither.  
vs. Autify / Mabl: test-first, not doc-first. None of them do doc maintenance (Tier 3).  
vs. Notion / Confluence: they store docs. We verify them. Integration partners, not competitors.

Our differentiators:
- No codebase access (works for enterprises like Navan that block vendor repo access)
- Doc-first (PMs already write specs — no new workflow)
- Tier 3: auto-maintaining docs (nobody else is building this)

---

## Slide 8 — The real moat (Tier 3)
**Headline:** Living documentation — a category that doesn't exist yet

The problem: docs drift within weeks of shipping. Tech writers can't keep up with dev velocity.

Our solution: agent detects drift → generates suggested doc update → opens a PR → tech writer reviews and merges → docs stay accurate automatically.

No one is building this. Test automation companies think about finding bugs, not maintaining docs. Documentation tools don't have the automation DNA. We sit at the intersection of both.

---

## Slide 9 — Market
**TAM:** $10B+ (QA/testing tools + documentation tools combined)

**ICP:** B2B SaaS, 50–500 employees, shipping weekly, existing written docs, staging environment

**Wedge customer:** Navan
- 1000+ employees, strict security (no vendor codebase access)
- PM interview confirmed pain: "We wait for support tickets to find doc drift"
- "Would you pay for this?" → Yes

---

## Slide 10 — Business model
**Unit economics:**
- ~$0.20–0.30 per run all-in (LLM + browser)
- Target price: $200–500/month per team, unlimited runs, one staging environment
- 10 customers = $2,000–5,000 MRR on ~$1,000 COGS
- Gross margin: 90%+ at scale

**Pricing expands by:** environments, doc sources, output integrations, enterprise features

**GTM:** self-serve first (PMs and QA adopt bottom-up), then enterprise contracts via internal champions

---

## Slide 11 — Traction and roadmap
**Today:** POC working — autonomous doc verification, structured JSON output, CI-ready exit codes

**Now (0–3 months):**
- Run on Navan's real staging environment → convert to design partner
- 3–5 design partners total
- Notion + Jira pull integrations, Slack output

**Next (3–6 months):**
- 5–10 paying customers at $200–500/month
- GitHub Actions plugin
- Validate pricing with real data

**Later (6–12 months):**
- Tier 3 MVP: agent generates doc update PRs
- 50+ customers, $500K ARR path

---

## Slide 12 — Why now
1. **AI agents are finally reliable** — GPT-4o and Claude can reason about UIs. Cost dropped 10x in 2 years.
2. **Remote work killed tribal knowledge** — docs are the only source of truth. Inaccurate docs are a bigger problem than ever.
3. **Dev velocity is accelerating** — AI code assistants make shipping faster → doc drift gets worse → manual doc maintenance is increasingly impossible.

---

## Slide 13 — Team
[Your background and why you are the right person to build this]

---

## Slide 14 — The ask
We are raising [AMOUNT] to reach $1M ARR.

Use of funds:
1. Build Tier 3 MVP (doc auto-update via PR)
2. Onboard 5–10 design partners
3. Notion, Jira, GitHub integrations
4. First engineering hire

Milestones:
- 6 months: 10 paying customers, $50K ARR
- 12 months: 50 customers, $500K ARR, Tier 3 in market
- 18 months: Series A ready

---

## Slide 15 — Close
**The first living documentation platform that keeps itself accurate.**

[Contact / demo link]

---

## Appendix A — Technical architecture
- Two-phase approach: Stagehand navigation + LLM structuring
- Stack: Stagehand, OpenAI GPT-4o / Anthropic Claude, Playwright, Node.js/TypeScript
- Why staging-only (never production): agent clicks things, triggers state changes

## Appendix B — Competitive matrix
Full comparison vs. Cypress, Playwright, Autify, Mabl, QA Wolf — where we win, where we're weaker

## Appendix C — Customer research
Full Navan interview notes and quotes — `docs/MVP-PLAN.md`

## Appendix D — Demo script
1. Show a real product spec (markdown): "this is a normal PM doc, not a test script"
2. Run `npm run verify -- --doc docs/product/settings-page.md --url http://localhost:5173 --headless false`
3. Watch the browser navigate autonomously
4. Show the structured JSON report
5. "Now imagine this runs on every deploy and posts to your Slack"
