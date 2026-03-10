
import React from 'react';
import type { SupportiveAIFeedback } from '../types';

const SupportiveAIFeedbackDisplay = ({ feedback, isLoading }: { feedback: SupportiveAIFeedback | null; isLoading: boolean; }) => {
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-6 text-center bg-slate-50 h-full animate-pulse">
                <div className="spinner w-6 h-6 border-2 border-indigo-300 border-t-transparent rounded-full mb-3"></div>
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-[0.4em] font-mono">Calibrating Scaffold...</span>
            </div>
        );
    }

    if (!feedback) {
        return (
            <div className="p-8 text-center bg-slate-50/50 rounded-xl h-full flex flex-col items-center justify-center border-2 border-dashed border-slate-200">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] font-mono">Waiting for Signal</p>
                <p className="text-[10px] text-slate-400 mt-2 leading-relaxed px-4 italic">Reflections will populate here after the first phase is complete or during a break.</p>
            </div>
        );
    }

    return (
        <div className="p-5 animate-fade-in space-y-6">
            <div className="space-y-4">
                 {/* Semantic Anchor (CLT Hook) */}
                <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/50 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-indigo-900" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                    </div>
                    <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-500 mb-2 font-mono flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div>
                        Semantic Anchor
                    </h4>
                    <p className="text-sm text-indigo-950 font-black tracking-tight leading-tight">
                        "{feedback.semantic_anchor}"
                    </p>
                    <p className="text-[9px] text-indigo-400 mt-2 font-medium italic">Retrieved from your current narrative.</p>
                </div>

                {/* Task Logic (FIT Scaffold) */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                         <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 font-mono">Structural Logic</h4>
                         <div className="flex-1 h-px bg-slate-100"></div>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed font-medium">
                        {feedback.task_logic}
                    </p>
                </div>

                {/* Reflective Prompt (ZPD / Socratic) */}
                <div className="pt-4 border-t border-slate-100">
                    <div className="bg-slate-900 p-4 rounded-2xl shadow-xl shadow-slate-200">
                         <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-400 mb-2 font-mono">Forward Horizon</h4>
                         <p className="text-xs text-white font-bold leading-relaxed tracking-tight">
                            {feedback.reflective_prompt}
                         </p>
                    </div>
                </div>
            </div>
            
            <div className="pt-4 border-t border-slate-50">
                 <div className="flex justify-between items-center">
                    <p className="text-[8px] text-slate-300 leading-tight uppercase font-mono tracking-widest">
                        Task-Focused Scaffold (FIT Model)
                    </p>
                    <div className="flex gap-1">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className={`w-1.5 h-1.5 rounded-sm ${i < feedback.metadata.completeness_score ? 'bg-indigo-400' : 'bg-slate-100'}`}></div>
                        ))}
                    </div>
                 </div>
            </div>
        </div>
    );
};

export default SupportiveAIFeedbackDisplay;
