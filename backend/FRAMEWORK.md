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

This framework is grounded in **Kolb's Experiential Learning Cycle (ELC, 1984)** as the primary theoretical spine, supported by Cognitive Load Theory (CLT), Zone of Proximal Development (ZPD), and Self-Regulated Learning (SRL). The five-component feedback sequence maps explicitly to **Gibbs' Reflective Cycle (1988)**, operationalising formative feedback research (Hattie & Timperley, 2007; Winstone, 2017) in a structured professional development context. Deliberate Practice (Ericsson, 2016) defines the mechanism by which repeated sessions build expertise.

---

## 2. Primary Theoretical Pillars

### 2.1 Kolb's Experiential Learning Cycle (ELC) — Primary Spine
**Source:** Kolb, D.A. (1984). *Experiential Learning: Experience as the Source of Learning and Development.* Prentice Hall.

AscendX maps onto the four-stage ELC at two levels: within each session and across sessions via the MesoAccumulator.

**Session-level ELC mapping:**

| ELC Stage | AscendX Component |
|---|---|
| **Concrete Experience (CE)** | The interview practice session — candidate responds to structured questions under realistic conditions |
| **Reflective Observation (RO)** | Probing pipeline — structured follow-up questions that prompt the candidate to re-examine their response from a new angle |
| **Abstract Conceptualisation (AC)** | Five-component feedback sequence — candidate constructs meaning from the experience and identifies transferable principles |
| **Active Experimentation (AE)** | Forward Orientation (Component 5) + next session — candidate tests new approaches based on prior reflection |

**Cross-session (meso-level) ELC:**
The `MesoAccumulator` tracks development across multiple ELC cycles. Each session is one complete cycle. `competencySlope` measures whether Active Experimentation in session N produces a higher Concrete Experience baseline in session N+1 — the signal that Kolb's cycle is producing genuine learning, not just repeated performance.

**Why this replaces DMGT:**
DMGT distinguishes giftedness from talent but leaves the development mechanism underspecified. Kolb provides the mechanism: structured reflection between and within sessions converts experience into transferable skill. AscendX is a facilitated ELC environment, not a talent identification system. The probe is Reflective Observation. The feedback is Abstract Conceptualisation. The next session is Active Experimentation. This is not a metaphor — it is the design architecture.

**Implication for design:**
- Sessions must complete all four stages — terminating at CE (no probing, no feedback) produces no learning
- The probing pipeline is not interrogation — it is Reflective Observation in Kolb's terms
- Forward Orientation is not motivational language — it is the entry gate to the next ELC cycle
- Cross-session tracking (MesoAccumulator) is not optional enhancement — it is required to observe the cycle completing

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

### 2.4 Cognitive Load Theory (CLT)
**Sources:**
- Sweller, J. (1988). Cognitive load during problem solving. *Cognitive Science*, 12(2), 257–285.
- Paas, F., Renkl, A., & Sweller, J. (2003). Cognitive load theory and instructional design. *Educational Psychologist*, 38(1), 1–4.
- De Koning, B.B., Tabbers, H.K., Rikers, R.M.J.P., & Paas, F. (2009). Towards a framework for attention cueing in instructional animations. *Educational Psychology Review*, 21(2), 113–140.
- Kalyuga, S. (2007). Expertise reversal effect and its implications for learner-tailored instruction. *Educational Psychology Review*, 19(4), 509–539.

**Three load types and AscendX design:**

| CLT Component | Definition | AscendX Application |
|---|---|---|
| **Intrinsic load** | Complexity inherent to the material | Interview question difficulty, STAR structure requirements |
| **Extraneous load** | Burden caused by poor instructional design | Reduced by keyword pathfinder, STAR checklist, structured question phases |
| **Germane load** | Cognitive effort that produces actual learning | Directed by probing questions and targeted feedback toward evidence construction |

