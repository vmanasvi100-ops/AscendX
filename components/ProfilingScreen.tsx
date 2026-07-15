
import React, { useState } from 'react';
import type { CandidateProfile } from '../types';

interface ProfilingScreenProps {
  onComplete: (profile: CandidateProfile) => void;
}

type Step = 0 | 1 | 2 | 3 | 4;

interface Question {
  id: keyof CandidateProfile;
  text: string;
  subtext: string;
  options: { label: string; value: string }[];
}

const QUESTIONS: Question[] = [
  {
    id: 'experience',
    text: 'How many real job interviews have you done before?',
    subtext: 'This helps calibrate how much guidance the session provides.',
    options: [
      { label: 'None or one — this is quite new for me', value: 'novice' },
      { label: 'A handful — I have some idea of what to expect', value: 'some' },
      { label: 'Quite a few — I feel reasonably comfortable', value: 'experienced' },
      { label: 'Many — interviews are familiar territory', value: 'expert' },
    ],
  },
  {
    id: 'feedbackLiteracy',
    text: 'When you receive feedback, what feels most natural?',
    subtext: 'This shapes how suggestions are framed for you.',
    options: [
      { label: 'I take notes and act on it straight away', value: 'absorbs' },
      { label: 'I prefer to think it over before deciding what to use', value: 'reflects' },
      { label: 'I often find it hard to know what to prioritise', value: 'overwhelmed' },
      { label: 'I usually feel unsure what it means in practice', value: 'uncertain' },
    ],
  },
  {
    id: 'regulatoryFocus',
    text: 'When preparing for something important, you tend to…',
    subtext: 'This shapes whether feedback focuses on strengths or corrections.',
    options: [
      { label: 'Focus on what I want to achieve', value: 'promotion' },
      { label: 'Focus on avoiding mistakes', value: 'prevention' },
      { label: 'A mix of both', value: 'mixed' },
      { label: "I don't really have a fixed approach", value: 'unclear' },
    ],
  },
  {
    id: 'anxietyLevel',
    text: 'When put on the spot in a conversation, you tend to…',
    subtext: 'This adjusts the tone of follow-up questions.',
    options: [
      { label: 'Stay calm and think clearly', value: 'low' },
      { label: 'Feel a little flustered but recover quickly', value: 'mild' },
      { label: 'Struggle to find the right words', value: 'moderate' },
      { label: 'Go blank and need a moment to reset', value: 'high' },
    ],
  },
  {
    id: 'seeksFeedback',
    text: 'Outside of formal settings, how do you usually get feedback on your work?',
    subtext: 'This shapes how the session encourages you to use feedback going forward.',
    options: [
      { label: 'I actively ask for it — from peers, mentors, or anyone I trust', value: 'proactive' },
      { label: 'I wait until feedback is offered, then I use it', value: 'responsive' },
      { label: 'I tend to avoid it — it can feel uncomfortable', value: 'avoidant' },
      { label: "I'm not sure I have a consistent pattern", value: 'uncertain' },
    ],
  },
];

const ProfilingScreen: React.FC<ProfilingScreenProps> = ({ onComplete }) => {
  const [step, setStep] = useState<Step>(0);
  const [answers, setAnswers] = useState<Partial<CandidateProfile>>({});

  const current = QUESTIONS[step];
  const selected = answers[current.id];

  const handleSelect = (value: string) => {
    setAnswers(prev => ({ ...prev, [current.id]: value }));
  };

  const handleNext = () => {
    if (!selected) return;
    if (step < 4) {
      setStep((step + 1) as Step);
    } else {
      onComplete(answers as CandidateProfile);
    }
  };

  const isLast = step === 4;

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-100 p-4 sm:p-6 md:p-8 animate-fade-in">
      <div className="w-full max-w-lg mx-auto bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">

        {/* Progress bar */}
        <div className="h-1 bg-slate-100">
          <div
            className="h-1 bg-indigo-600 transition-all duration-500"
            style={{ width: `${((step + 1) / 5) * 100}%` }}
          />
        </div>

        <div className="p-8">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">
              Question {step + 1} of 5
            </span>
          </div>

          <h2 className="text-xl font-black text-slate-900 mb-1 leading-snug">
            {current.text}
          </h2>
          <p className="text-sm text-slate-500 mb-8">{current.subtext}</p>

          <div className="space-y-3 mb-8">
            {current.options.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelect(opt.value)}
                className={`w-full text-left px-5 py-4 rounded-xl border-2 text-sm font-medium transition-all ${
                  selected === opt.value
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
                    : 'border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-slate-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={!selected}
            onClick={handleNext}
            className="w-full py-4 rounded-xl font-black text-sm uppercase tracking-[0.15em] text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-200"
          >
            {isLast ? 'Start Session' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfilingScreen;
