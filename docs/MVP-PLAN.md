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

## The architecture that makes this work at scale

The POC proves the core loop: doc → agent → UI → report. But it re-reads the full doc and re-tests everything from scratch on every run. That doesn't scale, and it doesn't solve the feature flag problem.

The MVP needs a smarter data model:

### Phase 1 — Build a test library from existing docs

When a customer onboards, we read all their existing documentation (Notion, Confluence, Jira tickets) and extract every testable claim into a structured test library:

```
[Jira ticket / Notion page]
         │
         ▼
  Agent extracts testable claims
  e.g. "Settings nav link is labeled 'Settings'"
       "Analytics toggle is labeled 'Enable Analytics'"
       "Save button shows error if no channels selected"
         │
         ▼
  Stored as versioned test library
         │
         ▼
  Run against staging → establish baseline pass/fail for each claim
```

Each claim in the library is linked back to the source doc it came from. If a claim can't be verified (element not found in the current staging env), it's marked `skipped — not visible` rather than `fail`. This is how we handle feature flags without needing to know which flags exist.

### Phase 2 — Incremental verification triggered by deploys, enriched by Jira

This is where Jira-as-primary-trigger breaks down. Jira ticket discipline varies wildly across teams, and the exact changes we care most about — toggle label renamed, toast copy tweaked, validation message changed — are precisely the kind that never get a Jira ticket. Relying on ticket linking means we miss the most common case.

The right model separates **trigger** from **context**:

```
TRIGGER (reliable — fires on every code change)
  Deploy event / PR merge to main
         │
         ▼
CONTEXT ENRICHMENT (opportunistic — use when available)
  Pull any Jira tickets linked to commits in this deploy
  Pull the PR description and commit messages
         │
         ▼
CLAIM SELECTION
  If linked tickets found → LLM asks "which existing claims could this change affect?" → re-run those
  If no tickets found → fall back to full test library run (or heuristic subset based on changed files)
         │
         ▼
  Re-run selected claims against staging
         │
         ▼
  Report: what drifted, which claim, which doc to update, which commit introduced it
```

**Trigger reliability comparison:**

| Trigger | Reliability | Catches hotfixes? | Setup friction |
|---|---|---|---|
| Deploy event (Vercel, GitHub Actions) | High | Yes | Low — one webhook |
| PR merge to main | High | Yes | Low — GitHub Actions |
| Jira ticket close | Medium | No — only if linked | Medium |
| Nightly schedule | High | Yes (with latency) | Zero |
| Manual | On demand | Yes | Zero |
| Feature flag event (Split.io webhook) | Medium | Flag changes only | Medium |

**The practical answer:** deploy event is the primary trigger. Jira tickets are context that makes the claim selection smarter when available — not a dependency. A hotfix with no ticket still fires a run; it just runs the full library rather than a targeted subset.

This is diff-based testing. As the test library matures and Jira linking improves, runs get cheaper. But correctness never depends on team ticket discipline.

### Why this solves the feature flag problem

We don't try to enumerate flag combinations. We can't — that's exponential, and customers don't even have staging environments for every combination. Instead:

- Claims that can't be found in the current staging env are marked `skipped — not visible`
- Over time, the test library learns which claims are consistently visible vs. flag-gated
- When a flag is turned on in a staging env, those claims become testable for the first time
- The customer points us at the specific staging env where a flag is active; we test that env for the claims relevant to that flag

This is the practical answer. The full combinatorial problem (n flags = 2ⁿ combinations) is an infrastructure problem that customers already have. We don't introduce it and we don't need to solve it — we just need to be honest about what's testable in a given environment.

---

## What the MVP is

The smallest thing a real customer can run on their real staging environment.

**Required inputs from the customer:**
1. A staging URL (or demo environment)
2. Their existing written docs — Notion pages, Confluence articles, Jira ticket bodies, or markdown files
3. A webhook or GitHub Actions integration to trigger runs on deploy

**What we do:**
1. Ingest all docs → extract testable claims → store as test library
2. Run baseline verification on staging → mark what passes, what fails, what's not visible
3. On each new ticket or deploy → identify affected claims → re-run only those
4. Post drift report to Slack or Jira comment: what changed, which claim is now wrong, which doc needs updating

**What the MVP is not:**
- A doc generator — if there are no existing docs, we cannot help
- A code analyser — we never touch the codebase
- A QA replacement — we catch documentation drift, not functional bugs
- An always-on monitor — we run on schedule or on deploy, not continuously
- A feature flag manager — we don't enumerate flag combinations; we test what's visible in a given env

---

## Build sequence

### Stage 1 — Run on a real staging environment (3–5 days)

The POC runs on a dummy app we built to make it work. The next step is a real customer staging URL.

