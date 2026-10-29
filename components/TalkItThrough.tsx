
import React, { useEffect, useRef, useState } from 'react';
import { Mic, Square, Send, X, AlertTriangle, Volume2, Headphones, RotateCcw } from 'lucide-react';
import { generateContent } from '../services/aiClient';
import { useSettings } from '../context/SettingsContext';
import {
  checkMessage,
  generateTutorTurn,
  generateClearPicture,
  offTopicRedirect,
  detectsExperienceGap,
  EXPERIENCE_GAP_OFFER,
  EVIDENCE_AREAS,
  generateExperienceBridge,
  LEVEL_3_MESSAGE,
  LEVEL_2_SUFFIX,
  type TutorStage,
  type DistressLevel,
  type ClearPicture,
  type EvidenceItem,
  type ExperienceLink,
} from '../services/talkItThrough';
import { pickVoice, applyToneToUtterance } from '../services/voicePersona';
import { getLatestCoachingThreadByParticipant, getLatestCoachingThreadByEmail, saveCoachingThread, markCoachingThreadReviewed, type CoachingThread } from '../services/coachingThread';
import { getLatestCvAlignmentByParticipant, getLatestCvAlignmentByEmail, type StoredCvAlignment } from '../services/cvAlignment';

interface TalkItThroughProps {
  questionText: string;
  onClose: () => void;
  // Optional — only used for cross-session continuity (services/coachingThread.ts). Without an
  // email on file, Talk It Through behaves exactly as before: no review opener, nothing saved.
  email?: string;
}

type Phase =
  | 'opening' | 'conversation' | 'level3_stop' | 'clear_picture'
  // "No corporate experience" pathway (services/talkItThrough.ts) — a separate, opt-in sub-flow,
  // never entered except by explicit candidate "yes" to EXPERIENCE_GAP_OFFER. Does not touch or
  // replace the normal stage machine; declining the offer simply returns to 'conversation'.
  | 'experience_gap_offer' | 'experience_inventory' | 'experience_bridge' | 'experience_frame' | 'experience_done';

interface ThreadMessage {
  speaker: 'candidate' | 'tutor';
  text: string;
  isFixed?: boolean; // Level 2/3 fixed text, or the off-topic redirect — never AI-authored
  // The conversation is audio-primary — tutor turns are spoken, not shown as text bubbles — EXCEPT
  // this one case. The Level 3 message contains phone numbers and a text-to number; hearing them
  // once and having them vanish is a real usability failure in exactly the situation where someone
  // most needs to be able to reference them again. Safety-critical text always stays visible.
  isCrisisMessage?: boolean;
}

const NEXT_STAGE: Record<TutorStage, TutorStage> = {
  listen: 'locate',
  locate: 'explain',
  explain: 'try',
  try: 'check',
  check: 'check',
};

// Every stage FORCE-advances once it hits its cap, regardless of the model's own
// readyToAdvance signal. Without this, a stage the model is conservative about (or one where a
// generated message keeps failing validation and falling back to the generic "tell me more"
// line, which always reports readyToAdvance: false) can loop indefinitely — which is exactly
// what "asks the same question over and over, never actually coaches" looks like from the
// candidate's side, since the conversation can get stuck before ever reaching 'explain', the
// stage that actually does the coaching.
const STAGE_MAX_EXCHANGES: Record<TutorStage, number> = {
  listen: 1, locate: 2, explain: 2, try: 3, check: 1,
};

// ── Hands-free listening thresholds ────────────────────────────────────────────
// Volume-based voice activity detection (raw mic amplitude via the Web Audio API's
// AnalyserNode), not the Web Speech Recognition API — Safari's SpeechRecognition support is
// unreliable, which is why this whole app already routes voice input through
// MediaRecorder -> Gemini transcription instead of it. These numbers are starting points, not
// measured/tuned against real recordings.
const VAD_SPEECH_RMS = 0.025; // amplitude (0-1) above which the mic is treated as "someone talking"
const VAD_SILENCE_MS = 1100; // how long below that threshold before an utterance is considered finished
const VAD_MIN_SPEECH_MS = 350; // ignore blips shorter than this (coughs, clicks, a chair creak)
const VAD_MAX_UTTERANCE_MS = 2 * 60 * 1000; // safety cap if silence is never detected

const transcribeVoiceNote = async (blob: Blob): Promise<string> => {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  const res = await generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{
      parts: [
        { text: 'Transcribe the speech in this audio exactly as spoken. Return only the words, nothing else. If there is no speech, return nothing.' },
        { inlineData: { mimeType: blob.type || 'audio/webm', data: base64 } },
      ],
    }],
  });
  return (res.text || '').trim();
};

