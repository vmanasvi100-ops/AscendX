
import type { VoiceGenderPreference, VoiceTone } from "../types";

// ── Voice selection — honest about what this actually is ──────────────────────
// The Web Speech API's SpeechSynthesisVoice exposes a name and a language, never a real
// gender field. "Male"/"female" here is a heuristic match against common voice names shipped
// by browsers/OSes (Samantha, Karen, Daniel, Alex, etc.) — it will be wrong for some voices,
// miss others entirely, and varies by platform. This is a best-effort preference match, not a
// guarantee, and is never presented to the candidate as more precise than that.

const FEMALE_NAME_HINTS = [
  'female', 'samantha', 'karen', 'victoria', 'susan', 'zira', 'moira', 'tessa', 'fiona',
  'allison', 'ava', 'kate', 'serena', 'nicky', 'amelie', 'anna', 'kathy', 'veena', 'amira',
];
const MALE_NAME_HINTS = [
  'male', 'daniel', 'alex', 'fred', 'david', 'tom', 'james', 'oliver', 'george', 'rishi',
  'aaron', 'arthur', 'gordon', 'diego', 'jorge', 'thomas', 'xander',
];

const matchesHint = (name: string, hints: string[]) => {
  const lower = name.toLowerCase();
  return hints.some(h => lower.includes(h));
};

// The OS/browser's own naming convention for a voice built on a better (less robotic) engine —
// e.g. macOS/iOS ship both a default compact voice and an optional higher-quality one per name
// ("Daniel" vs "Daniel (Enhanced)" / "Siri Voice"-grade ones). There's no real quality field on
// SpeechSynthesisVoice, so this is a name-string heuristic like the gender hints above — best
// effort, not guaranteed to exist on every platform.
const QUALITY_HINTS = ['premium', 'enhanced', 'neural', 'siri'];
const isHigherQuality = (name: string) => matchesHint(name, QUALITY_HINTS);

export const pickVoice = (
  voices: SpeechSynthesisVoice[],
  preference: VoiceGenderPreference
): SpeechSynthesisVoice | null => {
  if (voices.length === 0) return null;

  // UK accent, requested directly: prefer British English voices over the system's default
  // locale, and within those, prefer a higher-quality one over the plain default — the previous
  // behavior (just grabbing whatever v.default was) is usually the OS's lowest-quality, most
  // robotic-sounding compact voice, which is most of why this "sounded very bad."
  const ukVoices = voices.filter(v => v.lang.toLowerCase().startsWith('en-gb'));
  const englishVoices = voices.filter(v => v.lang.toLowerCase().startsWith('en'));
  const basePool = ukVoices.length > 0 ? ukVoices : (englishVoices.length > 0 ? englishVoices : voices);
  const pool = [...basePool].sort((a, b) => Number(isHigherQuality(b.name)) - Number(isHigherQuality(a.name)));

  if (preference === 'any') return pool[0] ?? voices[0];

  const hints = preference === 'female' ? FEMALE_NAME_HINTS : MALE_NAME_HINTS;
  const match = pool.find(v => matchesHint(v.name, hints));
  // No confident match for the requested gender within the UK/English pool — fall back to the
  // best-quality voice in that pool rather than guessing wrong with false confidence.
  return match ?? pool[0] ?? null;
};

// Tone is applied via rate/pitch, since SpeechSynthesisUtterance has no real "warmth" control —
// this is a coarse approximation, not an expressive TTS model. 'warm' is slightly slower with a
// touch more pitch variation (closer to a relaxed, unhurried register); 'direct' is closer to
// neutral, unhurried-but-brisk delivery. Keep this modest — the bigger lever for "warm vs
// direct" is the actual wording the AI writes (see services/talkItThrough.ts's persona
// instruction), not synthetic pitch tweaking.
export const applyToneToUtterance = (utterance: SpeechSynthesisUtterance, tone: VoiceTone, baseRate: number) => {
  if (tone === 'warm') {
    utterance.rate = baseRate * 0.95;
    utterance.pitch = 1.05;
  } else {
    utterance.rate = baseRate * 1.05;
    utterance.pitch = 1.0;
  }
};

// ── The tutor's persona — grounded in real (if informal) sources, named here rather than
// claimed vaguely. Informed by HR/candidate-experience practitioner writing on empathetic,
// transparent, structured-fair communication, and separately by guidance on active-listening
// verbal behavior in interviews: brief acknowledgments ("I see," "that makes sense"),
// deliberate pauses instead of interrupting, paraphrasing back to confirm understanding, and
// withholding judgment. These are practitioner sources, not peer-reviewed research — describe
// this as "informed by," never "validated" or "proven," consistent with how every other
// research-adjacent design choice in this codebase is described (see FRAMEWORK.md).
export const HR_PERSONA_INSTRUCTION = `Speak like a genuinely good, experienced HR professional conducting a supportive, structured conversation — not a chatbot, not a script, and not an anxious over-checker. Warm, kind, professional, and unhurried — but a real problem-solver, not just a mirror. Open with a brief, natural acknowledgment — rotate naturally between options like "okay," "I hear you," "I understand," "I completely get that," "that makes sense," "right," "got it" — and never open two turns in a row with the same one, and never reuse your own exact previous wording; real people don't say the identical phrase every time. If the candidate has already stated their problem clearly — what it is AND why — don't ask "is that right?" or "is this what's confusing you?": a short acknowledgment is enough, then move straight into helping. Save a confirming question for when something is genuinely ambiguous, not as a default habit. When you reflect something back, paraphrase briefly in your own words rather than repeating their words verbatim or padding it into a question. Especially for someone early in their career or new to a field who feels they lack relevant experience: don't dwell on the gap — quickly help them build a short, simple storyline around what they do bring (transferable skills, projects, coursework, volunteering) so introducing themselves feels natural rather than like something to apologise for. Stay even and non-judgmental regardless of what they say, and stay strictly on interview coaching — never drift into other topics. Be consistent and fair — the same patience and respect regardless of how the candidate is doing.`;
