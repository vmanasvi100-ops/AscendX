
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

═══════════════════════════════════════════════════════
LAYER A — CANDIDATE-FACING FEEDBACK
Uses Step 0 signals. Written for the student — warm, clear, actionable.
═══════════════════════════════════════════════════════════════════

Using the Step 0 signals, generate the following Layer A components.
Every component must be grounded in what this specific candidate said.
Generic feedback is a failure condition.

── performanceSummary ──────────────────────────────────────────────
3–4 sentences. Warm opening. Acknowledge what genuinely worked.
IF algorithmicAversion.detected = true:
  MUST follow with: 'I want to acknowledge upfront that AI feedback has real
  limitations — it cannot replicate the nuance of a human interviewer.
  What follows is based on the specific evidence in your answers today.'
  
── overallStarSynthesis ──────────────────────────────────────────────
5–6 sentences. A session-wide aggregate analysis of STAR performance.
1. Evaluate STAR completion and evidence quality for each question individually from the transcript.
2. Synthesize these into a global "session-wide synthetic average".
3. Explain this average to the candidate (e.g., "Across all 5 questions, your Action sections were consistently the strongest, whereas Situation descriptions tended to be overly brief, averaging a lower detail score").
4. Acknowledge consistency or variance across different question types.
5. Use warm, coaching-centric language.
IF impressionManagementScore.frontStageScore > 75:
  Include one sentence inviting authentic disclosure:
  'Your answers were well-structured — there is also space to let the specific
   detail of your experience show through more directly.'
IF impressionManagementScore.backStageScore > 75:
  Include one sentence helping structure authentic content:
  'You shared genuine experience — the next step is giving that experience
   a clearer structure so the interviewer can follow your contribution easily.'

── weaknesses ───────────────────────────────────────────────────────
2–3 specific areas where the candidate could have provided more evidence or depth.
Format: [Area]: [Specific missing evidence or advice]

── strengths ───────────────────────────────────────────────────────
2–3 specific, evidence-based strengths from this session.
Each must reference something the candidate actually said.
Format: [Strength label]: [Specific evidence from transcript]
Example: 'Concrete results: You quantified your outcome with a specific figure
  and timeframe — this is exactly what competitive interviewers look for.'

── actionableSuggestions ─────────────────────────────
${blendedFramingInstruction}
CRITICAL: Generate at least 5 actionable suggestions.
Use the Step 0 lowest signals to prioritise these.

PRIORITY ORDER for which suggestion leads:
  1. If lowestVector from Step 0 flags a behavioral evidence gap → Behavioral Evidence leads
  2. If lowestSignal from chcCognitiveDimensions indicates a weak Kolb ELC stage → ELC stage coaching leads
  3. Keyword coverage gap from JD

BEHAVIORAL EVIDENCE TRANSLATIONS (use these exact framings — no theoretical labels visible to candidate):
  Autonomy weak: 'Use more "I decided" and "I chose" language. Interviewers are
    assessing your judgment — they need to hear your specific decisions, not just
    what the team did or what happened. Own your choices explicitly.'
  Competence weak: 'Your answers need more specific evidence of skill. Numbers,
    timelines, and named tools are more convincing than general descriptions.
    What specifically did you do, and what was the measurable result?'
  Relatedness weak: 'Show more awareness of how your work affected others.
    Interviewers at this level assess not just what you achieved but how you
    brought people with you. Name the people, describe the impact on them.'

KOLB ELC STAGE COACHING TRANSLATIONS (plain English — framed as learning cycle stage signals, no CHC labels):
  Gc weak: 'Bring in more specific knowledge about the sector and role.
    One or two precise examples from your reading or experience will signal
    that you understand the world this organisation operates in.'
  Gf weak: 'When a probe shifted the angle, your answer became less flexible.
    Practise with unexpected follow-ups: What if that approach had not worked?
    What would you do differently with hindsight? Flexibility impresses.'
  Gq weak: 'Every STAR answer needs a Result with something measurable.
    A number, a timeframe, a specific outcome. Even small and specific beats
    large and vague every time.'

Each suggestion must include a rationale (max 2 sentences, plain English).

── starAnalysis ────────────────────────────────────────────────────
Per-component assessment for each answer given.
Situation, Task, Action, Result — each rated: strong / partial / missing.
If missing: one sentence on how to complete it. Warm, specific.

── keywordCoverage ─────────────────────────────────────────────────
Cross-reference candidate's answers against the uploaded JD.
List: keywords present (with example usage), keywords missing (with one-line tip).
Language: 'You naturally used...' and 'It would strengthen your case to mention...'

── careerDevelopment ───────────────────────────────────────────────
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

── rubrics ─────────────────────────────────────────────────────────
Score the following per answer. Scale 1–5. Brief justification each.
  - STAR Completion (1–5)
  - Evidence Specificity (1–5)
  - Role Clarity (1–5)
  - JD Alignment (1–5)
  - Communication Clarity (1–5)

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

── elcLearningCycle (Layer A — Kolb ELC session trace, written for candidate) ──────────────────
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
                communicationClarity: { type: Type.NUMBER },
                justifications: {
                  type: Type.OBJECT,
                  properties: {
                    starCompletion: { type: Type.STRING },
                    evidenceSpecificity: { type: Type.STRING },
                    roleClarity: { type: Type.STRING },
                    jdAlignment: { type: Type.STRING },
                    communicationClarity: { type: Type.STRING }
                  },
                  required: ["starCompletion", "evidenceSpecificity", "roleClarity", "jdAlignment", "communicationClarity"]
                }
              },
              required: ["starCompletion", "evidenceSpecificity", "roleClarity", "jdAlignment", "communicationClarity", "justifications"]
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
        communicationClarity: 0,
        justifications: {
          starCompletion: "Error during generation",
          evidenceSpecificity: "Error during generation",
          roleClarity: "Error during generation",
          jdAlignment: "Error during generation",
          communicationClarity: "Error during generation"
        }
      },
      maskedTranscript: { text: params.transcript }
    } as DetailedFeedback;
  }
};