**Expertise Reversal Effect (Kalyuga, 2007):**
Scaffolding that helps novices actively hinders experts because it interferes with existing schemas. The `MesoAccumulator` operationalises this directly: when `mesoScaffoldReduced = true`, phase thresholds advance by 1 index — scaffolding is reduced as candidates demonstrate growing independence. This is not a personalisation feature; it is the expertise reversal effect applied computationally.

**Attention Cueing (de Koning et al., 2009):**
The keyword pathfinder and question checklist function as attention cues in a dynamic performance task. Without cueing, candidates attend to anxiety, time pressure, and impression management. With cueing, germane load is redirected toward evidence construction — the same mechanism de Koning documented in instructional animations, applied here to live verbal performance.

**Implication for design:**
- The scaffolded condition is not a "help mode" — it is CLT-principled extraneous load reduction
- Condition differences (scaffolded vs. minimal) are a direct test of CLT load reduction effects
- Scaffold fading in the meso-level is the expertise reversal effect operationalised across sessions
- The probing pipeline manages intrinsic load by segmenting the task into observable phases

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

### 5.0 Self-Determination Theory (SDT) — Design Rationale, Not a Measurement Instrument
**Source:** Deci, E.L., & Ryan, R.M. (1985). *Intrinsic Motivation and Self-Determination in Human Behavior.* Plenum.

**Core principle:** SDT identifies three basic psychological needs whose satisfaction predicts intrinsic motivation and sustained engagement:
- **Autonomy:** the experience of volition and self-direction
- **Competence:** the experience of effective action and mastery
- **Relatedness:** the experience of meaningful connection with others

**Critical distinction — why SDT is NOT used as a scoring metric in AscendX:**
SDT describes conditions of the learning *environment*, not stable traits of the learner. Scoring autonomy, competence, and relatedness from a single session transcript would be a category error — the theory makes claims about what environments *produce*, not what individuals *have*. A candidate's interview answer cannot be scored for their autonomy need satisfaction; it can only be observed for how much personal agency language they deployed, which is a behavioral evidence question, not a motivational one.

**How SDT IS used — as design rationale for the coaching environment:**

| SDT Need | AscendX design decision grounded in this need |
|---|---|
| Autonomy | Candidate chooses which experience to discuss; scaffolding offers structure, never enforces it; probes invite elaboration, never correct |
| Competence | Adaptive scaffolding (CLT expertise reversal) calibrates difficulty to current level; feedback always opens with a genuine strength before development areas |
| Relatedness | Feedback tone is warm and specific to the individual; the system responds to their exact words, never generic templates; psychological safety scoring monitors tone |

**Research hypothesis this enables:** If the AscendX coaching environment satisfies all three needs across sessions, candidates will develop intrinsic motivation to continue practising — producing the sustained engagement that Deliberate Practice requires. This is a testable cross-session claim, not a single-session metric.

**Behavioural evidence signals (separate construct, not SDT):** The three behavioral dimensions previously labelled using SDT terminology (autonomy → personalAgency, competence → skillSpecificity, relatedness → impactArticulation) are now correctly named as evidence quality indicators, grounded in Levashina & Campion (2007) and Ericsson (2016), not SDT.

---

**SDT and Kolb ELC — why they are not competing frameworks:**
SDT explains *what conditions make the ELC cycle complete*. Without autonomy, Concrete Experience is compliance, not engagement — the candidate performs but does not internalise. Without competence feedback, Abstract Conceptualisation stalls — the candidate cannot form transferable principles from an experience they cannot evaluate. Without relatedness, Reflective Observation is self-criticism rather than inquiry. SDT is therefore the environmental prerequisite that makes Kolb's cycle functional. In AscendX terms: design decisions that satisfy SDT needs are what allow the learning cycle to close, and the MesoAccumulator's cross-session signals (feedbackOrientationDelta, forwardOrientationActioned) are the empirical tests of whether the cycle IS closing.

---

