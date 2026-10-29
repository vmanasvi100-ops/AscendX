
import React, { useRef, useState, useEffect } from 'react';
import { Wand2, ShieldAlert, FileUp, FileCheck, Loader2 } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import type { TimerFramingCondition, AnalyticsEventType, Question } from '../types';
import GuidedCoachMark from './GuidedCoachMark';
import { extractAnonymizedMetadata } from '../utils/anonymizeCV';
import { generateInitialQuestions, generateJDCVAlignmentQuestions, generateCVCompetencyQuestions, generateJDUnderstandingQuestions } from '../services/questionService';
import { QUESTION_REPOSITORY } from '../services/questionBank';
import { saveCvAlignment } from '../services/cvAlignment';
import { saveCvFile, fileToBase64 } from '../services/cvFileUpload';

// Set worker path for PDF.js (must be after all imports)
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
console.log("debugging deployment");
interface WelcomeScreenProps {
    onStart: () => void;
    logEvent: (type: AnalyticsEventType, metadata?: Record<string, any>) => void;
    onOpenSupportSettings: () => void;
}

const HELP_CONTENT: Record<string, { text: string }> = {
    'timer-display': { text: "Choose a time awareness tool that fits your preference for tracking session duration and phase targets." },
    'live-tools': { text: "Activate optional cognitive scaffolds to reduce executive load during the session." },
    'sensory-prefs': { text: "Customize interface visuals to ensure a predictable and low-stimulation environment." },
    'motivation': { text: "Enable discrete markers of progress to track session milestones." },
    'accessibility': { text: "Enable structural font adjustments to improve legibility and reduce visual fatigue." },
    'support-and-clips': { text: "Save your own answer clips to review later, and open the full Support settings page for voice, Clear Mode and other preferences — all optional, changeable any time." },
    'predictive-engine': { text: "Uses the Triarchic Merit Model (Autonomy, Competence, Relatedness) and Bloom's Taxonomy to map Magnitude Gaps and predict friction points." },
    'standard-jd': { text: "Input a Job Description to generate a set of standard practice questions tailored to the specific requirements of the role." }
};

const HelpIcon = ({ onClick }: { onClick: (event: React.MouseEvent) => void }) => (
    <button type="button" onClick={onClick} className="ml-2 p-1 -m-1 rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400" aria-label="Get help for this section">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    </button>
);

const RadioOption = ({ id, name, value, label, checked, onChange, description, onMouseEnter, onMouseLeave }: { id?: string, name: string, value: string, label: string, checked: boolean, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, description: string, onMouseEnter?: React.MouseEventHandler, onMouseLeave?: React.MouseEventHandler }) => (
    <label id={id} className="flex items-start p-4 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors has-[:checked]:bg-blue-50 has-[:checked]:border-blue-500" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
        <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="mt-1 mr-4 accent-blue-600" />
        <div>
            <span className="font-semibold text-slate-800">{label}</span>
            <p className="text-sm text-slate-600">{description}</p>
        </div>
    </label>
);

