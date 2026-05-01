# AscendX Theoretical Framework
## Integrated Occupational Psychology & Learning Pedagogy Architecture

> **Status:** Design specification — approved, not yet implemented.
> **Constraint:** No changes to existing system behaviour until explicitly authorised.
> **Author:** Framework designed April 2026, grounded in peer-reviewed literature.

---

## 1. Framework Overview

AscendX operates as a **structured interview coaching environment** for early-career candidates and students. The evaluation and feedback system must simultaneously:

1. Accurately assess interview **competency demonstration**
2. Reflect the conditions under which performance occurs (**performance readiness**)
3. Build candidates' capacity to **self-evaluate and improve** across sessions
4. Deliver feedback in language that is **motivating, actionable, and ethically sound**

This framework integrates four primary theoretical pillars — DMGT, AMO, ZPD, and DCT — with a five-component feedback sequence grounded in learning pedagogy research on formative assessment and early-career coaching.

---

## 2. Primary Theoretical Pillars

### 2.1 DMGT — Differentiated Model of Giftedness and Talent
**Source:** Gagné, F. (2013). The DMGT: Changes within, beneath, and beyond. *Talent Development & Excellence*, 5(1), 5–19.

**Application in AscendX:**

DMGT distinguishes between:
- **Giftedness (G):** Natural abilities — cognitive, creative, social, perceptual — that a person already possesses
- **Talent (T):** Systematically developed competency in a specific domain, emerging from giftedness through deliberate practice

AscendX functions as an **environmental catalyst (EC)** in DMGT terms — a structured environment that converts natural communication abilities and general cognitive capacity into interview performance talent through deliberate practice, structured probing, and targeted feedback.

**Implication for design:**
- The system should frame itself as a **development environment**, not an assessment pass/fail gate
- Feedback language should reference the candidate's **trajectory** (giftedness → talent development) rather than fixed ability
- Repeated use across sessions is the mechanism by which talent develops — the system must track and reinforce cross-session growth

**Current system gap:** AscendX treats each session as independent. DMGT requires a **longitudinal development record** linking sessions into a growth trajectory.

---

### 2.2 AMO — Ability × Motivation × Opportunity
**Source:** Appelbaum, E., Bailey, T., Berg, P., & Kalleberg, A. (2000). *Manufacturing Advantage: Why High-Performance Work Systems Pay Off*. Cornell University Press.

**Application in AscendX:**

AMO proposes that performance is the product of three conditions, all of which must be present:

| Condition | Definition | AscendX Application |
|-----------|-----------|-------------------|
| **Ability (A)** | Does the candidate have the skills and knowledge to perform the behaviour? | STAR coaching — what to say, how to structure it |
| **Motivation (M)** | Does the candidate want to perform the behaviour in this context? | Role alignment — are they genuinely interested in this type of role? |
| **Opportunity (O)** | Does the environment allow the behaviour to occur? | Interview format, question phrasing, psychological safety in the AI coaching space |

**Critical insight:** The current system only addresses **Ability**. A candidate who gives a weak response may be able but unmotivated (wrong role), or able and motivated but without opportunity (poorly framed question, anxiety blocking performance). Without AMO diagnosis, the system risks misattributing performance gaps.

**Implication for design:**
- Add a **Motivation signal** derived from role alignment language (candidate describing the role in terms of personal fit, interest, growth)
- Add an **Opportunity signal** derived from response hesitancy, question clarification requests, and ZPD gap size (very large gap = question too difficult = opportunity failure)
- The competency report should surface AMO conditions, not just competency ratings, when performance is unexpectedly weak

---

### 2.3 ZPD — Zone of Proximal Development (properly applied)
**Source:** Vygotsky, L.S. (1978). *Mind in Society.* Harvard University Press.
**Application source:** Wood, D., Bruner, J.S., & Ross, G. (1976). The role of tutoring in problem solving. *Journal of Child Psychology and Psychiatry*, 17(2), 89–100.

**Correct application:**

ZPD is defined as the distance between:
- **Lower boundary:** What the candidate can do independently (Act 1 unprobed response)
- **Upper boundary:** What the candidate can do with structured support (post-probe response)

The **gap** between boundaries = the candidate's current development target.