### 5.0a Impression Management — Coaching Competency, Not a Deception Signal
**Sources:**
- Goffman, E. (1959). *The Presentation of Self in Everyday Life.* Doubleday.
- Leary, M.R., & Kowalski, R.M. (1990). Impression management: A literature review and two-component model. *Psychological Bulletin*, 107(1), 34–47.
- Levashina, J., & Campion, M.A. (2007). Measuring faking in the employment interview: Development and validation of an IM in Interviews Scale. *Journal of Applied Psychology*, 92(6), 1638–1656.
- Cable, D.M., & Kay, V.S. (2012). Striving for self-verification during organizational entry. *Academy of Management Journal*, 55(2), 360–380.

**What impression management is:**
Goffman (1959) defines impression management as the ongoing process by which individuals regulate the information others receive about them. In employment interview research, IM has historically been treated as a validity threat: candidates inflate or falsify their responses to appear more competent than they are (Levashina & Campion, 2007). The resulting research strand attempts to *detect and discount* IM from interview scores.

**Why scoring IM is a category error in AscendX:**

| Problem | Explanation |
|---|---|
| **No criterion validity at transcript level** | Whether a candidate is inflating vs. accurately representing their experience cannot be determined from the transcript alone — ground truth (actual past behaviour) is unavailable at the point of analysis |
| **AI cannot distinguish authentic from inflated self-presentation** | Both produce specific behavioural language and positive framing — the surface features are identical |
| **Penalising apparent IM reverses the coaching goal** | If the system scores IM negatively, it trains candidates to under-represent their genuine strengths — the opposite of effective interview preparation |
| **Single-session inference is unstable** | IM research requires repeated observation or multi-method data; a single transcript provides neither |

**The reframe — IM as a coaching competency:**
The legitimate coaching question is not *"is this candidate exaggerating?"* but *"does this candidate know how to present their genuine experience credibly and specifically?"* Effective impression management in professional contexts is a communication skill, not a moral failure. The candidate who says "I led the project" when they facilitated one workstream is not lying — they are underusing their communication capacity.

**How AscendX operationalises this correctly:**

| Old approach (removed) | Correct replacement | Theoretical grounding |
|---|---|---|
| `impressionManagementScore` — flags overclaiming or deception | `professionalSelfVerificationSignals` — checks whether self-presentation aligns with verifiable CV evidence | Cable & Kay (2012): candidates who self-verify during entry (authentic self-presentation) show better long-term fit and retention than those who perform identity not their own |
| Coaches candidates to suppress confident language | `hiringProfileAlignment` — coaches candidates to articulate genuine strengths in the language interviewers use | Levashina & Campion (2007): specific behavioural evidence is the signal interviewers use to evaluate competency — coaching its communication is legitimate preparation |

**Coaching goal:** Reduce the gap between what the candidate *knows* and what they *can communicate* — not to manufacture impressions, but to help authentic capability become legible to an interviewer.

**Research implication:** `professionalSelfVerificationSignals` operationalises Cable & Kay's (2012) finding that self-verification during organisational entry predicts longer-term fit and retention. This is a testable construct grounded in relational authenticity theory, not a deception detection model with no achievable criterion validity at the transcript level.

---

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

### 5.4 Deliberate Practice
**Sources:**
- Ericsson, K.A., Krampe, R.T., & Tesch-Römer, C. (1993). The role of deliberate practice in the acquisition of expert performance. *Psychological Review*, 100(3), 363–406.
- Ericsson, K.A., & Pool, R. (2016). *Peak: Secrets from the New Science of Expertise.* Houghton Mifflin Harcourt.

**Core principles and AscendX application:**

| Deliberate Practice Principle | AscendX Implementation |
|---|---|
| **Specific, well-defined goals** | Per-question STAR targets; competency level progression (Emerging→Developing→Established→Advanced) |
| **Immediate, informative feedback** | Five-component feedback sequence per question |
| **Repetition with variation** | Question bank rotation; probing angles vary per session and per candidate profile |
| **Coaching at the edge of current ability** | ZPD boundary tracking — probing targets the gap between unprobed and probed performance |

**Why this replaces DMGT:**
DMGT distinguishes giftedness from developed talent but the mechanism of development remains underspecified. Deliberate Practice provides the causal mechanism — structured, feedback-intensive practice with specific goals is what converts ability into performance. AscendX is a deliberate practice environment, not a talent identification or selection system. The system's value is in the quality and specificity of the feedback loop, not in identifying who is "gifted."

