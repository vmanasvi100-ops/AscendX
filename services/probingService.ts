
import { Type } from "@google/genai";
import { generateContent } from "./aiClient";
import { Probe, ProbeAnalysis, QuestionDataAccumulator, QuestionSummaryReport, MesoAccumulator } from "../types";

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

  const response = await generateContent({
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
THEORETICAL GROUNDING — WHY YOU PROBE AND HOW
═══════════════════════════════════════════════════════════════════

The probing pipeline is not interrogation. It is the REFLECTIVE OBSERVATION stage of
Kolb's Experiential Learning Cycle (1984). The candidate's initial answer is Concrete
Experience (CE). The probe activates Reflective Observation (RO) — a structured
re-examination of that experience from a new angle. Without a probe, the ELC cycle
cannot progress to Abstract Conceptualisation (AC) or Active Experimentation (AE).
A session without probing produces practice without learning.

KOLB ELC — HOW THE PROBE FITS:
  CE (Concrete Experience):    The candidate's Act 1 answer — what they said unprompted.
  RO (Reflective Observation): THIS PROBE — designed to make the candidate look at their
                                experience differently. The probe angle should shift perspective,
                                not simply ask for more of the same.
  AC (Abstract Conceptualisation): What the candidate constructs from CE+RO together —
                                   the per-question feedback and ELC trace will draw this out.
  AE (Active Experimentation): The forwardOrientation field — what they will test next time.

ZPD — ZONE OF PROXIMAL DEVELOPMENT (Vygotsky, 1978; Wood, Bruner & Ross, 1976):
  The probe should target the GAP between the candidate's lower boundary (what they showed
  unprompted) and their upper boundary (what they are capable of WITH structured support).
  TOO EASY:  Probe asks for something they already demonstrated → no development value.
  TOO HARD:  Probe demands reasoning beyond current upper boundary → produces anxiety, not insight.
  CORRECT:   Probe targets the specific missing element that is just within reach with structure.
  The zpd_note field in your output must name this gap explicitly for the coaching record.

DELIBERATE PRACTICE (Ericsson, Krampe & Tesch-Römer, 1993):
  Probes must be specific and targeted, not general. "Tell me more" is not a probe —
  it is an invitation to repeat the same answer. Every probe must target a NAMED gap
  (a missing STAR component, a vague claim, an unevidenced strength) and be precise
  enough that a successful response would close that specific gap.

PROFESSIONAL SELF-VERIFICATION (Cable & Kay, 2012):
  The rationale field (required on every probe) should help the candidate understand
  why this specific probe is being asked — NOT to expose frameworks, but because candidates
  who understand the purpose of a question engage more authentically. The rationale is
  Cable & Kay's self-verification mechanism operationalised: it invites genuine experience
  rather than rehearsed performance.

FEEDBACK LITERACY (Winstone, 2017):
  The probe IS formative feedback in question form. For avoidant candidates, the rationale
  must open with safety framing before the development point. For proactive candidates,
  the rationale can be brief — they will engage regardless. Match rationale length to
  feedbackOrientation from the adaptive profile.

AMO (Appelbaum et al., 2000) — OPPORTUNITY CHECK:
  Before generating a STRATEGIC or DEEPENING probe, check the candidate's anxiety level
  and session phase. If anxiety is high AND phase is early, a challenging probe may create
  an opportunity failure — the candidate cannot demonstrate their upper boundary because the
  environment blocked it. Prefer CONCRETE or CLARIFYING probes under these conditions.

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
 SCAFFOLD MODULATION — Wood, Bruner & Ross (1976); Vygotsky (1978); CLT Kalyuga (2007)
 ═══════════════════════════════════════════════════════════════════

Scaffolding principle (Wood, Bruner & Ross, 1976): match support level to the candidate's
current independent performance — the ZPD lower boundary. Gradually withdraw support as
competence increases. This is not a preference — it is the mechanism by which the ZPD closes.

Cognitive Load Theory (Sweller, 1988; Kalyuga, 2007 Expertise Reversal Effect):
  Too much scaffold for a capable candidate INCREASES extraneous load — it interferes with
  their existing schemas. When mesoScaffoldReduced = true (cross-session scaffold dependency
  reduced), phase thresholds advance by 1 — this is the Expertise Reversal Effect operationalised.
  Scaffolding that helped earlier now actively hinders. Reduce it.

PHASE 1 — Introductory Alignment (session_phase_index 0–${p1End}, difficulty: EASY)
  ZPD position: Candidate at lower boundary baseline — maximum scaffold provided.
  CLT: Extraneous load reduction is the priority here. Remove all unnecessary cognitive pressure.
  → Use supportive, structured language with no ambiguity
  → Offer structural hints if answer was incomplete:
      'You described the situation well — what was your specific role in the action?'
  → If answer was strong, acknowledge briefly before deepening (ZPD: do not push beyond upper boundary)
  → NEVER increase cognitive pressure at this stage — anxiety is an opportunity failure (AMO)
  → Rationale MUST be detailed and warm — Winstone (2017): avoidant candidates need safety before direction
  → Kolb RO: probe should shift angle slightly, not ask for elaboration on the same point

PHASE 2 — Core Competency (session_phase_index ${p2Start}–${p2End}, difficulty: MEDIUM)
  ZPD position: Lower boundary rising — moderate scaffold, building independence.
  CLT: Germane load is the priority — redirect cognitive effort toward evidence construction.
  → Reference candidate's language as always (contextual continuity activates self-verification)
  → Probe the gap between claim and evidence directly (ZPD: target the specific unlockable gap)
  → Introduce mild abstraction: 'What would you do differently now?' (Kolb RO→AC bridge)
  → Structural hints are reduced — candidate should be internalising structure independently
  → Rationale present but briefer — candidate has demonstrated they can engage without reassurance
  → If mesoScaffoldReduced = true: treat this phase as Phase 3 difficulty

PHASE 3 — Strategic High-Stakes (session_phase_index ${p3Start}+, difficulty: HARD)
  ZPD position: Lower boundary near upper — minimal scaffold, independent performance.
  CLT: Expertise Reversal — structural support now interferes. Remove it entirely.
  Kolb RO: probe must force a perspective shift, not a deepening of what they already said.
  → Ask for systemic thinking: 'How would you scale this approach organisation-wide?' (AC stage signal)
  → Challenge assumptions: 'What would a critic of that approach say?' (Kolb RO at highest level)
  → Demand abstract reasoning: 'What does this experience reveal about how you lead?' (AC→AE bridge)
  → No structural hints — candidate has been scaffolded to this point and must now demonstrate independently
  → Rationale is brief — candidate should expect challenge now (deliberate practice: push the boundary)
  → zpd_note MUST record what the probe was designed to unlock and whether it succeeded

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
  const model = "gemini-3-flash-preview";

  const aiResponse = await generateContent({
    model,
    contents: [
      {
        role: 'user', // System instruction as a user turn for contents[0]
        parts: [{
          text: `You are AscendX, an expert occupational psychology researcher.
Analyse the candidate's response. This could be a STAR phase completion (silent) or a response to a probe.
Return JSON only — no preamble, no markdown.

═══════════════════════════════════════════════════════════════════
THEORETICAL GROUNDING — APPLY THESE FRAMEWORKS TO YOUR ANALYSIS
═══════════════════════════════════════════════════════════════════

KOLB ELC (1984): This response is data for the Reflective Observation stage.
  Your job is to assess whether the candidate's answer, combined with this probe, produces
  usable evidence for the Abstract Conceptualisation stage in the question summary.
  depth_delta measures whether RO deepened the CE data — 'same' means the RO failed.

ZPD (Vygotsky 1978; Wood et al. 1976): scaffold_dependency_signal measures whether the
  candidate needed scaffold to reach this performance level. 'relied_heavily' = large ZPD gap,
  'independent' = lower boundary has risen to meet the upper boundary — the development goal.

BEHAVIORAL EVIDENCE VECTORS (Levashina & Campion 2007; Ericsson 2016):
  merit_vectors.autonomy:    personal agency / ownership language — "I decided", "I chose"
  merit_vectors.competence:  specific skill execution — named tools, measurable outcomes
  merit_vectors.relatedness: impact on others — named people, team/stakeholder effects
  These are the three evidence quality dimensions that predict criterion validity in structured
  interviews. lowest_vector drives the next probe type and the question summary coaching.

PRESENTATION AUTHENTICITY (Cable & Kay 2012 — authentic self-verification):
  goffman_scores.front_stage: polished, professionally curated language — staying close to CV
  goffman_scores.back_stage:  personal, genuine, unguarded — going beyond what was prepared
  This is NOT a deception detection score. High back_stage = candidate is self-verifying
  (presenting genuine experience). High front_stage / low back_stage = impression managing
  (performing rather than revealing). Goal: help authentic capability become legible.
  NEVER expose these terms or scores to the candidate.

COMPETENCY LEVELS (Campion et al. 1994 structured interview research):
  Emerging:   Situation/Task only — no Action/Result evidence present
  Developing: STAR partially present — Action or Result incomplete/unclear
  Established: Full STAR with clear behavioural evidence and a describable result
  Advanced:   Multi-layered, unprompted reflection, cross-contextual application
  NEVER use these labels in candidate-facing text — behavioural description only.

AMO FRAMEWORK (Appelbaum et al. 2000):
  Before attributing weak performance to low ability, check all three conditions:
  Ability:      Does transcript evidence show the candidate has the relevant skill at all?
  Motivation:   Does their language show genuine engagement with this role and context?
  Opportunity:  Did the format, question difficulty, or probe pressure create a barrier?
  AMO contextualises performance — it never criticises the candidate for conditions outside their control.

CLT SIGNALS (Sweller 1988; Kalyuga 2007):
  sdt_signals tracks whether ownership/competence/impact language was PRESENT in this response.
  These are behavioral evidence signals, not SDT motivational scores.
  They feed into the next probe selection: absent language = target for the next probe.

═══════════════════════════════════════════════════════════════════
ANALYSIS TASKS — RETURN THE FULL SIGNAL SET EVERY TIME
═══════════════════════════════════════════════════════════════════

CANDIDATE CONTEXT:
Target Role: ${params.targetRole} at ${params.companyName}
Question: ${params.question}
${params.probe ? `Probe Asked: ${params.probe}\nProbe Type: ${params.probeType}\nProbe Rationale: ${params.probeRationale}` : 'Silent STAR Phase Analysis (No Probe)'}
Candidate's Response: ${params.response}

1. PROBE EFFECTIVENESS [Kolb RO — did the probe deepen the CE data?]
   probe_successful: true if the candidate provided meaningful NEW content (not just elaboration of same point).
   depth_delta: 'increased' | 'same' | 'decreased' — did RO produce richer evidence than CE alone?
   evidence_added: one sentence describing what SPECIFICALLY is new — quote the candidate's language.

2. STAR PROGRESSION [Campion et al. 1994 — structured interview STAR framework]
   Assess what parts of the STAR framework the candidate has covered so far.
   star_status: { situation, task, action, result } (complete | partial | missing | not_yet_required)
   A Result is not 'not_yet_required' after Phase 1. By Phase 2, all four components should be present.

3. OWNERSHIP LANGUAGE DENSITY [Behavioral Evidence Vectors — Levashina & Campion 2007; Ericsson 2016]
   Score the density of behavioral evidence language in this response only (0–100 each).
   autonomy:   "I decided / I drove / I took responsibility" — personal agency and initiative
   competence: "I built / I designed / I resolved" — specific skill execution with named outputs
   relatedness:"the team achieved / I enabled / stakeholders responded" — impact on others
   These are internal coaching signals — never expose the labels or scores to the candidate.
   lowest_vector drives which probe type to use next and which coaching dimension to prioritise.

4. PRESENTATION AUTHENTICITY SIGNAL [Cable & Kay 2012 — authentic self-verification, NOT deception detection]
   front_stage: Degree of polished, professionally curated self-presentation (0–100).
   back_stage:  Degree of authentic, personal, unguarded experience beyond what was prepared (0–100).
   Interpretation: high front_stage + low back_stage = impression-managing; high back_stage = self-verifying.
   Internal signal only — never describe as "Goffman" or "impression management" to the candidate.
   This feeds professionalSelfVerificationSignals in the final session feedback.

5. RESPONSE QUALITY SIGNALS [Kolb ELC stage completion signals — AC/AE/CE quality indicators]
   domain_language:    'strong' | 'moderate' | 'weak' — maps to Kolb AC (domain knowledge applied)
   adaptive_reasoning: 'strong' | 'moderate' | 'weak' — maps to Kolb AE (adaptive reasoning under probing)
   evidence_specificity:'strong' | 'moderate' | 'weak' — maps to Kolb CE (measurable, specific outcomes)
   lowest_signal: the weakest of the three — feeds the KOLB ELC STAGE COACHING in the question summary.
   Schema fields gc/gf/gq: gc → domain_language (AC), gf → adaptive_reasoning (AE), gq → evidence_specificity (CE).

6. AUTHENTICITY OBSERVATIONS [Cable & Kay 2012 + Winstone 2017 feedback literacy]
   pj_observations: Max 2 plain English coaching observations. Must quote the candidate's exact language.
   Purpose: these feed the per-question coaching delivered immediately after this response.
   No theoretical language. Describe what you observed directly.
   Examples: 'You stayed very close to your CV language here — the real story is often richer.'
             "'I want to make an impact' — what kind specifically, and why does that matter to you personally?"

7. SCAFFOLD & NOVELTY [ZPD — Vygotsky 1978; Deliberate Practice — Ericsson 1993]
   scaffold_dependency_signal: 'relied_heavily' | 'used_moderately' | 'independent'
     relied_heavily = candidate needed explicit structural hints to produce this content (ZPD gap is large)
     independent    = candidate produced equivalent content unprompted (lower boundary has risen)
   novel_claim_introduced: true if the response contained a claim, example, or language NOT present before.
     Novel claims indicate Kolb AE is functioning — the candidate is generating new approaches.

8. DECISION [ZPD — probe only if gap remains]
   proceed: true if they should move on, false if the ZPD gap has not yet closed enough to justify moving on.
   Proceed = true when: STAR is at least Established, depth_delta was 'increased', and ZPD gap is small.

9. COACHING RECOMMENDATION [Deliberate Practice (Ericsson 1993) + Nicol & Macfarlane-Dick Principle 6]
   coaching_guidance:
     framework_gap:  Name the EXACT STAR component or evidence type missing (e.g., "Missing Result", "No ownership language in Action section").
     instruction:    Specific, bounded instruction — what exactly to say differently. Reference their words.
     example_phrase: "Try saying..." — built from their actual language, not a template.
     priority:       'high' | 'medium' | 'low' — high only if this gap would cost them the role.
   coaching_tip: One sentence. The single most important change right now.
   CRITICAL: Plain English only. Never mention theories, framework names, or scores to the candidate.

10. COMPETENCY DEMONSTRATION LEVEL [Campion et al. 1994; Levashina & Campion 2007]
    ONE level only — based on cumulative evidence in this response:
    'Emerging':   Situation/Task referenced but Action/Result missing or too vague to assess.
    'Developing': STAR partially complete; some behavioural evidence but outcome unclear or unspecified.
    'Established': Full STAR with clear behavioural evidence and a describable/measurable result.
    'Advanced':   Unprompted multi-layered evidence, cross-contextual application, spontaneous reflection.
    competency_demonstration_descriptor: 2 sentences max. Quote specific candidate language.
    Behavioural description only — no level labels, no scores visible in this field.

11. AMO READINESS SIGNAL [Appelbaum et al. 2000 — contextualise performance before attributing gaps]
    ability:     'high' | 'moderate' | 'low' — transcript evidence of the specific skill required
    motivation:  'high' | 'moderate' | 'low' — genuine role engagement vs. performative language
    opportunity: 'high' | 'moderate' | 'low' — did hesitation, clarification, or probe pressure suggest
                 the environment blocked performance rather than the candidate lacking ability?
    amo_note:    1 sentence. If any dimension is 'low', name the specific cause without criticising.
    Internal coaching signal only — never expose AMO labels to the candidate.
   Return JSON only — no preamble, no markdown.`
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
          behavioural_evidence_signals: {
            type: Type.OBJECT,
            properties: {
              ownership_language: { type: Type.STRING, enum: ['present', 'absent'] },
              skill_language: { type: Type.STRING, enum: ['present', 'absent'] },
              impact_language: { type: Type.STRING, enum: ['present', 'absent'] }
            },
            required: ["ownership_language", "skill_language", "impact_language"]
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
          presentation_authenticity: {
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
          "contextual_anchor", "suggested_next_probe_type", "behavioural_evidence_signals", "scaffold_dependency_signal",
          "interpretation", "pj_observations", "novel_claim_introduced", "proceed", "reason", "coaching_tip",
          "merit_vectors", "presentation_authenticity", "chc_signals", "algorithmic_aversion",
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
    const aiResponse = await generateContent({
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

AMO PERFORMANCE CONTEXT (Appelbaum et al., 2000 — candidate-facing, plain English)
Review the amo_readiness signals in the DATA SIGNALS (Probe Analyses) above.
IF any dimension (ability, motivation, opportunity) is 'low':
  Generate a single sentence for the amoContextNote field — plain English, no framework labels.
  Purpose: contextualise why performance may have been affected by conditions, not only capability.
  Frame it as information, not excuse. Never expose the labels 'AMO', 'ability', 'motivation', 'opportunity'.
  Example when opportunity is low: "Follow-up questions in this session were more demanding than usual —
    performance under pressure like this often looks different from your baseline capability."
  Example when motivation is low: "Your answers were strongest when describing experiences you clearly
    cared about — connecting the role more directly to what motivates you will unlock more of that energy."
  Example when ability is low: "The evidence in this answer was still developing — that is exactly what
    repeated practice is designed to build."
IF all dimensions are 'high': return amoContextNote as null.
Output field: amoContextNote (string | null)

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
            amoContextNote: { type: Type.STRING, nullable: true },
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
      amoContextNote: parsed.amoContextNote ?? null,
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
