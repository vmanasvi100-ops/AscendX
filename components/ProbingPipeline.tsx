import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Brain, Target, ShieldCheck, Sparkles, ChevronRight, Activity, ArrowRight, UserCheck, AlertCircle, Users, BarChart3, ShieldAlert, TrendingUp, TrendingDown, MessageSquare } from 'lucide-react';
import { Probe, ProbeAnalysis } from '../types';
import ProbingReport from './ProbingReport';

interface ProbingPipelineProps {
  currentProbe: Probe | null;
  analysis: ProbeAnalysis | null;
  isGenerating: boolean;
  revealCountdown?: number;
  participantId?: string;
}

const ProbingPipeline: React.FC<ProbingPipelineProps> = ({
  currentProbe,
  analysis,
  isGenerating,
  revealCountdown = 0,
  participantId
}) => {
  const [activeTab, setActiveTab] = useState<'probe' | 'analysis'>('probe');
  const [showFullReport, setShowFullReport] = useState(false);

  useEffect(() => {
    if (analysis) {
      setActiveTab('analysis');
    } else {
      setActiveTab('probe');
    }
  }, [analysis]);

  return (
    <div className="flex flex-col h-full bg-slate-50/50 rounded-[32px] border border-slate-200 overflow-hidden shadow-inner">
      <div className="px-3 py-3 border-b bg-white flex items-center justify-between gap-2">
        <div className="flex items-center min-w-0">
          <h3 className="text-[10px] font-black uppercase tracking-tight text-slate-500 truncate">Follow-up Session</h3>
        </div>

        <div className="flex bg-slate-50 p-0.5 rounded-lg border border-slate-100 shrink-0">
          <button
            onClick={() => setActiveTab('probe')}
            className={`px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-tight transition-all ${activeTab === 'probe' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200/50' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Probe
          </button>
          <button
            onClick={() => setActiveTab('analysis')}
            disabled={!analysis}
            className={`px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-tight transition-all ${activeTab === 'analysis' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200/50' : 'text-slate-400 hover:text-slate-600 disabled:opacity-50'}`}
          >
            Insights
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar relative">
        <AnimatePresence mode="wait">
          {revealCountdown > 0 ? (
            <motion.div
              key="reveal"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="h-full flex flex-col items-center justify-center text-center gap-8 bg-white/95 backdrop-blur-sm z-[100] relative"
            >
              <div className="relative">
                <div className="w-32 h-32 border-8 border-indigo-50 border-t-indigo-600 rounded-full animate-[spin_3s_linear_infinite]"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-5xl font-black text-indigo-600 tabular-nums">{revealCountdown}</span>
                </div>
              </div>
              <div className="space-y-4">
                <p className="text-lg font-black uppercase tracking-[0.4em] text-slate-900">Analysis Complete</p>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest max-w-xs mx-auto leading-relaxed px-6">
                  Analyzing your response. A strategic follow-up probe will be visible in 3 seconds to help you deepen your evidence.
                </p>
              </div>
            </motion.div>
          ) : isGenerating && !analysis ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="h-full flex flex-col items-center justify-center text-center gap-6"
            >
              <div className="relative">
                <div className="w-24 h-24 border-4 border-indigo-50 border-t-indigo-600 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Brain className="text-indigo-600 animate-bounce" size={32} />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-black uppercase tracking-[0.3em] text-slate-900">Analyzing Response</p>
                <div className="w-48 h-1 bg-slate-100 rounded-full overflow-hidden mx-auto">
                  <motion.div
                    className="h-full bg-indigo-600"
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  />
                </div>
                <div className="space-y-3">
                  <p className="text-sm font-black uppercase tracking-widest text-indigo-600 animate-pulse">
                    Relax while the probing question is being prepared
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                    You are doing well. Stay focused on your core logic.
                  </p>
                  <p className="text-[9px] font-black text-slate-300 uppercase tracking-tighter">
                    Applying Procedural Justice Framework
                  </p>
                </div>
              </div>
            </motion.div>
          ) : activeTab === 'probe' && currentProbe ? (
            <motion.div
              key="probe"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              {isGenerating && (
                <div className="absolute inset-0 z-50 bg-white/90 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center gap-6">
                  <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                  <div className="space-y-4">
                    <p className="text-sm font-black uppercase tracking-widest text-indigo-600 animate-pulse">
                      Relax while the probing question is being prepared
                    </p>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-relaxed max-w-xs">
                      You are doing well. Stay focused on your core logic.
                    </p>
                  </div>
                </div>
              )}
              <div className="p-8 bg-white rounded-[40px] border border-indigo-100 shadow-xl shadow-indigo-900/5 relative overflow-hidden group">
                <div className="absolute -top-10 -right-10 p-4 opacity-5 group-hover:opacity-10 transition-opacity rotate-12">
                  <Target size={160} />
                </div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="px-3 py-1 bg-indigo-600 text-white rounded-full text-[9px] font-black uppercase tracking-widest">
                    {currentProbe.probe_type.replace(/_/g, ' ')}
                  </div>
                  <div className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[9px] font-black uppercase tracking-widest">
                    {currentProbe.question_type.replace(/_/g, ' ')}
                  </div>
                </div>
                <h4 className="text-lg font-black text-slate-900 leading-tight mb-6">
                  {currentProbe.probe}
                </h4>
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[11px] font-medium text-slate-500 leading-relaxed">
                    <span className="font-black uppercase text-slate-400 mr-2 tracking-widest">Rationale:</span>
                    {currentProbe.rationale}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-5 bg-white rounded-3xl border border-slate-200 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-indigo-600">
                      <Target size={16} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Alignment</span>
                    </div>
                    <span className="text-[10px] font-black text-slate-400">75%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: "75%" }}
                      className="h-full bg-indigo-500"
                    />
                  </div>
                </div>
                <div className="p-5 bg-white rounded-3xl border border-slate-200 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-600">
                      <ShieldCheck size={16} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Fairness</span>
                    </div>
                    <span className="text-[10px] font-black text-slate-400">90%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: "90%" }}
                      className="h-full bg-emerald-500"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          ) : activeTab === 'analysis' && analysis ? (
            <motion.div
              key="analysis"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {isGenerating && (
                <div className="sticky top-0 z-50 -mx-6 -mt-6 mb-8 px-6 py-4 bg-indigo-600 text-white border-b border-indigo-700 shadow-xl animate-fade-in">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span className="text-[10px] font-black uppercase tracking-widest">Synthesizing Next Probe...</span>
                    </div>
                    <span className="text-[9px] font-bold opacity-60 uppercase tracking-widest">Previous insights active</span>
                  </div>
                  <div className="pl-8 border-l-2 border-white/20">
                    <p className="text-[11px] font-black uppercase tracking-widest leading-tight">
                      Relax while the probing question is being prepared
                    </p>
                    <p className="text-[9px] font-bold opacity-80 uppercase tracking-tighter mt-1">
                      You are doing well. Stay focused.
                    </p>
                  </div>
                </div>
              )}


              <div className={`p-6 rounded-[32px] border ${analysis.probe_successful ? 'bg-indigo-50 border-indigo-200 shadow-indigo-900/5' : 'bg-slate-50 border-slate-200'} shadow-sm flex items-start gap-4`}>
                <div className={`p-3 rounded-2xl shrink-0 ${analysis.probe_successful ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                  <Activity size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Immediate Response</h4>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${analysis.depth_delta === 'increased' ? 'bg-emerald-100 text-emerald-700' :
                      analysis.depth_delta === 'decreased' ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-700'
                      }`}>
                      Depth: {analysis.depth_delta}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-slate-700 leading-relaxed mb-4">{analysis.evidence_added}</p>

                  {analysis.contextual_anchor && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl border border-indigo-100">
                      <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Next Anchor:</span>
                      <span className="text-[10px] font-black italic text-indigo-700">"{analysis.contextual_anchor}"</span>
                    </div>
                  )}
                </div>
              </div>

              {/* STAR Progression Dashboard */}
              <div className="bg-white rounded-[40px] border border-slate-200 p-8 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <Target size={18} className="text-indigo-600" />
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-900">STAR Progression</h4>
                  </div>
                  {analysis.weakest_star_component && (
                    <span className="text-[9px] font-bold text-rose-500 bg-rose-50 px-3 py-1 rounded-full uppercase tracking-widest">
                      Focus: {analysis.weakest_star_component}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {Object.entries(analysis.star_status).map(([component, status]) => (
                    <div key={component} className="flex flex-col items-center gap-3">
                      <div className={`w-full h-12 rounded-2xl flex items-center justify-center border-2 transition-all ${status === 'complete' ? 'bg-emerald-50 border-emerald-500 text-emerald-600' :
                        status === 'partial' ? 'bg-amber-50 border-amber-400 text-amber-600' :
                          status === 'not_yet_required' ? 'bg-slate-50 border-slate-200 text-slate-300 opacity-50' :
                            'bg-slate-50 border-slate-200 text-slate-300'
                        }`}>
                        {status === 'complete' ? <ShieldCheck size={20} /> :
                          status === 'partial' ? <Activity size={20} /> :
                            status === 'not_yet_required' ? <Brain size={20} /> :
                              <AlertCircle size={20} />}
                      </div>
                      <span className={`text-[9px] font-black uppercase tracking-widest text-center ${status === 'complete' ? 'text-emerald-700' :
                        status === 'partial' ? 'text-amber-700' :
                          status === 'not_yet_required' ? 'text-slate-400' :
                            'text-slate-400'
                        }`}>
                        {component.charAt(0)}
                        {status === 'not_yet_required' && <><br /><span className="text-[7px] font-bold">Not reached yet</span></>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>



              {/* ZPD Scaffold Assessment */}
              <div className="bg-slate-900 text-white rounded-[32px] p-6 shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <Brain size={120} />
                </div>
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-4">
                    <Sparkles size={16} className="text-indigo-400" />
                    <h5 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Scaffold Assessment</h5>
                  </div>
                  <div className="flex items-end gap-3 mb-4">
                    <span className="text-base font-black tracking-wider text-white">
                      {analysis.scaffold_dependency_signal.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-slate-300 leading-relaxed italic border-l-2 border-indigo-500 pl-4">
                    "{analysis.interpretation}"
                  </p>
                </div>
              </div>

              {/* Procedural Justice Observations (Communicative Precision) */}
              {analysis.pj_observations && analysis.pj_observations.length > 0 && (
                <div className="bg-white rounded-[40px] border border-slate-200 p-8 shadow-sm">
                  <div className="flex items-center gap-2 mb-6">
                    <MessageSquare size={18} className="text-indigo-600" />
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-900">Communicative Precision</h4>
                  </div>
                  <div className="space-y-4">
                    {analysis.pj_observations.map((obs, idx) => (
                      <div key={idx} className="flex gap-4 items-start p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full mt-1.5 shrink-0" />
                        <p className="text-xs font-medium text-slate-700 leading-relaxed">
                          {obs}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="text-[9px] text-slate-400 mt-6 uppercase font-black tracking-widest text-center">Diagnostic Lens: Procedural Justice (Qualitative)</p>
                </div>
              )}

              {/* Proceed Decision Alert */}
              <div className={`flex gap-4 p-5 rounded-[24px] border ${analysis.proceed ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
                }`}>
                <div className={`p-2 shrink-0 rounded-xl h-fit ${analysis.proceed ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                  }`}>
                  {analysis.proceed ? <ArrowRight size={20} /> : <AlertCircle size={20} />}
                </div>
                <div>
                  <h5 className={`text-[10px] font-black uppercase tracking-widest mb-1 ${analysis.proceed ? 'text-emerald-700' : 'text-amber-700'
                    }`}>
                    {analysis.proceed ? 'System Action: Proceed' : 'System Action: Hold & Probe'}
                  </h5>
                  <p className={`text-xs font-medium ${analysis.proceed ? 'text-emerald-800' : 'text-amber-800'
                    }`}>
                    {analysis.reason}
                  </p>
                </div>
              </div>

              {/* View Full Report Button */}
              <button
                onClick={() => setShowFullReport(true)}
                className="w-full py-4 bg-slate-900 text-white rounded-[24px] font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:bg-indigo-600 transition-all flex items-center justify-center gap-3 group"
              >
                <Sparkles size={16} className="group-hover:animate-pulse" />
                View Full Insight Report
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-full flex flex-col items-center justify-center text-center gap-6 opacity-20"
            >
              <div className="p-8 bg-slate-200 rounded-full">
                <Brain size={64} className="text-slate-400" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-black uppercase tracking-[0.4em] text-slate-900"></p>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Awaiting Candidate Input</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {currentProbe && !analysis && !isGenerating && (
        <div className="p-6 bg-white border-t">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex items-center gap-2 text-indigo-600 animate-pulse">
              <Brain size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Awaiting Verbal Input</span>
            </div>
            <p className="text-[11px] font-medium text-slate-500 leading-relaxed">
              Use the <span className="font-black text-slate-900">"Answer Probe"</span> button in the main console to record your situational response.
            </p>
          </div>
        </div>
      )}

      {/* Full Report Modal */}
      <AnimatePresence>
        {showFullReport && currentProbe && analysis && (
          <ProbingReport
            probe={currentProbe}
            analysis={analysis}
            onClose={() => setShowFullReport(false)}
            participantId={participantId}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProbingPipeline;