---

### 5.5 Gibbs' Reflective Cycle
**Source:** Gibbs, G. (1988). *Learning by Doing: A Guide to Teaching and Learning Methods.* Oxford Brookes University.

The Five-Component Feedback Sequence maps explicitly to Gibbs' six-stage cycle. This is not incidental — the sequence was structured to follow the cycle.

| Gibbs Stage | Five-Component Equivalent |
|---|---|
| **Description** (what happened) | Session transcript — the raw Concrete Experience captured |
| **Feelings** (what were you thinking/feeling) | Component 1: Self-Assessment — candidate names their own experience before external input |
| **Evaluation** (what was good/bad about it) | Component 2: Calibration — AI validates or gently reframes self-assessment |
| **Analysis** (what sense can you make of it) | Component 3: Competency Demonstration Feedback — structured interpretation |
| **Conclusion** (what else could you have done) | Component 4: STAR Gap Coaching — specific behavioural direction |
| **Action Plan** (if it arose again, what would you do) | Component 5: Forward Orientation — the entry gate to the next ELC cycle |

This mapping makes the feedback sequence theoretically defensible rather than an arbitrary design choice. Each component answers a question that Gibbs' model specifies must be answered for reflection to produce change.

---

### 5.6 Self-Regulated Learning (SRL)
**Source:** Zimmerman, B.J. (2002). Becoming a self-regulated learner: An overview. *Theory into Practice*, 41(2), 64–70.

SRL describes three cyclical phases of learning that directly correspond to AscendX's session architecture:

| SRL Phase | AscendX Implementation |
|---|---|
| **Forethought** | JD/CV alignment analysis, candidate profiling, goal framing before the session begins |
| **Performance** | Probing pipeline, STAR scaffolding, real-time coaching during the session |
| **Self-Reflection** | Five-component feedback sequence — candidate evaluates their own performance before AI input |

The MesoAccumulator tracks SRL capacity development across sessions: `feedbackOrientationDelta` measures whether candidates become more proactive in the Self-Reflection phase across sessions; `calibrationAccuracy` measures whether Forethought (self-assessment accuracy) improves.

**Research implication:** If SRL is developing, `calibrationAccuracy.calibrationGap` should trend toward 'accurate' across sessions. This is a testable hypothesis using the cross-session data structure.

---

### 5.7 Feedback Literacy
**Source:** Winstone, N.E., Nash, R.A., Parker, M., & Rowntree, J. (2017). Supporting learners' agentic engagement with feedback. *Educational Psychologist*, 52(1), 17–37.

Feedback literacy describes the capacity to understand, evaluate, and use feedback productively — a skill that varies across learners and must be actively developed, not assumed to be present.

**Winstone's Recipience Framework:**
- **Proactive recipience:** Candidate actively seeks, evaluates, and applies feedback without prompting
- **Responsive recipience:** Candidate accepts and acts on feedback when provided
- **Avoidant recipience:** Candidate disengages from or dismisses feedback

AscendX's `feedbackOrientation` field operationalises this framework directly. The adaptive framing system adjusts feedback language based on `seeksFeedback` status — avoidant candidates receive safety-framed openings and reduced suggestion volume; proactive candidates receive more direct and detailed coaching.

**Why this is load-bearing:**
Without feedback literacy, technically well-structured feedback produces no learning. A candidate who avoids engaging with feedback will not benefit from a well-designed Five-Component Sequence. The `feedbackOrientationDelta` in the MesoAccumulator tracks whether feedback literacy is developing across sessions — the system's primary developmental target, not just a background variable.

---

### 5.8 Transfer of Learning
**Source:** Baldwin, T.T., & Ford, J.K. (1988). Transfer of training: A review and directions for future research. *Personnel Psychology*, 41(1), 63–105.

**The central validity question for AscendX:** Does coaching in the AI environment transfer to real interview performance?

