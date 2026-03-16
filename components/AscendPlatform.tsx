import React, { useState, useEffect, useRef } from 'react';
import { useSettings } from '../context/SettingsContext';
import { RecordingStatus, AnalyticsEventType, TimerDisplay, TimerFramingCondition, Question, Probe, ProbeAnalysis, DetailedFeedback, QuestionSummaryReport, QuestionDataAccumulator } from '../types';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { generateProbe, analyzeProbeResponse, generateQuestionSummary } from '../services/probingService';
import { generateDetailedFeedback } from '../services/feedbackService';
import ProbingPipeline from './ProbingPipeline';
import { Brain, Award, BookOpen, ShieldAlert, CheckCircle2, TrendingUp, Download, FileText, AlertCircle, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type ToolkitTab = 'STAR' | 'notes' | 'transcript' | 'analysis' | 'summaries';
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
    framing: TimerFramingCondition;
    elapsedSeconds: number;
    isRecording: boolean;
    isHidden: boolean;
}> = ({ mode, framing, elapsedSeconds, isRecording, isHidden }) => {
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
            <div className="flex flex-col">
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">
                    {framing === 'elapsed' ? 'Time Elapsed' : framing === 'duration' ? 'Response Duration' : 'Time Used'}
                </span>
                <span className="text-base font-black font-mono tabular-nums leading-none text-slate-900">
                    {framing === 'used' ? format(Math.max(0, 90 - elapsedSeconds)) : format(elapsedSeconds)}
                </span>
            </div>
        </div>
    );
};

interface AscendPlatformProps {
    logEvent: (type: AnalyticsEventType, metadata?: Record<string, any>) => void;
    onExit: () => void;
}

