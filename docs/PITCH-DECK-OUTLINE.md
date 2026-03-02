# Pitch Deck Outline — Documentation Drift Detector

Use this outline to create slides. Each section = 1 slide (or 2 if dense).

---

## Slide 1: Title
**Visual:** Clean, minimal
- **Title:** Documentation Drift Detector
- **Subtitle:** AI agent that keeps your docs accurate automatically
- **Your name / contact**

---

## Slide 2: The Problem
**Visual:** Split screen — doc vs. UI with red X marks showing mismatches

**Headline:** Product docs lie. Nobody notices until customers complain.

**3 bullet points:**
- PM writes spec: "Button labeled 'Save Changes'"
- Engineering ships: Button labeled "Save"
- Nobody catches it → customer confusion → support tickets

**The kicker:** Every company has this problem. Nobody has solved it.

---

## Slide 3: Why This Is Hard
**Visual:** Three columns with icons (❌)

**Column 1: Manual Testing**
- Expensive
- Doesn't scale
- Always out of date

**Column 2: Traditional Automation**
- Requires developers to write tests
- Needs codebase access
- Brittle (breaks when UI changes)

**Column 3: Current Process**
- Hope someone notices
- React to customer complaints
- Docs slowly become worthless

---

## Slide 4: Our Solution
**Visual:** Simple flow diagram: Doc → AI Agent → UI → Report

**Headline:** Point our AI agent at a doc and a URL. It tells you what drifted.

**How it works:**
1. Agent reads your product doc (markdown, Notion, Confluence)
2. Opens a browser and navigates your UI autonomously
3. Verifies every claim: labels, messages, workflows
4. Reports exact discrepancies with pass/fail per claim

**Key point:** No code. No test scripts. No codebase access required.

---

## Slide 5: Live Demo
**Visual:** Screenshot of terminal output showing pass/fail findings

**Headline:** Real output from the POC

**Show:**
```
✗ Navigation link labeled 'Settings'
   expected: Settings
   actual:   Config

✓ Settings link navigates to /settings route

✗ Confirmation message
   expected: Analytics enabled successfully.
   actual:   Saved.
```

**Caption:** 7 findings in 60 seconds. Exact quotes, no guessing.

---

## Slide 6: Three Tiers of Value
**Visual:** Pyramid or staircase diagram

**Tier 1: Drift Detection** ← POC proven today
- Find where UI doesn't match docs
- QA teams catch issues before customers do

**Tier 2: CI Integration** ← Architecturally enabled
- Run on every deploy
- Block PRs if docs are wrong

**Tier 3: Doc Maintenance** ← THE DIFFERENTIATOR
- Auto-update docs when UI changes
- Living documentation that maintains itself

---

## Slide 7: Why We Win (Differentiation)
**Visual:** Comparison table or checkmarks vs. competitors

**What competitors do:**
- Selenium, Cypress, Playwright → require code, need codebase access
- Autify, Mabl, Testim → AI test automation, still test-first (not doc-first)
- Notion, Confluence → passive storage, no verification

**What we do differently:**
✅ No codebase access required (Navan use case)
✅ Doc-first workflow (PMs already write specs)
✅ Tier 3: Auto-maintain docs (nobody else does this)

---

## Slide 8: The Real Moat (Tier 3)
**Visual:** Icon of a doc with a refresh/sync symbol

**Headline:** Living documentation — the category that doesn't exist yet

**The problem:**
- Every company struggles to keep docs accurate
- Docs become outdated within weeks
- Tech writers can't keep up with dev velocity

**Our solution:**
- Agent detects UI changes
- Suggests doc updates via PR
- Tech writer reviews and merges
- Docs stay accurate automatically

**The kicker:** This is a $1B+ problem nobody is solving.

---

## Slide 9: Market Size
**Visual:** Simple numbers, clean layout

**TAM (Total Addressable Market):**
- 10M+ software companies worldwide
- Every company with a product has docs that drift
- Conservative: $10B+ market (QA/testing + doc tools)

**ICP (Ideal Customer Profile):**
- B2B SaaS companies with 50-500 employees
- Product teams that ship weekly/daily
- Companies with strict security (no codebase access for vendors)

**Wedge customer:** Navan (travel/expense platform, strict security, 1000+ employees)

---

## Slide 10: Business Model
**Visual:** Simple pricing tiers

**Pricing (draft):**
- Starter: $500/mo → 100 checks/month, 5 docs
- Pro: $2,000/mo → unlimited checks, unlimited docs, CI integration
- Enterprise: Custom → SSO, on-prem, SLA, dedicated support

**Unit economics:**
- Cost per check: ~$0.02-0.05 (LLM costs)
- Gross margin: 95%+

**GTM:**
- Product-led growth (free tier for 10 checks/month)
- Bottom-up adoption (QA/PMs start using it, expand to eng)

---

## Slide 11: Traction / Roadmap
**Visual:** Timeline or milestones

