
import React, { useState, useMemo } from 'react';
import { AlertTriangle, Globe, ShieldCheck, ExternalLink } from 'lucide-react';
import { AnalyticsEvent, ExperimentCondition } from '../types';

interface ProductDashboardProps {
    events: AnalyticsEvent[];
    onClose: () => void;
}

type DashboardTab = 'funnel' | 'architecture' | 'adoption' | 'engagement' | 'costs' | 'raw_data';

const ProductDashboard: React.FC<ProductDashboardProps> = ({ events, onClose }) => {
    const [activeTab, setActiveTab] = useState<DashboardTab>('funnel');

    // --- Statistical Utilities ---
    const getMedian = (values: number[]) => {
        if (values.length === 0) return 0;
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    };

    const getIQR = (values: number[]) => {
        if (values.length < 4) return { q1: 0, q3: 0 };
        const sorted = [...values].sort((a, b) => a - b);
        const q1 = sorted[Math.floor(sorted.length * 0.25)];
        const q3 = sorted[Math.floor(sorted.length * 0.75)];
        return { q1, q3 };
    };

    // --- Product Analysis Engine ---
    const productMetrics = useMemo(() => {
        const participantIds = new Set(events.map(e => e.participantId));
        const totalUniqueParticipants = participantIds.size;
        
        const totalSessions = events.filter(e => e.type === 'session_start').length;
        const completions = events.filter(e => e.type === 'session_complete').length;
        
        const phaseSequence = ['Situation', 'Task', 'Action', 'Result'];
        const funnel = phaseSequence.map((phase) => {
            const phaseEvents = events.filter(e => e.type === 'phase_complete' && e.metadata?.phase === phase);
            return {
                label: phase,
                count: phaseEvents.length,
                rate: totalSessions > 0 ? (phaseEvents.length / totalSessions * 100).toFixed(1) : "0"
            };
        });

        const adoption = {
            cognitiveScaffold: new Set(events.filter(e => e.type === 'feedback_generated').map(e => e.participantId)).size,
            thoughtSandbox: new Set(events.filter(e => e.type === 'sandbox_engaged').map(e => e.participantId)).size,
            reflectionBreak: new Set(events.filter(e => e.type === 'break_start').map(e => e.participantId)).size
        };

        const adoptionRates = {
            scaffold: totalUniqueParticipants > 0 ? (adoption.cognitiveScaffold / totalUniqueParticipants * 100).toFixed(1) : "0",
            sandbox: totalUniqueParticipants > 0 ? (adoption.thoughtSandbox / totalUniqueParticipants * 100).toFixed(1) : "0",
            breaks: totalUniqueParticipants > 0 ? (adoption.reflectionBreak / totalUniqueParticipants * 100).toFixed(1) : "0"
        };

        const phaseDurations = events.filter(e => e.type === 'phase_complete').map(e => e.metadata?.duration || 0);
        const medianDuration = getMedian(phaseDurations);
        const iqr = getIQR(phaseDurations);

        // --- Cost Estimation Logic ---
        const estimatedGeminiCost = totalSessions * 0.05; // $0.05 per full interview session
        const estimatedCloudRunCost = totalSessions * 0.001; // $0.001 per session
        const searchGroundingEvents = events.filter(e => e.type === 'search_grounding_used').length;
        const estimatedSearchCost = searchGroundingEvents * 0.002; // $0.002 per search

        const totalEstimatedCost = estimatedGeminiCost + estimatedCloudRunCost + estimatedSearchCost;

        return {
            totalUniqueParticipants,
            totalSessions,
            completions,
            completionRate: totalSessions > 0 ? (completions / totalSessions * 100).toFixed(1) : "0",
            funnel,
            adoptionRates,
            medianDuration,
            iqr,
            costs: {
                gemini: estimatedGeminiCost.toFixed(2),
                cloud: estimatedCloudRunCost.toFixed(2),
                search: estimatedSearchCost.toFixed(2),
                total: totalEstimatedCost.toFixed(2)
            }
        };
    }, [events]);

    const handleDownloadLog = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(events, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `ascend_global_participant_log_${new Date().toISOString()}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const handleClearLog = () => {
        if (window.confirm("Are you sure you want to delete all historical participant data?")) {
            localStorage.removeItem('ascend_global_event_log');
            window.location.reload();
        }
    };

    const tabLabels: Record<DashboardTab, string> = {
        funnel: 'Funnel Stats',
        architecture: 'Vision Architecture',
        adoption: 'Feature Adoption',
        engagement: 'Engagement',
        costs: 'Cost Estimator',
        raw_data: 'Raw Data Log'
    };

    return (
        <div className="fixed inset-0 z-[8000] bg-slate-950/98 backdrop-blur-2xl flex items-center justify-center p-4 md:p-10 font-sans animate-fade-in text-slate-200">
            <div className="w-full max-w-6xl h-full bg-slate-900 rounded-[40px] shadow-2xl border border-slate-800 flex flex-col overflow-hidden ring-1 ring-white/10">
                
                <header className="p-8 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                    <div className="flex items-center gap-5">
                        <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-900/40">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-2xl font-black tracking-tight text-white uppercase">Platform Mission Control</h2>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Multi-User Aggregate Log • Decision v2.1</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={handleDownloadLog} className="px-4 py-2 bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-700 transition-all border border-slate-700 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            Export Log
                        </button>
                        <button onClick={onClose} className="p-3 bg-slate-800 text-slate-400 rounded-xl hover:bg-slate-700 transition-all border border-slate-700">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </header>

                <nav className="flex px-8 border-b border-slate-800 bg-slate-900/30 overflow-x-auto">
                    {(['funnel', 'architecture', 'adoption', 'engagement', 'costs', 'raw_data'] as DashboardTab[]).map(tab => (
                        <button 
                            key={tab} 
                            onClick={() => setActiveTab(tab)}
                            className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${activeTab === tab ? 'border-blue-500 text-white bg-blue-500/5' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                        >
                            {tabLabels[tab]}
                        </button>
                    ))}
                </nav>

                <main className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-slate-900/50">
                    
                    {activeTab === 'architecture' && (
                        <div className="h-full flex flex-col items-center justify-center space-y-12 animate-fade-in p-6">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 w-full max-w-5xl">
                                {[
                                    { step: '01', title: 'Clinical Audit', desc: 'Evidence vectors & Magnitude mapping', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
                                    { step: '02', title: 'GPDP Scout', desc: 'Direct primary domain acquisition', icon: 'M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
                                    { step: '03', title: 'Case Sandbox', desc: 'Cognitive gap bridging & strategy', icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a2 2 0 00-1.96 1.414l-.5 1.5a2 2 0 00-1.96 1.414l-.5 1.5a2 2 0 01-1.144 1.25l-2.02.76a2 2 0 01-1.92-.12l-1.5-1.125a2 2 0 00-2.31 0l-1.5 1.125a2 2 0 01-1.92.12l-2.02-.76a2 2 0 01-1.144-1.25l-.5-1.5a2 2 0 00-1.96-1.414l-2.387.477a2 2 0 00-1.022.547' },
                                    { step: '04', title: 'Coherence', desc: 'Real-time narrative scaffolding', icon: 'M13 10V3L4 14h7v7l9-11h-7z' }
                                ].map((node, i) => (
                                    <div key={i} className="bg-slate-800 border border-slate-700 p-6 rounded-3xl flex flex-col items-center text-center space-y-4 shadow-xl">
                                        <div className="w-10 h-10 bg-indigo-500/10 text-indigo-400 rounded-full flex items-center justify-center font-black text-xs border border-indigo-500/20">{node.step}</div>
                                        <h4 className="text-sm font-black text-white uppercase tracking-tight">{node.title}</h4>
                                        <p className="text-[10px] text-slate-500 font-medium leading-relaxed">{node.desc}</p>
                                    </div>
                                ))}
                            </div>
                            
                            <div className="bg-slate-800/40 border border-slate-700 p-10 rounded-[48px] max-w-4xl w-full text-center space-y-6">
                                <h3 className="text-2xl font-black text-white uppercase tracking-tighter">The Asycend Architectural Loop</h3>
                                <p className="text-sm text-slate-400 leading-relaxed font-medium px-8">
                                    "We transform high-potential human capital into high-performance organizational assets. By treating merit as measurable physics, we eliminate the 'Vibe' bias of traditional recruitment and replace it with direct, scientific alignment between candidate magnitude and enterprise complexity."
                                </p>
                                <div className="flex flex-wrap justify-center gap-2">
                                    {['Self-Determination Theory', 'Bloom\'s Taxonomy', 'Magnitude Vectoring', 'Agency Shift Delta', 'GPDP v7.0'].map(tag => (
                                        <span key={tag} className="px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[9px] font-black uppercase tracking-widest rounded-full">{tag}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'funnel' && (
                        <div className="space-y-10 animate-fade-in">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <div className="bg-slate-800/40 p-6 rounded-3xl border border-slate-800">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Unique Participants</p>
                                    <p className="text-3xl font-black text-white">{productMetrics.totalUniqueParticipants}</p>
                                </div>
                                <div className="bg-slate-800/40 p-6 rounded-3xl border border-slate-800">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Session Starts</p>
                                    <p className="text-3xl font-black text-blue-400">{productMetrics.totalSessions}</p>
                                </div>
                                <div className="bg-slate-800/40 p-6 rounded-3xl border border-slate-800">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Completion Rate</p>
                                    <p className="text-3xl font-black text-emerald-400">{productMetrics.completionRate}%</p>
                                </div>
                                <div className="bg-slate-800/40 p-6 rounded-3xl border border-slate-800">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Final Syncs</p>
                                    <p className="text-3xl font-black text-indigo-400">{productMetrics.completions}</p>
                                </div>
                            </div>

                            <section className="space-y-6">
                                <div className="flex items-center gap-3">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Global STAR Progression Funnel</h3>
                                    <div className="flex-1 h-px bg-slate-800"></div>
                                </div>
                                <div className="space-y-4">
                                    {productMetrics.funnel.map((step, idx) => (
                                        <div key={step.label} className="relative">
                                            <div className="flex justify-between items-center mb-2 px-1">
                                                <span className="text-xs font-bold text-slate-300 capitalize">{idx + 1}. {step.label}</span>
                                                <span className="text-xs font-mono text-slate-500">{step.count} ({step.rate}%)</span>
                                            </div>
                                            <div className="h-8 bg-slate-950 rounded-lg overflow-hidden border border-slate-800/50">
                                                <div 
                                                    className="h-full bg-blue-600 transition-all duration-1000" 
                                                    style={{ width: `${step.rate}%`, opacity: 1 - (idx * 0.15) }} 
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </div>
                    )}

                    {activeTab === 'adoption' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-fade-in">
                            {[
                                { label: 'Cognitive Scaffold', rate: productMetrics.adoptionRates.scaffold, desc: 'Engaged with AI-driven structural feedback.' },
                                { label: 'Thought Sandbox', rate: productMetrics.adoptionRates.sandbox, desc: 'Utilized the drafting and reflection space.' },
                                { label: 'Reflection Breaks', rate: productMetrics.adoptionRates.breaks, desc: 'Triggered a deliberate pause for coherence.' }
                            ].map(feature => (
                                <div key={feature.label} className="bg-slate-800/20 p-8 rounded-[32px] border border-slate-800 flex flex-col items-center text-center space-y-4">
                                    <div className="w-16 h-1 bg-blue-500/20 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-500" style={{ width: `${feature.rate}%` }}></div>
                                    </div>
                                    <h4 className="text-2xl font-black text-white">{feature.rate}%</h4>
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-slate-300 tracking-widest">{feature.label}</p>
                                        <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">{feature.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'engagement' && (
                        <div className="space-y-10 animate-fade-in">
                            <div className="bg-slate-800/30 p-10 rounded-[40px] border border-slate-800 flex flex-col md:flex-row gap-12 items-center">
                                <div className="space-y-2 text-center md:text-left">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Global Median Time-on-Phase</p>
                                    <p className="text-6xl font-black text-white">{productMetrics.medianDuration}s</p>
                                    <p className="text-xs text-indigo-400 font-bold">IQR: {productMetrics.iqr.q1}s - {productMetrics.iqr.q3}s</p>
                                </div>
                                <div className="flex-1 bg-slate-950 p-6 rounded-3xl border border-slate-800">
                                    <p className="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest">Aggregate Interaction Benchmark</p>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        The stable median duration across (N={productMetrics.totalUniqueParticipants}) participants validates the platform's structural consistency across diverse cognitive profiles.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'costs' && (
                        <div className="space-y-10 animate-fade-in">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-slate-800/40 p-8 rounded-[32px] border border-slate-800 text-center">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Gemini AI (Est.)</p>
                                    <p className="text-4xl font-black text-white">${productMetrics.costs.gemini}</p>
                                    <p className="text-[10px] text-slate-500 mt-2">Based on $0.05 / full session</p>
                                </div>
                                <div className="bg-slate-800/40 p-8 rounded-[32px] border border-slate-800 text-center">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Cloud Hosting (Est.)</p>
                                    <p className="text-4xl font-black text-white">${productMetrics.costs.cloud}</p>
                                    <p className="text-[10px] text-slate-500 mt-2">Based on $0.001 / session</p>
                                </div>
                                <div className="bg-slate-800/40 p-8 rounded-[32px] border border-slate-800 text-center">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Search Grounding (Est.)</p>
                                    <p className="text-4xl font-black text-white">${productMetrics.costs.search}</p>
                                    <p className="text-[10px] text-slate-500 mt-2">Based on $0.002 / search</p>
                                </div>
                            </div>

                            <div className="bg-blue-600/10 border border-blue-500/20 p-10 rounded-[40px] flex flex-col md:flex-row justify-between items-center gap-8">
                                <div className="space-y-2">
                                    <h3 className="text-2xl font-black text-white uppercase tracking-tight">Total Estimated Burn</h3>
                                    <p className="text-sm text-slate-400">Calculated across all historical participant signals.</p>
                                </div>
                                <div className="text-center md:text-right">
                                    <p className="text-6xl font-black text-blue-400">${productMetrics.costs.total}</p>
                                    <p className="text-[10px] font-black uppercase text-blue-500 tracking-widest mt-2">Projected Operational Cost</p>
                                </div>
                            </div>

                            <div className="bg-slate-800/20 border border-slate-800 p-8 rounded-[32px] space-y-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                    <h4 className="text-xs font-black text-slate-300 uppercase tracking-widest">Scaling & Monitoring Protocol</h4>
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                    {/* Billing Alerts */}
                                    <div className="space-y-4 p-6 bg-slate-900/50 rounded-2xl border border-slate-800/50 group hover:border-blue-500/30 transition-colors">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <AlertTriangle className="w-3 h-3 text-blue-400" />
                                                <p className="text-[11px] font-bold text-white uppercase tracking-tight">01. Billing Alerts</p>
                                            </div>
                                            <div className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[8px] font-black text-blue-400 uppercase">Critical</div>
                                        </div>
                                        <p className="text-[11px] text-slate-400 leading-relaxed">
                                            Navigate to <strong>Billing {'>'} Budgets</strong> in GCP. Create a budget for $10.00. 
                                            Configure alerts at 50%, 90%, and 100% of spend to prevent "bill shock" during viral growth.
                                        </p>
                                        <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
                                            <p className="text-[9px] font-mono text-slate-500 uppercase tracking-tighter">Target: alerts@yourdomain.com</p>
                                            <ExternalLink className="w-2.5 h-2.5 text-slate-600 group-hover:text-blue-400 transition-colors" />
                                        </div>
                                    </div>

                                    {/* Custom Domain */}
                                    <div className="space-y-4 p-6 bg-slate-900/50 rounded-2xl border border-slate-800/50 group hover:border-indigo-500/30 transition-colors">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Globe className="w-3 h-3 text-indigo-400" />
                                                <p className="text-[11px] font-bold text-white uppercase tracking-tight">02. Custom Domain</p>
                                            </div>
                                            <div className="px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[8px] font-black text-indigo-400 uppercase">Identity</div>
                                        </div>
                                        <p className="text-[11px] text-slate-400 leading-relaxed">
                                            In <strong>Cloud Run {'>'} Manage Custom Domains</strong>, map your apex domain. 
                                            Update your DNS with the provided A/AAAA records. SSL is auto-provisioned by Google.
                                        </p>
                                        <div className="pt-2 border-t border-slate-800 text-[9px] font-mono text-slate-500 flex justify-between items-center">
                                            <span>TTL: 3600s</span>
                                            <ExternalLink className="w-2.5 h-2.5 text-slate-600 group-hover:text-indigo-400 transition-colors" />
                                        </div>
                                    </div>

                                    {/* API Quotas */}
                                    <div className="space-y-4 p-6 bg-slate-900/50 rounded-2xl border border-slate-800/50 group hover:border-emerald-500/30 transition-colors">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                                                <p className="text-[11px] font-bold text-white uppercase tracking-tight">03. API Quotas</p>
                                            </div>
                                            <div className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[8px] font-black text-emerald-400 uppercase">Safety</div>
                                        </div>
                                        <p className="text-[11px] text-slate-400 leading-relaxed">
                                            Restrict your <strong>Gemini API Key</strong> to only allow requests from your Cloud Run service. 
                                            Set daily request caps in the AI Studio console to limit maximum exposure.
                                        </p>
                                        <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
                                            <p className="text-[9px] font-mono text-slate-500 uppercase tracking-tighter">Status: Unrestricted</p>
                                            <ExternalLink className="w-2.5 h-2.5 text-slate-600 group-hover:text-emerald-400 transition-colors" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'raw_data' && (
                        <div className="animate-fade-in flex flex-col h-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
                             <div className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Master Record (Last 200 Signals)</span>
                                <button onClick={handleClearLog} className="text-[9px] font-black uppercase text-red-500 hover:text-red-400">Clear Global Log</button>
                             </div>
                            <div className="flex-1 overflow-auto custom-scrollbar">
                                <table className="w-full text-left border-collapse">
                                    <thead className="sticky top-0 bg-slate-900 z-10 text-[9px] font-black uppercase tracking-widest text-slate-400">
                                        <tr>
                                            <th className="p-4 border-b border-slate-700">Timestamp</th>
                                            <th className="p-4 border-b border-slate-700">Unique PID</th>
                                            <th className="p-4 border-b border-slate-700">Event Class</th>
                                            <th className="p-4 border-b border-slate-700">Metadata</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/50">
                                        {events.slice(-200).reverse().map((e, i) => (
                                            <tr key={i} className="hover:bg-white/5 transition-colors group">
                                                <td className="p-4 text-[10px] font-mono text-slate-500">{new Date(e.timestamp).toLocaleTimeString()}</td>
                                                <td className="p-4 text-[10px] font-black text-indigo-400">{e.participantId}</td>
                                                <td className="p-4 text-[10px] text-blue-400 font-bold">{e.type}</td>
                                                <td className="p-4 text-[10px] text-slate-500 italic truncate max-w-[200px]">{JSON.stringify(e.metadata)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                </main>

                <footer className="p-6 bg-slate-950 border-t border-slate-800 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                        <span className="text-[9px] font-black uppercase text-slate-500 tracking-[0.2em]">System Integrity Verified</span>
                    </div>
                    <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">
                        Autonomy-Preserving Diagnostic Model v2.1
                    </p>
                </footer>
            </div>
        </div>
    );
};

export default ProductDashboard;