const AscendPlatform: React.FC<AscendPlatformProps> = ({ logEvent, onExit }) => {
    const {
        videoEnabled, setVideoEnabled, dyslexiaFont, timerDisplay, liveTools, activeQuestions, cvText, participantId, condition,
        timerFramingCondition, setTimerFramingCondition, isTourActive, tourStep
    } = useSettings();
    const [starPhase, setStarPhase] = useState(0);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [recordingStatus, setRecordingStatus] = useState<RecordingStatus>('idle');

    const [transcript, setTranscript] = useState<string>("");
    const lastPhaseTranscriptLength = useRef<number>(0);
    const questionStartTranscriptLength = useRef<number>(0);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const sessionPromiseRef = useRef<Promise<any> | null>(null);

    const [videoState, setVideoState] = useState<VideoState>('standard');
    const [isTimerHidden, setIsTimerHidden] = useState(false);

    const phaseStartTimestamp = useRef<number>(Date.now());
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
    const [probeLoadingType, setProbeLoadingType] = useState<'question' | 'analysis'>('question');
    const [isProbingActive, setIsProbingActive] = useState(false);
    const [probingTranscript, setProbingTranscript] = useState("");
    const [probeCount, setProbeCount] = useState(0);
    const askedProbesThisQuestion = useRef<string[]>([]);
    const [probeCompletionMessage, setProbeCompletionMessage] = useState<string | null>(null);
    const [nextQuestionCountdown, setNextQuestionCountdown] = useState(0);
    const [probeRevealCountdown, setProbeRevealCountdown] = useState(0);
    const [answerProbeCountdown, setAnswerProbeCountdown] = useState(0);
    const isCountingDownToAnswer = useRef(false);

    // Per-Question Response Summary State
    const currentPhaseAnalyses = useRef<ProbeAnalysis[]>([]);
    const currentProbeAnalyses = useRef<ProbeAnalysis[]>([]);
    const [questionSummaries, setQuestionSummaries] = useState<QuestionSummaryReport[]>([]);
    const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

    const actOneDuration = useRef<number>(0);
    const probeDurations = useRef<number[]>([]);

    // Detailed Feedback State
    const [detailedFeedback, setDetailedFeedback] = useState<DetailedFeedback | null>(null);
    const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);
    const [activeTab, setActiveTab] = useState<ToolkitTab>('STAR')

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

    useEffect(() => {
        let timer: number | undefined;
        if (answerProbeCountdown > 0) {
            timer = window.setInterval(() => {
                setAnswerProbeCountdown(prev => {
                    if (prev === 1 && isCountingDownToAnswer.current) {
                        isCountingDownToAnswer.current = false;
                        handleRecord();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [answerProbeCountdown]);
    useEffect(() => {
        let timer: number | undefined;
        if (nextQuestionCountdown > 0) {
            timer = window.setInterval(() => setNextQuestionCountdown(prev => prev - 1), 1000);
        } else if (nextQuestionCountdown === 0 && isProbingActive && !isGeneratingProbe) {
            // No auto-trigger here, just keep button unlocked
        }
        return () => clearInterval(timer);
    }, [nextQuestionCountdown, isProbingActive, isGeneratingProbe]);

    // --- Tour Runtime Orchestrator --- 
    useEffect(() => {
        if (!isTourActive) {
            // Cleanup: If the tour was active and we had set "Demo" state, clear it
            if (detailedFeedback?.noData || currentProbe || questionSummaries.length > 0) {
                setDetailedFeedback(null);
                setIsBreakActive(false);
                setCurrentProbe(null);
                setProbeAnalysis(null);
                setQuestionSummaries([]);
                setActiveTab('STAR'); // Reset to Plan view
            }
            return;
        }

        // --- PHASE SYNCHRONIZATION ---

        // 1. Toolkit Tab Management (Step 16: Analysis, Step 18: Reports)
        if (tourStep === 16) {
            setActiveTab('analysis');
            if (!currentProbe) {
                setCurrentProbe({
                    probe: "How did you specifically measure the 'improved efficiency' you mentioned?",
                    probe_type: 'CONCRETE',
                    rationale: "Quantifying 'efficiency' increases the actionable merit of the response.",
                    contextual_anchor: "improved efficiency",
                    scaffold_phase: 2,
                    difficulty: 'MEDIUM',
                    question_type: 'CORE_COMPETENCY',
                    zpd_note: "Ready for metrics."
                });
                setProbeAnalysis({
                    probe_successful: true,
                    depth_delta: 'increased',
                    evidence_added: "Quantitative metrics (20% reduction)",
                    star_status: { situation: 'complete', task: 'complete', action: 'complete', result: 'complete' },
                    weakest_star_component: null,
                    contextual_anchor: "measurement",
                    suggested_next_probe_type: 'DEEPENING',
                    sdt_signals: { autonomy_language: 'present', competence_language: 'present', relatedness_language: 'absent' },
                    scaffold_dependency_signal: 'used_moderately',
                    interpretation: "Candidate successfully anchored the claim.",
                    pj_observations: ["Clear voice"],
                    novel_claim_introduced: false,
                    proceed: true,
                    reason: "Sufficient depth.",
                    merit_vectors: { autonomy: 80, competence: 85, relatedness: 40, lowest_vector: 'relatedness' },
                    goffman_scores: { front_stage: 90, back_stage: 10 },
                    chc_signals: { gc: 'strong', gf: 'strong', gq: 'moderate', lowest_signal: 'gq' },
                    algorithmic_aversion: { detected: false, evidence: null }
                } as any);
            }
        } else if (tourStep === 18) {
            setActiveTab('summaries');
            if (questionSummaries.length === 0) {
                setQuestionSummaries([{
                    questionId: 'demo',
                    questionText: "Tell me about a time you handled a challenging project.",
                    answerOverview: "A well-structured narrative focusing on technical latency reduction.",
                    strengths: ["Clear STAR structure", "Strong technical vocabulary"],
                    developmentPoints: [
                        { gap: "Contextual Framing", whyItMatters: "Stakeholders need the 'Why'.", instruction: "Explain the business impact." }
                    ],
                    probeEngagement: "Excellent response to the 'Concrete' probe.",
                    practiceTask: "Focus on business value metrics next time.",
                    timestamp: Date.now(),
                    allProbeAnalyses: []
                }]);
            }
        } else if (tourStep < 16) {
            // For earlier steps, default back to STAR if we were in analysis/summaries
            if (activeTab === 'analysis' || activeTab === 'summaries') setActiveTab('STAR');
            if (currentProbe && !isProbingActive) {
                setCurrentProbe(null);
                setProbeAnalysis(null);
            }
            if (questionSummaries.length > 0 && !isGeneratingSummary) {
                setQuestionSummaries([]);
            }
        }

        // 2. Reflective Break Phase (Step 19)
        if (tourStep === 19) {
            setIsBreakActive(true);
        } else if (tourStep < 19) {
            setIsBreakActive(false);
        }

        // 3. Final Report Phase (Steps 20-24)
        if (tourStep >= 20) {
            setIsBreakActive(false); // Ensure break overlay is down
            if (recordingStatus !== 'uploaded') setRecordingStatus('uploaded');
            if (!detailedFeedback) {
                setDetailedFeedback({
                    noData: true, // Marker for cleanup
                    performanceSummary: "This is a demo performance audit summary for the system tour guide. It highlights key communication patterns.",
                    overallStarSynthesis: "Strong evidence found across all STAR dimensions.",
                    strengths: ["Clear logical structure", "Action-oriented language"],
                    weaknesses: ["Could deepen the 'Result' impact quantification"],
                    actionableSuggestions: ["Focus on metrics", "Try the Deepening probe"],
                    starAnalysis: { situation: "Complete", task: "Complete", action: "Complete", result: "Partial" },
                    keywordCoverage: { found: ["Leadership", "Impact"], missing: ["Strategy"] },
                    careerDevelopment: { certifications: ["Certified Interviewer"], nextSteps: ["Advanced Practice"] },
                    chcCognitiveDimensions: {
                        crystallisedIntelligence: { score: 88, evidenceBasis: "Strong technical vocabulary" },
                        fluidIntelligence: { score: 92, evidenceBasis: "Excellent logical mapping" },
                        practicalReasoning: { score: 85, evidenceBasis: "Result-oriented decision making" },
                        overallCHCNote: "Candidate shows high analytical merit."
                    },
                    rubrics: {
                        starCompletion: 85, evidenceSpecificity: 90, roleClarity: 80, jdAlignment: 75, communicationClarity: 95,
                        justifications: {
                            starCompletion: "Good STAR coverage.", evidenceSpecificity: "Very specific examples.",
                            roleClarity: "Clear role definition.", jdAlignment: "Solid alignment.", communicationClarity: "Excellent clarity."
                        }
                    },
                    maskedTranscript: { text: "Demo transcript text for tour purposes..." }
                } as any);
            }
        } else if (detailedFeedback?.noData) {
            // If moving back from report steps, clear demo data and restore interview state
            setDetailedFeedback(null);
            if (recordingStatus === 'uploaded') setRecordingStatus('idle');
        }
    }, [isTourActive, tourStep, detailedFeedback, recordingStatus, activeTab, currentProbe, questionSummaries]);

    useEffect(() => {
        let timer: number | undefined;
        if (probeRevealCountdown > 0) {
            timer = window.setInterval(() => {
                setProbeRevealCountdown(prev => {
                    if (prev === 1) {
                        setProbeAnalysis(null);
                        setActiveTab('STAR')
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [probeRevealCountdown]);

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

    const handleGenerateFinalFeedback = async () => {
        if (transcript.trim().length < 30) {
            setDetailedFeedback({
                noData: true,
                performanceSummary: "No response recorded. To check the clarity of your answer, please turn on your microphone and speak your response using the STAR format.",
                overallStarSynthesis: "N/A - Zero verbal signal detected for aggregate analysis.",
                rubrics: {
                    starCompletion: 0,
                    evidenceSpecificity: 0,
                    roleClarity: 0,
                    jdAlignment: 0,
                    communicationClarity: 0,
                    justifications: {
                        starCompletion: "N/A",
                        evidenceSpecificity: "N/A",
                        roleClarity: "N/A",
                        jdAlignment: "N/A",
                        communicationClarity: "N/A"
                    }
                },
                strengths: [],
                weaknesses: ["Zero verbal signal detected"],
                actionableSuggestions: ["Check microphone permissions", "Provide verbal responses to all STAR phases"],
                biasAndFairnessNote: "Audit aborted due to lack of input signal.",
                starAnalysis: { situation: "N/A", task: "N/A", action: "N/A", result: "N/A" },
                keywordCoverage: { found: [], missing: [] },
                careerDevelopment: { certifications: [], nextSteps: ["Restart Simulation"] },
                maskedTranscript: { text: "" }
            });
            return;
        }

        setIsGeneratingFeedback(true);
        try {
            const feedback = await generateDetailedFeedback({
                transcript,
                jobRequirements: activeQuestions.map(q => q.text).join("\n"),
                cvText: cvText,
                probeAnalysis: probeAnalysis ? JSON.stringify(probeAnalysis) : undefined,
                targetRole: "Target Role",
                companyName: "Target Company",
                condition: condition,
                phaseProgression: "Phase 1 -> Phase 2 -> Phase 3",
            });
            setDetailedFeedback(feedback);
        } catch (err) {
            console.error("Failed to generate final feedback:", err);
        } finally {
            setIsGeneratingFeedback(false);
        }
    };

    const triggerProbing = async () => {
        if (isGeneratingProbe) return;
        // Removed setProbeAnalysis(null) and setActiveTab to keep insights visible
        setIsProbingActive(true);
        setProbeLoadingType('question');
        setIsGeneratingProbe(true);
        setProbingTranscript(transcript);
        setProbeCount(prev => prev + 1);
        try {
            const currentQ = activeQuestions[currentQuestionIndex] || activeQuestions[0];
            const probe = await generateProbe({
                candidateId: participantId || "Anonymous",
                targetRole: "Not Specified",
                companyName: "Target Company",
                cvSummary: cvText || "No CV provided",
                jobDescription: "Not Specified",
                currentQuestion: {
                    text: currentQ.text,
                    type: CATEGORIES[currentQuestionIndex] || 'Structured Alignment',
                    difficulty: currentQ.difficulty || 'medium'
                },
                sessionPhaseIndex: currentQuestionIndex,
                questionsAnsweredCount: currentQuestionIndex,
                priorProbesThisQuestion: askedProbesThisQuestion.current.length > 0 ? askedProbesThisQuestion.current.join(" | ") : "None",
                candidateAnswer: transcript.slice(questionStartTranscriptLength.current) || transcript,
                conversationHistory: transcript.slice(questionStartTranscriptLength.current) || transcript,
            });
            setCurrentProbe(probe);
            setProbeRevealCountdown(3);
            setNextQuestionCountdown(0);
            askedProbesThisQuestion.current.push(probe.probe);
            setProbeCompletionMessage(null);
        } catch (err) {
            console.error("Failed to generate probe:", err);
        } finally {
            setIsGeneratingProbe(false);
        }
    };

    const handleRecord = async () => {
        if (recordingStatus === 'idle') {
            if (!stream) return;
            setRecordingStatus('recording');
            startTranscription(stream);
        } else {
            setRecordingStatus('idle');
            if (sessionPromiseRef.current) (await sessionPromiseRef.current).close();
            setIsTranscribing(false);

            // Analyze response if it's Act Two
            if (isProbingActive && transcript.length > probingTranscript.length) {
                // Analyze the response to the probe
                handleAnalyzeProbe();
            }
            // (Removed auto-trigger so the candidate must click "Done" to proceed to Act Two)
        }
    };

    const handleNextQuestion = async () => {
        if (recordingStatus === 'recording') await handleRecord();

        // Calculate final durations for the question
        const totalProbesDuration = probeDurations.current.reduce((a, b) => a + b, 0);

        // Trigger summary generation for the question just completed
        const completedQ = activeQuestions[currentQuestionIndex];
        const currentTranscript = transcript.slice(questionStartTranscriptLength.current, transcript.length);
        const accumulator: QuestionDataAccumulator = {
            questionId: completedQ.text,
            transcript: currentTranscript,
            phaseAnalyses: [...currentPhaseAnalyses.current],
            probeAnalyses: [...currentProbeAnalyses.current],
            timerFramingCondition: timerFramingCondition,
            responseDurations: {
                actOne: actOneDuration.current,
                probes: [...probeDurations.current]
            }
        };

        setIsGeneratingSummary(true);
        const allAnalyses = [...currentProbeAnalyses.current];
        generateQuestionSummary({
            accumulator,
            targetRole: "Candidate",
            companyName: "Target Company"
        }).then(summary => {
            summary.questionText = completedQ.text;
            summary.allProbeAnalyses = allAnalyses;
            setQuestionSummaries(prev => [...prev, summary]);
        }).catch(err => console.error("Summary generation failed:", err))
            .finally(() => setIsGeneratingSummary(false));

        // Reset accumulators for the new question
        currentPhaseAnalyses.current = [];
        currentProbeAnalyses.current = [];
        actOneDuration.current = 0;
        probeDurations.current = [];

        if (currentQuestionIndex < activeQuestions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
            setStarPhase(0);
            setSessionSeconds(0);
            phaseStartTimestamp.current = Date.now();
            setIsProbingActive(false);
            setCurrentProbe(null);
            setProbeAnalysis(null);
            setProbingTranscript("");
            setProbeCount(0);
            setNextQuestionCountdown(0);
            setAnswerProbeCountdown(0);
            isCountingDownToAnswer.current = false;
            askedProbesThisQuestion.current = [];
            setProbeCompletionMessage(null);
            lastPhaseTranscriptLength.current = transcript.length;
            questionStartTranscriptLength.current = transcript.length;
        } else {
            setRecordingStatus('uploaded');
            handleGenerateFinalFeedback();
        }
    };

    const handleNextPhase = async () => {
        if (recordingStatus === 'recording') await handleRecord();

        const phaseTranscript = transcript.slice(lastPhaseTranscriptLength.current);
        lastPhaseTranscriptLength.current = transcript.length;

        if (starPhase < 3) {
            setStarPhase(prev => {
                const next = prev + 1;
                if (next === 3) { // End of Act One
                    actOneDuration.current = sessionSeconds;
                }
                return next;
            });
            phaseStartTimestamp.current = Date.now();
        } else {
            if (transcript.length > questionStartTranscriptLength.current + 30 && !isGeneratingProbe) {
                triggerProbing();
            } else {
                handleNextQuestion();
            }
        }

        const currentQ = activeQuestions[currentQuestionIndex] || activeQuestions[0];
        analyzeProbeResponse({
            targetRole: "Not Specified",
            companyName: "Target Company",
            question: currentQ.text,
            response: phaseTranscript,
            scaffoldPhase: starPhase
        }).then(analysis => {
            currentPhaseAnalyses.current.push(analysis);
        }).catch(err => console.error("Silent phase analysis failed:", err));
    };



    const handleAnswerProbeClick = () => {
        if (recordingStatus === 'idle' && answerProbeCountdown === 0) {
            setAnswerProbeCountdown(10);
            isCountingDownToAnswer.current = true;
        } else if (recordingStatus === 'recording') {
            handleRecord();
        }
    };

    const handleAnalyzeProbe = async () => {
        if (!currentProbe) return;
        setProbeLoadingType('analysis');
        setIsGeneratingProbe(true);
        try {
            const currentQ = activeQuestions[currentQuestionIndex] || activeQuestions[0];
            const responseToProbe = transcript.slice(probingTranscript.length || lastPhaseTranscriptLength.current);
            const analysis = await analyzeProbeResponse({
                targetRole: "Not Specified",
                companyName: "Target Company",
                question: currentQ.text,
                probe: currentProbe.probe,
                probeType: currentProbe.probe_type,
                probeRationale: currentProbe.rationale,
                response: responseToProbe,
                scaffoldPhase: 3
            });
            const analysisWithProbe: ProbeAnalysis = { ...analysis, verbatimProbe: currentProbe.probe };
            setProbeAnalysis(analysisWithProbe);
            currentProbeAnalyses.current.push(analysisWithProbe);
            probeDurations.current.push(sessionSeconds - actOneDuration.current - probeDurations.current.reduce((a, b) => a + b, 0));
            setActiveTab('analysis');

            if (analysis.proceed) {
                setProbeCompletionMessage("Insights generated. You've provided sufficient evidence. You may now move to the next question.");
                setNextQuestionCountdown(0);
            } else {
                setProbeCompletionMessage("Further detail is required to meet the interview feedback threshold. Preparing follow-up probe...");
                setTimeout(() => {
                    if (!analysis.proceed && isProbingActive) {
                        triggerProbing();
                    }
                }, 7000); // Increased to 7s to allow ample reading time for insights
            }
        } catch (err) {
            console.error("Failed to analyze probe response:", err);
        } finally {
            setIsGeneratingProbe(false);
        }
    };

    const handlePrevQuestion = async () => {
        if (recordingStatus === 'recording') await handleRecord();
        if (currentQuestionIndex > 0) {
            setCurrentQuestionIndex(prev => prev - 1);
            setStarPhase(0);
            setSessionSeconds(0);
            phaseStartTimestamp.current = Date.now();
            setIsProbingActive(false);
            setCurrentProbe(null);
            setProbeAnalysis(null);
            setProbingTranscript("");
            setProbeCount(0);
            lastPhaseTranscriptLength.current = transcript.slice(0, questionStartTranscriptLength.current).length;
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

        const questionSummariesContent = questionSummaries.length > 0 ? `
## 12. DETAILED QUESTION SUMMARIES & PROBING AUDITS
${questionSummaries.map((summary, idx) => `
### QUESTION ${idx + 1}: ${summary.questionText}

#### Answer Overview
${summary.answerOverview}

#### Key Strengths
${summary.strengths.map(s => `- ${s}`).join('\n')}

#### Probing Engagement Audit
${summary.probeEngagement}

${summary.allProbeAnalyses && summary.allProbeAnalyses.length > 0 ? `
#### Real-time Probes Asked
${summary.allProbeAnalyses.map((p, pIdx) => `
**Probe ${pIdx + 1}:** "${p.verbatimProbe}"
- **Interpretation:** ${p.interpretation}
- **Successful:** ${p.probe_successful ? 'YES' : 'NO'}
- **Action Taken:** ${p.reason}
`).join('\n')}
` : ''}

#### Practice Suggestion
${summary.practiceTask}

---
`).join('\n')}
` : '';

        const reportContent = `
# ASCEND FEEDBACK REPORT
Generated on: ${new Date().toLocaleString()}
Session ID: ${Math.random().toString(36).substring(2, 15).toUpperCase()}

## 1. OVERALL SUMMARY
${detailedFeedback.performanceSummary}

## 2. SESSION-WIDE STAR PERFORMANCE
${detailedFeedback.overallStarSynthesis}

## 3. Assessment Guide
- STAR Completion: ${detailedFeedback.rubrics.starCompletion}%
- Evidence Specificity: ${detailedFeedback.rubrics.evidenceSpecificity}%
- Role Clarity: ${detailedFeedback.rubrics.roleClarity}%
- JD Alignment: ${detailedFeedback.rubrics.jdAlignment}%
- Communication Clarity: ${detailedFeedback.rubrics.communicationClarity}%

## 3. KEY STRENGTHS
${detailedFeedback.strengths.map(s => `- ${s}`).join('\n')}

## 4. IMPROVEMENT AREAS
${detailedFeedback.weaknesses.map(w => `- ${w}`).join('\n')}

## 5. STAR ANALYSIS
- Situation: ${detailedFeedback.starAnalysis.situation}
- Task: ${detailedFeedback.starAnalysis.task}
- Action: ${detailedFeedback.starAnalysis.action}
- Result: ${detailedFeedback.starAnalysis.result}

## 6. KEYWORD COVERAGE
- Found: ${detailedFeedback.keywordCoverage.found.join(', ')}
- Missing: ${detailedFeedback.keywordCoverage.missing.join(', ')}

## 7. Thinking Skill Areas
- Knowledge & Learning (Gc): ${detailedFeedback.chcCognitiveDimensions?.crystallisedIntelligence.score}% (${detailedFeedback.chcCognitiveDimensions?.crystallisedIntelligence.evidenceBasis})
- Problem Solving Ability (Gf): ${detailedFeedback.chcCognitiveDimensions?.fluidIntelligence.score}% (${detailedFeedback.chcCognitiveDimensions?.fluidIntelligence.evidenceBasis})
- Practical Reasoning (Gq): ${detailedFeedback.chcCognitiveDimensions?.practicalReasoning.score}% (${detailedFeedback.chcCognitiveDimensions?.practicalReasoning.evidenceBasis})
- Correlation Note: ${detailedFeedback.chcCognitiveDimensions?.overallCHCNote}

## 8. ACTIONABLE REMEDIATION
${detailedFeedback.actionableSuggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}

## 9. CAREER DEVELOPMENT
- Recommended Certifications: ${detailedFeedback.careerDevelopment.certifications.join(', ')}
- Next Steps: ${detailedFeedback.careerDevelopment.nextSteps.join(', ')}

## 10. INTEGRITY & SAFETY AUDIT
- Violation Detected: ${detailedFeedback.integrityViolation?.detected ? 'YES' : 'NO'}
${detailedFeedback.integrityViolation?.detected ? `- Note: ${detailedFeedback.integrityViolation.note}` : ''}
- Bias & Fairness Note: ${detailedFeedback.biasAndFairnessNote}

## 11. INTERVIEW TRANSCRIPT
${detailedFeedback.maskedTranscript?.text || transcript}

${questionSummariesContent}

---
© ${new Date().getFullYear()} Ascend Platform. Confidential Performance Report.
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

    if (recordingStatus === 'uploaded') {
        return (
            <div className={`min-h-screen w-screen bg-slate-50 flex flex-col items-center p-8 overflow-y-auto custom-scrollbar animate-fade-in relative ${isTourActive ? 'z-[11000]' : 'z-[8000]'}`}>
                <div className="max-w-7xl w-full space-y-12">
                    <div id="report-header" className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 border-b border-slate-200 pb-12">
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 bg-indigo-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-indigo-900/20">
                                    <FileText className="text-white" size={32} />
                                </div>
                                <div>
                                    <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase leading-none">Feedback Report</h1>
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
                            <div id="report-performance-summary" className="md:col-span-2 space-y-8">
                                <section className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                                            <TrendingUp size={20} />
                                        </div>
                                        <h3 className="text-lg font-black uppercase tracking-widest text-slate-900">Performance Summary</h3>
                                    </div>
                                    <p className="text-slate-700 leading-relaxed font-medium">{detailedFeedback.performanceSummary}</p>

                                    <div className="mt-8 p-6 bg-indigo-50 rounded-[32px] border border-indigo-100">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 mb-3 flex items-center gap-2">
                                            <Brain size={14} /> Session-Wide STAR Synthesis
                                        </h4>
                                        <p className="text-xs font-bold text-slate-800 leading-relaxed italic">
                                            "{detailedFeedback.overallStarSynthesis}"
                                        </p>
                                    </div>

                                    <div id="report-rubrics-grid" className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                                        {Object.entries(detailedFeedback.rubrics || {}).map(([key, value]) => {
                                            if (typeof value !== 'number') return null;
                                            return (
                                                <div key={key} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center text-center">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{key.replace(/([A-Z])/g, ' $1')}</span>
                                                    <span className="text-2xl font-black text-indigo-600">{value}%</span>
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
                                        {Object.entries(detailedFeedback.starAnalysis || {}).map(([key, value]) => (
                                            <div key={key} className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                                                <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-2">{key}</h4>
                                                <p className="text-xs font-medium text-slate-700 leading-relaxed">{value}</p>
                                            </div>
                                        ))}
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
                                            {(detailedFeedback.strengths || []).map((s, i) => (
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
                                            {(detailedFeedback.weaknesses || []).map((w, i) => (
                                                <li key={i} className="flex gap-3 text-xs font-medium text-slate-700">
                                                    <div className="w-1.5 h-1.5 bg-rose-500 rounded-full mt-1.5 shrink-0" />
                                                    {w}
                                                </li>
                                            ))}
                                        </ul>
                                    </section>
                                </div>

                                <section id="report-chc-clusters" className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="text-sm font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2">
                                            <Brain size={16} /> Cognitive Merit Clusters (CHC)
                                        </h3>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">McGrew (2009) Framework</span>
                                    </div>
                                    {detailedFeedback.chcCognitiveDimensions ? (
                                        <div className="space-y-6">
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                {[
                                                    { id: 'crystallised', label: 'Gc: knowledge', data: detailedFeedback.chcCognitiveDimensions.crystallisedIntelligence },
                                                    { id: 'fluid', label: 'Gf: reasoning', data: detailedFeedback.chcCognitiveDimensions.fluidIntelligence },
                                                    { id: 'practical', label: 'Gq: performance', data: detailedFeedback.chcCognitiveDimensions.practicalReasoning }
                                                ].map((cluster) => (
                                                    <div key={cluster.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                                        <div className="flex justify-between items-center mb-2">
                                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{cluster.label}</span>
                                                            <span className="text-sm font-black text-indigo-600">{cluster.data.score}%</span>
                                                        </div>
                                                        <p className="text-[10px] text-slate-600 leading-tight">{cluster.data.evidenceBasis}</p>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                                                <h4 className="text-[9px] font-black uppercase tracking-widest text-indigo-600 mb-1">Audit Correlation Note</h4>
                                                <p className="text-xs font-medium text-slate-700 italic">"{detailedFeedback.chcCognitiveDimensions.overallCHCNote}"</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-slate-400 italic">Cognitive clusters unavailable.</p>
                                    )}
                                </section>

                                <section id="report-actionable-insights" className="bg-slate-900 text-white p-8 rounded-[40px] shadow-xl">
                                    <h3 className="text-sm font-black uppercase tracking-widest text-indigo-400 mb-6 flex items-center gap-2">
                                        <Brain size={16} /> Actionable Insights
                                    </h3>
                                    <div className="grid grid-cols-1 gap-4">
                                        {(detailedFeedback.actionableSuggestions || []).map((s, i) => (
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
                                        <Award size={16} /> Recommended Certifications
                                    </h3>
                                    <div className="space-y-3">
                                        {(detailedFeedback.careerDevelopment?.certifications || []).map((c, i) => (
                                            <div key={i} className="px-4 py-3 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-black uppercase tracking-widest border border-indigo-100">
                                                {c}
                                            </div>
                                        )) || <p className="text-xs text-slate-400 italic">No certifications listed.</p>}
                                    </div>
                                </section>

                                <section className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
                                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 mb-6 flex items-center gap-2">
                                        <BookOpen size={16} /> Next Steps
                                    </h3>
                                    <ul className="space-y-4">
                                        {(detailedFeedback.careerDevelopment?.nextSteps || []).map((s, i) => (
                                            <li key={i} className="flex gap-3 text-xs font-medium text-slate-700">
                                                <div className="w-5 h-5 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 shrink-0 font-black text-[10px]">
                                                    {i + 1}
                                                </div>
                                                {s}
                                            </li>
                                        )) || <p className="text-xs text-slate-400 italic">No next steps provided.</p>}
                                    </ul>
                                </section>

                                <section className="bg-amber-50 p-6 rounded-[32px] border border-amber-100">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-2">Bias & Fairness Audit</h4>
                                    <p className="text-[11px] font-medium text-amber-800 leading-relaxed italic">
                                        {detailedFeedback.biasAndFairnessNote || "Procedural justice audit complete."}
                                    </p>
                                </section>

                                <section className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
                                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 mb-6 flex items-center gap-2">
                                        <BookOpen size={16} /> Interview Transcript
                                    </h3>
                                    <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 max-h-96 overflow-y-auto custom-scrollbar">
                                        <p className="text-xs font-medium text-slate-600 leading-relaxed whitespace-pre-wrap">
                                            {detailedFeedback.maskedTranscript?.text || transcript || "No transcript data available."}
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
        <div id="ascend-platform-layout" className={`flex flex-col md:flex-row h-screen w-screen bg-slate-100 overflow-hidden ${dyslexiaFont ? 'font-dyslexia-friendly' : ''}`}>
            {/* Reflection Overlay with STAR APPROACH Sidebar restored */}
            {isBreakActive && (
                <div id="reflective-break-session" className={`fixed inset-0 bg-white/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 animate-fade-in overflow-hidden ${isTourActive ? 'z-[11000]' : 'z-[5000]'}`}>
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
                                <h2 className="text-2xl font-black uppercase tracking-tighter">Reflective Break Session</h2>
                            </div>
                            <span className="text-2xl font-black font-mono tracking-tighter tabular-nums">{Math.floor(breakTimeRemaining / 60)}:{String(breakTimeRemaining % 60).padStart(2, '0')}</span>
                        </div>

                        <div id="reflective-break-content" className="flex-1 flex flex-col md:flex-row gap-8 overflow-hidden">
                            {/* STAR Sidebar in Break Session */}
                            <aside className="w-full md:w-[340px] shrink-0 bg-white border border-slate-200 rounded-[32px] p-8 space-y-8 flex flex-col shadow-xl">
                                <div>
                                    <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4">Take a moment to read the question and organize your thoughts for a clear, confident response.</h3>
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
                                    <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Interview Prep Board</h3>
                                    <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest animate-pulse"></span>
                                </div>
                                <textarea
                                    autoFocus
                                    value={userNotes}
                                    onChange={(e) => setUserNotes(e.target.value)}
                                    placeholder="Plan and structure your answer using key points or the STAR method...."
                                    className="flex-1 bg-transparent border-none text-xl outline-none resize-none font-medium text-slate-800 leading-relaxed custom-scrollbar"
                                />
                                <div className="flex justify-end pt-8 border-t shrink-0">
                                    <button
                                        onClick={() => { setIsWarmupActive(true); setWarmupTimeRemaining(5); }}
                                        className="px-12 py-5 bg-slate-900 text-white rounded-[24px] font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:bg-indigo-600 transition-all hover:scale-105 active:scale-95"
                                    >
                                        Resume to the main interview session
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
                                        <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${isProbingActive ? 'w-10 bg-indigo-600 shadow-sm' : starPhase === i ? 'w-10 bg-indigo-600 shadow-sm' : i < starPhase ? 'w-10 bg-indigo-400 opacity-60' : 'w-2 bg-slate-200'}`} />
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                id="ascend-deep-probe-button"
                                onClick={triggerProbing}
                                disabled={starPhase < 3 || isGeneratingProbe || transcript.length < 20}
                                className={`px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all border ${isProbingActive
                                    ? 'bg-indigo-50 border-indigo-200 text-indigo-600'
                                    : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                <Brain size={16} className={isGeneratingProbe ? 'animate-pulse' : ''} />
                                <span className="text-[10px] font-black uppercase tracking-widest">Deep Probe</span>
                            </button>
                            <button onClick={handleStartBreak} className="p-3 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all flex items-center gap-2 group">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                <span className="text-[10px] font-black uppercase tracking-widest hidden group-hover:block transition-all">Reflect</span>
                            </button>
                        </div>
                    </div>
                    <h2 className="text-lg font-bold text-slate-900 leading-tight">{currentRequirement.text}</h2>
                </header>

                <div className="flex-1 bg-white rounded-[40px] border border-slate-200 shadow-xl relative overflow-hidden flex items-center justify-center group">
                    <div id="ascend-timer-module" className="absolute top-6 left-6 z-40">
                        <TimerWidget mode={timerDisplay} framing={timerFramingCondition} elapsedSeconds={sessionSeconds} isRecording={recordingStatus === 'recording'} isHidden={isTimerHidden} />
                    </div>

                    <div className="absolute top-6 right-6 z-40 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            id="ascend-timer-toggle"
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
                        <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover mirrored-video pointer-events-none" />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-8 bg-slate-50 text-center p-8">
                            <Waveform active={recordingStatus === 'recording'} scale={1.2} />
                            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Video Hidden • Speak when ready</p>
                        </div>
                    )}

                    <AnimatePresence>
                        {isGeneratingProbe && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 z-[100] bg-slate-900/90 backdrop-blur-xl flex flex-col items-center justify-center p-12 text-center"
                            >
                                <motion.div
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="relative mb-10"
                                >
                                    <div className="w-28 h-28 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Brain className="text-white animate-pulse" size={44} />
                                    </div>
                                </motion.div>
                                <motion.h3
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.1 }}
                                    className="text-2xl font-black text-white uppercase tracking-widest mb-6 max-w-lg leading-tight"
                                >
                                    Relax while the {probeLoadingType === 'question' ? 'probing question' : 'ANALYSIS'} is being prepared
                                </motion.h3>
                                <motion.div
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.2 }}
                                    className="space-y-4"
                                >
                                    <p className="text-sm font-bold text-indigo-300 uppercase tracking-[0.3em]">
                                        You are doing well. Stay focused.
                                    </p>
                                    <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden mx-auto mt-6">
                                        <motion.div
                                            className="h-full bg-indigo-500"
                                            animate={{ x: ["-100%", "100%"] }}
                                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                        />
                                    </div>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <footer className="flex flex-col items-center gap-4 py-4 shrink-0">
                    <div className="flex items-center gap-4">
                        {!isProbingActive ? (
                            <>
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
                                <button id="ascend-record-button" onClick={handleRecord} className={`px-12 py-4 rounded-2xl font-black text-lg transition-all shadow-xl hover:scale-105 active:scale-95 ${recordingStatus === 'recording' ? 'bg-rose-500 text-white shadow-rose-900/20' : 'bg-indigo-600 text-white shadow-indigo-900/20'}`}>
                                    {recordingStatus === 'idle' ? `Speak: ${STAR_LABELS[starPhase]}` : 'Stop Speaking'}
                                </button>
                                <button id="ascend-next-step-button" onClick={handleNextPhase} className="px-8 py-4 bg-white border border-slate-200 rounded-2xl font-bold text-slate-700 shadow-md hover:bg-slate-50 transition-all hover:translate-x-1">
                                    {starPhase < 3 ? 'Next Step →' : 'Done'}
                                </button>
                                <button
                                    id="ascend-next-question-button"
                                    onClick={handleNextQuestion}
                                    disabled={currentQuestionIndex === activeQuestions.length - 1}
                                    className="p-4 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-slate-600 disabled:opacity-30 transition-all"
                                    title="Next Question"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                                    </svg>
                                </button>
                            </>
                        ) : (
                            <>
                                <button onClick={handleAnswerProbeClick}
                                    disabled={isGeneratingProbe || nextQuestionCountdown > 0}
                                    className={`px-12 py-4 rounded-2xl font-black text-lg transition-all shadow-xl hover:scale-105 active:scale-95 ${recordingStatus === 'recording' ? 'bg-rose-500 text-white shadow-rose-900/20' :
                                        answerProbeCountdown > 0 ? 'bg-indigo-900 text-white scale-95 shadow-inner' : 'bg-indigo-600 text-white shadow-indigo-900/20'
                                        }`}>
                                    {recordingStatus === 'recording' ? 'Stop Speaking' :
                                        answerProbeCountdown > 0 ? `Mic Opening... (${answerProbeCountdown})` : 'Answer Probe'}
                                </button>
                                <button
                                    onClick={handleNextQuestion}
                                    disabled={nextQuestionCountdown > 0 || answerProbeCountdown > 0}
                                    className="px-8 py-4 bg-white border border-slate-200 rounded-2xl font-bold text-slate-700 shadow-md hover:bg-slate-50 transition-all hover:translate-x-1 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    <span>
                                        {probeAnalysis?.proceed === false
                                            ? "More Detail Needed"
                                            : currentQuestionIndex < activeQuestions.length - 1
                                                ? (nextQuestionCountdown > 0 ? `Next Question (${nextQuestionCountdown})` : 'Next Question')
                                                : (nextQuestionCountdown > 0 ? `Finish Session (${nextQuestionCountdown})` : 'Finish Session')
                                        }
                                    </span>
                                </button>
                            </>
                        )}
                    </div>
                </footer>
            </main>

            <aside id="ascend-toolkit-sidebar" className="w-full md:w-[380px] bg-white border-l border-slate-200 flex flex-col shadow-2xl shrink-0">
                <div className="p-6 border-b bg-slate-50/50 flex items-center justify-between">
                    <div>
                        <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">
                            {isProbingActive ? 'Probing Pipeline' : 'Practice Question'}
                        </h3>
                        <p className="text-xs font-bold text-slate-900 leading-tight">
                            {isProbingActive ? 'Deep Domain Analysis' : `"${currentQuestion.text}"`}
                        </p>
                    </div>
                    {isProbingActive && (
                        <button
                            onClick={handleNextQuestion}
                            disabled={nextQuestionCountdown > 0 || answerProbeCountdown > 0}
                            className="text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed tracking-widest px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-all"
                            title="Move On to Next Question"
                        >
                            {nextQuestionCountdown > 0 ? `Move On (${nextQuestionCountdown})` : 'Move On'}
                        </button>
                    )}
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="flex flex-col h-full">
                        <div className="flex border-b bg-slate-50/30 p-1">
                            {(['STAR', 'notes', 'transcript', 'analysis', 'summaries'] as ToolkitTab[]).map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab
                                        ? 'bg-white text-indigo-600 shadow-sm rounded-xl'
                                        : 'text-slate-400 hover:text-slate-600'
                                        }`}
                                >
                                    {tab === 'summaries' ? 'Reports' : tab === 'STAR' ? 'Plan' : tab}
                                </button>
                            ))}
                        </div>

                        <div className="flex-1 p-6">
                            {activeTab === 'STAR' && (
                                <div id="ascend-toolkit-star" className="space-y-6 animate-fade-in">
                                    {isProbingActive && currentProbe ? (
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-2 text-indigo-600 bg-indigo-50 p-2 rounded-xl w-fit">
                                                <AlertCircle size={14} className="animate-pulse" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Follow-Up Probe Active | Probe {probeCount}</span>
                                            </div>
                                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2 block">They asked</span>
                                                <p className="text-sm font-bold text-slate-900">{currentProbe.probe}</p>
                                            </div>
                                            {currentProbe.contextual_anchor && (
                                                <div className="bg-white p-3 rounded-xl border border-indigo-100 flex items-start gap-3">
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400 mt-0.5 shrink-0">They picked up on</span>
                                                    <span className="text-xs font-bold text-indigo-900 italic">"{currentProbe.contextual_anchor}"</span>
                                                </div>
                                            )}
                                            {probeCompletionMessage && (
                                                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-center justify-center text-center mt-4">
                                                    <span className="text-xs font-bold text-emerald-800">{probeCompletionMessage}</span>
                                                </div>
                                            )}
                                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 mt-4">
                                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Why this question</span>
                                                <p className="text-xs font-medium text-slate-700 leading-relaxed">{currentProbe.rationale}</p>
                                            </div>
                                            {probeAnalysis && probeAnalysis.coaching_tip && (
                                                <div className="bg-indigo-600 p-4 rounded-2xl border border-indigo-500 text-white mt-4 shadow-lg shadow-indigo-900/20 animate-fade-in">
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-indigo-200 mb-2 block">Personalized Coaching Tip</span>
                                                    <p className="text-sm font-bold leading-relaxed">
                                                        "{probeAnalysis.coaching_tip}"
                                                    </p>
                                                </div>
                                            )}
                                            {!probeAnalysis && currentProbe && (
                                                <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 text-white mt-4 shadow-lg">
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Preparation Guidance</span>
                                                    <p className="text-sm font-bold leading-relaxed italic opacity-80">
                                                        {currentProbe.probe_type === 'CLARIFYING' && "Prepare to give a specific, concrete example. Expand on exactly what you meant."}
                                                        {currentProbe.probe_type === 'CONCRETE' && "Move from the general to the specific. Describe exactly what YOU personally did."}
                                                        {currentProbe.probe_type === 'DEEPENING' && "Think about the 'Why' and the outcome. What was the thinking behind your decision?"}
                                                        {currentProbe.probe_type === 'REDIRECTING' && "Focus back on your specific role. Avoid talking about the team or the situation for a moment."}
                                                        {currentProbe.probe_type === 'STRATEGIC' && "Think about the bigger picture and systemic impact. How did this decision scale?"}
                                                        {(!currentProbe.probe_type || currentProbe.probe_type === 'INSUFFICIENT_CONTEXT') && "Answer directly and specifically with a concrete example."}
                                                    </p>
                                                </div>
                                            )}
                                            <div className="mt-6 flex items-center justify-center gap-2 border-t pt-4">
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Current Phase:</span>
                                                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2 py-1 rounded-md">{STAR_LABELS[starPhase]}</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {currentQuestion.requirements.map((req, idx) => (
                                                <div key={req.id} className={`flex gap-4 transition-all duration-300 ${idx < starPhase ? 'opacity-30' : idx === starPhase ? 'scale-105 translate-x-1' : 'opacity-60'}`}>
                                                    <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center border-2 ${idx === starPhase ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-white border-slate-200 text-slate-400'}`}>
                                                        <span className="text-[10px] font-black">{STAR_LABELS[idx][0]}</span>
                                                    </div>
                                                    <div className="flex-1">
                                                        <span className={`text-[9px] font-black uppercase tracking-widest ${idx === starPhase ? 'text-indigo-600' : 'text-slate-500'}`}>{STAR_LABELS[idx]}</span>
                                                        <p className={`text-[11px] font-bold leading-tight mt-0.5 ${idx === starPhase ? 'text-slate-900' : 'text-slate-500'}`}>{req.text}</p>
                                                    </div>
                                                </div>
                                            ))}
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
                                <div id="ascend-transcript-area" className="h-full flex flex-col animate-fade-in">
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

                            {activeTab === 'analysis' && (
                                <div id="ascend-probing-pipeline" className="h-full flex flex-col animate-fade-in">
                                    <ProbingPipeline
                                        currentProbe={probeRevealCountdown > 0 ? null : currentProbe}
                                        analysis={probeAnalysis}
                                        isGenerating={isGeneratingProbe}
                                        revealCountdown={probeRevealCountdown}
                                    />
                                </div>
                            )}
                            {activeTab === 'summaries' && (
                                <div id="ascend-toolkit-reports" className="h-full flex flex-col animate-fade-in space-y-6">
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Response Feedback </h4>
                                        {isGeneratingSummary && (
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                                                <span className="text-[9px] font-black text-indigo-600 uppercase">Analysis in progress...</span>
                                            </div>
                                        )}
                                    </div>

                                    {questionSummaries.length === 0 ? (
                                        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-50 rounded-[32px] border border-dashed border-slate-200">
                                            <Award size={48} className="text-slate-200 mb-4" />
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Completed summaries will appear here after each question</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-6 overflow-y-auto custom-scrollbar pr-2 pb-8">
                                            {questionSummaries.map((summary, idx) => (
                                                <div key={idx} className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all group">
                                                    <div className="bg-slate-900 p-6 text-white flex items-center justify-between">
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <Award size={14} className="text-indigo-400" />
                                                                <span className="text-[9px] font-black uppercase tracking-widest text-indigo-300">Question {idx + 1} Report</span>
                                                            </div>
                                                            <h5 className="text-sm font-black leading-tight line-clamp-1">{summary.questionText}</h5>
                                                        </div>
                                                        <button
                                                            onClick={() => window.print()}
                                                            className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-colors group-hover:scale-110 active:scale-95"
                                                            title="Download PDF"
                                                        >
                                                            <Download size={18} />
                                                        </button>
                                                    </div>

                                                    <div className="p-6 space-y-6">
                                                        {/* Section 1: Answer Overview */}
                                                        <div className="space-y-2">
                                                            <h6 className="text-[9px] font-black uppercase tracking-widest text-indigo-600">Your Answer Overview</h6>
                                                            <p className="text-xs font-bold text-slate-900 leading-relaxed">{summary.answerOverview}</p>
                                                        </div>

                                                        {/* Section 2: What You Did Well */}
                                                        <div className="space-y-3">
                                                            <h6 className="text-[9px] font-black uppercase tracking-widest text-emerald-600">What You Did Well</h6>
                                                            <div className="space-y-2">
                                                                {summary.strengths.map((s, i) => (
                                                                    <div key={i} className="flex gap-3 items-start p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
                                                                        <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                                                                        <p className="text-[11px] font-bold text-emerald-900">{s}</p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* Section 3: Where To Go Deeper */}
                                                        <div className="space-y-3">
                                                            <h6 className="text-[9px] font-black uppercase tracking-widest text-amber-600">Where To Go Deeper</h6>
                                                            <div className="space-y-4">
                                                                {summary.developmentPoints.map((d, i) => (
                                                                    <div key={i} className="space-y-2 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                                                                        <div className="flex items-center gap-2">
                                                                            <AlertCircle size={14} className="text-amber-500" />
                                                                            <span className="text-[10px] font-black text-amber-900 uppercase tracking-tight">{d.gap}</span>
                                                                        </div>
                                                                        <p className="text-[11px] font-medium text-amber-800 leading-relaxed italic">"{d.whyItMatters}"</p>
                                                                        <div className="mt-2 pt-2 border-t border-amber-200/50">
                                                                            <p className="text-xs font-black text-amber-950 uppercase tracking-tighter">Instruction:</p>
                                                                            <p className="text-[11px] font-bold text-amber-900">{d.instruction}</p>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* Section 4: Probing Insight Analysis */}
                                                        <div className="space-y-4 border-t pt-6 border-slate-100">
                                                            <h6 className="text-[9px] font-black uppercase tracking-widest text-slate-400">Probing Deep-Dive Audit</h6>
                                                            <p className="text-[11px] font-medium text-slate-600 leading-relaxed mb-4">{summary.probeEngagement}</p>

                                                            {summary.allProbeAnalyses && summary.allProbeAnalyses.length > 0 && (
                                                                <div className="space-y-4">
                                                                    {summary.allProbeAnalyses.map((analysis, pIdx) => (
                                                                        <div key={pIdx} className="p-5 bg-slate-50/50 rounded-[24px] border border-slate-200">
                                                                            <div className="flex items-center justify-between mb-4">
                                                                                <div className="flex items-center gap-2">
                                                                                    <div className="p-1 bg-indigo-600 text-white rounded-lg">
                                                                                        <Sparkles size={12} />
                                                                                    </div>
                                                                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-900">Probe {pIdx + 1} Insights</span>
                                                                                </div>
                                                                                <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${analysis.probe_successful ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                                                                    }`}>
                                                                                    {analysis.probe_successful ? 'Success' : 'Incomplete'}
                                                                                </span>
                                                                            </div>

                                                                            <div className="space-y-3">
                                                                                {analysis.verbatimProbe && (
                                                                                    <div className="mb-4 pb-4 border-b border-slate-200/50">
                                                                                        <p className="text-[8px] font-black uppercase tracking-widest text-indigo-400 mb-1">Question Asked</p>
                                                                                        <p className="text-sm font-black text-slate-900 leading-tight italic">"{analysis.verbatimProbe}"</p>
                                                                                    </div>
                                                                                )}
                                                                                <div>
                                                                                    <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">Interpretation</p>
                                                                                    <p className="text-[11px] font-bold text-slate-900 leading-tight">
                                                                                        {analysis.interpretation}
                                                                                    </p>
                                                                                </div>
                                                                                {analysis.pj_observations && analysis.pj_observations.length > 0 && (
                                                                                    <div>
                                                                                        <p className="text-[8px] font-black uppercase tracking-widest text-indigo-400 mb-1">Qualitative Observations</p>
                                                                                        <div className="space-y-1">
                                                                                            {analysis.pj_observations.map((obs, oIdx) => (
                                                                                                <p key={oIdx} className="text-[10px] font-medium text-slate-600 flex gap-2">
                                                                                                    <span className="text-indigo-400">•</span> {obs}
                                                                                                </p>
                                                                                            ))}
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Section 5: One Thing To Practise */}
                                                        <div className="p-5 bg-indigo-600 rounded-[24px] text-white shadow-lg shadow-indigo-900/20">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <Award size={14} className="text-indigo-200" />
                                                                <h6 className="text-[9px] font-black uppercase tracking-widest text-indigo-100">One Thing To Practise</h6>
                                                            </div>
                                                            <p className="text-xs font-bold leading-relaxed">{summary.practiceTask}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
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
                    body * { visibility: hidden; }
                    .printable-report, .printable-report * { visibility: visible; }
                    .printable-report { 
                        position: absolute; 
                        left: 0; 
                        top: 0; 
                        width: 100%;
                        visibility: visible !important;
                    }
                    body { background: white !important; }
                    .shadow-sm, .shadow-xl, .shadow-2xl { shadow: none !important; box-shadow: none !important; }
                }
            `}</style>

            {/* Hidden Printable Container for Professional PDF Reports */}
            <div className="hidden printable-report print:block p-12 bg-white min-h-screen">
                {questionSummaries.length > 0 && (
                    <div className="max-w-[800px] mx-auto space-y-12">
                        <div className="border-b-4 border-slate-900 pb-8">
                            <h1 className="text-4xl font-black mb-2 uppercase tracking-tight">Response Summary Report</h1>
                            <div className="flex justify-between items-end">
                                <div>
                                    <p className="text-xs font-black text-indigo-600 uppercase tracking-widest">Ascend Coherence Auditor</p>
                                    <p className="text-xl font-bold mt-2">Candidate Analysis: {participantId || "Anonymous"}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold">{new Date().toLocaleDateString()}</p>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">STAR Analysis Report</p>
                                </div>
                            </div>
                        </div>
                        {questionSummaries.map((summary, idx) => (
                            <div key={idx} className="space-y-8 page-break-after-always">
                                <div className="p-6 bg-slate-900 text-white rounded-2xl">
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300">Question {idx + 1}</span>
                                    <h2 className="text-2xl font-black mt-2 leading-tight">{summary.questionText}</h2>
                                </div>

                                <section className="space-y-3">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-indigo-600 border-b border-indigo-100 pb-2">1. Your Answer Overview</h3>
                                    <p className="text-sm font-medium leading-relaxed text-slate-800">{summary.answerOverview}</p>
                                </section>

                                <section className="space-y-4">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-emerald-600 border-b border-emerald-100 pb-2">2. What You Did Well</h3>
                                    <div className="space-y-3">
                                        {summary.strengths.map((s, i) => (
                                            <div key={i} className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex gap-3">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                                                <p className="text-sm font-bold text-emerald-900">{s}</p>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                <section className="space-y-4">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-amber-600 border-b border-amber-100 pb-2">3. Where To Go Deeper</h3>
                                    <div className="space-y-4">
                                        {summary.developmentPoints.map((d, i) => (
                                            <div key={i} className="p-5 bg-amber-50 rounded-xl border border-amber-100 space-y-2">
                                                <h4 className="text-xs font-black text-amber-900 uppercase">{d.gap}</h4>
                                                <p className="text-sm font-medium text-amber-800 italic">"{d.whyItMatters}"</p>
                                                <div className="mt-4 pt-4 border-t border-amber-200">
                                                    <p className="text-[10px] font-black text-amber-950 uppercase mb-1">Instruction</p>
                                                    <p className="text-sm font-bold text-amber-900">{d.instruction}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                <section className="space-y-6">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 border-b border-slate-100 pb-2">4. Probing Deep-Dive Audit</h3>
                                    <p className="text-sm font-medium leading-relaxed text-slate-700 mb-8">{summary.probeEngagement}</p>

                                    {summary.allProbeAnalyses && summary.allProbeAnalyses.length > 0 && (
                                        <div className="space-y-8 mt-12">
                                            {summary.allProbeAnalyses.map((analysis, pIdx) => (
                                                <div key={pIdx} className="p-8 bg-slate-900 text-white rounded-[40px] relative overflow-hidden">
                                                    <div className="absolute top-0 right-0 p-8 opacity-10">
                                                        <Brain size={120} />
                                                    </div>
                                                    <div className="relative z-10 space-y-6">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <Sparkles size={18} className="text-indigo-400" />
                                                                <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-400">Probe {pIdx + 1} Analysis</h4>
                                                            </div>
                                                            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${analysis.probe_successful ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                                                }`}>
                                                                {analysis.probe_successful ? 'Structural Success' : 'Anchoring Required'}
                                                            </span>
                                                        </div>
                                                        {analysis.verbatimProbe && (
                                                            <div className="mb-6 pb-6 border-b border-white/10">
                                                                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-2">Question Asked</p>
                                                                <p className="text-xl font-bold text-white leading-tight italic">"{analysis.verbatimProbe}"</p>
                                                            </div>
                                                        )}

                                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Interpretation</p>
                                                        <p className="text-2xl font-black leading-tight tracking-tight">
                                                            {analysis.interpretation}
                                                        </p>

                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-white/10">
                                                            <div>
                                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Narrative Progression</p>
                                                                <div className="flex gap-2">
                                                                    {Object.entries(analysis.star_status).map(([comp, status]) => (
                                                                        <div key={comp} className={`w-10 h-10 rounded-xl flex items-center justify-center text-[11px] font-black uppercase ${status === 'complete' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                                                                            status === 'partial' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                                                                                'opacity-20 bg-white/5 border border-white/10'
                                                                            }`}>
                                                                            {comp[0]}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                            {analysis.pj_observations && analysis.pj_observations.length > 0 && (
                                                                <div>
                                                                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-3">Qualitative Findings</p>
                                                                    <div className="space-y-2">
                                                                        {analysis.pj_observations.map((obs, oIdx) => (
                                                                            <div key={oIdx} className="flex gap-3 items-start">
                                                                                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full mt-1.5 shrink-0" />
                                                                                <p className="text-xs font-medium text-slate-300 italic leading-relaxed">"{obs}"</p>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="pt-4 flex items-center gap-4">
                                                            <div className="px-4 py-2 bg-white/5 rounded-2xl border border-white/10">
                                                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 mr-2">System Action:</span>
                                                                <span className="text-[10px] font-bold text-white">{analysis.reason}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </section>

                                <section className="p-6 bg-indigo-50 border-2 border-indigo-200 rounded-[32px] space-y-3">
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-700">5. One Thing To Practise</h3>
                                    <p className="text-lg font-black text-indigo-900 leading-tight">{summary.practiceTask}</p>
                                </section>
                            </div>
                        ))}

                        <div className="pt-12 border-t border-slate-200 text-center">
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Generated by AscendX Professional Feedback Engine</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AscendPlatform;
