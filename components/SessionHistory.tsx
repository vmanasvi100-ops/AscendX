import React, { useState, useEffect } from 'react';
import { History, X } from 'lucide-react';
import type { MesoAccumulator, MasteryComponent, CoachingProgressionStage } from '../types';

// company_name/target_role/layer_a were removed from the by-email response — that route has
// no authentication (anyone who knows/guesses an email can call it), so returning a candidate's
// full feedback report and role/company names keyed only by email was a real exposure. Until
// proper email verification exists, this view only has what the endpoint still returns: dates.
// See backend/routes/sessions.ts's by-email route for the full rationale.
interface PastSession {
    id: string;
    created_at: string;
    completed_at: string | null;
}

interface Props {
    email: string;
    onClose: () => void;
    mesoAccumulator: MesoAccumulator | null;
    researcherMode?: boolean;
}

const STAGE_DESCRIPTOR: Record<CoachingProgressionStage, string> = {
    planning: 'building a clear plan for what comes next',
    ownership: 'building ownership over your outcomes',
    exploration: 'exploring what roles and approaches genuinely fit you',
    consolidation: 'building belief in your own trajectory',
};

const COMPONENT_LABEL: Record<MasteryComponent, string> = {
    situation: 'Situation', task: 'Task', action: 'Action', result: 'Result',
};

// Translates MesoDelta (internal, numeric/statistical) into Tier-1 behavioural language —
// no raw slopes, no "reliable: false" jargon, no framework names shown to the candidate.
function GrowthSummary({ mesoAccumulator, researcherMode }: { mesoAccumulator: MesoAccumulator | null; researcherMode?: boolean }) {
    const sessions = mesoAccumulator?.sessions ?? [];
    const delta = mesoAccumulator?.delta ?? null;

    if (sessions.length === 0) return null;

    if (sessions.length === 1 || !delta) {
        return (
            <div className="p-5 bg-indigo-50 border border-indigo-100 rounded-2xl mb-5">
                <p className="text-xs font-bold text-indigo-900">You've completed 1 session so far.</p>
                <p className="text-[11px] text-indigo-700 mt-1">Trends across sessions start showing up from your 2nd session, and become reliable from your 3rd.</p>
            </div>
        );
    }

    const notYetReliable = !delta.competencyTrendReliable;
    const lines: string[] = [];

    if (notYetReliable) {
        lines.push(`You've completed ${delta.sessionCount} sessions — one more and trends become statistically meaningful rather than noise.`);
    } else {
        if (delta.zpdTrendReliable && delta.zpd_lowerBoundaryAdvanced) {
            lines.push("What you can do without prompting has been rising across your sessions — that's the clearest sign of real development, not just getting better at being coached.");
        }
        if (delta.mesoScaffoldReduced) {
            lines.push("You've been needing less structured support than when you started.");
        } else if (delta.scaffoldTrend === 'increasing') {
            lines.push("You've been leaning on more structured support recently — normal if you're tackling harder material, worth noticing if not.");
        }
    }

    if (delta.forwardOrientationActioned) {
        lines.push('You followed through on what came out of your last session — that\'s exactly how this compounds.');
    }

    if (delta.masteryConsolidated.length > 0) {
        lines.push(`You've reliably nailed: ${delta.masteryConsolidated.map(c => COMPONENT_LABEL[c]).join(', ')} across multiple sessions.`);
    }

    lines.push(`Right now, we're focused on: ${STAGE_DESCRIPTOR[delta.currentCoachingProgressionStage]}.`);

    return (
        <div className="p-5 bg-indigo-50 border border-indigo-100 rounded-2xl mb-5 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Your Growth</p>
            {lines.map((l, i) => <p key={i} className="text-xs text-indigo-900 leading-relaxed">{l}</p>)}

            {researcherMode && delta && (
                <div className="mt-3 pt-3 border-t border-indigo-200 grid grid-cols-2 gap-2 text-[10px] font-mono text-indigo-700">
                    <span>competencySlope: {delta.competencySlope.toFixed(3)} {delta.competencyTrendReliable ? '' : '(unreliable, n<3)'}</span>
                    <span>SE: {delta.competencySlopeStandardError?.toFixed(3) ?? 'n/a'}</span>
                    <span>scaffoldTrend: {delta.scaffoldTrend}</span>
                    <span>regulatoryShift: {delta.regulatoryShift}</span>
                    <span>feedbackOrientationDelta: {delta.feedbackOrientationDelta}</span>
                    <span>zpdTrendReliable: {String(delta.zpdTrendReliable)}</span>
                </div>
            )}
        </div>
    );
}

export default function SessionHistory({ email, onClose, mesoAccumulator, researcherMode }: Props) {
    const [sessions, setSessions] = useState<PastSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!email.trim()) { setLoading(false); return; }
        fetch(`/api/sessions/by-email/${encodeURIComponent(email.trim().toLowerCase())}/history`)
            .then(r => {
                if (!r.ok) throw new Error('Failed to load session history.');
                return r.json();
            })
            .then(({ sessions: data }) => setSessions((data ?? []).slice().reverse())) // most recent first
            .catch(() => setError('Could not load your past sessions — please try again later.'))
            .finally(() => setLoading(false));
    }, [email]);

    return (
        <div className="fixed inset-0 bg-slate-900 bg-opacity-80 flex items-center justify-center z-[20000] animate-fade-in p-4" role="dialog" aria-modal="true">
            <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col border border-slate-200">
                <div className="flex items-center justify-between p-6 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl"><History size={20} /></div>
                        <div>
                            <h2 className="text-lg font-black text-slate-900 tracking-tight">Past Sessions</h2>
                            <p className="text-xs text-slate-500">Reports from your previous interview practice</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors" aria-label="Close">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    <GrowthSummary mesoAccumulator={mesoAccumulator} researcherMode={researcherMode} />
                    {loading && <p className="text-sm text-slate-500 text-center py-8">Loading your history…</p>}
                    {error && <p className="text-sm text-rose-600 text-center py-8">{error}</p>}
                    {!loading && !error && sessions.length === 0 && (
                        <p className="text-sm text-slate-500 text-center py-8">No completed sessions found for this email yet.</p>
                    )}
                    {sessions.length > 0 && (
                        <p className="text-[11px] text-slate-400 italic px-1 -mt-1 mb-2">
                            Full reports from other devices aren't available here yet — this is being tightened for your privacy. Your growth trends above are still accurate.
                        </p>
                    )}
                    {sessions.map(s => {
                        const date = s.completed_at ?? s.created_at;
                        return (
                            <div key={s.id} className="border border-slate-200 rounded-2xl p-4 bg-slate-50">
                                <p className="text-sm font-bold text-slate-800">Practice session</p>
                                <p className="text-[11px] text-slate-500">{new Date(date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
