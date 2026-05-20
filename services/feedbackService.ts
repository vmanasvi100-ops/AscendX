
import { GoogleGenAI, Type } from "@google/genai";
import { DetailedFeedback } from "../types";

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
  candidateProfile?: { experience: string; feedbackLiteracy: string; regulatoryFocus: string; anxietyLevel: string } | null;
}

export const generateDetailedFeedback = async (
  params: GenerateFeedbackParams
): Promise<DetailedFeedback> => {
  const ai = getAI();
  const model = "gemini-3-flash-preview";


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
  starAnalysis, keywordCoverage, careerDevelopment, rubrics

LAYER B — RESEARCHER-ONLY FIELDS:
  meritVectors, triarchicMeritAlignment, professionalSelfVerificationSignals,
  impressionManagementScore, socialIdentityAwareness,
  algorithmicAversionScore, psychologicalSafetyScore,
  biasAndFairnessNote, integrityViolation, maskedTranscript

═══════════════════════════════════════════════════════
CONTEXT
═══════════════════════════════════════════════════════
Job Requirements:          ${params.jobRequirements}
Candidate CV:              ${params.cvText || 'Not provided.'}
Interview Transcript:      ${params.transcript}
Probing Pipeline Analysis: ${params.probeAnalysis || 'Not available.'}
Adaptive Profile:          ${params.candidateProfile ? `experience=${params.candidateProfile.experience}, feedbackLiteracy=${params.candidateProfile.feedbackLiteracy}, regulatoryFocus=${params.candidateProfile.regulatoryFocus}, anxietyLevel=${params.candidateProfile.anxietyLevel} — adjust Layer A tone: overwhelmed/uncertain→max 3 suggestions; promotion→frame as opportunities; prevention→frame as corrections; high anxiety→open with a genuine strength, no negative openers.` : 'Not provided — use defaults.'}

═══════════════════════════════════════════════════════
STEP 0 — GENERATE LAYER B SCORES FIRST
═══════════════════════════════════════════════════════

Before writing any Layer A feedback, generate all Layer B scores from the transcript.
Use those scores to personalise Layer A — do not write generic coaching. The frameworks must drive the feedback content.

Specifically:
- If 'autonomy' is the Lowest Merit Vector in Step 0: the primary actionable
  suggestion must address ownership and agency directly.
- If 'competence' is the Lowest Merit Vector in Step 0: the primary suggestion
  must address depth of evidence and measurable impact.
- If 'relatedness' is the Lowest Merit Vector in Step 0: the primary suggestion
  must address how the candidate frames their impact on others.

- If impressionManagementScore.frontStageScore > 75 (high impression management detected):
  the feedback must include one prompt inviting more authentic
  disclosure — e.g. 'Try telling me what you actually found hard
  about that situation, not just what you did.'
- If impressionManagementScore.backStageScore > 75 (highly authentic but unstructured):
  the feedback must affirm the authenticity and help structure it
  — e.g. 'Your honesty comes through powerfully — the next step
  is giving that authenticity a clear STAR structure so interviewers
  can follow and advocate for your story.'

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
CRITICAL: Generate at least 5 actionable suggestions.
Use the Step 0 lowest signals to prioritise these.

PRIORITY ORDER for which suggestion leads:
  1. If lowestVector from Step 0 addresses a real gap → SDT leads
  3. If lowestSignal from chcCognitiveDimensions is 'weak' → CHC (in plain language) leads
  4. Keyword coverage gap from JD

SDT TRANSLATIONS (use these exact framings — no SDT labels):
  Autonomy weak: 'Use more "I decided" and "I chose" language. Interviewers are
    assessing your judgment — they need to hear your specific decisions, not just
    what the team did or what happened. Own your choices explicitly.'
  Competence weak: 'Your answers need more specific evidence of skill. Numbers,
    timelines, and named tools are more convincing than general descriptions.
    What specifically did you do, and what was the measurable result?'
  Relatedness weak: 'Show more awareness of how your work affected others.
    Interviewers at this level assess not just what you achieved but how you
    brought people with you. Name the people, describe the impact on them.'

CHC TRANSLATIONS (plain English — no abbreviations):
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

── meritVectors (SDT — Deci & Ryan, 2000) ──────────────────────
meritVectors: {
  autonomy: { score: 0–100, evidenceBasis: string },
  competence: { score: 0–100, evidenceBasis: string },
  relatedness: { score: 0–100, evidenceBasis: string },
  lowestVector: 'autonomy' | 'competence' | 'relatedness',
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

── impressionManagementScore (Goffman, 1959) ───────────────────
impressionManagementScore: {
  frontStageScore: 0–100,
  backStageScore: 0–100,
  dominantMode: 'front_stage' | 'back_stage' | 'balanced',
  authenticitySignal: string,
  feedbackImplication: string  // what this drove in Layer A
}

── algorithmicAversionSignal (Dietvorst et al., 2015) ──────────
algorithmicAversionSignal: {
  aversionDetected: true | false,
  aversionEvidence: string | null,
  feedbackImplication: string  // whether Layer A opened with acknowledgement
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

── chcCognitiveDimensions (McGrew / CHC, 2009) ─────────────────
Replaces Sternberg. Three CHC dimensions observable from verbal performance.
chcCognitiveDimensions: {
  crystallisedIntelligence: {
    score: 0–100 | null,
    // Gc: accumulated knowledge, vocabulary, domain-specific evidence quality
    evidenceBasis: string,
    validityDisclaimer: 'AI-generated Gc proxy — exploratory, not validated'
  },
  fluidIntelligence: {
    score: 0–100 | null,
    // Gf: adaptive reasoning, flexibility under probing, novel problem-solving
    evidenceBasis: string,
    validityDisclaimer: 'AI-generated Gf proxy — exploratory, not validated'
  },
  practicalReasoning: {
    score: 0–100 | null,
    // Gq: result specificity, action clarity, transfer from learning to action
    evidenceBasis: string,
    validityDisclaimer: 'AI-generated Gq proxy — exploratory, not validated'
  },
  overallCHCNote: string,
  researchNote: 'CHC dimensions scored per McGrew (2009). AI operationalisation — validity under empirical investigation in AscendX RCT.'
}

── scaffoldedLearningSignal (Vygotsky, 1978; Wood et al., 1976) ─
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
                autonomy: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, evidenceBasis: { type: Type.STRING } }, required: ["score", "evidenceBasis"] },
                competence: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, evidenceBasis: { type: Type.STRING } }, required: ["score", "evidenceBasis"] },
                relatedness: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, evidenceBasis: { type: Type.STRING } }, required: ["score", "evidenceBasis"] },
                lowestVector: { type: Type.STRING, enum: ['autonomy', 'competence', 'relatedness'] },
                primarySuggestionAnchor: { type: Type.STRING }
              },
              required: ["autonomy", "competence", "relatedness", "lowestVector", "primarySuggestionAnchor"]
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
            impressionManagementScore: {
              type: Type.OBJECT,
              properties: {
                frontStageScore: { type: Type.NUMBER },
                backStageScore: { type: Type.NUMBER },
                dominantMode: { type: Type.STRING, enum: ['front_stage', 'back_stage', 'balanced'] },
                authenticitySignal: { type: Type.STRING },
                feedbackImplication: { type: Type.STRING }
              },
              required: ["frontStageScore", "backStageScore", "dominantMode", "authenticitySignal", "feedbackImplication"]
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
                crystallisedIntelligence: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER, nullable: true }, evidenceBasis: { type: Type.STRING }, validityDisclaimer: { type: Type.STRING } }, required: ["evidenceBasis", "validityDisclaimer"] },
                fluidIntelligence: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER, nullable: true }, evidenceBasis: { type: Type.STRING }, validityDisclaimer: { type: Type.STRING } }, required: ["evidenceBasis", "validityDisclaimer"] },
                practicalReasoning: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER, nullable: true }, evidenceBasis: { type: Type.STRING }, validityDisclaimer: { type: Type.STRING } }, required: ["evidenceBasis", "validityDisclaimer"] },
                overallCHCNote: { type: Type.STRING },
                researchNote: { type: Type.STRING }
              },
              required: ["crystallisedIntelligence", "fluidIntelligence", "practicalReasoning", "overallCHCNote", "researchNote"]
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
            "impressionManagementScore",
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

    return JSON.parse(response.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
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
