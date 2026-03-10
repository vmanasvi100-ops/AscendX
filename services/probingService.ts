
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
      
      ### ADAPTIVE PROBING PROTOCOL
      1. **Contextual Continuity**: The probe MUST be directly derived from the candidate's specific language. If they use metaphors, philosophical statements (e.g., "Life has its way of teaching"), or abstract concepts, acknowledge and build upon them.
      2. **Clarifying Probes**: When a candidate uses a specific professional term, phrase, or mentions an experience from their CV/context that requires more depth, use one of these clarifying structures:
         - "You mentioned [word or phrase], can you tell me more about what you mean by that?"
         - "What do you mean by [phrase]?"
         - "Could you clarify what you meant by [phrase]?"
      3. **Bridging Abstract to Concrete**: If the candidate makes a philosophical or high-level statement, ask them to correlate it with their previous learning or, ideally, to explain how that philosophy manifested in a specific project or professional challenge.
      4. **Drift & Low-Value Detection**: If the candidate's response is drifting off-topic, contains sensitive personal venting, or is nonsensical (hallucinatory/stupid), DO NOT entertain the content. Instead, generate a **Redirective Probe** that acknowledges the drift and firmly steers them back to the professional context.
      5. **Maintain Scrutiny Standards**: Regardless of the candidate's conversational direction, the probe must still scrutinize them against one of these core organizational constructs:
         - Strategic Alignment: Navigating competing priorities, organizational changes, or future contributions.
         - Stakeholder Management: Handling difficult interpersonal dynamics, team interrelations, or conflicting interests.
         - Operational Integrity: Maintaining standards, ethics, and risk management within a high-pressure situational context.
      
      ### PSYCHOLOGICAL FRAMEWORK
      - The question MUST be in layman's terms but remain deep and domain-specific.
      - Adhere to psychological principles: Impression Management (detecting how they present themselves), Procedural Justice, or Social Identity Awareness.
      - When applying Procedural Justice, ensure the probe reflects its six aspects (Lind et al., 1990): 1) Fairness (objective/neutral), 2) Voice (allowing expression of their view), 3) Validation (taking their view into account), 4) Respect (treating with dignity), 5) Motivation (genuine concern), and 6) Information (clarity on procedures).
      - **Crucial for Information (Explanations)**: Provide brief explanations for *why* a question is being asked. Research shows that explanations in video/AI interviews significantly increase fairness perceptions and organizational attractiveness (Chapman et al., 2003; Folger et al., 2022; McCarthy et al., 2017; Basch & Melchers, 2019; Hausknecht et al., 2004).
      - **Social Identity Awareness (Highhouse et al., 2007)**: When applicable, probe to determine if the candidate is driven by 'Value Expression' (intrinsic alignment with organizational values) or 'Social Recognition' (extrinsic desire to align with others for approval).
      
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
      
      ### TRIARCHIC MERIT MODEL INTEGRATION
      Evaluate the candidate's response against these three vectors:
      1. **Autonomy**: Ability to take ownership and make independent decisions.
      2. **Competence**: Technical proficiency and problem-solving depth.
      3. **Relatedness**: Stakeholder alignment and collaborative intelligence.
      
      ### ANALYSIS GUIDELINES
      - **Interpretative Flexibility**: If the candidate uses metaphors or philosophical framing, evaluate the *underlying logic* relative to the core constructs. Do not penalize abstract language if it successfully addresses the strategic, stakeholder, or operational challenge.
      - **Evidence-Based Evaluation**: Look for how they bridge their abstract beliefs to concrete professional actions or project examples.
      - **Strict Relevance Audit**: If the response is nonsensical, "stupid," or completely out of context (e.g., talking about their lunch or personal drama), DO NOT attempt to find professional value in it. Label it as "low_value" or "out_of_context" in the integrityViolation field.
      - **No Hallucinations**: If the response holds no value, do not hallucinate a score or a positive interpretation. Be honest about the lack of professional substance.
      
      Evaluate Impression Management (0-100 score) and provide a Procedural Justice note.
      The Procedural Justice note MUST evaluate the interaction based on its six aspects (Lind et al., 1990): 1) Fairness (objectivity), 2) Voice (candidate's ability to express views), 3) Validation (views taken into account), 4) Respect (dignity), 5) Motivation (genuine concern), and 6) Information (clarity).
      Also provide scores (0-100) for the Triarchic Merit Model vectors (Autonomy, Competence, Relatedness).
      Evaluate Social Identity Awareness (Highhouse et al., 2007): Assess if the candidate is driven by 'Value Expression' (intrinsic) or 'Social Recognition' (extrinsic alignment with others). Provide scores (0-100) for both and a brief note.
      
      ### TONE & PSYCHOLOGICAL SAFETY
      - Maintain a professional, constructive, and encouraging tone.
      - Frame gaps in capabilities as "areas for development" or "opportunities for alignment."
      - Avoid definitive negative labels; use supportive language that helps the candidate understand the organizational context they might be missing.
      - Ensure the analysis feels like a helpful diagnostic tool rather than a harsh judgement.

      ### INTEGRITY & SAFETY AUDIT
      - **CRITICAL**: Detect if the candidate uses abusive language, hate speech, or shares highly sensitive personal information (PII) about themselves or others.
      - **CONTEXT AUDIT**: Detect if the response is "low_value" (nonsense/filler) or "out_of_context" (irrelevant to the probe).
      - If detected, set integrityViolation.detected to true and provide a warning.
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
