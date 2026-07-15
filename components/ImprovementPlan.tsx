import React, { useState } from 'react';
import { DetailedFeedback } from '../types';
import { Mic, Users, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  feedback: DetailedFeedback;
}

const Tag: React.FC<{ text: string; variant: 'gap' | 'strength' }> = ({ text, variant }) => {
  const styles = {
    gap:      'bg-rose-50 text-rose-700 border border-rose-200',
    strength: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  };
  return (
    <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${styles[variant]}`}>
      {text}
    </span>
  );
};

interface CollapsibleSectionProps {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  summary: string;
  children: React.ReactNode;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ icon, iconBg, label, summary, children }) => {
  const [open, setOpen] = useState(false);
  return (
    <section className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-4 p-8 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`p-2 ${iconBg} rounded-xl shrink-0`}>{icon}</div>
          <div className="min-w-0">
            <p className="text-sm font-black uppercase tracking-widest text-slate-900">{label}</p>
            {!open && <p className="text-[11px] font-medium text-slate-400 mt-0.5 truncate">{summary}</p>}
          </div>
        </div>
        {open ? <ChevronUp size={16} className="text-slate-400 shrink-0" /> : <ChevronDown size={16} className="text-slate-400 shrink-0" />}
      </button>
      {open && <div className="px-8 pb-8">{children}</div>}
    </section>
  );
};

const ImprovementPlan: React.FC<Props> = ({ feedback }) => {
  const { verbalImprovementPlan: vip, hiringProfileAlignment: hpa, elcLearningCycle: elc } = feedback;
  if (!vip && !hpa && !elc) return null;

  return (
    <div className="space-y-4 mt-8">

      {vip && (
        <CollapsibleSection
          icon={<Mic size={20} className="text-violet-600" />}
          iconBg="bg-violet-100"
          label="Verbal Communication Plan"
          summary={vip.fillerPatterns}
        >
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-violet-50 rounded-2xl border border-violet-100">
                <p className="text-[9px] font-black uppercase tracking-widest text-violet-500 mb-2">Filler Patterns Observed</p>
                <p className="text-sm font-medium text-slate-700 leading-relaxed">{vip.fillerPatterns}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2">Pacing Assessment</p>
                <p className="text-sm font-medium text-slate-700 leading-relaxed">{vip.pacingAssessment}</p>
              </div>
            </div>
            {vip.clarityTargets.length > 0 && (
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">Specific Targets to Change</p>
                <ul className="space-y-2">
                  {vip.clarityTargets.map((t, i) => (
                    <li key={i} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="w-5 h-5 bg-violet-600 text-white text-[9px] font-black rounded-full flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                      <span className="text-sm font-medium text-slate-700">{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
              <p className="text-[9px] font-black uppercase tracking-widest text-indigo-500 mb-2">How to Practice This Week</p>
              <p className="text-sm font-medium text-slate-700 leading-relaxed">{vip.practiceMethod}</p>
            </div>
          </div>
        </CollapsibleSection>
      )}

      {hpa && (
        <CollapsibleSection
          icon={<Users size={20} className="text-amber-600" />}
          iconBg="bg-amber-100"
          label="Hiring Profile Alignment"
          summary={hpa.priorityFix}
        >
          <div className="space-y-6">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">What Interviewers Screen For</p>
              <ul className="space-y-2">
                {hpa.whatInterviewersLookFor.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm font-medium text-slate-700">
                    <span className="text-slate-400 mt-0.5">→</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600 mb-3">Where You Already Match</p>
                <div className="flex flex-wrap gap-2">
                  {hpa.candidateAlignedStrengths.map((s, i) => <Tag key={i} text={s} variant="strength" />)}
                </div>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-rose-600 mb-3">Gaps From Hiring Perspective</p>
                <div className="flex flex-wrap gap-2">
                  {hpa.profileGaps.map((g, i) => <Tag key={i} text={g} variant="gap" />)}
                </div>
              </div>
            </div>
            <div className="p-5 bg-amber-50 rounded-2xl border border-amber-200">
              <p className="text-[9px] font-black uppercase tracking-widest text-amber-600 mb-2">Priority Fix — The One Change That Matters Most</p>
              <p className="text-sm font-bold text-slate-800 leading-relaxed">{hpa.priorityFix}</p>
            </div>
          </div>
        </CollapsibleSection>
      )}

      {elc && (
        <CollapsibleSection
          icon={<RefreshCw size={20} className="text-teal-600" />}
          iconBg="bg-teal-100"
          label="Your Learning Cycle This Session"
          summary={elc.experimentationTarget}
        >
          <p className="text-[10px] font-medium text-slate-500 mb-6">
            Based on Kolb's Experiential Learning Cycle — each session completes four stages of learning.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { stage: '01 · Practice', label: 'Concrete Experience', value: elc.concreteExperienceBaseline, color: 'bg-teal-50 border-teal-100', accent: 'text-teal-600' },
              { stage: '02 · Reflect', label: 'Reflective Observation', value: elc.reflectiveObservationInsight, color: 'bg-sky-50 border-sky-100', accent: 'text-sky-600' },
              { stage: '03 · Understand', label: 'Abstract Principle', value: elc.abstractPrinciple, color: 'bg-indigo-50 border-indigo-100', accent: 'text-indigo-600' },
              { stage: '04 · Apply', label: 'Experimentation Target', value: elc.experimentationTarget, color: 'bg-violet-50 border-violet-100', accent: 'text-violet-600' },
            ].map(({ stage, label, value, color, accent }) => (
              <div key={stage} className={`p-5 rounded-2xl border ${color}`}>
                <p className={`text-[9px] font-black uppercase tracking-widest ${accent} mb-1`}>{stage}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">{label}</p>
                <p className="text-sm font-medium text-slate-700 leading-relaxed">{value}</p>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

    </div>
  );
};

export default ImprovementPlan;
