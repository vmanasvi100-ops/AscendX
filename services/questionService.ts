
import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const generateInitialQuestions = async (
  jobDescription: string,
  companyName: string,
  targetRole: string,
  companyLink?: string
): Promise<Question[]> => {
  const model = "gemini-3-flash-preview";

  const response = await ai.models.generateContent({
    model,
    contents: `
      Generate 5 interview questions based on the following professional context.
      The questions MUST follow a progression of difficulty:
      1. Question 1: Easy/Basic (e.g., "Tell me about yourself" or "Why this company?")
      2. Question 2: Easy/Behavioral (Basic STAR scenario)
      3. Question 3: Medium (Role-specific technical or situational)
      4. Question 4: Medium (Complex behavioral scenario)
      5. Question 5: Hard (Strategic, high-stakes, or complex problem-solving)

      Each question should follow the STAR (Situation, Task, Action, Result) framework and be tailored to the specific company and role.
      
      ### CONTEXT
      Company: ${companyName}
      Target Role: ${targetRole}
      JD Link: ${companyLink || "N/A"}
      Job Description: ${jobDescription}
      
      ### OUTPUT FORMAT
      Return a JSON array of Question objects.
      Each Question object must have:
      - text: The interview question.
      - keywords: A list of 5-8 relevant professional keywords.
      - difficulty: One of "easy", "medium", "hard".
      - requirements: A list of 4 STAR requirements (Situation, Task, Action, Result) with linked keywords.
    `,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING },
            difficulty: { type: Type.STRING, enum: ["easy", "medium", "hard"] },
            keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
            requirements: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  text: { type: Type.STRING },
                  linkedKeywords: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["id", "text", "linkedKeywords"]
              }
            }
          },
          required: ["text", "difficulty", "keywords", "requirements"]
        }
      }
    }
  });

  try {
    return JSON.parse(response.text || "[]");
  } catch (err) {
    console.error("Failed to parse generated questions:", err);
    return [];
  }
};