Baldwin & Ford identify three transfer conditions:

| Transfer Condition | AscendX Mechanism |
|---|---|
| **Learning** | Candidate acquires the skill in the training environment — tracked via STAR mastery and competency level progression |
| **Retention** | Candidate retains the skill across sessions — `scaffoldTrend: 'reducing'` is the primary retention signal |
| **Generalisation** | Candidate applies the skill in novel contexts (real interviews) — requires follow-up measurement outside the system |

**Research implication:**
Transfer, not in-system performance, is the externally valid outcome measure. All internal competency scores, rubrics, and level assessments are proxies for the real criterion: how the candidate performs in an actual interview with a human assessor. Pre/post blind-rated interview performance (Campion et al., 1994 rubric) is the appropriate validation instrument. The Transfer of Training Scale (Holton et al., 1997) at 2–4 week follow-up is documented in Section 9.3.

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

### Learning Cycle & Reflective Practice
- Kolb, D.A. (1984). *Experiential Learning: Experience as the Source of Learning and Development.* Prentice Hall.
- Gibbs, G. (1988). *Learning by Doing: A Guide to Teaching and Learning Methods.* Oxford Brookes University.
- Zimmerman, B.J. (2002). Becoming a self-regulated learner. *Theory into Practice*, 41(2), 64–70.
- Ericsson, K.A., Krampe, R.T., & Tesch-Römer, C. (1993). The role of deliberate practice. *Psychological Review*, 100(3), 363–406.
- Ericsson, K.A., & Pool, R. (2016). *Peak: Secrets from the New Science of Expertise.* Houghton Mifflin Harcourt.
- Baldwin, T.T., & Ford, J.K. (1988). Transfer of training. *Personnel Psychology*, 41(1), 63–105.

### Scaffolding & Cognitive Load
- Sweller, J. (1988). Cognitive load during problem solving. *Cognitive Science*, 12(2), 257–285.
- Paas, F., Renkl, A., & Sweller, J. (2003). Cognitive load theory and instructional design. *Educational Psychologist*, 38(1), 1–4.
- De Koning, B.B., Tabbers, H.K., Rikers, R.M.J.P., & Paas, F. (2009). Attention cueing in instructional animations. *Educational Psychology Review*, 21(2), 113–140.
- Kalyuga, S. (2007). Expertise reversal effect. *Educational Psychology Review*, 19(4), 509–539.
- Wood, D., Bruner, J.S., & Ross, G. (1976). The role of tutoring. *Journal of Child Psychology and Psychiatry*, 17(2), 89–100.
- Vygotsky, L.S. (1978). *Mind in Society.* Harvard University Press.

### Feedback Literacy & Formative Assessment
- Winstone, N.E., Nash, R.A., Parker, M., & Rowntree, J. (2017). Supporting learners' agentic engagement with feedback. *Educational Psychologist*, 52(1), 17–37.
- Levashina, J., & Campion, M.A. (2007). Measuring faking in the employment interview. *Journal of Applied Psychology*, 92(6), 1638–1656.
- Cable, D.M., & Kay, V.S. (2012). Striving for self-verification during organizational entry. *Academy of Management Journal*, 55(2), 360–380.
- Leary, M.R., & Kowalski, R.M. (1990). Impression management: A literature review and two-component model. *Psychological Bulletin*, 107(1), 34–47.
- Goffman, E. (1959). *The Presentation of Self in Everyday Life.* Doubleday.

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

### Prompt changes (feedbackService.ts) — COMPLETED July 2026:
- ✅ CHC labels reframed as Kolb ELC stage completion signals — `chcCognitiveDimensions` now maps crystallisedIntelligence → AC, fluidIntelligence → AE, practicalReasoning → CE
- ✅ SDT repositioned as design rationale (Section 5.0) — not a scoring metric. Behavioral Evidence Vectors renamed: personalAgency, skillSpecificity, impactArticulation (Levashina & Campion 2007; Ericsson 2016)
- ✅ impressionManagementScore removed — authentic self-presentation is a learning goal, not a deception signal; coverage absorbed into professionalSelfVerificationSignals and hiringProfileAlignment
- ✅ Goffman (1959) reference removed — `impressionManagementScore` now cites Levashina & Campion (2007) and Cable & Kay (2012)
- ✅ Five-Component Feedback Sequence implemented and mapped to Gibbs' Reflective Cycle
- ✅ Forward Orientation (Component 5) implemented with Savickas 4Cs sequencing

