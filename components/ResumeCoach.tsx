
import React, { useState, useRef, useEffect } from 'react';
import { RubricCriterion, ChatMessage, Question, AuditResult, JobListing } from '../types';
import { 
  analyzeResume, 
  startGuidanceChat, 
  sanitizeUrl 
} from '../services/geminiService';
import { GenerateContentResponse } from "@google/genai";
import JobTracker from './JobTracker';
import DomainScout from '../jOBHUNT'; 
import { useSettings } from '../context/SettingsContext';

interface Props { 
  criteria: RubricCriterion[]; 
  onInitiatePractice: (questions: Question[]) => void;
  onMouseEnter?: React.MouseEventHandler;
  onMouseLeave?: React.MouseEventHandler;
}

const MeritVectorBar = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <div className="space-y-1.5 w-full">
    <div className="flex justify-between items-center px-1">
      <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{label}</span>
      <span className={`text-[10px] font-black ${color}`}>{value}%</span>
    </div>
    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
      <div 
        className={`h-full ${color.replace('text-', 'bg-')} transition-all duration-1000 shadow-lg`} 
        style={{ width: `${value}%` }} 
      />
    </div>
  </div>
);

export default function ResumeCoach({ criteria, onInitiatePractice, onMouseEnter, onMouseLeave }: Props) {
  const { persistedAuditResult, setPersistedAuditResult } = useSettings();
  const [resumeText, setResumeText] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [activeFile, setActiveFile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deepThink, setDeepThink] = useState(true);
  const [result, setResult] = useState<AuditResult | null>(persistedAuditResult);
  const [activeTab, setActiveTab] = useState<'audit' | 'merit' | 'blueprint' | 'optimisation' | 'discovery' | 'pipeline' | 'chat'>('discovery');
  
  const [trackedJobs, setTrackedJobs] = useState<JobListing[]>(() => {
    try {
      const saved = localStorage.getItem('ascend_strategic_pipeline');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [chatSession, setChatSession] = useState<any>(null);
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('ascend_strategic_pipeline', JSON.stringify(trackedJobs));
  }, [trackedJobs]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleAnalyze = async () => {
    const content = activeFile ? { data: activeFile.data, mimeType: activeFile.mimeType } : resumeText.trim();
    if (!content && !resumeText.trim()) {
      setError("Please provide CV evidence.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await analyzeResume(content, criteria, targetRole, jobDescription, companyName, deepThink);
      setResult(res);
      setPersistedAuditResult(res);
      setActiveTab('audit');
      const session = startGuidanceChat(res, targetRole);
      setChatSession(session);
      setChatMessages([{ role: 'model', text: `Audit Phase 1 & 2 complete. Magnitude Gaps identified. Access the Internal Blueprint or start Discovery for Careers Roots.` }]);
    } catch (e) { 
      setError("Audit protocol failure."); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleAddJobs = (newJobs: JobListing[]) => {
    setTrackedJobs(prev => [...prev, ...newJobs]);
    setActiveTab('pipeline');
  };

  const updateJob = (id: string, updates: Partial<JobListing>) => {
    setTrackedJobs(prev => prev.map(j => j.id === id ? { ...j, ...updates } : j));
  };

  const removeJob = (id: string) => {
    setTrackedJobs(prev => prev.filter(j => j.id !== id));
  };

  const handleSendMessage = async () => {
    if (!userInput.trim() || !chatSession) return;
    const userMsg = userInput.trim();
    setUserInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsTyping(true);
    try {
      const responseStream = await chatSession.sendMessageStream({ message: userMsg });
      let fullText = '';
      setChatMessages(prev => [...prev, { role: 'model', text: '' }]);
      for await (const chunk of responseStream) {
        const c = chunk as GenerateContentResponse;
        fullText += c.text;
        setChatMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1].text = fullText;
          return updated;
        });
      }
    } catch (e) { console.error(e); } finally { setIsTyping(false); }
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    if (file.type.includes("pdf") || file.type.includes("word")) {
      reader.onload = (e) => setActiveFile({ name: file.name, data: (e.target?.result as string).split(',')[1], mimeType: file.type || 'application/pdf' });
      reader.readAsDataURL(file);
    } else {
      reader.onload = (e) => { setResumeText(e.target?.result as string); setActiveFile(null); };
      reader.readAsText(file);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 bg-slate-900 rounded-[32px] border border-slate-800 shadow-2xl relative overflow-hidden animate-fade-in" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <div className="relative z-10 space-y-8">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="space-y-1">
                <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                    Evidence Auditor
                    <div className="p-1 px-2 bg-indigo-500/10 rounded-md border border-indigo-500/20 text-[9px] text-indigo-400 uppercase tracking-widest font-mono">Phase 1 & 2 Enabled</div>
                </h2>
                <p className="text-[11px] text-slate-400 font-medium uppercase tracking-[0.1em]">Target Role Optimization Hub</p>
            </div>
            <button onClick={() => setDeepThink(!deepThink)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${deepThink ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40' : 'bg-slate-800 text-slate-400'}`}>
                {deepThink ? 'Deep Scan ON' : 'Standard logic'}
            </button>
        </header>

        {result && (
            <div className="space-y-8 animate-fade-in pt-2">
                <nav className="flex gap-2 p-1.5 bg-slate-800 rounded-2xl border border-slate-700 overflow-x-auto custom-scrollbar">
                    {(['audit', 'merit', 'blueprint', 'optimisation', 'discovery', 'pipeline', 'chat'] as const).map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab)} className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all whitespace-nowrap ${activeTab === tab ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-400 hover:text-slate-200'}`}>
                            {tab === 'audit' ? 'ATS Summary' : tab === 'merit' ? 'Magnitude' : tab === 'blueprint' ? 'Internal Blueprint' : tab === 'optimisation' ? 'Restructured CV' : tab === 'discovery' ? 'Domain Scout' : tab === 'pipeline' ? 'Strategic Pipeline' : 'Auditor Chat'}
                        </button>
                    ))}
                    <button onClick={() => setResult(null)} className="ml-auto px-4 text-[9px] font-black uppercase text-rose-500 hover:text-rose-400">New Audit</button>
                </nav>

                <div className="min-h-[600px]">
                    {activeTab === 'audit' && (
                        <div className="space-y-8 animate-fade-in">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-slate-800 p-8 rounded-[40px] border border-slate-700 flex flex-col items-center justify-center text-center">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Alignment Index</p>
                                    <p className="text-7xl font-black text-white">{result.alignmentScore}<span className="text-indigo-500 text-3xl">%</span></p>
                                </div>
                                <div className="md:col-span-2 space-y-4">
                                    <div className="flex justify-between items-start">
                                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Merit-Based Calibration</h3>
                                        <button 
                                            onClick={() => onInitiatePractice(result.tailoredQuestions)}
                                            className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-900/40"
                                        >
                                            Start Practice Session
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {result.keywordAudit?.vocabularyStrengths?.map((m, i) => (
                                            <span key={i} className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-[9px] font-black uppercase tracking-widest">{m}</span>
                                        ))}
                                    </div>
                                    <p className="text-sm leading-relaxed text-slate-300 font-medium bg-slate-800/40 p-8 rounded-3xl border border-slate-700">{result.alignmentSummary}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'blueprint' && (
                        <div className="space-y-8 animate-fade-in">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-slate-800 p-8 rounded-[32px] border border-slate-700 space-y-4">
                                    <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Operating Model</h4>
                                    <p className="text-lg font-black text-white">{result.internalWorkings.operatingModel}</p>
                                </div>
                                <div className="bg-slate-800 p-8 rounded-[32px] border border-slate-700 space-y-4">
                                    <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Communication</h4>
                                    <p className="text-lg font-black text-white">{result.internalWorkings.commStyle}</p>
                                </div>
                                <div className="bg-slate-800 p-8 rounded-[32px] border border-slate-700 space-y-4">
                                    <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Decision Making</h4>
                                    <p className="text-lg font-black text-white">{result.internalWorkings.decisionMaking}</p>
                                </div>
                            </div>
                            <div className="bg-indigo-600/5 border border-indigo-500/20 p-10 rounded-[40px] space-y-6">
                                <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest">Unwritten Rules (Phase 2 Strategy)</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {result.internalWorkings.unwrittenRules.map((rule, i) => (
                                        <div key={i} className="flex gap-4 p-5 bg-slate-800/60 rounded-2xl border border-slate-700 group hover:border-indigo-500 transition-all shadow-lg">
                                            <div className="w-6 h-6 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-[10px] font-black text-indigo-500">{i+1}</div>
                                            <p className="text-xs font-bold text-slate-200 leading-relaxed">{rule}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'merit' && (
                        <div className="space-y-10 animate-fade-in">
                            <div className="lg:col-span-2 space-y-8 bg-slate-800/40 p-10 rounded-[40px] border border-slate-800">
                                <h3 className="text-xs font-black text-white uppercase tracking-widest">Magnitude Scaling (Triarchic Model)</h3>
                                <div className="space-y-6">
                                    <MeritVectorBar label="Autonomy" value={result.meritVectors?.autonomy?.score || 0} color="text-blue-400" />
                                    <MeritVectorBar label="Competence" value={result.meritVectors?.competence?.score || 0} color="text-emerald-400" />
                                    <MeritVectorBar label="Relatedness" value={result.meritVectors?.relatedness?.score || 0} color="text-indigo-400" />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'discovery' && <div className="h-full animate-fade-in"><DomainScout onAddJobs={handleAddJobs} /></div>}
                    {activeTab === 'pipeline' && <div className="h-full animate-fade-in"><JobTracker jobs={trackedJobs} onUpdateJob={updateJob} onRemoveJob={removeJob} /></div>}
                    {activeTab === 'chat' && (
                        <div className="h-[600px] flex flex-col bg-slate-800 rounded-[32px] border border-slate-700 overflow-hidden shadow-2xl animate-fade-in">
                            <div className="flex-1 overflow-y-auto space-y-6 p-8 custom-scrollbar">
                                {chatMessages.map((msg, i) => (
                                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] p-5 rounded-[24px] text-[12px] font-medium leading-relaxed ${msg.role === 'user' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-900/40' : 'bg-slate-900 text-slate-200 border border-slate-800'}`}>
                                            {msg.text}
                                        </div>
                                    </div>
                                ))}
                                {isTyping && <div className="text-[10px] font-black text-slate-500 animate-pulse uppercase tracking-widest ml-2">Auditor Thinking...</div>}
                                <div ref={chatEndRef} />
                            </div>
                            <div className="p-6 bg-slate-800 border-t border-slate-700 flex gap-4">
                                <input type="text" className="flex-1 bg-slate-950 text-white border-none rounded-2xl px-6 py-4 text-xs font-bold outline-none" placeholder="Ask about CV anchoring logic..." value={userInput} onChange={(e) => setUserInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} />
                                <button onClick={handleSendMessage} className="bg-indigo-600 text-white px-8 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-500 shadow-xl shadow-indigo-900/40">Send</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )}
        {!result && (
            <div className="space-y-8 animate-fade-in pt-2">
                <nav className="flex gap-2 p-1.5 bg-slate-800 rounded-2xl border border-slate-700 overflow-x-auto custom-scrollbar">
                    {(['discovery', 'pipeline'] as const).map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab)} className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all whitespace-nowrap ${activeTab === tab ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-400 hover:text-slate-200'}`}>
                            {tab === 'discovery' ? 'Domain Scout' : 'Strategic Pipeline'}
                        </button>
                    ))}
                </nav>
                <div className="min-h-[600px]">
                    {activeTab === 'discovery' && <div className="h-full animate-fade-in"><DomainScout onAddJobs={handleAddJobs} /></div>}
                    {activeTab === 'pipeline' && <div className="h-full animate-fade-in"><JobTracker jobs={trackedJobs} onUpdateJob={updateJob} onRemoveJob={removeJob} /></div>}
                </div>
            </div>
        )}
      </div>
    </div>
  );
}
