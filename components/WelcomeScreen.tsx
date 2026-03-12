
import React, { useRef, useState, useEffect } from 'react';
import { ShieldCheck, Wand2, ShieldAlert, FileUp, FileCheck, Loader2 } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import type { TimerDisplay, AnalyticsEventType, Question, RubricCriterion } from '../types';
import GuidedCoachMark from './GuidedCoachMark';
import ResumeCoach from './ResumeCoach';
import { generateInitialQuestions } from '../services/questionService';

// Set worker path for PDF.js (must be after all imports)
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

interface WelcomeScreenProps {
  onStart: () => void;
  logEvent: (type: AnalyticsEventType, metadata?: Record<string, any>) => void;
}

const DEFAULT_AUDIT_CRITERIA: RubricCriterion[] = [
    { id: 'impact', label: 'Quantifiable Merit Impact', weight: 40 },
    { id: 'alignment', label: 'Role-Specific Narrative Alignment', weight: 30 },
    { id: 'structure', label: 'ATS/Structural Integrity', weight: 30 }
];

const HELP_CONTENT: Record<string, { text: string }> = {
    'timer-display': { text: "Choose a time awareness tool that fits your preference for tracking session duration and phase targets." },
    'live-tools': { text: "Activate optional cognitive scaffolds to reduce executive load during the session." },
    'sensory-prefs': { text: "Customise interface visuals to ensure a predictable and low-stimulation environment." },
    'motivation': { text: "Enable discrete markers of progress to track session milestones." },
    'accessibility': { text: "Enable structural font adjustments to improve legibility and reduce visual fatigue." },
    'predictive-engine': { text: "Uses the Triarchic Merit Model (Autonomy, Competence, Relatedness) and Bloom's Taxonomy to map Magnitude Gaps and predict friction points." },
    'standard-jd': { text: "Input a Job Description to generate a set of standard practice questions tailored to the specific requirements of the role." }
};

const HelpIcon = ({ onClick }: { onClick: (event: React.MouseEvent) => void }) => (
    <button type="button" onClick={onClick} className="ml-2 p-1 -m-1 rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400" aria-label="Get help for this section">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    </button>
);

const RadioOption = ({ id, name, value, label, checked, onChange, description }: { id?: string, name: string, value: string, label: string, checked: boolean, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, description: string }) => (
    <label id={id} className="flex items-start p-4 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors has-[:checked]:bg-blue-50 has-[:checked]:border-blue-500">
        <input type="radio" name="timer" value={value} checked={checked} onChange={onChange} className="mt-1 mr-4 accent-blue-600" />
        <div>
            <span className="font-semibold text-slate-800">{label}</span>
            <p className="text-sm text-slate-600">{description}</p>
        </div>
    </label>
);

const ToggleOption = ({ id, label, checked, onChange, description }: { id?: string, label: string, checked: boolean, onChange: () => void, description: string }) => (
    <div id={id} onClick={onChange} className="flex items-start justify-between p-4 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
        <div>
            <span className="font-semibold text-slate-800">{label}</span>
            <p className="text-sm text-slate-600">{description}</p>
        </div>
        <div className={`mt-1 w-10 h-5 flex items-center rounded-full p-1 transition-colors ${checked ? 'bg-blue-600' : 'bg-slate-300'}`}>
            <div className={`bg-white w-3 h-3 rounded-full shadow-md transform transition-transform ${checked ? 'translate-x-5' : ''}`} />
        </div>
    </div>
);

const SpeakerIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 inline-block ml-2 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
    </svg>
);

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStart, logEvent }) => {
    const { 
        timerDisplay, setTimerDisplay, 
        liveTools, setLiveTools,
        dyslexiaFont, setDyslexiaFont,
        audioCues, setAudioCues,
        coachMarkTheme,
        speechRate,
        startTour,
        setActiveQuestions,
        isPredictiveActive,
        setIsPredictiveActive,
        cvText,
        setCvText
    } = useSettings();
    
    const [isHoverAudioActive, setIsHoverAudioActive] = useState(false);
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

    const [helpTopic, setHelpTopic] = useState<string | null>(null);
    const [helpPosition, setHelpPosition] = useState({ top: 0, left: 0 });
    const helpTriggerRef = useRef<HTMLButtonElement | null>(null);

    const [jobDescription, setJobDescription] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [companyLink, setCompanyLink] = useState('');
    const [targetRole, setTargetRole] = useState('');
    const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
    const [isExtractingPdf, setIsExtractingPdf] = useState(false);
    const [pdfFileName, setPdfFileName] = useState<string | null>(null);
    const [generationError, setGenerationError] = useState<string | null>(null);
    const [ndaAccepted, setNdaAccepted] = useState(false);
    const [showNdaError, setShowNdaError] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const showHelp = (topic: string, event: React.MouseEvent) => {
        const target = event.currentTarget as HTMLButtonElement;
        helpTriggerRef.current = target;
        const rect = target.getBoundingClientRect();
        const coachMarkWidth = 400;
        const coachMarkHeight = 80;
        const gap = 12;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let top = rect.top + (rect.height / 2) - (coachMarkHeight / 2);
        let left = (rect.right + coachMarkWidth + gap < viewportWidth) ? rect.right + gap : rect.left - coachMarkWidth - gap;
        
        if (top < gap) top = gap;
        if (top + coachMarkHeight > viewportHeight - gap) top = viewportHeight - coachMarkHeight - gap;

        setHelpPosition({ top, left });
        setHelpTopic(topic);
    };

    const hideHelp = () => { setHelpTopic(null); helpTriggerRef.current?.focus(); };

    const speak = (text: string) => {
        if (window.speechSynthesis.speaking) window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = speechRate;
        utterance.onend = () => { utteranceRef.current = null; };
        utteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
    }

    useEffect(() => { return () => { window.speechSynthesis.cancel(); }; }, []);
    const cancelSpeech = () => { if (utteranceRef.current) window.speechSynthesis.cancel(); };

    const handleAudioActivationHover = (e: React.MouseEvent<HTMLElement>) => {
        if (!audioCues) return;
        if (!isHoverAudioActive) setIsHoverAudioActive(true);
        speak(e.currentTarget.textContent || '');
    };

    const handleRegularHoverRead = (e: React.MouseEvent<HTMLElement>) => {
        if (!audioCues || !isHoverAudioActive) return;
        speak(e.currentTarget.textContent || '');
    };
    
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type !== 'application/pdf') {
            setGenerationError("Please upload a valid PDF file.");
            return;
        }

        setPdfFileName(file.name);
        setIsExtractingPdf(true);
        setGenerationError(null);

        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            let fullText = '';

            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map((item: any) => item.str).join(' ');
                fullText += pageText + '\n';
            }

            setCvText(fullText);
            logEvent('cv_uploaded', { fileName: file.name, fileSize: file.size });
        } catch (err) {
            console.error("PDF Extraction Error:", err);
            setGenerationError("Failed to extract text from PDF. Please try again or use a different file.");
            setPdfFileName(null);
        } finally {
            setIsExtractingPdf(false);
        }
    };

    const handleGenerateQuestions = async () => {
        if (!ndaAccepted) {
            setShowNdaError(true);
            return;
        }
        if (!jobDescription.trim() || !companyName.trim() || !targetRole.trim()) {
            setGenerationError("Please provide Company Name, Target Role, and Job Description.");
            return;
        }
        setIsGeneratingQuestions(true);
        setGenerationError(null);
        try {
            const questions = await generateInitialQuestions(
                jobDescription,
                companyName,
                targetRole,
                companyLink
            );
            if (questions.length > 0) {
                setActiveQuestions(questions);
                logEvent('questions_generated', { count: questions.length, company: companyName, role: targetRole });
                onStart(); // Directly join session
            } else {
                setGenerationError("Failed to generate questions. Please try again.");
            }
        } catch (err) {
            setGenerationError("An error occurred while generating questions.");
        } finally {
            setIsGeneratingQuestions(false);
        }
    };

    const handleStart = (e: React.FormEvent) => {
        e.preventDefault();
        if (!ndaAccepted) {
            setShowNdaError(true);
            return;
        }
        onStart();
    };

    const handleInitiatePractice = (questions: Question[]) => {
        if (!ndaAccepted) {
            setShowNdaError(true);
            return;
        }
        logEvent('session_start', { mode: 'predictive_alignment' });
        setActiveQuestions(questions);
        onStart();
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-slate-100 p-4 sm:p-6 md:p-8 animate-fade-in-scale">
            <div className="w-full max-w-4xl mx-auto bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                <div className="p-8 pb-4">
                    <div className="flex justify-between items-start">
                         <div id="welcome-header">
                             <div className="flex items-center gap-3 mb-2">
                                <h1 className="text-3xl font-bold text-slate-900" onMouseEnter={handleRegularHoverRead} onMouseLeave={cancelSpeech}>Ascend</h1>
                                <span className="bg-slate-100 text-slate-500 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border border-slate-200"></span>
                             </div>
                            <p className="text-slate-600" onMouseEnter={handleRegularHoverRead} onMouseLeave={cancelSpeech}>
                                Your AI-powered interview coach: Practice smarter, Perform better
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <button 
                                type="button" 
                                onClick={() => { logEvent('session_start', { mode: 'tour' }); startTour(); }}
                                className="px-4 py-2 rounded-lg font-semibold text-sm text-blue-700 bg-blue-100 hover:bg-blue-200 transition-colors"
                            >
                                View Guide
                            </button>
                        </div>
                    </div>

                    <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button 
                            onClick={() => setIsPredictiveActive(false)}
                            className={`p-6 rounded-2xl border-2 transition-all text-left ${!isPredictiveActive ? 'border-blue-600 bg-blue-50/30 ring-4 ring-blue-100' : 'border-slate-100 hover:border-slate-300'}`}
                        >
                            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 mb-1">PRACTICE WITH ASCEND</h3>
                            <p className="text-xs text-slate-500">Step into a real interview experience tailored to your CV and the role you want</p>
                        </button>
                        <button 
                            onClick={() => setIsPredictiveActive(true)}
                            className={`p-6 rounded-2xl border-2 transition-all text-left group ${isPredictiveActive ? 'border-indigo-600 bg-indigo-50/30 ring-4 ring-indigo-100' : 'border-slate-100 hover:border-slate-300'}`}
                        >
                            <div className="flex justify-between items-start">
                                <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 mb-1"> Simple and direct Job Search</h3>
                                <div className="p-1 bg-indigo-600 rounded text-[8px] text-white font-black uppercase tracking-tighter flex items-center gap-1">
                                    <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                                  
                                </div>
                            </div>
                            <p className="text-xs text-slate-500">Search smarter, track your applications, and stay on top of every opportunity</p>
                        </button>
                    </div>
                </div>

                {isPredictiveActive ? (
                    <div className="px-8 pb-8 pt-4">
                         <ResumeCoach criteria={DEFAULT_AUDIT_CRITERIA} onInitiatePractice={handleInitiatePractice} />
                    </div>
                ) : (
                    <form onSubmit={handleStart} className="p-8 border-t border-slate-200 animate-fade-in">
                        <div id="welcome-audio-cues" className="mb-10 p-6 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-6">
                            <div>
                                <h2 className="text-lg font-semibold text-slate-800 flex items-center" onMouseEnter={handleAudioActivationHover} onMouseLeave={cancelSpeech}>Audio Information Scaffolding <SpeakerIcon /></h2>
                                <p className="text-slate-600 mt-1 text-sm">Provides optional audio-based versions of setup information of all features on the main welcome screen/p>
                            </div>
                            <div id="welcome-audio-toggle" onClick={() => setAudioCues(!audioCues)} className={`flex-shrink-0 w-10 h-5 flex items-center rounded-full p-1 transition-colors cursor-pointer ${audioCues ? 'bg-blue-600' : 'bg-slate-300'}`}>
                                <div className={`bg-white w-3 h-3 rounded-full shadow-md transform transition-transform ${audioCues ? 'translate-x-5' : ''}`} />
                            </div>
                        </div>

                        <div className="space-y-10">
                            <fieldset id="welcome-nda-agreement">
                                <div className="flex items-center mb-4">
                                    <legend className="text-xl font-bold text-slate-800">Legal & Privacy</legend>
                                    <ShieldCheck className="w-5 h-5 ml-2 text-emerald-600" />
                                </div>
                                <div className={`p-6 rounded-2xl border-2 transition-all ${ndaAccepted ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 bg-slate-50'}`}>
                                    <div className="flex items-start gap-4">
                                        <input 
                                            type="checkbox" 
                                            id="nda-checkbox"
                                            checked={ndaAccepted}
                                            onChange={(e) => {
                                                setNdaAccepted(e.target.checked);
                                                if (e.target.checked) setShowNdaError(false);
                                            }}
                                            className="mt-1 w-5 h-5 accent-blue-600 cursor-pointer"
                                        />
                                        <div className="flex-1">
                                            <label htmlFor="nda-checkbox" className="block font-black text-slate-900 text-sm uppercase tracking-widest cursor-pointer">
                                                NDA & Confidentiality Agreement
                                            </label>
                                            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                                                I confirm that I have read and signed the <a href="https://docs.google.com/forms/d/e/1FAIpQLScejmkwr0VNMQAjK8SkwZLWMch0irQm1r7n2UZyG_6qovVKVQ/viewform" target="_blank" rel="noopener noreferrer" className="text-blue-600 font-bold hover:underline inline-flex items-center gap-1">NDA Agreement Form <ShieldCheck size={12} /></a>. I understand this platform is for personal interview practice only and that its content, logic, and frameworks are protected and remains confidential.
                                            </p>
                                            {showNdaError && (
                                                <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mt-3 animate-pulse">
                                                    Required: Please take a moment to read and agree to our terms, this protects both you and Ascend.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </fieldset>

                            <fieldset id="welcome-timer-display">
                                <div className="flex items-center mb-4"><legend className="text-xl font-bold text-slate-800">Time Awareness</legend><HelpIcon onClick={(e) => showHelp('timer-display', e)} /></div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <RadioOption name="timer" value="elapsed" label="Elapsed Timer" description="Counts up from zero." checked={timerDisplay === 'elapsed'} onChange={(e) => setTimerDisplay(e.target.value as TimerDisplay)} />
                                    <RadioOption name="timer" value="pacingAnchor" label="Phase Anchors" description="Visual targets for STAR phases." checked={timerDisplay === 'pacingAnchor'} onChange={(e) => setTimerDisplay(e.target.value as TimerDisplay)} />
                                </div>
                            </fieldset>

                            <fieldset id="welcome-accessibility">
                                <div className="flex items-center mb-4"><legend className="text-xl font-bold text-slate-800">Visual Accessibility</legend><HelpIcon onClick={(e) => showHelp('accessibility', e)} /></div>
                                <ToggleOption id="accessibility-dyslexia" label="Structural Font Adjustment" description="High-legibility font for reduced character confusion." checked={dyslexiaFont} onChange={() => setDyslexiaFont(!dyslexiaFont)} />
                            </fieldset>

                            <fieldset id="welcome-standard-jd">
                                <div className="flex items-center mb-4">
                                    <legend className="text-xl font-bold text-slate-800">Standard Practice Setup</legend>
                                    <HelpIcon onClick={(e) => showHelp('standard-jd', e)} />
                                </div>
                                <div className="space-y-4">
                                    <p className="text-xs text-slate-500 mb-2">
                                        Session starts with basic introductory questions and progressively raises difficulty levels to test your strategic depth.
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <input 
                                            type="text" 
                                            placeholder="Company Name" 
                                            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                                            value={companyName}
                                            onChange={(e) => setCompanyName(e.target.value)}
                                        />
                                        <input 
                                            type="text" 
                                            placeholder="Target Role" 
                                            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                                            value={targetRole}
                                            onChange={(e) => setTargetRole(e.target.value)}
                                        />
                                    </div>
                                    <input 
                                        type="text" 
                                        placeholder="Company or JD Link (Optional)" 
                                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                                        value={companyLink}
                                        onChange={(e) => setCompanyLink(e.target.value)}
                                    />
                                    <textarea 
                                        placeholder="Paste Job Description here..." 
                                        className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all resize-none"
                                        value={jobDescription}
                                        onChange={(e) => setJobDescription(e.target.value)}
                                    />
                                    <div className="pt-4">
                                        <label className="block text-sm font-black uppercase tracking-widest text-slate-400 mb-2">Your CV / Resume (PDF Required)</label>
                                        <div 
                                            onClick={() => fileInputRef.current?.click()}
                                            className={`w-full p-8 border-2 border-dashed rounded-2xl transition-all cursor-pointer flex flex-col items-center justify-center gap-3 ${
                                                pdfFileName 
                                                ? 'border-emerald-200 bg-emerald-50/30' 
                                                : 'border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/30'
                                            }`}
                                        >
                                            <input 
                                                type="file" 
                                                ref={fileInputRef}
                                                onChange={handleFileUpload}
                                                accept=".pdf"
                                                className="hidden"
                                            />
                                            
                                            {isExtractingPdf ? (
                                                <>
                                                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                                                    <p className="text-sm font-bold text-slate-600">Extracting Merit Data...</p>
                                                </>
                                            ) : pdfFileName ? (
                                                <>
                                                    <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                                                        <FileCheck className="w-6 h-6 text-emerald-600" />
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-sm font-bold text-slate-800">{pdfFileName}</p>
                                                        <p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest">Ready for Alignment Audit</p>
                                                    </div>
                                                    <button 
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setPdfFileName(null);
                                                            setCvText("");
                                                        }}
                                                        className="text-[10px] font-bold text-slate-400 hover:text-rose-500 underline"
                                                    >
                                                        Remove File
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                                                        <FileUp className="w-6 h-6 text-slate-400 group-hover:text-blue-500" />
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-sm font-bold text-slate-600">Click to upload CV (PDF)</p>
                                                        <p className="text-[10px] text-slate-400 font-medium">Triarchic Merit Alignment requires professional history context.</p>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-2 italic">The Scientific Engine correlates your PDF content with your verbal performance to detect Magnitude Gaps.</p>
                                    </div>
                                    {generationError && (
                                        <p className="text-xs font-bold text-rose-600 flex items-center gap-1">
                                            <ShieldAlert size={14} /> {generationError}
                                        </p>
                                    )}
                                </div>
                            </fieldset>
                        </div>

                        <div className="mt-12 pt-8 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-end gap-6">
                            <button 
                                id="welcome-start-button" 
                                type="button" 
                                onClick={handleGenerateQuestions}
                                disabled={isGeneratingQuestions}
                                className="px-12 py-4 rounded-xl font-black text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 hover:shadow-2xl hover:-translate-y-1 uppercase tracking-widest flex items-center gap-3 disabled:opacity-50"
                            >
                                {isGeneratingQuestions ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                        Synthesizing Session...
                                    </>
                                ) : (
                                    <>
                                        <Wand2 size={16} /> Join Session
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                )}
            </div>

            {helpTopic && (
                <GuidedCoachMark text={HELP_CONTENT[helpTopic].text} onEnd={hideHelp} theme={coachMarkTheme} initialPosition={helpPosition} />
            )}
        </div>
    );
};

// End of component
export default WelcomeScreen;
