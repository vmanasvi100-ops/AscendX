
import React, { useState, useEffect, useRef } from 'react';
import { useSettings } from '../context/SettingsContext';
import { RecordingStatus, AnalyticsEventType, TimerDisplay, Question, Probe, ProbeAnalysis, DetailedFeedback, QuestionSummaryReport, TimerFramingCondition } from '../types';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { generateProbe, analyzeProbeResponse, generateQuestionSummary } from '../services/probingService';
import { generateDetailedFeedback } from '../services/feedbackService';
import ProbingPipeline from './ProbingPipeline';
import ProbingReport from './ProbingReport';
import { AnimatePresence } from 'motion/react';
import { Brain, Award, BookOpen, ShieldAlert, CheckCircle2, TrendingUp, Download, FileText, Sparkles, Scale, Layers, ShieldCheck, Target } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { tourSteps } from '../data';

type ToolkitTab = 'plan' | 'notes' | 'transcript' | 'insights' | 'report';

interface SessionEntry {
    questionIndex: number;
    questionText: string;
    starPhaseReached: number;
    transcriptSlice: string;
    probe: Probe | null;
    probeAnalysis: ProbeAnalysis | null;
    summaryReport: QuestionSummaryReport | null;
}
type VideoState = 'standard' | 'hidden';
type AspectRatio = '9/16' | '2/3' | '3/4' | '4/5' | '3/2' | '16/10' | '16/5' | '16/7' | '20/7';