**Cross-session ZPD tracking:**
- Session 1: Lower boundary = baseline. Upper boundary = probed performance.
- Session 2: Lower boundary should rise toward Session 1's upper boundary (if development occurred).
- If lower boundary does not rise across sessions, scaffolding approach needs adjustment.

**What ZPD is NOT (correction of prior system):**
- ZPD is not a fixed modulation parameter set at session start
- ZPD is not equivalent to difficulty level
- ZPD cannot be measured without observing both unprobed AND probed responses — you need both data points

**Implication for design:**
- Store **Act 1 score** and **post-probe score** as separate data points per question per session
- Track **lower boundary drift** across sessions as the primary development signal
- Scaffold intensity should be inversely proportional to the current gap size (large gap = more scaffolding)

---

### 2.4 DCT — Dual Coding Theory
**Source:** Paivio, A. (1986). *Mental Representations: A Dual Coding Approach.* Oxford University Press.
**CTML extension:** Mayer, R.E. (2009). *Multimedia Learning* (2nd ed.). Cambridge University Press.

**Application in AscendX:**

DCT proposes that humans process information through two independent but interconnected systems:
- **Verbal channel:** Language, narration, text
- **Visual channel:** Images, diagrams, spatial organisation

Learning is most effective when both channels are engaged simultaneously with complementary (not redundant) information.

**Current AscendX implementation of DCT:**
- STAR checklist (visual, structured) + coaching text (verbal, explanatory) = correct dual encoding
- Question display with role/company context (visual frame) + the question text (verbal) = correct
- Report sections with headers and structure (visual) + explanation text (verbal) = correct

**Where DCT is violated:**
- Long blocks of undifferentiated coaching text = verbal channel overload, visual channel idle
- Numerical scores in text without visual contrast = no dual channel benefit
- Feedback delivered entirely as prose = misses visual encoding opportunity

**Implication for design:**
- Every feedback output should pair a **visual summary element** (level indicator, STAR map, competency label) with **explanatory prose** (coaching text)
- Avoid pure-text score delivery — always attach a visual anchor
- The Competency Demonstration level (Emerging/Developing/Established/Advanced) serves as the visual anchor for the verbal coaching explanation

---

## 3. Evaluation Architecture

### 3.1 Three Evaluation Dimensions

Replace the current five-rubric numerical scoring system with three qualitative dimensions:

#### Dimension 1: Competency Demonstration
*What the candidate showed they can do.*

| Level | Description | Indicator |
|-------|-------------|-----------|
| **Emerging** | Candidate references the competency implicitly, without concrete evidence | Situation/Task present, no clear Action or Result |
| **Developing** | Candidate demonstrates the competency with partial structure; some behavioural evidence present | STAR partially complete, vague outcome |
| **Established** | Clear, structured demonstration with behavioural evidence and outcome | Full STAR with measurable or describable result |
| **Advanced** | Unprompted, multi-layered demonstration with cross-contextual application and reflection | Proactive framing, multiple examples, metacommentary |

**Important:** These labels are **internal signals** only. Candidate-facing language uses behavioural descriptors, not level labels.

#### Dimension 2: Performance Conditions Readiness (AMO)
*Whether the environment allowed the performance we observed.*

| Signal | High Readiness | Low Readiness |
|--------|---------------|--------------|
| **Ability** | Full STAR without probing | Incomplete STAR after probing |
| **Motivation** | Role alignment language, intrinsic framing | Extrinsic language, uncertainty about role fit |
| **Opportunity** | Fluent response, no clarification needed | Hesitation, clarification requests, very large ZPD gap |

**Use:** Low AMO readiness should generate coaching output explaining *conditions*, not criticising *capability*.

#### Dimension 3: Development Trajectory (ZPD)
*Whether the candidate is growing.*

| Signal | Interpretation |
|--------|---------------|
| Act 1 → post-probe delta (within session) | Scaffolding responsiveness — how well candidate uses structured support |
| Lower boundary shift (across sessions) | Internalisation — whether coached behaviours become independent |
| Upper boundary ceiling (across sessions) | Development ceiling — used to increase challenge level when upper boundary plateau |

---

### 3.2 Tier Architecture (Signal Visibility)

