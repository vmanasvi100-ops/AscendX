
import { GoogleGenAI, Type } from "@google/genai";
import { Probe, ProbeAnalysis, QuestionDataAccumulator, QuestionSummaryReport, MesoAccumulator } from "../types";

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || "";
  return new GoogleGenAI({ apiKey });
};

export interface GenerateProbeParams {
  candidateId: string;
  targetRole: string;
  companyName: string;
  cvSummary: string;
  jobDescription: string;
  currentQuestion: { text: string; type: string; difficulty?: string; competency?: string; excellenceBenchmark?: string; discriminantSignals?: string[] };
  sessionPhaseIndex: number;
  questionsAnsweredCount: number;
  priorProbesThisQuestion: string;
  candidateAnswer: string;
  conversationHistory: string;
  cumulativeTranscript?: string;
  candidateProfile?: { experience: string; feedbackLiteracy: string; seeksFeedback: string; regulatoryFocus: string; anxietyLevel: string } | null;
  mesoAccumulator?: Pick<MesoAccumulator, 'delta'> | null;
}

export const generateProbe = async (params: GenerateProbeParams): Promise<Probe> => {
  const ai = getAI();
  const model = "gemini-3-flash-preview";

  // 3A — ZPD phase offset: if cross-session scaffold reduced, advance phase thresholds by 1
  const phaseOffset = params.mesoAccumulator?.delta?.mesoScaffoldReduced ? 1 : 0;
  const p1End    = 2 - phaseOffset;
  const p2Start  = 3 - phaseOffset;
  const p2End    = 6 - phaseOffset;
  const p3Start  = 7 - phaseOffset;

  // 3B — Prior feed-forward: last session's forward orientation note
  const priorFeedForwardAction = params.mesoAccumulator?.delta?.priorFeedForwardAction ?? null;

  // 3B — Meso profile overrides (regulatory shift, feedback orientation, anxiety)
  const mesoDelta = params.mesoAccumulator?.delta;
  const mesoProfileBlock = mesoDelta
    ? `CROSS-SESSION MESO PROFILE OVERRIDE (supersedes single-session profile for the fields below):
      Regulatory shift trend: ${mesoDelta.regulatoryShift} | Feedback orientation trend: ${mesoDelta.feedbackOrientationDelta} | Dominant anxiety: ${mesoDelta.dominantAnxietyLevel}
      ${mesoDelta.regulatoryShift === 'prevention_to_promotion' ? '→ BLENDED FRAMING: Use both "building on strengths" AND "closing gaps" language.' : ''}
      ${mesoDelta.feedbackOrientationDelta === 'improving' ? '→ ORIENTATION IMPROVING: Encourage self-reflection before delivering rationale.' : mesoDelta.feedbackOrientationDelta === 'declining' ? '→ ORIENTATION DECLINING: Open rationale with reassurance before coaching point.' : ''}`
    : '';

  const priorFeedForwardBlock = priorFeedForwardAction
    ? `PRIOR SESSION FEED-FORWARD (from Session N-1 forward orientation):
      "${priorFeedForwardAction}"
      → Q2 probe: reference this if the candidate's answer evidences they acted on it.
      → calibrationNote: acknowledge whether this recommendation appears to have been practised.
      → By Q4: flag in zpd_note if there is no evidence this was acted upon.`
    : '';

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `You are AscendX, an expert AI interview coach grounded in occupational psychology.
Your role is to generate a single, high-quality adaptive follow-up probe based on
what the candidate just said.

═══════════════════════════════════════════════════════════════════
CORE PROBING PRINCIPLES — NEVER VIOLATE THESE
═══════════════════════════════════════════════════════════════════

1. CONTEXTUAL CONTINUITY (most important rule)
   Every probe MUST reference the candidate's specific language.
   If they said 'I was the anchor for the team' — probe the word 'anchor'.
   NEVER ask a generic competency question that could apply to anyone.
   The candidate must be able to see that you heard exactly what they said.

2. FIVE PROBE TYPES (select the most appropriate one per turn)
   CLARIFYING: Follow up on a CV claim or professional term.
      'Your CV mentions leading a team of eight — what did that leadership
      look like day-to-day in this specific project?'
   CONCRETE: Bridge from abstract claim to specific evidence.
      'You described it as a challenging environment — what made it specifically
      challenging, and what did you do about that?'
   DEEPENING: Extend a strong answer to reveal greater depth.
      'That result is compelling — what was the single decision that made it possible?'
   REDIRECTING: Return candidate to the question if they have drifted.
      'That context is useful — I want to bring us back to your specific role
      in the decision. What did you personally decide to do?'
   STRATEGIC: Challenge assumptions and test systemic thinking.
      'What would a critic of that approach say, and how would you respond to them?'

3. RATIONALE FIELD (Professional Self-Verification — Cable & Kay, 2012)
   Every probe must include a rationale — a plain-English explanation of why
   this specific probe is being asked. Max 2 sentences. No jargon.
   NEVER use terms like 'Gc', 'Gf', 'SDT', 'ZPD', or 'Back-stage' in the rationale.
   Example: 'This question helps interviewers understand how you translate
   experience into action. Specific evidence is more convincing than general claims.'

4. COHERENCE CHAINING
   Each probe must build on the full conversation so far — not just the last answer.
   The session should deepen, not restart.

5. DRIFT DETECTION
   If the candidate's answer is off-topic or vague, use a REDIRECTING probe.
   Never engage the off-topic content — redirect professionally.

 ═══════════════════════════════════════════════════════════════════
 SCAFFOLD MODULATION — Wood, Bruner & Ross (1976)
 ═══════════════════════════════════════════════════════════════════

Scaffolding principle: match support level to the candidate's current independent
performance boundary (Zone of Proximal Development lower boundary).
Gradually withdraw support as competence increases within the session.

PHASE 1 — Introductory Alignment (session_phase_index 0–${p1End}, difficulty: EASY)
  Lower boundary: candidate is at baseline — maximum scaffold provided.
  → Use supportive, structured language with no ambiguity
  → Offer structural hints if answer was incomplete:
      'You described the situation well — what was your specific role in the action?'
  → If answer was strong, acknowledge briefly before deepening
  → NEVER increase cognitive pressure at this stage
  → Rationale MUST be detailed and warm

PHASE 2 — Core Competency (session_phase_index ${p2Start}–${p2End}, difficulty: MEDIUM)
  Lower boundary rising — moderate scaffold, building independence.
  → Reference candidate's language as always
  → Probe the gap between claim and evidence directly
  → Introduce mild abstraction: 'What would you do differently now?'
  → Structural hints are reduced — candidate should be building structure independently
  → Rationale present but briefer

PHASE 3 — Strategic High-Stakes (session_phase_index ${p3Start}+, difficulty: HARD)
  Lower boundary near upper — minimal scaffold, independent performance.
  → Ask for systemic thinking: 'How would you scale this approach organisation-wide?'
  → Challenge assumptions: 'What would a critic of that approach say?'
  → Demand abstract reasoning: 'What does this experience reveal about how you lead?'
  → No structural hints — candidate has been scaffolded to this point
  → Rationale is brief — candidate should expect challenge now

 ═══════════════════════════════════════════════════════════════════
 CRITICAL QUALITY RULES
 ═══════════════════════════════════════════════════════════════════

→ ONE probe per turn. Never ask two questions.
→ Maximum 35 words for the probe itself.
→ Never use the word 'challenge' as a synonym for problem — it is overused in
  interview coaching and signals a template.
→ Never use 'Can you tell me more about...' as an opener — too generic.
→ Never reference psychological frameworks by name to the candidate.
→ If insufficient context exists to generate a meaningful probe,
  return probe_type: 'INSUFFICIENT_CONTEXT' and explain what is missing.`
          },
          {
            text: `
      CANDIDATE CONTEXT:
      Name / ID: ${params.candidateId}
      Target Role: ${params.targetRole}
      Company: ${params.companyName}
      CV Summary: ${params.cvSummary}
      Job Description: ${params.jobDescription}

      SESSION STATE:
      Current Question: ${params.currentQuestion.text}
      Question Type: ${params.currentQuestion.type}
      Session Phase Index: ${params.sessionPhaseIndex}
      Question Difficulty: ${params.currentQuestion.difficulty}
      Questions Answered So Far: ${params.questionsAnsweredCount}
      Prior Probes This Question: ${params.priorProbesThisQuestion}
      ${params.currentQuestion.competency ? `Competency Being Assessed: ${params.currentQuestion.competency}` : ''}
      ${params.currentQuestion.excellenceBenchmark ? `Excellence Benchmark (what Level 5 looks like): ${params.currentQuestion.excellenceBenchmark}` : ''}
      ${params.currentQuestion.discriminantSignals?.length ? `Discriminant Signals (what separates good from exceptional — target these in your probe):\n      ${params.currentQuestion.discriminantSignals.map((s, i) => `${i + 1}. ${s}`).join('\n      ')}` : ''}



      ADAPTIVE PROFILE MODIFIERS (apply to tone and rationale only — never change phase difficulty):
      ${params.candidateProfile ? `Experience: ${params.candidateProfile.experience} | Feedback literacy: ${params.candidateProfile.feedbackLiteracy} | Seeks feedback: ${params.candidateProfile.seeksFeedback} | Regulatory focus: ${params.candidateProfile.regulatoryFocus} | Anxiety level: ${params.candidateProfile.anxietyLevel}
      — novice/high-anxiety: warmer, longer rationale; overwhelmed/uncertain: simpler language; promotion: frame as building on strengths; prevention: frame as avoiding gaps; proactive: encourage self-reflection before rationale; avoidant: lead rationale with reassurance before coaching point.` : 'No profile provided — use defaults.'}
      ${mesoProfileBlock}
      ${priorFeedForwardBlock}

      CANDIDATE'S CURRENT ANSWER / CUMULATIVE TRANSCRIPT:
      ${params.cumulativeTranscript || params.candidateAnswer}

      CONVERSATION HISTORY (last 3 exchanges):
      ${params.conversationHistory}

      TASK:
      Generate a single adaptive probe following all system instructions.
      Ensure the probe heavily targets the "TARGET SIGNAL FOR THIS PROBE".
      Return JSON only — no preamble, no markdown.
          `
          }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          probe: { type: Type.STRING },
          probe_type: {
            type: Type.STRING,
            enum: ['CLARIFYING', 'CONCRETE', 'DEEPENING', 'REDIRECTING', 'STRATEGIC', 'INSUFFICIENT_CONTEXT']
          },
          rationale: { type: Type.STRING },
          contextual_anchor: { type: Type.STRING },
          scaffold_phase: { type: Type.INTEGER },
          difficulty: {
            type: Type.STRING,
            enum: ['EASY', 'MEDIUM', 'HARD']
          },
          question_type: {
            type: Type.STRING,
            enum: ['INTRODUCTORY_ALIGNMENT', 'CORE_COMPETENCY', 'STRATEGIC_HIGH_STAKES']
          },
          zpd_note: { type: Type.STRING }
        },
        required: ["probe", "probe_type", "rationale", "contextual_anchor", "scaffold_phase", "difficulty", "question_type", "zpd_note"]
      }
    }
  });

  return JSON.parse(response.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
};

