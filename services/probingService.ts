
import { GoogleGenAI, Type } from "@google/genai";
import { Probe, ProbeAnalysis } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const generateProbe = async (transcript: string, context: string): Promise<Probe> => {
  const model = "gemini-3-flash-preview";
  
  const response = await ai.models.generateContent({
    model,
    contents: `
      Analyze the following candidate interview transcript and context. 
      Generate a deep, Situational Judgement Test (SJT) based follow-up question (probe) in layman's terms.

      A) PROCEDURAL JUSTICE (Lind & Tyler, 1988; Lind et al., 1990)
   The probe must reflect at least one of the six dimensions:
   1. Voice       — does the candidate get to express their perspective?
   2. Validation  — is their prior response acknowledged?
   3. Respect     — is the tone dignified, never condescending?
   4. Neutrality  — is the question objective and unbiased?
   5. Motivation  — does it reflect genuine concern for the candidate?
   6. Explanation — is a brief rationale provided for why it is asked?
   ALWAYS populate the rationale field. Research shows rationales
   significantly increase fairness perceptions in AI interviews
   (Chapman et al., 2003; McCarthy et al., 2017; Basch & Melchers, 2019).

B) IMPRESSION MANAGEMENT — GOFFMAN (1959)
   Distinguish between the candidate's FRONT-STAGE presentation (curated,
   rehearsed, socially managed) and BACK-STAGE signals (authentic,
   candid, unguarded). When front-stage performance appears overly
   rehearsed, probe to surface backstage content.
   Note: this is Goffman's dramaturgical model — not a character judgement.

C) SOCIAL IDENTITY AWARENESS (Highhouse et al., 2007)
   SCOPE: Apply ONLY when the candidate is explicitly discussing their
   motivation to join the target organisation — not general responses.
   When applicable: probe whether they are driven by VALUE EXPRESSION
   (intrinsic alignment with org values) or SOCIAL RECOGNITION
   (extrinsic approval-seeking).

D) SELF-DETERMINATION THEORY (Deci & Ryan, 2000)
   Probes should elicit evidence of:
   Autonomy (ownership, agency), Competence (mastery, depth),
   Relatedness (stakeholder alignment, interpersonal logic).

E) ALGORITHMIC AVERSION (Dietvorst et al., 2015; Logg et al., 2019)
   If the candidate signals resistance to AI-mediated assessment
   (e.g. 'I don't think a computer can judge this', 'this feels
   unfair'), acknowledge their concern respectfully and invite them
   to articulate their reasoning. Flag as psychologicalPrinciple:
'Algorithmic Aversion'.

═══════════════════════════════════════════════════════
CONSTRAINTS
═══════════════════════════════════════════════════════
- NEVER generate generic questions (e.g. 'Tell me about a challenge')
- NEVER use academic jargon in the question itself
- NEVER hallucinate skills or experiences not in the transcript
- ALWAYS write the probe in plain, accessible English
- ALWAYS populate the rationale field
- ONE probe only — not a list

═══════════════════════════════════════════════════════
FEW-SHOT EXEMPLARS
═══════════════════════════════════════════════════════
GOOD PROBE:
  Transcript: 'I kept the team stable during the restructure by
               being the anchor.'
  Probe:      'You described yourself as the anchor — what does that
               actually mean for you in practice? Can you tell me about
               a moment when that anchor role was genuinely hard to hold?'
  Rationale:  'I want to understand whether your stability was a
               proactive leadership choice or a reactive response —
               both are valid, but they tell me different things about
               your agency under uncertainty.'

BAD PROBE (never generate this):
'Tell me about a time you showed leadership.'
  Why it fails: generic, ignores candidate's own language entirely.

    
      
      ### INPUT DATA
      Transcript: ${transcript}
      Context: ${context}
    `,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          question: { type: Type.STRING },
          focus: { 
            type: Type.STRING, 
            enum: ['strategic_alignment', 'stakeholder_management', 'operational_integrity'] 
          },
          psychologicalPrinciple: { 
            type: Type.STRING, 
            enum: ['Impression Management', 'Procedural Justice', 'Social Identity Awareness'] 
          },
          rationale: { type: Type.STRING }
        },
        required: ["id", "question", "focus", "psychologicalPrinciple", "rationale"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
};

export const analyzeProbeResponse = async (transcript: string, probe: Probe): Promise<ProbeAnalysis> => {
  const model = "gemini-3-flash-preview";
  
  const response = await ai.models.generateContent({
    model,
    contents: `
      Analyze the candidate's response to the following probe.
      
      Probe: ${probe.question}
      Response: ${transcript}
      
      Provide insights into their strategic alignment, stakeholder management capabilities, and operational integrity based on their response to the organizational dilemma.
      
      
1. ORGANISATIONAL CONSTRUCTS
   Assess strategic alignment, stakeholder management, and operational
   integrity. If the response is nonsensical or off-topic, label it
   honestly — do not hallucinate professional substance.

2. SDT MERIT VECTORS (Deci & Ryan, 2000)
   Score Autonomy, Competence, Relatedness (0–100 each) based on
   verbal evidence only. Do not infer scores from tone alone.
   - Autonomy:    Demonstrated agency, ownership, independent decisions
   - Competence:  Technical depth, mastery, problem-solving ability
   - Relatedness: Stakeholder alignment, interpersonal logic

3. IMPRESSION MANAGEMENT — GOFFMAN (1959)
   Evaluate the candidate's dramaturgical performance:
   - impressionManagementScore (0–100): Degree of curated, front-stage
     self-presentation. High = heavily managed/rehearsed presentation.
     LOW score = more authentic, backstage disclosure.
   - High front-stage is NOT inherently bad in an interview context.
     Flag ONLY when strategic performance obscures substantive evidence.

4. PROCEDURAL JUSTICE — SIX DIMENSIONS (Lind et al., 1990)
   Score the candidate's experience of THIS probe interaction (0–100):
   - voice:       Did the probe allow the candidate to express their view?
   - validation:  Was the candidate's prior response acknowledged?
   - respect:     Was the probe worded with dignity?
   - neutrality:  Was the probe objective and free from bias?
   - motivation:  Did the probe reflect genuine interest in the candidate?
   - explanation: Was a rationale provided for why the probe was asked?
   Also provide the proceduralJusticeNote as a holistic summary.

5. SOCIAL IDENTITY AWARENESS (Highhouse et al., 2007)
   SCOPE: Apply ONLY if the candidate discussed their motivation to
   join the target organisation. If not applicable, explicitly note
   this in the note field.
   When applicable: score valueExpression and socialRecognition (0–100).

6. ALGORITHMIC AVERSION (Dietvorst et al., 2015; Logg et al., 2019)
   Scan for language signalling resistance to AI-mediated assessment.
   Examples: scepticism about AI fairness, distrust, attempts to
   game the system, dismissive language about automated feedback.
   If detected, note it clearly — this is a critical confound variable
   for the research study.

7. STRICT RELEVANCE AUDIT
   If the response is 'low_value' (nonsense/filler) or 'out_of_context'
   (irrelevant to the probe), set integrityViolation accordingly.
   Do NOT attempt to find professional value in a meaningless response.

8. INTEGRITY & SAFETY AUDIT
   Detect: abusive language, hate speech, sensitive PII.
   If detected: set integrityViolation.detected: true.

═══════════════════════════════════════════════════════
TONE & PSYCHOLOGICAL SAFETY
═══════════════════════════════════════════════════════
- Frame gaps as 'areas for development' or 'opportunities for alignment'
- NEVER use: 'failed', 'poor', 'unqualified', 'wrong'
- Maintain the analysis as a diagnostic instrument, not a verdict

    `,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          strategicAlignment: { type: Type.STRING },
          stakeholderManagement: { type: Type.STRING },
          operationalIntegrity: { type: Type.STRING },
          meritVectors: {
            type: Type.OBJECT,
            properties: {
              autonomy: { type: Type.NUMBER },
              competence: { type: Type.NUMBER },
              relatedness: { type: Type.NUMBER }
            },
            required: ["autonomy", "competence", "relatedness"]
          },
          impressionManagementScore: { type: Type.NUMBER },
          proceduralJusticeNote: { type: Type.STRING },
          socialIdentityAwareness: {
            type: Type.OBJECT,
            properties: {
              valueExpression: { type: Type.NUMBER },
              socialRecognition: { type: Type.NUMBER },
              note: { type: Type.STRING }
            },
            required: ["valueExpression", "socialRecognition", "note"]
          },
          integrityViolation: {
            type: Type.OBJECT,
            properties: {
              detected: { type: Type.BOOLEAN },
              type: { type: Type.STRING, enum: ['abusive_language', 'sensitive_information', 'low_value', 'out_of_context', 'none'] },
              note: { type: Type.STRING }
            },
            required: ["detected", "type", "note"]
          }
        },
        required: ["strategicAlignment", "stakeholderManagement", "operationalIntegrity", "meritVectors", "impressionManagementScore", "proceduralJusticeNote", "socialIdentityAwareness", "integrityViolation"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
};
