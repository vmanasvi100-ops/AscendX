
import React, { useState, useMemo } from 'react';
import { Copy, Check } from 'lucide-react';
import { AnalyticsEvent } from '../types';

interface ProductDashboardProps {
    events: AnalyticsEvent[];
    onClose: () => void;
    onClearAll?: () => void;
    onClearParticipant?: (participantId: string) => void;
}

type DashboardTab = 'links' | 'participants' | 'registration' | 'funnel' | 'raw_data';

// ── CSV Export ───────────────────────────────────────────────────────────────
// Builds a per-question-per-session CSV from the analytics event log.
// Participants are numbered anonymously (P001, P002 …) by first-seen order.
// No name, no company, no question text — only behavioural signals plus the
// registered email (joined via participant_id), if one is on file.

function buildCSV(events: AnalyticsEvent[], emailByPid: Map<string, string>): string {
    const csvCell = (v: unknown) => {
        const s = v === null || v === undefined ? '' : String(v);
        return s.includes(',') || s.includes('"') || s.includes('\n')
            ? `"${s.replace(/"/g, '""')}"` : s;
    };

    // Assign anonymous P-IDs ordered by each participant's first event
    const firstSeen = new Map<string, number>();
    [...events].sort((a, b) => a.timestamp - b.timestamp).forEach(e => {
        if (!firstSeen.has(e.participantId)) firstSeen.set(e.participantId, firstSeen.size + 1);
    });
    const anonId = (pid: string) => `P${String(firstSeen.get(pid) ?? 0).padStart(3, '0')}`;

    // Group events by participant, sorted chronologically
    const byParticipant = new Map<string, AnalyticsEvent[]>();
    [...events].sort((a, b) => a.timestamp - b.timestamp).forEach(e => {
        if (!byParticipant.has(e.participantId)) byParticipant.set(e.participantId, []);
        byParticipant.get(e.participantId)!.push(e);
    });

    const HEADERS = [
        'participant_id', 'email', 'session_date', 'session_number',
        'timer_mode', 'tool_keyword_pathfinder', 'tool_filler_counter', 'tool_checklist',
        'dyslexia_font', 'video_enabled',
        'question_number', 'question_type',
        'probe_used', 'depth_delta',
        'star_situation', 'star_task', 'star_action', 'star_result',
        'response_text',
        'reflection_completed', 'reflection_text_length',
        'self_rating_completed', 'self_rating_situation', 'self_rating_task',
        'self_rating_action', 'self_rating_result',
    ];

    const rows: string[][] = [HEADERS];

    byParticipant.forEach((pEvents, pid) => {
        // Split into sessions by session_start events
        const sessionStarts = pEvents.filter(e => e.type === 'session_start' && e.metadata?.mode === 'interview');

        sessionStarts.forEach((startEvt, sessionIdx) => {
            const nextStart = sessionStarts[sessionIdx + 1];
            // Events that belong to this session window
            const window = pEvents.filter(e =>
                e.timestamp >= startEvt.timestamp &&
                (!nextStart || e.timestamp < nextStart.timestamp)
            );

            const cfg = startEvt.metadata ?? {};
            const timerMode    = cfg.timerDisplay ?? '';
            const toolKw       = cfg.liveTools?.keywordPathfinder ? 'yes' : 'no';
            const toolFiller   = cfg.liveTools?.fillerWordCounter  ? 'yes' : 'no';
            const toolCheck    = cfg.liveTools?.questionChecklist  ? 'yes' : 'no';
            const dyslexia     = cfg.dyslexiaFont   ? 'yes' : 'no';
            const video        = cfg.videoEnabled   ? 'yes' : 'no';
            const sessionDate  = new Date(startEvt.timestamp).toISOString().slice(0, 10);

            const reflectionEvt    = window.find(e => e.type === 'reflection_submitted');
            const selfRatingEvt    = window.find(e => e.type === 'self_rating_submitted');
            const questionEvts     = window.filter(e => e.type === 'question_answered')
                .sort((a, b) => (a.metadata?.questionIndex ?? 0) - (b.metadata?.questionIndex ?? 0));

            // One row per question answered in this session
            questionEvts.forEach(qEvt => {
                const q = qEvt.metadata ?? {};
                rows.push([
                    anonId(pid),
                    emailByPid.get(pid) ?? '',
                    sessionDate,
                    String(sessionIdx + 1),
                    timerMode, toolKw, toolFiller, toolCheck, dyslexia, video,
                    String((q.questionIndex ?? 0) + 1),
                    q.questionType ?? '',
                    q.probeUsed ? 'yes' : 'no',
                    q.depthDelta ?? '',
                    q.starSituation != null ? String(q.starSituation) : '',
                    q.starTask      != null ? String(q.starTask)      : '',
                    q.starAction    != null ? String(q.starAction)    : '',
                    q.starResult    != null ? String(q.starResult)    : '',
                    q.responseText ?? '',
                    reflectionEvt ? (reflectionEvt.metadata?.completed ? 'yes' : 'no') : '',
                    reflectionEvt ? String(reflectionEvt.metadata?.textLength ?? 0) : '',
                    selfRatingEvt ? (selfRatingEvt.metadata?.completed ? 'yes' : 'no') : '',
                    selfRatingEvt?.metadata?.selfRatingSituation ?? '',
                    selfRatingEvt?.metadata?.selfRatingTask      ?? '',
                    selfRatingEvt?.metadata?.selfRatingAction    ?? '',
                    selfRatingEvt?.metadata?.selfRatingResult    ?? '',
                ].map(csvCell));
            });

            // If no questions tracked yet (e.g. session in progress), emit a session-level row
            if (questionEvts.length === 0) {
                rows.push([
                    anonId(pid), emailByPid.get(pid) ?? '', sessionDate, String(sessionIdx + 1),
                    timerMode, toolKw, toolFiller, toolCheck, dyslexia, video,
                    '', '', '', '', '', '', '', '', '',
                    reflectionEvt ? (reflectionEvt.metadata?.completed ? 'yes' : 'no') : '',
                    reflectionEvt ? String(reflectionEvt.metadata?.textLength ?? 0) : '',
                    selfRatingEvt ? (selfRatingEvt.metadata?.completed ? 'yes' : 'no') : '',
                    '', '', '', '',
                ].map(csvCell));
            }
        });
    });

    // UTF-8 BOM for Excel compatibility
    return '﻿' + rows.map(r => r.join(',')).join('\n');
}

