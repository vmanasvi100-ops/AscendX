
import { Type } from "@google/genai";
import { generateContent } from "./aiClient";
import { HR_PERSONA_INSTRUCTION } from "./voicePersona";
import type { JDCVAlignmentAnalysis } from "../types";

// ── Talk It Through — a clarity tool, not a crisis tool ───────────────────────
// Core purpose: help a candidate who is confused about a specific interview question
// locate where they lost the thread and work out their own way in. It reflects their
// thinking back; it never writes their answer for them.
//
// The AI is kept on a short leash throughout: the stage sequence is owned by code
// (generateTutorTurn is called once per turn, never a freeform multi-turn chat), every
// candidate message passes a distress check AND an on-topic check before any tutor
// response is generated, and every generated tutor message is validated by code before
// it's ever shown. Four gates, three of which are plain code — only the fourth
// (stage-turn generation) touches the model, and even that is checked afterward.
//
// GATE — DO NOT REMOVE WITHOUT REAL REVIEW: LEVEL_3_PATTERNS/LEVEL_2_PATTERNS below were
// written by an AI coding assistant, not a clinician or a wellbeing professional, and have
// not been reviewed by one. This is a hard precondition for exposing this feature to real
// candidates, not a nice-to-have — a crisis-detection keyword list that hasn't been checked
// by someone qualified is not something to ship on good faith. TALK_IT_THROUGH_REVIEWED
// below gates every entry point to this feature until that review has actually happened;
// flip it to true only once it has, with a note of who reviewed it and when.
//
// TEMPORARY — set to true on 2026-10-19 for local dev testing only (founder clicking through
// the Amara-style flow on their own dev server). Not a real review. Must go back to false
// before this is reachable by anyone other than the founder testing locally.
export const TALK_IT_THROUGH_REVIEWED = true;

export type TutorStage = 'listen' | 'locate' | 'explain' | 'try' | 'check';

export type DistressLevel = 1 | 2 | 3;

export interface MessageCheck {
  distressLevel: DistressLevel;
  onTopic: boolean;
}

export interface TutorTurnResult {
  tutorMessage: string;
  readyToAdvance: boolean;
}

export interface ClearPicture {
  whatHappened: string;
  myBestReading: string;
  whereItWentWrong: 'question' | 'starting' | 'organising' | 'finding_example' | 'staying_on_track' | 'follow_up' | 'pressure_and_pace' | 'other';
  whatHelpedBefore: string | null;
  whatWeCouldTry: string[];
  whatImNotSureAbout: string;
}

// ── Fixed, hardcoded responses — never AI-generated, so they can never come out wrong ──

export const LEVEL_3_MESSAGE =
  "I'm really sorry you're feeling this way. This is more than I can help with, and you deserve " +
  "support from a person. In the UK you can call Samaritans free on 116 123 at any time, text " +
  "SHOUT to 85258, or call NHS 111. If you are in immediate danger, call 999. If you're a student, " +
  "your university wellbeing service can also help.";

export const LEVEL_2_SUFFIX =
  "If you'd like, your university careers or wellbeing service is also there to help with this " +
  "kind of pressure — not just interview practice.";

export const offTopicRedirect = (questionText: string): string =>
  `I'm here to help you work through "${questionText}" — let's stay with that. What part of it felt unclear?`;

// ── "No corporate experience" pathway ──────────────────────────────────────────
// A dedicated, opt-in sub-flow for candidates who feel they have nothing relevant to say about
// themselves — separate from, and never interrupting, the normal listen/locate/explain/try/check
// stage machine above. It's offered on a text-pattern trigger (same style as the distress
// patterns above — deterministic, not AI-classified, so the offer itself can never be wrong or
// invasive) and only ever proceeds with the candidate's explicit yes. Everything the candidate
// contributes (their evidence, their introduction) is their own words, captured verbatim; the
// only AI call in this whole pathway is generating candidate-evidence -> job-requirement link
// SUGGESTIONS, which the candidate accepts, edits or rejects individually — nothing is ever
// stated as fact that they didn't confirm.

