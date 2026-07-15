import React from 'react';
import { RefreshCw } from 'lucide-react';

interface ELCStages {
  ce: string;
  ro: string;
  ac: string;
  ae: string;
}

interface Props {
  stages: ELCStages;
}

const STAGES = [
  { key: 'ce' as const, index: '01', label: 'Concrete Experience', sub: 'What you showed', color: 'bg-teal-50 border-teal-100', accent: 'text-teal-600' },
  { key: 'ro' as const, index: '02', label: 'Reflective Observation', sub: 'What the probe revealed', color: 'bg-sky-50 border-sky-100', accent: 'text-sky-600' },
  { key: 'ac' as const, index: '03', label: 'Abstract Principle', sub: 'Transferable insight', color: 'bg-indigo-50 border-indigo-100', accent: 'text-indigo-600' },
  { key: 'ae' as const, index: '04', label: 'Experimentation Target', sub: 'Next action', color: 'bg-violet-50 border-violet-100', accent: 'text-violet-600' },
];

const ELCQuestionTrace: React.FC<Props> = ({ stages }) => (
  <div className="mt-4 p-4 rounded-2xl border border-slate-100 bg-slate-50">
    <div className="flex items-center gap-2 mb-3">
      <RefreshCw size={13} className="text-teal-600" />
      <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
        Learning Cycle Trace — Kolb ELC
      </span>
    </div>
    <div className="grid grid-cols-2 gap-2">
      {STAGES.map(({ key, index, label, sub, color, accent }) => (
        <div key={key} className={`p-3 rounded-xl border ${color}`}>
          <p className={`text-[8px] font-black uppercase tracking-widest ${accent} mb-0.5`}>
            {index} · {label}
          </p>
          <p className="text-[9px] font-medium text-slate-400 mb-1">{sub}</p>
          <p className="text-[11px] font-medium text-slate-700 leading-relaxed">{stages[key]}</p>
        </div>
      ))}
    </div>
  </div>
);

export default ELCQuestionTrace;
