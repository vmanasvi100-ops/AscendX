
import { GoogleGenAI } from "@google/genai";
import { Question, JDCVAlignmentAnalysis } from "../types";

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || "";
  return new GoogleGenAI({ apiKey });
};

// Retry with exponential backoff — handles rate limits and transient failures
const withRetry = async <T>(fn: () => Promise<T>, retries = 3, delayMs = 1000): Promise<T> => {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt < retries - 1) {
        await new Promise(r => setTimeout(r, delayMs * Math.pow(2, attempt)));
      } else {
        throw err;
      }
    }
  }
  throw new Error('Max retries exceeded');
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

  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { responseMimeType: "application/json" },
  }));

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

// ── Shared helpers ────────────────────────────────────────────────────────────

const STAR_FALLBACKS = [
  { suffix: 's', fallback: 'Situation: Describe the context and background of the scenario.' },
  { suffix: 't', fallback: 'Task: Explain your specific responsibility in that situation.' },
  { suffix: 'a', fallback: 'Action: Detail the exact steps you took to address the challenge.' },
  { suffix: 'r', fallback: 'Result: Share the measurable outcome and what you learned.' },
];

const isValidReqText = (text: string | undefined): boolean =>
  !!text?.trim() && !text.includes('[') && !text.includes(']');

const padQuestions = (questions: Question[], prefix: string): Question[] =>
  questions.map((q, qi) => {
    const reqs = q.requirements || [];
    const padded = STAR_FALLBACKS.map((star, i) => {
      const existing = reqs[i];
      if (existing && isValidReqText(existing.text)) return existing;
      return { id: `${prefix}${qi + 1}-${star.suffix}`, text: star.fallback, linkedKeywords: q.keywords?.slice(0, 1) || [] };
    });
    return { ...q, requirements: padded };
  });

const parseQuestions = (text: string | null | undefined, prefix: string, label: string): Question[] => {
  try {
    const questions: Question[] = JSON.parse(text || '[]');
    return padQuestions(questions, prefix);
  } catch (err) {
    console.error(`Failed to parse ${label} questions:`, err);
    return [];
  }
};

const STAR_COACHING_RULE = `
Each requirement "text" field must be a specific, actionable coaching prompt tailored to THIS question.
Start with the STAR label (Situation/Task/Action/Result), then tell the candidate exactly what to include.

GOOD example for a question about leading a project under pressure:
  { "id": "q1-s", "text": "Situation: Set the scene — what was the project, the team size, and what made it high-pressure or complex?", "linkedKeywords": ["Leadership"] },
  { "id": "q1-t", "text": "Task: What was your specific mandate? Were you formally leading, or did you step up? What were the success criteria?", "linkedKeywords": ["Ownership"] },
  { "id": "q1-a", "text": "Action: Walk through the exact steps you took — how did you align the team, manage blockers, and keep delivery on track?", "linkedKeywords": ["Delivery"] },
  { "id": "q1-r", "text": "Result: What was the measurable outcome? Include timelines, business impact, or recognition. What changed because of your involvement?", "linkedKeywords": ["Impact"] }

Never use placeholder brackets like [specific prompt here]. Every requirement must be immediately useful to the candidate.`;

