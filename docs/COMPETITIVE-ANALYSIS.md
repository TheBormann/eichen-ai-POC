# Competitive Analysis

## The honest picture

There is no direct competitor. Nobody is building doc-first, no-code-access documentation verification. That is both an opportunity (uncontested space) and a risk (we need to educate the market).

The competitive question is really: *what do customers use today instead?* The answer is: nothing systematic. They wait for support tickets. That is the baseline we are replacing.

---

## Category 1 — Traditional test tools (Cypress, Playwright, Selenium)

**What they do:** Developers write test scripts in code. Tests verify UI behaviour. Selectors break when UI changes.

**Why customers use them:** Mature, well-documented, strong CI integrations.

**Why they don't solve our problem:**
- Require a developer to write and maintain tests — PMs and QA analysts can't use them unassisted
- Require codebase access or at least test code in the same repo
- Tests verify that the *software works*, not that the *docs are accurate* — a completely different goal
- Brittle selectors break constantly, creating maintenance burden

**Overlap with us:** Minimal. They're testing tools; we're a documentation verification tool. Different buyer (developers vs. PMs/QA), different workflow, different goal.

**Real risk:** Cypress or Playwright adds a "verify against plain English spec" mode powered by LLMs. Likelihood: medium-high (they're already adding AI features). Timeline: probably 12–18 months before it's good enough.

---

## Category 2 — AI test automation (Autify, Mabl, Testim, Octomind)

**What they do:** AI-assisted test creation and self-healing tests. Visual regression. Record-and-playback with AI maintenance.

**Why customers use them:** Easier to create tests than Cypress/Playwright; self-healing reduces maintenance burden.

**Why they don't solve our problem:**
- Still fundamentally test-first: you define what to test, then the tool runs it
- Most require or benefit from codebase context to generate meaningful tests
- Mabl and Testim need codebase access for some features; all of them have some level of repo integration in their workflows
- They verify that *features work*, not that *docs are accurate*
- None of them are building Tier 3 (doc maintenance / auto-updating docs)

**Overlap with us:** Moderate for Tier 1. They could theoretically add "verify a markdown spec" as a feature. But their product DNA is testing infrastructure, not documentation. The doc-maintenance vision (Tier 3) is completely outside their framing.

**Real risk:** Autify or a well-funded newcomer copies our doc-first approach with more resources. Likelihood: high if we get visible traction. Timeline: 6–12 months to ship something comparable.

**Mitigation:** Get embedded in customer workflows (Notion, Jira integrations) and build Tier 3 before they wake up.

---

## Category 3 — QA services (QA Wolf, BrowserStack, Rainforest QA)

**What they do:** Managed QA — humans or AI write and maintain tests as a service.

**Why they don't solve our problem:**
- Service businesses, not software — high-touch, expensive, doesn't scale the same way
- QA Wolf ($36M Series B) is closest: Playwright-based automation with human oversight. But they're test-first and require full access to the app environment.
- They're replacing QA engineers, not solving documentation drift

**Overlap with us:** Low. Different business model, different buyer, different problem.

---

## Category 4 — Documentation tools (Notion, Confluence, GitBook)

**These are not competitors. They are integration partners.**

They store docs. We verify docs against reality. A Notion user with drifting docs is exactly our ICP. We pull from Notion, verify against staging, post the report back to Notion or Jira.

**The risk:** Notion or Confluence builds a "verify this page against a URL" feature. Likelihood: low in the near term. Their product DNA is content management; this would be a significant pivot into browser automation and LLM reasoning. More likely they partner with or acquire us.

---

## Where we genuinely win

### No codebase access (Tier 1)
Enterprise security blocks vendor repo access. This is a hard constraint at companies like Navan. Visual testing tools (Percy, Applitools) also don't need codebase access, but they only do pixel-level visual comparison — they don't verify semantic claims like "button is labeled X" or "error message says Y."

**Moat strength:** High for the enterprise segment. Medium overall.

### Doc-first workflow (Tier 1)
Every other tool starts with "write a test" or "record an interaction." We start with "point at a doc." PMs already write the docs. We make docs executable.

**Moat strength:** Medium-high. Requires a mindset shift. Incumbents are locked into test-first thinking.

### Tier 3 — doc maintenance (the actual moat)
No one is building this. The agent doesn't just find drift — it proposes the fix. Pull request with a suggested doc update, tech writer reviews and merges.

This requires combining: accurate drift detection (Tier 1) + doc writing capability + understanding of what a good doc update looks like + integration into the doc workflow (Notion/Confluence PR-equivalent). That is a lot of accumulated capability that compounds over time.

**Moat strength:** Very high. Novel category. Competitors think in "find bugs", not "maintain docs." Getting there first and owning the customer workflow is the play.

---

## Strategy summary

| Tier | Competitive situation | Our move |
|---|---|---|
| 1. Drift detection | Crowded adjacent space, but no direct competitor | Enter via enterprises that block codebase access; own the doc-first narrative |
| 2. CI integration | Commoditised — every tool does this | Package it, don't differentiate on it |
| 3. Doc maintenance | Completely uncontested | Build fast, get design partners embedded, define the category |

**The wedge → platform strategy:**  
Use Tier 1 to get in the door ("we found 3 doc inconsistencies you didn't know about"). Upsell Tier 3 once they trust the output ("now we'll propose the fixes too"). This is the classic wedge → platform play.

Do not try to beat Cypress on testing or Autify on AI test automation. Win the customers they cannot serve (no code access, doc-first workflow, enterprises with legal blocks on vendor repo access).

---

## Window to act

The 12–18 month estimate for the moat window is based on:
- Autify/Mabl seeing what we're doing and shipping a doc-first mode: 6–12 months
- Notion/Confluence adding verification features: 18–24 months
- OpenAI or Anthropic building a vertical application: unlikely (they're platforms)
- A well-funded startup copying us after we get visible: 6–12 months from the moment we're visible

The window is real but not forever. The priority is getting design partners embedded in workflows (Notion, Jira, Slack) before competitors ship. Switching cost grows every week a customer runs eichen.
