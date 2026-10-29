
import React, { useEffect, useMemo, useState } from 'react';
import { X, Play, Pause, ChevronLeft, ChevronRight, RotateCcw, Captions, Volume2, VolumeX } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { getStoryboard, type ExplainerStoryboard, type ExplainerScene, type VisualTemplate } from '../services/visualExplainer';
import { pickVoice, applyToneToUtterance } from '../services/voicePersona';

interface VisualExplainerProps {
  questionText: string;
  requirements: { id: string; text: string }[];
  onClose: () => void;
}

// ── Tier 1 — fixed, hand-built SVG/CSS scenes. No video generation, no per-view cost. ──

const SceneVisual: React.FC<{ template: VisualTemplate; scene: ExplainerScene; questionText: string; calm: boolean }> = ({ template, scene, questionText, calm }) => {
  const base = `w-full h-48 rounded-2xl flex items-center justify-center p-6 text-center ${calm ? '' : 'transition-all duration-500'}`;
  switch (template) {
    case 'question_card':
      return (
        <div className={`${base} bg-indigo-50 border border-indigo-100`}>
          <p className="text-base font-bold text-indigo-900 leading-relaxed">"{questionText}"</p>
        </div>
      );
    case 'split_into_parts':
      return (
        <div className={`${base} bg-slate-50 border border-slate-200 flex-wrap gap-2`}>
          {scene.narration.split(/[,.]/).filter(s => s.trim()).slice(0, 4).map((part, i) => (
            <span key={i} className="px-3 py-1.5 bg-white border border-indigo-200 rounded-xl text-xs font-bold text-indigo-700">
              {part.trim()}
            </span>
          ))}
        </div>
      );
    case 'structure_flow':
      return (
        <div className={`${base} bg-slate-50 border border-slate-200 gap-1`}>
          {['Context', 'What you did', 'What changed'].map((step, i, arr) => (
            <React.Fragment key={step}>
              <span className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600">{step}</span>
              {i < arr.length - 1 && <span className="text-slate-300">→</span>}
            </React.Fragment>
          ))}
        </div>
      );
    case 'highlight_example':
      // Shows the fictional example mapped onto the same shape as structure_flow — a visual
      // answer to "how could someone respond" — rather than just a paragraph of prose.
      return scene.exampleBreakdown ? (
        <div className={`${base} bg-amber-50 border border-amber-100 flex-col gap-2 items-stretch`}>
          {([
            { label: 'Context', text: scene.exampleBreakdown.context },
            { label: 'What you did', text: scene.exampleBreakdown.action },
            { label: 'What changed', text: scene.exampleBreakdown.result },
          ]).map((step, i) => (
            <div key={i} className="flex items-start gap-2 text-left">
              <span className="shrink-0 px-2 py-0.5 bg-amber-200 text-amber-800 rounded-md text-[9px] font-black uppercase tracking-widest mt-0.5">{step.label}</span>
              <p className="text-xs font-medium text-amber-900 leading-snug">{step.text}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className={`${base} bg-amber-50 border border-amber-100`}>
          <p className="text-sm font-medium text-amber-900 leading-relaxed italic">{scene.narration}</p>
        </div>
      );
    case 'empty_structure':
      return (
        <div className={`${base} bg-slate-50 border-2 border-dashed border-slate-300 gap-2`}>
          {['Context', 'What you did', 'What changed'].map(step => (
            <span key={step} className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-300">{step} ?</span>
          ))}
        </div>
      );
    case 'slip_and_fix':
      return (
        <div className={`${base} bg-rose-50 border border-rose-100`}>
          <p className="text-sm font-medium text-rose-900 leading-relaxed">{scene.narration}</p>
        </div>
      );
    default:
      return <div className={base} />;
  }
};

const VisualExplainer: React.FC<VisualExplainerProps> = ({ questionText, requirements, onClose }) => {
  const { visualFeedback, speechRate, voiceGenderPreference, voiceTone } = useSettings();
  const [storyboard, setStoryboard] = useState<ExplainerStoryboard | null>(null);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<0.75 | 1 | 1.25>(1);
  const [captionsOn, setCaptionsOn] = useState(true);
  const [narrationOn, setNarrationOn] = useState(true);
  const [showScript, setShowScript] = useState(false);
  const [isNarrating, setIsNarrating] = useState(false);

  const calm = visualFeedback === 'minimalist'
    || (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    getStoryboard(questionText, requirements).then(setStoryboard);
    return () => { window.speechSynthesis.cancel(); };
  }, [questionText]);

  const scene = storyboard?.scenes[sceneIndex] ?? null;

  useEffect(() => {
    if (!scene || !narrationOn) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(scene.narration);
    const voice = pickVoice(window.speechSynthesis.getVoices(), voiceGenderPreference);
    if (voice) utterance.voice = voice;
    applyToneToUtterance(utterance, voiceTone, speechRate * speed);
    utterance.onstart = () => setIsNarrating(true);
    utterance.onend = () => setIsNarrating(false);
    utterance.onerror = () => setIsNarrating(false);
    window.speechSynthesis.speak(utterance);
    return () => { window.speechSynthesis.cancel(); setIsNarrating(false); };
  }, [scene, narrationOn, speed, speechRate, voiceGenderPreference, voiceTone]);

  // Calm/reduced-motion mode never autoplays — still frames advanced only on click, per the
  // design rule ("if reduce motion is on, or Low stimulation mode is chosen, show scenes as
  // still frames with captions, advancing on the candidate's click").
  useEffect(() => {
    if (!isPlaying || !scene || calm) return;
    const timer = setTimeout(() => {
      if (storyboard && sceneIndex < storyboard.scenes.length - 1) setSceneIndex(i => i + 1);
      else setIsPlaying(false);
    }, (scene.durationSeconds * 1000) / speed);
    return () => clearTimeout(timer);
  }, [isPlaying, scene, sceneIndex, storyboard, speed, calm]);

  const fullScript = useMemo(
    () => storyboard?.scenes.map((s, i) => `${i + 1}. ${s.title} — ${s.narration}`).join('\n') ?? '',
    [storyboard]
  );

  if (!storyboard || !scene) {
    return (
      <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[30000] p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center">
          <p className="text-sm text-slate-500">Preparing the explainer…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[30000] p-4 animate-fade-in" role="dialog" aria-modal="true">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full border border-slate-200">
        <div className="flex items-center justify-between p-6 pb-4">
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              Explain It Visually
              {isNarrating && (
                // Non-human "speaking" indicator — animated bars, deliberately no face or avatar
                // (Explain It Visually and Talk It Through both rule that out — see FRAMEWORK.md).
                <span className="flex items-end gap-0.5 h-3" aria-hidden="true">
                  {[0, 150, 300].map(delay => (
                    <span key={delay} className="w-0.5 bg-indigo-500 rounded-full animate-pulse" style={{ height: '100%', animationDelay: `${delay}ms` }} />
                  ))}
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500">Scene {sceneIndex + 1} of {storyboard.scenes.length} · {scene.title}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="px-6">
          <SceneVisual template={scene.visualTemplate} scene={scene} questionText={questionText} calm={!!calm} />
        </div>

        {captionsOn && (
          <p className="px-6 pt-4 text-sm text-slate-700 leading-relaxed text-center" aria-live="polite">{scene.narration}</p>
        )}

        <div className="p-6 pt-4 space-y-3">
          <div className="flex items-center justify-center gap-2">
            <button onClick={() => setSceneIndex(i => Math.max(0, i - 1))} disabled={sceneIndex === 0} className="p-2.5 rounded-xl bg-slate-100 text-slate-600 disabled:opacity-30 hover:bg-slate-200 transition-all" aria-label="Previous scene">
              <ChevronLeft size={16} />
            </button>
            {calm ? (
              <button onClick={() => setSceneIndex(i => Math.min(storyboard.scenes.length - 1, i + 1))} disabled={sceneIndex >= storyboard.scenes.length - 1} className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold disabled:opacity-40 hover:bg-indigo-700 transition-all">
                Next
              </button>
            ) : (
              <button onClick={() => setIsPlaying(p => !p)} className="p-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-all" aria-label={isPlaying ? 'Pause' : 'Play'}>
                {isPlaying ? <Pause size={18} /> : <Play size={18} />}
              </button>
            )}
            <button onClick={() => setSceneIndex(i => Math.min(storyboard.scenes.length - 1, i + 1))} disabled={sceneIndex >= storyboard.scenes.length - 1} className="p-2.5 rounded-xl bg-slate-100 text-slate-600 disabled:opacity-30 hover:bg-slate-200 transition-all" aria-label="Next scene">
              <ChevronRight size={16} />
            </button>
            <button onClick={() => { setSceneIndex(0); setIsPlaying(false); }} className="p-2.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all" aria-label="Replay from start">
              <RotateCcw size={16} />
            </button>
          </div>

          <div className="flex items-center justify-center gap-2 flex-wrap">
            {([0.75, 1, 1.25] as const).map(s => (
              <button key={s} onClick={() => setSpeed(s)} className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${speed === s ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                {s}x
              </button>
            ))}
            <button onClick={() => setCaptionsOn(v => !v)} className={`p-1.5 rounded-lg transition-all ${captionsOn ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`} aria-label="Toggle captions" title="Captions">
              <Captions size={14} />
            </button>
            <button onClick={() => setNarrationOn(v => !v)} className={`p-1.5 rounded-lg transition-all ${narrationOn ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`} aria-label="Toggle narration" title="Narration">
              {narrationOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
            </button>
          </div>

          <button onClick={() => setShowScript(v => !v)} className="w-full text-center text-[11px] font-bold text-slate-400 hover:text-slate-600 transition-all">
            {showScript ? 'Hide text version' : 'Show text version'}
          </button>
          {showScript && (
            <pre className="whitespace-pre-wrap text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3 leading-relaxed">{fullScript}</pre>
          )}

          <p className="text-[11px] text-slate-400 text-center italic pt-1">
            This explains the question. The answer should come from your own experience.
          </p>
        </div>
      </div>
    </div>
  );
};

export default VisualExplainer;