const EXPERIENCE_GAP_PATTERNS = [
  /no\s+(relevant\s+)?experience/i, /nothing\s+relevant/i, /never\s+worked\s+in/i,
  /don'?t\s+have\s+(a\s+|any\s+)?corporate\s+(background|experience)/i,
  /don'?t\s+know\s+what\s+to\s+say\s+about\s+myself/i, /haven'?t\s+(had\s+)?(much\s+)?(corporate|office|work)\s+experience/i,
  /no\s+office\s+experience/i, /nothing\s+to\s+(talk\s+about|say)/i,
];
export const detectsExperienceGap = (text: string): boolean => EXPERIENCE_GAP_PATTERNS.some(p => p.test(text));

export const EXPERIENCE_GAP_OFFER =
  "It sounds as if the hard part is not having experience that feels relevant to talk about. Would you like to work through that together?";

export interface EvidenceArea {
  id: 'study' | 'projects' | 'work' | 'volunteering' | 'caring' | 'moving' | 'skills';
  label: string;
  question: string;
}

// Fixed, not AI-generated — the spec's own 7 areas and wording, asked one at a time, any skippable.
export const EVIDENCE_AREAS: EvidenceArea[] = [
  { id: 'study', label: 'Study', question: 'What have you studied or worked on that you are proud of?' },
  { id: 'projects', label: 'Projects', question: 'Have you built, organised or finished anything, alone or with others?' },
  { id: 'work', label: 'Part-time or casual work', question: 'Have you had any paid work, even short or unrelated?' },
  { id: 'volunteering', label: 'Volunteering and community', question: 'Have you helped a group, society, place of worship, family business or community?' },
  { id: 'caring', label: 'Caring and family responsibilities', question: 'Have you looked after people, managed a household or supported family?' },
  { id: 'moving', label: 'Moving and adapting', question: 'Have you had to adapt to a new place, language or system?' },
  { id: 'skills', label: 'Skills and interests', question: 'What do you do that others rely on you for?' },
];

export interface EvidenceItem {
  areaId: EvidenceArea['id'];
  text: string; // the candidate's own words, verbatim
}

export interface ExperienceLink {
  area: string;            // which evidence item this draws from (areaId)
  cvEvidence: string;      // quoted back from the candidate's own evidence item, never invented
  jdRequirement: string;   // the role requirement this connects to
  strength: 'solid' | 'weak'; // "weak" links are labelled weak per the spec's honesty rule, never hidden
}

// Generates link SUGGESTIONS only — grounded strictly in the candidate's own evidenceItems and the
// job description text, both passed in full so the model can't invent evidence that wasn't given.
// The candidate accepts, edits or rejects each one individually in the UI; code never displays a
// rejected link, and this function never claims a skill the candidate didn't describe.
export const generateExperienceBridge = async (params: {
  jobDescription: string;
  evidenceItems: EvidenceItem[];
}): Promise<ExperienceLink[]> => {
  if (params.evidenceItems.length === 0 || !params.jobDescription.trim()) return [];

  const evidenceText = params.evidenceItems
    .map(e => `- [${e.areaId}] "${e.text}"`)
    .join('\n');

  const response = await generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{
      role: 'user', parts: [{
        text: `A candidate has described what they've actually done, in their own words, across several life areas. Connect it to a job description — honestly, never inventing or inflating.

CANDIDATE'S OWN EVIDENCE (use ONLY this — never add a skill or experience they didn't state):
${evidenceText}

JOB DESCRIPTION:
${params.jobDescription.slice(0, 2000)}

Produce 3 to 5 links between a specific piece of the candidate's evidence above and a specific requirement from the job description. For each: quote the candidate's evidence back close to their own words (cvEvidence), name the specific role requirement it connects to (jdRequirement), note which area it came from (area — one of: study, projects, work, volunteering, caring, moving, skills), and mark strength as "solid" only if the connection is genuinely direct, otherwise "weak" (a stretch, better framed as a starting point than proven experience — be honest, most of these should probably be "weak" unless the match is clearly strong). Never fabricate a connection that isn't really there.

Return JSON only: an array of objects with area, cvEvidence, jdRequirement, strength.`
      }]
    }],
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            area: { type: Type.STRING },
            cvEvidence: { type: Type.STRING },
            jdRequirement: { type: Type.STRING },
            strength: { type: Type.STRING, enum: ['solid', 'weak'] },
          },
          required: ['area', 'cvEvidence', 'jdRequirement', 'strength'],
        },
      },
    },
  });

  try {
    const parsed = JSON.parse(response.text || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((l: any) => l && typeof l.cvEvidence === 'string' && typeof l.jdRequirement === 'string')
      .slice(0, 5)
      .map((l: any) => ({
        area: String(l.area ?? ''),
        cvEvidence: String(l.cvEvidence),
        jdRequirement: String(l.jdRequirement),
        strength: l.strength === 'solid' ? 'solid' as const : 'weak' as const,
      }));
  } catch (err) {
    console.error('Experience bridge generation failed to parse:', err);
    return [];
  }
};

