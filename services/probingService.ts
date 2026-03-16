
import { GoogleGenAI, Type } from "@google/genai";
import { Probe, ProbeAnalysis, QuestionDataAccumulator, QuestionSummaryReport } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface GenerateProbeParams {
  candidateId: string;
  targetRole: string;
  companyName: string;
  cvSummary: string;
  jobDescription: string;
  currentQuestion: { text: string; type: string; difficulty?: string };
  sessionPhaseIndex: number;
  questionsAnsweredCount: number;
  priorProbesThisQuestion: string;
  candidateAnswer: string;
  conversationHistory: string;
  cumulativeTranscript?: string;
}

export const generateProbe = async (params: GenerateProbeParams): Promise<Probe> => {
  const model = "gemini-3-flash-preview";

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: 'user', // System instruction as a user turn for contents[0]
        parts: [{
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

3. RATIONALE FIELD (Procedural Justice — Explanation dimension)
   Every probe must include a rationale — a plain-English explanation of why
   this specific probe is being asked. Max 2 sentences. No jargon.
   Example: 'This question helps interviewers understand how you translate
   experience into action. Specific evidence is more convincing than general claims.'

4. COHERENCE CHAINING
   Each probe must build on the full conversation so far — not just the last answer.
   The session should deepen, not restart.

5. DRIFT DETECTION
   If the candidate's answer is off-topic or vague, use a REDIRECTING probe.
   Never engage the off-topic content — redirect professionally.

 ═══════════════════════════════════════════════════════════════════
 ZPD SCAFFOLD MODULATION — Vygotsky (1978) / Wood et al. (1976)
 ═══════════════════════════════════════════════════════════════════

You will receive session_phase_index and question_difficulty_level in the context.
Modulate your probe intensity accordingly:

PHASE 1 — Introductory Alignment (session_phase_index 0–2, difficulty: EASY)
  Zone of Proximal Development: Maximum scaffold. Candidate is warming up.
  → Use supportive, structured language with no ambiguity
  → Offer structural hints if answer was incomplete:
      'You described the situation well — what was your specific role in the action?'
  → If answer was strong, acknowledge briefly before deepening
  → NEVER increase cognitive pressure at this stage
  → Rationale MUST be detailed and warm

PHASE 2 — Core Competency (session_phase_index 3–6, difficulty: MEDIUM)
  Zone of Proximal Development: Moderate scaffold. Building independence.
  → Reference candidate's language as always
  → Probe the gap between claim and evidence directly
  → Introduce mild abstraction: 'What would you do differently now?'
  → Structural hints are reduced — candidate should be building structure independently
  → Rationale present but briefer

PHASE 3 — Strategic High-Stakes (session_phase_index 7+, difficulty: HARD)
  Zone of Proximal Development: Minimal scaffold. Independent performance.
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
        }]
      },
      {
        role: 'user',
        parts: [{
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



      CANDIDATE'S CURRENT ANSWER / CUMULATIVE TRANSCRIPT:
      ${params.cumulativeTranscript || params.candidateAnswer}

      CONVERSATION HISTORY (last 3 exchanges):
      ${params.conversationHistory}

      TASK:
      Generate a single adaptive probe following all system instructions.
      Ensure the probe heavily targets the "TARGET SIGNAL FOR THIS PROBE".
      Return JSON only — no preamble, no markdown.
          `
        }]
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

  return JSON.parse(response.text || "{}");
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

3. SDT MERIT VECTORS (0-100)
   Score the candidate's language CURRENTLY in this response only.
   autonomy: Ownership/initiation language.
   competence: Evidence of skills/ability.
   relatedness: Impact on others/teamwork.

4. GOFFMAN SCORES (0-100)
   front_stage: Polished, professional, 'ideal' self-presentation.
   back_stage: Authentic, vulnerable, 'real' self-presentation.

5. CHC COGNITIVE SIGNALS
   gc: Crystallized intelligence (vocabulary/domain knowledge).
   gf: Fluid reasoning (adaptive logic/problem solving).
   gq: Quantitative/technical evidence.
   lowest_signal: 'gc' | 'gf' | 'gq'.

6. PROCEDURAL JUSTICE (Qualitative Feedback Lens)
   Use the six PJ dimensions ONLY to generate honest, specific feedback. No scoring.
   - Voice: Candidate asserting their own perspective/position.
   - Validation: Responses building on earlier content.
   - Neutrality: Specific evidence vs vague/socially desirable framing.
   - Respect: Owning decisions vs over-hedging/deflecting.
   - Motivation: Genuine investment/elaboration vs minimal compliance.
   - Explanation: Explaining 'why' decisions were made.
   
   Identify 1-2 dimensions with the clearest gaps.
   pj_observations: Max 2 plain English observations. Must reference specific candidate quotes. Use human terms, skip theoretical language.
   Example: "'I tried to support the team' — try saying what you personally decided and why, rather than what you attempted." (Voice gap)

7. SCAFFOLD & NOVELTY
   scaffold_dependency_signal: 'relied_heavily' | 'used_moderately' | 'independent'
   novel_claim_introduced: true if new language/claims appeared.

8. DECISION
   proceed: true if they should move on, false if they need more probing.

9. COACHING RECOMMENDATION (Real-time Support)
   coaching_tip: A single, actionable instruction for the candidate to improve their response right now.
   Must be grounded in the STAR framework and the specific vectors identified.
   Example: "You've explained the Situation well — focus your next answer on the specific Action you personally took to resolve it."
   Example: "Your answer shows high Competence but low Autonomy — explain why YOU chose this approach rather than just following the process."
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
          }
        },
        required: [
          "probe_successful", "depth_delta", "evidence_added", "star_status", "weakest_star_component",
          "contextual_anchor", "suggested_next_probe_type", "sdt_signals", "scaffold_dependency_signal",
          "interpretation", "pj_observations", "novel_claim_introduced", "proceed", "reason", "coaching_tip",
          "merit_vectors", "goffman_scores", "chc_signals", "algorithmic_aversion"
        ]
      }
    }
  });

  return JSON.parse(aiResponse.text || "{}");
};

export interface GenerateQuestionSummaryParams {
  accumulator: QuestionDataAccumulator;
  targetRole: string;
  companyName: string;
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
    const aiResponse = await ai.models.generateContent({
      model,
      contents: [
        {
          role: 'user',
          parts: [{
            text: `You are AscendX, an expert AI interview coach. 
Generate a comprehensive STAR Analysis Report for the following candidate response to a specific interview question.

CONTEXT:
Target Role: ${params.targetRole}
Company: ${params.companyName}
Question: ${params.accumulator.questionId}
Transcript: ${params.accumulator.transcript}
Timer Framing: ${timerFramingCondition}
Act One Duration: ${responseDurations.actOne}s
Probe Durations: ${responseDurations.probes.join(', ')}s

DATA SIGNALS (Phase Analyses):
${JSON.stringify(params.accumulator.phaseAnalyses, null, 2)}

DATA SIGNALS (Probe Analyses):
${JSON.stringify(params.accumulator.probeAnalyses, null, 2)}

═══════════════════════════════════════════════════════════════════
REPORT STRUCTURE — FIVE SECTIONS (Plain English, No Jargon, High Impact)
═══════════════════════════════════════════════════════════════════

Section 1 — Your Answer Overview
2-3 sentence description of STAR coverage and overall arc.

Section 2 — What You Did Well
2-4 specific strengths based on highest-performing SDT/PJ signals. Reference specific quotes.

Section 3 — Where to Go Deeper
2-3 specific development points based on weak signals (CHC, SDT, PJ). Include Gap, Why it matters, and Concrete Instruction.

Section 4 — Your Probe Engagement
Paragraph on how the candidate handled probes (Scaffolded Learning/Goffman).
CRITICAL: This section MUST start with this EXACT sentence: "${timerNote}"

Section 5 — One Thing to Practise
Single prioritized instruction for next time based on the weakest overall signal.

Return JSON only — no preamble, no markdown. Use the following schema.`
          }]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
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
            practiceTask: { type: Type.STRING }
          },
          required: ["answerOverview", "strengths", "developmentPoints", "probeEngagement", "practiceTask"]
        }
      }
    });

    const parsed = JSON.parse(aiResponse.text || "{}");
    return {
      ...parsed,
      questionId: params.accumulator.questionId,
      questionText: params.accumulator.questionId,
      timestamp: Date.now()
    };
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
      practiceTask: "Continue practicing your STAR technique.",
      timestamp: Date.now()
    };
  }
};
