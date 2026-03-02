# MVP Plan

## What We Learned from Navan

**Contact:** Nicolas Ritz, PM at Navan — interviewed 2026-02-27

The conversation validated the core thesis and sharpened the problem definition considerably. Direct quotes from the interview:

> "Our documentation is very context aware because it's written by humans who know everything but it is not up to date."

> "For minor tweaks, we do nothing and wait for support tickets or negative user feedback to flag broken documentation, then fix it retroactively."

He also surfaced two constraints that directly shape how we should build:

**Constraint 1 — Codebase access is a legal and security blocker.**  
An AI agent reading raw source code is off the table for most enterprise customers. This is not a feature request — it is a hard wall. Our approach of navigating the live UI sidesteps this entirely.

**Constraint 2 — Feature flags mean code is not ground truth anyway.**  
Navan uses Split.io. A feature can exist in code but be invisible to 90% of users. Documentation should reflect what users actually see, not what is in the repo. Only a UI-navigating agent can verify this correctly.

These two constraints are not problems for us. They are the reasons our approach is the right one.

---

## The Problem, Precisely

Documentation teams at fast-shipping companies face a structural gap:

- **Major releases:** Docs get updated because someone explicitly owns it
- **Minor changes:** Toggle label renamed. Toast copy tweaked. Validation message changed. Nobody updates the docs. Nobody has time.
- **Result:** Support tickets arrive weeks later. By then the docs have drifted further.

The human who wrote the original docs understood the product deeply — they captured intent, context, edge cases. That context is not in the code. The AI agent's job is to verify that what was written still matches what ships, not to regenerate the context from scratch.

---

## MVP Scope

The MVP is not a POC. It is the smallest thing a real customer can run on their real staging environment.

### What it is

A scheduled agent that:
1. Reads product documentation from wherever it lives (Notion, Confluence, Jira, markdown)
2. Opens the customer's staging or demo environment in a cloud browser
3. Executes documented workflows
4. Produces a report of what drifted
5. Posts that report somewhere the team will see it (Slack, Jira comment, email)

### What it is not

- A doc generator — we do not write documentation
- A code analyser — we never touch the codebase
- A test framework — we do not replace Playwright or Cypress
- An always-on monitor — we run on a schedule or on deploy, not continuously

---

## Build Sequence

### Stage 1 — Working on a real staging environment (current)

The POC proves the thesis on a dummy app with planted bugs. The next step is a real customer staging URL.

- [ ] Run `npm run verify` against a real staging URL
- [ ] Confirm auth session loading works with the customer's SSO
- [ ] Confirm the agent does not hallucinate on an unfamiliar real app
- [ ] Record a 60-second screen capture showing drift detection

**Time estimate:** 3–5 days  
**Deliverable:** Agent catches a real doc inconsistency on a customer's staging environment

---

### Stage 2 — Run it on a real staging environment

Replace the dummy app with a customer's actual staging URL. Auth handled via saved Playwright session.

Changes needed:
- Point `TARGET_URL` in suite file at the staging environment
- Run `npm run auth:save` once to save the login session
- Adjust `max_steps` for the flow complexity

Key question to answer at this stage: **how much does the agent hallucinate on an unfamiliar real app vs. a controlled dummy?**

**Time estimate:** 3–5 days  
**Deliverable:** Agent runs on one real flow at a customer's staging URL and catches a real doc inconsistency

---

### Stage 3 — Spec input from existing docs

Replace the local markdown file with a live pull from wherever the customer's docs live.

Priority order based on where PM-level docs actually live:

1. **Notion** — Most PMs write there. Notion has a public API. One `GET /blocks/{id}/children` call to pull a page as plain text.
2. **Confluence** — Second most common. Atlassian REST API, slightly more complex auth.
3. **Jira ticket descriptions** — Navan specifically mentioned PRD context living in Jira. Pull the ticket body as the spec.
4. **GitHub markdown** — Lowest friction for engineering-owned docs.

This is not a complex integration. It is one API call per source. The verification script does not change.

**Time estimate:** 2–3 days per source  
**Deliverable:** Agent pulls a Notion page, verifies staging, reports drift — no local files involved

---

### Stage 4 — Output to where teams look

A report that nobody reads is useless. The output needs to land somewhere the team will act on it.

Priority order:

1. **Slack** — Webhook post with drift summary. Immediate. No new tool.
2. **Jira comment** — Post the report as a comment on the ticket whose description was the spec. Closes the loop: the ticket that defined the feature gets notified when that feature drifts.
3. **GitHub PR comment** — If triggered on deploy, post to the PR that triggered the deployment.
4. **Email** — Lowest priority. Teams do not act on email.

**Time estimate:** 1 day per output channel  
**Deliverable:** Slack message with a structured drift report that includes screenshots

---

### Stage 5 — Trigger on deploy, not on schedule

The highest-value trigger is "a feature just shipped." Running on a schedule catches drift late. Running after every deploy catches it immediately.

Integration options:
- **GitHub Actions** — `on: [deployment]` or `on: push to main`. Run `npm run verify` as a job. Exit code 1 blocks the deployment or creates an issue automatically.
- **Vercel deploy hooks** — Webhook on successful deploy triggers a verification run
- **Split.io / LaunchDarkly** — Feature flag turned on → trigger verification for that feature's documentation

The runner already exits with the correct codes (0 = all checks passed, 1 = drift detected, 2 = runner error). The CI/CD integration is wiring, not product work.

**Time estimate:** 1–2 days  
**Deliverable:** GitHub Action that runs verification on every merge to main

---

## What We Are Not Building (and Why)

### Doc generation

Generating documentation from code or UI is a different product. It requires the AI to invent context it does not have. Our bet is that human-written context is more valuable than AI-generated context, and that verifying existing docs is a more tractable problem than writing new ones.

Navan confirmed this directly: "Our documentation is very context aware because it's written by humans." The context exists. It just goes stale.

### Codebase analysis

Reading source code to check if it matches docs is technically feasible but commercially wrong. Enterprise security and legal teams will block it. Feature flags make it unreliable anyway. UI navigation is more accurate and has no access concerns.

### A full QA replacement

We are not replacing QA engineers or test suites. We are catching a specific class of bug — documentation drift — that QA suites do not catch because QA tests check functionality, not copy accuracy.

---

## Pricing Model (Early Hypothesis)

Three cost components per verification run:
- LLM tokens: ~50,000 tokens/run at ~$0.14/run (GPT-4o agent mode)
- Browser runtime: Browserbase charges by session minute — roughly $0.05–0.15/run
- Infrastructure: negligible at this scale

**Unit economics are workable.** ~$0.20–0.30/run all-in. Even at 500 runs/month per customer, that is $100–150/month in direct costs.

Target pricing: **$200–500/month per team** for unlimited runs on one staging environment. Expand by number of environments or products.

At 10 customers: $2,000–5,000 MRR on $1,000 COGS. That is the business model worth proving.

---

## The Next Conversation with Navan

Nicolas said "keep in touch." The follow-up should not be another discovery call. It should be a demo:

- Their own staging URL (or a close approximation)
- A spec pulled from one of their actual Jira tickets or Notion pages
- The agent catching one real inconsistency they did not know about

That converts a "validated idea" to a design partner. The POC exists to enable that conversation.
