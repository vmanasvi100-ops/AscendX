
import React from 'react';
import { ShieldCheck, X } from 'lucide-react';

interface CVConsentModalProps {
  fileInputRef: React.RefObject<HTMLInputElement>;
  onAccept: () => void;
  onDecline: () => void;
}

const CVConsentModal: React.FC<CVConsentModalProps> = ({ fileInputRef, onAccept, onDecline }) => {
  return (
    // No onClick on backdrop — force explicit choice per privacy spec
    <div
      className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[30000] p-4 animate-fade-in"
      aria-modal="true"
      role="dialog"
      aria-labelledby="cv-consent-title"
    >
      <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-lg w-full border border-slate-200">

        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 bg-emerald-100 rounded-2xl text-emerald-600 shrink-0">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <div>
            <h2 id="cv-consent-title" className="text-xl font-black text-slate-900 tracking-tight">
              CV Upload <span className="text-slate-400 font-medium">(Optional)</span>
            </h2>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-0.5">Privacy Notice</p>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-slate-600 leading-relaxed mb-6">
          Upload your CV to receive interview questions tailored to your background and experience level.
        </p>

        {/* What we do */}
        <div className="mb-4 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700 mb-2">How we use your CV</p>
          {[
            'Generate personalised practice questions (takes ~30 seconds)',
            'Match questions to your experience level',
            'Processed securely, then immediately deleted',
            'NOT saved, NOT shared, NOT used for anything else',
          ].map(item => (
            <div key={item} className="flex items-start gap-2">
              <span className="text-emerald-500 font-black text-sm shrink-0">✓</span>
              <p className="text-xs text-emerald-800 font-medium leading-snug">{item}</p>
            </div>
          ))}
        </div>

        {/* Research metadata */}
        <div className="mb-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">For research purposes, we keep only</p>
          {[
            'Years of experience (e.g., "1 year")',
            'Degree type (e.g., "Psychology / STEM")',
            'General skills (e.g., "Excel, SPSS")',
          ].map(item => (
            <div key={item} className="flex items-start gap-2">
              <span className="text-slate-400 font-black text-sm shrink-0">–</span>
              <p className="text-xs text-slate-600 font-medium leading-snug">{item}</p>
            </div>
          ))}
        </div>

        {/* What we never keep */}
        <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl space-y-1.5">
          <p className="text-[10px] font-black uppercase tracking-widest text-rose-600 mb-2">We never keep</p>
          {[
            'Your name, email, or contact details',
            'University or employer names',
            'Specific dates or personal information',
          ].map(item => (
            <div key={item} className="flex items-start gap-2">
              <X className="w-3 h-3 text-rose-400 shrink-0 mt-0.5" />
              <p className="text-xs text-rose-700 font-medium leading-snug">{item}</p>
            </div>
          ))}
        </div>

        {/* Your choice note */}
        <p className="text-xs text-slate-500 leading-relaxed mb-6">
          <span className="font-bold text-slate-700">Your choice:</span> You can skip this and still get great interview practice with standard questions.
        </p>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <button
            onClick={() => {
              fileInputRef.current?.click();
              onAccept();
            }}
            className="w-full py-3.5 rounded-2xl font-black text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
          >
            <ShieldCheck className="w-4 h-4" />
            Upload CV — Get Personalised Questions
          </button>
          <button
            onClick={onDecline}
            className="w-full py-3 rounded-2xl font-black text-slate-500 hover:text-slate-800 transition-colors text-xs uppercase tracking-widest"
          >
            Skip — Use Standard Questions
          </button>
        </div>

        {/* Footer */}
        <p className="text-[10px] text-slate-400 text-center mt-4 leading-relaxed">
          By uploading, you consent to temporary CV processing as described above.
          See our Privacy Policy for details.
        </p>
      </div>
    </div>
  );
};

export default CVConsentModal;
