# AscendX — Business Plan (First Draft)
*Prepared to support an Innovator Founder visa endorsement application.*
*Sections marked [NEEDS YOUR INPUT] require facts only you have — I've deliberately left them as prompts rather than inventing numbers, since fabricated figures in a visa application document would be actively harmful. Everything else is grounded in the verified product/codebase.*

---

## 1. Executive Summary

AscendX is an AI-powered interview coaching platform that treats interview competence as a *developed skill* rather than a single evaluated event. Unlike existing AI mock-interview tools, which score a single practice session and discard all context afterward, AscendX tracks a candidate's development across multiple sessions — using a methodology grounded in published occupational psychology and learning science (Kolb's Experiential Learning Cycle, the Ability-Motivation-Opportunity framework, and Vygotsky's Zone of Proximal Development) — to adapt coaching intensity, distinguish genuine skill gaps from situational performance conditions, and demonstrate whether coached behaviour is actually being internalised over time.

[NEEDS YOUR INPUT: one or two sentences on where you intend to take this commercially in the next 12–24 months — e.g. direct-to-candidate subscription, university/career-services partnerships, corporate outplacement contracts. This is the line an endorsing body reads first.]

---

## 2. The Problem

Interview preparation is high-stakes and poorly served:
- Generic AI mock-interview tools give a single round of feedback with no memory of the candidate, so improvement can't be measured or coached toward.
- Human coaching (career services, paid coaches) doesn't scale and is often financially or geographically inaccessible to the candidates who need it most — particularly early-career candidates and career switchers.
- Existing tools optimise for "sounding confident" rather than genuine skill transfer to a real interview — there is no feedback loop connecting practice to outcome.

[NEEDS YOUR INPUT: who is your primary target user right now — university students, career switchers, a specific industry vertical? And do you have any evidence yet (even informal — pilot user feedback, LinkedIn interest, waitlist signups) that this problem resonates? Endorsing bodies want to see the problem validated, not just asserted.]

---

## 3. The Product

*(This section is grounded in the verified, working implementation — see `INNOVATION_SUMMARY.md` for the fuller technical detail.)*

AscendX currently provides, live in the product:
- Adaptive interview practice sessions with real-time probing (structured follow-up questions) that assess both unscaffolded and scaffolded performance per question
- A five-component feedback sequence (self-assessment → calibration → competency feedback → process coaching → forward orientation) grounded in Hattie & Timperley's feedback research and Gibbs' Reflective Cycle
- Cross-session tracking that computes, via regression over a candidate's session history, whether their competency is trending upward, whether they're becoming less dependent on scaffolding, and whether coached behaviours are being internalised into independent performance
- CV/job-description alignment analysis that tailors practice questions to a specific target role
- A three-tier data architecture separating candidate-facing coaching language from internal signals and researcher-only data, with no cross-candidate comparison and no automated hire/no-hire output at any layer

**Near-term roadmap** (not yet built, scoped and ready to build):
- Post-interview outcome tracking — closing the loop between practice and real interview results, to move from "we coach interview skills" to an evidence-backed efficacy claim

---

## 4. Innovation

See `INNOVATION_SUMMARY.md` for the full technical case. In short: the individual theoretical components are established research; the innovation is their integration into a single computationally adaptive system for AI-delivered coaching, with genuine cross-session state — which most competing products do not attempt because it requires longitudinal data infrastructure, not just prompting a language model well.

---

## 5. Market & Competition

*Researched with cited sources. No exact-category "AI interview coaching market size" report was found as a direct citation during this research pass — that specific TAM figure does not appear to be publicly tracked as its own category. Rather than inventing one, this section uses the closest verifiable adjacent data (UK graduate employment/underemployment scale, and named-competitor funding/pricing) as the market-sizing evidence, and says so explicitly. This is standard practice for an emerging category and is more credible to an endorsing body than a fabricated TAM number.*

### 5.1 UK demand-side evidence

- **946,000** young people aged 16–24 in the UK were NEET (not in education, employment, or training) in the quarter to September 2025 — 12.7% of that age group (young men 13.4% / 512,000; young women 11.9% / 434,000). *(ONS, "Young people not in education, employment or training (NEET), UK: November 2025")*
- UK unemployment (ages 16+) stood at **5.0%** for July–September 2025, up on the prior quarter. *(ONS UK Labour Market, November 2025)*
- The UK graduate employment rate was **87.6%** in 2024 (unchanged from 2023), versus **68.0%** for non-graduates — the single clearest evidence that structured career preparation correlates with employment outcomes. *(Department for Education, Graduate Labour Market statistics 2024)*
- Of UK graduates surveyed 15 months after graduation: 87% were in work or further study, 57% specifically in full-time employment, and 7% remained unemployed. *(HESA Graduate Outcomes survey)*
- Career-services usage data suggests the gap isn't disinterest but timing: among students/graduates who hadn't recently used their university careers service, 39% said they were focused on coursework and 28% said they planned to use it later, specifically when actively job-hunting — i.e., demand concentrates right before interviews, which is exactly AscendX's use case. *(Prospects Luminate, Early Careers Survey)*