- [ ] Point `npm run verify` at a real staging URL
- [ ] Confirm auth session loading works with the customer's SSO
- [ ] Confirm the agent does not hallucinate significantly on an unfamiliar real app
- [ ] Handle `skipped — not visible` gracefully (don't fail on feature-flagged elements)
- [ ] Record a 60-second screen capture showing one real drift finding

**Key question:** how accurately does the agent behave on a complex, unfamiliar UI vs. a controlled dummy app?

**Deliverable:** agent catches at least one real documentation inconsistency on a customer's staging environment

---

### Stage 2 — Build the test library from existing docs (1 week)

Instead of re-reading the full doc on every run, extract claims once and store them:

- [ ] Agent reads source doc, extracts structured testable claims
- [ ] Claims stored with: source doc reference, claim text, first-run status (pass/fail/skipped)
- [ ] Subsequent runs re-use the library; only re-read source docs when they change

This is the data model that makes incremental verification possible.

**Deliverable:** claim library persisted between runs; reports link findings back to source doc and line

---

### Stage 3 — Pull spec from Notion or Confluence (2–3 days per source)

Replace the local markdown file with a live pull from wherever the customer's docs live.

Priority order:
1. **Notion** — Most PMs write there. Public API: one `GET /blocks/{id}/children` call returns the page as structured text.
2. **Jira ticket body** — Navan specifically mentioned PRD context living in Jira tickets.
3. **Confluence** — Atlassian REST API.
4. **GitHub markdown** — Lowest friction for engineering-owned docs.

**Deliverable:** agent pulls a Notion page, verifies staging, reports drift — no local files involved

---

### Stage 4 — Deploy-triggered incremental verification (3–5 days)

Connect the runner to a deploy event so it fires automatically on every ship, regardless of whether a Jira ticket exists.

- [ ] GitHub Actions webhook: on push to main or on deployment, run the claim library against staging
- [ ] Pull any Jira tickets linked to commits in the deploy (via GitHub → Jira smart commits or PR body parsing)
- [ ] If linked tickets found: LLM identifies which claims they could affect → re-run targeted subset
- [ ] If no linked tickets: run full claim library (or a heuristic subset based on commit diff)
- [ ] Report links finding to the specific commit and, if available, the Jira ticket

Jira ticket linking is context that makes runs cheaper and more targeted — it is not a correctness dependency. The deploy event fires regardless.

**Deliverable:** drift detected and reported within minutes of every deploy to staging, with or without linked Jira tickets

---

### Stage 5 — Output to where teams look (1 day per channel)

Priority order:
1. **Slack webhook** — Post drift summary to a channel. Immediate.
2. **Jira comment** — Post the report as a comment on the ticket whose body was used as the spec.
3. **GitHub PR comment** — If triggered on deploy, post to the PR that triggered it.

**Deliverable:** Slack message with structured drift report and screenshot attached

---

## The feature flag question — honest assessment

Feature flags are the hardest unsolved problem in this space. Our position:

**What we do:** Test what's visible in the staging env we're given. Mark invisible claims as `skipped`. Over time, map which claims appear under which conditions.

**What we don't do:** Enumerate flag combinations. Dynamically spin up staging envs with specific flag states. Integrate with Split.io or LaunchDarkly to know which flags are on.

**Why:** Dynamically creating staging environments per flag combination requires deep infrastructure access that's as blocked as codebase access. And the combinatorial space (n flags = 2ⁿ combinations) grows faster than any test suite can handle. The customers who feel this pain most acutely already have a process for it — usually a small set of "canonical" staging environments with known flag states. We test those envs.

**The practical answer for design partners:** Ask them to give us one staging URL per "environment profile" they care about (e.g., "staging with analytics on", "staging with new checkout on"). We run the relevant doc claims against each profile. No combinatorial problem; just multiple target URLs.

---

## Converting Navan to a design partner

Nicolas said "keep in touch." The follow-up should not be another discovery call. It should be a demo:

- Their real staging URL (or a close approximation)
- A spec from one of their actual Jira tickets or Notion pages
- The agent catching one real inconsistency they did not know about

**Next step:** ask Nicolas to send one Jira ticket that describes a feature we can verify against their staging URL. Offer to run it for free and share the output.

Feature flag complexity: leave for the design partner phase. If it comes up during the demo, the honest answer is "we test what's visible in the env you give us — if a feature is flagged off, we'll mark that claim as skipped rather than failing it."

---

## Finding the next 2–3 design partners

Profile to target:
- B2B SaaS, 50–500 employees, shipping weekly or faster
- Has existing written product docs (Notion, Confluence, Jira)
- Has a staging environment
- Strict on security (no codebase access for vendors) — this is our strongest entry point

**Offer:** free 3-month pilot in exchange for weekly feedback calls and permission to use as a case study

---

## What success looks like at the end of the design partner phase

- 3–5 companies running eichen on their real staging environments
- Test library built from their real docs, running incrementally on deploy
- At least one drift finding per customer per month they would not have caught otherwise
- At least 2 customers willing to pay $200–500/month when the free trial ends
- Clear answers to: what claim types does the agent get wrong? What makes a good input doc? How does the incremental diff perform on real-world ticket sizes?
