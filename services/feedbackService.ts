
import { GoogleGenAI, Type } from "@google/genai";
import { DetailedFeedback } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const generateDetailedFeedback = async (
  transcript: string, 
  jobRequirements: string,
  cvText?: string,
  probeAnalysis?: string
): Promise<DetailedFeedback> => {
  const model = "gemini-3-flash-preview";

  const response = await ai.models.generateContent({
    model,
    contents: `
      You are an expert Interview Auditor and Occupational Psychologist.
Generate a structured performance report from the data below.

═══════════════════════════════════════════════════════
CRITICAL — TWO-LAYER OUTPUT ARCHITECTURE
═══════════════════════════════════════════════════════
This prompt generates output for TWO audiences simultaneously.
NEVER mix their tones, vocabularies, or purposes.

LAYER A — STUDENT-FACING FIELDS:
  performanceSummary, strengths, weaknesses, actionableSuggestions,
  starAnalysis, keywordCoverage, careerDevelopment, rubrics

LAYER B — RESEARCHER-ONLY FIELDS:
  meritVectors, triarchicMeritAlignment, proceduralJusticeDimensions,
  impressionManagementScore, socialIdentityAwareness,
  algorithmicAversionSignal, psychologicalSafetyScore,
  biasAndFairnessNote, integrityViolation, maskedTranscript

═══════════════════════════════════════════════════════
CONTEXT
═══════════════════════════════════════════════════════
Job Requirements:          ${jobRequirements}
Candidate CV:              ${cvText || 'Not provided.'}
Interview Transcript:      ${transcript}
Probing Pipeline Analysis: ${probeAnalysis || 'Not available.'}

═══════════════════════════════════════════════════════
STEP 0 — GENERATE LAYER B SCORES FIRST
═══════════════════════════════════════════════════════
Before writing any Layer A feedback, generate all Layer B scores.
Then use those scores to personalise Layer A — do not write generic
coaching. The frameworks must drive the feedback content, not just
sit as separate numbers.

Specifically:
- If Autonomy is the LOWEST Merit Vector: the primary actionable
  suggestion must address ownership and agency directly.
- If Competence is the LOWEST Merit Vector: the primary suggestion
  must address depth of evidence and measurable impact.
- If Relatedness is the LOWEST Merit Vector: the primary suggestion
  must address how the candidate frames their impact on others.

- If frontStageScore > 75 (high impression management detected):
  the feedback must include one prompt inviting more authentic
  disclosure — e.g. 'Try telling me what you actually found hard
  about that situation, not just what you did.'
- If backstageScore > 75 (highly authentic but unstructured):
  the feedback must affirm the authenticity and help structure it
  — e.g. 'Your honesty comes through powerfully — the next step
  is giving that authenticity a clear STAR structure so interviewers
  can follow and advocate for your story.'

- If valueExpression dominates socialRecognition (Highhouse, 2007):
  frame ALL development areas in terms of personal alignment —
'You clearly care about X — connecting that more explicitly to
  the organisation's mission would make it land even more powerfully.'
- If socialRecognition dominates valueExpression:
  frame ALL development areas in terms of interviewer impact —
'Interviewers respond strongly to specific examples because it
  gives them something concrete to advocate for internally.'

- If algorithmicAversionSignal.aversionDetected is true:
  acknowledge the candidate's scepticism respectfully in the
  performanceSummary before delivering any scored feedback.
  e.g. 'You raised a fair question about how AI assesses interviews.
  The feedback below is grounded in established occupational
  psychology frameworks — treat it as a structured reflection
  tool, not a final verdict.'

═══════════════════════════════════════════════════════
LAYER B — RESEARCHER DATA INSTRUCTIONS
═══════════════════════════════════════════════════════

B1. SDT MERIT VECTORS (Deci & Ryan, 2000)
    Score Autonomy, Competence, Relatedness (0–100) from verbal
    evidence only. Do not infer from tone or confidence alone.
    - Autonomy:    Agency, ownership, independent decision-making
    - Competence:  Mastery, technical depth, measurable expertise
    - Relatedness: Stakeholder alignment, interpersonal logic
    Return null per dimension if evidence is insufficient.

B2. STERNBERG TRIARCHIC MERIT (Sternberg, 1985)
    EXPERIMENTAL APPLICATION — not a validated instrument.
    Always populate validityDisclaimer:
'Experimental application of Sternberg (1985) — scores are
    indicative only, not derived from a validated instrument.'
    Score (0–100) with direct transcript evidence:
    - Analytical (Componential): Problem-solving, logic, analysis
    - Creative   (Experiential): Innovation, adaptability, novel thinking
    - Practical  (Contextual):   Execution, delivery, stakeholder mgmt
    Note correlation between interview performance and CV claims.

B3. PROCEDURAL JUSTICE — SIX DIMENSIONS (Lind et al., 1990)
    These six dimensions are not just measurement criteria — they are
    active quality standards that Layer A feedback must embody.
    Score how well THIS feedback interaction honours each dimension:
    - voice:       Did the feedback give the candidate space to
      contextualise or push back?
    - validation:  Did it acknowledge what the candidate was trying
      to do before critiquing the execution?
    - respect:     Is the tone dignified throughout — no condescension?
    - neutrality:  Is the feedback objective and free from bias?
    - motivation:  Does it reflect genuine concern for their growth?
    - explanation: Does it explain WHY each development area matters
      for this specific role — not just WHAT to improve?
    Compute overallScore as the mean of the six dimensions.
    PRIMARY RQ1 OUTCOME VARIABLE — score carefully and honestly.

B4. IMPRESSION MANAGEMENT — GOFFMAN (1959)
    impressionManagementScore (0–100):
    High = heavily curated front-stage self-presentation.
    Low  = authentic backstage disclosure.
    This score directly determines the feedback personalisation
    logic applied in Step 0 above.

B5. SOCIAL IDENTITY AWARENESS (Highhouse et al., 2007)
    SCOPE RESTRICTION: Apply ONLY if the candidate explicitly
    discussed motivation to join the target organisation.
    Score valueExpression and socialRecognition (0–100).
    These scores directly determine the framing logic in Step 0.
    Always document whether the construct was applicable and why.

B6. ALGORITHMIC AVERSION (Dietvorst et al., 2015; Logg et al., 2019)
    Scan for resistance to AI-mediated assessment:
    - Scepticism about AI fairness or scoring
    - Attempts to game or circumvent the system
    - Dismissive language about automated feedback
    Score aversionScore and appreciationScore (0–100 each).
    Quote specific behaviouralIndicators from the transcript.
    This score directly triggers the acknowledgement instruction
    in Step 0 when aversionDetected is true.
    CRITICAL CONFOUND CONTROL VARIABLE — do not skip.

B7. BIAS & FAIRNESS NOTE
    Flag any feedback quality variation across accents, cultural
    norms, or communication styles detected in the transcript.

B8. INTEGRITY & SAFETY AUDIT
    Detect: abusive language, hate speech, sensitive PII.
    Set integrityViolation.detected: true if found.
    Redact all instances in maskedTranscript using asterisks (**).

B9. MASKED TRANSCRIPT
    Full transcript with all PII and abusive language redacted.

═══════════════════════════════════════════════════════
LAYER A — STUDENT FEEDBACK INSTRUCTIONS
═══════════════════════════════════════════════════════
Write Layer A AFTER generating Layer B scores.
Use the scores to personalise every field per Step 0 rules.

LAYER A WRITING RULES (apply to every field below):
- Flesch-Kincaid Grade Level 8 or below. Short sentences.
- NO framework names. NO citations. NO jargon.
- Task-level feedback only — anchor every point to a specific
  behaviour or moment in the transcript, never to a character trait.
  GOOD: 'Your answer included a clear action step but the result
  was missing.'
  BAD:  'You seem disorganised.'
- Attribute performance to effort and strategy — never to fixed
  ability. GOOD: 'Practising STAR structure will make this land
  more powerfully.' BAD: 'You are a natural communicator.'
- One primary development area per session — do not overwhelm.
  Everything else is secondary.
- NEVER use: 'failed', 'poor', 'unqualified', 'wrong'.
- Use: 'a strong next step would be', 'to further strengthen this',
'you already demonstrated X — building on that, Y is your next step'.

A1. EMPTY TRANSCRIPT GUARD
    If the transcript is empty or only filler words,
    return noData: true. Do not generate any scores.

A2. PERFORMANCE SUMMARY
    2–3 sentences. Structure as:
    (1) Where the candidate currently stands — specific and honest.
    (2) What they did well in this specific session — task-level.
    (3) The single most important next action before next practice.
    If algorithmicAversionSignal.aversionDetected is true, open
    with an acknowledgement of their scepticism first (see Step 0).
    Reference what they actually said — not generic interview advice.

A3. SDT-INFORMED AUTONOMY SUPPORT
    The actionableSuggestions field MUST be autonomy-supportive —
    not prescriptive. Give rationale for each suggestion. Acknowledge
    what the candidate was trying to do before suggesting a refinement.
    GOOD: 'You were clearly trying to show your ownership of the
    project — adding the specific decision you made and why would
    make that ownership undeniable to an interviewer.'
    BAD:  'You need to show more ownership.'

A4. STAR ANALYSIS (Situation, Task, Action, Result)
    Extract evidence for each component from the transcript.
    If a component is absent, name it plainly and give one
    specific, concrete example of what they could add.
    Do not invent content.

A5. KEYWORD COVERAGE
    From the job requirements, list keywords used and missed.
    For each missing keyword, suggest how the candidate could
    naturally incorporate it in their next practice session.

A6. RUBRICS
    Score 0–100: fluency, technical correctness, confidence,
    cultural alignment. One sentence explanation per score.
    Each explanation must reference the transcript directly.

A7. ACTIONABLE SUGGESTIONS
    3 suggestions maximum — Cognitive Load Theory (Sweller, 1988)
    limits meaningful processing to 2–3 points at once.
    The FIRST suggestion must address the lowest Merit Vector
    identified in Layer B. Each suggestion starts with a verb.
    GOOD: 'Practise adding a quantified result to your STAR answers.'
    BAD:  'Work on your storytelling.'

A8. CAREER DEVELOPMENT
    2–3 specific certifications and 2–3 next steps relevant to
    this job description. Concrete and achievable.

═══════════════════════════════════════════════════════
PSYCHOLOGICAL SAFETY SELF-AUDIT (0–100)
═══════════════════════════════════════════════════════
After generating ALL output, score your Layer A feedback:
- No demotivating language (failed/poor/unqualified)    [30pts]
- Every point anchored to transcript behaviour, not trait [25pts]
- Strength acknowledged before every weakness            [25pts]
- Suggestions have rationale, not just instruction       [20pts]
Report as psychologicalSafetyScore.
If below 70, revise Layer A before returning.
This score will be correlated with candidate STAI-S6 anxiety
scores in the study's quantitative analysis phase.

    `,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          performanceSummary: { type: Type.STRING },
          rubrics: {
            type: Type.OBJECT,
            properties: {
              fluency: { type: Type.NUMBER },
              technicalCorrectness: { type: Type.NUMBER },
              confidence: { type: Type.NUMBER },
              culturalAlignment: { type: Type.NUMBER }
            },
            required: ["fluency", "technicalCorrectness", "confidence", "culturalAlignment"]
          },
          strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
          weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
          actionableSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
          biasAndFairnessNote: { type: Type.STRING },
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
          integrityViolation: {
            type: Type.OBJECT,
            properties: {
              detected: { type: Type.BOOLEAN },
              type: { type: Type.STRING, enum: ['abusive_language', 'sensitive_information', 'none'] },
              note: { type: Type.STRING }
            },
            required: ["detected", "type", "note"]
          },
          triarchicMeritAlignment: {
            type: Type.OBJECT,
            properties: {
              analytical: {
                type: Type.OBJECT,
                properties: {
                  score: { type: Type.NUMBER },
                  evidence: { type: Type.STRING }
                },
                required: ["score", "evidence"]
              },
              creative: {
                type: Type.OBJECT,
                properties: {
                  score: { type: Type.NUMBER },
                  evidence: { type: Type.STRING }
                },
                required: ["score", "evidence"]
              },
              practical: {
                type: Type.OBJECT,
                properties: {
                  score: { type: Type.NUMBER },
                  evidence: { type: Type.STRING }
                },
                required: ["score", "evidence"]
              },
              correlationNote: { type: Type.STRING }
            },
            required: ["analytical", "creative", "practical", "correlationNote"]
          },
          meritVectors: {
            type: Type.OBJECT,
            properties: {
              autonomy: { type: Type.NUMBER },
              competence: { type: Type.NUMBER },
              relatedness: { type: Type.NUMBER }
            },
            required: ["autonomy", "competence", "relatedness"]
          },
          maskedTranscript: { type: Type.STRING }
        },
        required: [
          "performanceSummary", 
          "rubrics", 
          "strengths", 
          "weaknesses", 
          "actionableSuggestions", 
          "biasAndFairnessNote", 
          "starAnalysis",
          "keywordCoverage",
          "careerDevelopment",
          "integrityViolation",
          "triarchicMeritAlignment",
          "meritVectors",
          "maskedTranscript"
        ]
      }
    }
  });

  return JSON.parse(response.text || "{}");
};
