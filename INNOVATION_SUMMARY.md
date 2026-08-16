# AscendX — Technical Innovation Summary

*Prepared to support the "innovative" criterion of an Innovator Founder visa application.*
*Status markers below reflect verified implementation as of 2026-08-15 — not aspirational claims. Where something is roadmap rather than shipped, it is labelled as such.*

---

## 1. What problem this solves

The AI interview-coaching market is dominated by tools that wrap a large language model around a single practice session: a candidate answers, the model scores the answer, the session ends, and nothing about that candidate persists. AscendX is built on a different premise — that interview competence is a *developed skill*, not a single measurable event, and that a coaching product should be able to demonstrate whether a candidate is actually improving across attempts, not just critique the most recent one.

## 2. What makes the approach original

### 2.1 A grounded, falsifiable methodology — not prompt engineering
AscendX's evaluation and feedback architecture is built directly from published occupational psychology and learning-science research rather than ad hoc prompting: Kolb's Experiential Learning Cycle (1984) as the session structure, the AMO framework (Appelbaum et al., 2000) to distinguish *ability* gaps from *motivation* or *opportunity* gaps before attributing weak performance, Vygotsky's Zone of Proximal Development (1978) to separate what a candidate can do independently from what they can do with structured support, and Hattie & Timperley's (2007) feedback-level model to sequence coaching depth across a candidate's session history. This is documented as a full theoretical framework (internal reference: `FRAMEWORK.md`, ~30 cited sources) and — critically — has been independently code-audited against the live implementation to confirm the mechanisms are real, not just described.

### 2.2 Genuine cross-session adaptive tracking
Each candidate accumulates a `MesoAccumulator` record across sessions that computes, via least-squares regression (not a simple before/after diff):
- **Competency trend** — is demonstrated skill improving session over session
- **Scaffold dependency trend** — is the candidate needing less structured support over time, with support automatically fading when the trend is confirmed (an implementation of the "expertise reversal effect," Kalyuga 2007 — scaffolding that helps novices actively hinders those developing independence)
- **ZPD lower-boundary drift** — computed from paired unscaffolded (Act 1) and scaffolded (post-probe) performance per question, tracking whether coached behaviour is being internalised into independent performance, not just repeated with help

First-session candidates are provably unaffected by any of this (null-safe by construction) — the adaptive layer only activates once there is genuine history to adapt to.

### 2.3 Responsible-AI architecture, not an afterthought
The system enforces a three-tier data model: candidate-facing output uses behavioural language only, with no numerical scores or psychological labels; internal signals (AMO readiness, ZPD boundaries) drive that output but are never exposed; and a third, researcher-only tier carries raw data with validity disclaimers, gated separately from the candidate view. All AI inference runs behind a backend proxy — no API credentials are ever present in the client. There is no cross-candidate comparison anywhere in the scoring pipeline (every signal is relative to the candidate's own baseline), and no pass/fail or hire/no-hire output exists at any layer, keeping the product a coaching tool rather than an automated employment-decision system (relevant under UK/EU algorithmic-assessment norms). Candidates can formally flag any section of a report for human review, and that flag is persisted and auditable.

## 3. Why this is defensible as "innovative," not incremental
The individual components (Kolb, AMO, ZPD, PsyCap) are each well-established in occupational psychology; the innovation is their integration into a single computationally operationalised architecture for AI-delivered interview coaching, with cross-session persistence and adaptive behaviour that most competing tools do not attempt because it requires longitudinal state, not just single-turn prompting. This is verifiable in the codebase, not only asserted in a pitch.

## 4. What is genuinely still roadmap (honesty matters here)
- **Outcome validation** — tracking whether coached candidates go on to succeed in real interviews is designed but not yet built; this is the next planned addition and would convert the above into an evidence-backed efficacy claim rather than a design claim.
- **External instrument validation** — the framework specifies several validated psychometric instruments (Regulatory Focus Questionnaire, Career Adapt-Abilities Scale, etc.) for future research-grade validation of the AI-inferred signals against established measures; this has not yet been run.
- Some framework mechanisms remain UI-only in "researcher mode" pending broader release decisions on what to surface to general users.

---

*This document should be reviewed by qualified immigration counsel before submission — it describes the technical product accurately but does not constitute legal or endorsement-criteria advice.*
