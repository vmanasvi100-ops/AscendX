
import React from 'react';
import { Accessibility, X } from 'lucide-react';
import type { ClearModeAppearance, ClipSaveMode, VoiceGenderPreference, VoiceTone, AITutorVoiceMode, VisualExplanationsTrigger } from '../types';

interface SupportSettingsProps {
  clearModeEnabled: boolean;
  onClearModeEnabledChange: (enabled: boolean) => void;
  clearModeAppearance: ClearModeAppearance;
  onClearModeAppearanceChange: (appearance: ClearModeAppearance) => void;
  saveClips: ClipSaveMode;
  onSaveClipsChange: (mode: ClipSaveMode) => void;
  voiceGenderPreference: VoiceGenderPreference;
  onVoiceGenderPreferenceChange: (pref: VoiceGenderPreference) => void;
  voiceTone: VoiceTone;
  onVoiceToneChange: (tone: VoiceTone) => void;
  aiTutorVoiceMode: AITutorVoiceMode;
  onAiTutorVoiceModeChange: (mode: AITutorVoiceMode) => void;
  visualExplanationsTrigger: VisualExplanationsTrigger;
  onVisualExplanationsTriggerChange: (trigger: VisualExplanationsTrigger) => void;
  lowStimulation: boolean;
  onLowStimulationChange: (enabled: boolean) => void;
  dyslexiaFont: boolean;
  onDyslexiaFontChange: (enabled: boolean) => void;
  onClose: () => void;
}

const APPEARANCE_OPTIONS: { value: ClearModeAppearance; label: string; description: string }[] = [
  { value: 'one_at_a_time', label: 'One part at a time', description: 'Each part of the question appears on its own, in order.' },
  { value: 'checklist', label: 'All parts as a checklist', description: 'Every part of the question is shown together on screen.' },
  { value: 'standard', label: 'Standard', description: 'The question appears as it would from a real interviewer.' },
];

