import React from 'react';
import { motion } from 'motion/react';
import { Target, ShieldCheck, Brain, Activity, MessageSquare, Award, Printer, X, BookOpen, TrendingUp, Lightbulb, FileText, ArrowUpRight, Sparkles } from 'lucide-react';
import { QuestionSummaryReport, ProbeAnalysis } from '../types';

interface QuestionReportProps {
  questionIndex: number;
  questionText: string;
  starPhaseReached: number;
  summaryReport: QuestionSummaryReport;
  probeAnalysis: ProbeAnalysis | null;
  participantId?: string;
  onClose: () => void;
}

const STAR_LABELS = ['Situation', 'Task', 'Action', 'Result'];

const QuestionReport: React.FC<QuestionReportProps> = ({
  questionIndex,
  questionText,
  starPhaseReached,
  summaryReport: sr,
  probeAnalysis: pa,
  participantId,
  onClose,
}) => {
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
              <BookOpen size={20} />
            </div>
            <div>
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Response Analysis</h2>
              <p className="text-sm font-bold text-slate-900">Q{questionIndex + 1} — Full Report</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-widest"
            >
              <Printer size={18} />
              Print / Save PDF
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

          {/* Title */}
          <div className="border-b-4 border-slate-900 pb-8">
            <h1 className="text-3xl font-black mb-2 uppercase tracking-tight">Response Analysis Report</h1>
            <div className="flex justify-between items-end">
              <div>
                <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Ascend Coherence Auditor</p>
                <p className="text-lg font-bold mt-2">Candidate ID: {participantId || 'Anonymous'}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold">{new Date(sr.timestamp).toLocaleDateString()}</p>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Q{questionIndex + 1} Audit</p>
              </div>
            </div>
          </div>

          {/* Section 1: Question & Answer Overview */}
          <section className="space-y-6">
            <div className="p-8 bg-slate-900 text-white rounded-3xl relative overflow-hidden group">
              <div className="absolute -top-10 -right-10 p-4 opacity-5 group-hover:opacity-10 transition-opacity rotate-12">
                <Brain size={160} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">Interview Question</span>
              <h2 className="text-xl font-black mt-2 leading-tight">"{questionText}"</h2>
              <div className="mt-6 p-4 bg-white/5 rounded-2xl border border-white/10">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Answer Overview</p>
                <p className="text-sm font-medium text-slate-200 leading-relaxed">{sr.answerOverview}</p>
              </div>
            </div>

            {/* Competency Demonstration Level */}
            {sr.competencyDemonstrationLevel && (() => {
              const levelConfig = {
                Emerging:    { bg: 'bg-slate-100',   border: 'border-slate-300',   text: 'text-slate-700',   dot: 'bg-slate-400'   },
                Developing:  { bg: 'bg-amber-50',    border: 'border-amber-300',   text: 'text-amber-800',   dot: 'bg-amber-500'   },
                Established: { bg: 'bg-emerald-50',  border: 'border-emerald-400', text: 'text-emerald-800', dot: 'bg-emerald-500' },
                Advanced:    { bg: 'bg-indigo-50',   border: 'border-indigo-400',  text: 'text-indigo-800',  dot: 'bg-indigo-500'  },
              }[sr.competencyDemonstrationLevel];
              return (
                <div className={`p-6 rounded-3xl border-2 ${levelConfig.bg} ${levelConfig.border} flex items-start gap-5`}>
                  <div className={`w-3 h-3 rounded-full mt-1 shrink-0 ${levelConfig.dot}`} />
                  <div>
                    <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${levelConfig.text}`}>
                      Competency Demonstration — {sr.competencyDemonstrationLevel}
                    </p>
                    <p className={`text-sm font-medium leading-relaxed ${levelConfig.text}`}>
                      {sr.competencyDemonstrationDescriptor}
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Self-Assessment Prompt */}
            {sr.selfAssessmentPrompt && (
              <div className="p-6 bg-white border-2 border-indigo-100 rounded-3xl flex items-start gap-4">
                <div className="p-2 bg-indigo-100 rounded-xl shrink-0">
                  <Brain size={18} className="text-indigo-600" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-2">Reflect First</p>
                  <p className="text-sm font-medium text-slate-700 leading-relaxed italic">{sr.selfAssessmentPrompt}</p>
                </div>
              </div>
            )}

            {/* Calibration Note */}
            {sr.calibrationNote && (
              <div className="p-6 bg-white border-2 border-slate-100 rounded-3xl flex items-start gap-4 shadow-sm">
                <div className="p-2 bg-slate-100 rounded-xl shrink-0">
                  <Sparkles size={18} className="text-slate-500" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Calibration</p>
                  <p className="text-sm font-medium text-slate-700 leading-relaxed">{sr.calibrationNote}</p>
                </div>
              </div>
            )}
          </section>

          {/* Section 2: STAR Performance */}
          <section className="space-y-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-indigo-600 border-b-2 border-indigo-100 pb-2 flex items-center gap-2">
              <Target size={16} />
              1. Narrative Structure (STAR)
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {STAR_LABELS.map((label, idx) => {
                const reached = idx <= starPhaseReached;
                const isCurrent = idx === starPhaseReached;
                return (
                  <div key={label} className={`p-5 rounded-[32px] border-2 flex flex-col items-center gap-4 transition-all ${reached ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-300 opacity-60'}`}>
                    <div className={`p-4 rounded-2xl ${reached ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                      {reached ? <ShieldCheck size={28} /> : <Brain size={28} />}
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-60">{label}</p>
                      <p className="text-xs font-black uppercase">{reached ? (isCurrent ? 'reached' : 'complete') : 'not reached'}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Section 3: Key Strengths */}
          <section className="space-y-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 border-b-2 border-slate-200 pb-2 flex items-center gap-2">
              <ShieldCheck size={16} className="text-emerald-600" />
              2. Key Strengths
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sr.strengths.map((strength, idx) => (
                <div key={idx} className="p-6 bg-emerald-50 border-2 border-emerald-100 rounded-3xl flex gap-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 shrink-0" />
                  <p className="text-sm font-medium text-slate-700 leading-relaxed">{strength}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Section 4: Development Points */}
          <section className="space-y-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 border-b-2 border-slate-200 pb-2 flex items-center gap-2">
              <TrendingUp size={16} className="text-indigo-600" />
              3. Development Points
            </h3>
            <div className="space-y-4">
              {sr.developmentPoints.map((dp, idx) => (
                <div key={idx} className="p-6 bg-amber-50 border-2 border-amber-100 rounded-3xl space-y-3">
                  <p className="text-sm font-black text-amber-900">{dp.gap}</p>
                  <div className="space-y-2">
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      <span className="font-black uppercase tracking-widest text-slate-400 text-[9px] mr-2">Why it matters:</span>
                      {dp.whyItMatters}
                    </p>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      <span className="font-black uppercase tracking-widest text-slate-400 text-[9px] mr-2">Instruction:</span>
                      {dp.instruction}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* CV Alignment Note */}
          {sr.cvAlignmentNote && (
            <section className="space-y-6">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 border-b-2 border-slate-200 pb-2 flex items-center gap-2">
                <FileText size={16} className="text-indigo-600" />
                4. Your Background & This Answer
              </h3>
              <div className="p-6 bg-indigo-50 border-2 border-indigo-100 rounded-3xl flex items-start gap-4">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 shrink-0" />
                <p className="text-sm font-medium text-slate-700 leading-relaxed">{sr.cvAlignmentNote}</p>
              </div>
            </section>
          )}

          {/* Section 5: Probe Engagement */}
          <section className="space-y-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-indigo-600 border-b-2 border-indigo-100 pb-2 flex items-center gap-2">
              <MessageSquare size={16} />
              {sr.cvAlignmentNote ? '5.' : '4.'} Probe Engagement & Correlation
            </h3>
            <div className="space-y-4">
              <div className="p-6 bg-white border-2 border-slate-100 rounded-3xl shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Engagement Narrative</p>
                <p className="text-sm font-medium text-slate-700 leading-relaxed">{sr.probeEngagement}</p>
              </div>
              <div className="p-6 bg-white border-2 border-slate-100 rounded-3xl shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Act–Probe Correlation</p>
                <p className="text-sm font-medium text-slate-700 leading-relaxed">{sr.probeCorrelation}</p>
              </div>
              <div className="p-6 bg-indigo-50 border-2 border-indigo-100 rounded-3xl">
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-2">Integrated Excellence Guidance</p>
                <p className="text-sm font-medium text-slate-700 leading-relaxed">{sr.integratedCoaching}</p>
              </div>
            </div>
          </section>

          {/* Section 6: Psychological Signals (if probe analysis exists) */}
          {pa && (
            <section className="space-y-12">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 border-b-2 border-slate-200 pb-2 flex items-center gap-2">
                <Activity size={16} className="text-indigo-600" />
                5. High-Fidelity Psychological Signals
              </h3>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Ownership Language Signals — no scores shown */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ownership & Impact Signals</h4>
                  <div className="space-y-4">
                    {Object.entries(pa.merit_vectors).filter(([k]) => k !== 'lowest_vector').map(([vector, score]) => {
                      const numScore = score as number;
                      const strength = numScore >= 66 ? 'strong' : numScore >= 33 ? 'developing' : 'low';
                      const isWeakest = pa.merit_vectors.lowest_vector === vector;
                      return (
                        <div key={vector} className="p-4 bg-white border border-slate-100 rounded-2xl flex items-center justify-between shadow-sm">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">
                              {vector === 'autonomy' ? 'Ownership & Agency' : vector === 'competence' ? 'Skill Mastery' : 'Team Impact'}
                            </span>
                            <p className="text-[10px] font-bold text-slate-500">
                              {vector === 'autonomy' ? 'Personal drive and initiative language.' : vector === 'competence' ? 'Specific execution and skill evidence.' : 'Collaborative and business impact language.'}
                            </p>
                          </div>
                          <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${isWeakest ? 'bg-amber-100 text-amber-700' : strength === 'strong' ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>
                            {isWeakest ? 'develop' : strength}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Response Quality Signals */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Response Quality Signals</h4>
                  <div className="space-y-4">
                    {Object.entries(pa.chc_signals).filter(([k]) => k !== 'lowest_signal').map(([signal, level]) => (
                      <div key={signal} className="p-4 bg-white border border-slate-100 rounded-2xl flex items-center justify-between shadow-sm">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            {signal === 'gc' ? 'Professional Vocabulary' : signal === 'gf' ? 'Logical Reasoning' : 'Evidence & Precision'}
                          </span>
                          <p className="text-[10px] font-bold text-slate-800">
                            {signal === 'gc' ? 'Specific, accurate professional language.' : signal === 'gf' ? 'Logic flow in complex or novel situations.' : 'Concrete data, metrics, or named outcomes.'}
                          </p>
                        </div>
                        <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${level === 'strong' ? 'bg-emerald-100 text-emerald-700' : level === 'moderate' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'}`}>
                          {level as string}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Scaffold Assessment */}
              <div className="p-8 bg-slate-900 text-white rounded-[40px] shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-12 opacity-10">
                  <Brain size={140} />
                </div>
                <div className="relative z-10 space-y-4">
                  <div className="inline-flex items-center gap-3 px-4 py-2 bg-indigo-600 rounded-full">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Support Signal: {(pa.scaffold_dependency_signal as string).replace(/_/g, ' ')}</span>
                  </div>
                  <p className="text-2xl font-black leading-tight tracking-tight">{pa.interpretation}</p>
                  <div className="pt-6 border-t border-white/10">
                    <div className={`inline-flex items-center gap-3 px-5 py-3 rounded-2xl border-2 ${pa.proceed ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' : 'bg-amber-500/10 border-amber-500/40 text-amber-400'}`}>
                      <span className="text-sm font-bold uppercase tracking-tight">{pa.reason}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Coaching Guidance */}
              {pa.coaching_guidance && (
                <div className="p-10 bg-indigo-600 text-white rounded-[48px] shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-12 opacity-10 group-hover:rotate-12 transition-transform">
                    <Target size={200} />
                  </div>
                  <div className="relative z-10">
                    <div className="inline-flex items-center gap-3 px-4 py-2 bg-white/10 rounded-full mb-6 border border-white/20">
                      <Sparkles size={16} />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em]">{pa.coaching_guidance.framework_gap} Target</span>
                    </div>
                    <h4 className="text-2xl font-black leading-tight mb-8">{pa.coaching_guidance.instruction}</h4>
                    <div className="p-8 bg-black/20 backdrop-blur-md rounded-[32px] border border-white/10">
                      <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200 mb-4">Strategic Rephrasing Template:</p>
                      <p className="text-lg font-medium italic leading-relaxed">"{pa.coaching_guidance.example_phrase}"</p>
                    </div>
                  </div>
                </div>
              )}

              {/* PJ Observations */}
              {pa.pj_observations && pa.pj_observations.length > 0 && (
                <section className="space-y-6">
                  <h3 className="text-xs font-black uppercase tracking-widest text-indigo-600 border-b-2 border-indigo-100 pb-2 flex items-center gap-2">
                    <MessageSquare size={16} />
                    Clarity & Reliability (Response Audit)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {pa.pj_observations.map((obs, idx) => (
                      <div key={idx} className="p-6 bg-white border-2 border-slate-100 rounded-3xl flex gap-4 shadow-sm">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 shrink-0" />
                        <p className="text-sm font-medium text-slate-700 leading-relaxed italic">"{obs}"</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </section>
          )}

          {/* Forward Orientation */}
          {sr.forwardOrientation && (
            <section className="space-y-6">
              <h3 className="text-xs font-black uppercase tracking-widest text-indigo-600 border-b-2 border-indigo-100 pb-2 flex items-center gap-2">
                <ArrowUpRight size={16} />
                {pa ? '7.' : '6.'} Where This Takes You
              </h3>
              <div className="p-8 bg-gradient-to-br from-indigo-600 to-indigo-800 text-white rounded-[40px] shadow-xl">
                <p className="text-lg font-medium leading-relaxed">{sr.forwardOrientation}</p>
              </div>
            </section>
          )}

          {/* One Thing to Practise */}
          <section className="space-y-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-indigo-600 border-b-2 border-indigo-100 pb-2 flex items-center gap-2">
              <Lightbulb size={16} />
              {pa ? (sr.forwardOrientation ? '8.' : '7.') : (sr.forwardOrientation ? '7.' : '6.')} One Thing to Practise
            </h3>
            <div className="p-8 bg-slate-900 text-white rounded-[40px] shadow-xl">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-indigo-600 rounded-2xl shrink-0">
                  <Award size={24} />
                </div>
                <p className="text-lg font-bold leading-relaxed">{sr.practiceTask}</p>
              </div>
            </div>
          </section>

          {/* Footer */}
          <div className="p-10 bg-indigo-600 text-white rounded-[40px] shadow-2xl relative overflow-hidden">
            <div className="absolute bottom-0 right-0 p-8 opacity-20">
              <Target size={120} />
            </div>
            <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 justify-between">
              <div>
                <h3 className="text-[11px] font-black uppercase tracking-[0.3em] opacity-80 mb-3 text-white">System Integrity Check</h3>
                <p className="text-xl font-bold leading-tight">
                  Response audit complete for Q{questionIndex + 1}.
                  <br />
                  Analysis archived in {participantId || 'local'} repository.
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

export default QuestionReport;
