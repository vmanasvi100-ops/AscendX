x# AscendX — Technical Workflow Report

*A detailed account of what actually happens, mechanically and theoretically, during an AscendX session — written for candidates who want to understand the system they're using, not just use it. Everything below describes the verified, working implementation as of this report's writing, not aspirational design.*

---

## 1. What AscendX Is Actually Doing

Most AI interview tools score one answer and discard all context. AscendX treats interview competence as a *developed skill*, which means the system is built around two ideas working together:

1. **Within a session**, every answer gets a structured follow-up (a "probe") specifically designed to distinguish what you can do independently from what you can do with support — that gap is the actual signal, not a side detail.
2. **Across sessions**, your independent performance, your dependence on scaffolding, and your development trajectory are tracked with real statistical computation (not vibes), so later sessions genuinely adapt to where you actually are.

Nothing here produces a hire/no-hire decision, a score shown as a number to you, or a comparison against other candidates. That's a deliberate architectural boundary — detailed in Section 7.

---

## 2. Session Setup

Before the first question, three things happen:

- **CV + job description intake.** If provided, your CV is analyzed for alignment against the specific job description — not a generic skills match, but an identification of which of your experiences are strongest evidence for which competencies this specific role needs.
- **Question generation.** Questions are generated in phases: a baseline repository fires instantly (no AI call, zero latency), then role-tailored questions generate in the background from the job description, then CV-specific questions layer in once your CV has been analyzed. Each generated question carries metadata beyond its text: a target competency, a difficulty level, an "excellence benchmark" (what a top-tier answer looks like), and — critically — a set of **discriminant signals**: explicit statements of what separates a good answer from an exceptional one for that specific competency. These signals are what probes get targeted against later; they're what make probing role-specific rather than generic.
- **Consent.** NDA acknowledgment and hardware (camera/mic) consent are captured and recorded server-side before any session data is generated, tied to your registered email.

---

## 3. The Core Loop: STAR Progression → Automatic Probe → Analysis

### 3.1 STAR phases

Each question walks through four phases — Situation, Task, Action, Result — matching the standard structured-interview format (Campion et al., 1994). You answer each phase in sequence; there's no AI intervention yet at this stage, just structured capture.

### 3.2 Why a probe fires automatically

The moment all four STAR phases are complete, the system automatically generates exactly one follow-up probe. This isn't triggered by the AI judging your answer weak — it's structural. The theoretical basis is Kolb's Experiential Learning Cycle (1984): your STAR answer is "Concrete Experience," and the probe is "Reflective Observation" — the stage that makes the experience usable for learning. Skip it, and the cycle can't reach "Abstract Conceptualisation" (the actual coaching insight) or "Active Experimentation" (what you try differently next time). A session without probing is practice without learning, not just a shorter session — so it isn't optional or conditional on your answer quality.

Beyond that single automatic probe, you can request additional follow-ups via a "Deep Probe" button — manual, not automatic, and disabled on the very first question so there's no immediate follow-up pressure before you've found your footing.

### 3.3 The ZPD dual-boundary mechanism

This is the mechanism underneath "probing" that actually matters most. Every question runs **two separate analyses**:

- **Act 1 (unprobed):** your initial answer, analyzed on its own — what you could demonstrate independently.
- **Post-probe:** your answer after the follow-up — what you could demonstrate with structured support.

These are stored as genuinely separate data points per question, tagged `zpd_boundary_type: 'act_one' | 'probed'`. The gap between them is Vygotsky's Zone of Proximal Development (1978): the distance between independent and supported performance. This gap gets tracked across your entire session history (see Section 5) — not just within one question — via a real least-squares regression over your "lower boundary" scores session-over-session, so the system can actually tell whether your independent performance is rising over time, versus just getting temporarily unstuck with help each session.

### 3.4 Choosing what kind of probe to ask

When a probe is generated, the system picks from five types, each targeting a different failure mode in your answer:

| Type | Used when |
|---|---|
| **CLARIFYING** | A CV claim or professional term needs grounding |
| **CONCRETE** | An abstract statement needs specific evidence |
| **DEEPENING** | The answer is already strong and can go further |
| **REDIRECTING** | The answer has drifted off-topic |
| **STRATEGIC** | Late-session, testing assumptions/systemic thinking |

The choice isn't random or purely reactive to your last sentence. It's shaped by:

