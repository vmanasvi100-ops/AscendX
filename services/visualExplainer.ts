
import { Type } from "@google/genai";
import { generateContent } from "./aiClient";

// ── Explain It Visually — Tier 1 (in-browser SVG/CSS templates) + Tier 2 (caching) only ──
// No video generation (Tier 3) — deliberately out of scope, per the source design's own cost
// control: "Do not generate a fresh video for every request." The AI writes a storyboard
// (structured text, 4-6 scenes) ONCE per question, code validates it, and the player renders
// it with fixed templates. Every viewer of the same question sees the same cached storyboard.
//
// Privacy: the storyboard is generated from the question text (and its already-public
// decoded parts) ONLY — no CV, transcript, or candidate-identifying data is ever part of this
// prompt. This explains the question, never the candidate's answer to it.

export type VisualTemplate =
  | 'question_card' | 'split_into_parts' | 'structure_flow'
  | 'highlight_example' | 'empty_structure' | 'slip_and_fix';

export interface ExplainerScene {
  sceneId: string;
  title: string;
  narration: string;
  visualTemplate: VisualTemplate;
  durationSeconds: number;
  // Only populated on the highlight_example scene — the same fictional example as the
  // narration, broken into the three structure_flow steps, so the player can show it visually
  // mapped onto the shape (not just as a paragraph of prose).
  exampleBreakdown?: { context: string; action: string; result: string };
}

export interface ExplainerStoryboard {
  scenes: ExplainerScene[];
  source: 'generated' | 'fallback';
}

const MAX_NARRATION_WORDS = 30;
const MIN_SCENES = 4;
const MAX_SCENES = 6;
const MAX_TOTAL_SECONDS = 90;

const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

const NOT_ASSESSED_JARGON = [
  /\bSTAR\b/i, /\bSDT\b/i, /\bCHC\b/i, /\bZPD\b/i, /\bAMO\b/i, /\brubric\b/i,
  /\bcompetency level\b/i, /\bscore\b/i, /\/\d+\b/, // fractions like "3/5"
];

const isValidStoryboard = (board: Partial<ExplainerStoryboard>, requirementLabels: string[]): boolean => {
  const scenes = board.scenes;
  if (!Array.isArray(scenes) || scenes.length < MIN_SCENES || scenes.length > MAX_SCENES) return false;
  let total = 0;
  for (const scene of scenes) {
    if (!scene.narration || wordCount(scene.narration) > MAX_NARRATION_WORDS) return false;
    if (NOT_ASSESSED_JARGON.some(p => p.test(scene.narration) || p.test(scene.title))) return false;
    total += scene.durationSeconds || 0;
  }
  if (total > MAX_TOTAL_SECONDS) return false;
  // Scene 2 (split_into_parts) should at least gesture at the real decoded parts — a soft
  // check (not exact-match, since the AI paraphrases), but if NONE of the part labels appear
  // anywhere in that scene, treat the storyboard as not actually explaining this question.
  const partsScene = scenes.find(s => s.visualTemplate === 'split_into_parts');
  if (partsScene && requirementLabels.length > 0) {
    const text = (partsScene.narration + ' ' + partsScene.title).toLowerCase();
    const anyMatch = requirementLabels.some(label => text.includes(label.toLowerCase().slice(0, 6)));
    if (!anyMatch) return false;
  }
  return true;
};

const fallbackStoryboard = (questionText: string): ExplainerStoryboard => ({
  source: 'fallback',
  scenes: [
    { sceneId: 's1', title: 'The question', narration: `Here's the question: "${questionText}"`, visualTemplate: 'question_card', durationSeconds: 8 },
    { sceneId: 's2', title: 'What it asks', narration: 'Most questions like this want to know what you did, why, and what happened as a result.', visualTemplate: 'split_into_parts', durationSeconds: 10 },
    { sceneId: 's3', title: 'A simple shape', narration: 'Set the scene briefly, say what you did, then say what changed because of it.', visualTemplate: 'structure_flow', durationSeconds: 10 },
    {
      sceneId: 's4', title: 'A quick example', visualTemplate: 'highlight_example', durationSeconds: 12,
      narration: 'For example: a volunteer noticed the sign-up sheet was confusing people, redesigned it in an evening, and sign-ups doubled the next week.',
      exampleBreakdown: {
        context: 'The sign-up sheet was confusing people.',
        action: 'Redesigned it in an evening.',
        result: 'Sign-ups doubled the next week.',
      },
    },
    { sceneId: 's5', title: 'Your turn', narration: 'Think of one specific moment from your own experience that fits this shape.', visualTemplate: 'empty_structure', durationSeconds: 8 },
  ],
});

