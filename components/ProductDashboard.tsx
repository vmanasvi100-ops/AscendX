
import React, { useState, useMemo } from 'react';
import { AlertTriangle, Globe, ShieldCheck, ExternalLink, Link, Copy, Check } from 'lucide-react';
import { AnalyticsEvent } from '../types';

interface ProductDashboardProps {
    events: AnalyticsEvent[];
    onClose: () => void;
    onClearAll?: () => void;
    onClearParticipant?: (participantId: string) => void;
}

type DashboardTab = 'links' | 'participants' | 'funnel' | 'architecture' | 'adoption' | 'engagement' | 'costs' | 'raw_data';

const ProductDashboard: React.FC<ProductDashboardProps> = ({ events, onClose, onClearAll, onClearParticipant }) => {
    const [activeTab, setActiveTab] = useState<DashboardTab>('links');
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

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
        const searchGroundingEvents = events.filter(e => (e.type as string) === 'search_grounding_used').length;
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
        if (window.confirm("Delete ALL participant data? This cannot be undone.")) {
            localStorage.removeItem('ascend_global_event_log');
            onClearAll?.();
        }
    };

    const handleClearParticipant = (participantId: string) => {
        if (window.confirm(`Remove all data for participant ${participantId}?`)) {
            onClearParticipant?.(participantId);
        }
    };

    // Verbatim response labels — exactly what the candidate selected in the profiling survey
    const PROFILE_LABELS: Record<string, Record<string, string>> = {
        experience: {
            novice: 'None or one — this is quite new for me',
            some: 'A handful — I have some idea of what to expect',
            experienced: 'Quite a few — I feel reasonably comfortable',
            expert: 'Many — interviews are familiar territory',
        },
        feedbackLiteracy: {
            absorbs: 'I take notes and act on it straight away',
            reflects: 'I prefer to think it over before deciding what to use',
            overwhelmed: 'I often find it hard to know what to prioritise',
            uncertain: 'I usually feel unsure what it means in practice',
        },
        regulatoryFocus: {
            promotion: 'Focus on what I want to achieve',
            prevention: 'Focus on avoiding mistakes',
            mixed: 'A mix of both',
            unclear: "I don't really have a fixed approach",
        },
        anxietyLevel: {
            low: 'Stay calm and think clearly',
            mild: 'Feel a little flustered but recover quickly',
            moderate: 'Struggle to find the right words',
            high: 'Go blank and need a moment to reset',
        },
        seeksFeedback: {
            proactive: 'I actively ask for it — from peers, mentors, or anyone I trust',
            responsive: 'I wait until feedback is offered, then I use it',
            avoidant: 'I tend to avoid it — it can feel uncomfortable',
            uncertain: "I'm not sure I have a consistent pattern",
        },
    };

    const verbatim = (dimension: string, key: string) =>
        PROFILE_LABELS[dimension]?.[key] ?? key;

    // Build per-participant rows from events
    const participantRows = useMemo(() => {
        const map = new Map<string, {
            participantId: string;
            condition: string;
            timerDisplay: string;
            timerPreferenceAnswer: string;
            dyslexiaFont: string;
            liveTools: string;
            cvUploaded: string;
            experience: string;
            feedbackLiteracy: string;
            seeksFeedback: string;
            regulatoryFocus: string;
            anxietyLevel: string;
            sessionsStarted: number;
            sessionsCompleted: number;
            questionsAnswered: number;
            totalProbes: number;
            firstSeen: number;
            lastSeen: number;
        }>();

        for (const e of events) {
            const pid = e.participantId;
            if (!map.has(pid)) {
                map.set(pid, {
                    participantId: pid,
                    condition: e.condition ?? '—',
                    timerDisplay: '—', timerPreferenceAnswer: '—', dyslexiaFont: '—', liveTools: '—',
                    cvUploaded: '—',
                    experience: '—', feedbackLiteracy: '—',
                    seeksFeedback: '—', regulatoryFocus: '—', anxietyLevel: '—',
                    sessionsStarted: 0, sessionsCompleted: 0,
                    questionsAnswered: 0, totalProbes: 0,
                    firstSeen: e.timestamp, lastSeen: e.timestamp,
                });
            }
            const row = map.get(pid)!;
            if (e.timestamp < row.firstSeen) row.firstSeen = e.timestamp;
            if (e.timestamp > row.lastSeen) row.lastSeen = e.timestamp;
            if (e.type === 'session_start' && e.metadata) {
                row.timerDisplay = e.metadata.timerDisplay ?? '—';
                row.timerPreferenceAnswer = e.metadata.preSessionAnswer ?? '—';
                row.dyslexiaFont = e.metadata.dyslexiaFont === true ? 'Yes' : e.metadata.dyslexiaFont === false ? 'No' : '—';
                const lt = e.metadata.liveTools ?? {};
                const enabled = [
                    lt.keywordPathfinder && 'Keyword',
                    lt.fillerWordCounter && 'Filler',
                    lt.questionChecklist && 'Checklist',
                ].filter(Boolean).join(', ');
                row.liveTools = enabled || 'None';
            }
            if (e.type === 'cv_uploaded') row.cvUploaded = 'Yes';
            if (e.type === 'cv_upload_declined' && row.cvUploaded === '—') row.cvUploaded = 'No';
            if (e.type === 'profile_submitted' && e.metadata) {
                row.experience = e.metadata.experience ?? '—';
                row.feedbackLiteracy = e.metadata.feedbackLiteracy ?? '—';
                row.seeksFeedback = e.metadata.seeksFeedback ?? '—';
                row.regulatoryFocus = e.metadata.regulatoryFocus ?? '—';
                row.anxietyLevel = e.metadata.anxietyLevel ?? '—';
            }
            if (e.type === 'session_start') row.sessionsStarted += 1;
            if (e.type === 'session_complete') row.sessionsCompleted += 1;
            if (e.type === 'phase_complete' && e.metadata?.phase === 'Result') row.questionsAnswered += 1;
            if (e.type === 'probe_used') row.totalProbes += 1;
        }

        return Array.from(map.values()).sort((a, b) => b.lastSeen - a.lastSeen);
    }, [events]);

    const handleExportCSV = () => {
        const headers = [
            'Participant ID', 'Condition',
            'Timer Display', 'Timer Preference Answer', 'Dyslexia Font', 'Live Tools',
            'CV Uploaded',
            'Interview Experience', 'How They Use Feedback', 'How They Seek Feedback',
            'Preparation Approach', 'Under Pressure',
            'Sessions Started', 'Sessions Completed',
            'Questions Answered', 'Total Probes Used', 'Avg Probes Per Question',
            'First Seen', 'Last Active',
        ];
        const rows = participantRows.map(r => {
            const avgProbes = r.questionsAnswered > 0
                ? (r.totalProbes / r.questionsAnswered).toFixed(1)
                : '—';
            return [
                r.participantId,
                r.condition,
                r.timerDisplay,
                r.timerPreferenceAnswer,
                r.dyslexiaFont,
                r.liveTools,
                r.cvUploaded,
                verbatim('experience', r.experience),
                verbatim('feedbackLiteracy', r.feedbackLiteracy),
                verbatim('seeksFeedback', r.seeksFeedback),
                verbatim('regulatoryFocus', r.regulatoryFocus),
                verbatim('anxietyLevel', r.anxietyLevel),
                r.sessionsStarted,
                r.sessionsCompleted,
                r.questionsAnswered,
                r.totalProbes,
                avgProbes,
                new Date(r.firstSeen).toLocaleString(),
                new Date(r.lastSeen).toLocaleString(),
            ];
        });
        const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ascendx_participants_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const copyToClipboard = (text: string, key: string) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedKey(key);
            setTimeout(() => setCopiedKey(null), 2000);
        });
    };

    const baseUrl = window.location.origin + window.location.pathname;

    const CONDITIONS = [
        {
            key: 'scaffolded',
            label: 'Condition A — Scaffolded',
            color: 'indigo',
            description: 'Full support: keyword pathfinder, coaching instructions, STAR progress indicators, difficulty badge.',
            features: ['Keyword chips (live tracking)', 'Full coaching instructions per phase', 'STAR progress dots', 'Difficulty badge & question counter'],
        },
        {
            key: 'standard',
            label: 'Condition B — Standard',
            color: 'blue',
            description: 'Partial support: STAR progress indicators visible, but no keyword pathfinder and no coaching instructions.',
            features: ['STAR progress dots', 'Difficulty badge & question counter', 'No keyword chips', 'No coaching instructions'],
        },
        {
            key: 'minimal',
            label: 'Condition C — Minimal',
            color: 'slate',
            description: 'No scaffolding: progress indicators hidden, no keywords, no coaching text. Candidate is on their own.',
            features: ['No progress indicators', 'No keywords', 'No coaching instructions', 'Baseline performance signal'],
        },
    ] as const;

    const tabLabels: Record<DashboardTab, string> = {
        links: 'Participant Links',
        participants: 'Participants',
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
                    {(['links', 'participants', 'funnel', 'architecture', 'adoption', 'engagement', 'costs', 'raw_data'] as DashboardTab[]).map(tab => (
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

                    {activeTab === 'links' && (
                        <div className="animate-fade-in space-y-6">
                            <div className="mb-6">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Participant Condition Links</h3>
                                <p className="text-[11px] text-slate-500 leading-relaxed">Send each participant exactly one of these links. The URL parameter locks them into that condition for the session.</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {CONDITIONS.map(c => {
                                    const url = `${baseUrl}?condition=${c.key}`;
                                    const isCopied = copiedKey === c.key;
                                    const colorMap: Record<string, string> = {
                                        indigo: 'border-indigo-500/30 bg-indigo-500/5',
                                        blue: 'border-blue-500/30 bg-blue-500/5',
                                        slate: 'border-slate-600/50 bg-slate-800/30',
                                    };
                                    const btnColorMap: Record<string, string> = {
                                        indigo: 'bg-indigo-600 hover:bg-indigo-500',
                                        blue: 'bg-blue-600 hover:bg-blue-500',
                                        slate: 'bg-slate-600 hover:bg-slate-500',
                                    };
                                    return (
                                        <div key={c.key} className={`border rounded-3xl p-6 flex flex-col gap-4 ${colorMap[c.color]}`}>
                                            <div>
                                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">{c.label}</p>
                                                <p className="text-xs text-slate-300 font-medium leading-relaxed">{c.description}</p>
                                            </div>
                                            <ul className="space-y-1.5 flex-1">
                                                {c.features.map(f => (
                                                    <li key={f} className="flex items-center gap-2 text-[10px] text-slate-400">
                                                        <div className="w-1 h-1 rounded-full bg-slate-600 shrink-0" />
                                                        {f}
                                                    </li>
                                                ))}
                                            </ul>
                                            <div className="pt-4 border-t border-slate-700 space-y-2">
                                                <p className="text-[9px] font-mono text-slate-500 break-all">{url}</p>
                                                <button
                                                    onClick={() => copyToClipboard(url, c.key)}
                                                    className={`w-full py-2.5 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${btnColorMap[c.color]}`}
                                                >
                                                    {isCopied ? <Check size={12} /> : <Copy size={12} />}
                                                    {isCopied ? 'Copied!' : 'Copy Link'}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="mt-6 p-5 bg-amber-500/5 border border-amber-500/20 rounded-2xl">
                                <p className="text-[10px] font-black uppercase tracking-widest text-amber-400 mb-1">Research Integrity Note</p>
                                <p className="text-[11px] text-slate-400 leading-relaxed">Assign conditions using block randomisation before sending links. Participants must not self-select their condition. Each participant should only ever receive one link.</p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'participants' && (
                        <div className="animate-fade-in flex flex-col h-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
                            <div className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center gap-3">
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                    {participantRows.length} Participant{participantRows.length !== 1 ? 's' : ''} Recorded
                                </span>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleExportCSV}
                                        className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-[9px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-2"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                        Export CSV
                                    </button>
                                    <button
                                        onClick={handleClearLog}
                                        className="px-4 py-2 bg-rose-900 hover:bg-rose-800 text-rose-300 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-2"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        Clear All
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-auto custom-scrollbar">
                                {participantRows.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-48 text-slate-600 text-sm font-bold uppercase tracking-widest">
                                        No participants yet — profiles appear after the first session
                                    </div>
                                ) : (
                                    <table className="w-full text-left border-collapse">
                                        <thead className="sticky top-0 bg-slate-900 z-10 text-[9px] font-black uppercase tracking-widest text-slate-400">
                                            <tr>
                                                <th className="p-3 border-b border-slate-700">Participant ID</th>
                                                <th className="p-3 border-b border-slate-700">Condition</th>
                                                <th className="p-3 border-b border-slate-700">Timer</th>
                                                <th className="p-3 border-b border-slate-700">Live Tools</th>
                                                <th className="p-3 border-b border-slate-700">Interview Experience</th>
                                                <th className="p-3 border-b border-slate-700">How They Use Feedback</th>
                                                <th className="p-3 border-b border-slate-700">How They Seek Feedback</th>
                                                <th className="p-3 border-b border-slate-700">Preparation Approach</th>
                                                <th className="p-3 border-b border-slate-700">Under Pressure</th>
                                                <th className="p-3 border-b border-slate-700">Sessions</th>
                                                <th className="p-3 border-b border-slate-700">Completed</th>
                                                <th className="p-3 border-b border-slate-700">Last Active</th>
                                                <th className="p-3 border-b border-slate-700"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/50">
                                            {participantRows.map((r, i) => (
                                                <tr key={i} className="hover:bg-white/5 transition-colors group">
                                                    <td className="p-3 text-[10px] font-black text-indigo-400 font-mono">{r.participantId}</td>
                                                    <td className="p-3 text-[10px] text-slate-400">{r.condition}</td>
                                                    <td className="p-3 text-[10px] text-slate-400">{r.timerDisplay}</td>
                                                    <td className="p-3 text-[10px] text-slate-400">{r.liveTools}</td>
                                                    <td className="p-3 text-[10px] text-slate-300 max-w-[180px]">{verbatim('experience', r.experience)}</td>
                                                    <td className="p-3 text-[10px] text-slate-300 max-w-[180px]">{verbatim('feedbackLiteracy', r.feedbackLiteracy)}</td>
                                                    <td className="p-3 text-[10px] text-slate-300 max-w-[180px]">{verbatim('seeksFeedback', r.seeksFeedback)}</td>
                                                    <td className="p-3 text-[10px] text-slate-300 max-w-[160px]">{verbatim('regulatoryFocus', r.regulatoryFocus)}</td>
                                                    <td className="p-3 text-[10px] text-slate-300 max-w-[180px]">{verbatim('anxietyLevel', r.anxietyLevel)}</td>
                                                    <td className="p-3 text-[10px] text-slate-400 text-center">{r.sessionsStarted}</td>
                                                    <td className="p-3 text-[10px] text-center">
                                                        <span className={r.sessionsCompleted > 0 ? 'text-emerald-400 font-black' : 'text-slate-600'}>{r.sessionsCompleted}</span>
                                                    </td>
                                                    <td className="p-3 text-[10px] text-slate-500 font-mono">{new Date(r.lastSeen).toLocaleDateString()}</td>
                                                    <td className="p-3">
                                                        <button
                                                            onClick={() => handleClearParticipant(r.participantId)}
                                                            title="Remove this participant"
                                                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg bg-rose-900/50 hover:bg-rose-700 text-rose-400"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    )}

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