export interface AnalyzeProbeResponseParams {
  targetRole: string;
  companyName: string;
  question: string;
  probe?: string;
  probeType?: string;
  probeRationale?: string;
  response: string;
  scaffoldPhase: number;
}

export const analyzeProbeResponse = async (params: AnalyzeProbeResponseParams): Promise<ProbeAnalysis> => {
  const ai = getAI();
  const model = "gemini-3-flash-preview";

  const aiResponse = await ai.models.generateContent({
    model,
    contents: [
      {
        role: 'user', // System instruction as a user turn for contents[0]
        parts: [{
          text: `You are AscendX, an expert occupational psychology researcher.
Analyse the candidate's response. This could be a STAR phase completion (silent) or a response to a probe.
Return JSON only — no preamble, no markdown.

CANDIDATE CONTEXT:
Target Role: ${params.targetRole} at ${params.companyName}
Question: ${params.question}
${params.probe ? `Probe Asked: ${params.probe}\nProbe Type: ${params.probeType}\nProbe Rationale: ${params.probeRationale}` : 'Silent STAR Phase Analysis (No Probe)'}
Candidate's Response: ${params.response}

═══════════════════════════════════════════════════════════════════
ANALYSIS TASKS — RETURN THE FULL SIGNAL SET EVERY TIME
═══════════════════════════════════════════════════════════════════

1. PROBE EFFECTIVENESS
   probe_successful: true if the candidate provided meaningful content.
   depth_delta: 'increased' | 'same' | 'decreased' compared to previous context.
   evidence_added: one sentence describing what new evidence appeared.

2. STAR PROGRESSION
   Assess what parts of the STAR framework the candidate has covered so far.
   star_status: { situation, task, action, result } (complete | partial | missing | not_yet_required)

3. OWNERSHIP LANGUAGE DENSITY (0-100)
   Score the density of ownership and agency language in this response only.
   autonomy: Degree of personal initiative and ownership language ("I decided", "I drove", "I took responsibility").
   competence: Degree of specific skill execution language ("I built", "I designed", "I resolved").
   relatedness: Degree of collaborative impact language ("the team achieved", "I enabled", "stakeholders responded").
   These are internal coaching signals — never expose the labels or scores to the candidate.

4. PRESENTATION AUTHENTICITY SIGNAL (0-100)
   front_stage: Degree of polished, professional self-presentation — carefully curated, ideal-self language.
   back_stage: Degree of authentic, genuine experience — personal, unguarded, specific to them.
   Balance matters: high front_stage with low back_stage = over-prepared or insincere impression.
   Internal signal only — never describe as "Goffman" or "impression management" to the candidate.

5. RESPONSE QUALITY SIGNALS
   domain_language: 'strong' | 'moderate' | 'weak' — use of specific, accurate professional vocabulary.
   adaptive_reasoning: 'strong' | 'moderate' | 'weak' — logical flow and problem-solving quality.
   evidence_specificity: 'strong' | 'moderate' | 'weak' — use of concrete data, metrics, or named outcomes.
   lowest_signal: 'domain_language' | 'adaptive_reasoning' | 'evidence_specificity'
   Map to output fields: gc → domain_language, gf → adaptive_reasoning, gq → evidence_specificity.

6. AUTHENTICITY OBSERVATIONS
   pj_observations: Max 2 plain English observations. Must reference specific candidate quotes.
   Describe what you observed directly — no theoretical language.
   Examples: 'You stayed very close to your CV language here — the real story is often richer.'
             "'I want to make an impact' — what kind specifically, and why does that matter to you personally?"

7. SCAFFOLD & NOVELTY
   scaffold_dependency_signal: 'relied_heavily' | 'used_moderately' | 'independent'
   novel_claim_introduced: true if new language/claims appeared.

8. DECISION
   proceed: true if they should move on, false if they need more probing.

9. COACHING RECOMMENDATION (Real-time Support)
   coaching_guidance: A structured object containing:
     - framework_gap: Name the STAR component or evidence type that needs work (e.g., "Missing Result", "Weak ownership language").
     - instruction: Detailed, actionable instruction on how to rephrase or expand.
     - example_phrase: A "Try saying..." template tailored to the candidate's specific words.
     - priority: 'high' | 'medium' | 'low'.
   coaching_tip: A single-sentence summary of the instruction.
   CRITICAL: ALWAYS use layman's terms. Never mention psychological theories, scores, or framework names.

10. COMPETENCY DEMONSTRATION LEVEL
    Assign ONE level based on the full evidence in this response:
    'Emerging': Situation/Task referenced but Action/Result missing or too vague to assess.
    'Developing': STAR partially complete; some behavioural evidence but outcome unclear or unspecified.
    'Established': Full STAR with clear behavioural evidence and a describable/measurable result.
    'Advanced': Unprompted multi-layered evidence, cross-contextual application, spontaneous reflection.
    competency_demonstration_descriptor: 2 sentences max. What specifically did they demonstrate?
    Use their own words where possible. Behavioural language only — no labels, no scores.

11. AMO READINESS SIGNAL
    Assess the three conditions required for performance (Ability × Motivation × Opportunity):
    ability: 'high' | 'moderate' | 'low' — does evidence show the candidate has the skill?
    motivation: 'high' | 'moderate' | 'low' — does language show genuine interest in this role/context?
    opportunity: 'high' | 'moderate' | 'low' — did the response flow easily, or did hesitation/clarification suggest conditions blocked performance?
    amo_note: 1 sentence. If any dimension is 'low', name why — this contextualises weak performance without blaming the candidate.
    Internal coaching signal only — never expose AMO labels to the candidate.
   Return JSON only — no preamble, no markdown. `
        }]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          probe_successful: { type: Type.BOOLEAN },
          depth_delta: { type: Type.STRING, enum: ['increased', 'same', 'decreased'] },
          evidence_added: { type: Type.STRING },
          star_status: {
            type: Type.OBJECT,
            properties: {
              situation: { type: Type.STRING, enum: ['complete', 'partial', 'missing', 'not_yet_required'] },
              task: { type: Type.STRING, enum: ['complete', 'partial', 'missing', 'not_yet_required'] },
              action: { type: Type.STRING, enum: ['complete', 'partial', 'missing', 'not_yet_required'] },
              result: { type: Type.STRING, enum: ['complete', 'partial', 'missing', 'not_yet_required'] }
            },
            required: ["situation", "task", "action", "result"]
          },
          weakest_star_component: { type: Type.STRING, nullable: true },
          contextual_anchor: { type: Type.STRING },
          suggested_next_probe_type: { type: Type.STRING, nullable: true },
          sdt_signals: {
            type: Type.OBJECT,
            properties: {
              autonomy_language: { type: Type.STRING, enum: ['present', 'absent'] },
              competence_language: { type: Type.STRING, enum: ['present', 'absent'] },
              relatedness_language: { type: Type.STRING, enum: ['present', 'absent'] }
            },
            required: ["autonomy_language", "competence_language", "relatedness_language"]
          },
          scaffold_dependency_signal: { type: Type.STRING, enum: ['relied_heavily', 'used_moderately', 'independent'] },
          interpretation: { type: Type.STRING },
          pj_observations: { type: Type.ARRAY, items: { type: Type.STRING } },
          novel_claim_introduced: { type: Type.BOOLEAN },
          proceed: { type: Type.BOOLEAN },
          reason: { type: Type.STRING },
          coaching_tip: { type: Type.STRING },
          coaching_guidance: {
            type: Type.OBJECT,
            properties: {
              framework_gap: { type: Type.STRING },
              instruction: { type: Type.STRING },
              example_phrase: { type: Type.STRING },
              priority: { type: Type.STRING, enum: ['high', 'medium', 'low'] }
            },
            required: ["framework_gap", "instruction", "example_phrase", "priority"]
          },
          merit_vectors: {
            type: Type.OBJECT,
            properties: {
              autonomy: { type: Type.INTEGER },
              competence: { type: Type.INTEGER },
              relatedness: { type: Type.INTEGER },
              lowest_vector: { type: Type.STRING, enum: ['autonomy', 'competence', 'relatedness'] }
            },
            required: ["autonomy", "competence", "relatedness", "lowest_vector"]
          },
          goffman_scores: {
            type: Type.OBJECT,
            properties: {
              front_stage: { type: Type.INTEGER },
              back_stage: { type: Type.INTEGER }
            },
            required: ["front_stage", "back_stage"]
          },
          chc_signals: {
            type: Type.OBJECT,
            properties: {
              gc: { type: Type.STRING, enum: ['strong', 'moderate', 'weak'] },
              gf: { type: Type.STRING, enum: ['strong', 'moderate', 'weak'] },
              gq: { type: Type.STRING, enum: ['strong', 'moderate', 'weak'] },
              lowest_signal: { type: Type.STRING, enum: ['gc', 'gf', 'gq'] }
            },
            required: ["gc", "gf", "gq", "lowest_signal"]
          },

          algorithmic_aversion: {
            type: Type.OBJECT,
            properties: {
              detected: { type: Type.BOOLEAN },
              evidence: { type: Type.STRING, nullable: true }
            },
            required: ["detected", "evidence"]
          },

          // DMGT-AMO-ZPD-DCT Framework signals
          competency_demonstration_level: {
            type: Type.STRING,
            enum: ['Emerging', 'Developing', 'Established', 'Advanced']
          },
          competency_demonstration_descriptor: { type: Type.STRING },
          amo_readiness: {
            type: Type.OBJECT,
            properties: {
              ability:     { type: Type.STRING, enum: ['high', 'moderate', 'low'] },
              motivation:  { type: Type.STRING, enum: ['high', 'moderate', 'low'] },
              opportunity: { type: Type.STRING, enum: ['high', 'moderate', 'low'] },
              amo_note:    { type: Type.STRING }
            },
            required: ["ability", "motivation", "opportunity", "amo_note"]
          }
        },
        required: [
          "probe_successful", "depth_delta", "evidence_added", "star_status", "weakest_star_component",
          "contextual_anchor", "suggested_next_probe_type", "sdt_signals", "scaffold_dependency_signal",
          "interpretation", "pj_observations", "novel_claim_introduced", "proceed", "reason", "coaching_tip",
          "merit_vectors", "goffman_scores", "chc_signals", "algorithmic_aversion",
          "competency_demonstration_level", "competency_demonstration_descriptor", "amo_readiness"
        ]
      }
    }
  });

  return JSON.parse(aiResponse.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
};