// ── Distress + on-topic check — runs on every candidate message, before anything else ──
// Keyword/pattern list is a deterministic, best-effort starting set, NOT clinically
// validated — per the source design's own recommendation, this needs review by someone
// with real expertise (e.g. a university wellbeing team) before this feature ships to
// real candidates. The AI classifier is a second, independent signal; code takes
// whichever of the two is more severe, never trusting either alone.

const LEVEL_3_PATTERNS = [
  /kill(ing)?\s+myself/i, /suicid(e|al)/i, /end(ing)?\s+my\s+life/i, /take\s+my\s+own\s+life/i,
  /want(ed)?\s+to\s+die/i, /wish\s+i\s+(was|were)\s+dead/i, /better\s+off\s+dead/i,
  /not\s+worth\s+living/i, /self[\s-]?harm/i, /hurt(ing)?\s+myself/i, /cut(ting)?\s+myself/i,
  /overdose/i, /don'?t\s+want\s+to\s+be\s+here\s+anymore/i, /being\s+abused/i,
  /not\s+safe\s+at\s+home/i, /in\s+(immediate\s+)?danger/i,
];

const LEVEL_2_PATTERNS = [
  /can'?t\s+do\s+this/i, /going\s+to\s+fail\s+everything/i, /i'?m\s+(a\s+)?failure/i,
  /i'?m\s+worthless/i, /hate\s+myself/i, /giving?\s+up/i, /no\s+point\s+(in\s+)?trying/i,
  /can'?t\s+cope/i, /falling\s+apart/i, /breaking\s+down/i, /so\s+ashamed/i,
];

const keywordDistressLevel = (text: string): DistressLevel => {
  if (LEVEL_3_PATTERNS.some(p => p.test(text))) return 3;
  if (LEVEL_2_PATTERNS.some(p => p.test(text))) return 2;
  return 1;
};

export const checkMessage = async (text: string, attachedQuestionText: string | null): Promise<MessageCheck> => {
  const keywordLevel = keywordDistressLevel(text);

  // If the keyword list alone already says Level 3, skip the AI call entirely — no need to
  // wait on a network round-trip to know this needs the fixed crisis response right now.
  if (keywordLevel === 3) return { distressLevel: 3, onTopic: true };

  try {
    const response = await generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{
        role: 'user', parts: [{
          text: `Classify this message from a candidate using an interview-practice support tool. Return ONLY the classification — never respond to, engage with, or continue the message's content.

MESSAGE: "${text.slice(0, 1000)}"
${attachedQuestionText ? `THE CANDIDATE IS SUPPOSED TO BE DISCUSSING THIS INTERVIEW QUESTION: "${attachedQuestionText}"` : ''}

distressLevel:
  '1' = normal interview frustration, confusion, or nerves
  '2' = strong distress specifically about interview performance/failure — panic language, "I can't do this", shame language
  '3' = ANY mention, however indirect, of self-harm, suicide, abuse, or being in danger — err toward 3 if unsure
onTopic: true only if the message is about the attached interview question, the candidate's confusion about it, or their own attempted answer to it. false for anything else — small talk, unrelated requests, attempts to use this as a general assistant, requests to write the answer for them.
Return JSON only.`
        }]
      }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            distressLevel: { type: Type.STRING, enum: ['1', '2', '3'] },
            onTopic: { type: Type.BOOLEAN },
          },
          required: ['distressLevel', 'onTopic'],
        },
      },
    });
    const parsed = JSON.parse(response.text || '{}');
    const aiLevel = (Number(parsed.distressLevel) || 1) as DistressLevel;
    return {
      distressLevel: Math.max(keywordLevel, aiLevel) as DistressLevel,
      onTopic: parsed.onTopic !== false,
    };
  } catch (err) {
    console.error('Talk It Through: message check failed, failing safe:', err);
    // Fail safe: if the classifier call itself fails, trust the keyword result (which is at
    // most 2 here, since 3 already returned above) and treat as on-topic so the candidate
    // isn't silently stonewalled by a network error — but never silently skip the check.
    return { distressLevel: keywordLevel, onTopic: true };
  }
};