**Today (POC):**
✅ Tier 1 proven: autonomous doc verification working
✅ 7 findings in 60s, structured JSON output
✅ Works with markdown, supports auth, CI-ready

**Next 3 months:**
- 3-5 design partners (Navan + 2-3 others)
- Notion/Confluence integrations
- Tier 3 MVP (auto-PR generation)

**Next 6-12 months:**
- Jira/Linear integrations ("verify on ticket close")
- GitHub Action + GitLab CI plugins
- 50+ paying customers

---

## Slide 12: Why Now?
**Visual:** Three icons representing each point

**1. AI agents are finally good enough**
- GPT-4o + Claude 3.5 can reason about UIs
- Stagehand (open-source tool) makes browser automation reliable
- Costs dropped 10x in 2 years ($1 → $0.02 per check)

**2. Remote work killed tribal knowledge**
- Docs are the only source of truth now
- Teams can't rely on "ask someone who knows"
- Inaccurate docs are a bigger problem than ever

**3. Dev velocity is accelerating**
- Ship daily/weekly → docs can't keep up manually
- AI code assistants make shipping faster → doc drift worse
- Need automated verification or docs become worthless

---

## Slide 13: Team
**Visual:** Headshots + short bios

**Your info:**
- Name, background, why you're the right person to build this
- Relevant experience (PM, QA, docs, SaaS, etc.)

**If you have co-founders / advisors:**
- Their info

**Key point:** You understand the problem deeply (ideally from personal pain).

---

## Slide 14: The Ask
**Visual:** Clean, simple

**Headline:** We're raising [AMOUNT] to prove Tier 3 and reach $1M ARR

**Use of funds:**
1. Build Tier 3 MVP (doc auto-update via PR)
2. Onboard 5-10 design partners
3. Build integrations (Notion, Jira, GitHub)
4. Hire 1 full-stack eng + 1 founding PM/QA

**Milestones:**
- 6 months: 10 paying customers, $50K ARR
- 12 months: 50 paying customers, $500K ARR
- 18 months: Product-market fit proven, ready for Series A

---

## Slide 15: Closing
**Visual:** The one-sentence positioning

**Headline:** The first living documentation platform that keeps itself accurate.

**Contact info**
- Email
- Demo link (if you have a hosted version)
- GitHub repo (if public)

---

## Appendix Slides (if needed)

### Appendix A: Technical Architecture
- How the two-phase approach works (agent + LLM structuring)
- Why Stagehand + OpenAI/Anthropic
- Diagram of the system

### Appendix B: Competitive Matrix
- Detailed comparison table vs. Cypress, Playwright, Autify, Mabl, QA Wolf
- Show where you win, where you're weaker

### Appendix C: Customer Interviews
- Quotes from Navan (Nicolas Ritz)
- Pain points validated
- "Would you pay for this?" responses

### Appendix D: Pricing Sensitivity
- How pricing compares to competitors
- ROI calculation (cost of inaccurate docs vs. cost of tool)

---

## Pro Tips for Presenting

### Tell a story
Start with: "Last month, I was talking to a PM at Navan. She told me they ship 50+ UI changes a week, and their docs are always wrong. Customer support gets 20+ tickets per week that are just 'the docs lied.' I asked her: why don't you just keep the docs updated? She laughed. 'We try. It's impossible.'"

### Show, don't tell
Run the live demo during the pitch if possible. Show the terminal, the browser, the findings. Make it real.

### Focus on Tier 3
Tier 1 is the wedge. Tier 3 is the billion-dollar outcome. Spend 60% of your time on Tier 3.

### Address the "why you?" question
Be honest: "I'm not the most technical person. But I deeply understand this problem because I've lived it. And I know this is a product problem, not a tech problem. The tech is already here (LLMs, browser automation). The insight is: apply it to documentation, not just testing."

### End with urgency
"The window to define this category is 12-18 months. After that, the incumbents will wake up. We need to move fast."

---

## One-Pager Summary (for emails)

Use this as a follow-up after meetings:

---

**Documentation Drift Detector — One-Pager**

**Problem:** Product docs drift from reality. Nobody catches it until customers complain.

**Solution:** AI agent that reads your docs, tests your UI, and reports exact discrepancies. No code, no test scripts, no codebase access required.

**Differentiation:**
- Only solution that works without codebase access (Navan use case)
- Doc-first workflow (not test-first)
- Tier 3: Auto-maintain docs via PR (nobody else does this)

**Traction:** POC proven. 7 findings in 60s. Structured JSON output. CI-ready.

**Market:** 10M+ software companies, $10B+ TAM (QA/testing + doc tools)

**Ask:** [AMOUNT] to build Tier 3 MVP and reach $1M ARR in 18 months

**Contact:** [EMAIL]

---

This outline gives you everything you need for a 15-slide deck that tells the story, shows the value, and makes the ask. Good luck!