function encode(bytes: Uint8Array) {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

const Waveform: React.FC<{ active: boolean; scale?: number }> = ({ active, scale = 1 }) => (
    <div className="flex items-end justify-center gap-1.5 h-16" style={{ transform: `scale(${scale})` }}>
        {[...Array(12)].map((_, i) => (
            <div
                key={i}
                className={`w-2 bg-indigo-500 rounded-full transition-all duration-150 ${active ? 'waveform-bar' : 'h-2 opacity-30'}`}
                style={{
                    animationDelay: `${i * 0.05}s`,
                    height: active ? '100%' : '8px'
                }}
            />
        ))}
    </div>
);

const TimerWidget: React.FC<{
    mode: TimerDisplay;
    elapsedSeconds: number;
    isRecording: boolean;
    isHidden: boolean;
}> = ({ mode, elapsedSeconds, isRecording, isHidden }) => {
    if (isHidden) return null;

    const format = (s: number) => {
        const mins = Math.floor(s / 60);
        const secs = s % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className={`flex items-center gap-3 px-4 py-2 rounded-2xl backdrop-blur-md border transition-all duration-500 shadow-xl ${isRecording ? 'bg-white/90 border-indigo-200' : 'bg-white/70 border-slate-200'
            }`}>
            <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-rose-500 animate-pulse' : 'bg-slate-300'}`} />
            <span className="text-base font-black font-mono tabular-nums leading-none text-slate-900">{format(elapsedSeconds)}</span>
        </div>
    );
};

interface AscendPlatformProps {
    logEvent: (type: AnalyticsEventType, metadata?: Record<string, any>) => void;
    onExit: () => void;
}

const AscendPlatform: React.FC<AscendPlatformProps> = ({ logEvent, onExit }) => {
    const { 
        videoEnabled, 
        setVideoEnabled, 
        dyslexiaFont, 
        timerDisplay, 
        liveTools, 
        activeQuestions, 
        cvText, 
        companyName, 
        targetRole, 
        jobDescription, 
        timerFramingCondition, 
        participantId,
        isTourActive,
        tourStep 
    } = useSettings();
    const [starPhase, setStarPhase] = useState(0);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [recordingStatus, setRecordingStatus] = useState<RecordingStatus>('idle');

    const [transcript, setTranscript] = useState<string>("");
    const lastPhaseTranscriptLength = useRef<number>(0);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const sessionPromiseRef = useRef<Promise<any> | null>(null);

    const [videoState, setVideoState] = useState<VideoState>('standard');
    const [isTimerHidden, setIsTimerHidden] = useState(false);

    const phaseStartTimestamp = useRef<number>(Date.now());
    const reportRef = useRef<HTMLDivElement>(null);
    const [isBreakActive, setIsBreakActive] = useState(false);
    const [breakTimeRemaining, setBreakTimeRemaining] = useState(120);
    const [isWarmupActive, setIsWarmupActive] = useState(false);
    const [warmupTimeRemaining, setWarmupTimeRemaining] = useState(5);
    const [sessionSeconds, setSessionSeconds] = useState(0);
    const [userNotes, setUserNotes] = useState(() => localStorage.getItem('ascend_notes') || "");

    // Probing Pipeline State
    const [currentProbe, setCurrentProbe] = useState<Probe | null>(null);
    const [probeAnalysis, setProbeAnalysis] = useState<ProbeAnalysis | null>(null);
    const [isGeneratingProbe, setIsGeneratingProbe] = useState(false);
    const [isProbingActive, setIsProbingActive] = useState(false);
    const [probingTranscript, setProbingTranscript] = useState("");
    const [probeCountdown, setProbeCountdown] = useState(0);
    const [decisionCountdown, setDecisionCountdown] = useState(0);
    const [micCountdown, setMicCountdown] = useState(0);
    const [isMicOpening, setIsMicOpening] = useState(false);
    const [reassuringMessage, setReassuringMessage] = useState("");

    // Session Log Accumulator
    const [sessionLog, setSessionLog] = useState<SessionEntry[]>([]);
    const [reportModalEntry, setReportModalEntry] = useState<SessionEntry | null>(null);

    // Detailed Feedback State
    const [detailedFeedback, setDetailedFeedback] = useState<DetailedFeedback | null>(null);
    const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);
    const [activeTab, setActiveTab] = useState<ToolkitTab>('plan');

    const STAR_LABELS = ['Situation', 'Task', 'Action', 'Result'];
    const CATEGORIES = [
        'Introductory Alignment',
        'Foundational Behavioral',
        'Role-Specific Domain',
        'Complex Scenario Analysis',
        'Strategic High-Stakes'
    ];

    useEffect(() => {
        logEvent('session_start', { mode: 'interview' });
        phaseStartTimestamp.current = Date.now();
    }, []);

    useEffect(() => {
        localStorage.setItem('ascend_notes', userNotes);
    }, [userNotes]);

    useEffect(() => {
        let timer: number;
        if (recordingStatus === 'recording' && !isBreakActive) {
            timer = window.setInterval(() => setSessionSeconds(prev => prev + 1), 1000);
        }
        return () => clearInterval(timer);
    }, [recordingStatus, isBreakActive]);

    useEffect(() => {
        let timer: number | undefined;
        if (probeCountdown > 0) {
            timer = window.setInterval(() => setProbeCountdown(prev => prev - 1), 1000);
        }
        return () => clearInterval(timer);
    }, [probeCountdown]);

    useEffect(() => {
        let timer: number | undefined;
        if (decisionCountdown > 0) {
            timer = window.setInterval(() => setDecisionCountdown(prev => prev - 1), 1000);
        }
        return () => clearInterval(timer);
    }, [decisionCountdown]);

    useEffect(() => {
        let timer: number | undefined;
        if (micCountdown > 0) {
            timer = window.setInterval(() => setMicCountdown(prev => prev - 1), 1000);
        } else if (micCountdown === 0 && isMicOpening && recordingStatus === 'idle' && stream) {
            // Auto-trigger recording after micCountdown hits 0 if we were in the opening flow
            setIsMicOpening(false);
            setRecordingStatus('recording');
            startTranscription(stream);
        }
        return () => clearInterval(timer);
    }, [micCountdown, isMicOpening, stream]);

    useEffect(() => {
        let timer: number | undefined;
        if (isBreakActive && !isWarmupActive && breakTimeRemaining > 0) {
            timer = window.setInterval(() => setBreakTimeRemaining(prev => prev - 1), 1000);
        } else if (isBreakActive && !isWarmupActive && breakTimeRemaining === 0) {
            setIsWarmupActive(true);
            setWarmupTimeRemaining(5);
        } else if (isBreakActive && isWarmupActive && warmupTimeRemaining > 0) {
            timer = window.setInterval(() => setWarmupTimeRemaining(prev => prev - 1), 1000);
        } else if (isBreakActive && isWarmupActive && warmupTimeRemaining === 0) {
            setIsBreakActive(false);
            setIsWarmupActive(false);
        }
        return () => clearInterval(timer);
    }, [isBreakActive, isWarmupActive, breakTimeRemaining, warmupTimeRemaining]);
    
    const { finishSessionTrigger, setFinishSessionTrigger } = useSettings();
    useEffect(() => {
        if (finishSessionTrigger) {
            setFinishSessionTrigger(false);
            const forceFinish = async () => {
                try {
                    if (recordingStatus === 'recording') {
                        await handleRecord();
                    }
                    // Buffering to ensure transcript state is fully settled from the stream
                    await new Promise(r => setTimeout(r, 800));
                    setIsGeneratingFeedback(true);
                    setRecordingStatus('uploaded');
                    await handleGenerateFinalFeedback();
                } catch (err) {
                    console.error("Automated finish failed:", err);
                    setRecordingStatus('uploaded');
                }
            };
            forceFinish();
        }
    }, [finishSessionTrigger, recordingStatus]); // Keep recordingStatus to handle the handleRecord state correctly

    // Tour Reactive Navigation
    useEffect(() => {
        if (!isTourActive) return;
        
        const currentStep = tourSteps[tourStep];
        if (!currentStep) return;

        // Auto-switch tabs based on targetId
        if (currentStep.targetId?.startsWith('tab-')) {
            const tabName = currentStep.targetId.replace('tab-', '') as ToolkitTab;
            setActiveTab(tabName);
        } else if (
            currentStep.targetId === 'ascend-toolkit-sidebar' ||
            currentStep.targetId === 'ascend-toolkit-star' ||
            currentStep.targetId === 'ascend-toolkit-section'
        ) {
            setActiveTab('plan');
        } else if (
            currentStep.targetId === 'ascend-probing-pipeline' ||
            currentStep.targetId?.includes('insights')
        ) {
            setActiveTab('insights');
        } else if (
            currentStep.targetId === 'ascend-toolkit-reports' ||
            currentStep.targetId?.includes('report')
        ) {
            setActiveTab('report');
        }
    }, [isTourActive, tourStep]);

    const handleStartBreak = async () => {
        if (recordingStatus === 'recording') await handleRecord();
        setBreakTimeRemaining(120);
        setIsWarmupActive(false);
        setIsBreakActive(true);
    };

    const startTranscription = async (mediaStream: MediaStream, retryCount = 0) => {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || process.env.GEMINI_API_KEY });
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });

        try {
            const sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        const source = audioContext.createMediaStreamSource(mediaStream);
                        const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
                        scriptProcessor.onaudioprocess = (e) => {
                            const inputData = e.inputBuffer.getChannelData(0);
                            const int16 = new Int16Array(inputData.length);
                            for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
                            const pcmBlob = { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
                            sessionPromise.then(session => {
                                if (session) session.sendRealtimeInput({ media: pcmBlob });
                            }).catch(err => console.error("Failed to send audio:", err));
                        };
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(audioContext.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        if (message.serverContent?.inputTranscription) {
                            setTranscript(prev => prev + message.serverContent.inputTranscription.text);
                        }
                    },
                    onerror: (e) => {
                        console.error('Transcription error:', e);
                        if (retryCount < 3 && recordingStatus === 'recording') {
                            console.log(`Retrying transcription (attempt ${retryCount + 1})...`);
                            setTimeout(() => startTranscription(mediaStream, retryCount + 1), 1000);
                        }
                    },
                    onclose: () => {
                        setIsTranscribing(false);
                        if (audioContext.state !== 'closed') audioContext.close().catch(() => { });
                    }
                },
                config: { responseModalities: [Modality.AUDIO], inputAudioTranscription: {} }
            });
            sessionPromiseRef.current = sessionPromise;
            setIsTranscribing(true);
        } catch (err) {
            console.error("Failed to connect to transcription service:", err);
            if (retryCount < 3 && recordingStatus === 'recording') {
                setTimeout(() => startTranscription(mediaStream, retryCount + 1), 1000);
            }
        }
    };

    const handleRecord = async () => {
        if (recordingStatus === 'idle') {
            if (!stream) return;

            // If it's a probe answer, add the 5-second "Opening Mic" delay
            if (isProbingActive && !isMicOpening && probingTranscript.length > 0) {
                setIsMicOpening(true);
                setMicCountdown(5);
                return;
            }

            setRecordingStatus('recording');
            startTranscription(stream);
        } else {
            setRecordingStatus('idle');
            if (sessionPromiseRef.current) (await sessionPromiseRef.current).close();
            setIsTranscribing(false);

            // Trigger Analysis if probing is active
            if (isProbingActive && transcript.length > probingTranscript.length) {
                // Analyze the response to the probe
                handleAnalyzeProbe();
            }
        }
    };

    const triggerProbing = async () => {
        setIsProbingActive(true);
        setIsGeneratingProbe(true);
        setActiveTab('plan');
        const messages = [
            "You are doing well. Stay focused, the follow-up question will be ready in a while. Till then relax!",
            "Analyzing your response for key highlights...",
            "Preparing the next step in our conversation...",
            "Reviewing context to ensure a smooth transition...",
            "Just a moment while we set up the next insight..."
        ];
        setReassuringMessage(messages[Math.floor(Math.random() * messages.length)]);
        setProbingTranscript(transcript); // Mark the start of the probe response
        try {
            const probe = await generateProbe({
                candidateId: participantId,
                targetRole,
                companyName,
                cvSummary: cvText || 'Not provided',
                jobDescription: jobDescription || 'Not provided',
                currentQuestion: { text: currentQuestion.text, type: 'interview', difficulty: currentQuestion.difficulty },
                sessionPhaseIndex: currentQuestionIndex,
                questionsAnsweredCount: currentQuestionIndex,
                priorProbesThisQuestion: currentProbe ? currentProbe.probe : '',
                candidateAnswer: transcript,
                conversationHistory: transcript.slice(-500),
            });
            setCurrentProbe(probe);
        } catch (err) {
            console.error("Failed to generate probe:", err);
        } finally {
            setIsGeneratingProbe(false);
        }
    };

    const handleAnalyzeProbe = async () => {
        if (!currentProbe) return;
        setIsGeneratingProbe(true);
        // The reassuring message is now handled by the useEffect hook
        try {
            const responseToProbe = transcript.slice(probingTranscript.length || lastPhaseTranscriptLength.current);
            const analysis = await analyzeProbeResponse({
                targetRole,
                companyName,
                question: currentQuestion.text,
                probe: currentProbe.probe,
                probeType: currentProbe.probe_type,
                probeRationale: currentProbe.rationale,
                response: responseToProbe,
                scaffoldPhase: currentProbe.scaffold_phase,
            });
            setProbeAnalysis(analysis);
            setActiveTab('insights');
        } catch (err) {
            console.error("Failed to analyze probe response:", err);
        } finally {
            setIsGeneratingProbe(false);
        }
    };

    const handleNextPhase = async () => {
        if (recordingStatus === 'recording') await handleRecord();

        const newSegment = transcript.slice(lastPhaseTranscriptLength.current).trim();

        const generateAndLog = async (isFinal = false) => {
            setIsGeneratingProbe(true);
            let summaryReport: QuestionSummaryReport | null = null;
            try {
                summaryReport = await generateQuestionSummary({
                    accumulator: {
                        questionId: currentQuestion.text,
                        transcript: transcript,
                        phaseAnalyses: [],
                        probeAnalyses: probeAnalysis ? [probeAnalysis] : [],
                        timerFramingCondition: (timerFramingCondition as TimerFramingCondition) || 'elapsed',
                        responseDurations: {
                            actOne: Math.round((Date.now() - phaseStartTimestamp.current) / 1000),
                            probes: [],
                        },
                    },
                    targetRole,
                    companyName,
                });
            } catch (err) {
                console.error('Failed to generate question summary:', err);
            }

            setSessionLog(prev => [...prev, {
                questionIndex: currentQuestionIndex,
                questionText: currentQuestion.text,
                starPhaseReached: starPhase,
                transcriptSlice: transcript,
                probe: currentProbe,
                probeAnalysis: probeAnalysis,
                summaryReport: summaryReport,
            }]);

            if (isFinal) {
                // Ensure state is settled
                await new Promise(r => setTimeout(r, 500));
                setIsGeneratingFeedback(true);
                setRecordingStatus('uploaded');
                await handleGenerateFinalFeedback();
            } else {
                setActiveTab('plan');
                // Ensure immediate reassurance if there's any lag in question load
                setReassuringMessage("The next question is on its way. Be focused, Be ready");
                setCurrentQuestionIndex(prev => prev + 1);
                setStarPhase(0);
                setSessionSeconds(0);
                phaseStartTimestamp.current = Date.now();
                setIsProbingActive(false);
                setCurrentProbe(null);
                setProbeAnalysis(null);
                setProbingTranscript("");
                setIsGeneratingProbe(false);
            }
        };

        // Handle Probing Answer
        if (isProbingActive) {
            if (newSegment.length < 15) {
                // Politely nudge for empty transcript
                setActiveTab('plan');
                setReassuringMessage("The next question is on its way. Be focused, Be ready");

                // Allow the state update to render before the blocking alert
                alert("We couldn't catch that response! Please ensure your mic is active and you've provided a follow-up answer. We'll move to the next question for now.");

                // Skip to next question
                await generateAndLog(currentQuestionIndex >= activeQuestions.length - 1);
                return;
            }

            // Valid response, analyze it
            setIsGeneratingProbe(true);
            try {
                const analysis = await analyzeProbeResponse({
                    targetRole,
                    companyName,
                    question: currentQuestion.text,
                    probe: currentProbe?.probe || "",
                    probeType: currentProbe?.probe_type as any || "CLARIFYING",
                    probeRationale: currentProbe?.rationale || "",
                    response: newSegment,
                    scaffoldPhase: currentProbe?.scaffold_phase || 1,
                });

                setProbeAnalysis(analysis);
                lastPhaseTranscriptLength.current = transcript.length;

                if (!analysis.proceed) {
                    // AI wants more depth - trigger iterative Probe (2, 3...)
                    setActiveTab('plan');
                    await triggerProbing();
                } else {
                    // AI is satisfied - clear state BEFORE final log/transition
                    setProbeAnalysis(null);
                    setCurrentProbe(null);
                    await generateAndLog(currentQuestionIndex >= activeQuestions.length - 1);
                }
            } catch (err) {
                console.error("Iterative probing error:", err);
                setProbeAnalysis(null);
                setCurrentProbe(null);
                await generateAndLog(currentQuestionIndex >= activeQuestions.length - 1);
            } finally {
                setIsGeneratingProbe(false);
            }
            return;
        }

        // Standard STAR Progression
        if (starPhase < 3) {
            setStarPhase(prev => prev + 1);
            lastPhaseTranscriptLength.current = transcript.length;
            phaseStartTimestamp.current = Date.now();
        } else {
            // Act 1 Complete -> Trigger First Probe
            if (decisionCountdown === 0) {
                setDecisionCountdown(3);
                triggerProbing();
                lastPhaseTranscriptLength.current = transcript.length;
            }
        }
    };

    const handleNextQuestion = async () => {
        setIsGeneratingProbe(true);
        if (recordingStatus === 'recording') await handleRecord();
        if (currentQuestionIndex < activeQuestions.length - 1) {
            // Log before skipping
            setSessionLog(prev => [...prev, {
                questionIndex: currentQuestionIndex,
                questionText: currentQuestion.text,
                starPhaseReached: starPhase,
                transcriptSlice: transcript.slice(lastPhaseTranscriptLength.current),
                probe: currentProbe,
                probeAnalysis: probeAnalysis,
                summaryReport: null,
            }]);
            setActiveTab('plan');
            setReassuringMessage("The next question is on its way. Be focused, Be ready");
            setCurrentQuestionIndex(prev => prev + 1);
            setStarPhase(0);
            setSessionSeconds(0);
            phaseStartTimestamp.current = Date.now();
            // Reset probing state
            setIsProbingActive(false);
            setCurrentProbe(null);
            setProbeAnalysis(null);
            setProbingTranscript("");
            setActiveTab('plan');
            setTimeout(() => setIsGeneratingProbe(false), 800);
        }
    };

    const handlePrevQuestion = async () => {
        if (recordingStatus === 'recording') await handleRecord();
        if (currentQuestionIndex > 0) {
            setCurrentQuestionIndex(prev => prev - 1);
            setStarPhase(0);
            setSessionSeconds(0);
            phaseStartTimestamp.current = Date.now();
            setActiveTab('plan');
            // Reset probing state
            setIsProbingActive(false);
            setCurrentProbe(null);
            setProbeAnalysis(null);
            setProbingTranscript("");
        }
    };

    const handleGenerateFinalFeedback = async () => {
        if (transcript.trim().length < 30) {
            setDetailedFeedback({
                noData: true,
                performanceSummary: "No interview data was recorded. The Coherence Auditor requires verbal input to generate a high-fidelity alignment report. Please ensure your microphone is active and you provide structured STAR responses.",
                overallStarSynthesis: "Insufficient data for session synthesis.",
                rubrics: {
                    starCompletion: 0,
                    evidenceSpecificity: 0,
                    roleClarity: 0,
                    jdAlignment: 0,
                    communicationClarity: 0,
                    justifications: {
                        starCompletion: "No data available",
                        evidenceSpecificity: "No data available",
                        roleClarity: "No data available",
                        jdAlignment: "No data available",
                        communicationClarity: "No data available"
                    }
                },
                strengths: [],
                weaknesses: ["Zero verbal signal detected"],
                actionableSuggestions: ["Check microphone permissions", "Provide verbal responses to all STAR phases"],
                biasAndFairnessNote: "Audit aborted due to lack of input signal.",
                starAnalysis: { situation: "N/A", task: "N/A", action: "N/A", result: "N/A" },
                keywordCoverage: { found: [], missing: [] },
                careerDevelopment: { certifications: [], nextSteps: ["Restart Simulation"] },
                maskedTranscript: { text: transcript || "" }
            });
            return;
        }

        setIsGeneratingFeedback(true);
        try {
            const feedback = await generateDetailedFeedback({
                transcript,
                jobRequirements: activeQuestions.map(q => q.text).join("\n"),
                cvText,
                probeAnalysis: probeAnalysis ? JSON.stringify(probeAnalysis) : undefined,
                targetRole,
                companyName,
                condition: 'standard',
                phaseProgression: `${currentQuestionIndex + 1} of ${activeQuestions.length} questions completed`,
            });
            setDetailedFeedback(feedback);
        } catch (err) {
            console.error("Failed to generate final feedback:", err);
        } finally {
            setIsGeneratingFeedback(false);
        }
    };

    const handleExitClick = () => {
        // Direct exit to avoid blocked popups/confirmations
        onExit();
    };

    useEffect(() => {
        async function initMedia() {
            try {
                let s: MediaStream;
                try {
                    s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                } catch (videoErr) {
                    console.warn("Video failed, falling back to audio only:", videoErr);
                    s = await navigator.mediaDevices.getUserMedia({ audio: true });
                }
                setStream(s);
            } catch (err) { console.error("Media error:", err); }
        }
        initMedia();
        return () => stream?.getTracks().forEach(t => t.stop());
    }, []);

    useEffect(() => {
        if (videoRef.current && stream) videoRef.current.srcObject = stream;
    }, [stream, videoState]);

    const currentQuestion = activeQuestions[currentQuestionIndex] || activeQuestions[0];
    const currentRequirement = currentQuestion.requirements[starPhase];

    const handleDownloadReport = () => {
        if (!detailedFeedback) return;

        const rd = detailedFeedback.rubrics;
        const reportContent = `
# ASCEND COHERENCE AUDIT REPORT
Generated on: ${new Date().toLocaleString()}
Target Role: ${targetRole} at ${companyName}
Session ID: ${Math.random().toString(36).substring(2, 15).toUpperCase()}

## 1. EXECUTIVE SUMMARY
${detailedFeedback.performanceSummary}

## 2. OVERALL STAR SYNTHESIS
${detailedFeedback.overallStarSynthesis || 'N/A'}

## 3. PERFORMANCE RUBRICS (1–5 Scale)
- STAR Completion:      ${rd?.starCompletion ?? 0}/5 — ${rd?.justifications?.starCompletion || ''}
- Evidence Specificity: ${rd?.evidenceSpecificity ?? 0}/5 — ${rd?.justifications?.evidenceSpecificity || ''}
- Role Clarity:         ${rd?.roleClarity ?? 0}/5 — ${rd?.justifications?.roleClarity || ''}
- JD Alignment:         ${rd?.jdAlignment ?? 0}/5 — ${rd?.justifications?.jdAlignment || ''}
- Communication:        ${rd?.communicationClarity ?? 0}/5 — ${rd?.justifications?.communicationClarity || ''}

## 4. KEY STRENGTHS
${detailedFeedback.strengths.map(s => `+ ${s}`).join('\n')}

## 5. IMPROVEMENT AREAS
${detailedFeedback.weaknesses.map(w => `- ${w}`).join('\n')}

## 6. STAR ANALYSIS
- Situation: ${detailedFeedback.starAnalysis.situation}
- Task:      ${detailedFeedback.starAnalysis.task}
- Action:    ${detailedFeedback.starAnalysis.action}
- Result:    ${detailedFeedback.starAnalysis.result}

## 7. KEYWORD COVERAGE
Found:   ${detailedFeedback.keywordCoverage.found.join(', ')}
Missing: ${detailedFeedback.keywordCoverage.missing.join(', ')}

## 8. ACTIONABLE REMEDIATION
${detailedFeedback.actionableSuggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}

## 9. CHC COGNITIVE SIGNALS (McGrew, 2009)
${detailedFeedback.chcCognitiveDimensions ? `- Crystallised Intelligence (Gc): ${detailedFeedback.chcCognitiveDimensions.crystallisedIntelligence?.score ?? 'N/A'}/100 — ${detailedFeedback.chcCognitiveDimensions.crystallisedIntelligence?.evidenceBasis || ''}
- Fluid Intelligence (Gf):       ${detailedFeedback.chcCognitiveDimensions.fluidIntelligence?.score ?? 'N/A'}/100 — ${detailedFeedback.chcCognitiveDimensions.fluidIntelligence?.evidenceBasis || ''}
- Practical Reasoning (Gq):      ${detailedFeedback.chcCognitiveDimensions.practicalReasoning?.score ?? 'N/A'}/100 — ${detailedFeedback.chcCognitiveDimensions.practicalReasoning?.evidenceBasis || ''}
Note: ${detailedFeedback.chcCognitiveDimensions.overallCHCNote || 'N/A'}` : 'CHC data unavailable.'}

## 10. SDT MERIT VECTORS (Deci & Ryan, 2000)
${detailedFeedback.meritVectors ? `- Autonomy:   ${detailedFeedback.meritVectors.autonomy.score}/100 — ${detailedFeedback.meritVectors.autonomy.evidenceBasis}
- Competence: ${detailedFeedback.meritVectors.competence.score}/100 — ${detailedFeedback.meritVectors.competence.evidenceBasis}
- Relatedness:${detailedFeedback.meritVectors.relatedness.score}/100 — ${detailedFeedback.meritVectors.relatedness.evidenceBasis}` : 'SDT data unavailable.'}

## 11. PROCEDURAL JUSTICE DIMENSIONS (Lind et al., 1990)
${detailedFeedback.proceduralJusticeDimensions ? Object.entries(detailedFeedback.proceduralJusticeDimensions).filter(([k]) => k !== 'overallPJNote').map(([k, v]: [string, any]) => `- ${k.charAt(0).toUpperCase() + k.slice(1)}: ${v.score}/100 — ${v.evidenceBasis}`).join('\n') + `\nNote: ${detailedFeedback.proceduralJusticeDimensions.overallPJNote}` : 'PJ data unavailable.'}

## 12. SCAFFOLDED LEARNING (Vygotsky, 1978)
${detailedFeedback.scaffoldedLearningSignal ? `- ZPD Observation: ${detailedFeedback.scaffoldedLearningSignal.zpdProgressionObservation || 'N/A'}
- Dependency: ${detailedFeedback.scaffoldedLearningSignal.scaffoldDependency?.interpretation || 'N/A'}
- Lower Boundary: ${detailedFeedback.scaffoldedLearningSignal.zoneOfProximalDevelopmentEstimate?.lowerBoundary || 'N/A'}
- Upper Boundary: ${detailedFeedback.scaffoldedLearningSignal.zoneOfProximalDevelopmentEstimate?.upperBoundary || 'N/A'}
- Dev Gap: ${detailedFeedback.scaffoldedLearningSignal.zoneOfProximalDevelopmentEstimate?.developmentGap || 'N/A'}` : 'Vygotsky data unavailable.'}

## 13. CAREER DEVELOPMENT
Recommended Certs: ${detailedFeedback.careerDevelopment.certifications.join(', ')}
Next Steps:        ${detailedFeedback.careerDevelopment.nextSteps.join(', ')}

## 14. RESEARCH SIGNALS
- Algorithmic Aversion: ${detailedFeedback.algorithmicAversionSignal?.aversionDetected ? 'DETECTED' : 'Not Detected'} — ${detailedFeedback.algorithmicAversionSignal?.aversionEvidence || 'No evidence.'}
- Social Identity:     ${detailedFeedback.socialIdentityAwareness?.activated ? `Active (${detailedFeedback.socialIdentityAwareness.dominantMotivation || 'Balanced'})` : 'Inactive'} — ${detailedFeedback.socialIdentityAwareness?.scopeNote}

## 15. INTEGRITY & SAFETY AUDIT
Violation Detected: ${detailedFeedback.integrityViolation?.detected ? 'YES' : 'NO'}
${detailedFeedback.integrityViolation?.detected ? `Note: ${detailedFeedback.integrityViolation.note}` : ''}
Bias & Fairness: ${typeof detailedFeedback.biasAndFairnessNote === 'string' ? detailedFeedback.biasAndFairnessNote : (detailedFeedback.biasAndFairnessNote as any)?.overallFairnessNote || 'See full report.'}

## 16. INTERVIEW TRANSCRIPT
${typeof detailedFeedback.maskedTranscript === 'object' ? (detailedFeedback.maskedTranscript as any)?.text : detailedFeedback.maskedTranscript || transcript}

---
© ${new Date().getFullYear()} Ascend Platform. Confidential Performance Intelligence Report.
        `.trim();

        const blob = new Blob([reportContent], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Ascend_Audit_Report_${new Date().toISOString().split('T')[0]}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleDownloadQuestionReport = (entry: SessionEntry) => {
        if (!entry.summaryReport) return;
        const sr = entry.summaryReport;
        const pa = entry.probeAnalysis;

        let content = `
# RESPONSE ANALYSIS REPORT: Q${entry.questionIndex + 1}
Generated on: ${new Date().toLocaleString()}
Participant: ${participantId}

## 1. QUESTION CONTEXT
"${entry.questionText}"

## 2. ANSWER OVERVIEW
${sr.answerOverview}

## 3. STAR PERFORMANCE
Phase Reached: ${STAR_LABELS[entry.starPhaseReached]}

## 4. KEY STRENGTHS
${sr.strengths.map(s => `- ${s}`).join('\n')}

## 5. DEVELOPMENT POINTS
${sr.developmentPoints.map(dp => `### ${dp.gap}
- Why it matters: ${dp.whyItMatters}
- Instruction: ${dp.instruction}`).join('\n\n')}

## 6. PROBE ENGAGEMENT & CORRELATION
### Engagement Narrative
${sr.probeEngagement}

### Act-Probe Correlation
${sr.probeCorrelation}

### Integrated Excellence Guidance
${sr.integratedCoaching}

${pa ? `
## 7. HIGH-FIDELITY PSYCHOLOGICAL SIGNALS
### SDT MERIT VECTORS
- Autonomy:    ${pa.merit_vectors.autonomy}/100
- Competence:  ${pa.merit_vectors.competence}/100
- Relatedness: ${pa.merit_vectors.relatedness}/100
- Lowest Vector: ${pa.merit_vectors.lowest_vector.toUpperCase()}

### CHC COGNITIVE SIGNALS
- Crystallised Intelligence (Gc): ${pa.chc_signals.gc.toUpperCase()}
- Fluid Reasoning (Gf):          ${pa.chc_signals.gf.toUpperCase()}
- Quantitative/Technical (Gq):   ${pa.chc_signals.gq.toUpperCase()}

### PROCEDURAL JUSTICE (PJ) OBSERVATIONS
${pa.pj_observations.map(obs => `- ${obs}`).join('\n')}

### GOFFMAN PRESENTATION SCORES
- Front Stage (Professional): ${pa.goffman_scores.front_stage}/100
- Back Stage (Authentic):     ${pa.goffman_scores.back_stage}/100

### SCAFFOLD ASSESSMENT
- Dependency: ${pa.scaffold_dependency_signal.replace(/_/g, ' ').toUpperCase()}
- Interpretation: ${pa.interpretation}
- Decision: ${pa.reason}

### COACHING GUIDANCE
- Signal: ${pa.coaching_guidance?.framework_gap || 'N/A'}
- Instruction: ${pa.coaching_guidance?.instruction || 'N/A'}
- Example PHRASE: "${pa.coaching_guidance?.example_phrase || 'N/A'}"

### REAL-TIME COACHING TIP
${pa.coaching_tip || 'Focus on maintaining STAR structure.'}
` : ''}

## 8. TRANSCRIPT RECORD
### ACT 1 (STAR RESPONSE)
${entry.transcriptSlice || "Transcript unavailable for this segment."}

${entry.probeAnalysis ? `
### PROBE RESPONSE
${transcript.slice(probingTranscript.length) || "Transcript unavailable for probe response."}
` : ''}

## 9. ONE THING TO PRACTISE
${sr.practiceTask}

---
Generated by AscendX Coherence Auditor
Professional Performance Intelligence
`.trim();

        const blob = new Blob([content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Response_Q${entry.questionIndex + 1}_${participantId}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    if (recordingStatus === 'uploaded') {
        return (
            <div className="min-h-screen w-screen bg-slate-50 flex flex-col items-center p-8 overflow-y-auto custom-scrollbar animate-fade-in relative">
                <div className="max-w-7xl w-full space-y-12">
                    <div id="report-header" className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 border-b border-slate-200 pb-12">
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 bg-indigo-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-indigo-900/20">
                                    <FileText className="text-white" size={32} />
                                </div>
                                <div>
                                    <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase leading-none">Coherence Audit</h1>
                                    <p className="text-slate-500 font-bold uppercase tracking-[0.3em] text-[10px] mt-2">Professional Performance Intelligence Report</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-6">
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Generated On</span>
                                    <span className="text-xs font-bold text-slate-700">{new Date().toLocaleDateString()}</span>
                                </div>
                                <div className="w-px h-8 bg-slate-200" />
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Session ID</span>
                                    <span className="text-xs font-bold text-slate-700">{Math.random().toString(36).substring(2, 10).toUpperCase()}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-4">
                            <button
                                onClick={handleDownloadReport}
                                className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] flex items-center gap-3 hover:bg-indigo-600 transition-all shadow-2xl shadow-slate-900/20 active:scale-95"
                            >
                                <Download size={18} /> Download Report (.md)
                            </button>
                            <button
                                onClick={() => window.print()}
                                className="px-8 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-[11px] flex items-center gap-3 hover:bg-slate-50 transition-all active:scale-95"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                                Print Report
                            </button>
                        </div>
                    </div>

                    {detailedFeedback?.noData && (
                        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-amber-700 max-w-2xl">
                            <ShieldAlert size={20} />
                            <p className="text-xs font-bold uppercase tracking-widest">Warning: Minimal input signal detected. Results may be incomplete.</p>
                        </div>
                    )}

                    {isGeneratingFeedback ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-6">
                            <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                            <div className="text-center">
                                <p className="text-sm font-black uppercase tracking-widest text-slate-900">Synthesizing Performance Summary</p>
                                <p className="text-[10px] font-medium text-slate-500">Mitigating bias and ensuring procedural justice...</p>
                            </div>
                        </div>
                    ) : detailedFeedback ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {/* Left Column: Summary & Rubrics */}
                            <div className="md:col-span-2 space-y-8">
                                {/* Performance Summary */}
                                <section id="report-performance-summary" className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                                            <TrendingUp size={20} />
                                        </div>
                                        <h3 className="text-lg font-black uppercase tracking-widest text-slate-900">Performance Summary</h3>
                                    </div>
                                    <p className="text-slate-700 leading-relaxed font-medium">{detailedFeedback.performanceSummary}</p>
                                    {detailedFeedback.overallStarSynthesis && (
                                        <div className="mt-6 p-5 bg-indigo-50 rounded-2xl border border-indigo-100">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-indigo-500 mb-2">STAR Session Synthesis</p>
                                            <p className="text-sm font-medium text-slate-700 leading-relaxed">{detailedFeedback.overallStarSynthesis}</p>
                                        </div>
                                    )}

                                    {/* Rubrics — 5 scores as progress bars */}
                                    <div id="report-rubrics-grid" className="mt-8 space-y-4">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Professional Rubrics (1–5 Scale)</p>
                                        {(detailedFeedback?.rubrics ? [
                                            { key: 'starCompletion', label: 'STAR Completion' },
                                            { key: 'evidenceSpecificity', label: 'Evidence Specificity' },
                                            { key: 'roleClarity', label: 'Role Clarity' },
                                            { key: 'jdAlignment', label: 'JD Alignment' },
                                            { key: 'communicationClarity', label: 'Communication Clarity' },
                                        ] as const : []).map(({ key, label }) => {
                                            const score = detailedFeedback.rubrics?.[key] ?? 0;
                                            const justification = detailedFeedback.rubrics?.justifications?.[key];
                                            return (
                                                <div key={key} className="group">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</span>
                                                        <span className="text-base font-black text-indigo-600">{score}<span className="text-slate-300 font-bold text-xs">/5</span></span>
                                                    </div>
                                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all duration-700"
                                                            style={{ width: `${(score / 5) * 100}%` }}
                                                        />
                                                    </div>
                                                    {justification && (
                                                        <p className="text-[10px] font-medium text-slate-500 mt-1 italic">{justification}</p>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>

                                <section className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
                                    <h3 className="text-sm font-black uppercase tracking-widest text-indigo-600 mb-6 flex items-center gap-2">
                                        <Award size={16} /> STAR Analysis
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {(detailedFeedback.starAnalysis && typeof detailedFeedback.starAnalysis === 'object') ? Object.entries(detailedFeedback.starAnalysis).map(([key, value]) => (
                                            <div key={key} className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                                                <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-2">{key}</h4>
                                                <p className="text-xs font-medium text-slate-700 leading-relaxed">{value}</p>
                                            </div>
                                        )) : null}
                                    </div>
                                </section>

                                <section className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
                                    <h3 className="text-sm font-black uppercase tracking-widest text-indigo-600 mb-6 flex items-center gap-2">
                                        <ShieldAlert size={16} /> Keyword Coverage
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div>
                                            <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-4">Keywords Found</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {(detailedFeedback.keywordCoverage?.found || []).map((k, i) => (
                                                    <span key={i} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                                                        {k}
                                                    </span>
                                                ))}
                                                {(!detailedFeedback.keywordCoverage?.found || detailedFeedback.keywordCoverage.found.length === 0) && <p className="text-xs text-slate-400 italic">No keywords identified.</p>}
                                            </div>
                                        </div>
                                        <div>
                                            <h4 className="text-[10px] font-black uppercase tracking-widest text-rose-600 mb-4">Keywords Missing</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {(detailedFeedback.keywordCoverage?.missing || []).map((k, i) => (
                                                    <span key={i} className="px-3 py-1.5 bg-rose-50 text-rose-700 rounded-lg text-[10px] font-black uppercase tracking-widest border border-rose-100">
                                                        {k}
                                                    </span>
                                                ))}
                                                {(!detailedFeedback.keywordCoverage?.missing || detailedFeedback.keywordCoverage.missing.length === 0) && <p className="text-xs text-slate-400 italic">No missing keywords identified.</p>}
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <section className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
                                        <h3 className="text-sm font-black uppercase tracking-widest text-emerald-600 mb-6 flex items-center gap-2">
                                            <CheckCircle2 size={16} /> Key Strengths
                                        </h3>
                                        <ul className="space-y-4">
                                            {(detailedFeedback?.strengths || []).map((s, i) => (
                                                <li key={i} className="flex gap-3 text-xs font-medium text-slate-700">
                                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1.5 shrink-0" />
                                                    {s}
                                                </li>
                                            ))}
                                        </ul>
                                    </section>
                                    <section className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
                                        <h3 className="text-sm font-black uppercase tracking-widest text-rose-600 mb-6 flex items-center gap-2">
                                            <ShieldAlert size={16} /> Improvement Areas
                                        </h3>
                                        <ul className="space-y-4">
                                            {(detailedFeedback?.weaknesses || []).map((w, i) => (
                                                <li key={i} className="flex gap-3 text-xs font-medium text-slate-700">
                                                    <div className="w-1.5 h-1.5 bg-rose-500 rounded-full mt-1.5 shrink-0" />
                                                    {w}
                                                </li>
                                            ))}
                                        </ul>
                                    </section>
                                </div>

                                {/* CHC Cognitive Signals */}
                                {detailedFeedback.chcCognitiveDimensions && (
                                    <section className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm" id="report-chc-clusters">
                                        <h3 className="text-sm font-black uppercase tracking-widest text-indigo-600 mb-2 flex items-center gap-2">
                                            <Brain size={16} /> CHC Cognitive Signals
                                        </h3>
                                        <p className="text-[9px] font-medium text-slate-400 mb-6">McGrew (2009) — AI-generated proxy, exploratory</p>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                            {([
                                                { key: 'crystallisedIntelligence', label: 'Crystallised (Gc)', color: 'indigo' },
                                                { key: 'fluidIntelligence', label: 'Fluid (Gf)', color: 'violet' },
                                                { key: 'practicalReasoning', label: 'Practical (Gq)', color: 'blue' },
                                            ] as const).map(({ key, label }) => {
                                                const dim = detailedFeedback.chcCognitiveDimensions![key];
                                                const score = dim?.score ?? null;
                                                return (
                                                    <div key={key} className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                                                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">{label}</p>
                                                        <div className="flex items-end gap-2 mb-2">
                                                            <span className="text-3xl font-black text-indigo-600">{score ?? '—'}</span>
                                                            {score !== null && score !== undefined && <span className="text-slate-300 font-bold text-sm mb-1">/100</span>}
                                                        </div>
                                                        <div className="h-1.5 bg-slate-200 rounded-full mb-3">
                                                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${score ?? 0}%` }} />
                                                        </div>
                                                        <p className="text-[10px] font-medium text-slate-600 leading-snug">{dim?.evidenceBasis}</p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {detailedFeedback.chcCognitiveDimensions.overallCHCNote && (
                                            <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                                                <p className="text-[10px] font-medium text-indigo-800 italic">{detailedFeedback.chcCognitiveDimensions.overallCHCNote}</p>
                                            </div>
                                        )}
                                    </section>
                                )}

                                {/* SDT Merit Vectors */}
                                {detailedFeedback.meritVectors && (
                                    <section className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
                                        <h3 className="text-sm font-black uppercase tracking-widest text-indigo-600 mb-2 flex items-center gap-2">
                                            <TrendingUp size={16} /> SDT Merit Vectors
                                        </h3>
                                        <p className="text-[9px] font-medium text-slate-400 mb-6">Deci & Ryan (2000) — Self-Determination Theory</p>
                                        <div className="space-y-4">
                                            {(['autonomy', 'competence', 'relatedness'] as const).map((key) => {
                                                const v = detailedFeedback.meritVectors?.[key];
                                                if (!v) return null;
                                                const lowest = detailedFeedback.meritVectors?.lowestVector === key;
                                                return (
                                                    <div key={key} className={`p-4 rounded-2xl border ${lowest ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-100'}`}>
                                                        <div className="flex justify-between items-center mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 capitalize">{key}</span>
                                                                {lowest && <span className="px-2 py-0.5 bg-rose-100 text-rose-600 text-[8px] font-black uppercase tracking-widest rounded-full">Priority</span>}
                                                            </div>
                                                            <span className={`text-base font-black ${lowest ? 'text-rose-600' : 'text-indigo-600'}`}>{v.score}</span>
                                                        </div>
                                                        <div className="h-1.5 bg-white rounded-full mb-2">
                                                            <div className={`h-full rounded-full ${lowest ? 'bg-rose-400' : 'bg-indigo-400'}`} style={{ width: `${v.score}%` }} />
                                                        </div>
                                                        <p className="text-[10px] font-medium text-slate-600 leading-snug">{v.evidenceBasis}</p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </section>
                                )}

                                {/* Goffman Impression Management */}
                                {detailedFeedback.impressionManagementScore && (
                                    <section className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
                                        <h3 className="text-sm font-black uppercase tracking-widest text-indigo-600 mb-2 flex items-center gap-2">
                                            <Award size={16} /> Impression Management
                                        </h3>
                                        <p className="text-[9px] font-medium text-slate-400 mb-6">Goffman (1959) — Front-Stage vs. Back-Stage</p>
                                        <div className="grid grid-cols-2 gap-4 mb-4">
                                            {[{ label: 'Front Stage', key: 'frontStageScore' as const, desc: 'Polished, professional' },
                                            { label: 'Back Stage', key: 'backStageScore' as const, desc: 'Authentic, genuine' }].map(({ label, key, desc }) => {
                                                const score = detailedFeedback.impressionManagementScore?.[key] ?? 0;
                                                return (
                                                    <div key={key} className="p-5 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                                                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">{label}</p>
                                                        <p className="text-[9px] text-slate-400 mb-3">{desc}</p>
                                                        <span className="text-3xl font-black text-indigo-600">{score}</span>
                                                        <span className="text-slate-300 font-bold text-sm">/100</span>
                                                        <div className="mt-2 h-1.5 bg-slate-200 rounded-full">
                                                            <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${score}%` }} />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {detailedFeedback.impressionManagementScore && (
                                            <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-indigo-500 mb-1">Dominant Mode: {detailedFeedback.impressionManagementScore.dominantMode?.replace(/_/g, ' ') || 'N/A'}</p>
                                                <p className="text-[10px] font-medium text-indigo-800">{detailedFeedback.impressionManagementScore.feedbackImplication}</p>
                                            </div>
                                        )}
                                    </section>
                                )}

                                {/* Procedural Justice Dimensions */}
                                {detailedFeedback.proceduralJusticeDimensions && (
                                    <section className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
                                        <h3 className="text-sm font-black uppercase tracking-widest text-indigo-600 mb-2 flex items-center gap-2">
                                            <Scale size={16} /> Procedural Justice
                                        </h3>
                                        <p className="text-[9px] font-medium text-slate-400 mb-6">Lind et al. (1990) — Candidate Perception Metrics</p>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                                            {(['voice', 'validation', 'respect', 'neutrality', 'motivation', 'explanation'] as const).map((key) => {
                                                const d = detailedFeedback.proceduralJusticeDimensions?.[key];
                                                if (!d) return null;
                                                return (
                                                    <div key={key} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                                        <div className="flex justify-between items-center mb-1">
                                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{key}</span>
                                                            <span className="text-sm font-black text-indigo-600">{d.score}</span>
                                                        </div>
                                                        <div className="h-1 bg-slate-200 rounded-full mb-2">
                                                            <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${d.score}%` }} />
                                                        </div>
                                                        <p className="text-[9px] text-slate-500 leading-tight line-clamp-2">{d.evidenceBasis}</p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {detailedFeedback.proceduralJusticeDimensions?.overallPJNote && (
                                            <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                                                <p className="text-[10px] font-medium text-indigo-800 italic">{detailedFeedback.proceduralJusticeDimensions.overallPJNote}</p>
                                            </div>
                                        )}
                                    </section>
                                )}

                                {/* Vygotsky Scaffolded Learning */}
                                {detailedFeedback.scaffoldedLearningSignal && (
                                    <section className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
                                        <h3 className="text-sm font-black uppercase tracking-widest text-indigo-600 mb-2 flex items-center gap-2">
                                            <Layers size={16} /> Scaffolded Learning
                                        </h3>
                                        <p className="text-[9px] font-medium text-slate-400 mb-6">Vygotsky (1978) — ZPD Induction Analysis</p>
                                        <div className="space-y-4">
                                            <div className="p-5 bg-slate-900 rounded-[24px]">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400 mb-2">ZPD Progression Observation</p>
                                                <p className="text-xs text-white/90 leading-relaxed italic">"{detailedFeedback.scaffoldedLearningSignal.zpdProgressionObservation}"</p>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Lower Boundary</p>
                                                    <p className="text-xs font-bold text-slate-700">{detailedFeedback.scaffoldedLearningSignal.zoneOfProximalDevelopmentEstimate?.lowerBoundary || 'N/A'}</p>
                                                </div>
                                                <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-indigo-500 mb-1">Upper Boundary</p>
                                                    <p className="text-xs font-bold text-indigo-900">{detailedFeedback.scaffoldedLearningSignal.zoneOfProximalDevelopmentEstimate?.upperBoundary || 'N/A'}</p>
                                                </div>
                                            </div>
                                            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600 mb-1">Development Gap Identified</p>
                                                <p className="text-xs font-medium text-emerald-800 leading-snug">{detailedFeedback.scaffoldedLearningSignal.zoneOfProximalDevelopmentEstimate?.developmentGap || 'N/A'}</p>
                                            </div>
                                        </div>
                                    </section>
                                )}

                                {/* Algorithmic Aversion & Social Identity */}
                                {(detailedFeedback.algorithmicAversionSignal || detailedFeedback.socialIdentityAwareness) && (
                                    <section className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
                                        <h3 className="text-sm font-black uppercase tracking-widest text-indigo-600 mb-6 flex items-center gap-2">
                                            <ShieldCheck size={16} /> Research Guardrails
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {detailedFeedback.algorithmicAversionSignal && (
                                                <div className={`p-5 rounded-2xl border ${detailedFeedback.algorithmicAversionSignal.aversionDetected ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'}`}>
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Algorithmic Aversion</p>
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <div className={`w-2 h-2 rounded-full ${detailedFeedback.algorithmicAversionSignal.aversionDetected ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                                        <span className="text-xs font-black uppercase">{detailedFeedback.algorithmicAversionSignal.aversionDetected ? 'Detected' : 'Clear'}</span>
                                                    </div>
                                                    <p className="text-[10px] font-medium text-slate-600 leading-relaxed">{detailedFeedback.algorithmicAversionSignal.aversionEvidence || "No indicators of algorithmic scepticism detected in current verbal performance."}</p>
                                                </div>
                                            )}
                                            {detailedFeedback.socialIdentityAwareness && (
                                                <div className={`p-5 rounded-2xl border ${detailedFeedback.socialIdentityAwareness.activated ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-100'}`}>
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Social Identity Aware</p>
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <span className="text-xs font-black uppercase text-indigo-600">{detailedFeedback.socialIdentityAwareness.activated ? 'Activated' : 'Silent'}</span>
                                                        {detailedFeedback.socialIdentityAwareness.activated && (
                                                            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-600 text-[8px] font-black rounded-full uppercase">{detailedFeedback.socialIdentityAwareness.dominantMotivation}</span>
                                                        )}
                                                    </div>
                                                    <p className="text-[10px] font-medium text-slate-600 leading-relaxed">{detailedFeedback.socialIdentityAwareness.scopeNote}</p>
                                                </div>
                                            )}
                                        </div>
                                    </section>
                                )}

                                <section id="report-actionable-insights" className="bg-slate-900 text-white p-8 rounded-[40px] shadow-xl">
                                    <h3 className="text-sm font-black uppercase tracking-widest text-indigo-400 mb-6 flex items-center gap-2">
                                        <Brain size={16} /> Actionable Remediation
                                    </h3>
                                    <div className="grid grid-cols-1 gap-4">
                                        {(detailedFeedback?.actionableSuggestions || []).map((s, i) => (
                                            <div key={i} className="p-4 bg-white/5 rounded-2xl border border-white/10 flex items-start gap-4">
                                                <div className="w-6 h-6 bg-indigo-500/20 rounded-lg flex items-center justify-center text-indigo-400 shrink-0 font-black text-xs">
                                                    {i + 1}
                                                </div>
                                                <p className="text-sm font-medium opacity-90">{s}</p>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            </div>

                            {/* Right Column: Career & Bias */}
                            <div className="space-y-8">
                                {detailedFeedback.integrityViolation?.detected && (
                                    <section className={`p-8 rounded-[40px] border shadow-sm animate-pulse ${detailedFeedback.integrityViolation.type === 'abusive_language' || detailedFeedback.integrityViolation.type === 'sensitive_information'
                                        ? 'bg-rose-50 border-rose-200'
                                        : 'bg-amber-50 border-amber-200'
                                        }`}>
                                        <h3 className={`text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2 ${detailedFeedback.integrityViolation.type === 'abusive_language' || detailedFeedback.integrityViolation.type === 'sensitive_information'
                                            ? 'text-rose-600'
                                            : 'text-amber-600'
                                            }`}>
                                            <ShieldAlert size={18} />
                                            {detailedFeedback.integrityViolation.type === 'low_value' ? 'Low Value Input Detected' :
                                                detailedFeedback.integrityViolation.type === 'out_of_context' ? 'Contextual Drift Identified' :
                                                    'Integrity Violation Detected'}
                                        </h3>
                                        <p className={`text-xs font-bold leading-relaxed ${detailedFeedback.integrityViolation.type === 'abusive_language' || detailedFeedback.integrityViolation.type === 'sensitive_information'
                                            ? 'text-rose-700'
                                            : 'text-amber-700'
                                            }`}>
                                            {detailedFeedback.integrityViolation.note}
                                        </p>
                                        <div className={`mt-4 p-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-center ${detailedFeedback.integrityViolation.type === 'abusive_language' || detailedFeedback.integrityViolation.type === 'sensitive_information'
                                            ? 'bg-rose-100 text-rose-800'
                                            : 'bg-amber-100 text-amber-800'
                                            }`}>
                                            {detailedFeedback.integrityViolation.type === 'abusive_language' || detailedFeedback.integrityViolation.type === 'sensitive_information'
                                                ? 'Continued violations may lead to account debarment.'
                                                : 'Future sessions should prioritize professional contextual alignment.'}
                                        </div>
                                    </section>
                                )}

                                <section className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
                                    <h3 className="text-sm font-black uppercase tracking-widest text-indigo-600 mb-6 flex items-center gap-2">
                                        <Award size={16} /> Recommended Certs
                                    </h3>
                                    <div className="space-y-3">
                                        {(detailedFeedback?.careerDevelopment?.certifications || []).map((c, i) => (
                                            <div key={i} className="px-4 py-3 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-black uppercase tracking-widest border border-indigo-100">
                                                {c}
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                <section className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
                                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 mb-6 flex items-center gap-2">
                                        <BookOpen size={16} /> Next Steps
                                    </h3>
                                    <ul className="space-y-4">
                                        {(detailedFeedback?.careerDevelopment?.nextSteps || []).map((s, i) => (
                                            <li key={i} className="flex gap-3 text-xs font-medium text-slate-700">
                                                <div className="w-5 h-5 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 shrink-0 font-black text-[10px]">
                                                    {i + 1}
                                                </div>
                                                {s}
                                            </li>
                                        ))}
                                    </ul>
                                </section>

                                <section className="bg-amber-50 p-6 rounded-[32px] border border-amber-100">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-2">Bias & Fairness Audit</h4>
                                    <p className="text-[11px] font-medium text-amber-800 leading-relaxed italic">
                                        "{detailedFeedback.biasAndFairnessNote}"
                                    </p>
                                </section>

                                <section className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
                                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 mb-6 flex items-center gap-2">
                                        <BookOpen size={16} /> Interview Transcript
                                    </h3>
                                    <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 max-h-96 overflow-y-auto custom-scrollbar">
                                        <p className="text-xs font-medium text-slate-600 leading-relaxed whitespace-pre-wrap">
                                            {typeof detailedFeedback.maskedTranscript === 'object' ? (detailedFeedback.maskedTranscript as any)?.text : detailedFeedback.maskedTranscript || transcript || "No transcript data available."}
                                        </p>
                                    </div>
                                </section>

                                <div className="flex flex-col gap-4 no-print">
                                    <button onClick={() => window.location.reload()} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-indigo-900/20 hover:bg-indigo-700 transition-all">
                                        Start New Session
                                    </button>
                                    <button onClick={handleExitClick} className="w-full py-5 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black uppercase tracking-[0.2em] text-xs hover:bg-slate-50 transition-all">
                                        Return to Center
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-20">
                            <p className="text-slate-500 font-bold uppercase tracking-widest">Failed to load detailed audit.</p>
                            <button onClick={handleGenerateFinalFeedback} className="mt-4 px-8 py-3 bg-indigo-600 text-white rounded-xl font-black uppercase tracking-widest">Retry Audit</button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className={`flex flex-col md:flex-row h-screen w-screen bg-slate-100 overflow-hidden ${dyslexiaFont ? 'font-dyslexia-friendly' : ''}`}>
            {/* Reflection Overlay with STAR APPROACH Sidebar restored */}
            {isBreakActive && (
                <div className="fixed inset-0 z-[5000] bg-white/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 animate-fade-in overflow-hidden">
                    {isWarmupActive && (
                        <div className="absolute inset-0 z-[6000] bg-slate-900 flex flex-col items-center justify-center text-white text-center">
                            <span className="text-xs font-black uppercase tracking-[0.4em] text-indigo-400 mb-4">Resuming in</span>
                            <div className="text-9xl font-black font-mono">{warmupTimeRemaining}</div>
                        </div>
                    )}
                    <div className="max-w-6xl w-full flex flex-col gap-8 h-full max-h-[90vh]">
                        <div className="flex justify-between items-center border-b pb-6">
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={handleExitClick}
                                    className="px-4 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-indigo-600 transition-all flex items-center gap-3 shadow-2xl ring-1 ring-white/20"
                                    title="Return to Command Center"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                                    </svg>
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Return</span>
                                </button>
                                <div className="p-3 bg-indigo-600 text-white rounded-2xl">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </div>
                                <h2 className="text-2xl font-black uppercase tracking-tighter">Coherence Break</h2>
                            </div>
                            <span className="text-2xl font-black font-mono tracking-tighter tabular-nums">{Math.floor(breakTimeRemaining / 60)}:{String(breakTimeRemaining % 60).padStart(2, '0')}</span>
                        </div>

                        <div className="flex-1 flex flex-col md:flex-row gap-8 overflow-hidden">
                            {/* STAR Sidebar in Break Session */}
                            <aside className="w-full md:w-[340px] shrink-0 bg-white border border-slate-200 rounded-[32px] p-8 space-y-8 flex flex-col shadow-xl">
                                <div>
                                    <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4">Current Coherence Loop</h3>
                                    <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 mb-6">
                                        <p className="text-[9px] font-black text-indigo-600 uppercase mb-1">{CATEGORIES[currentQuestionIndex] || 'Structured Alignment'}</p>
                                        <p className="text-[11px] text-slate-600 font-medium leading-tight italic">"{currentQuestion.text}"</p>
                                    </div>
                                    <div className="space-y-6">
                                        {currentQuestion.requirements.map((req, idx) => (
                                            <div key={req.id} className={`flex gap-4 transition-all duration-300 ${idx < starPhase ? 'opacity-30' : idx === starPhase ? 'scale-105' : 'opacity-60'}`}>
                                                <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center border-2 ${idx === starPhase ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-white border-slate-200 text-slate-400'}`}>
                                                    <span className="text-[11px] font-black">{STAR_LABELS[idx][0]}</span>
                                                </div>
                                                <div className="flex-1">
                                                    <span className={`text-[9px] font-black uppercase tracking-widest ${idx === starPhase ? 'text-indigo-600' : 'text-slate-500'}`}>{STAR_LABELS[idx]}</span>
                                                    <p className={`text-[11px] font-bold leading-tight mt-0.5 ${idx === starPhase ? 'text-slate-900' : 'text-slate-500'}`}>{req.text}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </aside>

                            {/* Thought Space in Break Session */}
                            <div className="flex-1 flex flex-col bg-white rounded-[40px] p-10 border border-slate-200 shadow-xl overflow-hidden group">
                                <div className="flex items-center justify-between mb-6 shrink-0">
                                    <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Coherence Auditor Sandbox</h3>
                                    <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest animate-pulse">Syncing Logic...</span>
                                </div>
                                <textarea
                                    autoFocus
                                    value={userNotes}
                                    onChange={(e) => setUserNotes(e.target.value)}
                                    placeholder="Use this structured pause to align your actions with the company's core values and the meta-prompt logic..."
                                    className="flex-1 bg-transparent border-none text-xl outline-none resize-none font-medium text-slate-800 leading-relaxed custom-scrollbar"
                                />
                                <div className="flex justify-end pt-8 border-t shrink-0">
                                    <button
                                        onClick={() => { setIsWarmupActive(true); setWarmupTimeRemaining(5); }}
                                        className="px-12 py-5 bg-slate-900 text-white rounded-[24px] font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:bg-indigo-600 transition-all hover:scale-105 active:scale-95"
                                    >
                                        Resume Coherence Loop
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <main className="flex-1 flex flex-col p-4 gap-4 overflow-hidden relative animate-fade-in-scale">
                <header className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm shrink-0">
                    <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={handleExitClick}
                                className="px-4 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-indigo-600 transition-all flex items-center gap-3 shadow-xl ring-1 ring-white/10"
                                title="Return to Command Center"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                                </svg>
                                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Return</span>
                            </button>
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{CATEGORIES[currentQuestionIndex] || 'General Coherence'}</span>
                                    {currentQuestion.difficulty && (
                                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter ${currentQuestion.difficulty === 'easy' ? 'bg-emerald-100 text-emerald-700' :
                                            currentQuestion.difficulty === 'medium' ? 'bg-amber-100 text-amber-700' :
                                                'bg-rose-100 text-rose-700'
                                            }`}>
                                            {currentQuestion.difficulty}
                                        </span>
                                    )}
                                </div>
                                <div id="ascend-phase-indicators" className="flex gap-1.5">
                                    {STAR_LABELS.map((_, i) => (
                                        <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${starPhase === i ? 'w-10 bg-indigo-600 shadow-sm' : 'w-2 bg-slate-200'}`} />
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                id="ascend-deep-probe-button"
                                onClick={triggerProbing}
                                disabled={isGeneratingProbe || transcript.length < 20}
                                className={`px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all border ${isProbingActive
                                    ? 'bg-indigo-50 border-indigo-200 text-indigo-600'
                                    : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                <Brain size={16} className={isGeneratingProbe ? 'animate-pulse' : ''} />
                                <span className="text-[10px] font-black uppercase tracking-widest">Deep Probe</span>
                            </button>
                                <button id="btn-reflect" onClick={handleStartBreak} className="p-3 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all flex items-center gap-2 group">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                <span className="text-[10px] font-black uppercase tracking-widest hidden group-hover:block transition-all">Reflect</span>
                            </button>
                        </div>
                    </div>
                    <h2 id="ascend-question-prompt" className="text-lg font-bold text-slate-900 leading-tight">{currentRequirement.text}</h2>
                </header>

                <div id="ascend-platform-layout" className="flex-1 bg-white rounded-[40px] border border-slate-200 shadow-xl relative overflow-hidden flex items-center justify-center group">
                    <div id="ascend-timer-module" className="absolute top-6 left-6 z-40">
                        <TimerWidget mode={timerDisplay} elapsedSeconds={sessionSeconds} isRecording={recordingStatus === 'recording'} isHidden={isTimerHidden} />
                    </div>

                    <div className="absolute top-6 right-6 z-40 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={() => setIsTimerHidden(!isTimerHidden)}
                            className={`p-3 rounded-2xl backdrop-blur-md border shadow-lg transition-all ${isTimerHidden ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-white/90 text-indigo-600 border-indigo-100'}`}
                            title="Toggle Timer"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </button>
                        <button
                            id="ascend-video-toggle"
                            onClick={() => setVideoState(videoState === 'standard' ? 'hidden' : 'standard')}
                            className={`p-3 rounded-2xl backdrop-blur-md border shadow-lg transition-all ${videoState === 'hidden' ? 'bg-slate-900 text-indigo-400 border-indigo-900' : 'bg-white/90 text-slate-600 border-slate-200'}`}
                            title="Toggle Video View"
                        >
                            {videoState === 'standard' ? (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            ) : (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                            )}
                        </button>
                    </div>

                    {videoState === 'standard' && stream ? (
                        <video id="ascend-video-feed" ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover mirrored-video pointer-events-none" />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-8 bg-slate-50 text-center p-8">
                            <Waveform active={recordingStatus === 'recording'} scale={1.2} />
                            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Video Hidden ΓÇó Speak when ready</p>
                        </div>
                    )}
                </div>

                <footer className="flex flex-col items-center gap-4 py-4 shrink-0">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={handlePrevQuestion}
                            disabled={currentQuestionIndex === 0}
                            className="p-4 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-slate-600 disabled:opacity-30 transition-all"
                            title="Previous Question"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                            </svg>
                        </button>
                        <button
                            id="ascend-record-button"
                            disabled={probeCountdown > 0}
                            onClick={handleRecord}
                            className={`px-12 py-4 rounded-2xl font-black text-lg transition-all shadow-xl hover:scale-105 active:scale-95 ${probeCountdown > 0 ? 'bg-slate-200 text-slate-400 cursor-not-allowed' :
                                recordingStatus === 'recording' ? 'bg-rose-500 text-white shadow-rose-900/20' : 'bg-indigo-600 text-white shadow-indigo-900/20'
                                }`}
                        >
                            {recordingStatus === 'idle' ? (
                                isProbingActive ? (
                                    micCountdown > 0 ? `Mic Opening in ${micCountdown}s...` :
                                        decisionCountdown > 0 ? `Answer Probe (${decisionCountdown}s)` : 'Answer Probe'
                                ) : `Speak: ${STAR_LABELS[starPhase]}`
                            ) : 'Stop Speaking'}
                        </button>
                        <button id="ascend-next-step-button" onClick={handleNextPhase} className="px-8 py-4 bg-white border border-slate-200 rounded-2xl font-bold text-slate-700 shadow-md hover:bg-slate-50 transition-all hover:translate-x-1">
                            {starPhase < 3 ? 'Next Step ΓåÆ' : (currentQuestionIndex < activeQuestions.length - 1 ? 'Next Question ΓåÆ' : 'Finish Session')}
                        </button>
                        <button
                            onClick={handleNextQuestion}
                            disabled={currentQuestionIndex === activeQuestions.length - 1}
                            className="p-4 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-slate-600 disabled:opacity-30 transition-all"
                            title="Next Question"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                            </svg>
                        </button>
                    </div>
                </footer>
            </main>

            <aside id="ascend-toolkit-sidebar" className="w-full md:w-[380px] bg-white border-l border-slate-200 flex flex-col shadow-2xl shrink-0">
                <div className="p-6 border-b bg-slate-50/50 flex items-center justify-between">
                    <div>
                        <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">
                            {isProbingActive ? 'Probing Pipeline' : 'Coherence Auditor'}
                        </h3>
                        <p className="text-xs font-bold text-slate-900 leading-tight">
                            {isProbingActive ? 'Deep Domain Analysis' : `"${currentQuestion.text}"`}
                        </p>
                    </div>
                    {isProbingActive && (
                        <button
                            onClick={() => {
                                setIsProbingActive(false);
                                setCurrentProbe(null);
                                setProbeAnalysis(null);
                            }}
                            className="p-2 hover:bg-slate-200 rounded-lg transition-colors text-slate-400"
                            title="Back to STAR"
                        >
                            <Brain size={16} />
                        </button>
                    )}
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="flex flex-col h-full">
                        <div className="flex border-b bg-slate-50/30 p-1 flex-wrap gap-0.5">
                            {(['plan', 'notes', 'transcript', 'insights', 'report'] as ToolkitTab[]).map((tab) => (
                                <button
                                    key={tab}
                                    id={`tab-${tab}`}
                                    onClick={() => setActiveTab(tab)}
                                    className={`flex-1 py-2.5 text-[9px] font-black uppercase tracking-widest transition-all relative ${activeTab === tab
                                        ? 'bg-white text-indigo-600 shadow-sm rounded-xl'
                                        : 'text-slate-400 hover:text-slate-600'
                                        }`}
                                >
                                    {tab === 'insights' ? 'Insights' : tab}
                                    {tab === 'report' && sessionLog.length > 0 && (
                                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-600 text-white text-[8px] font-black rounded-full flex items-center justify-center">
                                            {sessionLog.length}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>

                        <div className="flex-1 p-6">
                            {activeTab === 'plan' && (
                                <div id="ascend-toolkit-star" className="space-y-6 animate-fade-in">
                                    {!isProbingActive ? (
                                        <div className="border-b border-slate-100 pb-4">
                                            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">STAR Strategy Checklist</h4>
                                            <div className="space-y-3">
                                                {currentQuestion.requirements.map((req, idx) => (
                                                    <div key={req.id} className="flex items-start gap-3">
                                                        <div className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-black transition-all ${idx < starPhase ? 'bg-emerald-500 border-emerald-500 text-white' :
                                                            idx === starPhase ? 'bg-white border-indigo-600 text-indigo-600 shadow-sm' :
                                                                'bg-white border-slate-200 text-slate-300'
                                                            }`}>
                                                            {idx < starPhase ? '✓' : idx + 1}
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className={`text-[10px] font-black uppercase tracking-widest ${idx < starPhase ? 'text-emerald-600' :
                                                                idx === starPhase ? 'text-indigo-600' : 'text-slate-400'
                                                                }`}>
                                                                {STAR_LABELS[idx]}
                                                            </p>
                                                            <p className={`text-[11px] font-medium leading-tight mt-0.5 ${idx === starPhase ? 'text-slate-900' : 'text-slate-400'
                                                                }`}>
                                                                {req.text}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="border-b border-slate-100 pb-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Target className="text-indigo-400" size={14} />
                                                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Follow-up Session Active</h4>
                                            </div>
                                            <p className="text-[10px] font-medium text-slate-500 leading-relaxed italic">
                                                The STAR checklist is hidden while we explore this specific domain probe. Respond to the probe to continue or move to the next question.
                                            </p>
                                        </div>
                                    )}

                                    {currentQuestion.keywords && currentQuestion.keywords.length > 0 && (
                                        <div>
                                            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Key Vocabulary</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {(currentQuestion?.keywords || []).map((kw, i) => (
                                                    <span key={i} className="px-2 py-1 bg-slate-50 text-slate-600 rounded-lg text-[9px] font-black uppercase tracking-widest border border-slate-200">
                                                        {kw}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 italic">
                                        <p className="text-[10px] font-medium text-indigo-700 leading-relaxed">
                                            Focus on proving your alignment with the <span className="font-black uppercase tracking-widest">Action</span> and <span className="font-black uppercase tracking-widest">Result</span> phases to maximize coherence signals.
                                        </p>
                                    </div>

                                    {isGeneratingProbe && (
                                        <div className="p-8 flex flex-col items-center justify-center text-center gap-4 bg-indigo-50/30 rounded-[32px] border-2 border-dashed border-indigo-100 animate-pulse">
                                            <div className="w-12 h-12 border-4 border-indigo-50 border-t-indigo-600 rounded-full animate-spin" />
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600">{reassuringMessage || "The next question is on its way. Be focused, Be ready"}</p>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">You are doing well. Stay focused, the follow-up question will be ready in a while. Till then relax!</p>
                                            </div>
                                        </div>
                                    )}

                                    {currentProbe && !isGeneratingProbe && (
                                        <div className="mt-6 p-6 bg-white border border-indigo-100 rounded-[32px] animate-fade-in shadow-md shadow-indigo-900/5 relative overflow-hidden group">
                                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                                <Target size={80} />
                                            </div>
                                            <div className="flex items-center gap-2 mb-4">
                                                <div className="p-1.5 bg-indigo-600 rounded-lg text-white">
                                                    <Sparkles size={12} />
                                                </div>
                                                <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">Active Probe Analysis</h4>
                                            </div>
                                            <p className="text-sm font-black text-slate-900 leading-tight mb-4 relative z-10">
                                                &ldquo;{currentProbe.probe}&rdquo;
                                            </p>
                                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                <p className="text-[9px] font-medium text-slate-500 leading-relaxed">
                                                    <span className="font-black uppercase text-slate-400 mr-2">Rationale:</span>
                                                    {currentProbe.rationale}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}


                            {activeTab === 'notes' && (
                                <div className="h-full flex flex-col animate-fade-in">
                                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4">Coherence Workspace</h4>
                                    <textarea
                                        value={userNotes}
                                        onChange={(e) => setUserNotes(e.target.value)}
                                        placeholder="Draft your structured logic here..."
                                        className="flex-1 w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-medium outline-none resize-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-800"
                                    />
                                    <p className="text-[9px] text-slate-400 font-bold uppercase mt-3 text-center">Auto-saving alignment logic...</p>
                                </div>
                            )}

                            {activeTab === 'transcript' && (
                                <div className="h-full flex flex-col animate-fade-in">
                                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4">Live Transcript</h4>
                                    <div className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl p-4 overflow-y-auto custom-scrollbar">
                                        <p className="text-[11px] font-medium text-slate-600 leading-relaxed whitespace-pre-wrap">
                                            {transcript || "Awaiting verbal input..."}
                                        </p>
                                    </div>
                                    {isTranscribing && (
                                        <div className="flex items-center justify-center gap-2 mt-3">
                                            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
                                            <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">Listening...</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'insights' && (
                                <div id="ascend-probing-pipeline" className="h-full flex flex-col animate-fade-in">
                                    <ProbingPipeline
                                        currentProbe={currentProbe}
                                        analysis={probeAnalysis}
                                        isGenerating={isGeneratingProbe}
                                        participantId={participantId}
                                        revealCountdown={probeCountdown}
                                        onSwitchTab={setActiveTab}
                                        reassuringMessage={reassuringMessage}
                                    />
                                    {probeCountdown > 0 && reassuringMessage && (
                                        <div className="mt-4 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl animate-pulse">
                                            <p className="text-[10px] font-bold text-indigo-700 text-center uppercase tracking-widest">
                                                {reassuringMessage}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'report' && (
                                <div id="ascend-toolkit-reports" className="space-y-4 animate-fade-in">
                                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4">Session Record</h4>
                                    {sessionLog.length === 0 ? (
                                        <div className="flex flex-col items-center gap-4 py-12 opacity-30">
                                            <div className="p-6 bg-slate-100 rounded-full">
                                                <FileText size={32} className="text-slate-400" />
                                            </div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">Complete a question to see your session record</p>
                                        </div>
                                    ) : (
                                        sessionLog.map((entry, idx) => (
                                            <div key={idx} className="bg-white border border-slate-200 rounded-[24px] p-5 space-y-4 shadow-sm">

                                                {/* Header: Q# + STAR dots */}
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex-1">
                                                        <span className="text-[9px] font-black uppercase tracking-widest text-indigo-500">Q{entry.questionIndex + 1} · {CATEGORIES[entry.questionIndex] || 'General'}</span>
                                                        <p className="text-[11px] font-bold text-slate-800 mt-1 leading-tight line-clamp-2">&ldquo;{entry.questionText}&rdquo;</p>
                                                    </div>
                                                    <div className="flex gap-1 shrink-0">
                                                        {['S', 'T', 'A', 'R'].map((s, i) => (
                                                            <div key={i} className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black ${i <= entry.starPhaseReached ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-300'
                                                                }`}>{s}</div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Rich Summary Report */}
                                                {entry.summaryReport ? (
                                                    <div className="space-y-3">
                                                        {/* Section 1: Overview */}
                                                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Answer Overview</p>
                                                            <p className="text-[11px] font-medium text-slate-700 leading-relaxed">{entry.summaryReport.answerOverview}</p>
                                                        </div>

                                                        {/* Section 2: Strengths */}
                                                        {entry.summaryReport.strengths.length > 0 && (
                                                            <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
                                                                <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600 mb-2">What You Did Well</p>
                                                                <ul className="space-y-1">
                                                                    {(entry.summaryReport.strengths || []).map((s, i) => (
                                                                        <li key={i} className="flex gap-2 items-start">
                                                                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1 shrink-0" />
                                                                            <p className="text-[10px] font-medium text-emerald-800 leading-snug">{s}</p>
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        )}

                                                        {/* Section 3: Development Points */}
                                                        {entry.summaryReport.developmentPoints.length > 0 && (
                                                            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-100">
                                                                <p className="text-[9px] font-black uppercase tracking-widest text-amber-600 mb-2">Where to Go Deeper</p>
                                                                <div className="space-y-2">
                                                                    {(entry.summaryReport.developmentPoints || []).map((dp, i) => (
                                                                        <div key={i} className="p-2 bg-white/60 rounded-xl border border-amber-100">
                                                                            <p className="text-[10px] font-black text-amber-800">{dp.gap}</p>
                                                                            <p className="text-[9px] font-medium text-amber-600 mt-0.5 italic">{dp.whyItMatters}</p>
                                                                            <p className="text-[10px] font-bold text-slate-700 mt-1">&rarr; {dp.instruction}</p>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Section 4: Probe Engagement */}
                                                        {entry.summaryReport.probeEngagement && (
                                                            <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-100">
                                                                <p className="text-[9px] font-black uppercase tracking-widest text-indigo-500 mb-1">Probe Engagement</p>
                                                                <p className="text-[10px] font-medium text-indigo-800 leading-relaxed">{entry.summaryReport.probeEngagement}</p>
                                                            </div>
                                                        )}

                                                        {/* Section 5: Probe Correlation */}
                                                        {entry.summaryReport.probeCorrelation && (
                                                            <div className="p-3 bg-indigo-50/50 rounded-2xl border border-indigo-100 border-dashed">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <Layers size={10} className="text-indigo-400" />
                                                                    <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Act-Probe Correlation</p>
                                                                </div>
                                                                <p className="text-[10px] font-medium text-indigo-800/80 leading-relaxed">{entry.summaryReport.probeCorrelation}</p>
                                                            </div>
                                                        )}

                                                        {/* Section 6: Integrated Coaching */}
                                                        {entry.summaryReport.integratedCoaching && (
                                                            <div className="p-3 bg-indigo-600 rounded-2xl border border-indigo-700 shadow-lg shadow-indigo-900/10">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <Sparkles size={10} className="text-indigo-200" />
                                                                    <p className="text-[9px] font-black uppercase tracking-widest text-indigo-100">Integrated Excellence Guidance</p>
                                                                </div>
                                                                <p className="text-[10px] font-bold text-white leading-relaxed">{entry.summaryReport.integratedCoaching}</p>
                                                            </div>
                                                        )}

                                                        {/* Section 5: Practice Task */}
                                                        {entry.summaryReport.practiceTask && (
                                                            <div className="p-3 bg-slate-900 rounded-2xl">
                                                                <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400 mb-1">One Thing to Practise</p>
                                                                <p className="text-[11px] font-bold text-white leading-snug">{entry.summaryReport.practiceTask}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : entry.probeAnalysis ? (
                                                    /* Fallback: pill summary while report generates */
                                                    <div className="space-y-3">
                                                        <div className="flex items-center gap-2 text-indigo-500 animate-pulse">
                                                            <Sparkles size={12} />
                                                            <span className="text-[9px] font-black uppercase tracking-widest">Generating detailed analysis...</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${entry.probeAnalysis.depth_delta === 'increased' ? 'bg-emerald-100 text-emerald-700' :
                                                                entry.probeAnalysis.depth_delta === 'decreased' ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-600'
                                                                }`}>Depth: {entry.probeAnalysis.depth_delta}</span>
                                                            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${entry.probeAnalysis.proceed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                                                }`}>{entry.probeAnalysis.proceed ? 'Proceed ✓' : 'Hold & Probe'}</span>
                                                            {entry.probeAnalysis.coaching_tip && (
                                                                <p className="w-full text-[10px] font-medium text-slate-600 italic mt-1">{entry.probeAnalysis.coaching_tip}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <p className="text-[10px] text-slate-400 font-medium italic">No probe was triggered for this question.</p>
                                                )}

                                                {/* Probe Card */}
                                                {entry.probe && (
                                                    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
                                                        <span className="text-[8px] font-black uppercase tracking-widest text-indigo-400">Probe · {entry.probe.probe_type.replace(/_/g, ' ')}</span>
                                                        <p className="text-[11px] font-bold text-indigo-900 mt-1 leading-tight">&ldquo;{entry.probe.probe}&rdquo;</p>
                                                    </div>
                                                )}

                                                {/* Download and Modal Actions */}
                                                <div className="flex gap-2">
                                                    {entry.summaryReport && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDownloadQuestionReport(entry);
                                                            }}
                                                            className="flex-1 py-2 bg-indigo-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                                                        >
                                                            <Download size={12} />
                                                            Download Analysis
                                                        </button>
                                                    )}
                                                    {entry.probe && entry.probeAnalysis && (
                                                        <button
                                                            onClick={() => setReportModalEntry(entry)}
                                                            className="flex-1 py-2 bg-slate-900 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-indigo-600 transition-all flex items-center justify-center gap-2"
                                                        >
                                                            <Sparkles size={12} />
                                                            View Insights
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </aside>
            <style>{`
                .custom-scrollbar::-webkit-scrollbar{width:4px}
                .custom-scrollbar::-webkit-scrollbar-thumb{background:#e2e8f0;border-radius:10px}
                @media print {
                    .no-print { display: none !important; }
                    body { background: white !important; }
                    .min-h-screen { min-height: auto !important; height: auto !important; overflow: visible !important; }
                    .max-w-7xl { max-width: 100% !important; width: 100% !important; padding: 0 !important; margin: 0 !important; }
                    .shadow-sm, .shadow-xl, .shadow-2xl { shadow: none !important; box-shadow: none !important; }
                    .rounded-[40px], .rounded-3xl, .rounded-2xl { border-radius: 8px !important; }
                    button { display: none !important; }
                    .bg-slate-50, .bg-slate-100 { background: white !important; }
                    .border { border: 1px solid #e2e8f0 !important; }
                    .text-indigo-600 { color: #4f46e5 !important; }
                    .bg-slate-900 { background: #0f172a !important; color: white !important; }
                    .p-8 { padding: 1.5rem !important; }
                    .gap-8 { gap: 1rem !important; }
                    .grid { display: block !important; }
                    .grid > * { margin-bottom: 1.5rem !important; page-break-inside: avoid; }
                    section { page-break-inside: avoid; margin-bottom: 2rem !important; }
                    h1 { font-size: 2.5rem !important; }
                }
            `}</style>

            {/* Session Log — Full Probing Report Modal */}
            <AnimatePresence>
                {reportModalEntry && reportModalEntry.probe && reportModalEntry.probeAnalysis && (
                    <ProbingReport
                        probe={reportModalEntry.probe}
                        analysis={reportModalEntry.probeAnalysis}
                        onClose={() => setReportModalEntry(null)}
                        participantId={participantId}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export default AscendPlatform;