| Tier | Audience | Content | Visibility |
|------|----------|---------|-----------|
| **Tier 1** | Candidate | Behavioural language only. No psychological labels, no numerical scores. Competency Demonstration level shown as descriptor text. | Always visible |
| **Tier 2** | Internal system | Drives Tier 1 output. AMO signals, ZPD boundaries, DMGT trajectory. Never shown to candidate. | Never shown |
| **Tier 3** | Researcher/Admin | Exploratory signals, raw data, experimental metrics. Validity disclaimers attached. Research consent required. | Researcher only |

---

## 4. Feedback Architecture

### 4.1 Theoretical Grounding

**Hattie & Timperley (2007) — Three Feedback Levels:**
> Hattie, J., & Timperley, H. (2007). The power of feedback. *Review of Educational Research*, 77(1), 81–112.

| Level | Focus | AscendX Use |
|-------|-------|------------|
| **Task** | Correctness of the specific answer | Session 1 feedback — focus on STAR structure |
| **Process** | Strategy and approach to answering | Sessions 2–3 — focus on HOW candidate constructs evidence |
| **Self-regulation** | Monitoring and self-evaluation | Sessions 4+ — focus on candidate evaluating their own responses before coach feedback |

**Nicol & Macfarlane-Dick (2006) — 7 Principles of Good Feedback:**
> Nicol, D.J., & Macfarlane-Dick, D. (2006). Formative assessment and self-regulated learning. *Studies in Higher Education*, 31(2), 199–218.

1. Clarifies what good performance is (goals, criteria, standards)
2. Facilitates self-assessment
3. Delivers high-quality information about learning
4. Encourages dialogue with teacher/coach
5. Encourages positive motivational beliefs and self-esteem
6. Provides opportunities to close the gap between current and desired performance
7. Provides information to teachers that can be used to shape teaching

**Boud & Molloy (2013) — Sustainable Feedback:**
> Boud, D., & Molloy, E. (2013). *Feedback in Higher and Professional Education.* Routledge.

Feedback is only effective if it builds the candidate's capacity to **self-evaluate without external input**. The system should progressively reduce external scaffolding as the candidate develops self-assessment accuracy.

---

### 4.2 Five-Component Feedback Sequence

Every post-question feedback output follows this sequence:

#### Component 1: Self-Assessment First
*Grounded in Boud & Molloy (2013) Principle: build self-evaluation capacity*

> "Before we look at the coaching, take a moment — what part of your answer do you think was strongest? What would you change?"

**Purpose:** Activates metacognition before external input. Prevents over-reliance on external evaluation. Builds the habit of self-monitoring that transfers to real interviews.

**System behaviour:** Self-assessment prompt is displayed before coaching reveal. Candidate can respond or skip. Response is logged for Tier 2 calibration signal.

---

#### Component 2: Calibration
*Grounded in Hattie & Timperley (2007) Task level + PsyCap Efficacy (Luthans, 2007)*

> Validate accurate self-assessment. Gently reframe inaccurate self-assessment without discouraging.

**If candidate self-assessment is accurate:**
> "You've identified the same area the coaching focuses on — that kind of self-awareness is exactly what develops quickly."

**If candidate overestimates:**
> "You're right that [X] was strong. The coaching also points to [Y] as an area to develop — which is very common at this stage."

**If candidate underestimates:**
> "You were harder on yourself than the evidence supports. [Specific behaviour] is an established signal of [competency] — don't discount it."