### Prompt changes (questionService.ts, probingService.ts) — PENDING:
- Replace 0–10 numerical rubric scores with Emerging/Developing/Established/Advanced levels
- Add AMO condition signals to evaluation output
- Add ZPD boundary tracking (Act 1 score + post-probe score stored separately per question)

### Data model changes required (sessions table) — PENDING:
- Add per-question `act1_signal` and `probed_signal` fields (for ZPD tracking)
- Add `amo_readiness` per question
- Add cross-session lower boundary tracking

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

---

## 9. Meso-Level Personality-Adaptive Architecture

> **Status:** Implemented (June 2026). All changes are additive and backward-compatible. A candidate with no `MesoAccumulator` in localStorage experiences an identical session to pre-implementation.

### 9.1 Eight Theoretical Gaps Addressed

| Gap | Theory | Implementation |
|-----|---------|---------------|
| **ZPD cross-session internalisation** | Vygotsky (1978); Wood et al. (1976) | `mesoScaffoldReduced` flag advances phase thresholds by 1 index when scaffold dependency slopes below −0.1 across sessions. Lower boundary rises rather than resetting to Phase 1. |
| **Regulatory Focus as dynamic state** | Higgins, E.T. (1997). Beyond pleasure and pain. *American Psychologist*, 52(12), 1280–1300. | `regulatoryShift` tracks transitions (prevention→promotion etc.) across sessions. Blended framing activates only on detected shift — not applied statically. |
| **Feedback orientation as learnable capacity** | Carless, D., & Young, A. (2024). Feedback orientation and learner agency. *Assessment & Evaluation in Higher Education*, 49(1). | `feedbackOrientationDelta` computes improving/stable/declining trend. Avoidant framing steps down as orientation improves. |
| **Self-assessment difficulty scaling** | Boud, D., & Molloy, E. (2013). *Feedback in Higher and Professional Education.* Routledge. | `selfAssessmentPrompt` difficulty scales with `masteryConsolidated` count across sessions. |
| **Feed-forward loop closure** | Hattie, J., & Timperley, H. (2007). The power of feedback. *Review of Educational Research*, 77(1), 81–112. | `priorFeedForwardAction` injected into Q2 probe context. `zpd_note` flags by Q4 if no evidence of action. `forwardOrientationActioned` tracks closure across sessions. |
| **Dialogue continuity** | Nicol, D.J., & Macfarlane-Dick, D. (2006). *Studies in Higher Education*, 31(2), 199–218. (Principle 5) | `breakContextGap` carries `forwardOrientation` from Session N into Session N+1 break state — each session references the prior session's development gap. |
| **PsyCap efficacy mastery tracking** | Luthans, F., Youssef, C.M., & Avolio, B.J. (2007). *Psychological Capital.* Oxford University Press. | `masteryTracker` records STAR component status per session. `masteryConsolidated` elevates components evidenced in ≥2 sessions — mastery evidence reinforces efficacy without inflation. |
| **Career adaptability developmental sequencing** | Savickas, M.L. (2012). Life design. *Journal of Counseling & Development*, 90(1), 13–19. | `currentCareerAdaptabilityStage` targets ONLY the next stage in concern→control→curiosity→confidence. Component 5 never addresses all four Cs simultaneously. |

---

### 9.2 Five New Data Structures

#### `SessionRecord`
Per-session snapshot stored in `MesoAccumulator.sessions[]`. Captures: `competencyLevels[]`, `scaffoldDependencyScore`, `regulatoryFocus`, `feedbackOrientation`, `anxietyLevel`, `selfReportedAnxietyLevel`, `forwardOrientationNotes[]`, `starComponentsReached[]`.