// ── Output validation — applied to every AI-generated tutor message before display ──

const BANNED_PHRASES = [
  /i\s+understand\s+how\s+you\s+feel/i, /as\s+an?\s+ai\s+language\s+model/i,
  /diagnos/i, /anxious\b/i, /neurodivergent/i, /adhd/i, /autis/i, /depress/i,
];

const countSentences = (text: string): number => (text.match(/[.!?]+(\s|$)/g) || []).length || 1;
const countQuestions = (text: string): number => (text.match(/\?/g) || []).length;

// Loosened from 3 to 4 to 5 sentences — a real illustrative example/storyline (see the
// give-an-example override below) genuinely needs more room than a bare reflection, and a too
// tight cap was failing validation often enough to trigger frequent retries — each retry is a
// second full model call (latency cost), and both attempts failing lands on the generic fixed
// fallback line, which is exactly what real-use feedback described as "it just keeps repeating
// the same question."
const isValidTutorMessage = (text: string): boolean => {
  if (!text.trim()) return false;
  if (countSentences(text) > 5) return false;
  if (countQuestions(text) > 1) return false;
  if (BANNED_PHRASES.some(p => p.test(text))) return false;
  return true;
};

// Shown only when both the normal and strict-retry model calls fail validation or error — code
// never displays an unvalidated AI message. Several variants, picked at random, so that on the
// (hopefully rare) occasion this does fire more than once in a conversation, the candidate isn't
// staring at the exact same sentence twice — that literal repetition was itself part of the "it
// keeps repeating the same question" complaint, even though this fallback is a tiny fraction of
// turns. Fixing the underlying prompt issue (below) matters far more than this; this is a backstop.
const FALLBACK_LINES = [
  "I want to make sure I'm helping with the right thing — what part of this feels stuck right now?",
  "Let's slow down for a second — what's the bit that's actually tripping you up here?",
  "Okay — just so I point you the right way, what feels hardest about this part?",
];
const pickFallbackLine = () => FALLBACK_LINES[Math.floor(Math.random() * FALLBACK_LINES.length)];

// ── Stage-turn generation — one schema-constrained call per turn, code owns the sequence ──

// What Talk It Through is allowed to know about the candidate's real CV/JD — deliberately a thin
// slice of JDCVAlignmentAnalysis, not the raw CV text. Two reasons: (1) by the time a candidate is
// using Talk It Through, raw cvText has usually already been wiped from app state as a privacy
// measure right after question generation (see WelcomeScreen.tsx) — this analysis is the one
// thing from that pipeline that's deliberately kept around; reusing it means no re-upload, re-parse,
// or extra AI call is needed here, it was already computed once, at upload time. (2) gapAreas is
// left out on purpose — this is a confidence/clarity tool, not a gap-audit tool, and feeding the
// model "here's what's missing from their CV" risked the tutor leaning on deficits instead of
// strengths when building an example, which is the opposite of the intent.
export interface TalkItThroughCandidateBackground {
  jobDescription: string | null;
  targetRole: string | null;
  companyName: string | null;
  alignmentSummary: string | null;
  strengthAreas: Pick<JDCVAlignmentAnalysis['strengthAreas'][number], 'area' | 'cvEvidence' | 'jdRequirement'>[] | null;
}

export interface GenerateTutorTurnParams {
  stage: TutorStage;
  questionText: string;
  history: { speaker: 'candidate' | 'tutor'; text: string }[];
  latestCandidateMessage: string;
  distressLevel: DistressLevel; // 1 or 2 only — checkMessage already intercepted 3 before this is called
  candidateBackground?: TalkItThroughCandidateBackground | null;
}