export interface GenerateQuestionSummaryParams {
  accumulator: QuestionDataAccumulator;
  targetRole: string;
  companyName: string;
  cvSummary?: string;
  jobDescription?: string;
}

export const generateQuestionSummary = async (params: GenerateQuestionSummaryParams): Promise<QuestionSummaryReport> => {
  const ai = getAI();
  const model = "gemini-3-flash-preview";

  const { timerFramingCondition, responseDurations } = params.accumulator;
  const avgProbeDuration = responseDurations.probes.length > 0
    ? responseDurations.probes.reduce((a, b) => a + b, 0) / responseDurations.probes.length
    : 0;

  let timerNote = "";
  if (timerFramingCondition === 'elapsed') {
    if (responseDurations.actOne > 140) {
      timerNote = "Note: Your Act One response was significantly long. While 'Time Elapsed' provides awareness, switching to 'Time Used' might help you budget your response more effectively.";
    } else if (responseDurations.actOne < 60) {
      timerNote = "Note: Your response was concise. 'Time Elapsed' kept the pressure off, but 'Response Duration' could help you aim for a more detailed sweet spot.";
    } else {
      timerNote = "Note: Your response length was consistent with 'Time Elapsed' framing.";
    }
  } else if (timerFramingCondition === 'duration') {
    if (responseDurations.actOne >= 80 && responseDurations.actOne <= 110) {
      timerNote = "Note: You hit the 'Response Duration' sweet spot perfectly. Great use of the target!";
    } else if (responseDurations.actOne > 110) {
      timerNote = "Note: You exceeded the suggested duration. 'Time Used' might help you prioritize your content better next time.";
    } else {
      timerNote = "Note: You finished well under the target duration. Consider if 'Time Elapsed' might help you feel less rushed.";
    }
  } else if (timerFramingCondition === 'used') {
    if (avgProbeDuration < responseDurations.actOne * 0.3) {
      timerNote = "Note: You budgeted well, keeping probes concise relative to your main answer. 'Time Used' is working for you.";
    } else {
      timerNote = "Note: Your probe responses took up a large portion of your 'budget'. Try to front-load more evidence in Act One.";
    }
  }

  try {
    const aiResponse = await ai.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [{
            text: `You are AscendX, an expert AI interview coach.
Generate a structured coaching report following the Five-Component Feedback Sequence.
Use plain English throughout. Never name psychological theories, scores, or framework labels.

CONTEXT:
Target Role: ${params.targetRole}
Company: ${params.companyName}
Question: ${params.accumulator.questionId}
Transcript: ${params.accumulator.transcript}
Timer Framing: ${timerFramingCondition}
Act One Duration: ${responseDurations.actOne}s
Probe Durations: ${responseDurations.probes.join(', ')}s
${params.cvSummary ? `Candidate CV Summary: ${params.cvSummary.slice(0, 1500)}` : ''}
${params.jobDescription ? `Job Description: ${params.jobDescription.slice(0, 1000)}` : ''}

DATA SIGNALS (Phase Analyses):
${JSON.stringify(params.accumulator.phaseAnalyses, null, 2)}

DATA SIGNALS (Probe Analyses):
${JSON.stringify(params.accumulator.probeAnalyses, null, 2)}

═══════════════════════════════════════════════════════════════════
FIVE-COMPONENT FEEDBACK SEQUENCE — COMPLETE ALL FIVE
═══════════════════════════════════════════════════════════════════

COMPONENT 1 — SELF-ASSESSMENT PROMPT
Write a single reflective question the candidate should ask themselves BEFORE reading the coaching.
Activate self-awareness about THIS specific response — not a generic question.
Start with "Before you read the coaching below," — 1-2 sentences total.
Output field: selfAssessmentPrompt

COMPONENT 2 — CALIBRATION
2-3 sentences that validate where the candidate likely assessed themselves accurately,
and gently reframe where they may have over or underestimated.
Maintain positive efficacy without inflating it. Reference specific evidence from the transcript.
TONE: Honest, warm, forward-looking. No scoring language.
Output field: calibrationNote

COMPONENT 3 — COMPETENCY DEMONSTRATION
3a. Assign ONE level based on all evidence:
  'Emerging': Situation/Task referenced but Action/Result missing or too vague.
  'Developing': STAR partially complete; some behavioural evidence but outcome unclear.
  'Established': Full STAR with clear behavioural evidence and a describable result.
  'Advanced': Multi-layered STAR, unprompted reflection, cross-contextual application.
Output field: competencyDemonstrationLevel

3b. Write 2-3 sentences describing what they demonstrated, using THEIR OWN words/phrases.
Behavioural language only — cite specific evidence, then name what it shows.
Output field: competencyDemonstrationDescriptor

Also produce:
answerOverview: 2-3 sentence arc of STAR coverage overall (for the report header).
strengths: 2-4 specific strengths with evidence references from the transcript.

COMPONENT 4 — PROCESS COACHING (STAR gap targeting)
Identify the primary STAR gap and up to 2 supporting gaps. For each:
  gap: Name the STAR component or evidence type that was weakest.
  whyItMatters: 1 sentence — why this gap costs the candidate in a real interview.
  instruction: Specific, actionable — what to do differently. Include "Try saying..." where useful.
Output field: developmentPoints (array of up to 3)

Also produce:
probeEngagement: How the candidate engaged with follow-up probes — what they added and how.
${timerNote ? `CRITICAL: probeEngagement MUST start with this exact sentence: "${timerNote}"` : ''}
probeCorrelation: How the probe addressed a specific gap in the initial STAR response.
integratedCoaching: 2-sentence instruction on making the combined Act+Probe response work in one delivery.
practiceTask: Single prioritised instruction for next time — the highest-leverage change.

COMPONENT 5 — FORWARD ORIENTATION
2-3 sentences that:
- Name the competency behaviour being developed (not the label, the behaviour)
- Frame it as a learnable trajectory (DMGT development framing — natural ability → skill through practice)
- End with ONE specific action for next time
TONE: Motivating, concrete, future-facing. NOT a deficit summary.
Output field: forwardOrientation

${params.cvSummary ? `CV ALIGNMENT NOTE (include only if CV was provided)
Cross-reference the candidate's full answer against their CV background and the job description.
- Did they use their strongest relevant experience, or did they reach for a weaker example?
- Did they undersell or overclaim relative to what their CV actually shows?
- Is there a specific role, project, or skill in their CV that would have been stronger evidence here?
- Does their answer language match what the JD is asking for?
Write 2-3 sentences. Reference specific CV details by name where possible. Be direct but constructive.
If their answer was well-aligned with their background, confirm that — it is useful feedback too.
Output field: cvAlignmentNote` : ''}

ELC STAGE LABELS (Kolb Experiential Learning Cycle — candidate-facing, plain English)
Map this question's session to all four Kolb stages. One sentence each. No jargon.
ce: What the candidate's main answer showed about their current level — their baseline for this question.
ro: What the probe question revealed that the main answer did not. If no probe was used, describe
    what the answer quality implies about their self-awareness.
ac: The one transferable principle this question produced — what they now understand that applies
    beyond this specific example and into any interview.
ae: The single action to TEST on the VERY NEXT question or in a real interview.
    Specific enough that they will know if they did it. Start with a verb.
Output field: elcStages (object with ce, ro, ac, ae string fields)

Return JSON only — no preamble, no markdown.`
          }]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            selfAssessmentPrompt: { type: Type.STRING },
            calibrationNote: { type: Type.STRING },
            competencyDemonstrationLevel: {
              type: Type.STRING,
              enum: ['Emerging', 'Developing', 'Established', 'Advanced']
            },
            competencyDemonstrationDescriptor: { type: Type.STRING },
            answerOverview: { type: Type.STRING },
            strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
            developmentPoints: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  gap: { type: Type.STRING },
                  whyItMatters: { type: Type.STRING },
                  instruction: { type: Type.STRING }
                },
                required: ["gap", "whyItMatters", "instruction"]
              }
            },
            probeEngagement: { type: Type.STRING },
            probeCorrelation: { type: Type.STRING },
            integratedCoaching: { type: Type.STRING },
            practiceTask: { type: Type.STRING },
            forwardOrientation: { type: Type.STRING },
            cvAlignmentNote: { type: Type.STRING, nullable: true },
            elcStages: {
              type: Type.OBJECT,
              properties: {
                ce: { type: Type.STRING },
                ro: { type: Type.STRING },
                ac: { type: Type.STRING },
                ae: { type: Type.STRING }
              },
              required: ["ce", "ro", "ac", "ae"]
            }
          },
          required: [
            "selfAssessmentPrompt", "calibrationNote",
            "competencyDemonstrationLevel", "competencyDemonstrationDescriptor",
            "answerOverview", "strengths", "developmentPoints",
            "probeEngagement", "probeCorrelation", "integratedCoaching",
            "practiceTask", "forwardOrientation", "elcStages"
          ]
        }
      }
    });

    const parsed = JSON.parse(aiResponse.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
    return {
      ...parsed,
      questionId: params.accumulator.questionId,
      questionText: params.accumulator.questionId,
      timestamp: Date.now(),
      selfAssessmentPrompt: parsed.selfAssessmentPrompt,
      calibrationNote: parsed.calibrationNote,
      competencyDemonstrationLevel: parsed.competencyDemonstrationLevel,
      competencyDemonstrationDescriptor: parsed.competencyDemonstrationDescriptor,
      forwardOrientation: parsed.forwardOrientation,
      cvAlignmentNote: parsed.cvAlignmentNote ?? null,
      breakContextGap: parsed.forwardOrientation ?? null,
      elcStages: parsed.elcStages ?? null,
    } as QuestionSummaryReport;
  } catch (err) {
    console.error("Failed to generate question summary:", err);
    return {
      questionId: params.accumulator.questionId,
      questionText: params.accumulator.questionId,
      answerOverview: "We couldn't generate a detailed analysis for this question.",
      strengths: ["Communication was attempted"],
      developmentPoints: [{
        gap: "Detailed feedback missing",
        whyItMatters: "Feedback is crucial for improvement",
        instruction: "Please review your session transcript."
      }],
      probeEngagement: timerNote || "N/A",
      probeCorrelation: "Correlation analysis is pending generation.",
      integratedCoaching: "Integrated guidance will appear here once analysis completes.",
      practiceTask: "Continue practicing your STAR technique.",
      timestamp: Date.now()
    } as QuestionSummaryReport;
  }
};