#### `MesoDelta`
Computed by `computeMesoDelta()` from `SessionRecord[]` using least-squares slope. Returns `null` when `sessions.length < 2` — first-session candidates are never affected. Exposes: `competencySlope`, `scaffoldTrend`, `mesoScaffoldReduced`, `regulatoryShift`, `feedbackOrientationDelta`, `dominantAnxietyLevel`, `masteryConsolidated`, `forwardOrientationActioned`, `currentCareerAdaptabilityStage`, `priorFeedForwardAction`, `zpd_lowerBoundaryAdvanced`.

#### `MesoAccumulator`
Root object persisted in `localStorage` under key `ascendx_meso_accumulator`. Fields: `participantId`, `sessions[]`, `delta` (recomputed on each session save), `lastUpdated`. Managed via `saveMesoAccumulator()` in `SettingsContext`.

#### `masteryTracker` (Layer B)
Per-session STAR component status (`reached | partial | not_reached`) generated by the AI from transcript evidence. `consolidated` boolean flags and `consolidatedComponents[]` injected post-generation from `MesoDelta.masteryConsolidated`. Researcher-only — never surfaced in Layer A.

#### `calibrationAccuracy` (Layer B)
AI-generated self-vs-AI calibration gap with `candidateSelfRating`, `aiCompetencyRating`, `calibrationGap` (`overestimate | accurate | underestimate`), and `calibrationDirection`. `priorSessionGaps` injected post-generation from last 3 `SessionRecord` entries. Tracks whether self-assessment accuracy improves across sessions.

---

### 9.3 Validated External Instruments for Research Integration

| Instrument | Construct | Timepoint |
|-----------|-----------|-----------|
| **Regulatory Focus Questionnaire (RFQ)** — Higgins et al. (2001) | Promotion vs. prevention orientation | Pre-session 1 and session 4+ |
| **Feedback Orientation Scale (FOS)** — Linderbaum & Levy (2010) | Feedback utility, accountability, social awareness | Pre-session 1 and post-session 4 |
| **Psychological Capital Questionnaire (PCQ-24)** — Luthans et al. (2007) | HERO: Hope, Efficacy, Resilience, Optimism | Pre/post intervention |
| **Career Adapt-Abilities Scale (CAAS)** — Savickas & Porfeli (2012) | Concern, Control, Curiosity, Confidence | Session 1 and 4-week follow-up |
| **Working Alliance Inventory — Short Revised (WAI-SR)** — Hatcher & Gillaspy (2006) | Coach–candidate working alliance (AI adaptation) | Post every session |
| **Transfer of Training Scale** — Holton et al. (1997) | Whether coaching transferred to real interview behaviour | 2–4 week follow-up |
| **Structured Interview Scoring Rubric** — Campion et al. (1994) | Blind-rated interview performance | Pre/post for RCT validity |

---

### 9.4 Known Limitations

1. **Regulatory focus is inferred, not measured.** `regulatoryFocus` derives from AI language analysis, not from the RFQ. The shift signal is exploratory until validated against RFQ scores.
2. **Delta is noisy at low session counts.** Slope estimates stabilise after 3–4 sessions; early values may misrepresent trends.
3. **Linear slope assumes linear growth.** Plateau or U-shaped trajectories may be misclassified. Future versions should consider polynomial or piecewise regression.
4. **Career adaptability mapping is heuristic.** Linking `masteryConsolidated.length` to the 4Cs sequence requires empirical calibration against CAAS subscale scores.
5. **Feed-forward closure is a proxy.** `forwardOrientationActioned` compares STAR component counts — a coarse measure. Richer operationalisation requires tracking specific competency-level improvements.
6. **localStorage is not research-grade storage.** `MesoAccumulator` will be lost on cache clear. Research deployment requires sync to the backend `sessions` table.
7. **First-session candidates are fully protected.** All meso logic is gated on `mesoAccumulator?.delta` null-checks. Any execution path reaching meso logic without a populated delta is a regression.
