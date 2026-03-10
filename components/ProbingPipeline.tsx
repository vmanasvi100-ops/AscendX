
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Brain, Target, Users, ShieldCheck, Sparkles, ChevronRight, BarChart3, ShieldAlert } from 'lucide-react';
import { Probe, ProbeAnalysis } from '../types';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';

interface ProbingPipelineProps {
  currentProbe: Probe | null;
  analysis: ProbeAnalysis | null;
  isGenerating: boolean;
}

const ProbingPipeline: React.FC<ProbingPipelineProps> = ({ 
  currentProbe, 
  analysis, 
  isGenerating
}) => {
  const [activeTab, setActiveTab] = useState<'probe' | 'analysis'>('probe');

  useEffect(() => {
    if (analysis) {
      setActiveTab('analysis');
    } else {
      setActiveTab('probe');
    }
  }, [analysis]);

  const radarData = analysis ? [
    { subject: 'Strategic', A: 80, fullMark: 100 },
    { subject: 'Stakeholder', A: 70, fullMark: 100 },
    { subject: 'Integrity', A: 90, fullMark: 100 },
    { subject: 'Autonomy', A: analysis.meritVectors.autonomy, fullMark: 100 },
    { subject: 'Competence', A: analysis.meritVectors.competence, fullMark: 100 },
    { subject: 'Relatedness', A: analysis.meritVectors.relatedness, fullMark: 100 },
    { subject: 'Impression', A: analysis.impressionManagementScore, fullMark: 100 },
  ] : [];

  return (
    <div className="flex flex-col h-full bg-slate-50/50 rounded-[32px] border border-slate-200 overflow-hidden shadow-inner">
      <div className="p-6 border-b bg-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-xl text-indigo-600">
            <Brain size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Probing Pipeline</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Real-time Domain Analysis</p>
          </div>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab('probe')}
            className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'probe' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Active Probe
          </button>
          <button 
            onClick={() => setActiveTab('analysis')}
            disabled={!analysis}
            className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'analysis' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 disabled:opacity-50'}`}
          >
            Insights
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar relative">
        <AnimatePresence mode="wait">
          {isGenerating ? (
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
                <p className="text-sm font-black uppercase tracking-[0.3em] text-slate-900">Synthesizing Domain Probe</p>
                <div className="w-48 h-1 bg-slate-100 rounded-full overflow-hidden mx-auto">
                  <motion.div 
                    className="h-full bg-indigo-600"
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  />
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Applying Procedural Justice Framework</p>
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
              <div className="p-8 bg-white rounded-[40px] border border-indigo-100 shadow-xl shadow-indigo-900/5 relative overflow-hidden group">
                <div className="absolute -top-10 -right-10 p-4 opacity-5 group-hover:opacity-10 transition-opacity rotate-12">
                  <Target size={160} />
                </div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="px-3 py-1 bg-indigo-600 text-white rounded-full text-[9px] font-black uppercase tracking-widest">
                    {currentProbe.focus.replace('_', ' ')}
                  </div>
                  <div className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[9px] font-black uppercase tracking-widest">
                    {currentProbe.psychologicalPrinciple}
                  </div>
                </div>
                <h4 className="text-xl font-black text-slate-900 leading-tight mb-6">
                  {currentProbe.question}
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
                      <Users size={16} />
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
              <div className="bg-white rounded-[40px] border border-slate-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Judgement Profile</h4>
                  <Sparkles size={14} className="text-indigo-500" />
                </div>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                      <PolarGrid stroke="#f1f5f9" />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fontWeight: 900, fill: '#94a3b8', letterSpacing: '0.1em' }} />
                      <Radar
                        name="Candidate"
                        dataKey="A"
                        stroke="#4f46e5"
                        fill="#4f46e5"
                        fillOpacity={0.5}
                        strokeWidth={2}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="space-y-4">
                {[
                  { label: 'Strategic Alignment', value: analysis.strategicAlignment, icon: Target, color: 'blue' },
                  { label: 'Stakeholder Management', value: analysis.stakeholderManagement, icon: Users, color: 'emerald' },
                  { label: 'Operational Integrity', value: analysis.operationalIntegrity, icon: ShieldCheck, color: 'amber' }
                ].map((item, idx) => (
                  <motion.div 
                    key={item.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="flex gap-5 p-6 bg-white rounded-[32px] border border-slate-200 hover:border-indigo-200 transition-colors group"
                  >
                    <div className={`p-3 bg-${item.color}-50 text-${item.color}-600 rounded-2xl h-fit group-hover:scale-110 transition-transform`}>
                      <item.icon size={20} />
                    </div>
                    <div>
                      <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{item.label}</h5>
                      <p className="text-xs font-medium text-slate-700 leading-relaxed">{item.value}</p>
                    </div>
                  </motion.div>
                ))}

                <div className="bg-slate-900 p-8 rounded-[40px] border border-slate-800 shadow-2xl">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-indigo-500/20 rounded-xl">
                      <Sparkles size={18} className="text-indigo-400" />
                    </div>
                    <h5 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Triarchic Merit Model</h5>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: 'Autonomy', value: analysis.meritVectors.autonomy, color: 'indigo' },
                      { label: 'Competence', value: analysis.meritVectors.competence, color: 'emerald' },
                      { label: 'Relatedness', value: analysis.meritVectors.relatedness, color: 'amber' }
                    ].map((vector) => (
                      <div key={vector.label} className="flex flex-col items-center gap-2">
                        <div className="relative w-16 h-16 flex items-center justify-center">
                          <svg className="w-full h-full -rotate-90">
                            <circle cx="32" cy="32" r="28" fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
                            <motion.circle 
                              cx="32" cy="32" r="28" fill="transparent" 
                              stroke={vector.color === 'indigo' ? '#6366f1' : vector.color === 'emerald' ? '#10b981' : '#f59e0b'} 
                              strokeWidth="4" 
                              strokeDasharray="175.9"
                              initial={{ strokeDashoffset: 175.9 }}
                              animate={{ strokeDashoffset: 175.9 - (175.9 * vector.value) / 100 }}
                              transition={{ duration: 1.5, ease: "easeOut" }}
                            />
                          </svg>
                          <span className="absolute text-xs font-black text-white">{vector.value}</span>
                        </div>
                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">{vector.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-5 p-6 bg-white rounded-[32px] border border-slate-200 group">
                  <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl h-fit group-hover:scale-110 transition-transform">
                    <BarChart3 size={20} />
                  </div>
                  <div className="flex-1">
                    <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Impression Management</h5>
                    <div className="flex items-center gap-4">
                      <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${analysis.impressionManagementScore}%` }}
                          className="h-full bg-rose-500"
                        />
                      </div>
                      <span className="text-xs font-black text-rose-600">{analysis.impressionManagementScore}%</span>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-slate-900 text-white rounded-[32px] border border-slate-800 shadow-xl shadow-slate-900/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-1.5 bg-indigo-500/20 rounded-lg">
                      <ShieldCheck size={16} className="text-indigo-400" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Procedural Justice Note</span>
                  </div>
                  <p className="text-xs font-medium leading-relaxed opacity-80 italic">
                    "{analysis.proceduralJusticeNote}"
                  </p>
                </div>

                {analysis.socialIdentityAwareness && (
                  <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                        <Users size={18} />
                      </div>
                      <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Social Identity Awareness</h5>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
                          <span>Value Expression (Intrinsic)</span>
                          <span className="text-purple-600">{analysis.socialIdentityAwareness.valueExpression}%</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${analysis.socialIdentityAwareness.valueExpression}%` }}
                            className="h-full bg-purple-500"
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
                          <span>Social Recognition (Extrinsic)</span>
                          <span className="text-pink-600">{analysis.socialIdentityAwareness.socialRecognition}%</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${analysis.socialIdentityAwareness.socialRecognition}%` }}
                            className="h-full bg-pink-500"
                          />
                        </div>
                      </div>
                      <p className="text-xs font-medium text-slate-600 leading-relaxed mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        {analysis.socialIdentityAwareness.note}
                      </p>
                    </div>
                  </div>
                )}

                {analysis.integrityViolation?.detected && (
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={`p-6 border-2 rounded-[32px] shadow-lg ${
                      analysis.integrityViolation.type === 'abusive_language' || analysis.integrityViolation.type === 'sensitive_information'
                        ? 'bg-rose-50 border-rose-200 shadow-rose-900/5'
                        : 'bg-amber-50 border-amber-200 shadow-amber-900/5'
                    }`}
                  >
                    <div className={`flex items-center gap-3 mb-3 ${
                      analysis.integrityViolation.type === 'abusive_language' || analysis.integrityViolation.type === 'sensitive_information'
                        ? 'text-rose-600'
                        : 'text-amber-600'
                    }`}>
                      <div className={`p-2 rounded-xl ${
                        analysis.integrityViolation.type === 'abusive_language' || analysis.integrityViolation.type === 'sensitive_information'
                          ? 'bg-rose-100'
                          : 'bg-amber-100'
                      }`}>
                        <ShieldAlert size={20} />
                      </div>
                      <span className="text-xs font-black uppercase tracking-[0.2em]">
                        {analysis.integrityViolation.type === 'low_value' ? 'Low Value Response' : 
                         analysis.integrityViolation.type === 'out_of_context' ? 'Contextual Drift' : 
                         'Integrity Violation'}
                      </span>
                    </div>
                    <p className={`text-sm font-bold leading-relaxed ${
                      analysis.integrityViolation.type === 'abusive_language' || analysis.integrityViolation.type === 'sensitive_information'
                        ? 'text-rose-700'
                        : 'text-amber-700'
                    }`}>
                      {analysis.integrityViolation.note}
                    </p>
                    {(analysis.integrityViolation.type === 'low_value' || analysis.integrityViolation.type === 'out_of_context') && (
                      <div className="mt-4 p-3 bg-white/50 rounded-xl border border-amber-100 text-[10px] font-black uppercase tracking-widest text-amber-800 text-center">
                        Redirecting to organizational constructs...
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
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
                <p className="text-sm font-black uppercase tracking-[0.4em] text-slate-900">Pipeline Idle</p>
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
    </div>
  );
};

export default ProbingPipeline;
