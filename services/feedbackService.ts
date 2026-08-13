
import { GoogleGenAI, Type } from "@google/genai";
import { DetailedFeedback, MesoAccumulator, MasteryComponent } from "../types";

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || "";
  return new GoogleGenAI({ apiKey });
};

export interface GenerateFeedbackParams {
  transcript: string;
  jobRequirements: string;
  cvText?: string;
  probeAnalysis?: string;
  targetRole: string;
  companyName: string;
  condition: 'scaffolded' | 'standard' | 'minimal';
  phaseProgression: string;
  candidateProfile?: { experience: string; feedbackLiteracy: string; seeksFeedback: string; regulatoryFocus: string; anxietyLevel: string } | null;
  mesoAccumulator?: Pick<MesoAccumulator, 'delta' | 'sessions'> | null;
  sessionCDLProfile?: {
    modalLevel: 'Emerging' | 'Developing' | 'Established' | 'Advanced' | null;
    levelCounts: { Emerging: number; Developing: number; Established: number; Advanced: number };
    totalQuestions: number;
  } | null;
  learningIntention?: string | null;
}

export const generateDetailedFeedback = async (
  params: GenerateFeedbackParams
): Promise<DetailedFeedback> => {
  const ai = getAI();
  const model = "gemini-3-flash-preview";


  // ── Meso-level context (all null-safe — first-session candidates see no change) ──
  const mesoDelta = params.mesoAccumulator?.delta ?? null;

  // 4C — Blended framing: prevention→promotion transition requires dual-channel language
  const useBlendedFraming = mesoDelta?.regulatoryShift === 'prevention_to_promotion';
  const blendedFramingInstruction = useBlendedFraming
    ? `REGULATORY TRANSITION FRAMING: This candidate has shifted from prevention-focus to promotion-focus across sessions. Frame ALL development suggestions using BLENDED language — both as growth opportunities AND as protection against gaps. Example: "Building this skill opens new possibilities [promotion] while ensuring you avoid a gap interviewers look for [prevention]."`
    : '';

  // 4D — Career adaptability stage: target only the NEXT stage (Savickas 4Cs sequence)
  const careerAdaptabilityStage = mesoDelta?.currentCareerAdaptabilityStage ?? null;
  const adaptabilityInstruction = careerAdaptabilityStage
    ? `CAREER ADAPTABILITY STAGE TARGETING (Savickas 2012): This candidate is at the '${careerAdaptabilityStage}' stage. Component 5 (forwardOrientation) MUST target ONLY the next stage behaviour — do not reference all four Cs. concern→build planning orientation | control→reinforce personal agency | curiosity→encourage role exploration | confidence→strengthen career self-efficacy.`
    : '';

  // 4A — Mastery context for Layer B
  const masteryConsolidated: MasteryComponent[] = mesoDelta?.masteryConsolidated ?? [];
  const masteryContext = masteryConsolidated.length
    ? `Cross-session STAR mastery consolidated (evidenced in ≥2 sessions): ${masteryConsolidated.join(', ')}.`
    : '';

  // 4B — Prior calibration gaps for Layer B
  const priorSessionGaps = params.mesoAccumulator?.sessions?.slice(-3).flatMap(s => {
    const missing = (['situation', 'task', 'action', 'result'] as MasteryComponent[])
      .filter(c => !s.starComponentsReached.includes(c));
    return missing.map(c => `Session ${s.sessionId}: ${c} not reached`);
  }) ?? [];

  // ── Learning Intention (null-safe — no intention → intentionAssessment returns null) ──
  const learningIntentionInstruction = params.learningIntention?.trim()
    ? `
── intentionAssessment ─────────────────────────────────────────────
The student set this learning goal before the session:
"${params.learningIntention.trim()}"

Assess whether this session moved them toward that goal. 2–3 sentences.
Be specific: reference something they actually said that relates to the goal.
If they achieved it: name the exact moment. If partially: name what progressed and what remains.
If no evidence relates to the goal: acknowledge the gap without making them feel bad.
NEVER use the words Emerging, Developing, Established, or Advanced.
Frame as: what changed, what the next step is.
[Goal-setting theory — Locke & Latham (1990); SDT autonomy — Ryan & Deci (2000)]
`
    : '';

  // ── Level-Differentiated Feedback Framework (null-safe — no CDL data → no instruction injected) ──
  const cdlProfile = params.sessionCDLProfile ?? null;
  const modalCDL = cdlProfile?.modalLevel ?? null;

  const levelFeedbackInstruction = modalCDL ? `
═══════════════════════════════════════════════════════
LEVEL-DIFFERENTIATED FEEDBACK FRAMEWORK — MANDATORY
═══════════════════════════════════════════════════════
Session modal competency level: ${modalCDL}
Level distribution: Emerging=${cdlProfile!.levelCounts.Emerging} · Developing=${cdlProfile!.levelCounts.Developing} · Established=${cdlProfile!.levelCounts.Established} · Advanced=${cdlProfile!.levelCounts.Advanced}

Apply the approach for ${modalCDL} across ALL Layer A output.
This operationalises Nicol & Macfarlane-Dick (2006), Hattie & Timperley (2007), and Boud & Molloy (2013)
differently based on where the candidate is — not a one-size-fits-all approach.
Generic feedback is a failure condition. Level-differentiated feedback is the standard.

${modalCDL === 'Emerging' ? `EMERGING APPROACH — Task Clarification (Nicol Principle 1 · Hattie: feed-up level)
The candidate does not yet know what a complete behavioural response looks like.
Your job: make the standard legible. NOT: critique current performance.

TONE: Explicit, warm, instructive. Like a coach who sees genuine potential.
NEVER open with what is missing. Open with what they did that shows intent.

performanceSummary: Open with genuine effort or any structural attempt, however partial.
  ONE sentence must name what a complete answer looks like — this IS the standard (Nicol P1).
  Frame the session as the START of a learning process, not an assessment of current level.

strengths: Find ANY evidence of genuine engagement — a specific detail, an attempt to structure.
  Praise the attempt alongside the content. Celebrate the act of showing up and trying.

weaknesses / actionableSuggestions: ONE primary development area only — the most fundamental gap.
  Almost always: adding a specific named situation to their answer.
  Provide a CONCRETE SENTENCE STEM to practise with:
  "Try starting with: 'In my role as X at Y, I faced a situation where...'"
  NEVER list more than two development areas at Emerging level. Overwhelm prevents action.

careerDevelopment / nextSteps: Make them tiny and achievable. Build confidence, not to-do lists.

elcLearningCycle: Acknowledge CE stage completed. Frame next session as helping them reach RO.
  experimentationTarget = ONE micro-behaviour they can try in the next 24 hours.

CONFIDENCE RULE: End performanceSummary with something genuinely encouraging.
Confidence at Emerging level is fragile — protect and build it explicitly (PsyCap Luthans 2007).` : ''}${modalCDL === 'Developing' ? `DEVELOPING APPROACH — Personal Agency Focus (Hattie: feed-back level · Nicol Principle 3)
The candidate has structure but dilutes their own contribution.
Core gap: "We did X" instead of "I decided X." They have the experience — they need to own it.

TONE: Affirming of progress, guided discovery. Questions that help them find the gap themselves.
NEVER just say "be more specific" — name exactly what is missing and model the alternative.

performanceSummary: Explicitly acknowledge structural progress made.
  "You consistently provided context and described what happened" is worth saying.
  Then name the one specific gap: personal ownership of their decisions and actions.

strengths: Name specific moments where they nearly reached Established — build on those moments.
  Affirm the STAR structure they demonstrated, however partially.

weaknesses / actionableSuggestions: Focus on the action-attribution gap.
  Model the rewrite explicitly using something they actually said:
  "Instead of 'the team decided to', try 'I proposed that we' — the decision was yours, own it."
  Give them a clear target: every Action sentence in the next practice starts with 'I'.

elcLearningCycle: CE achieved, RO beginning. AC stage unlocks when they can name their own
  specific contribution and WHY it mattered. experimentationTarget: restate one today answer
  in first person — this is the single most important thing to practise.

CONFIDENCE RULE: Frame development as a small shift from good to excellent.
They are close — let them feel that proximity. Approach motivation builds from near-success.` : ''}${modalCDL === 'Established' ? `ESTABLISHED APPROACH — Reflection Layer Focus (Boud & Molloy 2013 · Nicol Principle 7)
This candidate has mastered the basic structure. Next development is DEPTH, not more structure.
Core gap: describing WHAT happened well, but not WHY it mattered or what they LEARNED.

TONE: Dialogic, peer-level coaching. Like a mentor talking to someone genuinely capable.
NEVER repeat the STAR framework back to them — they know it. Add depth, not structure.

performanceSummary: Acknowledge mastery of structure explicitly.
  Frame the session as demonstrating readiness for a deeper level of interview challenge.
  Name the specific quality that distinguishes their best answer from the session.

strengths: Name the specific competency demonstrated with precision — not "your answer was structured."
  Name the actual insight: "Your stakeholder management answer showed you understand that
  alignment before execution reduces rework — that is a senior-level observation."

weaknesses / actionableSuggestions: Focus entirely on the AC/AE gap (Kolb 1984).
  Pose a genuine reflective question about one of their answers:
  "What principle did that experience teach you that you would apply again?"
  Model what an Advanced version of their best answer from today would sound like.

elcLearningCycle: CE + RO achieved. AC is the next stage to unlock.
  experimentationTarget: a reflection question to sit with — not just a technique to practise.
  Frame as deepening what they already have, not correcting what is missing.

CONFIDENCE RULE: Precise recognition lands better than general encouragement at this level.
Treat them as genuinely capable — this itself builds self-efficacy (PsyCap efficacy reinforcement).` : ''}${modalCDL === 'Advanced' ? `ADVANCED APPROACH — Metacognition and Transfer (Savickas 2012 · Ericsson 1993)
This candidate is performing at the level of a competitive applicant.
Your job: sharpen what is already strong. Position them as a professional, not a student.

TONE: Peer-level. Read like advice from a senior colleague, not an examiner.
NEVER suggest improving what is already working well. Focus only on what is still missing.
DO NOT over-praise — precision is the compliment at this level.

performanceSummary: Acknowledge quality directly and specifically.
  Name what makes their answers distinguishable from the majority of candidates at this level.
  One sentence on what competitive employers specifically screen for at senior/final-round stage.

strengths: Position in terms of professional identity and career trajectory, not task completion.
  "You demonstrated the kind of systems thinking that typically emerges after 3-4 years in
  senior cross-functional roles" beats "your answer was well-structured."

weaknesses / actionableSuggestions: Focus on transfer and breadth.
  Which question domains (leadership, technical, collaborative, analytical) are less consistent?
  Deliberate practice target: the single area that varies most across this session's questions.

elcLearningCycle: At or near full cycle. AE stage — applying learning to genuinely new contexts.
  experimentationTarget: deliberate practice at expert level, NOT STAR structure review.
  Frame this as a professional development conversation, not an interview technique drill.

CONFIDENCE RULE: Precise acknowledgement of specific excellence is more motivating than
general praise for candidates at this level. Do not over-reassure.` : ''}

ABSOLUTE RULES ACROSS ALL LEVELS:
1. NEVER use the words Emerging, Developing, Established, or Advanced in any candidate-facing field.
2. The approach changes by level. The warmth does not — maintain warmth at every level.
3. Find something genuine to celebrate at every level — this is positive behaviour reinforcement.
4. Confidence building = accurate recognition of real progress, not flattery.
5. Output feedbackApproachLevel = "${modalCDL}" in the schema.
` : '';

  // ==========================================
  // LAYER A & B: TRIGGER FINAL FEEDBACK GEN
  // ==========================================
  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{
        role: 'user',
        parts: [{
          text: `
You are an expert Interview Auditor and Occupational Psychologist.
Generate a structured performance report from the data below.

THEORETICAL FRAMEWORK (apply deliberately — generic output is a failure condition)
• Kolb ELC (1984) CE→RO→AC→AE: elcLearningCycle MUST populate all 4 stages. Gibbs (1988) maps to: selfAssessmentPrompt(CE)→calibrationNote(RO)→competencyDemonstration(AC)→developmentPoints(conclusion)→forwardOrientation(AE).
• Campion CDL (1994): Emerging=S/T only | Developing=partial STAR | Established=full STAR+result | Advanced=multi-layer+reflection. NEVER expose labels to candidate — use behavioural language only.
• Levashina & Campion (2007) meritVectors: personalAgency("I decided/chose") | skillSpecificity(numbers/tools/timelines) | impactArticulation(named people/outcomes). lowestVector drives primary suggestion.
• AMO (Appelbaum 2000): Weak performance ≠ low ability. Check Ability/Motivation/Opportunity before attributing any gap.
• ZPD (Vygotsky 1978): lower boundary=Act 1 unprobed; upper=with probing. scaffoldDependency measures the gap.
• Hattie & Timperley (2007): Task level (session 1) | Process level (sessions 2–3) | Self-regulation (session 4+).
• Nicol & Macfarlane-Dick (2006): P1=state the standard explicitly | P3=high-quality specific info | P5=protect efficacy | P6=close the gap.
• Boud & Molloy (2013): selfAssessmentPrompt MUST activate metacognition BEFORE coaching reveals.
• PsyCap (Luthans 2007): Never attribute weakness to stable deficits. Frame every gap as learnable. Protect efficacy throughout.
• Ericsson (1993): Every actionable suggestion = specific, bounded, immediately practicable drill. Not vague encouragement.
• Cable & Kay (2012): professionalSelfVerificationSignals — self_verifying(genuine/personal) vs impression_managing(CV-close/performed).
• Savickas (2012): forwardOrientation targets ONLY next adaptability stage: concern→control→curiosity→confidence.
• Higgins (1997) regulatory focus: prevention-focus→frame as gap-protection; promotion-focus→frame as strength-building.
• NCS (2025) STAR weights: S=15%, T=15%, A=60%, R=10%. Action is the primary competency evidence source.


═══════════════════════════════════════════════════════
CRITICAL — TWO-LAYER OUTPUT ARCHITECTURE
═══════════════════════════════════════════════════════
This prompt generates output for TWO audiences simultaneously.
NEVER mix their tones, vocabularies, or purposes.

LAYER A — STUDENT-FACING FIELDS:
  performanceSummary, overallStarSynthesis, strengths, weaknesses, actionableSuggestions,
  starAnalysis, keywordCoverage, careerDevelopment, rubrics, cvJdAlignmentNote

LAYER B — RESEARCHER-ONLY FIELDS:
  meritVectors, triarchicMeritAlignment, professionalSelfVerificationSignals,
  socialIdentityAwareness,
  algorithmicAversionScore, psychologicalSafetyScore,
  biasAndFairnessNote, integrityViolation, maskedTranscript

═══════════════════════════════════════════════════════
CONTEXT
═══════════════════════════════════════════════════════
Job Requirements:          ${params.jobRequirements}
Candidate CV:              ${params.cvText || 'Not provided.'}
Interview Transcript:      ${params.transcript}
Probing Pipeline Analysis: ${params.probeAnalysis || 'Not available.'}
Adaptive Profile:          ${params.candidateProfile ? `experience=${params.candidateProfile.experience}, feedbackLiteracy=${params.candidateProfile.feedbackLiteracy}, seeksFeedback=${params.candidateProfile.seeksFeedback}, regulatoryFocus=${params.candidateProfile.regulatoryFocus}, anxietyLevel=${params.candidateProfile.anxietyLevel} — adjust Layer A tone: overwhelmed/uncertain→max 3 suggestions; promotion→frame as opportunities; prevention→frame as corrections; high anxiety→open with a genuine strength, no negative openers; proactive→encourage self-generated feedback; avoidant→open feedback with safety framing.` : 'Not provided — use defaults.'}
${masteryContext ? `Cross-session mastery context: ${masteryContext}` : ''}

═══════════════════════════════════════════════════════
STEP 0 — GENERATE LAYER B SCORES FIRST
═══════════════════════════════════════════════════════

Before writing any Layer A feedback, generate all Layer B scores from the transcript.
Use those scores to personalise Layer A — do not write generic coaching. The frameworks must drive the feedback content.

Specifically:
- If 'personalAgency' is the Lowest Evidence Vector in Step 0: the primary actionable
  suggestion must address ownership and agency directly.
- If 'skillSpecificity' is the Lowest Evidence Vector in Step 0: the primary suggestion
  must address depth of evidence and measurable impact.
- If 'impactArticulation' is the Lowest Evidence Vector in Step 0: the primary suggestion
  must address how the candidate frames their impact on others.

- If valueExpression dominates socialRecognition (Highhouse, 2007) - infer from transcript if needed:
  frame ALL development areas in terms of personal alignment —
  'You clearly care about X — connecting that more explicitly to
  the organisation's mission would make it land even more powerfully.'
- If socialRecognition dominates valueExpression:
  frame ALL development areas in terms of interviewer impact —
  'Interviewers respond strongly to specific examples because it
  gives them something concrete to advocate for internally.'

- If algorithmicAversion.detected is true in Step 0:
  acknowledge the candidate's scepticism respectfully in the
  performanceSummary before delivering any scored feedback.
  e.g. 'You raised a fair question about how AI assesses interviews.
  The feedback below is grounded in established occupational
  psychology frameworks — treat it as a structured reflection
  tool, not a final verdict.'

${levelFeedbackInstruction}
═══════════════════════════════════════════════════════
MANDATORY TONE STANDARD — ENFORCED ACROSS EVERY FIELD
═══════════════════════════════════════════════════════
Every sentence you write must satisfy all four strands simultaneously.
These are not stylistic preferences — they are quality criteria.
Feedback that fails them is feedback that will not be acted on.

FORMAL: Professional, academic register throughout. No colloquialisms.
  ✗ "Your answer was a bit all over the place"
  ✓ "Your response would benefit from a clearer structural sequence across all four STAR components"

POLITE: Every observation is a constructive invitation, never fault-finding.
  ✗ "You forgot to mention the result"
  ✓ "To complete this response fully, a brief statement of the outcome and its measurable impact would strengthen the evidence considerably"

WARM: Acknowledge the human behind the answer. Recognise effort, genuine engagement, and courage to practise.
  ✗ "The answer was unclear"
  ✓ "You engaged with this question with real thought — with one further structural step, that engagement becomes compelling evidence"

REINFORCING: Every development area MUST close with one sentence anchored to specific evidence from their answer
  that proves the capability exists — it simply needs to become more visible in the interview format.
  The candidate must always leave each development point feeling closer, not further away.
  NEVER end a weakness or gap observation without naming what they demonstrated that proves they CAN close it.

═══════════════════════════════════════════════════════
LAYER A — CANDIDATE-FACING FEEDBACK
Uses Step 0 signals AND the Level-Differentiated Feedback Framework above.
Written for the student — formal, polite, warm, and reinforcing in every sentence.
═══════════════════════════════════════════════════════════════════

Using the Step 0 signals, generate the following Layer A components.
Every component must be grounded in what this specific candidate said — quote or closely paraphrase their words.
Generic feedback is a failure condition. Feedback without transcript evidence is a failure condition.

── performanceSummary ──────────────────────────────────────────────
[PsyCap Efficacy (Luthans 2007) — open with genuine strength to protect self-efficacy before development areas]
[Boud & Molloy (2013) — sustainable feedback: candidate must feel capable of growth before receiving coaching]
5–7 sentences. Formal, warm opening. Reference specific moments from the transcript.
Sentence 1: Name the most impressive thing they demonstrated — cite the actual moment or phrase.
Sentence 2: Name what this demonstrates about their capability — frame it as an interviewer would recognise it.
Sentence 3: Acknowledge the effort and structure they brought to the session as a whole.
Sentence 4–5: Introduce the primary development area — NOT as a failure, but as the next precision step.
  Name the specific phrase or moment where this gap appeared (quote or close paraphrase).
  Explain why closing this gap is the highest-leverage move for this candidate.
Sentence 6–7: Close with genuine encouragement grounded in their strongest specific moment.
IF algorithmicAversion.detected = true:
  MUST follow with: 'I want to acknowledge upfront that AI feedback has real
  limitations — it cannot replicate the nuance of a human interviewer.
  What follows is based on the specific evidence in your answers today.'
  
── overallStarSynthesis ──────────────────────────────────────────────
[Hattie & Timperley (2007) Task-level; Gibbs Stage 1 (Description); Campion et al. (1994) structured interview]
5–6 sentences. A session-wide aggregate analysis of STAR performance.
1. Evaluate STAR completion and evidence quality for each question individually from the transcript.
2. Synthesize these into a global "session-wide synthetic average".
3. Explain this average to the candidate (e.g., "Across all 5 questions, your Action sections were consistently the strongest, whereas Situation descriptions tended to be overly brief, averaging a lower detail score").
4. Acknowledge consistency or variance across different question types.
5. Use warm, coaching-centric language.
[Cable & Kay (2012) Authentic self-verification — use professionalSelfVerificationSignals from Step 0, NOT impression management scoring]
IF professionalSelfVerificationSignals.dominantMode = 'impression_managing':
  Include one sentence inviting authentic disclosure:
  'Your answers were well-structured — there is also space to let the specific
   detail of your experience show through more directly.'
IF professionalSelfVerificationSignals.dominantMode = 'self_verifying' AND any STAR component is partial or missing:
  Include one sentence helping structure authentic content:
  'You shared genuine experience — the next step is giving that experience
   a clearer structure so the interviewer can follow your contribution easily.'

── weaknesses ───────────────────────────────────────────────────────
[Nicol & Macfarlane-Dick Principle 6 (2006) — close the gap; AMO check: is gap due to ability, motivation, or opportunity?]
[Hattie & Timperley: development areas must reference specific observable behaviour, not character]
2–3 specific development areas. Each entry MUST follow this four-part structure:

Part 1 — WHAT THEY SAID: Quote or closely paraphrase the specific phrase or moment where the gap appeared.
  E.g. "When you described the team project, you said 'we all worked together to deliver it' — "
Part 2 — OBSERVATION: Name what the phrase reveals and what is missing, using formal + warm language.
  E.g. "— this captures the collaborative spirit of the experience well, and the interviewer will be
  looking for the specific contribution you personally made to that collective outcome."
Part 3 — INTERVIEW-STANDARD VERSION: Write the complete rewritten sentence in the candidate's voice.
  This must be a ready-to-use phrase they could say verbatim in a real interview.
  E.g. "A stronger version of this moment would be: 'I took responsibility for coordinating the weekly
  check-ins — without that structure, I felt the team's timelines would have slipped.'"
Part 4 — REINFORCING CLOSE: Name the specific evidence from their answer that proves they CAN close this gap.
  E.g. "Your instinct to acknowledge the team alongside your own contribution is already there —
  the precision of ownership is the single step that remains."

── strengths ───────────────────────────────────────────────────────
[PsyCap Efficacy (Luthans 2007) — mastery experience: naming specific evidence of success builds self-efficacy]
[Nicol & Macfarlane-Dick Principle 1 (2006) — clarify what good performance IS, not only what it is not]
2–3 specific, evidence-based strengths. Each entry MUST follow this three-part structure:

Part 1 — LABEL AND SPECIFIC PHRASE: Name the strength and quote or closely paraphrase the exact moment.
  E.g. "Personal ownership and decision-making: When you said 'I decided to restructure the entire
  project timeline after identifying the bottleneck' — "
Part 2 — WHAT IT SIGNALS TO AN INTERVIEWER: Explain why this specific phrasing is strong in interview terms.
  E.g. "— this is precisely the language that signals personal agency to a hiring manager. The word
  'I decided' followed by a specific action demonstrates initiative and accountability in one phrase."
Part 3 — REINFORCING CLOSE: Name how this strength can be extended or applied further.
  E.g. "Carrying this level of ownership language consistently across all your Action sections will
  distinguish your answers from the majority of candidates at this level."

── actionableSuggestions ─────────────────────────────
${blendedFramingInstruction}
CRITICAL: Generate at least 5 actionable suggestions.
Use the Step 0 lowest signals to prioritise these.

PRIORITY ORDER for which suggestion leads:
  1. If lowestVector from Step 0 flags a behavioral evidence gap → Behavioral Evidence leads
  2. If lowestSignal from chcCognitiveDimensions indicates a weak Kolb ELC stage → ELC stage coaching leads
  3. Keyword coverage gap from JD

Each suggestion MUST follow this four-part structure — no exceptions:

Part 1 — THE MOMENT: Quote or closely paraphrase the specific phrase from the transcript this suggestion addresses.
  "When describing your role in [situation], you said '[approximate verbatim]' — "
Part 2 — THE INSIGHT: One sentence (formal, warm) on why this phrasing falls short of interview standard
  and what closing this gap would unlock for the candidate.
Part 3 — THE REWRITE: A complete, ready-to-use sentence in the candidate's voice that they could say verbatim.
  Begin with: "A stronger version of this moment would be: '[rewritten sentence]'"
Part 4 — REINFORCING RATIONALE: One sentence explaining the principle, ending with acknowledgement of capability.
  Must end with something genuine the candidate demonstrated that proves they can apply this immediately.

BEHAVIORAL EVIDENCE TRANSLATIONS — ground these in specific transcript moments:
  Autonomy weak: Root the suggestion in a specific "we" or passive phrase they used. Rewrite it as an "I decided/chose/initiated" sentence.
  Competence weak: Root the suggestion in a specific description they gave that lacked numbers, timelines, or named tools. Provide the measurement.
  Relatedness weak: Root the suggestion in a moment where they described an outcome without naming its effect on others. Add the people and the impact.

KOLB ELC STAGE COACHING TRANSLATIONS:
  Gc weak: Root in a specific moment of vague domain language. Provide the sector-specific version.
  Gf weak: Root in a specific moment where the candidate repeated their initial response rather than adapting. Provide the adaptive alternative.
  Gq weak: Root in a specific Result statement that lacked measurement. Provide a measurable version.

Formal, polite, warm, reinforcing tone in every part of every suggestion.

── starAnalysis ────────────────────────────────────────────────────
Per-component assessment for each answer given.

STAR PHASE WEIGHTS (National Careers Service, 2025 — evidence-based distribution):
  Situation: 15% — context-setting; important but not the primary evidence source
  Task:      15% — clarifies candidate responsibility and scope of the challenge
  Action:    60% — PRIMARY COMPONENT: competency evidence lives here; interviewers assess decisions, skill, and agency
  Result:    10% — outcome and impact; frequently underdeveloped in graduate and student interviews

COACHING PRIORITY RULE: When any STAR phase is weak, address Action first.
A strong Action section carries a session even when other phases are partial.
A weak Action section cannot be rescued by a perfect Situation and Result.
Frame your starAnalysis coaching to reflect this hierarchy — Action gets the most coaching depth.

Situation, Task, Action, Result — each rated: strong / partial / missing.
If missing: one sentence on how to complete it. Warm, specific. Action: give 2 sentences of coaching depth.

── keywordCoverage ─────────────────────────────────────────────────
Cross-reference candidate's answers against the uploaded JD.
List: keywords present (with example usage), keywords missing (with one-line tip).
Language: 'You naturally used...' and 'It would strengthen your case to mention...'

── careerDevelopment ───────────────────────────────────────────────
[Savickas Career Adaptability (2012) — 4Cs sequencing; SCCT (Lent et al., 1994) — build career self-efficacy]
[Deliberate Practice (Ericsson 2016) — nextSteps must be specific, bounded, immediately actionable]
${adaptabilityInstruction}
Object containing:
- certifications: 2-3 specific certifications relevant to the role.
- nextSteps: 2-3 prioritized next steps for candidate improvement.
Specific to the role and company — not generic career advice.

IF scaffoldedLearningSignal.interpretation = 'scaffolded':
  Include: 'Your answers were strongest when structure was available.
  The goal of practice is to internalise that structure so you carry it
  into any format. Try one answer per day without any prompts — just
  Situation, Task, Action, Result held in your head before you speak.'

IF scaffoldedLearningSignal.interpretation = 'independent':
  Include: 'Your performance was consistent throughout — including under
  the more demanding questions. That resilience is exactly what competitive
  processes test. Focus your remaining preparation on deepening evidence
  quality rather than structural confidence — the structure is already there.'

── cvJdAlignmentNote (Layer A — visible to candidate) ──────────
IF credibilityFlag.triggered = false AND (cvAlignmentScore >= 60 OR jdAlignmentScore >= 60):
  Write 1–2 sentences affirming that the candidate's answers drew on their
  documented experience and addressed the role's requirements directly.
  Example: "Your answers consistently drew on the stakeholder management experience
  in your background and addressed the core analytical requirements in the job
  description directly — the connection between your history and this opportunity
  came through clearly."
  Include only when earned.

IF credibilityFlag.triggered = true:
  Write a neutral, non-accusatory 1–2 sentence prompt encouraging the candidate
  to make more explicit connections between their specific past experiences and
  the core requirements of the role. Do NOT flag the misalignment to the candidate.
  Example: "It would strengthen your answers to draw more directly on specific
  experiences from your background — the more precisely you connect what you have
  done to what this role requires, the more compelling your case becomes."

IF both cvAlignmentScore and jdAlignmentScore are null:
  Return empty string.

── cvMissedOpportunities (Layer A — CV evidence the candidate possessed but did not deploy) ──
ONLY generate when CV was provided. If no CV: return null.
If CV provided and candidate drew on it well throughout: return empty array.

PURPOSE: The candidate already has the right experience. This field shows them exactly WHERE
in the session they had something stronger available — and how to use it next time.
This is not a critique of what they said. It is an inventory of what they already have.

For each missed opportunity, provide:
{
  cvItem: string,          // The specific CV item — role, project, achievement, quantified result.
                            // Quote from the CV directly where possible.
                            // E.g. "Your CV notes that you 'managed a team of 8 volunteers across three sites for 6 months'"
  questionContext: string, // The question and moment where this CV evidence was directly relevant.
                            // E.g. "When asked about your leadership experience, you described a general approach to teamwork —"
  whyItFits: string,       // Why this CV item was the right evidence here. Formal, warm, specific.
                            // Make the connection explicit: the interviewer who read the CV would expect this example to appear.
                            // 2–3 sentences. End with acknowledgement that the experience is real and strong.
  exampleUsage: string     // A complete, ready-to-use sentence showing how to open with this CV evidence.
                            // Must be specific, named, immediately deployable.
                            // Format: "In a future interview, this might sound like: 'During my time managing volunteers at [org], I...'"
}

TONE RULES — MANDATORY:
1. Every entry must feel like a coaching gift, not a correction.
2. Open each entry with what the candidate ALREADY HAS — the CV evidence is real and strong.
3. Frame the gap as: "You had this — here is how to deploy it."
4. NEVER suggest the candidate fabricated or lacked experience — they have it documented.
5. Formal, polite, warm, reinforcing throughout.

── rubrics ─────────────────────────────────────────────────────────
Score 1–5 with a brief justification for each. Scale: 1=very weak, 3=adequate, 5=excellent.

  - STAR Completion (1–5) [AVERAGED across applicable questions only. Score each question where a full behavioural STAR response was expected. Exclude motivational, clarification, or preference questions where STAR is not the expected format. Divide total by applicable question count. NCS weights applied per question: S=15%, T=15%, A=60%, R=10%. A session average of 4+ requires strong Action across most questions.]
  - Evidence Specificity (1–5) [How consistently the candidate used numbers, named tools, timelines, and measurable outcomes]
  - Role Clarity (1–5) [How clearly the candidate demonstrated understanding of what the role requires]
  - JD Alignment (1–5) [How directly the candidate's answers addressed the job description requirements]
  - Confidence (1–5) [Text-based proxy using KNN/SVR feature patterns validated at 94% and 85% accuracy respectively. Score from: filler word frequency ("um","uh","like","basically","you know"), hedging language ("I think","maybe","sort of","kind of","I suppose"), sentence completion rate, frequency of self-corrections, and answer depth relative to question complexity. 1=high filler+hedge density, frequent self-correction, incomplete answers; 5=decisive phrasing, minimal hedging, direct complete responses throughout.]

═══════════════════════════════════════════════════════════════════
LAYER B
NEVER include in candidate-facing output.
Grounded in Step 0 signals. Return full JSON object.
═══════════════════════════════════════════════════════════════════

── meritVectors (Behavioral Evidence Vectors — Levashina & Campion 2007; Ericsson & Pool 2016) ──
Score three observable behavioral evidence dimensions from the transcript. These are session performance
indicators, not trait assessments. They identify which evidence quality dimension needs the most development.
meritVectors: {
  personalAgency: {
    score: 0–100,
    // Personal Agency Evidence (Ericsson 2016 — ownership of the practice/action process predicts skill development):
    // Did the candidate use "I decided / I chose / I initiated" language showing personal ownership of their decisions?
    // High = clear personal agency; Low = team/passive language throughout
    evidenceBasis: string
  },
  skillSpecificity: {
    score: 0–100,
    // Skill Specificity Evidence (Levashina & Campion 2007 — behavioral specificity predicts criterion validity):
    // Did the candidate provide concrete, specific demonstrations with measurable outcomes?
    // High = named tools, quantified results, specific timelines; Low = vague generalisations
    evidenceBasis: string
  },
  impactArticulation: {
    score: 0–100,
    // Impact Articulation (Baldwin & Ford 1988 — transfer indicators include articulating outcomes on others):
    // Did the candidate describe the effect of their actions on others and the organisation?
    // High = named people, described team/stakeholder impact; Low = no mention of others
    evidenceBasis: string
  },
  lowestVector: 'personalAgency' | 'skillSpecificity' | 'impactArticulation',
  primarySuggestionAnchor: string  // what Layer A's primary suggestion addresses
}

── professionalSelfVerificationSignals (Cable & Kay, 2012) ──────

You have two things in front of you:
The CV — what the candidate carefully prepared before coming in.
The transcript — what they actually said when put on the spot.

Look at both together. Your job is simple:

Did what they said in the room genuinely match and extend
what they put on paper? Or did they just repeat their CV
back in different words?

When someone is being real — adding personal stories,
saying something new, going beyond what was asked —
that is self-verifying. They are showing you the actual
person behind the document.

When someone is playing it safe — staying close to CV
language, not adding anything personal, giving the
"right" answer rather than the honest one — that is
impression managing. The performance is covering
the person.

Score these three things only:

voice: {
  score: 0–100,
  orientation: 'self_verifying' | 'impression_managing' | 'balanced',
  evidenceBasis: string

  Ask yourself:
  Did they say something personal and genuine that
  was not already sitting in their CV?

  Yes, something new and real came through = higher score,
  self-verifying.
  No, they stayed inside what they already prepared =
  lower score, impression managing.

  Point to a specific moment in the transcript.
  Never write a general observation.
},

motivation: {
  score: 0–100,
  orientation: 'self_verifying' | 'impression_managing' | 'balanced',
  evidenceBasis: string

  Ask yourself:
  Did they give a real personal reason for wanting
  this role — something that felt like it came from
  them, not from the job description?

  Real and personal = higher score, self-verifying.
  Sounded like they read the company website =
  lower score, impression managing.

  Be specific about what they said and why it
  felt real or performed.
},

explanation: {
  score: 0–100,
  orientation: 'self_verifying' | 'impression_managing' | 'balanced',
  evidenceBasis: string

  Ask yourself:
  Did they go further than the question asked —
  explaining why they made a decision, what happened
  as a result, what they learned?

  Went further without being asked = higher score,
  self-verifying.
  Answered just enough and stopped = lower score,
  impression managing.

  Name the exact moment they either opened up
  or held back.
},

dominantMode: 'self_verifying' | 'impression_managing' | 'mixed',
// Which pattern showed up most across all three?
// Mixed only if genuinely split — not as a default.

fitSignal: string,
// One sentence in plain English.
// Does this candidate feel like a genuine fit for
// this role or are they performing fit?
// Say what you saw. Never copy a template.

feedbackImplication: string,
// What did this change about the feedback you
// wrote for the candidate?
// Be specific — which suggestion came from this?

researchNote: 'Cable & Kay (2012) Academy of Management
Journal. Bridges: Kristof-Brown et al. (2005);
Swann & Bosson (2010); Levashina et al. (2014).
AI proxy — under investigation in AscendX RCT.'

── credibilityFlag ──────────────────────────────────────────────
This is a null-alignment detection signal. Flag when the gap between what the
candidate said and what their documented background or the role requires is large
enough to undermine confidence in the interview evidence.

SET credibilityFlag.triggered = true IF:
  cvAlignmentScore is not null AND cvAlignmentScore < 20
  OR jdAlignmentScore is not null AND jdAlignmentScore < 20

credibilityFlag: {
  triggered: true | false,
  cvGrounding: 'aligned' | 'partial' | 'absent' | 'no_cv',
  // aligned: clear traceable links between transcript and CV
  // partial: some overlap but significant unexplained claims
  // absent: candidate's interview content has no traceable basis in CV
  // no_cv: no CV was provided
  jdGrounding: 'aligned' | 'partial' | 'absent' | 'no_jd',
  // aligned: answers addressed core JD requirements directly
  // partial: some JD requirements addressed, others ignored
  // absent: answers had no meaningful overlap with JD requirements
  // no_jd: no JD was provided
  flagReason: string | null,
  // Required when triggered = true.
  // Cite the specific mismatch: what did the candidate claim that cannot be
  // traced to their CV, or what core JD requirement went entirely unaddressed?
  // This is a researcher-only field — must be precise and evidence-grounded.
  researchNote: 'Alignment gap between self-report and documented background. Exploratory signal — not a validity judgment. Possible explanations include: undocumented genuine experience, preparation failure, role mismatch, or fabrication. Researcher interpretation required.'
}

── algorithmicAversionSignal (Trust Calibration — Dietvorst et al., 2015; updated framing 2024) ──
Reframed as trust calibration: detects scepticism AND appreciation signals.
Candidates who receive rationale-accompanied feedback show higher trust (2024 explainable AI literature).
algorithmicAversionSignal: {
  aversionDetected: true | false,
  aversionEvidence: string | null,
  feedbackImplication: string  // whether Layer A opened with acknowledgement and rationale transparency
}

── socialIdentityAwareness (Highhouse et al., 2007) ────────────
SCOPE RESTRICTION: Only score if candidate discussed motivation to join the
target organisation. Return activated: false otherwise.
socialIdentityAwareness: {
  activated: true | false,
  valueExpressionScore: 0–100 | null,
  socialRecognitionScore: 0–100 | null,
  dominantMotivation: 'value_expression' | 'social_recognition' | null,
  scopeNote: 'Applied only where candidate discussed organisation motivation'
}

── chcCognitiveDimensions (Kolb ELC Stage Completion Signals — Kolb 1984; POT proxy per Kovacs & Conway 2016) ──
THEORETICAL GROUNDING: These are Kolb ELC stage completion signals inferred from transcript quality.
They do NOT claim to measure cognitive ability. Field names match Kolb stage terminology directly.
  abstractConceptualisation: AC quality — did the candidate draw on accumulated domain knowledge to
    construct meaning from their experience?
  activeExperimentation: AE quality — did the candidate reason adaptively under novel probing,
    showing they can test new approaches?
  concreteExperience: CE specificity — did the candidate articulate measurable outcomes, grounding
    abstract reflection in specific evidence?
Process Overlap Theory (Kovacs & Conway, 2016) provides the inferential mechanism.
chcCognitiveDimensions: {
  abstractConceptualisation: {
    score: 0–100 | null,
    // AC signal: depth of domain knowledge applied; vocabulary precision; role-specific evidence drawn on
    evidenceBasis: string,
    validityDisclaimer: 'Kolb Abstract Conceptualisation proxy — exploratory signal, not an ability measure'
  },
  activeExperimentation: {
    score: 0–100 | null,
    // AE signal: adaptive reasoning flexibility under novel probing; reasoning under uncertainty
    evidenceBasis: string,
    validityDisclaimer: 'Kolb Active Experimentation proxy — exploratory signal, not an ability measure'
  },
  concreteExperience: {
    score: 0–100 | null,
    // CE signal: result specificity; measurable outcomes; transfer from learning to action articulated
    evidenceBasis: string,
    validityDisclaimer: 'Kolb Concrete Experience specificity proxy — exploratory signal, not an ability measure'
  },
  overallELCNote: string,
  researchNote: 'Kolb ELC stage completion signals (Kolb, 1984). Process Overlap Theory (Kovacs & Conway, 2016) as inferential mechanism. AI operationalisation — empirical validation against external instruments pending.'
}

── scaffoldedLearningSignal (Vygotsky 1978; Wood et al. 1976; adaptive LLM scaffolding theory 2025) ─
NOTE: Probe difficulty escalation follows LLM-based adaptive scaffolding principles (arxiv 2025)
where support withdrawal is based on observed performance, not fixed question index.
scaffoldedLearningSignal: {
  zpdProgressionObservation: string,  // did performance improve across phases?
  scaffoldDependency: {
    score: 0–100,
    // >70 = high dependency, performed much better with scaffold than without
    // <40 = low dependency, consistent across phases
    interpretation: 'scaffolded' | 'independent' | 'declining',
    researchNote: string
  },
  zoneOfProximalDevelopmentEstimate: {
    lowerBoundary: string,  // what candidate demonstrated independently
    upperBoundary: string,  // what candidate demonstrated WITH probing support
    developmentGap: string, // specific skill that scaffold unlocked
    practiceRecommendation: string
  },
  phasingEffectiveness: {
    phase1Score: 0–100 | null,
    phase2Score: 0–100 | null,
    phase3Score: 0–100 | null,
    trajectory: 'improving' | 'stable' | 'declining' | 'variable'
  }
}

── psychologicalSafetyScore ─────────────────────────────────────
psychologicalSafetyScore: {
  score: 0–100,
  // Self-assessed from Psychological Safety Self-Audit in Step 0
  // 100 = all audit items passed, feedback is fully safe to deliver
  checklist: {
    taskLevelOnly: true | false,
    noDemotivatorsUsed: true | false,
    rationalePresent: true | false,
    atLeastFiveSuggestions: true | false,
    strengthsFirst: true | false,
    warmTone: true | false
  }
}

── verbalImprovementPlan (Layer A — candidate-facing verbal coaching) ──────────────────────────
Analyse the TRANSCRIPT for verbal communication patterns. Be specific — reference actual moments.
verbalImprovementPlan: {
  fillerPatterns: string,
  // Identify specific filler words, hesitation markers, or repetition patterns observed.
  // Quote the actual words/phrases. E.g. "You used 'basically' and 'you know' frequently,
  // particularly when transitioning between STAR stages — these signal uncertainty to interviewers."
  // If none detected, state that clearly.

  pacingAssessment: string,
  // How did the candidate's speaking pace affect comprehension and confidence signal?
  // Did they rush under probing? Trail off at the Result stage? Be specific to the transcript.

  clarityTargets: string[],
  // 2–3 specific verbal habits to change — each one sentence, directly actionable.
  // E.g. "Replace 'we did' with 'I specifically did' when describing your action steps."
  // Must reference something actually observed in the transcript.

  practiceMethod: string
  // One concrete method to fix the identified patterns before the next session.
  // E.g. "Record yourself answering one STAR question per day and listen back for the
  // specific fillers above — marking the timestamp each time helps pattern recognition."
}

── hiringProfileAlignment (Layer A — recruiter/hiring manager perspective) ─────────────────────
You are now thinking like a hiring manager for the ${params.targetRole} role at ${params.companyName}.
What does someone in that hiring seat actually look for — and how does this candidate match?
hiringProfileAlignment: {
  whatInterviewersLookFor: string[],
  // 3–4 signals hiring managers for THIS specific role and company actually screen for.
  // Ground this in the JD and role level. Be specific — not generic interview tips.
  // E.g. "Evidence of managing competing priorities without escalating to management"

  candidateAlignedStrengths: string[],
  // Where does this candidate already match the hiring profile? 2–3 points.
  // Must reference something the candidate actually said.

  profileGaps: string[],
  // What is missing from the hiring manager's perspective? 2–3 specific gaps.
  // Frame as observable evidence gaps, not personal criticisms.
  // E.g. "No evidence of working with external stakeholders — critical for this role."

  priorityFix: string
  // The ONE change that would most increase this candidate's hireability for this role.
  // Be direct. One sentence. This is the most important output of this section.
}

${learningIntentionInstruction}
── amoPerformanceContext (Layer A — session-level AMO note, candidate-facing) ───────────────────
[Appelbaum et al. (2000) AMO Framework — contextualise performance without blaming the candidate]
Review ALL probe analyses in the session data. If ANY question had a 'low' AMO dimension:
  Write 1–2 sentences in plain English that contextualise what affected performance across the session.
  NEVER use labels 'AMO', 'ability', 'motivation', 'opportunity'.
  Frame as a condition that affected performance, not a critique of the candidate.
  Example (low opportunity across session): "Several questions in this session were more demanding than
    your warm-up level — performance under high pressure often understates what you are capable of in
    a prepared setting. Practice that recreates this pressure will help close that gap."
  Example (low motivation signal): "Your strongest answers were for the questions you connected to
    personally — building that personal connection to more of the role's responsibilities will unlock
    more of your interview capability."
  Example (all high): return null.
Return null if all AMO dimensions were high across all questions in the session.

── elcLearningCycle (Layer A — Kolb ELC session trace, written for candidate) ──────────────────
[Kolb (1984) Experiential Learning Cycle — all four stages MUST be populated; an incomplete cycle produces no learning]
[Gibbs (1988) — this section is the candidate-facing synthesis of all six Gibbs stages in one learning arc]
[Boud & Molloy (2013) — experimentationTarget closes the loop: it is the entry gate to the next ELC cycle]
Frame this as a learning cycle trace — what happened at each stage of this session.
Write in plain English. This helps the candidate understand HOW they learned, not just WHAT they did.
elcLearningCycle: {
  concreteExperienceBaseline: string,
  // What did this session reveal about the candidate's current interview performance level?
  // One sentence grounding the starting point — what they came in able to do.

  reflectiveObservationInsight: string,
  // What did the follow-up probe question reveal that the initial answer did not?
  // This is what reflection unlocked. One sentence, specific to the probe exchange.
  // If no probe was used, describe what self-reflection the candidate showed.

  abstractPrinciple: string,
  // The transferable principle this session produced — something the candidate can carry
  // into any interview, not just this one. One clear sentence.
  // E.g. "Strong Result statements require a measurable outcome AND a reflection on
  // what you would do differently — you have the outcome, not yet the reflection."

  experimentationTarget: string
  // The single thing to TEST in the next session or real interview.
  // Must be specific enough to know if they did it. One sentence.
  // E.g. "Lead your next Action section with your decision, not the context — say
  // 'I decided to...' before explaining why."
}

── transcriptAnnotations (Layer A — sentence-level translation coaching) ────────────────────────
This is the most important coaching field in the report.
Its purpose: take the candidate's actual words and show them — sentence by sentence — how those
same ideas would sound in polished, interview-standard language. This is not correction; it is translation.

SCOPE: Identify the 6–10 moments in the transcript with the highest learning leverage.
A "high-leverage moment" is any phrase where:
  - A STAR component was addressed (even partially)
  - Personal agency language appeared or was conspicuously absent
  - A skill, decision, or outcome was described in a way that could be made more specific
  - The candidate said something genuinely strong that deserves to be named and anchored
  - The probe exchange revealed a deeper capability that the initial answer did not express

For each moment, provide this exact structure:
{
  moment: string,           // Attribution + verbatim or near-verbatim phrase.
                            // Format: "When describing [context], you said: '[phrase]'"
                            // If a probe exchange: "In response to the follow-up question, you added: '[phrase]'"
  observation: string,      // 2–3 sentences. What this phrase reveals — what it does well first,
                            // then what single element would make it interview-complete.
                            // ALWAYS acknowledge the genuine intent or capability behind the phrase.
                            // Formal, polite, warm. NEVER negative-first.
  standardVersion: string,  // The complete rewritten sentence, ready to use verbatim.
                            // Must be in the candidate's voice — personalised to their experience.
                            // Must feel like a natural upgrade, not a different person speaking.
                            // Format: "An equally honest and more structured way to express this would be:
                            // '[complete sentence the candidate could say in an interview]'"
  principle: string         // One plain-English sentence naming the single principle this rewrite embodies.
                            // E.g. "Personal ownership language signals decision-making authority to interviewers"
                            // E.g. "Measurable results give hiring managers something concrete to advocate for"
                            // NO theoretical labels or citations — plain language the candidate can remember
}

ABSOLUTE RULES:
1. standardVersion is a GIFT, not a correction — frame it as a natural, honest upgrade of their own words
2. Every observation must acknowledge what was accomplished before identifying what remains
3. NEVER annotate a moment that is already fully interview-standard — only annotate where translation adds value
4. The tone across all annotations: formal, polite, warm, reinforcing — as if written by a trusted career coach
5. The candidate must finish reading this section feeling they have a clear, achievable upgrade path

── masteryTracker (4A — STAR mastery per component, cross-session consolidation) ──
masteryTracker: {
  situation: { status: 'reached' | 'partial' | 'not_reached' },
  task:      { status: 'reached' | 'partial' | 'not_reached' },
  action:    { status: 'reached' | 'partial' | 'not_reached' },
  result:    { status: 'reached' | 'partial' | 'not_reached' },
  consolidatedComponents: []  // leave empty — injected from cross-session data post-generation
}
For each STAR component: 'reached' = fully evidenced in THIS session's transcript; 'partial' = present but incomplete; 'not_reached' = absent.
${masteryContext}

── calibrationAccuracy (4B — self vs AI rating gap, prior session patterns) ──
calibrationAccuracy: {
  candidateSelfRating: string,  // infer from any self-assessment language in transcript (e.g. "I think I explained that well")
  aiCompetencyRating: string,   // your overall competency level assessment (e.g. "Developing — partial STAR")
  calibrationGap: 'overestimate' | 'accurate' | 'underestimate',
  calibrationDirection: string, // plain English: what they got right or wrong about themselves
  priorSessionGaps: [],          // leave empty — injected from cross-session data post-generation
  consistentPattern: string      // what pattern of self-calibration do you observe in this session? (1 sentence)
}

── biasAndFairnessNote ─────────────────────────────────────────
Bias & Fairness note for the researcher.

── integrityViolation ───────────────────────────────────────────
Detect any integrity issues.
type: 'abusive_language' | 'sensitive_information' | 'low_value' | 'out_of_context'
note: Brief explanation.

── maskedTranscript ────────────────────────────────────────────
Full transcript with PII removed for research storage
text: string
        `
        }]
      }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            noData: { type: Type.BOOLEAN },
            performanceSummary: { type: Type.STRING },
            overallStarSynthesis: { type: Type.STRING },
            strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
            weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
            actionableSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
            starAnalysis: {
              type: Type.OBJECT,
              properties: {
                situation: { type: Type.STRING },
                task: { type: Type.STRING },
                action: { type: Type.STRING },
                result: { type: Type.STRING }
              },
              required: ["situation", "task", "action", "result"]
            },
            keywordCoverage: {
              type: Type.OBJECT,
              properties: {
                found: { type: Type.ARRAY, items: { type: Type.STRING } },
                missing: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["found", "missing"]
            },
            careerDevelopment: {
              type: Type.OBJECT,
              properties: {
                certifications: { type: Type.ARRAY, items: { type: Type.STRING } },
                nextSteps: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["certifications", "nextSteps"]
            },
            rubrics: {
              type: Type.OBJECT,
              properties: {
                starCompletion: { type: Type.NUMBER },
                evidenceSpecificity: { type: Type.NUMBER },
                roleClarity: { type: Type.NUMBER },
                jdAlignment: { type: Type.NUMBER },
                confidence: { type: Type.NUMBER },
                justifications: {
                  type: Type.OBJECT,
                  properties: {
                    starCompletion: { type: Type.STRING },
                    evidenceSpecificity: { type: Type.STRING },
                    roleClarity: { type: Type.STRING },
                    jdAlignment: { type: Type.STRING },
                    confidence: { type: Type.STRING }
                  },
                  required: ["starCompletion", "evidenceSpecificity", "roleClarity", "jdAlignment", "confidence"]
                }
              },
              required: ["starCompletion", "evidenceSpecificity", "roleClarity", "jdAlignment", "confidence", "justifications"]
            },
            meritVectors: {
              type: Type.OBJECT,
              properties: {
                personalAgency: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, evidenceBasis: { type: Type.STRING } }, required: ["score", "evidenceBasis"] },
                skillSpecificity: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, evidenceBasis: { type: Type.STRING } }, required: ["score", "evidenceBasis"] },
                impactArticulation: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, evidenceBasis: { type: Type.STRING } }, required: ["score", "evidenceBasis"] },
                lowestVector: { type: Type.STRING, enum: ['personalAgency', 'skillSpecificity', 'impactArticulation'] },
                primarySuggestionAnchor: { type: Type.STRING }
              },
              required: ["personalAgency", "skillSpecificity", "impactArticulation", "lowestVector", "primarySuggestionAnchor"]
            },
            professionalSelfVerificationSignals: {
              type: Type.OBJECT,
              properties: {
                voice: {
                  type: Type.OBJECT,
                  properties: {
                    score: { type: Type.NUMBER },
                    orientation: {
                      type: Type.STRING,
                      enum: [
                        'self_verifying',
                        'impression_managing',
                        'balanced'
                      ]
                    },
                    evidenceBasis: { type: Type.STRING }
                  },
                  required: ["score", "orientation", "evidenceBasis"]
                },
                motivation: {
                  type: Type.OBJECT,
                  properties: {
                    score: { type: Type.NUMBER },
                    orientation: {
                      type: Type.STRING,
                      enum: [
                        'self_verifying',
                        'impression_managing',
                        'balanced'
                      ]
                    },
                    evidenceBasis: { type: Type.STRING }
                  },
                  required: ["score", "orientation", "evidenceBasis"]
                },
                explanation: {
                  type: Type.OBJECT,
                  properties: {
                    score: { type: Type.NUMBER },
                    orientation: {
                      type: Type.STRING,
                      enum: [
                        'self_verifying',
                        'impression_managing',
                        'balanced'
                      ]
                    },
                    evidenceBasis: { type: Type.STRING }
                  },
                  required: ["score", "orientation", "evidenceBasis"]
                },
                dominantMode: {
                  type: Type.STRING,
                  enum: [
                    'self_verifying',
                    'impression_managing',
                    'mixed'
                  ]
                },
                fitSignal: { type: Type.STRING },
                feedbackImplication: { type: Type.STRING },
                researchNote: { type: Type.STRING }
              },
              required: [
                "voice",
                "motivation",
                "explanation",
                "dominantMode",
                "fitSignal",
                "feedbackImplication",
                "researchNote"
              ]
            },
            credibilityFlag: {
              type: Type.OBJECT,
              properties: {
                triggered: { type: Type.BOOLEAN },
                cvGrounding: { type: Type.STRING, enum: ['aligned', 'partial', 'absent', 'no_cv'] },
                jdGrounding: { type: Type.STRING, enum: ['aligned', 'partial', 'absent', 'no_jd'] },
                flagReason: { type: Type.STRING, nullable: true },
                researchNote: { type: Type.STRING }
              },
              required: ["triggered", "cvGrounding", "jdGrounding", "researchNote"]
            },
            algorithmicAversionSignal: {
              type: Type.OBJECT,
              properties: {
                aversionDetected: { type: Type.BOOLEAN },
                aversionEvidence: { type: Type.STRING, nullable: true },
                feedbackImplication: { type: Type.STRING }
              },
              required: ["aversionDetected", "feedbackImplication"]
            },
            socialIdentityAwareness: {
              type: Type.OBJECT,
              properties: {
                activated: { type: Type.BOOLEAN },
                valueExpressionScore: { type: Type.NUMBER, nullable: true },
                socialRecognitionScore: { type: Type.NUMBER, nullable: true },
                dominantMotivation: { type: Type.STRING, nullable: true, enum: ['value_expression', 'social_recognition'] },
                scopeNote: { type: Type.STRING }
              },
              required: ["activated", "scopeNote"]
            },
            chcCognitiveDimensions: {
              type: Type.OBJECT,
              properties: {
                abstractConceptualisation: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER, nullable: true }, evidenceBasis: { type: Type.STRING }, validityDisclaimer: { type: Type.STRING } }, required: ["evidenceBasis", "validityDisclaimer"] },
                activeExperimentation: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER, nullable: true }, evidenceBasis: { type: Type.STRING }, validityDisclaimer: { type: Type.STRING } }, required: ["evidenceBasis", "validityDisclaimer"] },
                concreteExperience: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER, nullable: true }, evidenceBasis: { type: Type.STRING }, validityDisclaimer: { type: Type.STRING } }, required: ["evidenceBasis", "validityDisclaimer"] },
                overallELCNote: { type: Type.STRING },
                researchNote: { type: Type.STRING }
              },
              required: ["abstractConceptualisation", "activeExperimentation", "concreteExperience", "overallELCNote", "researchNote"]
            },
            scaffoldedLearningSignal: {
              type: Type.OBJECT,
              properties: {
                zpdProgressionObservation: { type: Type.STRING },
                scaffoldDependency: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, interpretation: { type: Type.STRING, enum: ['scaffolded', 'independent', 'declining'] }, researchNote: { type: Type.STRING } }, required: ["score", "interpretation", "researchNote"] },
                zoneOfProximalDevelopmentEstimate: { type: Type.OBJECT, properties: { lowerBoundary: { type: Type.STRING }, upperBoundary: { type: Type.STRING }, developmentGap: { type: Type.STRING }, practiceRecommendation: { type: Type.STRING } }, required: ["lowerBoundary", "upperBoundary", "developmentGap", "practiceRecommendation"] },
                phasingEffectiveness: { type: Type.OBJECT, properties: { phase1Score: { type: Type.NUMBER, nullable: true }, phase2Score: { type: Type.NUMBER, nullable: true }, phase3Score: { type: Type.NUMBER, nullable: true }, trajectory: { type: Type.STRING, enum: ['improving', 'stable', 'declining', 'variable'] } }, required: ["trajectory"] }
              },
              required: ["zpdProgressionObservation", "scaffoldDependency", "zoneOfProximalDevelopmentEstimate", "phasingEffectiveness"]
            },
            psychologicalSafetyScore: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.NUMBER },
                checklist: {
                  type: Type.OBJECT,
                  properties: {
                    taskLevelOnly: { type: Type.BOOLEAN },
                    noDemotivatorsUsed: { type: Type.BOOLEAN },
                    rationalePresent: { type: Type.BOOLEAN },
                    atLeastFiveSuggestions: { type: Type.BOOLEAN },
                    strengthsFirst: { type: Type.BOOLEAN },
                    warmTone: { type: Type.BOOLEAN }
                  },
                  required: ["taskLevelOnly", "noDemotivatorsUsed", "rationalePresent", "atLeastFiveSuggestions", "strengthsFirst", "warmTone"]
                }
              },
              required: ["score", "checklist"]
            },
            masteryTracker: {
              type: Type.OBJECT,
              properties: {
                situation: { type: Type.OBJECT, properties: { status: { type: Type.STRING, enum: ['reached', 'partial', 'not_reached'] } }, required: ["status"] },
                task:      { type: Type.OBJECT, properties: { status: { type: Type.STRING, enum: ['reached', 'partial', 'not_reached'] } }, required: ["status"] },
                action:    { type: Type.OBJECT, properties: { status: { type: Type.STRING, enum: ['reached', 'partial', 'not_reached'] } }, required: ["status"] },
                result:    { type: Type.OBJECT, properties: { status: { type: Type.STRING, enum: ['reached', 'partial', 'not_reached'] } }, required: ["status"] },
                consolidatedComponents: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["situation", "task", "action", "result", "consolidatedComponents"]
            },
            calibrationAccuracy: {
              type: Type.OBJECT,
              properties: {
                candidateSelfRating:  { type: Type.STRING },
                aiCompetencyRating:   { type: Type.STRING },
                calibrationGap:       { type: Type.STRING, enum: ['overestimate', 'accurate', 'underestimate'] },
                calibrationDirection: { type: Type.STRING },
                priorSessionGaps:     { type: Type.ARRAY, items: { type: Type.STRING } },
                consistentPattern:    { type: Type.STRING }
              },
              required: ["candidateSelfRating", "aiCompetencyRating", "calibrationGap", "calibrationDirection", "priorSessionGaps", "consistentPattern"]
            },
            verbalImprovementPlan: {
              type: Type.OBJECT,
              properties: {
                fillerPatterns:  { type: Type.STRING },
                pacingAssessment: { type: Type.STRING },
                clarityTargets:  { type: Type.ARRAY, items: { type: Type.STRING } },
                practiceMethod:  { type: Type.STRING }
              },
              required: ["fillerPatterns", "pacingAssessment", "clarityTargets", "practiceMethod"]
            },
            hiringProfileAlignment: {
              type: Type.OBJECT,
              properties: {
                whatInterviewersLookFor:    { type: Type.ARRAY, items: { type: Type.STRING } },
                candidateAlignedStrengths:  { type: Type.ARRAY, items: { type: Type.STRING } },
                profileGaps:               { type: Type.ARRAY, items: { type: Type.STRING } },
                priorityFix:               { type: Type.STRING }
              },
              required: ["whatInterviewersLookFor", "candidateAlignedStrengths", "profileGaps", "priorityFix"]
            },
            transcriptAnnotations: {
              type: Type.ARRAY,
              nullable: true,
              items: {
                type: Type.OBJECT,
                properties: {
                  moment:          { type: Type.STRING },
                  observation:     { type: Type.STRING },
                  standardVersion: { type: Type.STRING },
                  principle:       { type: Type.STRING }
                },
                required: ["moment", "observation", "standardVersion", "principle"]
              }
            },
            cvMissedOpportunities: {
              type: Type.ARRAY,
              nullable: true,
              items: {
                type: Type.OBJECT,
                properties: {
                  cvItem:          { type: Type.STRING },
                  questionContext: { type: Type.STRING },
                  whyItFits:       { type: Type.STRING },
                  exampleUsage:    { type: Type.STRING }
                },
                required: ["cvItem", "questionContext", "whyItFits", "exampleUsage"]
              }
            },
            amoPerformanceContext: { type: Type.STRING, nullable: true },
            feedbackApproachLevel: { type: Type.STRING, nullable: true },
            intentionAssessment: { type: Type.STRING, nullable: true },
            elcLearningCycle: {
              type: Type.OBJECT,
              properties: {
                concreteExperienceBaseline:     { type: Type.STRING },
                reflectiveObservationInsight:   { type: Type.STRING },
                abstractPrinciple:              { type: Type.STRING },
                experimentationTarget:          { type: Type.STRING }
              },
              required: ["concreteExperienceBaseline", "reflectiveObservationInsight", "abstractPrinciple", "experimentationTarget"]
            },
            biasAndFairnessNote: { type: Type.STRING },
            integrityViolation: {
              type: Type.OBJECT,
              properties: {
                detected: { type: Type.BOOLEAN },
                type: { type: Type.STRING, enum: ['abusive_language', 'sensitive_information', 'low_value', 'out_of_context'] },
                note: { type: Type.STRING }
              },
              required: ["detected", "type", "note"]
            },
            maskedTranscript: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING }
              },
              required: ["text"]
            }
          },
          required: [
            "performanceSummary",
            "overallStarSynthesis",
            "strengths",
            "actionableSuggestions",
            "starAnalysis",
            "keywordCoverage",
            "careerDevelopment",
            "rubrics",
            "meritVectors",
            "professionalSelfVerificationSignals",
            "algorithmicAversionSignal",
            "socialIdentityAwareness",
            "chcCognitiveDimensions",
            "scaffoldedLearningSignal",
            "psychologicalSafetyScore",
            "biasAndFairnessNote",
            "maskedTranscript"
          ]
        }
      }
    });

    const parsed = JSON.parse(response.candidates?.[0]?.content?.parts?.[0]?.text || "{}");

    // 4A — Inject cross-session consolidated flags into masteryTracker
    if (params.mesoAccumulator && parsed.masteryTracker) {
      const consolidated = masteryConsolidated;
      (['situation', 'task', 'action', 'result'] as MasteryComponent[]).forEach(c => {
        if (parsed.masteryTracker[c]) {
          parsed.masteryTracker[c].consolidated = consolidated.includes(c);
        }
      });
      parsed.masteryTracker.consolidatedComponents = consolidated;
    }

    // 4B — Inject prior session gaps into calibrationAccuracy
    if (params.mesoAccumulator && parsed.calibrationAccuracy) {
      parsed.calibrationAccuracy.priorSessionGaps = priorSessionGaps;
    }

    return parsed;
  } catch (err) {
    console.error("Failed to generate detailed feedback:", err);
    // Return a structured error object that UI can handle
    return {
      noData: true,
      performanceSummary: "We encountered an issue while generating your detailed audit. Please try again.",
      overallStarSynthesis: "N/A",
      strengths: [],
      weaknesses: ["Audit generation failed"],
      actionableSuggestions: ["Check your internet connection", "Retry the audit generation"],
      starAnalysis: { situation: "N/A", task: "N/A", action: "N/A", result: "N/A" },
      keywordCoverage: { found: [], missing: [] },
      careerDevelopment: { certifications: [], nextSteps: [] },
      rubrics: {
        starCompletion: 0,
        evidenceSpecificity: 0,
        roleClarity: 0,
        jdAlignment: 0,
        confidence: 0,
        justifications: {
          starCompletion: "Error during generation",
          evidenceSpecificity: "Error during generation",
          roleClarity: "Error during generation",
          jdAlignment: "Error during generation",
          confidence: "Error during generation"
        }
      },
      maskedTranscript: { text: params.transcript }
    } as DetailedFeedback;
  }
};
