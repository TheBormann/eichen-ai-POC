# Executive Summary

**Date:** March 2026  
**Status:** POC complete

---

## The problem

Product teams write documentation once and ship it. Then UI labels change, confirmation messages get tweaked, navigation is reorganised. Nobody updates the docs. Support tickets arrive weeks later. By then the docs have drifted further.

This is not a negligence problem — it is a structural one. Docs get updated when someone explicitly owns it (major releases). Minor changes slip through because no one has time, and there is no automatic mechanism to catch them.

**From Nicolas Ritz, PM at Navan:**
> "Our documentation is very context aware because it's written by humans who know everything but it is not up to date."
> "For minor tweaks, we do nothing and wait for support tickets or negative user feedback to flag broken documentation, then fix it retroactively."

Every B2B SaaS company with a product that ships weekly has this problem.

---

## The solution

An AI agent that reads your existing product documentation and verifies it against your staging environment.

**Inputs:**
- A staging URL
- Your existing docs — Notion page, Confluence article, markdown file, or Jira ticket body

**Output:**
- A structured list of every mismatch between doc and live UI
- Screenshots of each finding
- Posted to Slack or added as a Jira comment so the right person acts on it

**What it does not need:**
- Source code or repo access
- New tests to write
- Changes to the deploy pipeline

---

## Why no code access — and why that matters commercially

Two reasons the UI-only approach is correct, not just convenient:

1. **Feature flags make code unreliable.** Navan uses Split.io. A feature can exist in the codebase but be invisible to 90% of users. Docs describe what users see. Only a UI-navigating agent can verify what users actually see.

2. **Enterprise security blocks code access.** Giving a third-party vendor access to source code requires legal review, security sign-off, and often a lengthy vendor approval process. Giving access to a staging URL requires none of that. This is a faster sales cycle and a larger addressable market.

---

## What the POC proves

The POC is a working implementation of the core loop:

1. Agent reads a product spec (markdown)
2. Stagehand opens a browser and navigates the staging app autonomously
3. LLM compares observed UI to every claim in the doc
4. Structured JSON report with pass/fail per claim, screenshots, cost tracking

**Measured results:**
- 7 findings in ~60 seconds on a simple settings page
- Cost: $0.02–0.05 per doc mode run (GPT-4o)
- All intentional bugs in the demo app caught correctly
- Clean exit codes (0/1/2) for CI integration

The POC is not production-ready. It runs on a dummy app. The next step is running it on a real customer's staging environment with their real docs.

---

## Three-tier product roadmap

| Tier | What | Status | Why it matters |
|---|---|---|---|
| **1. Drift detection** | Find where UI diverges from docs | POC working | The wedge — solves an acute pain, fast to demo |
| **2. CI integration** | Run on every deploy, block PRs | Architecture ready | Makes the tool part of the workflow, not an add-on |
| **3. Doc maintenance** | Agent proposes doc updates via PR when UI changes | Roadmap | The moat — no one else does this |

### Why Tier 3 is the differentiator

Every company wants docs that stay accurate. Nobody has built a tool that does it automatically.

The workflow: agent detects drift → generates a suggested doc update → opens a PR → tech writer reviews and merges. Documentation becomes a living asset instead of a liability that decays.

This category does not exist. Building it before anyone else defines the category and creates switching costs that are very hard to replicate.

---

## Who we sell to

**ICP:** B2B SaaS companies, 50–500 employees, shipping weekly or faster

**Entry buyer:** QA engineers and PMs who write product specs and feel the doc drift pain directly

**Expansion:** Platform-wide rollout once the team sees the value (more docs, more environments, more integrations)

**Enterprise signal from Navan:** Strict security requirements → code access is off the table → our approach is the only viable one for companies like this

---

## Business model (early hypothesis)

**Unit economics:**
- ~$0.20–0.30 per run all-in (LLM tokens + browser runtime)
- Target price: $200–500/month per team for unlimited runs on one staging environment
- At 10 customers: $2,000–5,000 MRR against ~$1,000 COGS
- Gross margin: 90%+ at scale

**Pricing will expand by:**
- Number of staging environments
- Number of doc sources integrated (Notion, Confluence, Jira)
- Number of output integrations (Slack workspaces, Jira projects)
- Enterprise features: SSO, on-prem, audit logs, SLA

These are hypotheses. Pricing gets validated with the first 3–5 paying customers, not before.

---

## Competitive position

**vs. traditional test tools (Cypress, Playwright):**  
They require developers to write tests and codebase access to run them. We require neither. Different buyer, different workflow.

**vs. AI test automation (Autify, Mabl, Testim):**  
They are test-first tools that happen to use AI. We are doc-first. More importantly, none of them are building Tier 3 (doc maintenance). They think about "finding bugs", not "keeping docs accurate".

**vs. documentation tools (Notion, Confluence):**  
They store docs. We verify them. Completely different value. They are our integration partners, not our competitors.

**The uncontested space:** Tier 3. No one is building living documentation infrastructure. That is where the category gets defined.

---

## Risks

**Accuracy (highest near-term risk)**  
The agent may hallucinate findings or miss real drift on complex, unfamiliar UIs. Mitigation: human-in-the-loop for Tier 3 (tech writer reviews all suggested doc changes), confidence scoring, tight focus on the specific claim types the model handles reliably.

**Competitor copies the approach**  
If we get traction, a well-funded startup will try to replicate. Mitigation: speed, integration depth (embedded in Notion/Jira workflows), and brand. Be the default solution before they launch.

**Slow enterprise sales cycle**  
Enterprise procurement is slow. Mitigation: start with PLG (free tier, self-serve), let teams adopt bottom-up, then expand to enterprise contracts once there is internal champions.

**No docs to work from**  
If a prospect has minimal or no written documentation, we cannot help them today. This is a real constraint. We do not expand into doc generation — that is a different product with different risks.

---

## Roadmap

**Now — design partner phase (0–3 months)**
- Run against Navan's real staging environment with a real Jira/Notion spec
- Catch one real inconsistency they did not know about → convert to design partner
- Onboard 2–3 more design partners
- Build Notion and Confluence pull integrations (one API call each)
- Build Slack output (one webhook call)

**Short term — MVP (3–6 months)**
- Jira integration: post report as comment on the ticket whose spec was used
- GitHub Actions plugin: run verification on every deploy
- 5–10 paying customers at $200–500/month
- Validate pricing and willingness to pay with real data

**Medium term — moat (6–12 months)**
- Tier 3 MVP: agent generates doc update PRs for tech writer review
- Data: learn what claim types have high vs. low accuracy → surface confidence scores
- Brand: own the "documentation drift" and "living documentation" narratives through content

---

## The ask

**For design partners (immediate):**  
Run eichen on your staging environment for free. Give us real feedback. Help shape the product. You get: early access, priority support, pricing lock when we go paid.

**For investors:**  
We are proving the core loop with real customers before raising. Come back when we have 3–5 paying design partners and real drift findings on real staging environments. That is 3–4 months out.

---

## One-sentence positioning

**Customer:** "The AI agent that reads your product docs and tells you exactly where your staging app no longer matches — no code, no test scripts, no codebase access."

**Investor:** "The first living documentation platform — wedge with doc drift detection, win long-term with auto-maintaining docs — uncontested category, 12–18 month window to define it."
