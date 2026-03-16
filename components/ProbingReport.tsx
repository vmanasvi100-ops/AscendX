import React from 'react';
import { motion } from 'motion/react';
import { Target, ShieldCheck, Sparkles, Brain, Activity, MessageSquare, ShieldAlert, ArrowRight, Download, Printer, X } from 'lucide-react';
import { Probe, ProbeAnalysis } from '../types';

interface ProbingReportProps {
  probe: Probe;
  analysis: ProbeAnalysis;
  onClose: () => void;
  participantId?: string;
}

const ProbingReport: React.FC<ProbingReportProps> = ({ probe, analysis, onClose, participantId }) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-8 bg-slate-900/60 backdrop-blur-sm"
    >
      <div className="bg-white w-full max-w-4xl max-h-full overflow-y-auto rounded-[40px] shadow-2xl flex flex-col custom-scrollbar">
        {/* Header Actions */}
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md px-8 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-indigo-600 text-white rounded-xl">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Diagnostic Module</h2>
              <p className="text-sm font-bold text-slate-900">Probing Insight Report</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handlePrint}
              className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-widest"
            >
              <Printer size={18} />
              Print
            </button>
            <button 
              onClick={() => {
                const content = `
# PROBING INSIGHT REPORT
Candidate: ${participantId || 'Anonymous'}
Date: ${new Date().toLocaleString()}

## THE PROBE
"${probe.probe}"
Rationale: ${probe.rationale}

## ANALYSIS
Success: ${analysis.probe_successful ? 'YES' : 'NO'}
Evidence Delta: ${analysis.evidence_added}
Depth Delta: ${analysis.depth_delta}

## STAR PROGRESSION
${Object.entries(analysis.star_status).map(([k, v]) => `- ${k.toUpperCase()}: ${(v as string).replace('_', ' ')}`).join('\n')}

## SCAFFOLD ASSESSMENT
Signal: ${analysis.scaffold_dependency_signal}
Interpretation: ${analysis.interpretation}
Decision: ${analysis.reason}

## COACHING TIP
${analysis.coaching_tip || 'No tip generated for this turn.'}
`.trim();
                const blob = new Blob([content], { type: 'text/markdown' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Probing_Analysis_${new Date().toISOString().split('T')[0]}.md`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-700 transition-all"
            >
              <Download size={16} />
              Download Analysis
            </button>
            <button 
              onClick={onClose}
              className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 transition-all"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Report Content */}
        <div className="p-8 md:p-12 space-y-12 max-w-[800px] mx-auto w-full">
          {/* Title Section */}
          <div className="border-b-4 border-slate-900 pb-8">
            <h1 className="text-3xl font-black mb-2 uppercase tracking-tight">Probing Deep-Dive Analysis</h1>
            <div className="flex justify-between items-end">
              <div>
                <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">AscendX Coherence Auditor</p>
                <p className="text-lg font-bold mt-2">Candidate ID: {participantId || "Anonymous"}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold">{new Date().toLocaleDateString()}</p>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Real-time Probe Audit</p>
              </div>
            </div>
          </div>

          {/* Section 1: Probe Context */}
          <div className="space-y-6">
            <div className="p-8 bg-slate-900 text-white rounded-3xl relative overflow-hidden group">
              <div className="absolute -top-10 -right-10 p-4 opacity-5 group-hover:opacity-10 transition-opacity rotate-12">
                <Brain size={160} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">The Probe</span>
              <h2 className="text-xl font-black mt-2 leading-tight">"{probe.probe}"</h2>
              <div className="mt-6 p-4 bg-white/5 rounded-2xl border border-white/10">
                <p className="text-xs font-medium text-slate-300">
                  <span className="font-black uppercase text-slate-400 mr-2 tracking-widest text-[9px]">Strategic Logic:</span>
                  {probe.rationale}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={`p-6 rounded-3xl border-2 ${analysis.probe_successful ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-2 rounded-xl ${analysis.probe_successful ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'}`}>
                    <ShieldCheck size={20} />
                  </div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">Success Signal</h3>
                </div>
                <p className="text-sm font-bold text-slate-800">
                  {analysis.probe_successful ? 'The candidate successfully navigated the procedural anchor.' : 'The candidate showed hesitation or low-fidelity anchoring.'}
                </p>
              </div>

              <div className="p-6 rounded-3xl border-2 bg-indigo-50 border-indigo-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-indigo-600 text-white rounded-xl">
                    <Activity size={20} />
                  </div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">Evidence Delta</h3>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                    analysis.depth_delta === 'increased' ? 'bg-emerald-100 text-emerald-700' :
                    analysis.depth_delta === 'decreased' ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-700'
                  }`}>
                    Depth: {analysis.depth_delta}
                  </span>
                </div>
                <p className="text-sm font-bold text-slate-800">{analysis.evidence_added}</p>
              </div>
            </div>
          </div>

          {/* Section 2: STAR Progression */}
          <section className="space-y-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-indigo-600 border-b-2 border-indigo-100 pb-2 flex items-center gap-2">
              <Target size={16} />
              1. Narrative Structure (STAR)
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(analysis.star_status).map(([component, status]) => (
                <div key={component} className={`p-5 rounded-[32px] border-2 flex flex-col items-center gap-4 transition-all ${
                  status === 'complete' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' :
                  status === 'partial' ? 'bg-amber-50 border-amber-400 text-amber-700' :
                  'bg-slate-50 border-slate-200 text-slate-300 opacity-60'
                }`}>
                  <div className={`p-4 rounded-2xl ${
                    status === 'complete' ? 'bg-emerald-100' :
                    status === 'partial' ? 'bg-amber-100' :
                    'bg-slate-100'
                  }`}>
                    {status === 'complete' ? <ShieldCheck size={28} /> :
                     status === 'partial' ? <Activity size={28} /> : 
                     <Brain size={28} />}
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60">{component}</p>
                    <p className="text-xs font-black uppercase">{(status as string).replace('_', ' ')}</p>
                  </div>
                </div>
              ))}
            </div>
            {analysis.weakest_star_component && (
              <div className="p-6 bg-rose-50 border-2 border-rose-200 rounded-[32px] flex items-center gap-4">
                <div className="p-3 bg-rose-600 text-white rounded-2xl shadow-lg shadow-rose-900/20">
                  <ShieldAlert size={24} />
                </div>
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-rose-600 mb-1">Structural Weakness Detected</h4>
                  <p className="text-sm font-black text-rose-900 leading-tight">
                    The focus should be on strengthening the <span className="underline decoration-2 underline-offset-4">{analysis.weakest_star_component.toUpperCase()}</span> component.
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* Section 3: Scaffold Assessment */}
          <section className="space-y-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 border-b-2 border-slate-200 pb-2 flex items-center gap-2">
              <Sparkles size={16} className="text-indigo-600" />
              2. Scaffold Assessment (Scientific Signal)
            </h3>
            <div className="p-8 bg-slate-900 text-white rounded-[40px] shadow-xl relative overflow-hidden">
               <div className="absolute top-0 right-0 p-12 opacity-10">
                <Brain size={140} />
              </div>
              <div className="relative z-10 space-y-4">
                <div className="inline-flex items-center gap-3 px-4 py-2 bg-indigo-600 rounded-full">
                   <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                   <span className="text-[10px] font-black uppercase tracking-[0.2em]">Signal: {(analysis.scaffold_dependency_signal as string).replace('_', ' ')}</span>
                </div>
                <p className="text-2xl font-black leading-tight tracking-tight">
                  {analysis.interpretation}
                </p>
                <div className="pt-6 border-t border-white/10">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Procedural decision logic</p>
                  <div className={`inline-flex items-center gap-3 px-5 py-3 rounded-2xl border-2 ${analysis.proceed ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' : 'bg-amber-500/10 border-amber-500/40 text-amber-400'}`}>
                    {analysis.proceed ? <ArrowRight size={20} /> : <Activity size={20} />}
                    <span className="text-sm font-bold uppercase tracking-tight">{analysis.reason}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 4: Qualitative Observations */}
          {analysis.pj_observations && analysis.pj_observations.length > 0 && (
            <section className="space-y-6">
              <h3 className="text-xs font-black uppercase tracking-widest text-indigo-600 border-b-2 border-indigo-100 pb-2 flex items-center gap-2">
                <MessageSquare size={16} />
                3. Communicative Precision (Procedural Justice)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {analysis.pj_observations.map((obs, idx) => (
                  <div key={idx} className="p-6 bg-white border-2 border-slate-100 rounded-3xl hover:border-indigo-200 transition-all flex gap-4 shadow-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 shrink-0" />
                    <p className="text-sm font-medium text-slate-700 leading-relaxed italic">
                      "{obs}"
                    </p>
                  </div>
                ))}
              </div>
              <div className="pt-4 text-center">
                 <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-8 py-2 border border-slate-100 rounded-full inline-block">
                   Analytical framework: PJ Qualitative Audit
                 </p>
              </div>
            </section>
          )}

          {/* Footer Card */}
          <div className="p-10 bg-indigo-600 text-white rounded-[40px] shadow-2xl relative overflow-hidden">
            <div className="absolute bottom-0 right-0 p-8 opacity-20">
               <Target size={120} />
            </div>
            <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 justify-between">
              <div>
                <h3 className="text-[11px] font-black uppercase tracking-[0.3em] opacity-80 mb-3 text-white">System Integrity Check</h3>
                <p className="text-xl font-bold leading-tight">
                  Real-time Merit alignment check complete. 
                  <br />
                  Analysis archived in {participantId || "local"} repository.
                </p>
              </div>
              <div className="shrink-0 p-4 bg-white/10 backdrop-blur-md rounded-3xl border border-white/20">
                <span className="text-xs font-black tracking-widest uppercase">Diagnostic Active</span>
              </div>
            </div>
          </div>

          <div className="text-center pt-8 border-t">
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">© 2026 ASCEND: COHERENCE AUDITOR • PROFESSIONAL INSIGHTS</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default ProbingReport;