**Reading these together:** there is a large, well-documented population (hundreds of thousands of NEET young people annually, plus the wider graduate/job-seeker population) for whom employment outcomes are measurably tied to preparation, and existing evidence suggests demand for interview-specific support peaks at the exact moment AscendX is designed to serve — not earlier, when generic career-services engagement is lower.

### 5.2 Competitive landscape

| Product | Model | Funding / Scale | How it differs from AscendX |
|---|---|---|---|
| **Yoodli** | AI communication-practice coach (broader than interviews alone — also sales pitches, public speaking); freemium + paid tiers | Raised a **$40M Series B** (led by WestBridge Capital, with Neotribe and Madrona participating), bringing total funding to **~$60M**; reported **900% YoY revenue growth**. An earlier $13.7M round was raised specifically to help sales teams practice pitches. *(GeekWire; Yoodli company blog)* | Single-session feedback per practice attempt; no published cross-session adaptive-coaching architecture. Positioned broadly across communication use-cases, not interview-specific. |
| **Big Interview** | Individual subscription: **$39/month**, **$99 for 3 months**, or **$299 one-time for lifetime access** (30-day money-back guarantee); custom pricing for institutions/enterprise. *(biginterview.com pricing)* | Claims **700+ institutional customers** and **2M+ individual users** to date. *(biginterview.com)* | Video-based mock interview practice with a static question library and human-style rubric scoring; no evidence of adaptive cross-session competency tracking. |
| **Pramp** | Free peer-to-peer mock interview matching | No funding/scale data verified in this research pass | Relies on human peers rather than AI coaching — no consistency guarantee, no persistent competency tracking across sessions. |
| **Google Interview Warmup** | Free, single-session, text-based practice tool | N/A (Google product, not a standalone company) | Deliberately lightweight — no feedback depth, no follow-up probing, no session memory. Functions more as an awareness tool than a coaching product. |

**Positioning:** the best-funded comparable (Yoodli, ~$60M raised, reporting 900% revenue growth) validates that the AI-coached-practice category has real commercial traction — but it competes on breadth (any spoken communication) rather than depth in interview-specific, cross-session adaptive coaching, which is where AscendX is positioned. Big Interview shows the category supports both a real subscription business model and institutional (university/enterprise) sales channels at meaningful scale (700+ institutions), which is directly relevant evidence for section 6/7 below.

[NEEDS YOUR INPUT: this section evidences that a market and adjacent competitors exist at meaningful scale — it does not replace section 6/7. An endorsing body will still want to see where *you* fit relative to these: pricing versus Big Interview's tiers, and whether you're positioning against Yoodli's breadth-first approach or a different channel entirely (e.g., university partnerships, given Big Interview's institutional traction as a proof of that channel's viability).]

---

## 6. Business Model

[NEEDS YOUR INPUT: how does AscendX make money? Options to consider: B2C subscription, B2B2C via university career services or bootcamps, B2B via corporate outplacement/L&D budgets, freemium with paid deep-analysis tiers. Whatever the model, this needs real pricing assumptions, not placeholders — an endorsing body will test viability against this.]

---

## 7. Go-to-Market Strategy

[NEEDS YOUR INPUT: how do you plan to acquire your first 100 / 1,000 users? Channel partnerships, university relationships, content/SEO, paid acquisition, existing network? This is where "viability" gets assessed — a plan with no channel is not viable on paper regardless of product quality.]

---

## 8. Scalability & Job Creation

This is one of the three core Innovator Founder assessment criteria (alongside innovation and viability), and it needs concrete commitments, not generalities:

[NEEDS YOUR INPUT:
- What roles do you plan to hire for, and on what timeline, as the business grows (engineering, sales, customer success, etc.)?
- What does international/UK-market growth look like over 2–3 years?
- Do you have any structured growth plan already — pilot cohort numbers, conversion targets, revenue milestones tied to headcount?]

---

## 9. Team

[NEEDS YOUR INPUT: your background and why you're positioned to build this — technical skills, domain experience, any relevant prior ventures. I won't draft this section since it needs to be your genuine credentials, accurately represented — misrepresentation here is a real risk in an immigration document, not just a weak pitch.]

---

## 10. Financials & Funding

[NEEDS YOUR INPUT: current funding status (bootstrapped / raised / seeking), runway, and what resources you're bringing to satisfy the "sufficient investment/resources" viability requirement. Needs real numbers.]

---

## 11. Risks

- **Technical:** AI-generated coaching quality depends on underlying model provider (Gemini) — mitigated by the structured schema/rubric approach rather than freeform generation, but still a dependency.
- **Efficacy validation:** the product's core differentiation claim (genuine skill development, not just single-session feedback) is not yet backed by outcome data — the planned outcome-tracking feature directly addresses this.
- **Regulatory:** operates in the employment-adjacent AI space; the existing Tier-architecture and "no automated hiring decisions" design is a deliberate mitigation against EU AI Act / UK algorithmic-assessment exposure, not an afterthought.
[NEEDS YOUR INPUT: any commercial/market risks specific to your go-to-market plan once section 6/7 are filled in.]

---

*Next step: fill in the [NEEDS YOUR INPUT] sections — I can then integrate them into a coherent second draft. This document should ultimately be reviewed by your endorsing body's guidance and immigration counsel before submission; I can describe the product accurately but the business/financial claims need to come from you and the endorsement-criteria fit needs professional review.*
