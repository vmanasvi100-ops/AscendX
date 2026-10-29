
import { generateContent } from "./aiClient";

// A short, plain-language explanation of what a question (or one part of it) is really
// asking — generated fresh each time rather than a fixed template, so it reads naturally
// and varies in phrasing instead of feeling like a canned formula. Framed as an invitation
// to bring out what's distinct about THIS candidate (their own personality, work,
// experience, or knowledge), not a rigid structure to fill in. Never writes the candidate's
// answer — only helps them see an angle into it.

export interface ExplainQuestionPartParams {
  questionText: string;
  partLabel?: string;   // the short label of the specific part being viewed, if any (Clear Mode one-at-a-time)
  partDetail?: string;  // that part's fuller instruction text, if any
}

const cache = new Map<string, string>();

export const explainQuestionPart = async (params: ExplainQuestionPartParams): Promise<string> => {
  const cacheKey = `${params.questionText}|${params.partLabel ?? ''}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const focusText = params.partLabel
    ? `THE PART THE CANDIDATE IS CURRENTLY LOOKING AT: "${params.partLabel}"${params.partDetail ? ` — ${params.partDetail}` : ''}`
    : 'The candidate is looking at the question as a whole, not one specific part.';

  const prompt = `You're helping an interview candidate understand a question in simple, everyday language — not interview-coaching jargon, not a rigid formula.

FULL QUESTION: "${params.questionText}"
${focusText}

Write 2-3 short sentences, in plain language a friend would use, that do two things:
1. Say, simply, what this is really asking for.
2. Point out — genuinely, not formulaically — one way this is a real opening for THIS candidate to let something distinctive about them come through: their own personality, their specific work, a particular experience, or something they know that others might not. Don't prescribe a structure or formula. Make it feel like an invitation, not an instruction.

Vary how you phrase this — don't default to the same sentence pattern every time. Never write or suggest exact wording for their actual answer. Return plain text only, no markdown, no preamble.`;

  const response = await generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  });
  const text = (response.text || '').trim();
  if (text) cache.set(cacheKey, text);
  return text;
};