- **Session phase.** Early phases favor supportive, structural probes (CLARIFYING); late phases favor challenge (STRATEGIC). Phase boundaries themselves shift earlier if your cross-session history shows reduced scaffold dependency (Section 5.2) — the system gives you harder probes sooner once it has evidence you don't need as much support.
- **An AMO opportunity check** (Appelbaum et al., 2000). Before issuing a challenging probe, the system checks whether high anxiety combined with an early session phase might cause an "opportunity failure" — a situation where you *can't* demonstrate real ability not because it's absent, but because the moment is working against you. Under those conditions, it deliberately prefers CONCRETE/CLARIFYING over STRATEGIC/DEEPENING.
- **Discriminant signals** from the question's metadata — the probe is explicitly instructed to target the specific evidence that separates a good answer from an exceptional one for your target role, not a generic competency category.

Hard constraints on every probe: it must quote your own language back to you (never a generic question that could apply to anyone), capped at 35 words, never phrased as "tell me more" (flagged as too generic to be useful), and it never names a psychological framework to you directly.

### 3.5 What gets analyzed in your response

Every response — Act 1 or post-probe — runs through a single detailed analysis producing a wide signal set:

- **STAR status** per component (complete/partial/missing)
- **Behavioral evidence density** — ownership language ("I decided"), skill-execution language (named tools/outputs), impact language (named people/effects) — these three dimensions are grounded in structured-interview validity research (Levashina & Campion, 2007) as the evidence quality indicators that actually predict criterion validity, not just face validity
- **Presentation authenticity** — a "front-stage" (polished, CV-close) vs. "back-stage" (genuine, unguarded) distinction (Cable & Kay, 2012). This is explicitly *not* a deception-detection score — there's no reliable way to determine inflation vs. accurate self-report from a transcript alone, so the system treats high back-stage language as a coaching signal (authentic self-verification), not a lie detector.
- **Scaffold dependency** — did you need explicit structural hints to produce this content, or did you produce it unprompted?
- **Competency demonstration level** — Emerging / Developing / Established / Advanced, based on STAR completeness and evidence quality (never shown to you as a label — described behaviorally instead)
- **AMO readiness** — ability / motivation / opportunity, each rated, so weak performance isn't automatically attributed to low ability when the real cause might be situational
- **Competency verification** *(the field that matters most for accuracy)* — a separate, independent judgment: not "did you follow the right structure," but "is the specific competency this question targets actually confirmed by quotable evidence." A candidate can have complete STAR structure with vague, unverified competency evidence, or incomplete structure with one sharp, clearly verifying piece of evidence — these are deliberately kept as two different measurements so neither gets diluted into the other.
- **Graduate Capital signal** — each verified competency is also classified against Tomlinson's (2017) five forms of graduate capital: Human (raw skill/knowledge), Social (networks, working through others), Cultural (organisational/sector fit and self-presentation), Psychological (resilience, adaptability under pressure), and Identity (coherent professional self-narrative). This runs as an additional lens on top of verification, not a replacement for it.

---

## 4. Per-Question Summary and Feed-Forward

After each question, a summary report is generated covering strengths, development points (with *why it matters* and a specific instruction, not just "improve this"), and how the probe exchange went. One specific mechanic worth knowing: your **forward orientation note** — the single most important thing to try differently — doesn't just sit in that question's report. It gets threaded into the next question's probe generation (so Question 2's probe can check whether you've already started acting on Question 1's feedback) and, if you complete a whole session, into your *next session's* first probe as well. The system is explicitly checking whether coaching advice compounds across sessions, not just whether each session's feedback sounds good in isolation.

---

## 5. End-of-Session: The Five-Component Feedback Sequence and Cross-Session Tracking

### 5.1 The feedback sequence itself

Every full session closes with feedback structured in a specific five-part sequence, mapped directly to Gibbs' Reflective Cycle (1988):

1. **Self-Assessment First** — you're asked what you think was strongest and what you'd change, *before* seeing the AI's coaching. This activates your own metacognition first (Boud & Molloy, 2013) rather than training you to wait for external judgment.
2. **Calibration** — the system compares your self-assessment to its own, and gently reframes if you under- or over-estimated, protecting efficacy either direction rather than just "correcting" you.
3. **Competency Demonstration Feedback** — structured as evidence cited → behavioral descriptor → development direction, always quoting your actual words.
4. **Process Coaching** — specific STAR-gap coaching (e.g., "missing Result" gets different coaching than "weak Action").
5. **Forward Orientation** — closes with a single next action, deliberately targeting only the *next* stage of career-adaptability development (Savickas, 2012's four Cs: Concern → Control → Curiosity → Confidence), not all of them at once.

### 5.2 What persists across sessions

If you complete more than one session, a `MesoAccumulator` tracks your development with real computation, not qualitative impressions:

- **Competency slope** — a least-squares regression across your session history's competency levels, not a simple before/after comparison.
- **Scaffold dependency trend** — same regression method, applied to how much structural support you've needed. When this trend shows meaningful reduction, the system advances difficulty thresholds by one phase index — an implementation of the Cognitive Load Theory "expertise reversal effect" (Kalyuga, 2007): scaffolding that helped you as a novice starts actively getting in your way once you're more capable, so it's withdrawn.
- **ZPD lower-boundary trend** — specifically the Act-1 (unprobed) side of the dual-boundary measurement from Section 3.3, tracked on its own regression line, answering "is your *independent* performance actually rising," distinct from your overall competency trend.
- **Regulatory focus shift** — whether your language has shifted between promotion-framing (building strengths) and prevention-framing (closing gaps) across sessions, so coaching tone can blend both when a shift is detected.
- **Feedback orientation trend** — whether you're becoming more proactive in engaging with feedback over time (Winstone, 2017's recipience framework).
- **Mastery consolidation** — STAR components you've demonstrated reliably across at least two sessions get marked consolidated, which is what actually advances your career-adaptability stage (Section 5.1's Component 5) — the system won't claim you've built "Control" (agency) until there's repeated evidence, not a single good session.