**PsyCap Efficacy link:** The calibration step protects against efficacy collapse (candidate dismisses genuine strengths) and efficacy inflation (candidate doesn't recognise development areas).

---

#### Component 3: Competency Demonstration Feedback
*Grounded in Hattie Task/Process level + Nicol Principle 1 (clarifies standards)*

Structured as: **Evidence cited → Behavioural descriptor → Development direction**

Format:
> "In your response, you [specific quoted or paraphrased behaviour]. This demonstrates [behavioural descriptor of competency — not the competency name itself]. To move toward [next level descriptor], consider [specific, actionable behaviour change]."

**Rules:**
- Quote or closely paraphrase the candidate's own words
- Use behavioural language only (no psychological labels in Tier 1)
- Name the development direction without attaching a score
- Do not compare to other candidates

---

#### Component 4: Process Coaching
*Grounded in Wood et al. scaffolding + Nicol Principle 6 (close the gap)*

STAR-level coaching targeted at the specific gap observed:

| STAR Gap | Coaching Focus |
|----------|---------------|
| Missing Situation | "Give the interviewer enough context to picture the scenario" |
| Missing Task | "Make your responsibility explicit — what were YOU specifically accountable for?" |
| Weak/Missing Action | "Walk through the specific steps you took — not the team, not the outcome, but your exact actions" |
| Missing Result | "Interviewers need to know what changed because of what you did — quantify if possible, describe if not" |
| All present, lacks depth | "Add a reflection — what did you learn, and how did it change your approach?" |

---

#### Component 5: Forward Orientation
*Grounded in Career Adaptability (Savickas, 2012) + PsyCap Hope (Luthans, 2007)*

Closes every feedback with a **development direction and motivational anchor**, not a summary of deficits.

> "[Competency area] is a skill that develops fastest through repeated practice in structured situations — exactly what you're doing here. Next time, try [specific single action]. Small, deliberate changes compound quickly."

**Career Adaptability 4 Cs link:**
- **Concern:** Orients candidate to their career future (not just the immediate interview)
- **Control:** Reinforces that their performance is in their own hands
- **Curiosity:** Encourages exploration of different approaches
- **Confidence:** Affirms developmental trajectory

**PsyCap Hope link:** Hope = willpower (motivation) + waypower (having a pathway). Forward orientation provides both: "you can improve" (willpower) and "here is how" (waypower).

---

## 5. Supporting Frameworks (Secondary)

### 5.1 PsyCap — Psychological Capital
**Source:** Luthans, F., Youssef, C.M., & Avolio, B.J. (2007). *Psychological Capital: Developing the Human Competitive Edge.* Oxford University Press.

HERO model — four resources that predict performance under challenge:
- **Hope:** Pathways + agency thinking
- **Efficacy:** Task-specific confidence (Bandura, 1997)
- **Resilience:** Adaptive recovery from setbacks
- **Optimism:** Attribution of success to stable internal factors

**AscendX application:** Feedback language should reinforce all four. Avoid language that attributes weak performance to stable internal deficits (efficacy destruction). Attribute weak performance to learnable, changeable behaviours (hope + resilience framing).

---

### 5.2 SCCT — Social Cognitive Career Theory
**Source:** Lent, R.W., Brown, S.D., & Hackett, G. (1994). Toward a unifying social cognitive theory of career and academic interest, choice, and performance. *Journal of Vocational Behavior*, 45(1), 79–122.

**Core mechanism:** Career self-efficacy beliefs → outcome expectations → career interests → career goals

**AscendX application:** Every session that builds a successful interview performance experience (even partial) contributes to career self-efficacy. The system is not just assessing — it is building the belief that the candidate can succeed in professional interviews. Feedback design must protect and build this belief, especially after weak sessions.

---

### 5.3 Career Adaptability (Savickas, 2012)
**Source:** Savickas, M.L. (2012). Life design: A paradigm for career intervention in the 21st century. *Journal of Counseling & Development*, 90(1), 13–19.

**4 Cs — especially relevant for early-career candidates:**
- **Concern:** Planning orientation — thinking about the future
- **Control:** Belief in personal agency over career outcomes
- **Curiosity:** Exploring possible selves and roles
- **Confidence:** Self-efficacy for career tasks

**AscendX application:** Forward Orientation (Component 5 of feedback sequence) directly targets all four Cs. The coaching environment itself, by providing structure and agency, builds adaptability resources.

---

## 6. Academic Reading List (For Framework Validation)

### Foundational Occupational Psychology
- Appelbaum, E. et al. (2000). *Manufacturing Advantage.* Cornell University Press.
- Luthans, F. et al. (2007). *Psychological Capital.* Oxford University Press.
- Lent, R.W. et al. (1994). SCCT. *Journal of Vocational Behavior*, 45(1), 79–122.
- Savickas, M.L. (2012). Life design. *Journal of Counseling & Development*, 90(1), 13–19.

### Competency Assessment
- Bartram, D. (2005). The Great Eight competencies. *Journal of Applied Psychology*, 90(6), 1185–1203.
- Spencer, L.M., & Spencer, S.M. (1993). *Competence at Work.* Wiley.
- Campion, M.A. et al. (1994). Structured interviewing. *Personnel Psychology*, 47(4), 655–702.
- Schmidt, F.L., & Hunter, J.E. (1998). Validity and utility of selection methods. *Psychological Bulletin*, 124(2), 262–274.

### Feedback Theory
- Hattie, J., & Timperley, H. (2007). The power of feedback. *Review of Educational Research*, 77(1), 81–112.
- Nicol, D.J., & Macfarlane-Dick, D. (2006). Formative assessment and SRL. *Studies in Higher Education*, 31(2), 199–218.
- Boud, D., & Molloy, E. (2013). *Feedback in Higher and Professional Education.* Routledge.
- Shute, V.J. (2008). Focus on formative feedback. *Review of Educational Research*, 78(1), 153–189.

### Talent Development & Learning
- Gagné, F. (2013). The DMGT: Changes within, beneath, and beyond. *Talent Development & Excellence*, 5(1), 5–19.
- Wood, D., Bruner, J.S., & Ross, G. (1976). The role of tutoring. *Journal of Child Psychology and Psychiatry*, 17(2), 89–100.
- Vygotsky, L.S. (1978). *Mind in Society.* Harvard University Press.
- Paivio, A. (1986). *Mental Representations: A Dual Coding Approach.* Oxford University Press.
- Mayer, R.E. (2009). *Multimedia Learning* (2nd ed.). Cambridge University Press.

### Psychometrics & Assessment Standards
- Standards for Educational and Psychological Testing (2014). AERA/APA/NCME.
- British Psychological Society (2017). *Psychological Testing: A Test Taker's Guide.*
- EFPA (2013). *European Test Review Model.* European Federation of Psychologists' Associations.
- Society for Industrial and Organisational Psychology (2018). *Principles for the Validation and Use of Personnel Selection Procedures* (5th ed.).

### AI Ethics & Algorithmic Assessment
- Dietvorst, B.J. et al. (2015). Algorithm aversion. *Journal of Experimental Psychology: General*, 144(1), 114–126.
- Whittaker, M. et al. (2018). *AI Now Report.* AI Now Institute.
- IEEE Std 7001-2021: Transparency of Autonomous Systems.
- EU AI Act (2024): Articles on high-risk AI systems in employment contexts.

---

## 7. What Must Change to Implement This Framework

> This section lists what implementation would require — for planning purposes only.
> **No changes have been made to the existing system.**

### Prompt changes required (questionService.ts, probingService.ts):
- Remove CHC labels (Gc, Gf, Gq) from evaluation prompts — replace with behavioural descriptors
- Remove SDT Merit Vectors terminology — replace with "ownership language density"
- Remove Goffman Impression Management scores — replace with "presentation authenticity signal"
- Replace 0–10 numerical rubric scores with Emerging/Developing/Established/Advanced levels
- Add AMO condition signals to evaluation output
- Add ZPD boundary tracking (Act 1 score + post-probe score stored separately)

### Data model changes required (sessions table):
- Add per-question `act1_signal` and `probed_signal` fields (for ZPD tracking)
- Add `amo_readiness` per question
- Add cross-session lower boundary tracking

### Feedback prompt changes required (feedbackService.ts / reportService.ts):
- Implement Five-Component Feedback Sequence
- Add Self-Assessment First prompt before coaching reveal
- Add Calibration logic based on self-assessment accuracy
- Replace numerical score display with behavioural descriptor display
- Add Forward Orientation component to every feedback output

### Frontend changes required (AscendPlatform.tsx / report components):
- Remove numerical score displays from candidate-facing reports
- Add visual competency level indicators (Emerging → Advanced)
- Add self-assessment prompt UI before coaching reveal
- Add AMO condition display (why performance may have been affected)

---

## 8. Ethical Notes

- **No scores shown to candidates.** Competency Demonstration levels are internal signals; Tier 1 output is behavioural language only.
- **No comparison to other candidates.** All feedback is within-candidate, relative to their own baseline and trajectory.
- **No permanent deficit labels.** All competency levels are time-stamped and expected to change. The system must communicate this to candidates.
- **AMO conditions protect against misattribution.** Weak performance is not automatically attributed to low ability — motivation and opportunity conditions are surfaced.
- **GDPR Article 22 compliance:** The system produces coaching feedback, not automated decisions. No hiring decisions are made or recommended. Human oversight flags (feedback_flags table) allow candidates to dispute any section of their report.
- **EU AI Act alignment:** The system operates as a high-risk AI application (employment domain). Tier 3 data carries validity disclaimers. Transparency mechanism (Tier architecture) is built into the data model.