const ProductDashboard: React.FC<ProductDashboardProps> = ({ events, onClose, onClearAll, onClearParticipant }) => {
    const [activeTab, setActiveTab] = useState<DashboardTab>('links');
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    // ── Registration tab state ────────────────────────────────────────────────
    type RegParticipant = {
        email: string; registered_at: string; note: string | null;
        session_count: number; first_seen_at: string | null; last_seen_at: string | null;
        domain_type: 'institutional' | 'consumer' | 'other' | null;
        participant_id: string | null;
    };
    const [regParticipants, setRegParticipants] = React.useState<RegParticipant[]>([]);
    const [regLoading, setRegLoading] = React.useState(false);
    const [regBulkInput, setRegBulkInput] = React.useState('');
    const [regAdding, setRegAdding] = React.useState(false);
    const [regError, setRegError] = React.useState<string | null>(null);
    const [regSuccess, setRegSuccess] = React.useState<string | null>(null);

    const fetchRegistered = React.useCallback(async () => {
        setRegLoading(true);
        try {
            const res = await fetch('/api/participants');
            if (res.ok) setRegParticipants((await res.json()).participants ?? []);
        } catch { /* backend unavailable */ }
        finally { setRegLoading(false); }
    }, []);

    React.useEffect(() => {
        fetchRegistered();
    }, [fetchRegistered]);

    // participant_id (anonymous analytics ID) -> email, so exports can join the two.
    const emailByParticipantId = React.useMemo(() => {
        const map = new Map<string, string>();
        regParticipants.forEach(p => { if (p.participant_id) map.set(p.participant_id, p.email); });
        return map;
    }, [regParticipants]);

    const handleAddParticipants = async () => {
        const emails = regBulkInput.split(/[\n,;]+/).map(e => e.trim()).filter(e => e.includes('@'));
        if (emails.length === 0) { setRegError('No valid email addresses found.'); return; }
        setRegAdding(true); setRegError(null); setRegSuccess(null);
        try {
            const res = await fetch('/api/participants', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ emails }),
            });
            const data = await res.json();
            if (res.ok) {
                setRegSuccess(`${data.added} participant${data.added !== 1 ? 's' : ''} registered.`);
                setRegBulkInput('');
                fetchRegistered();
            } else { setRegError(data.error ?? 'Failed to add participants.'); }
        } catch { setRegError('Backend unavailable.'); }
        finally { setRegAdding(false); }
    };

    const handleRemoveParticipant = async (email: string) => {
        try {
            await fetch(`/api/participants/${encodeURIComponent(email)}`, { method: 'DELETE' });
            setRegParticipants(prev => prev.filter(p => p.email !== email));
        } catch { /* ignore */ }
    };

    const handleExportStudyCSV = () => {
        const csv = buildCSV(events, emailByParticipantId);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ascendx-study-data-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

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
                // Reset per session — otherwise a CV uploaded in an earlier session
                // would still read "Yes" for a later session that skipped it.
                row.cvUploaded = '—';
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
            'Participant ID', 'Email', 'Condition',
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
                emailByParticipantId.get(r.participantId) ?? '—',
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
        registration: 'Study Registration',
        funnel: 'Funnel & Stats',
        raw_data: 'Raw Data Log',
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
                    {(['links', 'participants', 'registration', 'funnel', 'raw_data'] as DashboardTab[]).map(tab => (
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

                    {activeTab === 'registration' && (
                        <div className="animate-fade-in flex flex-col gap-6 h-full">
                            {/* Add participants */}
                            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6">
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Register Participants</p>
                                <p className="text-[11px] text-slate-500 mb-4">Paste emails — one per line, or separated by commas. Any real email can start an interview; this list tracks who participated.</p>
                                <textarea
                                    value={regBulkInput}
                                    onChange={e => { setRegBulkInput(e.target.value); setRegError(null); setRegSuccess(null); }}
                                    placeholder={"alice@university.ac.uk\nbob@university.ac.uk"}
                                    rows={4}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-[11px] text-slate-300 font-mono placeholder:text-slate-600 focus:outline-none focus:border-blue-500 resize-none mb-3"
                                />
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={handleAddParticipants}
                                        disabled={regAdding || !regBulkInput.trim()}
                                        className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
                                    >
                                        {regAdding ? 'Adding…' : 'Register Emails'}
                                    </button>
                                    {regSuccess && <span className="text-[10px] font-bold text-emerald-400">{regSuccess}</span>}
                                    {regError   && <span className="text-[10px] font-bold text-rose-400">{regError}</span>}
                                </div>
                            </div>

                            {/* Registered list */}
                            <div className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden flex flex-col">
                                <div className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                        {regLoading ? 'Loading…' : `${regParticipants.length} Registered`}
                                    </span>
                                    <button onClick={fetchRegistered} className="text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-colors">
                                        Refresh
                                    </button>
                                </div>
                                <div className="flex-1 overflow-auto custom-scrollbar">
                                    {regParticipants.length === 0 ? (
                                        <div className="flex items-center justify-center h-32 text-slate-600 text-[11px] font-bold uppercase tracking-widest">
                                            No participants registered yet
                                        </div>
                                    ) : (
                                        <table className="w-full text-left border-collapse">
                                            <thead className="sticky top-0 bg-slate-900 z-10 text-[9px] font-black uppercase tracking-widest text-slate-400">
                                                <tr>
                                                    <th className="p-3 border-b border-slate-800">Email</th>
                                                    <th className="p-3 border-b border-slate-800">Domain</th>
                                                    <th className="p-3 border-b border-slate-800">Registered</th>
                                                    <th className="p-3 border-b border-slate-800 text-center">Sessions</th>
                                                    <th className="p-3 border-b border-slate-800">Last Seen</th>
                                                    <th className="p-3 border-b border-slate-800">Note</th>
                                                    <th className="p-3 border-b border-slate-800"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-800/50">
                                                {regParticipants.map(p => (
                                                    <tr key={p.email} className="hover:bg-white/5 transition-colors group">
                                                        <td className="p-3 text-[10px] font-mono text-indigo-400">{p.email}</td>
                                                        <td className="p-3">
                                                            {p.domain_type === 'institutional' && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-900/50 text-blue-300 text-[9px] font-black uppercase tracking-widest">
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /></svg>
                                                                    Institutional
                                                                </span>
                                                            )}
                                                            {p.domain_type === 'consumer' && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-400 text-[9px] font-black uppercase tracking-widest">
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                                                    Personal
                                                                </span>
                                                            )}
                                                            {(p.domain_type === 'other' || p.domain_type == null) && (
                                                                <span className="text-[9px] text-slate-600 font-bold">—</span>
                                                            )}
                                                        </td>
                                                        <td className="p-3 text-[10px] text-slate-500">{new Date(p.registered_at).toLocaleDateString()}</td>
                                                        <td className="p-3 text-[10px] text-center">
                                                            <span className={p.session_count > 0 ? 'text-emerald-400 font-black' : 'text-slate-600'}>{p.session_count}</span>
                                                        </td>
                                                        <td className="p-3 text-[10px] text-slate-500">
                                                            {p.last_seen_at ? new Date(p.last_seen_at).toLocaleDateString() : '—'}
                                                        </td>
                                                        <td className="p-3 text-[10px] text-slate-500 italic">{p.note ?? '—'}</td>
                                                        <td className="p-3">
                                                            <button
                                                                onClick={() => handleRemoveParticipant(p.email)}
                                                                title="Remove participant"
                                                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg bg-rose-900/50 hover:bg-rose-700 text-rose-400"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
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

                            {/* Adoption + Engagement — condensed */}
                            <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-slate-800/30 border border-slate-800 rounded-2xl p-6">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-4">Feature Adoption</p>
                                    <div className="space-y-3">
                                        {[
                                            { label: 'Cognitive Scaffold', rate: productMetrics.adoptionRates.scaffold },
                                            { label: 'Thought Sandbox',    rate: productMetrics.adoptionRates.sandbox },
                                            { label: 'Reflection Breaks',  rate: productMetrics.adoptionRates.breaks },
                                        ].map(f => (
                                            <div key={f.label}>
                                                <div className="flex justify-between mb-1">
                                                    <span className="text-[10px] text-slate-400 font-bold">{f.label}</span>
                                                    <span className="text-[10px] font-black text-white">{f.rate}%</span>
                                                </div>
                                                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${f.rate}%` }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="bg-slate-800/30 border border-slate-800 rounded-2xl p-6 flex flex-col justify-center">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">Median Time-on-Phase</p>
                                    <p className="text-5xl font-black text-white">{productMetrics.medianDuration}<span className="text-xl text-slate-500 ml-1">s</span></p>
                                    <p className="text-[10px] text-indigo-400 font-bold mt-1">IQR: {productMetrics.iqr.q1}s – {productMetrics.iqr.q3}s</p>
                                    <p className="text-[10px] text-slate-500 mt-3">Across N={productMetrics.totalUniqueParticipants} participants</p>
                                </div>
                            </section>
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

                <footer className="p-6 bg-slate-950 border-t border-slate-800 flex justify-between items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                        <span className="text-[9px] font-black uppercase text-slate-500 tracking-[0.2em]">System Integrity Verified</span>
                    </div>
                    <button
                        onClick={handleExportStudyCSV}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest transition-colors"
                    >
                        Export Study CSV
                    </button>
                    <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">
                        Autonomy-Preserving Diagnostic Model v2.1
                    </p>
                </footer>
            </div>
        </div>
    );
};

export default ProductDashboard;