First-session candidates are completely unaffected by any of this — the entire mechanism is null-guarded until there are at least two sessions of real history.

---

## 6. Graduate Capital Correlation (Session-Level)

Section 3.5 classifies capital signals per response. At the session level, those get tallied: across every *verified* competency in your session, which of Tomlinson's five capitals showed up, and how often. This produces a distribution, not a single score — and if a capital comes back with zero evidence across the whole session, the system flags it explicitly as a gap worth addressing (not just a missing data point), particularly if your target role is likely to weigh that capital heavily — team-facing roles and Social capital, culture-sensitive employers and Cultural capital, for example.

---

## 7. What You Never See, and Why

AscendX enforces a three-tier data model:

- **Tier 1 (you):** behavioral language only. No numerical scores, no psychological labels, no framework names. Competency levels are described, never shown as a raw label like "Developing."
- **Tier 2 (internal):** the AMO signals, ZPD boundaries, and raw analysis that *drive* your Tier 1 feedback, but are never exposed directly.
- **Tier 3 (research, access-gated):** raw numeric rubrics, capital tallies, calibration-accuracy data — intended for product/research review, not candidate consumption.

Two structural guarantees worth knowing explicitly: **no comparison to any other candidate** exists anywhere in the scoring pipeline — every signal is relative to your own baseline — and **no hire/no-hire or pass/fail output** exists at any layer. This is a coaching tool, not an automated employment-decision system; that boundary is enforced by what the architecture is built to produce, not just a policy statement.

On the infrastructure side: all AI processing happens through a backend proxy, not directly from your browser, specifically so no API credentials or raw model access is exposed client-side. Your NDA/consent status and registered email are the identity data tied to your account. Session analytics use a separate identifier (`participantId`) rather than embedding your email directly in each event — but that identifier is **pseudonymous, not anonymous**: it's deliberately joinable back to your registered email (so cross-session exports can be correlated), which under UK GDPR still makes it personal data, not anonymous data. Worth knowing precisely rather than assuming "separate ID" means "untraceable."

---

## 8. Theoretical Grounding — Quick Reference

| Mechanism | Primary source |
|---|---|
| Session structure (CE→RO→AC→AE) | Kolb, D.A. (1984). *Experiential Learning.* |
| Probe targeting (ZPD) | Vygotsky, L.S. (1978). *Mind in Society*; Wood, Bruner & Ross (1976) |
| Scaffold fading | Kalyuga, S. (2007). Expertise reversal effect. *Educational Psychology Review* |
| Probe specificity requirement | Ericsson, K.A. et al. (1993). Deliberate practice. *Psychological Review* |
| Evidence quality signals | Levashina, J., & Campion, M.A. (2007). *Journal of Applied Psychology* |
| Authenticity framing | Cable, D.M., & Kay, V.S. (2012). *Academy of Management Journal* |
| Feedback sequencing | Hattie, J., & Timperley, H. (2007); Gibbs, G. (1988) |
| Self-assessment-first | Boud, D., & Molloy, E. (2013) |
| AMO performance attribution | Appelbaum, E. et al. (2000). *Manufacturing Advantage* |
| Forward orientation / career stage | Savickas, M.L. (2012). *Journal of Counseling & Development* |
| Feedback engagement tracking | Winstone, N.E. et al. (2017). *Educational Psychologist* |
| Graduate capital correlation | Tomlinson, M. (2017). *Education + Training*, 59(4), 338–352 |

---

*This report describes the system as implemented and verified, not as originally designed on paper — several mechanisms here (notably the ZPD lower-boundary tracking and the competency-verification/capital layers) were corrected or added during active development specifically because earlier versions claimed behavior the code didn't yet match. If something here looks inconsistent with what you experience in a session, that's worth reporting — it may be exactly the kind of drift this report is meant to prevent.*
