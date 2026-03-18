
import { GoogleGenAI } from "@google/genai";
import { Question } from "../types";

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || "";
  return new GoogleGenAI({ apiKey });
};

export const generateInitialQuestions = async (
  jobDescription: string,
  companyName: string,
  targetRole: string,
  companyLink?: string
): Promise<Question[]> => {
  const ai = getAI();

  const prompt = `
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
      Return a JSON array of exactly 5 Question objects.
      Each Question MUST have EXACTLY 4 requirements — one for each STAR phase, in this exact order:
      1. Situation (id ends with "-s")
      2. Task (id ends with "-t")  
      3. Action (id ends with "-a")
      4. Result (id ends with "-r")
      
      Do NOT return fewer than 4 requirements. Every question must have all four.
      
      Each Question object must match this exact structure:
      {
        "text": "Full interview question text",
        "keywords": ["keyword1", "keyword2", "keyword3"],
        "difficulty": "easy" | "medium" | "hard",
        "requirements": [
          { "id": "q1-s", "text": "Situation: [specific situation prompt for this question]", "linkedKeywords": ["keyword1"] },
          { "id": "q1-t", "text": "Task: [specific task prompt for this question]", "linkedKeywords": ["keyword2"] },
          { "id": "q1-a", "text": "Action: [specific action prompt for this question]", "linkedKeywords": ["keyword3"] },
          { "id": "q1-r", "text": "Result: [specific result prompt for this question]", "linkedKeywords": ["keyword1", "keyword2"] }
        ]
      }
    `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: { responseMimeType: "application/json" },
  });

  try {
    const questions: Question[] = JSON.parse(response.text || "[]");

    // Safety net: guarantee every question has all 4 STAR requirements
    const STAR_DEFAULTS = [
      { suffix: 's', label: 'Situation', fallback: 'Situation: Describe the context and background of the scenario.' },
      { suffix: 't', label: 'Task',      fallback: 'Task: Explain your specific responsibility in that situation.' },
      { suffix: 'a', label: 'Action',    fallback: 'Action: Detail the exact steps you took to address the challenge.' },
      { suffix: 'r', label: 'Result',    fallback: 'Result: Share the measurable outcome and what you learned.' },
    ];

    return questions.map((q, qi) => {
      const reqs = q.requirements || [];
      const padded = STAR_DEFAULTS.map((star, i) => {
        const existing = reqs[i];
        if (existing) return existing;
        return {
          id: `q${qi + 1}-${star.suffix}`,
          text: star.fallback,
          linkedKeywords: q.keywords?.slice(0, 1) || [],
        };
      });
      return { ...q, requirements: padded };
    });
  } catch (err) {
    console.error("Failed to parse generated questions:", err);
    return [];
  }
};
