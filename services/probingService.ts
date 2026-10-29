
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

  // Different approach per question type — reuses the same four frameworks
  // questionService.ts already generates each question's coaching prompts around
  // (STAR / Who-Journey-Edge-Direction / Context-Role-Actions-Outcome /
  // Principle-Application-Trade-offs-Evidence), rather than treating every question the
  // same way a STAR behavioural question would be probed.
  const TYPE_GUIDANCE: Record<string, string> = {
    behavioural: `STAR question (Situation/Task/Action/Result). Target whichever component is weakest or missing — usually personal ownership in Action, or a measurable Result.`,
    situational: `Situational question (Context/Your Role/Actions/Outcome). Target the gap between what the GROUP did and what THEY personally did, or push past a hypothetical toward a concrete outcome.`,
    motivational: `Motivational/introduction question (Who you are/Your journey/Your edge/Your direction). Target vague enthusiasm — push for one concrete reason specific to this exact role or company, not something that could apply anywhere.`,
    'knowledge-probe': `Knowledge/domain question (Principle/Application/Trade-offs/Evidence). Target whichever is missing: a stated trade-off or limitation, or real applied evidence rather than textbook recitation.`,
  };
  const typeGuidance = TYPE_GUIDANCE[params.currentQuestion.type] ?? TYPE_GUIDANCE.behavioural;

  // Trimmed from a much longer version (the full theoretical exposition — Kolb/ZPD/CLT/AMO
  // prose explaining WHY each rule exists — added input tokens on every single call without
  // changing model behaviour; see FRAMEWORK.md for where that rationale is now documented
  // instead). This keeps every operative rule, drops the explanatory padding, and adds the
  // question-type targeting above. Shorter prompt = less prefill time = lower latency per probe.
  const response = await generateContent({
    model,
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `You are AscendX, an expert AI interview coach. Generate ONE high-quality adaptive follow-up probe based on what the candidate just said.

WHY PROBES EXIST: this re-examines the candidate's initial answer from a new angle so they can reason about and improve it — not interrogation, not "tell me more." Target the gap between what they showed unprompted and what they can do with structure: not something they already demonstrated (no development value), not beyond their reach (produces anxiety, not insight).

QUESTION-TYPE TARGETING: ${typeGuidance}

CORE RULES — NEVER VIOLATE:
1. CONTEXTUAL CONTINUITY: reference the candidate's specific words (e.g. they said 'anchor for the team' → probe 'anchor'). Never a generic question that could apply to anyone.
2. ONE probe per turn, max 35 words. Never two questions.
3. Pick ONE probe type:
   CLARIFYING — follow up a CV claim or professional term.
   CONCRETE — bridge an abstract claim to specific evidence.
   DEEPENING — extend a strong answer to reveal more depth.
   REDIRECTING — bring the candidate back if they've drifted; never engage off-topic content.
   STRATEGIC — challenge assumptions, test systemic thinking. Avoid this (prefer CONCRETE/CLARIFYING) if anxiety is high and the session phase is still early.
4. rationale (max 2 sentences, plain English, never 'Gc'/'Gf'/'SDT'/'ZPD'/'back-stage') explains why this probe is being asked, so the candidate engages with real experience rather than performing.
5. Build on the FULL conversation, not just the last answer — the session should deepen, not restart.
6. Never say 'challenge' as a synonym for problem, never open with 'Can you tell me more about...', never name a psychological framework to the candidate.
7. If there's not enough context for a meaningful probe, return probe_type: 'INSUFFICIENT_CONTEXT' and say what's missing.

SCAFFOLD BY SESSION PHASE (match support to current independent performance; withdraw it as competence rises — if mesoScaffoldReduced, treat this phase one level harder):
PHASE 1 (index 0–${p1End}, EASY): max support. Offer a structural hint if the answer was incomplete. Never increase pressure — anxiety here is a missed opportunity, not a test. Rationale warm and detailed.
PHASE 2 (index ${p2Start}–${p2End}, MEDIUM): moderate support. Probe the gap between claim and evidence directly. Fewer structural hints. Rationale present but briefer.
PHASE 3 (index ${p3Start}+, HARD): minimal support. Force a perspective shift, not more of the same — systemic thinking or challenge assumptions. No structural hints. Rationale brief. Record in zpd_note what the probe targeted and whether it worked.`
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
  competency?: string;
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
  behavioral_evidence_vectors.personal_agency:     ownership language — "I decided", "I chose"
  behavioral_evidence_vectors.skill_specificity:   specific skill execution — named tools, measurable outcomes
  behavioral_evidence_vectors.impact_articulation: impact on others — named people, team/stakeholder effects
  These are language-pattern counts, not SDT need-satisfaction scores (autonomy/competence/relatedness
  are felt psychological states requiring a validated instrument — a transcript count is not that).
  They are the three evidence quality dimensions that predict criterion validity in structured
  interviews. lowest_vector drives the next probe type and the question summary coaching.

LANGUAGE REGISTER (word-choice observation only — NOT a measure of honesty, authenticity, or
  self-concept; Goffman's front-stage/back-stage and Cable & Kay's self-verification are both
  stable-trait or felt-state constructs that a single transcript register cannot validly measure):
  presentation_register.rehearsed_language:   polished, professionally curated language — staying close to CV
  presentation_register.spontaneous_language: personal, unprompted elaboration — going beyond what was prepared
  This is NOT a deception detection score, and it is not a self-verification score. It is a plain
  observation of phrasing register, useful for coaching ("this answer reads rehearsed — try
  speaking more naturally") and nothing more.
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
  behavioural_evidence_signals tracks whether ownership/skill/impact language was PRESENT in this response.
  These are behavioral evidence signals, not SDT motivational scores.
  They feed into the next probe selection: absent language = target for the next probe.

═══════════════════════════════════════════════════════════════════
ANALYSIS TASKS — RETURN THE FULL SIGNAL SET EVERY TIME
═══════════════════════════════════════════════════════════════════

CANDIDATE CONTEXT:
Target Role: ${params.targetRole} at ${params.companyName}
Question: ${params.question}
${params.competency ? `Competency This Question Targets: ${params.competency}` : ''}
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

4. LANGUAGE REGISTER SIGNAL [word-choice observation, NOT deception detection or self-verification]
   rehearsed_language:   Degree of polished, professionally curated phrasing (0–100).
   spontaneous_language: Degree of personal, unprompted elaboration beyond what was prepared (0–100).
   Interpretation: high rehearsed_language + low spontaneous_language = reads as rehearsed/performed;
   high spontaneous_language = reads as natural/unprompted. This is phrasing register only — it says
   nothing about whether the candidate is honest, self-aware, or being truthful about their experience.
   Internal signal only — never describe as "Goffman", "authenticity", or "self-verification" to the candidate.
   This feeds presentationRegisterSignals in the final session feedback.

5. RESPONSE QUALITY SIGNALS [Kolb ELC stage completion signals — AC/AE/CE quality indicators]
   These are language-pattern observations, not a cognitive ability measurement — an interview
   transcript cannot measure intelligence, and nothing here should be reasoned about in those terms.
   domain_language:    'strong' | 'moderate' | 'weak' — maps to Kolb AC (domain knowledge applied)
   adaptive_reasoning: 'strong' | 'moderate' | 'weak' — maps to Kolb AE (adaptive reasoning under probing)
   evidence_specificity:'strong' | 'moderate' | 'weak' — maps to Kolb CE (measurable, specific outcomes)
   lowest_signal: the weakest of the three — feeds the KOLB ELC STAGE COACHING in the question summary.

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

11. PERFORMANCE CONTEXT SIGNAL [contextualise performance before attributing a gap to the candidate —
    these are observations of this single response, not a measurement of the candidate's actual
    ability, motivation, or opportunity as stable traits; Appelbaum et al. (2000)'s AMO model describes
    organizational-level performance drivers, not something an interview transcript can measure]
    skill_evidence_level:    'high' | 'moderate' | 'low' — transcript evidence of the specific skill required
    engagement_level:        'high' | 'moderate' | 'low' — specific, engaged language vs. generic/performative phrasing
    format_conditions_level: 'high' | 'moderate' | 'low' — did hesitation, clarification, or probe pressure suggest
                 the interview format created a barrier, rather than the candidate lacking the skill?
    context_note: 1 sentence. If any dimension is 'low', name the specific cause without criticising.
    Internal coaching signal only — never expose these labels to the candidate.

12. COMPETENCY VERIFICATION [does this response actually confirm the competency this question targets?]
    competency_tested: name the specific competency this question/probe is testing
      (use "${params.competency ?? 'infer from question content'}" as the target unless the response
      clearly evidences a different competency — in that case name what was actually evidenced).
    verified: true only if the response contains SUFFICIENT, SPECIFIC evidence to confirm the candidate
      possesses this competency — not just that they referenced it. Vague/generic claims = false.
    evidence_quote: the specific quoted/paraphrased evidence that justifies the verified value.
    confidence: 'low' | 'moderate' | 'high' — how confident this verification is given the evidence available.
    This is independent of competency_demonstration_level (which grades STAR completeness) — this field
    specifically asks "is the competency itself confirmed," which is the input a downstream verifier
    (human or automated) would need to trust the result.

13. STRENGTH DOMAIN SIGNAL [design reference: Tomlinson, M. (2017). Forms of graduate capital and
    their relationship to graduate employability. Education + Training, 59(4), 338–352 — used here only
    to choose which evidence domains are worth distinguishing, not as a claim that this response
    validly measures "capital" in Tomlinson's psychometric sense]
    Classify which domain(s) of strength this response's evidence most strongly demonstrates — this
    runs ALONGSIDE the existing competency/STAR/AMO/ZPD analysis, it does not replace or change any of it:
      technical_skill:        professional knowledge/skill evidence — technical competence, domain
                     expertise, the ability to execute the work itself. (Closest to raw competency evidence.)
      relationship_network:   evidence of networks, relationships, working through/with others —
                     mentorship, stakeholder management, collaboration that expanded what the candidate could access.
      professional_fit:       evidence of understanding organisational/sector norms and presenting
                     oneself credibly within them — language, professional norms, fit signals.
      resilience:    evidence of resilience, adaptability, confidence under pressure or ambiguity —
                     the response evidences withstanding challenge rather than just describing a skill.
      professional_narrative: evidence of a coherent professional narrative — how the candidate frames
                     who they are becoming professionally, not just what they did.
    primary_domain: the single strongest-evidenced domain in this response.
    secondary_domain: a second domain if clearly also evidenced, otherwise null — do not force one.
    evidence_basis: 1 sentence, quote the candidate's language that justifies the classification.
    Internal signal only — never expose this terminology or classifications to the candidate.
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
          // Renamed from 'merit_vectors'/autonomy·competence·relatedness — those are SDT need-satisfaction
          // constructs (felt psychological states, validated only via instruments like the BPNS scale),
          // not something countable from transcript language. These are the literal behavioral evidence
          // density counts the prompt already describes in plain language just above (ownership language,
          // skill execution, impact on others) — the schema just used to relabel them with SDT's names.
          behavioral_evidence_vectors: {
            type: Type.OBJECT,
            properties: {
              personal_agency: { type: Type.INTEGER },
              skill_specificity: { type: Type.INTEGER },
              impact_articulation: { type: Type.INTEGER },
              lowest_vector: { type: Type.STRING, enum: ['personal_agency', 'skill_specificity', 'impact_articulation'] }
            },
            required: ["personal_agency", "skill_specificity", "impact_articulation", "lowest_vector"]
          },
          // Renamed from 'presentation_authenticity'/front_stage·back_stage — those named the fields
          // after Goffman's dramaturgical theory and fed Cable & Kay's self-verification construct,
          // both stable psychological constructs a single response's phrasing register cannot validly
          // measure. This is a plain word-choice-register observation, not an authenticity or
          // self-verification score.
          presentation_register: {
            type: Type.OBJECT,
            properties: {
              rehearsed_language: { type: Type.INTEGER },
              spontaneous_language: { type: Type.INTEGER }
            },
            required: ["rehearsed_language", "spontaneous_language"]
          },
          // Renamed from 'chc_signals'/gc·gf·gq — those were Cattell-Horn-Carroll cognitive-ability
          // codes (crystallized/fluid/quantitative intelligence), and an interview transcript cannot
          // measure cognitive ability. These are the same Kolb ELC stage-completion language-pattern
          // observations the prompt already described honestly in task 5 — the schema just used to
          // contradict that by naming the fields after an ability taxonomy instead. See FRAMEWORK.md
          // "Construct Correction" for the full rationale.
          response_quality_signals: {
            type: Type.OBJECT,
            properties: {
              domain_language: { type: Type.STRING, enum: ['strong', 'moderate', 'weak'] },
              adaptive_reasoning: { type: Type.STRING, enum: ['strong', 'moderate', 'weak'] },
              evidence_specificity: { type: Type.STRING, enum: ['strong', 'moderate', 'weak'] },
              lowest_signal: { type: Type.STRING, enum: ['domain_language', 'adaptive_reasoning', 'evidence_specificity'] }
            },
            required: ["domain_language", "adaptive_reasoning", "evidence_specificity", "lowest_signal"]
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
          // Renamed from 'amo_readiness'/ability·motivation·opportunity — Appelbaum et al. (2000)'s AMO
          // model describes organizational-level performance drivers, not something inferable as a
          // trait from a single interview response. These are plain-language observations used only to
          // decide whether a weak response reflects missing skill evidence, low engagement, or format
          // pressure — not a measurement of ability, motivation, or opportunity themselves.
          performance_context_signal: {
            type: Type.OBJECT,
            properties: {
              skill_evidence_level:    { type: Type.STRING, enum: ['high', 'moderate', 'low'] },
              engagement_level:        { type: Type.STRING, enum: ['high', 'moderate', 'low'] },
              format_conditions_level: { type: Type.STRING, enum: ['high', 'moderate', 'low'] },
              context_note:            { type: Type.STRING }
            },
            required: ["skill_evidence_level", "engagement_level", "format_conditions_level", "context_note"]
          },
          competency_verification: {
            type: Type.OBJECT,
            properties: {
              competency_tested: { type: Type.STRING },
              verified: { type: Type.BOOLEAN },
              evidence_quote: { type: Type.STRING },
              confidence: { type: Type.STRING, enum: ['low', 'moderate', 'high'] }
            },
            required: ["competency_tested", "verified", "evidence_quote", "confidence"]
          },
          // Renamed from 'graduate_capital_signal'/human·social·cultural·psychological·identity "capital" —
          // Tomlinson (2017)'s graduate capital model is a validated employability framework; a single
          // response's evidence domain is not a measurement of a candidate's actual capital reserves.
          // This classifies WHICH TYPE of evidence the response contains, nothing more. Kept (renamed,
          // not removed) because the underlying domain classification has real coaching value for the
          // candidate-facing Growth Summary.
          strength_domain_signal: {
            type: Type.OBJECT,
            properties: {
              primary_domain: { type: Type.STRING, enum: ['technical_skill', 'relationship_network', 'professional_fit', 'resilience', 'professional_narrative'] },
              secondary_domain: { type: Type.STRING, enum: ['technical_skill', 'relationship_network', 'professional_fit', 'resilience', 'professional_narrative'], nullable: true },
              evidence_basis: { type: Type.STRING }
            },
            required: ["primary_domain", "secondary_domain", "evidence_basis"]
          }
        },
        required: [
          "probe_successful", "depth_delta", "evidence_added", "star_status", "weakest_star_component",
          "contextual_anchor", "suggested_next_probe_type", "behavioural_evidence_signals", "scaffold_dependency_signal",
          "interpretation", "pj_observations", "novel_claim_introduced", "proceed", "reason", "coaching_tip",
          "behavioral_evidence_vectors", "presentation_register", "response_quality_signals", "algorithmic_aversion",
          "competency_demonstration_level", "competency_demonstration_descriptor", "performance_context_signal",
          "competency_verification", "strength_domain_signal"
        ]
      }
    }
  });

  const parsed = JSON.parse(aiResponse.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
  // Backward-compat aliases for sealed files (QuestionReport.tsx, AscendPlatform.tsx) that still read
  // the old theory-named shapes directly — same data, honestly-named source. Remove these aliases
  // once those files can be migrated to the renamed fields directly.
  if (parsed.response_quality_signals) {
    const q = parsed.response_quality_signals;
    const lowestMap: Record<string, string> = { domain_language: 'gc', adaptive_reasoning: 'gf', evidence_specificity: 'gq' };
    parsed.chc_signals = {
      gc: q.domain_language, gf: q.adaptive_reasoning, gq: q.evidence_specificity,
      lowest_signal: lowestMap[q.lowest_signal] ?? 'gc',
    };
  }
  if (parsed.behavioral_evidence_vectors) {
    const b = parsed.behavioral_evidence_vectors;
    const lowestMap: Record<string, string> = { personal_agency: 'autonomy', skill_specificity: 'competence', impact_articulation: 'relatedness' };
    parsed.merit_vectors = {
      autonomy: b.personal_agency, competence: b.skill_specificity, relatedness: b.impact_articulation,
      lowest_vector: lowestMap[b.lowest_vector] ?? 'autonomy',
    };
  }
  if (parsed.presentation_register) {
    parsed.presentation_authenticity = {
      front_stage: parsed.presentation_register.rehearsed_language,
      back_stage: parsed.presentation_register.spontaneous_language,
    };
  }
  if (parsed.strength_domain_signal) {
    const s = parsed.strength_domain_signal;
    const domainMap: Record<string, string> = {
      technical_skill: 'human', relationship_network: 'social', professional_fit: 'cultural',
      resilience: 'psychological', professional_narrative: 'identity',
    };
    parsed.graduate_capital_signal = {
      primary_capital: domainMap[s.primary_domain] ?? 'human',
      secondary_capital: s.secondary_domain ? (domainMap[s.secondary_domain] ?? null) : null,
      evidence_basis: s.evidence_basis,
    };
  }
  return parsed;
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

PERFORMANCE CONTEXT NOTE (candidate-facing, plain English)
Review the performance_context_signal signals in the DATA SIGNALS (Probe Analyses) above.
IF any dimension (skill_evidence_level, engagement_level, format_conditions_level) is 'low':
  Generate a single sentence for the amoContextNote field — plain English, no framework labels.
  Purpose: contextualise why performance may have been affected by conditions, not only capability.
  Frame it as information, not excuse. Never expose the labels 'ability', 'motivation', 'opportunity',
  or any internal field name.
  Example when format_conditions_level is low: "Follow-up questions in this session were more demanding
    than usual — performance under pressure like this often looks different from your baseline capability."
  Example when engagement_level is low: "Your answers were strongest when describing experiences you clearly
    cared about — connecting the role more directly to what motivates you will unlock more of that energy."
  Example when skill_evidence_level is low: "The evidence in this answer was still developing — that is
    exactly what repeated practice is designed to build."
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
