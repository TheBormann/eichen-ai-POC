# MVP Plan

## What we know from talking to customers

**Interview: Nicolas Ritz, PM at Navan — 2026-02-27**

> "Our documentation is very context aware because it's written by humans who know everything but it is not up to date."

> "For minor tweaks, we do nothing and wait for support tickets or negative user feedback to flag broken documentation, then fix it retroactively."

Two constraints surfaced that directly shape what we build:

**No codebase access.** An AI reading source code is off the table at enterprise companies. Security and legal block it. Our approach — navigating the live UI — sidesteps this entirely and needs zero legal review.

**Code is not ground truth anyway.** Navan uses Split.io for feature flags. A feature can exist in the codebase but be invisible to most users. Only a UI-navigating agent verifies what users actually experience. Docs describe user experience, not code state.

These constraints are not obstacles. They are the reasons our approach is correct.

---

## The problem, precisely

Fast-shipping product teams face a structural gap:

- **Major releases** → docs get updated because someone explicitly owns it
- **Minor changes** → toggle label renamed, toast copy tweaked, validation message changed → nobody updates the docs, nobody has time
- **Outcome** → support tickets arrive weeks later, docs have drifted further

The human who wrote the original docs understood the product deeply — they captured intent, context, edge cases. That context is not in the code. Our job is to verify that what was written still matches what ships, not to regenerate the context from scratch.

---

## What the MVP is

The smallest thing a real customer can run on their real staging environment.

**Required inputs from the customer:**
1. A staging URL (or demo environment)
2. Their existing written docs — Notion page, Confluence article, Jira ticket body, or markdown file

**What we do:**
1. Pull the doc from wherever it lives
2. Open the staging environment in a cloud browser
3. Navigate and verify every claim in the doc
4. Post a drift report to Slack or add a comment on the Jira ticket

**What the MVP is not:**
- A doc generator — if there are no existing docs, we cannot help
- A code analyser — we never touch the codebase
- A QA replacement — we catch documentation drift, not functional bugs
- An always-on monitor — we run on schedule or on deploy, not continuously

---

## Build sequence

### Stage 1 — Run on a real staging environment (3–5 days)

The POC runs on a dummy app we built to make it work. The next step is a real customer staging URL.

- [ ] Point `npm run verify` at a real staging URL
- [ ] Confirm auth session loading works with the customer's SSO
- [ ] Confirm the agent does not hallucinate significantly on an unfamiliar real app
- [ ] Record a 60-second screen capture showing one real drift finding

**Key question:** how accurately does the agent behave on a complex, unfamiliar UI vs. a controlled dummy app?

**Deliverable:** agent catches at least one real documentation inconsistency on a customer's staging environment

---

### Stage 2 — Pull spec from Notion or Confluence (2–3 days per source)

Replace the local markdown file with a live pull from wherever the customer's docs live. The verification logic does not change — only the input mechanism.

Priority order based on where PM-level docs actually live:

1. **Notion** — Most PMs write there. Public API: one `GET /blocks/{id}/children` call returns the page as structured text.
2. **Jira ticket body** — Navan specifically mentioned PRD context living in Jira tickets. Pull the ticket description as the spec.
3. **Confluence** — Second most common. Atlassian REST API, slightly more complex auth.
4. **GitHub markdown** — Lowest friction for engineering-owned docs.

Suite file changes needed per source:
```yaml
spec_source: notion
notion_page_id: abc123
# or
spec_source: jira
jira_ticket: ENG-4521
```

**Deliverable:** agent pulls a Notion page, verifies staging, reports drift — no local files involved

---

### Stage 3 — Output to where teams look (1 day per channel)

A report nobody reads is useless. Output needs to land somewhere the team acts.

Priority order:

1. **Slack webhook** — Post drift summary to a channel. Immediate, no new tool for the team.
2. **Jira comment** — If the spec came from a Jira ticket, post the report as a comment on that ticket. The ticket that defined the feature gets notified when that feature drifts. Closes the loop.
3. **GitHub PR comment** — If triggered on deploy, post to the PR that triggered it.
4. **Email** — Lowest priority. Teams don't act on email.

**Deliverable:** Slack message with structured drift report and screenshot attached

---

### Stage 4 — Trigger on deploy, not on schedule (1–2 days)

Running on a schedule catches drift after the fact. Running on every deploy catches it immediately.

Integration options:
- **GitHub Actions** — `on: push to main` or `on: deployment`. Run `npm run verify` as a job. Exit code 1 opens an issue or posts to Slack automatically.
- **Vercel deploy hooks** — Webhook on successful deploy triggers a verification run.
- **Feature flag events** — Split.io/LaunchDarkly flag turned on → trigger verification for that feature's documentation. This is the highest-signal trigger.

The runner already exits with the correct codes. CI integration is wiring, not product work.

**Deliverable:** GitHub Action that runs doc verification on every merge to main

---

## Converting Navan to a design partner

Nicolas said "keep in touch." The follow-up should not be another discovery call. It should be a demo:

- Their real staging URL (or a close approximation)
- A spec from one of their actual Jira tickets or Notion pages
- The agent catching one real inconsistency they did not know about

That is what converts "validated idea" to design partner. The POC exists to enable that conversation.

**Next step:** ask Nicolas to send one Jira ticket that describes a feature we can verify against their staging URL. Offer to run it for free and share the output.

---

## Finding the next 2–3 design partners

Profile to target:
- B2B SaaS, 50–500 employees
- Ships weekly or faster
- Has existing written product docs (Notion, Confluence, Jira)
- Has a staging environment (not just production)
- Strict on security (no codebase access for vendors) — this is our strongest entry point

Where to find them:
- Companies using Notion or Confluence heavily (public job listings mention "Notion-heavy team")
- Companies with "Head of QA" or "Technical Writer" roles open — they feel the pain directly
- YC companies in B2B SaaS — typically fast-shipping, have staging envs, understand the problem quickly

**Offer:** free 3-month pilot in exchange for weekly feedback calls and permission to use as a case study

---

## What success looks like at the end of the design partner phase

- 3–5 companies running eichen on their real staging environments
- At least one drift finding per customer per month that they would not have caught otherwise
- At least 2 customers willing to pay $200–500/month when the free trial ends
- Clear answers to: what claim types does the agent get wrong? What makes a good input doc? What output format do teams actually act on?