// Note on hedging: "it may be"/"it looks as if" applies to reading the candidate's internal
// state or reasons (that's genuinely a guess) — NOT to the coaching advice itself. Interview
// coaching technique (e.g. reframing limited corporate experience around transferable skills) is
// real expert knowledge the tutor can and should state with confidence. Conflating the two was
// part of why early versions sounded like endless "am I right?" checking instead of actual coaching.
const STAGE_INSTRUCTIONS: Record<TutorStage, string> = {
  listen: `If the candidate's message ALREADY makes both the problem and the reason clear (e.g. "I don't know how to introduce myself because I haven't had much corporate experience" — that's self-contained, nothing ambiguous), don't ask "did I get this right?" at all — just a short, warm, natural acknowledgment ("okay, that makes sense" / "I hear you") and move straight to explain, setting readyToAdvance true. Only if something is genuinely unclear, turn what they shared into a short natural narrative (1 sentence) and ask one brief confirming question.`,
  locate: `Only reached if listen genuinely needed to ask something. If the candidate's latest message ALREADY makes clear where it went wrong (the question itself, the start, the middle, a follow-up, or the pressure of the moment) — even though you asked about it, people often answer more than what was asked — do not ask the locate question again or a reworded version of it. Acknowledge briefly and move straight to coaching, setting readyToAdvance true. Only if it is still genuinely unclear after their answer, ask exactly ONE question to find where it went wrong. Nothing else.`,
  explain: `This is the actual coaching moment — act like an experienced HR professional who immediately understands the problem and solves it, not someone still checking they understood. Don't ask "is this what's confusing you?" — they already told you. Give concrete, confident coaching: name the real technique that addresses their specific situation (e.g. if they lack corporate experience, the move is reframing around TRANSFERABLE SKILLS — name what that looks like for them specifically). Tie it to their own words. If a candidate background is given above, this is the stage to actually use it — name a specific piece of their real evidence and the specific job requirement it connects to, not a generic technique in the abstract; that's what makes this feel like it's actually about them rather than interview advice in general. You may hedge your read of how they feel ("it may be"/"it looks as if"), but state the coaching advice itself plainly and with confidence — that part isn't a guess.`,
  try: `Offer ONE small, concrete thing to try right now, grounded in the coaching just given — never write their answer for them, only a starting point or narrower focus. If a candidate background with real evidence is given above, prefer building this as an actual short interview-style QUESTION drawn directly from one of their real pieces of evidence — not a hypothetical person's story, something genuinely about what THEY did (e.g. "Tell me about a specific moment from that SQL dashboard project — what was the hardest part of making sense of the data?"), so they're practising on real material instead of an abstraction. If they attempt it, reflect what they produced back to them (do not rewrite or correct it) and you may ask one short follow-up.`,
  check: `Ask, in one sentence, whether what you've understood matches their experience.`,
};