const ToggleOption = ({ id, label, checked, onChange, description, onMouseEnter, onMouseLeave }: { id?: string, label: string, checked: boolean, onChange: () => void, description: string, onMouseEnter?: React.MouseEventHandler, onMouseLeave?: React.MouseEventHandler }) => (
    <div id={id} onClick={onChange} className="flex items-start justify-between p-4 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
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
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 0 01-1-1v-4a1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
    </svg>
);

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStart, logEvent, onOpenSupportSettings }) => {
    const {
        dyslexiaFont, setDyslexiaFont,
        audioCues, setAudioCues,
        saveClips, setSaveClips,
        participantId,
        coachMarkTheme,
        speechRate,
        startTour,
        setActiveQuestions,
        cvText,
        setCvText,
        timerFramingCondition,
        setTimerFramingCondition,
        companyName,
        setCompanyName,
        targetRole,
        setTargetRole,
        jobDescription,
        setJobDescription,
        isTourActive,
        setQuestionsFinalized,
        setPhase2Started,
        setJdcvAlignmentAnalysis,
        preSessionAnswer,
        setPreSessionAnswer,
        mesoAccumulator,
    } = useSettings();

    // Your Participant ID — a durable per-device identifier (now localStorage-backed, see
    // SettingsContext.tsx) used instead of email to link a returning candidate's CV/JD alignment
    // and saved progress, with no per-session cost (no MX-verification call, no typing an email
    // each time). Shown here so the candidate can copy it down, and can paste a different one
    // back in if they want to pick up the same identity on another device/browser.
    const [idCopied, setIdCopied] = useState(false);
    const [showSwitchId, setShowSwitchId] = useState(false);
    const [switchIdDraft, setSwitchIdDraft] = useState('');
    const handleCopyId = () => {
        navigator.clipboard?.writeText(participantId).then(() => {
            setIdCopied(true);
            setTimeout(() => setIdCopied(false), 2000);
        }).catch(() => {});
    };
    const handleSwitchId = () => {
        const next = switchIdDraft.trim();
        if (!next) return;
        localStorage.setItem('ascend_active_pid', next);
        window.location.reload();
    };

    // Pulled from the last real session's forward-orientation note (the same data
    // MesoAccumulator/computeMesoDelta already track), not the old 'ascend_session_history'
    // key — that one was never written to anywhere, so this hint has been dead since
    // before cross-session tracking existed. mesoAccumulator is enriched with backend
    // history (by email) once a candidate completes hardware consent, so this also
    // benefits from cross-device reconstruction on return visits.
    const priorSessionHint = (() => {
        const sessions = mesoAccumulator?.sessions;
        if (!sessions || sessions.length === 0) return null;
        const lastSession = sessions[sessions.length - 1];
        return lastSession.forwardOrientationNotes.slice(-1)[0] ?? null;
    })();

    const [isHoverAudioActive, setIsHoverAudioActive] = useState(false);
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

    const [helpTopic, setHelpTopic] = useState<string | null>(null);
    const [helpPosition, setHelpPosition] = useState({ top: 0, left: 0 });
    const helpTriggerRef = useRef<HTMLButtonElement | null>(null);

    // Local state for non-persisted UI elements
    const [companyLink, setCompanyLink] = useState('');
    const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
    const [isExtractingPdf, setIsExtractingPdf] = useState(false);

    // Live Recommendation Logic
    useEffect(() => {
        if (preSessionAnswer === "The clock makes me rush") {
            setTimerFramingCondition('elapsed');
        } else if (preSessionAnswer === "I use the clock to pace myself") {
            setTimerFramingCondition('duration');
            const highPressureKeywords = ['trading', 'emergency', 'operations', 'fast-paced', 'high-frequency'];
            if (highPressureKeywords.some(kw => jobDescription.toLowerCase().includes(kw))) {
                setTimerFramingCondition('duration');
            }
            const seniorKeywords = ['senior', 'strategic', 'leadership', 'manager', 'director', 'vp', 'head of'];
            if (seniorKeywords.some(kw => cvText.toLowerCase().includes(kw))) {
                setTimerFramingCondition('used');
            }
        } else if (preSessionAnswer === "I forget about the clock and just speak") {
            setTimerFramingCondition('used');
            const seniorKeywords = ['senior', 'strategic', 'leadership', 'manager', 'director', 'vp', 'head of'];
            if (seniorKeywords.some(kw => cvText.toLowerCase().includes(kw))) {
                setTimerFramingCondition('used');
            }
        }
    }, [preSessionAnswer, cvText, jobDescription, setTimerFramingCondition]);
    const [pdfFileName, setPdfFileName] = useState<string | null>(null);
    const [generationError, setGenerationError] = useState<string | null>(null);

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

    const cancelSpeech = () => { window.speechSynthesis.cancel(); if (utteranceRef.current) utteranceRef.current = null; };

    const handleAudioActivationHover = (e: React.MouseEvent<HTMLElement>) => {
        if (!audioCues || isTourActive) return;
        if (!isHoverAudioActive) setIsHoverAudioActive(true);
        speak(e.currentTarget.textContent || '');
    };

    const handleRegularHoverRead = (e: React.MouseEvent<HTMLElement>) => {
        if (!audioCues || !isHoverAudioActive || isTourActive) return;
        speak(e.currentTarget.textContent || '');
    };

    const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const DOC_MIME = 'application/msword';
    const ACCEPTED_CV_MIME_TYPES = new Set(['application/pdf', DOCX_MIME, DOC_MIME]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            setGenerationError("File too large. Please upload a CV under 5MB.");
            return;
        }
        if (!ACCEPTED_CV_MIME_TYPES.has(file.type)) {
            setGenerationError("Please upload a PDF or Word (.docx) file.");
            return;
        }

        setPdfFileName(file.name);
        setIsExtractingPdf(true);
        setGenerationError(null);

        // Saved to the backend immediately, regardless of what happens with text extraction below
        // — an append-only record of the actual file uploaded (see services/cvFileUpload.ts and
        // 013_cv_file_uploads.sql), independent of whether PDF text extraction succeeds, whether
        // the candidate goes on to click "Generate Questions," or anything else downstream.
        fileToBase64(file).then(fileBase64 => {
            saveCvFile({ participantId, fileName: file.name, fileMime: file.type, fileBase64 });
        }).catch(err => console.error('Failed to read file for backend save:', err));

        const isWord = file.type === DOCX_MIME || file.type === DOC_MIME;
        if (isWord) {
            // Word text extraction isn't implemented (would need a parsing library this project
            // doesn't currently depend on) — the file itself is still saved above, just without
            // feeding cvText. Honest about the limitation rather than silently doing nothing:
            // alignment/example-grounding features need cvText, so they won't activate from a
            // Word upload yet. A PDF of the same CV would get full text extraction.
            setCvText('');
            setGenerationError("Your Word CV has been saved. For personalised examples (reading your actual CV content), a PDF works best right now — Word text extraction isn't available yet.");
            setIsExtractingPdf(false);
            return;
        }

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

            // Log only anonymized metadata — never log fileName, fileSize, or any CV text
            const anonMeta = extractAnonymizedMetadata(fullText);
            logEvent('cv_uploaded', {
                cv_uploaded: true,
                experience_years: anonMeta.experience_years,
                degree_discipline: anonMeta.degree_discipline,
                skill_keywords: anonMeta.skill_keywords,
            });
        } catch (err) {
            console.error("PDF Extraction Error:", err);
            setGenerationError("Failed to extract text from PDF. Please try again or use a different file.");
            setPdfFileName(null);
        } finally {
            setIsExtractingPdf(false);
        }
    };

    const handleGenerateQuestions = async () => {
        if (!jobDescription.trim() || !companyName.trim() || !targetRole.trim()) {
            setGenerationError("Please provide Company Name, Target Role, and Job Description.");
            return;
        }
        setIsGeneratingQuestions(true);
        setGenerationError(null);

        // Save the raw CV/JD to the backend right now, before anything else — keyed by
        // participantId (available immediately, no timing race against the candidate's email,
        // which is only captured later in the consent modal). This guarantees something durable
        // exists even if Phase 2's alignment call below fails, is slow, or the candidate never
        // reaches the consent modal — closing the gap where cvText was wiped from memory for
        // privacy (below) without ever having reached the backend first. Fire-and-forget: never
        // blocks question generation.
        saveCvAlignment({
            participantId,
            companyName: companyName || null,
            targetRole: targetRole || null,
            jobDescription: jobDescription || null,
            cvText: cvText || null,
        });

        try {
            // Phase 0: Repository questions — instant, no API
            const phase0 = QUESTION_REPOSITORY;
            setActiveQuestions(phase0);
            onStart();

            setQuestionsFinalized(false);
            setPhase2Started(false);

            // Phase 1: JD-based questions — always resolves so Phase 2 can always run
            const phase1Promise = Promise.all([
                generateInitialQuestions(jobDescription, companyName, targetRole, companyLink),
                generateJDUnderstandingQuestions(jobDescription, targetRole, companyName),
            ]).then(([jdQuestions, jdUnderstandingQuestions]) => {
                const phase1 = [...jdQuestions, ...jdUnderstandingQuestions];
                if (phase1.length > 0) {
                    setActiveQuestions([...phase0, ...phase1]);
                }
                return phase1;
            }).catch(err => {
                console.error("Phase 1 question generation failed:", err);
                return [] as Question[];
            });

            // Phase 2: CV-based questions — runs after Phase 1 regardless of its outcome
            if (cvText?.trim()) {
                phase1Promise.then(phase1 => {
                    setPhase2Started(true);
                    Promise.all([
                        generateJDCVAlignmentQuestions(jobDescription, cvText, targetRole, companyName),
                        generateCVCompetencyQuestions(cvText, targetRole, companyName),
                    ]).then(([jdCvResult, cvCompetencyQuestions]) => {
                        const phase2 = [...jdCvResult.questions, ...cvCompetencyQuestions];
                        if (phase2.length > 0) {
                            setActiveQuestions([...phase0, ...phase1, ...phase2]);
                        }
                        if (jdCvResult.analysis) {
                            setJdcvAlignmentAnalysis(jdCvResult.analysis);
                        }
                    }).catch(err => console.error("Phase 2 question generation failed:", err))
                    .finally(() => {
                        setQuestionsFinalized(true);
                        // Privacy: clear full CV text from memory once questions are generated
                        setCvText('');
                        setPdfFileName(null);
                    });
                });
            } else {
                phase1Promise.finally(() => setQuestionsFinalized(true));
            }

            // Do not log company/role — they are PII under the analytics validation rules
            logEvent('questions_generated', {
                question_source: cvText?.trim() ? 'JD+CV' : 'JD-only',
                phase0_count: phase0.length,
            });
        } catch (err) {
            setGenerationError("An error occurred while generating questions.");
        } finally {
            setIsGeneratingQuestions(false);
        }
    };

    const handleStart = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        onStart();
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-slate-100 p-4 sm:p-6 md:p-8 animate-fade-in-scale">
            <div className="w-full max-w-4xl mx-auto bg-white rounded-xl shadow-lg border border-slate-200">
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
                                onMouseEnter={handleRegularHoverRead} onMouseLeave={cancelSpeech}
                            >
                                View Guide
                            </button>
                        </div>
                    </div>

                    <div id="welcome-mode-selection" className="mt-8">
                        <div className="p-6 rounded-2xl border-2 border-blue-600 bg-blue-50/30 ring-4 ring-blue-100 text-left">
                            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 mb-1">PRACTICE WITH ASCEND</h3>
                            <p className="text-xs text-slate-500">Step into a real interview experience tailored to your CV and the role you want</p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleStart} className="p-8 border-t border-slate-200 animate-fade-in">
                        {priorSessionHint && (
                            <div className="mb-8 p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex items-start gap-3">
                                <div className="w-2 h-2 mt-1.5 rounded-full bg-indigo-500 flex-shrink-0" />
                                <p className="text-sm text-indigo-900">
                                    <span className="font-bold">From your last session:</span> {priorSessionHint} — something to focus on today.
                                </p>
                            </div>
                        )}
                        <div className="space-y-10">
                            <div id="welcome-participant-id">
                                <fieldset>
                                    <div className="flex items-center mb-4" onMouseEnter={handleRegularHoverRead} onMouseLeave={cancelSpeech}>
                                        <legend className="text-xl font-bold text-slate-800">Your Participant ID</legend>
                                    </div>
                                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                                        <p className="text-xs text-slate-500 mb-2" onMouseEnter={handleRegularHoverRead} onMouseLeave={cancelSpeech}>
                                            This ID remembers your CV/JD and saved progress on this device, automatically, every time you return — no email needed. Save it somewhere safe if you want to pick up the same identity on a different device or browser.
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <code className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-mono text-slate-800 truncate">{participantId}</code>
                                            <button
                                                type="button"
                                                onClick={handleCopyId}
                                                className="px-3 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-indigo-600 transition-all shrink-0"
                                            >
                                                {idCopied ? 'Copied' : 'Copy'}
                                            </button>
                                        </div>
                                        {!showSwitchId ? (
                                            <button
                                                type="button"
                                                onClick={() => setShowSwitchId(true)}
                                                className="mt-3 text-xs font-bold text-indigo-600 hover:text-indigo-700"
                                            >
                                                Use a different ID instead
                                            </button>
                                        ) : (
                                            <div className="mt-3 flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={switchIdDraft}
                                                    onChange={e => setSwitchIdDraft(e.target.value)}
                                                    placeholder="Paste an existing ID"
                                                    className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-mono outline-none focus:border-indigo-300"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleSwitchId}
                                                    disabled={!switchIdDraft.trim()}
                                                    className="px-3 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 disabled:opacity-40 transition-all shrink-0"
                                                >
                                                    Switch
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </fieldset>
                            </div>

                            <div id="welcome-support-and-clips">
                                <fieldset>
                                    <div className="flex items-center mb-4" onMouseEnter={handleRegularHoverRead} onMouseLeave={cancelSpeech}>
                                        <legend className="text-xl font-bold text-slate-800">Support &amp; Answer Clips</legend>
                                        <HelpIcon onClick={(e) => showHelp('support-and-clips', e)} />
                                    </div>
                                    <ToggleOption
                                        id="support-save-clips"
                                        label="Save my answer clips"
                                        description="Keeps a recording of each answer (video if your camera is on, audio otherwise) in your Reflection Library, stored only in this browser. Off by default, never uploaded, never analysed beyond the transcript, never used to train any model."
                                        checked={saveClips === 'device'}
                                        onChange={() => setSaveClips(saveClips === 'device' ? 'off' : 'device')}
                                        onMouseEnter={handleRegularHoverRead} onMouseLeave={cancelSpeech}
                                    />
                                    <div className="mt-4">
                                        <button
                                            type="button"
                                            onClick={onOpenSupportSettings}
                                            onMouseEnter={handleRegularHoverRead} onMouseLeave={cancelSpeech}
                                            className="w-full p-4 text-left bg-white border border-slate-200 rounded-2xl hover:border-indigo-300 transition-all"
                                        >
                                            <p className="text-sm font-bold text-slate-800">Support settings</p>
                                            <p className="text-xs text-slate-500 mt-1">Clear Mode, voice, AI tutor and visual explanation preferences.</p>
                                        </button>
                                    </div>
                                </fieldset>
                            </div>

                            <div id="welcome-standard-jd">
                                <fieldset>
                                    <div className="flex items-center mb-4" onMouseEnter={handleRegularHoverRead} onMouseLeave={cancelSpeech}>
                                        <legend className="text-xl font-bold text-slate-800">Standard Practice Setup</legend>
                                        <HelpIcon onClick={(e) => showHelp('standard-jd', e)} />
                                    </div>
                                    <div className="space-y-4">
                                        <p className="text-xs text-slate-500 mb-2" onMouseEnter={handleRegularHoverRead} onMouseLeave={cancelSpeech}>
                                            Session starts with basic introductory questions and progressively raises difficulty levels to test your strategic depth.
                                        </p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <input
                                                type="text"
                                                placeholder="Company Name"
                                                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                                                value={companyName}
                                                onChange={(e) => setCompanyName(e.target.value)}
                                                onMouseEnter={handleRegularHoverRead} onMouseLeave={cancelSpeech}
                                            />
                                            <input
                                                type="text"
                                                placeholder="Target Role"
                                                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                                                value={targetRole}
                                                onChange={(e) => setTargetRole(e.target.value)}
                                                onMouseEnter={handleRegularHoverRead} onMouseLeave={cancelSpeech}
                                            />
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Company or JD Link (Optional)"
                                            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                                            value={companyLink}
                                            onChange={(e) => setCompanyLink(e.target.value)}
                                            onMouseEnter={handleRegularHoverRead} onMouseLeave={cancelSpeech}
                                        />
                                        <textarea
                                            placeholder="Paste Job Description here..."
                                            className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all resize-none"
                                            value={jobDescription}
                                            onChange={(e) => setJobDescription(e.target.value)}
                                            onMouseEnter={handleRegularHoverRead} onMouseLeave={cancelSpeech}
                                        />
                                        <div className="pt-4" onMouseEnter={handleRegularHoverRead} onMouseLeave={cancelSpeech}>
                                            <label className="block text-sm font-black uppercase tracking-widest text-slate-400 mb-2">Your CV / Resume (PDF or Word)</label>
                                            <div
                                                onClick={() => fileInputRef.current?.click()}
                                                className={`w-full p-8 border-2 border-dashed rounded-2xl transition-all cursor-pointer flex flex-col items-center justify-center gap-3 ${pdfFileName
                                                    ? 'border-emerald-200 bg-emerald-50/30'
                                                    : 'border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/30'
                                                    }`}
                                            >
                                                <input
                                                    type="file"
                                                    ref={fileInputRef}
                                                    onChange={handleFileUpload}
                                                    accept=".pdf,.docx,.doc"
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
                                                            <p className="text-sm font-bold text-slate-600">Click to upload CV (PDF or Word)</p>
                                                            <p className="text-[10px] text-slate-400 font-medium">Practice with Ascend at your own pace</p>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-slate-400 mt-2 italic" onMouseEnter={handleRegularHoverRead} onMouseLeave={cancelSpeech}>Please wait while the system aligns your input for question generation for the best interview experience. Our advanced interview practice platform correlates your CV content with your verbal performance to detect Skill Gaps.</p>
                                        </div>
                                        {generationError && (
                                            <p className="text-xs font-bold text-rose-600 flex items-center gap-1">
                                                <ShieldAlert size={14} /> {generationError}
                                            </p>
                                        )}
                                    </div>
                                </fieldset>
                            </div>
                        </div>

                        <div className="mt-12 pt-8 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-end gap-6">
                            <button
                                id="welcome-start-button"
                                type="button"
                                onClick={handleGenerateQuestions}
                                disabled={isGeneratingQuestions}
                                className="px-12 py-4 rounded-xl font-black text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 hover:shadow-2xl hover:-translate-y-1 uppercase tracking-widest flex items-center gap-3 disabled:opacity-50"
                                onMouseEnter={handleRegularHoverRead} onMouseLeave={cancelSpeech}
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
            </div>

            {helpTopic && (
                <GuidedCoachMark text={HELP_CONTENT[helpTopic].text} onEnd={hideHelp} theme={coachMarkTheme} initialPosition={helpPosition} />
            )}
        </div>
    );
};

// End of component
export default WelcomeScreen;