const cache = new Map<string, ExplainerStoryboard>();

export const getStoryboard = async (
  questionText: string,
  requirements: { text: string }[]
): Promise<ExplainerStoryboard> => {
  const cached = cache.get(questionText);
  if (cached) return cached;

  const requirementLabels = requirements.map(r => r.text.split(':')[0]?.trim()).filter(Boolean);

  try {
    const response = await generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{
        role: 'user', parts: [{
          text: `Write a short visual-explainer storyboard for an interview candidate, breaking down what this question is really asking. 4 to 6 scenes, plain everyday language, calm and neutral tone — no jargon, no scores, no framework names.

QUESTION: "${questionText}"
ITS PARTS (for reference, paraphrase don't quote verbatim): ${requirementLabels.join(', ') || 'none'}

Scene requirements, in this order:
1. question_card — the question itself, shown plainly.
2. split_into_parts — break the question into what it's really asking for, referencing the parts above in your own words.
3. structure_flow — a simple shape for how an answer could be built (e.g. context, what you did, what changed).
4. highlight_example — a short FICTIONAL example, in a generic setting unrelated to any common candidate field, illustrating the shape — never something a real candidate could copy as their own answer. ALSO provide exampleBreakdown: the same example split into its context/action/result pieces (each under 12 words) so it can be shown visually mapped onto the shape from scene 3, not just as a paragraph.
5. empty_structure — invite the candidate to think of their own real example using the same shape.
6. (optional) slip_and_fix — one common, neutral, non-judgemental mistake and how to avoid it.

Each scene needs: sceneId, title (max 6 words), narration (max 30 words, plain spoken language), visualTemplate (one of: question_card, split_into_parts, structure_flow, highlight_example, empty_structure, slip_and_fix), durationSeconds (realistic for the narration length, 6-15). The highlight_example scene additionally needs exampleBreakdown: { context, action, result }.

Total runtime across all scenes must stay under 90 seconds. Never write or imply what the candidate's own answer should specifically say. Return JSON only.`
        }]
      }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            scenes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  sceneId: { type: Type.STRING },
                  title: { type: Type.STRING },
                  narration: { type: Type.STRING },
                  visualTemplate: { type: Type.STRING, enum: ['question_card', 'split_into_parts', 'structure_flow', 'highlight_example', 'empty_structure', 'slip_and_fix'] },
                  durationSeconds: { type: Type.INTEGER },
                  exampleBreakdown: {
                    type: Type.OBJECT,
                    nullable: true,
                    properties: {
                      context: { type: Type.STRING },
                      action: { type: Type.STRING },
                      result: { type: Type.STRING },
                    },
                    required: ['context', 'action', 'result'],
                  },
                },
                required: ['sceneId', 'title', 'narration', 'visualTemplate', 'durationSeconds'],
              },
            },
          },
          required: ['scenes'],
        },
      },
    });
    const parsed = JSON.parse(response.text || '{}');
    if (isValidStoryboard(parsed, requirementLabels)) {
      const board: ExplainerStoryboard = { scenes: parsed.scenes, source: 'generated' };
      cache.set(questionText, board);
      return board;
    }
  } catch (err) {
    console.error('Visual explainer: storyboard generation failed, using fallback:', err);
  }

  const fallback = fallbackStoryboard(questionText);
  cache.set(questionText, fallback);
  return fallback;
};