export const generateTutorTurn = async (params: GenerateTutorTurnParams): Promise<TutorTurnResult> => {
  const historyText = params.history.map(h => `${h.speaker === 'tutor' ? 'Tutor' : 'Candidate'}: ${h.text}`).join('\n');
  const distressFrame = params.distressLevel === 2
    ? `\nThe candidate is under real strain right now. Slow down. Keep this turn gentle and brief. Do not push toward the next stage.`
    : '';

  const lastTutorTurn = [...params.history].reverse().find(h => h.speaker === 'tutor')?.text ?? null;
  const repetitionGuard = lastTutorTurn
    ? `\nYOUR OWN LAST TURN WAS: "${lastTutorTurn}" — do not repeat this almost verbatim, and open this turn with a different acknowledgment than last time.`
    : '';

  // Grounds examples in the candidate's own real CV/JD when it's available (see
  // TalkItThroughCandidateBackground above for why this is a thin slice, not the raw CV) — pulled
  // from the one-time alignment analysis computed at upload, never re-derived here. Strictly
  // optional: most of the prompt already works fine with none of this, so a candidate who skipped
  // CV upload, or whose session predates this, gets the same generic-example behavior as before.
  const bg = params.candidateBackground;
  const backgroundBlock = bg && (bg.alignmentSummary || (bg.strengthAreas && bg.strengthAreas.length > 0) || bg.jobDescription)
    ? `\nCANDIDATE'S REAL BACKGROUND (from their own uploaded CV and the actual job description — this is the ONLY real information you have about their background; use it to make any example genuinely theirs, not a generic placeholder, but treat it as a hard boundary: state only what's given here, never infer, extrapolate, or invent a single specific beyond it):
${bg.companyName || bg.targetRole ? `Applying for: ${[bg.targetRole, bg.companyName].filter(Boolean).join(' at ')}\n` : ''}${bg.alignmentSummary ? `Overall fit: ${bg.alignmentSummary.slice(0, 400)}\n` : ''}${bg.strengthAreas && bg.strengthAreas.length > 0 ? `Their real strengths (CV evidence → what the job needs):\n${bg.strengthAreas.slice(0, 3).map(s => `- ${s.area}: ${s.cvEvidence.slice(0, 150)} → ${s.jdRequirement.slice(0, 150)}`).join('\n')}\n` : ''}`
    : '';

  const buildPrompt = (strict: boolean) => `You are an AI tutor helping a candidate who is confused about a specific interview question. You are NOT a therapist, NOT a human, and you NEVER write their answer for them — you only help them find their own way into it.

PERSONA: ${HR_PERSONA_INSTRUCTION}

INTERVIEW QUESTION THEY ARE PRACTISING: "${params.questionText}"

CONVERSATION SO FAR:
${historyText || '(start of conversation)'}

CANDIDATE'S LATEST MESSAGE: "${params.latestCandidateMessage}"

CURRENT STAGE: ${params.stage}
STAGE INSTRUCTION: ${STAGE_INSTRUCTIONS[params.stage]}
${distressFrame}
${repetitionGuard}
${backgroundBlock}

OVERRIDE A — applies no matter what stage you're in: if the candidate is directly asking for an
example, a way to start, a sample storyline, or anything like "give me a real example", "can you
show me", "I don't know what example to use", or "I don't have experience to give an example" —
STOP asking questions. Do not ask another clarifying question and do not repeat something you've
already said. Instead, immediately give ONE short, concrete illustrative example or storyline (2-4
sentences) they could adapt.${backgroundBlock ? ` A candidate background is given above — ground the example in THEIR real strengths and THIS actual job whenever it genuinely fits (e.g. "given your project work on X, you could frame it as..."), rather than a generic placeholder. Never invent specifics about them beyond what's given above, and don't force a fit that isn't there — if nothing above genuinely applies to this question, fall back to a generic example instead of stretching their background to match.` : ` Clearly frame it as an example ("for example, someone might..."), never written as if it were their actual answer. If they seem to have little or no directly relevant experience, build that example around transferable skills, a project, coursework, or volunteering rather than formal experience.`} Keep it a short, simple storyline they can shape into their own, not an elaborate structure. Set readyToAdvance true whenever this override applies.

OVERRIDE B — takes priority over Override A whenever both could apply: if the candidate is
pushing back that a PREVIOUS example wasn't specific or personal enough — anything like "that's
too generic", "something specific to me", "an actual example", "my own experience", "try again",
or asking a second or third time after already getting one fictional "someone might..." example in
this conversation${backgroundBlock ? '' : ' (true here — no real CV background is available for this candidate)'} — STOP inventing another fictional person's story. A second invented vignette
will feel exactly as generic as the first, which is the actual problem they're naming. Instead,
switch to asking them directly for ONE real, concrete thing from their own life — a class project,
a job (any job, even unrelated), volunteering, a hobby, anything they actually did — that you can
build the example around together, in their next turn. One direct question, no invented story this
turn. Set readyToAdvance false (we are not done with this stage yet — we're getting real material
to work with).

EXAMPLE of the right instinct (not a template to copy, just the pattern — get to the point, give real technique, don't just reflect): candidate says "I don't know how to introduce myself because I haven't had much corporate experience." A weak reply asks "is that what's confusing you?" — they already said so. A good reply: "Okay, that's a common spot to get stuck. The move here isn't to apologise for the gap — it's to reframe it: pick two or three transferable skills from whatever experience you do have (uni projects, part-time work, anything) and lead with those instead of leading with what you lack." Direct, confident, and immediately useful.

HARD RULES, NO EXCEPTIONS: at most 4 sentences. At most 1 question. Never say "I understand how you feel" — "that sounds hard" is fine. Never use diagnostic, clinical, or labelling language about the candidate. Never write or suggest exact wording for their interview answer. Never discuss anything other than this question and the candidate's own confusion/attempt. NEVER HALLUCINATE: never state a fact about this specific candidate's background, CV, skills, jobs, or education that is not literally present in CANDIDATE'S REAL BACKGROUND above or in what they themselves said in this conversation — not a plausible guess, not "probably," not filling in a gap. If CANDIDATE'S REAL BACKGROUND is absent, you have no real information about them beyond what they've typed here — speak only in general/hypothetical terms ("someone might...", "a common approach is...") and never assert something as true of THIS candidate specifically.
${strict ? 'Your previous attempt broke one of these rules. Be stricter this time — shorter, plainer, no exceptions.' : ''}

readyToAdvance: true only if the candidate's message shows this stage's goal is met (e.g. for 'locate', true once they've named where it went wrong) — or if the override above applies.

Return JSON only.`;

  for (const strict of [false, true]) {
    try {
      const response = await generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ role: 'user', parts: [{ text: buildPrompt(strict) }] }],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              tutorMessage: { type: Type.STRING },
              readyToAdvance: { type: Type.BOOLEAN },
            },
            required: ['tutorMessage', 'readyToAdvance'],
          },
        },
      });
      const parsed = JSON.parse(response.text || '{}');
      if (isValidTutorMessage(parsed.tutorMessage)) {
        return { tutorMessage: parsed.tutorMessage, readyToAdvance: !!parsed.readyToAdvance };
      }
    } catch (err) {
      console.error(`Talk It Through: turn generation failed (strict=${strict}):`, err);
    }
  }

  // Both attempts failed validation or errored — never show an unvalidated message. Fall back
  // to a safe, fixed, stage-appropriate line instead of guessing.
  return { tutorMessage: pickFallbackLine(), readyToAdvance: false };
};

// ── Clear Picture — generated once, at the end of the Check stage ──

export const generateClearPicture = async (params: {
  questionText: string;
  history: { speaker: 'candidate' | 'tutor'; text: string }[];
  priorSuccessNote: string | null; // pulled from the candidate's own session history, never invented
}): Promise<ClearPicture> => {
  const historyText = params.history.map(h => `${h.speaker === 'tutor' ? 'Tutor' : 'Candidate'}: ${h.text}`).join('\n');
  const response = await generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{
      role: 'user', parts: [{
        text: `Summarise this Talk It Through conversation as a Clear Picture — plain words, no scores, no diagnosis.

INTERVIEW QUESTION: "${params.questionText}"
CONVERSATION:
${historyText}
${params.priorSuccessNote ? `A PRIOR SUCCESSFUL ANSWER FROM THIS CANDIDATE (use only if genuinely relevant, never invent one if this is empty): "${params.priorSuccessNote}"` : ''}

whatHappened: the candidate's own account, in their words.
myBestReading: your interpretation — MUST be hedged ("it may be"/"it looks as if"), never stated as fact.
whereItWentWrong: exactly one of question | starting | organising | finding_example | staying_on_track | follow_up | pressure_and_pace | other.
whatHelpedBefore: a short note referencing the prior success above, or null if none was given.
whatWeCouldTry: 1-3 short, concrete suggestions — never a rewritten answer.
whatImNotSureAbout: always at least one honest line about what you can't tell from this conversation.

Return JSON only.`
      }]
    }],
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          whatHappened: { type: Type.STRING },
          myBestReading: { type: Type.STRING },
          whereItWentWrong: { type: Type.STRING, enum: ['question', 'starting', 'organising', 'finding_example', 'staying_on_track', 'follow_up', 'pressure_and_pace', 'other'] },
          whatHelpedBefore: { type: Type.STRING, nullable: true },
          whatWeCouldTry: { type: Type.ARRAY, items: { type: Type.STRING } },
          whatImNotSureAbout: { type: Type.STRING },
        },
        required: ['whatHappened', 'myBestReading', 'whereItWentWrong', 'whatWeCouldTry', 'whatImNotSureAbout'],
      },
    },
  });
  return JSON.parse(response.text || '{}') as ClearPicture;
};