const TalkItThrough: React.FC<TalkItThroughProps> = ({ questionText, onClose, email }) => {
  const {
    speechRate, voiceGenderPreference, voiceTone, visualFeedback, aiTutorVoiceMode,
    jobDescription, companyName, targetRole, jdcvAlignmentAnalysis, participantId,
  } = useSettings();

  // Backend fallback (services/cvAlignment.ts), always fetched — not just when context is empty.
  // participant_id is reliable and immediate (generated on page load, no timing race against the
  // candidate's email), and WelcomeScreen now saves under it twice: once immediately at upload
  // time with just the raw CV/JD (before Phase 2 even starts), and again once Phase 2's alignment
  // analysis succeeds. The "latest" lookup naturally prefers whichever came last, so this one
  // fetch picks up the richer version automatically once it exists — no need to gate the fetch on
  // whether context looks empty. Falls back to the email-keyed lookup only if the participant
  // lookup comes back with nothing (e.g. a returning candidate on a new device/tab).
  const [backendCvAlignment, setBackendCvAlignment] = useState<StoredCvAlignment | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const byParticipant = participantId ? await getLatestCvAlignmentByParticipant(participantId) : null;
      if (cancelled) return;
      if (byParticipant) { setBackendCvAlignment(byParticipant); return; }
      const byEmail = email ? await getLatestCvAlignmentByEmail(email) : null;
      if (!cancelled) setBackendCvAlignment(byEmail);
    })();
    return () => { cancelled = true; };
  }, [participantId, email]);

  // Already computed once, at CV/JD upload time (WelcomeScreen's Phase 2 alignment pass) — reused
  // here as-is, never re-derived. Deliberately a thin slice (no gapAreas, no raw CV text in the
  // STRUCTURED fields below — see TalkItThroughCandidateBackground in services/talkItThrough.ts
  // for why); null whenever a candidate skipped CV upload or has no alignment analysis, which
  // generateTutorTurn treats as "fall back to a generic example" rather than requiring it.
  // Context first, backend fallback second, field by field — a session could have a job
  // description in context but the alignment only in the backend fallback (or vice versa), so
  // this isn't simply "pick one source."
  const candidateBackground = {
    jobDescription: jobDescription || backendCvAlignment?.jobDescription || null,
    targetRole: targetRole || backendCvAlignment?.targetRole || null,
    companyName: companyName || backendCvAlignment?.companyName || null,
    alignmentSummary: jdcvAlignmentAnalysis?.alignmentSummary || backendCvAlignment?.alignmentSummary || null,
    strengthAreas: (jdcvAlignmentAnalysis?.strengthAreas?.map(s => ({
      area: s.area, cvEvidence: s.cvEvidence, jdRequirement: s.jdRequirement,
    })) ?? backendCvAlignment?.strengthAreas) || null,
  };
  const calm = visualFeedback === 'minimalist'
    || (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const [phase, setPhase] = useState<Phase>('opening');
  const [stage, setStage] = useState<TutorStage>('listen');
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [stageExchangeCount, setStageExchangeCount] = useState(0);
  const [inputText, setInputText] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [level2Notice, setLevel2Notice] = useState(false);
  const [clearPicture, setClearPicture] = useState<ClearPicture | null>(null);
  const [editingField, setEditingField] = useState<keyof ClearPicture | null>(null);
  const [editDraft, setEditDraft] = useState('');

  // Coaching Thread (services/coachingThread.ts) — cross-session continuity. Fetched once on
  // mount, participantId first (durable per-device, no cost — see SettingsContext.tsx), falling
  // back to email only for the genuine cross-device case. null for candidates with neither on
  // file or no prior conversation, in which case startOpening() falls back to exactly the fixed
  // opening line this always used.
  const [priorThread, setPriorThread] = useState<CoachingThread | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const byParticipant = participantId ? await getLatestCoachingThreadByParticipant(participantId) : null;
      if (cancelled) return;
      if (byParticipant) { setPriorThread(byParticipant); return; }
      const byEmail = email ? await getLatestCoachingThreadByEmail(email) : null;
      if (!cancelled) setPriorThread(byEmail);
    })();
    return () => { cancelled = true; };
  }, [participantId, email]);

  // "No corporate experience" pathway (services/talkItThrough.ts) — all local, UI-only state;
  // none of this touches the normal stage machine's state above. offeredThisConversation stops
  // the offer being repeated if the candidate declines it once, or after it's been accepted.
  const [offeredExperienceGap, setOfferedExperienceGap] = useState(false);
  const [evidenceItems, setEvidenceItems] = useState<EvidenceItem[]>([]);
  const [evidenceStepIndex, setEvidenceStepIndex] = useState(0);
  const [evidenceDraft, setEvidenceDraft] = useState('');
  const [bridgeLinks, setBridgeLinks] = useState<ExperienceLink[]>([]);
  const [bridgeDecisions, setBridgeDecisions] = useState<Record<number, 'accepted' | 'rejected' | 'pending'>>({});
  const [editingBridgeIndex, setEditingBridgeIndex] = useState<number | null>(null);
  const FRAME_PARTS = ['whoIAmNow', 'whatIveDone', 'whyThisRole'] as const;
  type FramePart = (typeof FRAME_PARTS)[number];
  const [frameAnswers, setFrameAnswers] = useState<Record<FramePart, string>>({ whoIAmNow: '', whatIveDone: '', whyThisRole: '' });
  const [frameStepIndex, setFrameStepIndex] = useState(0);
  const [frameDraft, setFrameDraft] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const pendingSpeakTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, phase]);

  useEffect(() => {
    return () => { window.speechSynthesis.cancel(); };
  }, []);

  // Audio-primary, zero network latency (no AI call — this is the browser's own TTS engine).
  // The AI never generates audio directly; it only ever writes text, which is spoken locally.
  const speak = (text: string) => {
    if (pendingSpeakTimeoutRef.current) {
      clearTimeout(pendingSpeakTimeoutRef.current);
      pendingSpeakTimeoutRef.current = null;
    }
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    // "AI tutor voice: Text only" (Support Settings) — the candidate still sees every message in
    // the thread (ThreadMessage.text always holds the full text regardless of this setting); this
    // only skips queuing the spoken utterance. Still cancels anything already playing, above, so
    // flipping the setting mid-conversation stops audio immediately.
    if (aiTutorVoiceMode === 'text_only') return;
    // Chrome has a long-documented bug where speak() called synchronously right after cancel()
    // on an idle synthesis queue is silently dropped — no audio, no onstart, no onerror, nothing
    // (https://bugs.chromium.org/p/chromium/issues/detail?id=835378 and similar reports). A short
    // delay between the cancel() above and the speak() below avoids it; harmless on browsers
    // that don't have the bug. This is the second attempted fix for "it says the tutor spoke but
    // there's no sound" — the first (removing a different self-cancel race) wasn't sufficient on
    // its own, which points at this as the real underlying issue.
    pendingSpeakTimeoutRef.current = window.setTimeout(() => {
      pendingSpeakTimeoutRef.current = null;
      const utterance = new SpeechSynthesisUtterance(text);
      const voice = pickVoice(window.speechSynthesis.getVoices(), voiceGenderPreference);
      if (voice) utterance.voice = voice;
      applyToneToUtterance(utterance, voiceTone, speechRate);
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = (e) => {
        console.error('Talk It Through: speech synthesis error', e);
        setIsSpeaking(false);
      };
      window.speechSynthesis.speak(utterance);
    }, 60);
  };

  // Barge-in, hardened: Safari's speechSynthesis.speaking can report stale/wrong state, so this
  // never gates on it — cancel() is harmless to call even when nothing is speaking. Also fires a
  // second cancel on the next tick, since Safari has long-standing bugs where a single cancel()
  // during active speech doesn't reliably stop it immediately. Always updates React state
  // directly too, rather than depending on the utterance's own onend/onerror firing (those are
  // also unreliable after a cancel() in some browsers). Also clears any speak() still waiting out
  // its post-cancel delay, so a barge-in can't be followed by a stale utterance starting anyway.
  const stopSpeaking = () => {
    if (pendingSpeakTimeoutRef.current) {
      clearTimeout(pendingSpeakTimeoutRef.current);
      pendingSpeakTimeoutRef.current = null;
    }
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setTimeout(() => window.speechSynthesis.cancel(), 0);
  };

  // Only called from the Try stage, after the stage machine has already moved on — generates
  // the Clear Picture once, never fabricating a prior success (null if none is wired in yet).
  const finishWithClearPicture = async (history: ThreadMessage[]) => {
    setIsBusy(true);
    try {
      const picture = await generateClearPicture({
        questionText,
        history: history.map(m => ({ speaker: m.speaker, text: m.text })),
        priorSuccessNote: null,
      });
      setClearPicture(picture);
      setPhase('clear_picture');
      // Becomes next time's review opener (startOpening, above) — fire-and-forget, never blocks
      // the candidate seeing their Clear Picture. No-ops silently if neither key is on file.
      if ((participantId || email) && picture.whatWeCouldTry.length > 0) {
        saveCoachingThread({
          participantId, email, questionText,
          focus: picture.whatHappened,
          plan: picture.whatWeCouldTry.join('; '),
        });
      }
    } catch (err) {
      console.error('Failed to generate Clear Picture:', err);
      onClose();
    } finally {
      setIsBusy(false);
    }
  };

  const advanceStage = (current: TutorStage, readyToAdvance: boolean, exchangeCount: number, history: ThreadMessage[]) => {
    const forced = exchangeCount >= STAGE_MAX_EXCHANGES[current];
    if (!readyToAdvance && !forced) return; // stay in this stage for another exchange

    if (current === 'check' || current === 'try') {
      // Check stage is a single confirm-then-picture step; Try is capped above — either way, go
      // straight to the picture rather than spending another model call re-confirming.
      setStage('check');
      finishWithClearPicture(history);
      return;
    }
    setStage(NEXT_STAGE[current]);
    setStageExchangeCount(0);
  };

  const submitMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isBusy) return;
    setIsBusy(true);
    setInputText('');

    const candidateMsg: ThreadMessage = { speaker: 'candidate', text: trimmed };
    const historyWithCandidate = [...messages, candidateMsg];
    setMessages(historyWithCandidate);
    const historyForAI = historyWithCandidate.map(m => ({ speaker: m.speaker, text: m.text }));

    try {
      // Latency: fire the distress/on-topic check AND an optimistic turn-generation call (assuming
      // Level 1) at the same time, instead of waiting for the check before even starting the turn
      // call. In the common case (on-topic, Level 1) this turns two sequential round-trips into one
      // wall-clock round-trip. Level 2 pays a second call for the properly-framed turn (correctness
      // matters more than speed there); Level 3/off-topic discard the optimistic result entirely —
      // it's never shown, so there's no safety cost to having started it.
      const checkPromise = checkMessage(trimmed, questionText);
      const optimisticTurnPromise = generateTutorTurn({
        stage, questionText, history: historyForAI, latestCandidateMessage: trimmed, distressLevel: 1,
        candidateBackground,
      }).catch(() => null);

      const check = await checkPromise;

      if (check.distressLevel === 3) {
        speak(LEVEL_3_MESSAGE);
        setMessages(prev => [...prev, { speaker: 'tutor', text: LEVEL_3_MESSAGE, isFixed: true, isCrisisMessage: true }]);
        setPhase('level3_stop');
        return;
      }

      if (!check.onTopic) {
        const redirect = offTopicRedirect(questionText);
        speak(redirect);
        setMessages(prev => [...prev, { speaker: 'tutor', text: redirect, isFixed: true }]);
        return;
      }

      // "No corporate experience" pathway — a deterministic text-pattern trigger (never an AI
      // classification, so the offer itself can never misfire from a model's judgement call),
      // offered at most once per conversation. The optimistic turn call above is simply left
      // unused here, same as the Level 3/off-topic branches above — no safety or correctness
      // cost to having started it.
      if (!offeredExperienceGap && detectsExperienceGap(trimmed)) {
        setOfferedExperienceGap(true);
        speak(EXPERIENCE_GAP_OFFER);
        setMessages(prev => [...prev, { speaker: 'tutor', text: EXPERIENCE_GAP_OFFER, isFixed: true }]);
        setPhase('experience_gap_offer');
        return;
      }

      setLevel2Notice(check.distressLevel === 2);

      const turn = check.distressLevel === 2
        ? await generateTutorTurn({ stage, questionText, history: historyForAI, latestCandidateMessage: trimmed, distressLevel: 2, candidateBackground })
        : (await optimisticTurnPromise) ?? await generateTutorTurn({ stage, questionText, history: historyForAI, latestCandidateMessage: trimmed, distressLevel: 1, candidateBackground });

      const tutorText = check.distressLevel === 2 ? `${turn.tutorMessage} ${LEVEL_2_SUFFIX}` : turn.tutorMessage;
      speak(tutorText);
      const fullHistory: ThreadMessage[] = [...historyWithCandidate, { speaker: 'tutor', text: tutorText }];
      setMessages(fullHistory);

      const nextExchangeCount = stageExchangeCount + 1;
      setStageExchangeCount(nextExchangeCount);
      advanceStage(stage, turn.readyToAdvance, nextExchangeCount, fullHistory);
    } catch (err) {
      console.error('Talk It Through turn failed:', err);
      const fallback = "Sorry, something went wrong on my end — would you like to try saying that again?";
      speak(fallback);
      setMessages(prev => [...prev, { speaker: 'tutor', text: fallback, isFixed: true }]);
    } finally {
      setIsBusy(false);
    }
  };

  // ── "No corporate experience" pathway handlers ──────────────────────────────────
  // All fixed wording and code-controlled transitions below — no AI call anywhere in this
  // pathway except generateExperienceBridge, called once, from runBridge.

  const declineExperienceGap = () => {
    const line = "No problem — let's keep going with what you were saying.";
    speak(line);
    setMessages(prev => [...prev, { speaker: 'tutor', text: line, isFixed: true }]);
    setPhase('conversation');
  };

  const acceptExperienceGap = () => {
    const area = EVIDENCE_AREAS[0];
    const line = `Let's list what you have actually done, in your own words. ${area.question}`;
    speak(line);
    setMessages(prev => [...prev, { speaker: 'tutor', text: line, isFixed: true }]);
    setEvidenceItems([]);
    setEvidenceStepIndex(0);
    setEvidenceDraft('');
    setPhase('experience_inventory');
  };

  const advanceEvidenceStep = (skip: boolean) => {
    const area = EVIDENCE_AREAS[evidenceStepIndex];
    const draft = evidenceDraft.trim();
    const nextItems = !skip && draft ? [...evidenceItems, { areaId: area.id, text: draft }] : evidenceItems;
    if (!skip && draft) setEvidenceItems(nextItems);
    setEvidenceDraft('');

    const nextIndex = evidenceStepIndex + 1;
    if (nextIndex < EVIDENCE_AREAS.length) {
      setEvidenceStepIndex(nextIndex);
      const nextArea = EVIDENCE_AREAS[nextIndex];
      const line = nextArea.question;
      speak(line);
      setMessages(prev => [...prev, { speaker: 'tutor', text: line, isFixed: true }]);
      return;
    }

    // Inventory complete — code recap, exactly what the candidate said, nothing added.
    const recap = nextItems.length > 0
      ? `So far I have: ${nextItems.map(i => i.text).join('; ')}. Have I missed anything?`
      : "That's okay if nothing comes to mind right now — we can still work with what the role is asking for.";
    speak(recap);
    setMessages(prev => [...prev, { speaker: 'tutor', text: recap, isFixed: true }]);
    runBridge(nextItems);
  };

  const runBridge = async (items: EvidenceItem[]) => {
    if (items.length === 0 || !jobDescription.trim()) {
      // Nothing to link, or no job description to link against — skip straight to the frame
      // rather than showing an empty bridge step.
      startFrame();
      return;
    }
    setIsBusy(true);
    setPhase('experience_bridge');
    try {
      const links = await generateExperienceBridge({ jobDescription, evidenceItems: items });
      setBridgeLinks(links);
      setBridgeDecisions(Object.fromEntries(links.map((_, i) => [i, 'pending' as const])));
      if (links.length === 0) startFrame();
    } catch (err) {
      console.error('Experience bridge generation failed:', err);
      startFrame();
    } finally {
      setIsBusy(false);
    }
  };

  const startFrame = () => {
    setFrameAnswers({ whoIAmNow: '', whatIveDone: '', whyThisRole: '' });
    setFrameStepIndex(0);
    setFrameDraft('');
    const line = "Let's put this together. Who are you now — your studies or current situation, and one strength, in a sentence?";
    speak(line);
    setMessages(prev => [...prev, { speaker: 'tutor', text: line, isFixed: true }]);
    setPhase('experience_frame');
  };

  const FRAME_PROMPTS: Record<FramePart, string> = {
    whoIAmNow: "Who are you now — your studies or current situation, and one strength, in a sentence?",
    whatIveDone: "What's one or two pieces of real evidence from what you just listed that connect to this role?",
    whyThisRole: "In one honest sentence — why this role, and what do you hope to learn?",
  };

  const advanceFrameStep = () => {
    const part = FRAME_PARTS[frameStepIndex];
    const draft = frameDraft.trim();
    const nextAnswers = draft ? { ...frameAnswers, [part]: draft } : frameAnswers;
    if (draft) setFrameAnswers(nextAnswers);
    setFrameDraft('');

    const nextIndex = frameStepIndex + 1;
    if (nextIndex < FRAME_PARTS.length) {
      setFrameStepIndex(nextIndex);
      const line = FRAME_PROMPTS[FRAME_PARTS[nextIndex]];
      speak(line);
      setMessages(prev => [...prev, { speaker: 'tutor', text: line, isFixed: true }]);
      return;
    }

    finishExperiencePathway(nextAnswers);
  };

  const finishExperiencePathway = (answers: Record<FramePart, string>) => {
    const intro = [answers.whoIAmNow, answers.whatIveDone, answers.whyThisRole].filter(Boolean).join(' ');
    const line = "That gives you a real introduction, built from your own words — nothing here was invented. You can practise saying it whenever you're ready.";
    speak(line);
    setMessages(prev => [...prev, { speaker: 'tutor', text: line, isFixed: true }]);
    if ((participantId || email) && intro) {
      saveCoachingThread({
        participantId, email, questionText,
        focus: 'Introducing myself without much relevant corporate experience',
        plan: intro,
      });
    }
    setPhase('experience_done');
  };

  const startOpening = () => {
    // Review cycle (Coaching Thread, cross-session): if there's a plan from a prior
    // conversation, open with a review of it instead of the generic opener — "the candidate
    // speaks first" per the spec's review step. Falls back to the original fixed line whenever
    // there's no email, no prior thread, or no plan was saved (e.g. the candidate ended before
    // reaching a Clear Picture).
    const opening = priorThread?.plan
      ? `I'm your AI tutor. I'm not a person, but I'm here to listen and help you work through this. Last time, you planned to try: "${priorThread.plan}". How did that go?`
      : "I'm your AI tutor. I'm not a person, but I'm here to listen and help you work through this. You can talk or type, and you can stop at any time. What felt hard?";
    setPhase('conversation');
    setMessages([{ speaker: 'tutor', isFixed: true, text: opening }]);
    speak(opening);
    if (priorThread) markCoachingThreadReviewed(priorThread.id);
  };

  const handleToggleRecord = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      return;
    }
    // Barge-in: starting to speak cuts the tutor off mid-sentence rather than waiting for it to
    // finish — a real conversation lets you interrupt. Simple push-to-talk cutoff, not full
    // always-listening voice-activity detection (a much bigger feature, not built here).
    stopSpeaking();
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(micStream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        micStream.getTracks().forEach(t => t.stop());
        setIsRecording(false);
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        chunksRef.current = [];
        // Transcribe, then the blob is simply never stored anywhere — deleted by omission.
        setIsBusy(true);
        try {
          const text = await transcribeVoiceNote(blob);
          setIsBusy(false);
          if (text) submitMessage(text);
        } catch (err) {
          console.error('Voice note transcription failed:', err);
          setIsBusy(false);
        }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, 5 * 60 * 1000); // 5-minute cap
    } catch (err) {
      console.error('Microphone access failed:', err);
    }
  };

  // ── Hands-free listening ──────────────────────────────────────────────────────
  // A persistent mic stream, monitored continuously for volume rather than clicked per-turn.
  // Crossing the speech threshold starts recording; a sustained drop back below it stops the
  // recording and sends it through the same transcription pipeline as the manual mic button.
  //
  // It deliberately does NOT try to detect a voice interruption while the tutor is talking
  // (isSpeaking) — an earlier version raised the threshold during playback instead of disabling
  // detection outright, and real testing showed that wasn't enough: the mic picked up the
  // tutor's own speaker output as "the candidate talking," and after ~2 seconds of that bleed
  // staying above even the raised threshold, it called cancel() on the utterance it was itself
  // still playing. That read as "there's no sound" (speech kept getting cut a couple of seconds
  // in) and showed up as repeated SpeechSynthesisErrorEvent("canceled") entries in the console.
  // A plain amplitude monitor can't reliably tell the tutor's own audio from the candidate's
  // without real echo cancellation (matching mic input against the known speaker output), which
  // this isn't, so detection is simply off while isSpeaking is true. Typing is still available as
  // a deliberate way to interrupt; once the tutor finishes, hands-free picks up normally.
  const [handsFree, setHandsFree] = useState(false);
  const [vadHearing, setVadHearing] = useState(false);
  const handsFreeStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const vadFrameRef = useRef<number | null>(null);
  const vadRecorderRef = useRef<MediaRecorder | null>(null);
  const vadChunksRef = useRef<Blob[]>([]);
  const vadStateRef = useRef<'idle' | 'speaking'>('idle');
  const speechStartedAtRef = useRef<number | null>(null);
  const silenceStartedAtRef = useRef<number | null>(null);
  const tickRef = useRef<() => void>(() => {});

  const beginVadRecording = () => {
    const stream = handsFreeStreamRef.current;
    if (!stream) return;
    vadStateRef.current = 'speaking';
    setVadHearing(true);
    // Defensive, not the primary mechanism: the tick loop already skips triggering this while
    // isSpeaking is true, so in practice the tutor should already be done. This just guards the
    // rare race where isSpeaking flips true between the check and this call.
    stopSpeaking();
    const recorder = new MediaRecorder(stream);
    vadChunksRef.current = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) vadChunksRef.current.push(e.data); };
    recorder.onstop = async () => {
      const blob = new Blob(vadChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
      vadChunksRef.current = [];
      setIsBusy(true);
      try {
        const text = await transcribeVoiceNote(blob);
        setIsBusy(false);
        if (text && text.trim()) submitMessage(text);
      } catch (err) {
        console.error('Hands-free transcription failed:', err);
        setIsBusy(false);
      }
    };
    recorder.start();
    vadRecorderRef.current = recorder;
    setTimeout(() => {
      if (vadRecorderRef.current === recorder && recorder.state === 'recording') endVadRecording();
    }, VAD_MAX_UTTERANCE_MS);
  };

  const endVadRecording = () => {
    vadStateRef.current = 'idle';
    setVadHearing(false);
    speechStartedAtRef.current = null;
    silenceStartedAtRef.current = null;
    const recorder = vadRecorderRef.current;
    vadRecorderRef.current = null;
    if (recorder && recorder.state === 'recording') recorder.stop();
  };

  // Rebuilt every render so the loop below always acts on the latest state/handlers (isBusy,
  // isSpeaking, phase, submitMessage...), even though the rAF driver itself is one stable
  // function kept alive across renders.
  useEffect(() => {
    tickRef.current = () => {
      const analyser = analyserRef.current;
      if (!analyser) return;
      const buf = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(buf);
      let sumSquares = 0;
      for (let i = 0; i < buf.length; i++) sumSquares += buf[i] * buf[i];
      const rms = Math.sqrt(sumSquares / buf.length);
      const now = performance.now();

      // See the comment above this hands-free section: no interruption detection at all while
      // the tutor is mid-utterance, to avoid the mic picking up its own speaker output.
      if (isSpeaking) {
        speechStartedAtRef.current = null;
        silenceStartedAtRef.current = null;
        return;
      }

      if (rms >= VAD_SPEECH_RMS) {
        silenceStartedAtRef.current = null;
        if (!speechStartedAtRef.current) speechStartedAtRef.current = now;
        const sustained = now - speechStartedAtRef.current >= VAD_MIN_SPEECH_MS;
        if (sustained && vadStateRef.current === 'idle' && !isBusy && !isRecording && phase === 'conversation') {
          beginVadRecording();
        }
      } else {
        speechStartedAtRef.current = null;
        if (vadStateRef.current === 'speaking') {
          if (!silenceStartedAtRef.current) silenceStartedAtRef.current = now;
          if (now - silenceStartedAtRef.current >= VAD_SILENCE_MS) {
            endVadRecording();
          }
        }
      }
    };
  });

  const runVadLoop = () => {
    tickRef.current();
    vadFrameRef.current = requestAnimationFrame(runVadLoop);
  };

  const startHandsFree = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const AudioCtxClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx: AudioContext = new AudioCtxClass();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      handsFreeStreamRef.current = stream;
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      setHandsFree(true);
      runVadLoop();
    } catch (err) {
      console.error('Hands-free microphone access failed:', err);
    }
  };

  const stopHandsFree = () => {
    if (vadFrameRef.current) cancelAnimationFrame(vadFrameRef.current);
    vadFrameRef.current = null;
    if (vadRecorderRef.current && vadRecorderRef.current.state === 'recording') vadRecorderRef.current.stop();
    vadRecorderRef.current = null;
    analyserRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    handsFreeStreamRef.current?.getTracks().forEach(t => t.stop());
    handsFreeStreamRef.current = null;
    vadStateRef.current = 'idle';
    setVadHearing(false);
    setHandsFree(false);
  };

  // Hands-free only makes sense during the live back-and-forth — drop the stream the moment the
  // conversation ends (crisis stop or Clear Picture), rather than leaving a mic open in the background.
  useEffect(() => {
    if (phase !== 'conversation' && handsFreeStreamRef.current) stopHandsFree();
  }, [phase]);

  useEffect(() => {
    return () => {
      if (vadFrameRef.current) cancelAnimationFrame(vadFrameRef.current);
      if (vadRecorderRef.current && vadRecorderRef.current.state === 'recording') vadRecorderRef.current.stop();
      audioCtxRef.current?.close().catch(() => {});
      handsFreeStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const startEdit = (field: keyof ClearPicture) => {
    if (!clearPicture) return;
    const value = clearPicture[field];
    setEditDraft(Array.isArray(value) ? value.join('\n') : String(value ?? ''));
    setEditingField(field);
  };

  const saveEdit = () => {
    if (!clearPicture || !editingField) return;
    const field = editingField;
    const isArrayField = field === 'whatWeCouldTry';
    setClearPicture({
      ...clearPicture,
      [field]: isArrayField ? editDraft.split('\n').map(s => s.trim()).filter(Boolean) : editDraft,
    });
    setEditingField(null);
  };

  const FIELD_LABELS: Record<keyof ClearPicture, string> = {
    whatHappened: 'What happened',
    myBestReading: 'My best reading',
    whereItWentWrong: 'Where it went wrong',
    whatHelpedBefore: 'What helped before',
    whatWeCouldTry: 'What we could try',
    whatImNotSureAbout: "What I am not sure about",
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[30000] p-4 animate-fade-in" role="dialog" aria-modal="true">
      <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full max-h-[85vh] flex flex-col border border-slate-200">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {/* A non-human "presence," not an avatar or face — deliberately, after discussing a
                literal avatar (including the candidate's own face) and declining it: the source
                design rules out faces/avatars, the "I'm not a person" disclosure would fight a
                realistic face visually, and a personal likeness would tie real identity to a
                feature that hasn't had its safety review yet. This layered, more expressive orb
                is the agreed alternative — alive and reactive without depicting anyone. */}
            <div className="relative shrink-0 w-11 h-11 flex items-center justify-center" aria-hidden="true">
              {isSpeaking && !calm && (
                <span className="absolute inset-0 rounded-full border-2 border-indigo-400 animate-ping" />
              )}
              <span
                className={`absolute inset-0 rounded-full ${calm ? '' : 'animate-spin'}`}
                style={{
                  background: isSpeaking
                    ? 'conic-gradient(from 0deg, #818cf8, #a78bfa, #6366f1, #818cf8)'
                    : 'conic-gradient(from 0deg, #cbd5e1, #e2e8f0, #cbd5e1)',
                  animationDuration: isSpeaking ? '2s' : '6s',
                  opacity: isSpeaking ? 0.9 : 0.5,
                }}
              />
              <span
                className={`relative w-7 h-7 rounded-full transition-all duration-500 ${
                  isSpeaking
                    ? `bg-gradient-to-br from-indigo-500 to-purple-600 scale-110 shadow-lg shadow-indigo-400/50 ${calm ? '' : 'animate-pulse'}`
                    : 'bg-gradient-to-br from-slate-300 to-slate-400 scale-100'
                }`}
              />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-black text-slate-900 tracking-tight">Talk It Through</h2>
              <p className="text-xs text-slate-500 truncate">"{questionText}"</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors shrink-0" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {phase === 'opening' && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
            <p className="text-sm text-slate-600 leading-relaxed max-w-sm">
              Tell me about a moment that felt hard. You can talk or type. Nothing here is marked, and you can stop at any time.
            </p>
            <button
              onClick={startOpening}
              className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-sm hover:bg-indigo-700 transition-all"
            >
              Start
            </button>
          </div>
        )}

        {(phase === 'conversation' || phase === 'level3_stop') && (
          <>
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {messages.map((m, i) => {
                // Candidate's own words and the Level 3 crisis message always show as text.
                // Everything else the tutor says is audio-primary — spoken, not duplicated as a
                // text bubble, so this reads as a voice conversation rather than a chat log.
                // EXCEPT in "AI tutor voice: Text only" mode (Support Settings): nothing ever
                // gets spoken there (see the early return in speak()), so showing just "Tutor
                // spoke" would leave the candidate with no way to know what was said at all —
                // the full text is shown instead, same as a candidate message.
                if (m.speaker === 'tutor' && !m.isCrisisMessage && aiTutorVoiceMode === 'text_only') {
                  return (
                    <div key={i} className="flex justify-start">
                      <div className="max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed bg-slate-100 text-slate-700">
                        {m.text}
                      </div>
                    </div>
                  );
                }
                if (m.speaker === 'tutor' && !m.isCrisisMessage) {
                  const isLatest = i === messages.length - 1;
                  const currentlySpeakingThis = isLatest && isSpeaking;
                  return (
                    <div key={i} className="flex justify-start">
                      <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-100 text-slate-500">
                        <Volume2 size={14} className={currentlySpeakingThis ? 'animate-pulse text-indigo-500' : ''} />
                        <span className="text-xs italic">{currentlySpeakingThis ? 'Speaking…' : 'Tutor spoke'}</span>
                        {!currentlySpeakingThis && (
                          <button
                            onClick={() => speak(m.text)}
                            disabled={isBusy}
                            className="p-1 -m-1 rounded-full text-slate-400 hover:text-indigo-600 hover:bg-slate-200 transition-colors disabled:opacity-40"
                            aria-label="Replay this"
                          >
                            <RotateCcw size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={i} className={`flex ${m.speaker === 'candidate' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      m.speaker === 'candidate'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-amber-50 border border-amber-200 text-amber-900 font-medium'
                    }`}>
                      {m.text}
                    </div>
                  </div>
                );
              })}
              {isBusy && <p className="text-xs text-slate-400 italic">Thinking…</p>}
              <div ref={threadEndRef} />
            </div>

            {level2Notice && phase === 'conversation' && (
              <div className="mx-6 mb-2 p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2">
                <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-800 font-medium leading-relaxed">
                  This seems like a lot of pressure. You're welcome to take a break at any point — just close this window.
                </p>
              </div>
            )}

            {phase === 'conversation' && (
              <div className="border-t border-slate-100 shrink-0">
                {handsFree && (
                  <div className="px-4 pt-2.5 flex items-center justify-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${vadHearing ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
                    <p className="text-[11px] text-slate-500 font-medium">
                      {vadHearing ? 'Hearing you…' : 'Listening — just start talking, no need to click anything'}
                    </p>
                  </div>
                )}
                <div className="p-4 flex items-center gap-2">
                  <input
                    type="text"
                    value={inputText}
                    onChange={e => {
                      setInputText(e.target.value);
                      // Barge-in for typing too — starting to type cuts the tutor off, same as the mic.
                      stopSpeaking();
                    }}
                    onKeyDown={e => { if (e.key === 'Enter') submitMessage(inputText); }}
                    placeholder={handsFree ? 'Or type here…' : 'Type here, or use the mic…'}
                    disabled={isBusy || isRecording}
                    className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-300 disabled:opacity-50"
                  />
                  {!handsFree && (
                    <button
                      onClick={handleToggleRecord}
                      disabled={isBusy}
                      className={`p-2.5 rounded-xl transition-all ${isRecording ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'} disabled:opacity-50`}
                      aria-label={isRecording ? 'Stop recording' : 'Record a voice note'}
                    >
                      {isRecording ? <Square size={16} /> : <Mic size={16} />}
                    </button>
                  )}
                  <button
                    onClick={() => submitMessage(inputText)}
                    disabled={isBusy || isRecording || !inputText.trim()}
                    className="p-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition-all"
                    aria-label="Send"
                  >
                    <Send size={16} />
                  </button>
                  <button
                    onClick={() => (handsFree ? stopHandsFree() : startHandsFree())}
                    disabled={isBusy || isRecording}
                    className={`p-2.5 rounded-xl transition-all ${handsFree ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'} disabled:opacity-50`}
                    aria-label={handsFree ? 'Turn off hands-free listening' : 'Turn on hands-free listening'}
                    title={handsFree ? 'Hands-free is on — just talk' : 'Go hands-free — talk without clicking the mic'}
                  >
                    <Headphones size={16} />
                  </button>
                </div>
              </div>
            )}

            {phase === 'level3_stop' && (
              <div className="p-4 border-t border-slate-100">
                <button onClick={onClose} className="w-full px-4 py-3 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all">
                  Close
                </button>
              </div>
            )}
          </>
        )}

        {phase === 'clear_picture' && clearPicture && (
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {(Object.keys(FIELD_LABELS) as (keyof ClearPicture)[]).map(field => {
              const value = clearPicture[field];
              if (value === null || (Array.isArray(value) && value.length === 0)) return null;
              return (
                <div key={field} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{FIELD_LABELS[field]}</p>
                    {editingField !== field && (
                      <button onClick={() => startEdit(field)} className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700">Edit</button>
                    )}
                  </div>
                  {editingField === field ? (
                    <div className="space-y-2">
                      <textarea
                        value={editDraft}
                        onChange={e => setEditDraft(e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded-xl text-sm"
                        rows={Array.isArray(value) ? value.length + 1 : 2}
                      />
                      <div className="flex gap-2">
                        <button onClick={saveEdit} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold">Save</button>
                        <button onClick={() => setEditingField(null)} className="px-3 py-1.5 bg-slate-200 text-slate-600 rounded-lg text-xs font-bold">Cancel</button>
                      </div>
                    </div>
                  ) : Array.isArray(value) ? (
                    <ul className="space-y-1">
                      {value.map((v, i) => <li key={i} className="text-sm text-slate-700">• {v}</li>)}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-700 leading-relaxed">{String(value)}</p>
                  )}
                </div>
              );
            })}
            <p className="text-[11px] text-slate-400 italic text-center pt-1">
              You can turn any of these on in Support settings whenever you're ready.
            </p>
            <button onClick={onClose} className="w-full px-4 py-3 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all">
              Done
            </button>
          </div>
        )}

        {phase === 'experience_gap_offer' && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
            <p className="text-sm text-slate-700 leading-relaxed max-w-sm font-medium">{EXPERIENCE_GAP_OFFER}</p>
            <div className="flex gap-3">
              <button onClick={acceptExperienceGap} className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-sm hover:bg-indigo-700 transition-all">
                Yes, let's work on it
              </button>
              <button onClick={declineExperienceGap} className="px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-200 transition-all">
                No, keep going
              </button>
            </div>
          </div>
        )}

        {phase === 'experience_inventory' && (
          <div className="flex-1 flex flex-col p-6 gap-4 overflow-y-auto">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {EVIDENCE_AREAS[evidenceStepIndex].label} · {evidenceStepIndex + 1} of {EVIDENCE_AREAS.length}
            </p>
            <p className="text-sm font-bold text-slate-800">{EVIDENCE_AREAS[evidenceStepIndex].question}</p>
            <textarea
              value={evidenceDraft}
              onChange={e => setEvidenceDraft(e.target.value)}
              placeholder="In your own words — or skip if nothing comes to mind"
              rows={3}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:border-indigo-300"
            />
            <div className="flex gap-2">
              <button onClick={() => advanceEvidenceStep(false)} disabled={!evidenceDraft.trim()} className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-40 transition-all">
                Next
              </button>
              <button onClick={() => advanceEvidenceStep(true)} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all">
                Skip this one
              </button>
            </div>
          </div>
        )}

        {phase === 'experience_bridge' && (
          <div className="flex-1 flex flex-col p-6 gap-3 overflow-y-auto">
            {isBusy ? (
              <p className="text-sm text-slate-400 italic text-center py-8">Looking for real connections to the role…</p>
            ) : (
              <>
                <p className="text-xs text-slate-500 font-medium leading-relaxed mb-1">
                  Here's how what you've done might connect to the role. Accept what fits, edit anything that's close but not quite right, or reject what doesn't — nothing here is final until you say so.
                </p>
                {bridgeLinks.map((link, i) => {
                  const decision = bridgeDecisions[i] ?? 'pending';
                  if (decision === 'rejected') return null;
                  return (
                    <div key={i} className={`p-3 rounded-2xl border ${link.strength === 'weak' ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                      {link.strength === 'weak' && (
                        <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-1">A smaller connection — more a starting point than proven experience</p>
                      )}
                      {editingBridgeIndex === i ? (
                        <div className="space-y-2">
                          <textarea
                            value={link.cvEvidence}
                            onChange={e => setBridgeLinks(prev => prev.map((l, idx) => idx === i ? { ...l, cvEvidence: e.target.value } : l))}
                            rows={2}
                            className="w-full p-2 border border-slate-300 rounded-xl text-xs"
                          />
                          <button onClick={() => setEditingBridgeIndex(null)} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold">Save</button>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-700 leading-relaxed">
                          "{link.cvEvidence}" <span className="text-slate-400">→</span> {link.jdRequirement}
                        </p>
                      )}
                      {decision === 'pending' && editingBridgeIndex !== i && (
                        <div className="flex gap-2 mt-2">
                          <button onClick={() => setBridgeDecisions(prev => ({ ...prev, [i]: 'accepted' }))} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold">Accept</button>
                          <button onClick={() => setEditingBridgeIndex(i)} className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-xs font-bold">Edit</button>
                          <button onClick={() => setBridgeDecisions(prev => ({ ...prev, [i]: 'rejected' }))} className="px-3 py-1.5 bg-white border border-slate-300 text-slate-500 rounded-lg text-xs font-bold">Reject</button>
                        </div>
                      )}
                      {decision === 'accepted' && <p className="text-[11px] text-emerald-600 font-bold mt-2">Accepted</p>}
                    </div>
                  );
                })}
                <button onClick={startFrame} className="w-full px-4 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all mt-2">
                  Continue
                </button>
              </>
            )}
          </div>
        )}

        {phase === 'experience_frame' && (
          <div className="flex-1 flex flex-col p-6 gap-4 overflow-y-auto">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Building your introduction · {frameStepIndex + 1} of {FRAME_PARTS.length}
            </p>
            {FRAME_PARTS.slice(0, frameStepIndex).map(part => (
              <div key={part} className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                <p className="text-sm text-slate-600 leading-relaxed">{frameAnswers[part]}</p>
              </div>
            ))}
            <p className="text-sm font-bold text-slate-800">{FRAME_PROMPTS[FRAME_PARTS[frameStepIndex]]}</p>
            <textarea
              value={frameDraft}
              onChange={e => setFrameDraft(e.target.value)}
              placeholder="In your own words"
              rows={3}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:border-indigo-300"
            />
            <button onClick={advanceFrameStep} disabled={!frameDraft.trim()} className="w-full px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-40 transition-all">
              {frameStepIndex < FRAME_PARTS.length - 1 ? 'Next' : 'Finish'}
            </button>
          </div>
        )}

        {phase === 'experience_done' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Your introduction, in your own words</p>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <p className="text-sm text-slate-700 leading-relaxed">{frameAnswers.whoIAmNow}</p>
              <p className="text-sm text-slate-700 leading-relaxed">{frameAnswers.whatIveDone}</p>
              <p className="text-sm text-slate-700 leading-relaxed">{frameAnswers.whyThisRole}</p>
            </div>
            <p className="text-[11px] text-slate-400 italic">
              Nothing here was invented — every part came from what you said. You can practise saying it out loud whenever you're ready.
            </p>
            <button onClick={onClose} className="w-full px-4 py-3 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all">
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TalkItThrough;