// ── JD + CV Alignment ─────────────────────────────────────────────────────────
export const generateJDCVAlignmentQuestions = async (
  jobDescription: string,
  cvText: string,
  targetRole: string,
  companyName: string
): Promise<{ questions: Question[]; analysis: JDCVAlignmentAnalysis | null }> => {
  if (!cvText.trim()) return { questions: [], analysis: null };
  const ai = getAI();
  const prompt = `
    You are a senior occupational psychologist and behavioural interview designer.
    Compare this candidate's CV against the job description for ${targetRole} at ${companyName}.

    ### JOB DESCRIPTION
    ${jobDescription.slice(0, 2000)}

    ### CANDIDATE CV
    ${cvText.slice(0, 2000)}

    ### YOUR TASK
    Return a single JSON object with two keys: "questions" and "analysis".

    "questions": array of exactly 3 interview questions that probe the most critical gaps or unverified claims.
    - Each question must probe one specific gap or claim using STAR
    - Keep questions to 1-2 sentences — natural spoken language
    - Difficulty: medium to hard
    ${STAR_COACHING_RULE}
    Each question object: "text" (the full interview question), "keywords", "difficulty", exactly 4 "requirements" (S/T/A/R). Use ids like "jdcv1-s", "jdcv1-t", "jdcv1-a", "jdcv1-r".

    "analysis": a detailed alignment report with this exact structure:
    {
      "matchScore": <0-100 integer — how well the CV matches the JD overall>,
      "alignmentSummary": "<2-3 sentences summarising overall fit, key strengths, and critical gaps>",
      "strengthAreas": [
        { "area": "<competency name>", "cvEvidence": "<what the CV shows>", "jdRequirement": "<what the JD asks for>" }
      ],
      "gapAreas": [
        { "area": "<competency name>", "jdRequirement": "<what is required>", "suggestion": "<how candidate can address this in interview>" }
      ],
      "experienceAlignment": [
        { "jdRequirement": "<specific JD requirement>", "cvEvidence": "<closest matching CV experience>", "alignmentLevel": "strong" | "partial" | "weak" | "missing" }
      ],
      "keywordAudit": {
        "present": ["<keywords present in both CV and JD>"],
        "missing": ["<keywords in JD but absent from CV>"]
      }
    }

    Return ONLY the JSON object. No markdown, no explanation.
  `;
  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { responseMimeType: 'application/json' }
    }));
    const parsed = JSON.parse(response.text || '{}');
    const questions = parseQuestions(JSON.stringify(parsed.questions || []), 'jdcv', 'JD-CV alignment');
    const analysis: JDCVAlignmentAnalysis | null = parsed.analysis || null;
    return { questions, analysis };
  } catch (err) {
    console.error('Failed to generate JD-CV alignment:', err);
    return { questions: [], analysis: null };
  }
};

// ── CV Competency (experience & achievements) ─────────────────────────────────
export const generateCVCompetencyQuestions = async (
  cvText: string,
  targetRole: string,
  companyName: string
): Promise<Question[]> => {
  if (!cvText.trim()) return [];
  const ai = getAI();
  const prompt = `
    You are a behavioural interview designer. Based on this candidate's CV, generate exactly 3 questions
    that test whether their stated competencies and achievements are genuinely evidenced.

    ### CANDIDATE CV
    ${cvText.slice(0, 3000)}

    ### CONTEXT
    Target Role: ${targetRole} at ${companyName}

    ### INSTRUCTIONS
    - Focus on specific roles, projects, or achievements listed in the CV
    - Each question must probe the depth behind a CV claim — not just repeat it
    - Use STAR format
    - Keep questions to 1-2 sentences — natural spoken language
    - Difficulty: medium to hard

    ### OUTPUT FORMAT
    ${STAR_COACHING_RULE}
    Return a JSON array of 3 Question objects, each with "text" (the full interview question), "keywords", "difficulty", and exactly 4 "requirements" (S/T/A/R). Use ids like "cv1-s", "cv1-t", "cv1-a", "cv1-r".
  `;
  const response = await withRetry(() => ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: [{ role: 'user', parts: [{ text: prompt }] }], config: { responseMimeType: 'application/json' } }));
  return parseQuestions(response.text, 'cv', 'CV competency');
};

// ── JD Understanding ──────────────────────────────────────────────────────────
export const generateJDUnderstandingQuestions = async (
  jobDescription: string,
  targetRole: string,
  companyName: string
): Promise<Question[]> => {
  const ai = getAI();
  const prompt = `
    You are a behavioural interview designer. Based on this job description, generate exactly 3 questions
    that test whether the candidate truly understands what this role demands and why.

    ### JOB DESCRIPTION
    ${jobDescription.slice(0, 2000)}

    ### CONTEXT
    Target Role: ${targetRole} at ${companyName}

    ### INSTRUCTIONS
    - Focus on the core responsibilities, challenges, and expectations in the JD
    - Questions should reveal whether the candidate has thought deeply about what this role involves
    - Use STAR format where applicable (situational or motivational framing)
    - Keep questions to 1-2 sentences — natural spoken language
    - Difficulty: easy to medium

    ### OUTPUT FORMAT
    ${STAR_COACHING_RULE}
    Return a JSON array of 3 Question objects, each with "text" (the full interview question), "keywords", "difficulty", and exactly 4 "requirements" (S/T/A/R). Use ids like "jd1-s", "jd1-t", "jd1-a", "jd1-r".
  `;
  const response = await withRetry(() => ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: [{ role: 'user', parts: [{ text: prompt }] }], config: { responseMimeType: 'application/json' } }));
  return parseQuestions(response.text, 'jd', 'JD understanding');
};