const SupportSettings: React.FC<SupportSettingsProps> = ({
  clearModeEnabled,
  onClearModeEnabledChange,
  clearModeAppearance,
  onClearModeAppearanceChange,
  saveClips,
  onSaveClipsChange,
  voiceGenderPreference,
  onVoiceGenderPreferenceChange,
  voiceTone,
  onVoiceToneChange,
  aiTutorVoiceMode,
  onAiTutorVoiceModeChange,
  visualExplanationsTrigger,
  onVisualExplanationsTriggerChange,
  lowStimulation,
  onLowStimulationChange,
  dyslexiaFont,
  onDyslexiaFontChange,
  onClose,
}) => {
  return (
    <div
      className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[30000] p-4 animate-fade-in"
      aria-modal="true"
      role="dialog"
      aria-labelledby="support-settings-title"
    >
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col border border-slate-200">
        <div className="flex items-start justify-between gap-4 p-8 pb-4 shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-100 rounded-2xl text-indigo-600 shrink-0">
              <Accessibility className="h-7 w-7" />
            </div>
            <div>
              <h2 id="support-settings-title" className="text-xl font-black text-slate-900 tracking-tight">
                Support settings
              </h2>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-0.5">Optional · Changeable any time</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all shrink-0"
            aria-label="Close support settings"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-8 pb-4">

        <p className="text-sm text-slate-600 leading-relaxed mb-6">
          These settings help you practise in the way that works best for you. You don't need to explain why you choose them.
        </p>

        <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl mb-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-black text-slate-800">Clear Mode</p>
            <button
              role="switch"
              aria-checked={clearModeEnabled}
              onClick={() => onClearModeEnabledChange(!clearModeEnabled)}
              className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${clearModeEnabled ? 'bg-indigo-600' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${clearModeEnabled ? 'translate-x-5' : ''}`} />
            </button>
          </div>
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            Questions start in an explicit, broken-down form. As you grow confident, you can move to the standard form — you're always in control of when.
          </p>
        </div>

        {clearModeEnabled && (
          <div className="mb-2 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">How questions appear</p>
            {APPEARANCE_OPTIONS.map(opt => (
              <label
                key={opt.value}
                className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${clearModeAppearance === opt.value ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200 hover:border-slate-300'}`}
              >
                <input
                  type="radio"
                  name="clear-mode-appearance"
                  checked={clearModeAppearance === opt.value}
                  onChange={() => onClearModeAppearanceChange(opt.value)}
                  className="mt-1 accent-indigo-600"
                />
                <div>
                  <p className="text-xs font-bold text-slate-800">{opt.label}</p>
                  <p className="text-[11px] text-slate-500 font-medium leading-snug mt-0.5">{opt.description}</p>
                </div>
              </label>
            ))}
          </div>
        )}

        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl mt-2">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-black text-slate-800">Save clips</p>
            <button
              role="switch"
              aria-checked={saveClips === 'device'}
              onClick={() => onSaveClipsChange(saveClips === 'device' ? 'off' : 'device')}
              className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${saveClips === 'device' ? 'bg-indigo-600' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${saveClips === 'device' ? 'translate-x-5' : ''}`} />
            </button>
          </div>
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            Save a recording of each answer (video if your camera is on, audio otherwise) so you can watch or listen back later, in your Reflection Library.
          </p>
          <p className="text-[11px] text-slate-400 font-medium leading-relaxed mt-2">
            Stored only in this browser, never uploaded, never analysed beyond the transcript already used for coaching, and never used to train any model. Delete it any time from your Reflection Library.
          </p>
        </div>

        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl mt-2">
          <p className="text-sm font-black text-slate-800 mb-2">Voice, for Talk It Through and Explain It Visually</p>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Voice</p>
          <div className="flex gap-2 mb-3">
            {(['any', 'female', 'male'] as const).map(opt => (
              <button
                key={opt}
                onClick={() => onVoiceGenderPreferenceChange(opt)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${voiceGenderPreference === opt ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'}`}
              >
                {opt === 'any' ? 'No preference' : opt}
              </button>
            ))}
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Tone</p>
          <div className="flex gap-2">
            {([
              { value: 'warm' as VoiceTone, label: 'Warm' },
              { value: 'direct' as VoiceTone, label: 'Straightforward' },
            ]).map(opt => (
              <button
                key={opt.value}
                onClick={() => onVoiceToneChange(opt.value)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${voiceTone === opt.value ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 font-medium leading-relaxed mt-2">
            Matches your device's available voices as closely as it can — exact voice options depend on your browser and device.
          </p>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 mt-3">AI tutor voice</p>
          <div className="flex gap-2">
            {([
              { value: 'spoken_and_text' as AITutorVoiceMode, label: 'Spoken and text' },
              { value: 'text_only' as AITutorVoiceMode, label: 'Text only' },
            ]).map(opt => (
              <button
                key={opt.value}
                onClick={() => onAiTutorVoiceModeChange(opt.value)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${aiTutorVoiceMode === opt.value ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl mt-2">
          <p className="text-sm font-black text-slate-800 mb-2">Visual explanations</p>
          <div className="flex flex-wrap gap-2">
            {([
              { value: 'always_show_button' as const, label: 'Show the button' },
              { value: 'only_when_asked' as const, label: 'Only when I ask' },
              { value: 'never' as const, label: 'Never' },
            ]).map(opt => (
              <button
                key={opt.value}
                onClick={() => onVisualExplanationsTriggerChange(opt.value)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${visualExplanationsTrigger === opt.value ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 font-medium leading-relaxed mt-2">
            Controls whether "Explain this visually" appears on questions at all. It never opens on its own — choosing "Never" just removes the option.
          </p>
        </div>

        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl mt-2">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-black text-slate-800">Low stimulation screen</p>
            <button
              role="switch"
              aria-checked={lowStimulation}
              onClick={() => onLowStimulationChange(!lowStimulation)}
              className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${lowStimulation ? 'bg-indigo-600' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${lowStimulation ? 'translate-x-5' : ''}`} />
            </button>
          </div>
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            Reduces animation and motion across the app — Talk It Through and Explain It Visually in particular.
          </p>
        </div>

        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl mt-2">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-black text-slate-800">Dyslexia-friendly text</p>
            <button
              role="switch"
              aria-checked={dyslexiaFont}
              onClick={() => onDyslexiaFontChange(!dyslexiaFont)}
              className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${dyslexiaFont ? 'bg-indigo-600' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${dyslexiaFont ? 'translate-x-5' : ''}`} />
            </button>
          </div>
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            Wider letter spacing and a clearer font across the app.
          </p>
        </div>

        </div>

        <div className="p-8 pt-4 shrink-0">
          <button
            onClick={onClose}
            className="w-full px-6 py-3.5 bg-slate-900 text-white rounded-2xl font-bold text-sm hover:bg-indigo-600 transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default SupportSettings;
