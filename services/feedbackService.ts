
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
      You are an expert Interview Auditor. Generate a high-fidelity performance summary and actionable feedback based on the following interview transcript, job requirements, and candidate's CV.
      
      ### CONTEXT (RAG-like high-quality context)
      Job Requirements: ${jobRequirements}
      Candidate CV: ${cvText || "N/A"}
      Interview Transcript: ${transcript}
      Probing Pipeline Analysis (if available): ${probeAnalysis || "N/A"}
      
      ### INSTRUCTIONS
      1. **Empty Transcript Handling**: If the transcript is empty or contains only noise/filler words with no substance, return a response indicating that no interview data was found.
      2. **Performance Summary**: Synthesize a detailed summary highlighting strengths and weaknesses.
      3. **STAR Analysis**: Break down the candidate's responses using the STAR (Situation, Task, Action, Result) framework.
      4. **Keyword Coverage**: Identify key technical and behavioral keywords from the job requirements that were mentioned or missed.
      5. **Triarchic Merit Alignment**: Analyze the candidate's performance across three dimensions:
          - **Analytical**: Ability to solve problems, analyze data, and apply logic.
          - **Creative**: Ability to innovate, think outside the box, and adapt to new situations.
          - **Practical**: Ability to execute tasks, manage stakeholders, and deliver results.
          - **Correlation Note**: Specifically note how the interview performance correlates with the claims made in the CV and the requirements of the JD.
      6. **SDT Merit Vectoring (Self-Determination Theory)**: Recalculate the candidate's Merit Vectors based on their verbal performance:
          - **Autonomy**: Demonstrated agency and ownership.
          - **Competence**: Demonstrated mastery and technical depth.
          - **Relatedness**: Demonstrated stakeholder alignment and interpersonal logic.
      7. **Strict Relevance Audit**: If the transcript is "low_value" (nonsense/filler) or "out_of_context" (irrelevant to the job/interview), DO NOT attempt to find professional value in it. Label it as "low_value" or "out_of_context" in the integrityViolation field.
      7. **No Hallucinations**: If the response holds no value, do not hallucinate a score or a positive interpretation in the STAR analysis or rubrics. Be honest about the lack of professional substance.
      8. **Redirection to Organizational Constructs**: In the actionableSuggestions, provide clear guidance on how to align with professional standards and organizational expectations, even if the candidate failed to do so in the interview.
      9. **Rubrics**: Score (0-100) for fluency, technical correctness, confidence, and cultural alignment.
      10. **Actionable Feedback**: Highlight flaws (e.g., lack of confidence, filler words) and provide precise, actionable suggestions for remediation.
      11. **Bias & Fairness**: Address potential variations in feedback quality across accents or cultural norms.
      12. **Few-Shot Exemplars**:
         - Good Feedback: "Your explanation of React hooks was technically sound. To further elevate your delivery, consider pausing for 2 seconds before answering; this will help you minimize filler words and project even greater confidence."
         - Bad Feedback: "You failed to answer correctly and used too many filler words."
      13. **Career Development**: Suggest specific certifications and concrete next steps.
      14. **Integrity & Safety Audit**: 
          - **CRITICAL**: Detect if the candidate uses abusive language, hate speech, or shares highly sensitive personal information (PII) about themselves or others (e.g., passwords, specific bank details, private addresses, or derogatory remarks about specific individuals).
          - **CONTEXT AUDIT**: Detect if the response is "low_value" (nonsense/filler) or "out_of_context" (irrelevant to the job).
          - If detected, set integrityViolation.detected to true and provide a firm but professional warning in integrityViolation.note.
          - **REDACTION**: In the performanceSummary, starAnalysis, and maskedTranscript fields, you MUST replace any detected sensitive information (passwords, PII, etc.) with asterisks (e.g., "the password was **").
      15. **Masked Transcript**: Provide a full version of the interview transcript where all sensitive information and abusive language have been redacted using asterisks (**).
      16. **Tone & Psychological Safety**: 
          - Maintain a professional, constructive, and highly encouraging tone. 
          - **CRITICAL**: Never use demotivating language like "you failed," "poor performance," or "unqualified."
          - Instead of saying "You failed to mention X," say "There is an opportunity to further strengthen your response by incorporating X."
          - Frame gaps as "growth areas" or "opportunities for refinement."
          - Ensure the candidate feels psychologically safe and empowered to improve, rather than judged.
          - The goal is to engage them with the platform by providing honest but supportive feedback.
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
