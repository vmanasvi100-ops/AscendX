import React, { useState, useEffect, useRef } from 'react';
import { useSettings } from '../context/SettingsContext';
import { RecordingStatus, AnalyticsEventType, TimerDisplay, Question, Probe, ProbeAnalysis, DetailedFeedback, QuestionSummaryReport, TimerFramingCondition, SessionRecord, MesoAccumulator, CompetencyDemonstrationLevel, MasteryComponent } from '../types';
import { generateProbe, analyzeProbeResponse, generateQuestionSummary } from '../services/probingService';
import { generateDetailedFeedback } from '../services/feedbackService';
import { generateContent } from '../services/aiClient';
import ProbingPipeline from './ProbingPipeline';
import ProbingReport from './ProbingReport';
import QuestionReport from './QuestionReport';
import ImprovementPlan from './ImprovementPlan';
import ELCQuestionTrace from './ELCQuestionTrace';
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
    act1Analysis?: ProbeAnalysis | null;  // ZPD lower boundary — unprobed (Vygotsky 1978)
    summaryReport: QuestionSummaryReport | null;
}
type VideoState = 'standard' | 'hidden';
type AspectRatio = '9/16' | '2/3' | '3/4' | '4/5' | '3/2' | '16/10' | '16/5' | '16/7' | '20/7';



// Clear legacy session history key — superseded by email-keyed cross-session tracking
try { localStorage.removeItem('ascend_session_history'); } catch { /* ignore */ }

// ─── Preview Mode — realistic sample data for UI/audio testing without a full interview ────
const _PREVIEW_TRANSCRIPT = "During my final year at university, I was leading a group project for our marketing module. We had three weeks to deliver a campaign strategy for a local charity. I noticed early on that our timeline wasn't realistic — we were already behind by the end of week one. So I restructured the schedule, assigned individual ownership to each section, and set up fifteen-minute check-ins every morning. I personally took on the risk assessment and timeline tracking so the rest of the team could focus on delivery. We presented on time and the charity implemented two of our three recommendations — the social media strategy and the community outreach plan.";

const PREVIEW_SESSION_LOG: SessionEntry[] = [{
    questionIndex: 0,
    questionText: "Tell me about a time you demonstrated leadership under pressure.",
    starPhaseReached: 3,
    transcriptSlice: _PREVIEW_TRANSCRIPT,
    probe: {
        probe: "You mentioned restructuring the schedule — what was the specific decision you made, and what alternatives did you consider before choosing that approach?",
        probe_type: 'DEEPENING',
        rationale: "Candidate established strong context but has not articulated personal reasoning in the Action phase — key decision-making evidence is implicit.",
        contextual_anchor: "I restructured the schedule",
        scaffold_phase: 2,
        difficulty: 'MEDIUM',
        question_type: 'CORE_COMPETENCY',
        zpd_note: "Upper boundary: candidate articulates deliberate decision-making with alternatives considered."
    },
    probeAnalysis: {
        probe_successful: true,
        depth_delta: 'increased',
        evidence_added: "Candidate clarified the specific decision to pivot from shared ownership to individual accountability, and confirmed they considered extending the deadline before rejecting it.",
        star_status: { situation: 'complete', task: 'complete', action: 'complete', result: 'complete' },
        weakest_star_component: null,
        contextual_anchor: "I personally took on the risk assessment",
        suggested_next_probe_type: null,
        behavioural_evidence_signals: { ownership_language: 'present', skill_language: 'present', impact_language: 'present' },
        scaffold_dependency_signal: 'used_moderately',
        interpretation: "Strong full-STAR response with clear personal ownership, measurable outcome, and deliberate decision-making evidence.",
        pj_observations: ["Personal agency explicitly present: 'I personally took on'", "Measurable result with denominator: two of three", "Alternative-consideration signals senior decision-making pattern"],
        novel_claim_introduced: true,
        proceed: true,
        reason: "Full STAR with personal ownership language and verifiable outcome. No further probing needed.",
        merit_vectors: { autonomy: 78, competence: 72, relatedness: 58, lowest_vector: 'relatedness' },
        presentation_authenticity: { front_stage: 38, back_stage: 71 },
        chc_signals: { gc: 'moderate', gf: 'strong', gq: 'strong', lowest_signal: 'gc' },
        algorithmic_aversion: { detected: false, evidence: null },
        competency_demonstration_level: 'Established',
        competency_demonstration_descriptor: "Full STAR with personal contribution, evidence of strategic decision-making, and a verifiable result. One precision step from Advanced."
    },
    act1Analysis: {
        probe_successful: false,
        depth_delta: 'same',
        evidence_added: "",
        star_status: { situation: 'complete', task: 'complete', action: 'partial', result: 'complete' },
        weakest_star_component: 'action',
        contextual_anchor: "",
        suggested_next_probe_type: 'DEEPENING',
        behavioural_evidence_signals: { ownership_language: 'absent', skill_language: 'present', impact_language: 'absent' },
        scaffold_dependency_signal: 'relied_heavily',
        interpretation: "Initial answer used predominantly group-level language in the Action phase, obscuring personal contribution.",
        pj_observations: ["Action phase lacked personal agency language — 'we' used throughout"],
        novel_claim_introduced: false,
        proceed: false,
        reason: "Action phase needs personal ownership language unlocked by probing.",
        merit_vectors: { autonomy: 42, competence: 64, relatedness: 48, lowest_vector: 'autonomy' },
        presentation_authenticity: { front_stage: 62, back_stage: 44 },
        chc_signals: { gc: 'moderate', gf: 'moderate', gq: 'strong', lowest_signal: 'gc' },
        algorithmic_aversion: { detected: false, evidence: null }
    },
    summaryReport: {
        questionId: 'preview-q1',
        questionText: "Tell me about a time you demonstrated leadership under pressure.",
        answerOverview: "You described a group project where you identified a timeline risk early and restructured the team's approach before it became a delivery failure. Your answer demonstrated clear situational awareness and a proactive, structured response.",
        strengths: [
            "Personal ownership — explicit: 'I personally took on the risk assessment and timeline tracking' directly names your contribution and separates it from the team's work. This phrase alone distinguishes your answer from candidates who describe group outcomes without clarifying their individual role.",
            "Measurable result — strong: two of three recommendations implemented is specific, verifiable, and includes a denominator — which gives the outcome claim immediate credibility rather than a vague claim of success."
        ],
        developmentPoints: [{
            gap: "Team response to your leadership — not yet articulated",
            whyItMatters: "You described what the team did after you restructured, but not how they responded to your leadership. Interviewers look for evidence of influence, not just execution.",
            instruction: "Add one sentence: 'After I introduced the daily check-ins, the team told me it removed their uncertainty about priorities — they moved faster because they weren't second-guessing the plan.' Specific team response makes your leadership claim concrete rather than declared."
        }],
        probeEngagement: "You engaged well with the follow-up, introducing the detail about alternatives considered — you looked at extending the deadline before rejecting it. This reveals deliberate decision-making that was not visible in your initial answer.",
        probeCorrelation: "Your initial answer established strong Situation and Task. The Action phase needed the probe to unlock personal ownership language. The development target: make that specificity available in your first delivery, without prompting.",
        integratedCoaching: "You have the experience and the structure. The gap between your initial answer and your probed answer is precisely the gap between a good candidate and a strong one. The probe unlocked language you clearly had — the practice is to front-load it.",
        practiceTask: "Record this answer again. Before the Action section, write down: 'The specific decision I made was...' Deliver that sentence first, then describe the execution. Repeat until you do not need the written prompt.",
        timestamp: Date.now(),
        selfAssessmentPrompt: "",
        calibrationNote: "Your instinct to highlight the timeline restructure was exactly right — that is the highest-leverage action in your answer.",
        competencyDemonstrationLevel: 'Established',
        competencyDemonstrationDescriptor: "Full STAR response with personal contribution and measurable outcome. One adjustment — front-loading personal ownership language — would move this to Advanced.",
        forwardOrientation: "Next session goal: open your Action section with a deliberate decision statement before describing execution. Practise until the ownership language comes first without prompting.",
        cvAlignmentNote: "Your answer drew on documented group project experience and aligned directly with the leadership competency being assessed.",
        elcStages: {
            ce: "You arrived with a real experience — a genuine deadline, an external client, and team pressure that was authentic.",
            ro: "The probe revealed that your decision-making was more deliberate than your initial answer suggested — you had considered alternatives and made an active choice.",
            ac: "Transferable principle: your instinct to restructure accountability before execution is a leadership pattern, not a project management one — it applies in any ambiguous delivery context.",
            ae: "Next session: open your Action section with 'I decided...' Deliver that sentence first. Measure whether the interviewer nods before you finish the next sentence."
        }
    }
}];

const PREVIEW_DETAILED_FEEDBACK: DetailedFeedback = {
    performanceSummary: "Your session demonstrated clear structural instinct and genuine experience to draw on. You established context credibly, outlined the task clearly, and articulated a result with measurable specificity — two of three recommendations implemented is a strong outcome claim. The most significant development area is the Action phase: your initial delivery used group-level language that obscured your specific personal contribution. The follow-up probe unlocked substantially stronger material, which is a positive signal — the evidence exists, and the precision emerges when you are asked directly. The practice priority is to front-load that ownership language in your first delivery, before any prompt. Your answer improved meaningfully under probing, which indicates the gap is presentation-level, not experience-level — a faster fix than it appears.",
    overallStarSynthesis: "Your STAR structure was present and largely complete. Situation and Task were established with genuine specificity. The Result was strong and verifiable. The Action phase showed clear improvement under probing — your initial delivery grouped your actions with the team's, but the follow-up surfaced a personal decision with an alternative considered and rejected. The NCS coaching priority is the Action phase: at 60% of interview weighting, it is where your answer is assessed most heavily, and it is the phase most improved by deliberate language choice rather than additional experience.",
    strengths: [
        "Personal ownership — explicit: 'I personally took on the risk assessment' directly names your contribution. Quote: 'I personally took on' | Signal: deliberate personal agency, not passive group membership | Reinforce: this language pattern is exactly what interviewers note when marking a candidate as leadership-capable.",
        "Measurable result — strong: 'two of our three recommendations' is specific and verifiable with a denominator. Quote: 'two of our three recommendations' | Signal: outcome specificity with context — not a vague success claim | Reinforce: results with a ratio carry more credibility than results without one — you used this instinctively.",
        "Strategic decision under pressure — present: you considered extending the deadline and rejected it in favour of restructuring. Quote: 'I considered extending the deadline but decided that would just push the problem forward' | Signal: alternatives-considered pattern, associated with senior-level decision-making | Reinforce: naming an alternative rejected is a precision move most candidates do not make."
    ],
    weaknesses: [
        "Initial Action phase used group-level language | Observation: in your first delivery, the restructure was described as something 'we' did — your personal role was not separated until the probe asked directly. This is common among candidates with genuine collaborative experience, but it costs you in a solo-assessed interview. | Interview-standard version: 'I restructured the project schedule. I assigned individual ownership to each section and set up daily check-ins. The team then delivered against that structure.' — note: 'I restructured', not 'we restructured.' | Reinforce: the ownership language was available — it came out when asked — meaning this is a delivery habit, not a knowledge gap.",
        "Team response to leadership not yet articulated | Observation: you described the team's output but not how they responded to your approach. Interviewers look for evidence of influence on others, not just task completion. | Interview-standard version: 'After I introduced the daily check-ins, one team member told me it removed their uncertainty — they moved faster because they weren't second-guessing the plan.' | Reinforce: this is a one-sentence addition. You do not need to restructure your answer."
    ],
    actionableSuggestions: [
        "Moment: the transition from Situation to Action — the first 'I' statement after the situation has been established. | Insight: this is the highest-leverage sentence in the entire answer — interviewers are listening most carefully here. | Rewrite: 'I made the decision to restructure the entire project schedule. I moved us from shared ownership to individual accountability, with daily check-ins. That was my call, and I took personal responsibility for whether it worked.' | Reinforce: this rewrite does not change your story — it reframes the same facts in the language pattern that interview scoring criteria reward most heavily.",
        "Moment: the Result statement — 'the charity implemented two of our three recommendations'. | Insight: this is already strong — the ratio gives it credibility. The one addition that would maximise it is a reflection on what the outcome told you. | Rewrite: 'The charity implemented two of our three recommendations. For me, that confirmed that the restructure wasn't just about managing the deadline — it was about protecting the quality of the work under pressure.' | Reinforce: the reflection sentence signals self-awareness, which interviewers associate with high-potential candidates."
    ],
    starAnalysis: {
        situation: "Clearly established: final year university, group project, marketing module, three-week deadline, local charity client. Context is specific and credible.",
        task: "Well-defined: deliver a full campaign strategy within a fixed deadline against expectations from a genuine external client. Stakes are real.",
        action: "Partially strong in first delivery; complete after probing. Personal contributions named: restructuring the schedule, assigning individual ownership, daily check-ins, personal responsibility for risk assessment. Decision-making evidence (alternatives considered) surfaced under probing — the target for first-delivery improvement.",
        result: "Strong and verifiable: two of three recommendations implemented. Ratio format adds credibility. Missing: one sentence on what the outcome demonstrated about your approach."
    },
    keywordCoverage: {
        found: ["leadership", "deadline", "restructuring", "risk assessment", "team management", "accountability", "decision-making", "project delivery", "stakeholder", "outcome"],
        missing: ["conflict resolution", "cross-functional collaboration", "budget management", "strategic planning", "stakeholder communication"]
    },
    careerDevelopment: {
        certifications: [
            "CMI Level 3 Award in Leadership and Management — directly relevant; formalises your leadership instinct with an industry-recognised credential",
            "PRINCE2 Foundation — demonstrates structured project management thinking; complements the timeline restructure evidence in your answer"
        ],
        nextSteps: [
            "Practise front-loading personal ownership language: record your answer, identify every 'we', convert each to 'I decided / I chose / I took responsibility for', replay and compare",
            "Add team-response evidence to your leadership examples: for each key action, prepare one sentence about how a team member responded differently because of it",
            "Prepare a second leadership example from a non-university context — interviewers often follow up with 'can you give me another example' to test breadth"
        ]
    },
    rubrics: {
        starCompletion: 4,
        evidenceSpecificity: 4,
        roleClarity: 3,
        jdAlignment: 4,
        confidence: 4,
        justifications: {
            starCompletion: "Full STAR present after probing. Situation, Task, and Result complete in first delivery. Action phase improved significantly under probing — averaged across applicable question only.",
            evidenceSpecificity: "Strong specificity in Situation (three-week deadline, charity client), Action (restructured schedule, individual ownership, daily check-ins, personal risk assessment), and Result (two of three). Deducted one point: team-response evidence absent.",
            roleClarity: "Personal contribution partially obscured in initial delivery by group-level language. Post-probe ownership language is strong. Deducted two points: clarity required prompting rather than being present from the start.",
            jdAlignment: "Answer maps directly to leadership, project management, stakeholder delivery, and decision-making competencies required at graduate entry level.",
            confidence: "Delivery was direct and structured. Hedging language minimal. Filler words low frequency. Sentence completion rate high. KNN/SVR proxy: 4/5."
        }
    },
    maskedTranscript: { text: "During my [TIMEFRAME] at [INSTITUTION], I was leading a group project for our [MODULE]. We had [DURATION] to deliver a campaign strategy for a [CLIENT TYPE]. I noticed early on that our timeline wasn't realistic..." },
    meritVectors: {
        personalAgency: { score: 74, evidenceBasis: "Explicit 'I personally took on' language present post-probe; initial delivery used group language" },
        skillSpecificity: { score: 71, evidenceBasis: "Named specific actions: schedule restructure, accountability assignment, daily check-ins, risk assessment" },
        impactArticulation: { score: 52, evidenceBasis: "Result stated with ratio, but team-level impact of leadership not yet articulated" },
        lowestVector: 'impactArticulation',
        primarySuggestionAnchor: "Add one sentence describing how the team responded to your restructure — this closes the impact articulation gap and completes the leadership narrative"
    },
    professionalSelfVerificationSignals: {
        voice: { score: 62, orientation: 'balanced', evidenceBasis: "Balanced between prepared narrative and genuine reflection" },
        motivation: { score: 68, orientation: 'self_verifying', evidenceBasis: "Motivational language suggests genuine satisfaction rather than performed enthusiasm" },
        explanation: { score: 58, orientation: 'balanced', evidenceBasis: "Explanation of decision-making includes genuinely specific detail" },
        dominantMode: 'mixed',
        fitSignal: "Candidate presents as genuinely motivated by impact-oriented work, consistent with a role where output quality is tied to external stakeholder outcomes.",
        feedbackImplication: "Feedback should lead with evidence from their answer, not general principles — this candidate responds well to specific anchoring.",
        researchNote: "Cable & Kay (2012) — mixed mode suggests candidate is engaging authentically with prepared material."
    },
    algorithmicAversionSignal: { aversionDetected: false, aversionEvidence: null, feedbackImplication: "No aversion signal detected. Candidate engaged directly with structured follow-up questions without resistance." },
    socialIdentityAwareness: { activated: false, valueExpressionScore: 62, socialRecognitionScore: 55, dominantMotivation: 'value_expression', scopeNote: "Mild value-expression motivation — emphasis on genuine charity impact suggests values-aligned framing." },
    chcCognitiveDimensions: {
        abstractConceptualisation: { score: 58, evidenceBasis: "Candidate named the decision principle when prompted — present but not spontaneously deployed", validityDisclaimer: "Inferential only — not a validated psychometric measure" },
        activeExperimentation: { score: 74, evidenceBasis: "Strong adaptation under probing — introduced new material and considered alternatives when asked", validityDisclaimer: "Inferential only — not a validated psychometric measure" },
        concreteExperience: { score: 71, evidenceBasis: "Outcome stated with verifiable specificity (two of three). Timeline detail shows concrete grounding", validityDisclaimer: "Inferential only — not a validated psychometric measure" },
        overallELCNote: "Candidate's Kolb profile: strongest in Active Experimentation (AE). Abstract Conceptualisation (AC) is the growth area — they have the principle but do not yet name it spontaneously.",
        researchNote: "Kolb (1984) — ELC signal derived from within-session trajectory, not validated as a psychometric profile."
    },
    scaffoldedLearningSignal: {
        zpdProgressionObservation: "Unprobed response showed partial Action phase — correct content, group-level framing. One probe moved candidate to explicit personal ownership language, indicating ZPD upper boundary is accessible and close.",
        scaffoldDependency: { score: 42, interpretation: 'independent', researchNote: "Wood et al. (1976) — score below 50 indicates candidate can perform near upper boundary with minimal scaffolding." },
        zoneOfProximalDevelopmentEstimate: {
            lowerBoundary: "Can deliver full STAR with outcome specificity when context is familiar and the question is direct",
            upperBoundary: "Can articulate personal decision-making with alternatives considered and front-load ownership language in first delivery without prompting",
            developmentGap: "The gap is delivery automaticity — candidate has the content but requires a prompt to access ownership framing",
            practiceRecommendation: "Deliberate practice on the ownership phrase trigger: record the answer, identify every 'we' in the Action phase, convert each to 'I decided / I chose', replay until the 'I' framing comes first spontaneously"
        },
        phasingEffectiveness: { phase1Score: 62, phase2Score: 81, phase3Score: null, trajectory: 'improving' }
    },
    psychologicalSafetyScore: {
        score: 88,
        checklist: { taskLevelOnly: true, noDemotivatorsUsed: true, rationalePresent: true, atLeastFiveSuggestions: true, strengthsFirst: true, warmTone: true }
    },
    biasAndFairnessNote: "No demographic or identity-related bias signals detected. Feedback anchored exclusively to task-level evidence — specific transcript phrases and observable structural choices.",
    transcriptAnnotations: [
        {
            moment: "When describing the timeline problem, you said: 'I noticed early on that our timeline wasn't realistic'",
            observation: "This phrase establishes proactive identification — not reactive management. 'Early' is doing significant work here. The development area: 'realistic' is a vague qualifier that does not tell the interviewer what specifically was wrong with the plan.",
            standardVersion: "I identified early that our original schedule assumed consistent daily output across all sections, which wasn't achievable given two team members' part-time commitments. I flagged this in the first week rather than waiting for a delivery failure.",
            principle: "Specificity in problem identification signals diagnostic competence — interviewers distinguish between candidates who notice problems and candidates who can name exactly what the problem is."
        },
        {
            moment: "When describing your action, you said: 'I restructured the schedule, assigned clearer ownership to each section'",
            observation: "Strong personal ownership language — 'I restructured' not 'we restructured.' This is exactly the framing interviewers reward. The limitation: 'clearer ownership' is still abstract — what did individual ownership mean operationally?",
            standardVersion: "I restructured the schedule by converting from shared responsibility to individual ownership: each team member owned one deliverable with a named deadline, and I held the cross-section dependency map. If one section slipped, I caught it before it cascaded.",
            principle: "Describing the mechanism of your action (not just the action itself) demonstrates leadership competence at the process level, not just the decision level."
        },
        {
            moment: "When stating the result, you said: 'the charity actually implemented two of our three recommendations'",
            observation: "This is your strongest sentence. 'Actually' signals genuine surprise and authentic pride — it reads as unscripted. The ratio (two of three) gives the result immediate credibility. The development: no reflection on what this told you about your approach.",
            standardVersion: "The charity implemented two of our three recommendations — the social media strategy and the community outreach plan. For me, that confirmed that the restructure wasn't just about managing the deadline — it was about protecting the quality of the work under pressure.",
            principle: "A result statement followed by a one-sentence reflection demonstrates self-awareness — the quality most associated with high-potential candidates in graduate-level interviews."
        }
    ],
    cvMissedOpportunities: [
        {
            cvItem: "Student Ambassador Programme — managed events for 200+ attendees across two academic years",
            questionContext: "When asked about the impact of your leadership on others, you described the team's output but did not mention your track record of managing stakeholder-facing events. This was directly relevant.",
            whyItFits: "The leadership question probed for evidence of leading under stakeholder scrutiny. Your Ambassador role involves exactly this — managing expectations, coordinating logistics, and delivering in front of an external audience. It would have reinforced your leadership claim with a second example without requiring a separate answer.",
            exampleUsage: "You already have this — here is how to deploy it: 'This wasn't my first time leading in a stakeholder-facing context — as a Student Ambassador I coordinated events for over two hundred people, which built exactly the pressure-management instinct I used in the charity project.'"
        }
    ],
    intentionAssessment: "Your pre-session goal was to practise articulating personal contribution more clearly in behavioural questions. Your session showed improvement in this area under probing — the ownership language emerged when asked. The next milestone: deploy it in the first delivery without a prompt.",
    elcLearningCycle: {
        concreteExperienceBaseline: "You arrived with a real and relevant experience — a genuine deadline, an external client, and team pressure that was authentic. The content of your experience is strong.",
        reflectiveObservationInsight: "The session revealed that your personal decision-making is more deliberate than your first answer suggested — you had considered alternatives and made an active choice. That reasoning was not visible until probing unlocked it.",
        abstractPrinciple: "The transferable principle: your instinct to restructure accountability before execution is a leadership pattern, not a project management one — it applies in any context where ambiguity is creating delivery risk.",
        experimentationTarget: "Between now and your next session: deliver this answer to someone you know and ask them to name the specific decision you made. If they cannot name it after one hearing, your Action phrase is not yet clear enough."
    },
    amoPerformanceContext: "No significant AMO barriers detected. Your answer demonstrated both ability and motivation. The opportunity gap was partially addressed by the probe — your next session should target making that clarity self-generated.",
    feedbackApproachLevel: 'Established'
};

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
    email?: string;
}

const AscendPlatform: React.FC<AscendPlatformProps> = ({ logEvent, onExit, email = '' }) => {
    const {
        videoEnabled,
        setVideoEnabled,
        dyslexiaFont,
        timerDisplay,
        liveTools,
        activeQuestions: rawActiveQuestions,
        cvText,
        companyName,
        targetRole,
        jobDescription,
        timerFramingCondition,
        participantId,
        condition,
        isTourActive,
        tourStep,
        persistedAuditResult,
        questionsFinalized,
        jdcvAlignmentAnalysis,
        candidateProfile,
        preSessionAnswer,
        mesoAccumulator,
        saveMesoAccumulator,
        computeMesoDelta,
        deriveUpdatedCandidateProfile,
    } = useSettings();

    const effectiveCandidateProfile = React.useMemo(() => {
        const patch = deriveUpdatedCandidateProfile();
        return patch ? { ...candidateProfile, ...patch } : candidateProfile;
    }, [candidateProfile, mesoAccumulator]);
    const [starPhase, setStarPhase] = useState(0);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [recordingStatus, setRecordingStatus] = useState<RecordingStatus>('idle');

    const [transcript, setTranscript] = useState<string>("");
    const lastPhaseTranscriptLength = useRef<number>(0);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);

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
    const [probeHistory, setProbeHistory] = useState<string[]>([]);

    // Learning Intention — pre-session goal set by student (criterion-referenced assessment)
    const [learningIntention, setLearningIntention] = useState<string>('');
    // Self-Assessment — per-question drafts and submitted responses (Boud & Molloy 2013)
    const [selfAssessmentDrafts, setSelfAssessmentDrafts] = useState<Record<number, string>>({});
    const [selfAssessmentResponses, setSelfAssessmentResponses] = useState<Record<number, string>>({});

    // Session Log Accumulator
    const [sessionLog, setSessionLog] = useState<SessionEntry[]>([]);
    const [reportModalEntry, setReportModalEntry] = useState<SessionEntry | null>(null);
    const [questionReportEntry, setQuestionReportEntry] = useState<SessionEntry | null>(null);

    // Detailed Feedback State
    const [detailedFeedback, setDetailedFeedback] = useState<DetailedFeedback | null>(null);
    const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);
    const [activeTab, setActiveTab] = useState<ToolkitTab>('plan');
    const [lastQuestionCompleted, setLastQuestionCompleted] = useState(false);
    const [waitingForMoreQuestions, setWaitingForMoreQuestions] = useState(false);
    const researcherMode = React.useMemo(() => new URLSearchParams(window.location.search).get('researcher') === 'true', []);
    const demoMode = React.useMemo(() => new URLSearchParams(window.location.search).get('demo') === 'true', []);
    const previewMode = React.useMemo(() => new URLSearchParams(window.location.search).get('preview') === 'true', []);

    // Mic test state — for audio verification without a full interview
    const [micTestState, setMicTestState] = useState<'idle' | 'recording' | 'done' | 'error'>('idle');
    const [micTestResult, setMicTestResult] = useState<string>('');
    const [reportFormat, setReportFormat] = useState<'narrative' | 'visual' | 'digest' | 'focus'>('narrative');
    const [focusSection, setFocusSection] = useState<'star' | 'feedback' | 'coaching' | 'insights' | 'cv' | 'practice'>('star');

    // Human-oversight flag mechanism (GDPR Article 22 / EU AI Act) — backend/routes/flags.ts
    const [backendSessionId, setBackendSessionId] = useState<string | null>(null);
    const [showFlagModal, setShowFlagModal] = useState(false);
    const [flagSection, setFlagSection] = useState('overall');
    const [flagNote, setFlagNote] = useState('');
    const [flagSubmitting, setFlagSubmitting] = useState(false);
    const [flagResult, setFlagResult] = useState<string | null>(null);
    const [primingDone, setPrimingDone] = useState(() =>
        new URLSearchParams(window.location.search).get('preview') === 'true'
    );
    const [primingFocus, setPrimingFocus] = useState<string | null>(null);
    const [primingCustom, setPrimingCustom] = useState('');
    const [selfRatingDone, setSelfRatingDone] = useState(() =>
        new URLSearchParams(window.location.search).get('preview') === 'true'
    );
    const [selfRating, setSelfRating] = useState<Record<string, 'strong' | 'partial' | 'struggled' | null>>({
        situation: null, task: null, action: null, result: null,
    });
    const [reflectionDone, setReflectionDone] = useState(() =>
        new URLSearchParams(window.location.search).get('preview') === 'true'
    );
    const [reflectionText, setReflectionText] = useState('');
    const [practiceDate, setPracticeDate] = useState('');

    // ── Cross-session history (keyed by email) ────────────────────────────
    type SessionSnapshot = {
        date: string;
        starScores: [number|null, number|null, number|null, number|null];
        priority: string;
        strength: string;
        weakness: string;
    };
    const sessionKey = email.trim().toLowerCase()
        ? `ascend_sessions_${email.trim().toLowerCase()}`
        : null;
    const [sessionHistory, setSessionHistory] = useState<SessionSnapshot[]>(() => {
        if (!sessionKey) return [];
        try { return JSON.parse(localStorage.getItem(sessionKey) ?? '[]'); }
        catch { return []; }
    });
    const prevSession = sessionHistory[sessionHistory.length - 1] ?? null;

    // On mount: fetch the latest snapshot from the backend as a cross-device fallback.
    // If localStorage is already populated (same device), we keep those entries.
    // If localStorage is empty (new device, same email), backend fills the gap.
    useEffect(() => {
        const emailKey = email.trim().toLowerCase();
        if (!emailKey) return;
        fetch(`/api/snapshots/${encodeURIComponent(emailKey)}`)
            .then(r => (r.ok ? r.json() : null))
            .then((data: { snapshot: SessionSnapshot } | null) => {
                if (!data?.snapshot) return;
                setSessionHistory(prev => {
                    if (prev.length > 0) return prev; // localStorage already has history — trust it
                    return [data.snapshot];
                });
            })
            .catch(() => {}); // backend unavailable — localStorage-only fallback is fine
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Demo mode: one question per type for fast testing
    const activeQuestions = React.useMemo(() => {
        if (!demoMode) return rawActiveQuestions;
        const seen = new Set<string>();
        return rawActiveQuestions.filter(q => {
            const type = q.questionType ?? 'behavioural';
            if (seen.has(type)) return false;
            seen.add(type);
            return true;
        });
    }, [rawActiveQuestions, demoMode]);

    const waitingAtLength = useRef(0);
    const reflectiveBreakShown = useRef(false); // ensure break only shows once per session

    const STAR_LABELS = ['Situation', 'Task', 'Action', 'Result'];
    const CATEGORIES = [
        'Introductory Alignment',
        'Foundational Behavioral',
        'Role-Specific Domain',
        'Complex Scenario Analysis',
        'Strategic High-Stakes'
    ];

    useEffect(() => {
        logEvent('session_start', {
            mode: 'interview',
            timerDisplay,
            timerFramingCondition,
            preSessionAnswer,
            liveTools: {
                keywordPathfinder: liveTools.keywordPathfinder,
                fillerWordCounter: liveTools.fillerWordCounter,
                questionChecklist: liveTools.questionChecklist,
            },
            dyslexiaFont,
            videoEnabled,
        });
        phaseStartTimestamp.current = Date.now();
    }, []);

    // Save session snapshot to localStorage + backend once report is ready
    useEffect(() => {
        if (recordingStatus !== 'uploaded' || !detailedFeedback || !sessionKey) return;
        const snapshot: SessionSnapshot = {
            date: new Date().toLocaleDateString(),
            starScores: candidateStarCompletion,
            priority: detailedFeedback.hiringProfileAlignment?.priorityFix
                ?? detailedFeedback.meritVectors?.primarySuggestionAnchor
                ?? detailedFeedback.actionableSuggestions?.[0]
                ?? '',
            strength: (detailedFeedback.strengths?.[0] ?? '').split('|')[0].trim(),
            weakness: (detailedFeedback.weaknesses?.[0] ?? '').split('|')[0].trim(),
        };
        setSessionHistory(prev => {
            const updated = [...prev, snapshot];
            try { localStorage.setItem(sessionKey, JSON.stringify(updated)); } catch {}
            return updated;
        });
        // Mirror to backend so returning participants are recognised on any device
        const emailKey = email.trim().toLowerCase();
        if (emailKey) {
            fetch('/api/snapshots', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ emailKey, snapshot }),
            }).catch(() => {}); // non-fatal — localStorage write already succeeded
        }
    }, [recordingStatus, detailedFeedback, sessionKey]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (recordingStatus === 'uploaded' && detailedFeedback) {
            logEvent('feedback_report_opened', { hasLayerB: !!detailedFeedback.meritVectors });
        }
    }, [recordingStatus, detailedFeedback]);

    // Preview mode: pre-populate with sample data so the full report/feedback UI is visible without completing an interview
    useEffect(() => {
        if (!previewMode) return;
        setSessionLog(PREVIEW_SESSION_LOG);
        setDetailedFeedback(PREVIEW_DETAILED_FEEDBACK);
        setRecordingStatus('uploaded');
        setActiveTab('report');
    }, [previewMode]);

    // Candidate's actual STAR completion % per component — averaged across all session questions
    const candidateStarCompletion = React.useMemo(() => {
        const comps = ['situation', 'task', 'action', 'result'] as const;
        const buckets: Record<string, number[]> = { situation: [], task: [], action: [], result: [] };
        sessionLog.forEach(e => {
            const st = e.probeAnalysis?.star_status;
            if (!st) return;
            comps.forEach(c => {
                if (st[c] === 'complete') buckets[c].push(100);
                else if (st[c] === 'partial') buckets[c].push(50);
                else if (st[c] === 'missing') buckets[c].push(0);
                // 'not_yet_required' excluded
            });
        });
        return comps.map(c => {
            const arr = buckets[c];
            return arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
        }) as [number | null, number | null, number | null, number | null];
    }, [sessionLog]);

    const handleMicTest = React.useCallback(async () => {
        setMicTestState('recording');
        setMicTestResult('');
        try {
            const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(micStream);
            const chunks: Blob[] = [];
            recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
            recorder.onstop = async () => {
                micStream.getTracks().forEach(t => t.stop());
                try {
                    const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
                    const buffer = await blob.arrayBuffer();
                    const bytes = new Uint8Array(buffer);
                    let binary = '';
                    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
                    const base64 = btoa(binary);
                    const r = await generateContent({
                        model: 'gemini-2.0-flash',
                        contents: [{ parts: [
                            { text: 'Transcribe this audio recording exactly as spoken. If the audio is silent or inaudible, say so clearly.' },
                            { inlineData: { mimeType: blob.type || 'audio/webm', data: base64 } }
                        ]}]
                    });
                    setMicTestResult(r.text || '(no transcription returned)');
                    setMicTestState('done');
                } catch (err) {
                    setMicTestResult(`Transcription failed: ${err instanceof Error ? err.message : String(err)}`);
                    setMicTestState('error');
                }
            };
            recorder.start();
            setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, 5000);
        } catch (err) {
            setMicTestResult(`Microphone access failed: ${err instanceof Error ? err.message : String(err)}`);
            setMicTestState('error');
        }
    }, []);

    // When new questions arrive while waiting mid-session, auto-advance to the next question
    useEffect(() => {
        if (!waitingForMoreQuestions) return;
        if (activeQuestions.length > waitingAtLength.current) {
            setWaitingForMoreQuestions(false);
            setCurrentQuestionIndex(prev => prev + 1);
            setStarPhase(0);
            setSessionSeconds(0);
            setTranscript("");
            lastPhaseTranscriptLength.current = 0;
            phaseStartTimestamp.current = Date.now();
            setIsProbingActive(false);
            setCurrentProbe(null);
            setProbeAnalysis(null);
            setProbingTranscript("");
            setIsGeneratingProbe(false);
            setProbeHistory([]);
            setActiveTab('plan');
            setReassuringMessage("Your next question is ready. Stay focused.");
        } else if (questionsFinalized) {
            // API is done but returned no new questions — this was truly the last question
            // Dismiss the break and let the user finish
            setWaitingForMoreQuestions(false);
        }
    }, [activeQuestions.length, waitingForMoreQuestions, questionsFinalized]);

    // Minimum 10s break — if questions already ready, auto-advance after 10s for consistency
    useEffect(() => {
        if (!waitingForMoreQuestions || !questionsFinalized) return;
        const timer = setTimeout(() => {
            setWaitingForMoreQuestions(false);
            setCurrentQuestionIndex(prev => prev + 1);
            setStarPhase(0);
            setSessionSeconds(0);
            setTranscript("");
            lastPhaseTranscriptLength.current = 0;
            phaseStartTimestamp.current = Date.now();
            setIsProbingActive(false);
            setCurrentProbe(null);
            setProbeAnalysis(null);
            setProbingTranscript("");
            setIsGeneratingProbe(false);
            setProbeHistory([]);
            setActiveTab('plan');
            setReassuringMessage("Your personalised questions are ready. Stay focused.");
        }, 10000);
        return () => clearTimeout(timer);
    }, [waitingForMoreQuestions, questionsFinalized]);

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
                setReassuringMessage("");
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

    const encodeWAV = (samples: Float32Array, sampleRate: number): ArrayBuffer => {
        const buffer = new ArrayBuffer(44 + samples.length * 2);
        const view = new DataView(buffer);
        const write = (offset: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i)); };
        write(0, 'RIFF'); view.setUint32(4, 36 + samples.length * 2, true);
        write(8, 'WAVE'); write(12, 'fmt '); view.setUint32(16, 16, true);
        view.setUint16(20, 1, true); view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true); view.setUint16(34, 16, true);
        write(36, 'data'); view.setUint32(40, samples.length * 2, true);
        let off = 44;
        for (let i = 0; i < samples.length; i++, off += 2) {
            const s = Math.max(-1, Math.min(1, samples[i]));
            view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }
        return buffer;
    };

    const startTranscription = (mediaStream: MediaStream) => {
        setTranscriptionError(null);
        const sampleRate = 16000;
        const chunkSamples = sampleRate * 4; // 4-second chunks

        let ctx: AudioContext;
        try {
            ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate });
        } catch (err: any) {
            setTranscriptionError(`AudioContext failed: ${err?.message || err}`);
            return;
        }

        const source = ctx.createMediaStreamSource(mediaStream);
        const processor = ctx.createScriptProcessor(4096, 1, 1);

        let accumulated: Float32Array[] = [];
        let accumulatedLen = 0;

        const sendChunk = async (samples: Float32Array) => {
            try {
                const wav = encodeWAV(samples, sampleRate);
                const bytes = new Uint8Array(wav);
                let binary = '';
                for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
                const response = await generateContent({
                    model: 'gemini-3-flash-preview',
                    contents: [{ role: 'user', parts: [
                        { inlineData: { data: btoa(binary), mimeType: 'audio/wav' } },
                        { text: 'Transcribe the speech in this audio exactly as spoken. Return only the words, nothing else. If there is no speech, return nothing.' }
                    ]}]
                });
                const text = response.text?.trim();
                if (text) setTranscript(prev => prev + (prev ? ' ' : '') + text);
            } catch (err: any) {
                const msg = err?.message || String(err);
                console.error('Transcription chunk failed:', msg);
                setTranscriptionError(msg);
            }
        };

        processor.onaudioprocess = (e: AudioProcessingEvent) => {
            const input = e.inputBuffer.getChannelData(0);
            accumulated.push(new Float32Array(input));
            accumulatedLen += input.length;
            if (accumulatedLen >= chunkSamples) {
                const combined = new Float32Array(accumulatedLen);
                let off = 0;
                for (const buf of accumulated) { combined.set(buf, off); off += buf.length; }
                accumulated = [];
                accumulatedLen = 0;
                sendChunk(combined);
            }
        };

        const silentGain = ctx.createGain();
        silentGain.gain.value = 0;
        source.connect(processor);
        processor.connect(silentGain);
        silentGain.connect(ctx.destination);

        audioContextRef.current = ctx;
        setIsTranscribing(true);
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
            if (audioContextRef.current) {
                audioContextRef.current.close().catch(() => {});
                audioContextRef.current = null;
            }
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
                currentQuestion: { text: currentQuestion.text, type: 'interview', difficulty: currentQuestion.difficulty, competency: currentQuestion.competency, excellenceBenchmark: currentQuestion.excellenceBenchmark, discriminantSignals: currentQuestion.discriminantSignals },
                sessionPhaseIndex: currentQuestionIndex,
                questionsAnsweredCount: currentQuestionIndex,
                priorProbesThisQuestion: probeHistory.join(' | '),
                candidateAnswer: transcript.slice(lastPhaseTranscriptLength.current),
                conversationHistory: transcript.slice(-500),
                candidateProfile: effectiveCandidateProfile,
                mesoAccumulator,
            });
            setCurrentProbe(probe);
            setProbeHistory(prev => [...prev, probe.probe]);
            logEvent('probe_used', { questionIndex: currentQuestionIndex, starPhase, probeType: probe.probe_type });
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
        if (isGeneratingFeedback) return; // guard double-click
        if (recordingStatus === 'recording') await handleRecord();

        // If last question insight already shown — Finish Session click goes straight to report
        const isLastQ = currentQuestionIndex >= activeQuestions.length - 1;
        if (isLastQ && lastQuestionCompleted) {
            setReassuringMessage("Taking you to your final report...");
            await new Promise(r => setTimeout(r, 400));
            setRecordingStatus('uploaded');
            return;
        }

        const newSegment = transcript.slice(lastPhaseTranscriptLength.current).trim();

        const generateAndLog = async (isFinal = false) => {
            setIsGeneratingProbe(true);
            let summaryReport: QuestionSummaryReport | null = null;
            let act1Analysis: any = null;
            if (transcript.trim().length >= 20) {
                try {
                    // Run Act 1 lower-boundary analysis in parallel with question summary
                    // act1Analysis = ZPD lower boundary (Vygotsky 1978): what candidate can do independently
                    // probeAnalysis = ZPD upper boundary: what candidate can do with structured support
                    const [act1Result, generatedSummary] = await Promise.all([
                        analyzeProbeResponse({
                            targetRole, companyName,
                            question: currentQuestion.text,
                            response: transcript,
                            scaffoldPhase: 1,
                        }).then(a => ({ ...a, zpd_boundary_type: 'act_one' as const })).catch(() => null),
                        generateQuestionSummary({
                            accumulator: {
                                questionId: currentQuestion.text,
                                transcript: transcript,
                                phaseAnalyses: [],
                                probeAnalyses: probeAnalysis ? [{ ...probeAnalysis, zpd_boundary_type: 'probed' as const }] : [],
                                timerFramingCondition: (timerFramingCondition as TimerFramingCondition) || 'elapsed',
                                responseDurations: {
                                    actOne: Math.round((Date.now() - phaseStartTimestamp.current) / 1000),
                                    probes: [],
                                },
                            },
                            targetRole,
                            companyName,
                            cvSummary: cvText || undefined,
                            jobDescription: jobDescription || undefined,
                        }),
                    ]);
                    act1Analysis = act1Result;
                    summaryReport = generatedSummary;
                } catch (err) {
                    console.error('Failed to generate question summary:', err);
                }
            }

            setSessionLog(prev => [...prev, {
                questionIndex: currentQuestionIndex,
                questionText: currentQuestion.text,
                starPhaseReached: starPhase,
                transcriptSlice: transcript,
                probe: currentProbe,
                probeAnalysis: probeAnalysis,
                act1Analysis: act1Analysis,   // ZPD lower boundary — unprobed performance (Vygotsky 1978)
                summaryReport: summaryReport,
            }]);

            const starMap = (v: string | undefined) =>
                v === 'complete' ? 100 : v === 'partial' ? 50 : v === 'missing' ? 0 : null;
            const st = probeAnalysis?.star_status;
            logEvent('question_answered', {
                questionIndex: currentQuestionIndex,
                questionType: currentQuestion.questionType ?? 'behavioural',
                probeUsed: !!probeAnalysis,
                depthDelta: probeAnalysis?.depth_delta ?? null,
                starSituation: starMap(st?.situation),
                starTask:      starMap(st?.task),
                starAction:    starMap(st?.action),
                starResult:    starMap(st?.result),
                // Spoken response — linked only to anonymous participant ID, never to email.
                // Basic scrub removes email addresses and phone numbers before storage.
                responseText: newSegment
                    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[EMAIL]')
                    .replace(/(\+?\d[\d\s\-().]{7,}\d)/g, '[PHONE]')
                    .trim() || null,
            });

            if (isFinal) {
                setReassuringMessage("Thank you for your patience, we are redirecting you to the final feedback report. Thanks for taking your time out to practice with Ascend.");
                // Ensure state is settled
                await new Promise(r => setTimeout(r, 500));
                setIsGeneratingFeedback(true);
                setRecordingStatus('uploaded');
                await handleGenerateFinalFeedback();
            } else {
                // After Q10 (index 9) — always show reflective break before advancing
                if (currentQuestionIndex === 9 && !reflectiveBreakShown.current) {
                    reflectiveBreakShown.current = true;
                    waitingAtLength.current = activeQuestions.length;
                    setWaitingForMoreQuestions(true);
                    // The break effect handles auto-advance after 10s or when questions arrive
                } else {
                    setActiveTab('plan');
                    setReassuringMessage("The next question is on its way. Be focused, Be ready");
                    setCurrentQuestionIndex(prev => prev + 1);
                    setStarPhase(0);
                    setSessionSeconds(0);
                    setTranscript("");
                    lastPhaseTranscriptLength.current = 0;
                    phaseStartTimestamp.current = Date.now();
                    setIsProbingActive(false);
                    setCurrentProbe(null);
                    setProbeAnalysis(null);
                    setProbingTranscript("");
                    setIsGeneratingProbe(false);
                    setProbeHistory([]);
                }
            }
        };

        // Handle Probing Answer
        if (isProbingActive) {
            // Insights already exist — candidate explicitly chose to advance, respect it
            if (probeAnalysis) {
                setCurrentProbe(null);
                setIsGeneratingProbe(false);
                setReassuringMessage("The next question is on its way. Be focused, Be ready");
                setActiveTab('plan');
                await generateAndLog(currentQuestionIndex >= activeQuestions.length - 1);
                return;
            }

            if (newSegment.length < 15) {
                // Politely nudge for empty transcript
                setActiveTab('plan');
                setReassuringMessage("The next question is on its way. Be focused, Be ready");

                // Allow the state update to render before the blocking alert
                alert("We couldn't catch that response! Please ensure your mic is active and you've provided a follow-up answer. We'll move to the next question for now.");

                await generateAndLog(currentQuestionIndex >= activeQuestions.length - 1);
                return;
            }

            // Valid response — analyze once for insights then always advance
            // Iterative probing only happens via the Deep Probe button
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

                // Always advance — candidate chose to move on
                setCurrentProbe(null);
                setIsGeneratingProbe(false);
                setReassuringMessage("The next question is on its way. Be focused, Be ready");
                setActiveTab('plan');
                await generateAndLog(currentQuestionIndex >= activeQuestions.length - 1);
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
            const isLastQuestion = currentQuestionIndex >= activeQuestions.length - 1;
            if (isLastQuestion) {
                // If more questions are still being generated, log this question then pause
                if (!questionsFinalized) {
                    waitingAtLength.current = activeQuestions.length;
                    lastPhaseTranscriptLength.current = transcript.length;
                    setSessionLog(prev => [...prev, {
                        questionIndex: currentQuestionIndex,
                        questionText: currentQuestion.text,
                        starPhaseReached: starPhase,
                        transcriptSlice: transcript,
                        probe: currentProbe,
                        probeAnalysis: probeAnalysis,
                        summaryReport: null,
                    }]);
                    setWaitingForMoreQuestions(true);
                    return;
                }

                // Truly the last question — show reassuring message, generate insight, switch to Insights
                // NEVER advance question index or generate a new question here
                if (!lastQuestionCompleted && !isGeneratingFeedback) {
                    setReassuringMessage("You have completed your final question. We are now analysing your last response and compiling your full session report. This may take a moment — your effort and thought are worth the wait.");
                    lastPhaseTranscriptLength.current = transcript.length;

                    // Generate per-question summary inline (without calling generateAndLog which would advance the index)
                    setIsGeneratingProbe(true);
                    let summaryReport: QuestionSummaryReport | null = null;
                    if (transcript.trim().length >= 20) {
                        try {
                            summaryReport = await generateQuestionSummary({
                                accumulator: {
                                    questionId: currentQuestion.text,
                                    transcript: transcript,
                                    phaseAnalyses: [],
                                    probeAnalyses: probeAnalysis ? [{ ...probeAnalysis, zpd_boundary_type: 'probed' as const }] : [],
                                    timerFramingCondition: (timerFramingCondition as TimerFramingCondition) || 'elapsed',
                                    responseDurations: {
                                        actOne: Math.round((Date.now() - phaseStartTimestamp.current) / 1000),
                                        probes: [],
                                    },
                                },
                                targetRole,
                                companyName,
                                cvSummary: cvText || undefined,
                                jobDescription: jobDescription || undefined,
                            });
                        } catch (err) {
                            console.error('Failed to generate last question summary:', err);
                        }
                    }
                    setIsGeneratingProbe(false);

                    setSessionLog(prev => [...prev, {
                        questionIndex: currentQuestionIndex,
                        questionText: currentQuestion.text,
                        starPhaseReached: starPhase,
                        transcriptSlice: transcript,
                        probe: currentProbe,
                        probeAnalysis: probeAnalysis,
                        summaryReport: summaryReport,
                    }]);

                    // Show the last question insight
                    setActiveTab('report');

                    // Start final report silently in background — user clicks Finish Session to navigate to it
                    handleGenerateFinalFeedback();

                    setLastQuestionCompleted(true);
                }
            } else if (decisionCountdown === 0) {
                setDecisionCountdown(3);
                triggerProbing();
                lastPhaseTranscriptLength.current = transcript.length;
            }
        }
    };

    const handleNextQuestion = async () => {
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
            setTranscript("");
            lastPhaseTranscriptLength.current = 0;
            phaseStartTimestamp.current = Date.now();
            // Reset probing state
            setIsProbingActive(false);
            setCurrentProbe(null);
            setProbeAnalysis(null);
            setProbingTranscript("");
            setActiveTab('plan');
            setIsGeneratingProbe(false);
            setProbeHistory([]);
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
            setProbeHistory([]);
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
                    confidence: 0,
                    justifications: {
                        starCompletion: "No data available",
                        evidenceSpecificity: "No data available",
                        roleClarity: "No data available",
                        jdAlignment: "No data available",
                        confidence: "No data available"
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
            setIsGeneratingFeedback(false); // ensure spinner clears when skipping the API call
            return;
        }

        setIsGeneratingFeedback(true);
        try {
            // ── Compute session CDL profile for level-differentiated feedback ──
            const cdlCounts = { Emerging: 0, Developing: 0, Established: 0, Advanced: 0 };
            sessionLog.forEach(e => {
                const lvl = e.summaryReport?.competencyDemonstrationLevel;
                if (lvl && lvl in cdlCounts) cdlCounts[lvl as keyof typeof cdlCounts]++;
            });
            const totalWithCDL = Object.values(cdlCounts).reduce((a, b) => a + b, 0);
            const modalCDLEntry = totalWithCDL > 0
                ? Object.entries(cdlCounts).sort((a, b) => b[1] - a[1])[0]
                : null;
            const sessionCDLProfile = totalWithCDL > 0 && modalCDLEntry ? {
                modalLevel: modalCDLEntry[0] as 'Emerging' | 'Developing' | 'Established' | 'Advanced',
                levelCounts: cdlCounts,
                totalQuestions: sessionLog.length,
            } : null;

            const feedback = await generateDetailedFeedback({
                transcript,
                jobRequirements: activeQuestions.map(q => q.text).join("\n"),
                cvText,
                probeAnalysis: probeAnalysis ? JSON.stringify(probeAnalysis) : undefined,
                targetRole,
                companyName,
                condition,
                phaseProgression: `${currentQuestionIndex + 1} of ${activeQuestions.length} questions completed`,
                candidateProfile: effectiveCandidateProfile,
                mesoAccumulator,
                sessionCDLProfile,
                learningIntention: learningIntention.trim() || null,
            });
            setDetailedFeedback(feedback);
            // ── Wire cross-session ELC tracking: build SessionRecord from this session ──
            const scoreToLevel = (s: number): CompetencyDemonstrationLevel =>
              s >= 5 ? 'Advanced' : s >= 4 ? 'Established' : s >= 3 ? 'Developing' : 'Emerging';
            const LEVEL_ORDER: CompetencyDemonstrationLevel[] = ['Emerging', 'Developing', 'Established', 'Advanced'];
            const averageLevel = (levels: CompetencyDemonstrationLevel[]): CompetencyDemonstrationLevel | null => {
              if (levels.length === 0) return null;
              const meanIndex = levels.reduce((sum, l) => sum + LEVEL_ORDER.indexOf(l), 0) / levels.length;
              return LEVEL_ORDER[Math.round(meanIndex)];
            };
            // ZPD dual boundary (Vygotsky 1978): Act 1 (unprobed) = lower boundary, post-probe = upper boundary
            const lowerBoundaryLevel = averageLevel(
              sessionLog.map(e => e.act1Analysis?.competency_demonstration_level).filter((l): l is CompetencyDemonstrationLevel => !!l)
            );
            const upperBoundaryLevel = averageLevel(
              sessionLog.map(e => e.probeAnalysis?.competency_demonstration_level).filter((l): l is CompetencyDemonstrationLevel => !!l)
            );
            const mt = feedback.masteryTracker;
            const starReached: MasteryComponent[] = mt
              ? (['situation', 'task', 'action', 'result'] as MasteryComponent[]).filter(c => mt[c]?.status === 'reached')
              : (['situation', 'task', 'action', 'result'] as MasteryComponent[]).slice(0, Math.min(feedback.rubrics?.starCompletion ?? 0, 4));
            const record: SessionRecord = {
              sessionId: `${participantId}_${Date.now()}`,
              timestamp: Date.now(),
              condition,
              competencyLevels: [scoreToLevel(feedback.rubrics?.starCompletion ?? 1)],
              lowerBoundaryLevel,
              upperBoundaryLevel,
              scaffoldDependencyScore: feedback.scaffoldedLearningSignal?.scaffoldDependency?.score ?? 50,
              regulatoryFocus: (candidateProfile?.regulatoryFocus as any) ?? 'unclear',
              feedbackOrientation: (candidateProfile?.seeksFeedback as any) ?? 'uncertain',
              anxietyLevel: (candidateProfile?.anxietyLevel as any) ?? 'mild',
              selfReportedAnxietyLevel: preSessionAnswer ?? '',
              forwardOrientationNotes: feedback.careerDevelopment?.nextSteps ?? [],
              starComponentsReached: starReached,
            };
            const updatedSessions = [...(mesoAccumulator?.sessions ?? []), record];
            const updatedMeso = {
              participantId,
              sessions: updatedSessions,
              delta: computeMesoDelta(updatedSessions),
              lastUpdated: Date.now(),
            };
            saveMesoAccumulator(updatedMeso);
            fetch('/api/sessions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                participantId,
                companyName,
                targetRole,
                jobDescription,
                cvText,
                settings: { condition },
                questions: activeQuestions.map(q => ({ text: q.text, competency: q.competency })),
              }),
            }).then(r => r.json()).then(d => { if (d.sessionId) setBackendSessionId(d.sessionId); }).catch(() => {});
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

    // Derive coaching mode from question type and requirement ID prefix
    const getCoachingMode = (q: typeof currentQuestion): 'star' | 'motivational' | 'situational' | 'jdcv' | 'jd-understanding' | 'cv-competency' => {
        if (q.questionType === 'motivational') return 'motivational';
        if (q.questionType === 'situational') return 'situational';
        const firstId = q.requirements?.[0]?.id || '';
        if (firstId.startsWith('jdcv')) return 'jdcv';
        if (firstId.startsWith('jd')) return 'jd-understanding';
        if (firstId.startsWith('cv')) return 'cv-competency';
        return 'star';
    };
    const coachingMode = getCoachingMode(currentQuestion);

    const COACHING_HEADERS: Record<typeof coachingMode, string> = {
        'star':            'STAR Strategy Checklist',
        'motivational':    'Your Introduction Framework',
        'situational':     'Your Experience Framework',
        'jdcv':            'Connecting Your Experience',
        'jd-understanding':'Understanding the Role',
        'cv-competency':   'Evidence from Your Background',
    };

    const MOTIVATIONAL_PHASE_LABELS = ['Who', 'Journey', 'Edge', 'Direction'];
    const SITUATIONAL_PHASE_LABELS  = ['Context', 'Your Role', 'Actions', 'Outcome'];

    const handleDownloadReport = () => {
        if (!detailedFeedback) return;

        const rd = detailedFeedback.rubrics;

        // Layer A only — candidate-facing. No numeric scores, no researcher-only signals.
        const candidateReportContent = `
# ASCEND PERFORMANCE REPORT
Generated on: ${new Date().toLocaleString()}
Target Role: ${targetRole} at ${companyName}

## 1. EXECUTIVE SUMMARY
${detailedFeedback.performanceSummary}

## 2. OVERALL STAR SYNTHESIS
${detailedFeedback.overallStarSynthesis || 'N/A'}

## 3. KEY STRENGTHS
${detailedFeedback.strengths.map(s => `+ ${s}`).join('\n')}

## 4. IMPROVEMENT AREAS
${detailedFeedback.weaknesses.map(w => `- ${w}`).join('\n')}

## 5. STAR ANALYSIS
- Situation: ${detailedFeedback.starAnalysis.situation}
- Task:      ${detailedFeedback.starAnalysis.task}
- Action:    ${detailedFeedback.starAnalysis.action}
- Result:    ${detailedFeedback.starAnalysis.result}

## 6. KEYWORD COVERAGE
Found:   ${detailedFeedback.keywordCoverage.found.join(', ')}
Missing: ${detailedFeedback.keywordCoverage.missing.join(', ')}

## 7. ACTIONABLE REMEDIATION
${detailedFeedback.actionableSuggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}

## 8. CAREER DEVELOPMENT
Recommended Certs: ${detailedFeedback.careerDevelopment.certifications.join(', ')}
Next Steps:        ${detailedFeedback.careerDevelopment.nextSteps.join(', ')}

---
© ${new Date().getFullYear()} Ascend Platform. Confidential Performance Report.
        `.trim();

        // Layer B — researcher-only. Numeric rubrics, cognitive/evidence signals, ZPD, integrity audit.
        const researcherReportContent = `
${candidateReportContent}

---

# RESEARCHER APPENDIX (Layer B — not for candidate distribution)
Session ID: ${Math.random().toString(36).substring(2, 15).toUpperCase()}

## R1. PERFORMANCE RUBRICS (1–5 Scale)
- STAR Completion:      ${rd?.starCompletion ?? 0}/5 — ${rd?.justifications?.starCompletion || ''}
- Evidence Specificity: ${rd?.evidenceSpecificity ?? 0}/5 — ${rd?.justifications?.evidenceSpecificity || ''}
- Role Clarity:         ${rd?.roleClarity ?? 0}/5 — ${rd?.justifications?.roleClarity || ''}
- JD Alignment:         ${rd?.jdAlignment ?? 0}/5 — ${rd?.justifications?.jdAlignment || ''}
- Communication:        ${rd?.confidence ?? 0}/5 — ${rd?.justifications?.confidence || ''}

## R2. KOLB ELC STAGE SIGNALS (Process Overlap Theory — Kovacs & Conway, 2016)
${detailedFeedback.chcCognitiveDimensions ? `- Abstract Conceptualisation: ${detailedFeedback.chcCognitiveDimensions.abstractConceptualisation?.score ?? 'N/A'}/100 — ${detailedFeedback.chcCognitiveDimensions.abstractConceptualisation?.evidenceBasis || ''}
- Active Experimentation:     ${detailedFeedback.chcCognitiveDimensions.activeExperimentation?.score ?? 'N/A'}/100 — ${detailedFeedback.chcCognitiveDimensions.activeExperimentation?.evidenceBasis || ''}
- Concrete Experience:        ${detailedFeedback.chcCognitiveDimensions.concreteExperience?.score ?? 'N/A'}/100 — ${detailedFeedback.chcCognitiveDimensions.concreteExperience?.evidenceBasis || ''}
Note: ${detailedFeedback.chcCognitiveDimensions.overallELCNote || 'N/A'}` : 'ELC stage signal data unavailable.'}

## R3. BEHAVIORAL EVIDENCE VECTORS (Levashina & Campion 2007; Ericsson 2016)
${detailedFeedback.meritVectors ? `- Personal Agency:      ${detailedFeedback.meritVectors.personalAgency.score}/100 — ${detailedFeedback.meritVectors.personalAgency.evidenceBasis}
- Skill Specificity:   ${detailedFeedback.meritVectors.skillSpecificity.score}/100 — ${detailedFeedback.meritVectors.skillSpecificity.evidenceBasis}
- Impact Articulation: ${detailedFeedback.meritVectors.impactArticulation.score}/100 — ${detailedFeedback.meritVectors.impactArticulation.evidenceBasis}` : 'Evidence vector data unavailable.'}

## R4. PROFESSIONAL SELF-VERIFICATION SIGNALS (Cable & Kay, 2012)
${detailedFeedback.professionalSelfVerificationSignals ? `- Voice (Self-Verifying): ${detailedFeedback.professionalSelfVerificationSignals.voice?.score ?? 'N/A'}/100 [${detailedFeedback.professionalSelfVerificationSignals.voice?.orientation}] — ${detailedFeedback.professionalSelfVerificationSignals.voice?.evidenceBasis || ''}
- Motivation (Self-Verifying): ${detailedFeedback.professionalSelfVerificationSignals.motivation?.score ?? 'N/A'}/100 [${detailedFeedback.professionalSelfVerificationSignals.motivation?.orientation}] — ${detailedFeedback.professionalSelfVerificationSignals.motivation?.evidenceBasis || ''}
- Explanation (Self-Verifying): ${detailedFeedback.professionalSelfVerificationSignals.explanation?.score ?? 'N/A'}/100 [${detailedFeedback.professionalSelfVerificationSignals.explanation?.orientation}] — ${detailedFeedback.professionalSelfVerificationSignals.explanation?.evidenceBasis || ''}
- Dominant Mode: ${detailedFeedback.professionalSelfVerificationSignals.dominantMode || 'N/A'}
- Fit Signal: ${detailedFeedback.professionalSelfVerificationSignals.fitSignal || 'N/A'}
- Feedback Implication: ${detailedFeedback.professionalSelfVerificationSignals.feedbackImplication || 'N/A'}` : 'Professional Self-Verification Signals data unavailable.'}

## R5. SCAFFOLDED LEARNING (Vygotsky, 1978)
${detailedFeedback.scaffoldedLearningSignal ? `- ZPD Observation: ${detailedFeedback.scaffoldedLearningSignal.zpdProgressionObservation || 'N/A'}
- Dependency: ${detailedFeedback.scaffoldedLearningSignal.scaffoldDependency?.interpretation || 'N/A'}
- Lower Boundary: ${detailedFeedback.scaffoldedLearningSignal.zoneOfProximalDevelopmentEstimate?.lowerBoundary || 'N/A'}
- Upper Boundary: ${detailedFeedback.scaffoldedLearningSignal.zoneOfProximalDevelopmentEstimate?.upperBoundary || 'N/A'}
- Dev Gap: ${detailedFeedback.scaffoldedLearningSignal.zoneOfProximalDevelopmentEstimate?.developmentGap || 'N/A'}` : 'Vygotsky data unavailable.'}

## R6. RESEARCH SIGNALS
- AI Trust Calibration: ${detailedFeedback.algorithmicAversionSignal?.aversionDetected ? 'Scepticism detected' : 'No scepticism detected'} — ${detailedFeedback.algorithmicAversionSignal?.aversionEvidence || 'No evidence.'}
- Social Identity:     ${detailedFeedback.socialIdentityAwareness?.activated ? `Active (${detailedFeedback.socialIdentityAwareness.dominantMotivation || 'Balanced'})` : 'Inactive'} — ${detailedFeedback.socialIdentityAwareness?.scopeNote}

## R7. INTEGRITY & SAFETY AUDIT
Violation Detected: ${detailedFeedback.integrityViolation?.detected ? 'YES' : 'NO'}
${detailedFeedback.integrityViolation?.detected ? `Note: ${detailedFeedback.integrityViolation.note}` : ''}
Bias & Fairness: ${typeof detailedFeedback.biasAndFairnessNote === 'string' ? detailedFeedback.biasAndFairnessNote : (detailedFeedback.biasAndFairnessNote as any)?.overallFairnessNote || 'See full report.'}

## R8. INTERVIEW TRANSCRIPT
${typeof detailedFeedback.maskedTranscript === 'object' ? (detailedFeedback.maskedTranscript as any)?.text : detailedFeedback.maskedTranscript || transcript}
        `.trim();

        const reportContent = researcherMode ? researcherReportContent : candidateReportContent;

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

    const handleSubmitFlag = async () => {
        if (!backendSessionId) {
            setFlagResult('Report not yet saved — please wait a moment and try again.');
            return;
        }
        setFlagSubmitting(true);
        setFlagResult(null);
        try {
            const res = await fetch(`/api/sessions/${encodeURIComponent(backendSessionId)}/flags`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ participantId, section: flagSection, candidateNote: flagNote.trim() || undefined }),
            });
            const data = await res.json();
            if (res.ok) {
                setFlagResult(data.message ?? 'Your feedback has been recorded and will be reviewed.');
                setFlagNote('');
            } else {
                setFlagResult(data.error ?? 'Failed to submit — please try again.');
            }
        } catch {
            setFlagResult('Failed to submit — please try again.');
        } finally {
            setFlagSubmitting(false);
        }
    };


    if (waitingForMoreQuestions) {
        const breakTarget = [...sessionLog].reverse().find(e => e.summaryReport?.breakContextGap)?.summaryReport?.breakContextGap ?? null;
        return (
            <div className="min-h-screen w-screen bg-slate-950 flex flex-col items-center justify-center gap-10 animate-fade-in">
                <div className="text-center space-y-4 max-w-lg px-8">
                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Reflective Break</p>
                    <h1 className="text-3xl font-black text-white leading-tight">Well done so far.</h1>
                    <p className="text-sm font-medium text-slate-400 leading-relaxed">
                        Your next personalised questions are being prepared. Use this moment to reflect on what you've covered and reset your focus.
                    </p>
                </div>

                {breakTarget ? (
                    <div className="max-w-sm w-full px-8 space-y-3">
                        <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400 text-center">Your target going into the next block</p>
                        <div className="p-5 bg-indigo-950/60 rounded-2xl border border-indigo-500/30">
                            <p className="text-sm font-medium text-white leading-relaxed">{breakTarget}</p>
                        </div>
                        <p className="text-[9px] font-medium text-slate-500 text-center">Hold this in mind before your next answer.</p>
                    </div>
                ) : (
                    <div className="space-y-3 max-w-sm w-full px-8">
                        {[
                            "Structure every answer: Situation → Task → Action → Result",
                            "Be specific — real examples beat general statements",
                            "Take your time. Silence before speaking is a strength",
                        ].map((tip, i) => (
                            <div key={i} className="flex items-start gap-3 p-4 bg-white/5 rounded-2xl border border-white/10">
                                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full mt-1.5 shrink-0" />
                                <p className="text-xs font-medium text-slate-300">{tip}</p>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex items-center gap-2 text-slate-600 text-[10px] font-black uppercase tracking-widest">
                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
                    Preparing your next questions...
                </div>
            </div>
        );
    }

    if (recordingStatus === 'uploaded') {
        // ── Reflection gate — RO stage before analysis ────────────────────
        if (!reflectionDone) {
            const starters = [
                'What surprised me most was…',
                'The moment I felt least confident was…',
                'If I could redo one part, it would be…',
            ];
            return (
                <div className="min-h-screen w-screen bg-slate-900 flex flex-col items-center justify-center p-8 animate-fade-in">
                    <div className="max-w-lg w-full">
                        {/* Welcome back card */}
                        {prevSession && (
                            <div className="mb-8 p-5 bg-white/5 border border-white/10 rounded-2xl">
                                <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400 mb-2">Welcome back</p>
                                <p className="text-sm font-bold text-white mb-3">Last session · {prevSession.date}</p>
                                <div className="flex gap-2 mb-3">
                                    {(['S','T','A','R'] as const).map((l, i) => {
                                        const s = prevSession.starScores[i];
                                        const star = s === null ? '—' : s >= 80 ? '5★' : s >= 50 ? '3★' : '1★';
                                        const col = s === null ? 'text-slate-500' : s >= 80 ? 'text-emerald-400' : s >= 50 ? 'text-amber-400' : 'text-rose-400';
                                        return (
                                            <div key={l} className="flex-1 bg-white/5 rounded-xl py-2 text-center">
                                                <p className="text-[9px] font-black text-slate-400">{l}</p>
                                                <p className={`text-[11px] font-black ${col}`}>{star}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                                {prevSession.weakness && (
                                    <p className="text-[10px] text-slate-400 font-medium leading-snug">
                                        Last time you were working on: <span className="text-white font-bold">{prevSession.weakness}</span>. Watch for it today.
                                    </p>
                                )}
                            </div>
                        )}
                        <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400 mb-3">Take a breath</p>
                        <h2 className="text-3xl font-black text-white leading-tight mb-3">What did you notice?</h2>
                        <p className="text-sm text-slate-400 font-medium mb-8 leading-relaxed">
                            Before the analysis loads — sit with the experience for a moment. There's no right answer. This is just for you.
                        </p>

                        <div className="space-y-2 mb-5">
                            {starters.map(s => (
                                <button
                                    key={s}
                                    onClick={() => setReflectionText(prev => prev ? prev : s)}
                                    className="w-full text-left px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-slate-200 text-xs font-medium transition-all"
                                >
                                    {s}
                                </button>
                            ))}
                        </div>

                        <textarea
                            value={reflectionText}
                            onChange={e => setReflectionText(e.target.value)}
                            placeholder="Write anything — or pick a starter above…"
                            rows={4}
                            className="w-full px-5 py-4 rounded-2xl bg-white/5 border border-white/10 text-white placeholder:text-slate-600 text-sm font-medium focus:outline-none focus:border-indigo-500 resize-none mb-8 leading-relaxed"
                        />

                        <button
                            onClick={() => {
                                logEvent('reflection_submitted', {
                                    completed: !!reflectionText.trim(),
                                    textLength: reflectionText.trim().length,
                                });
                                setReflectionDone(true);
                            }}
                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-indigo-900/40"
                        >
                            {reflectionText.trim() ? 'Continue →' : 'Skip for now →'}
                        </button>
                    </div>
                </div>
            );
        }

        // ── Self-rating gate — before the report is revealed ──────────────
        if (!selfRatingDone) {
            const comps = [
                { key: 'situation', label: 'Situation', hint: 'Did you set the scene clearly — what was happening and why it mattered?' },
                { key: 'task',      label: 'Task',      hint: 'Did you make your specific role and responsibility clear?' },
                { key: 'action',    label: 'Action',    hint: 'Did you explain what YOU did, step by step, in your own words?' },
                { key: 'result',    label: 'Result',    hint: 'Did you land a concrete, measurable outcome?' },
            ] as const;
            const allRated = comps.every(c => selfRating[c.key] !== null);
            return (
                <div className="min-h-screen w-screen bg-slate-50 flex flex-col items-center justify-center p-8 animate-fade-in">
                    <div className="max-w-xl w-full">
                        <p className="text-[9px] font-black uppercase tracking-widest text-indigo-500 mb-2">Before we show you the analysis</p>
                        <h2 className="text-2xl font-black text-slate-900 leading-tight mb-2">How do you think you did?</h2>
                        <p className="text-sm text-slate-400 font-medium mb-10">Rate each STAR component honestly — then compare your read with the AI's. No wrong answers here.</p>

                        <div className="space-y-4 mb-10">
                            {comps.map(comp => (
                                <div key={comp.key} className="bg-white border border-slate-200 rounded-2xl p-5">
                                    <div className="flex items-start justify-between gap-4 mb-3">
                                        <div>
                                            <p className="text-sm font-black text-slate-800">{comp.label}</p>
                                            <p className="text-[10px] text-slate-400 font-medium mt-0.5 leading-snug">{comp.hint}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        {(['strong', 'partial', 'struggled'] as const).map(opt => {
                                            const cfg = {
                                                strong:    { label: 'Strong',    cls: 'border-emerald-400 bg-emerald-50 text-emerald-700' },
                                                partial:   { label: 'Partial',   cls: 'border-amber-400 bg-amber-50 text-amber-700' },
                                                struggled: { label: 'Struggled', cls: 'border-rose-400 bg-rose-50 text-rose-700' },
                                            }[opt];
                                            const active = selfRating[comp.key] === opt;
                                            return (
                                                <button
                                                    key={opt}
                                                    onClick={() => setSelfRating(prev => ({ ...prev, [comp.key]: opt }))}
                                                    className={`flex-1 py-2 rounded-xl border-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                                                        active ? cfg.cls : 'border-slate-200 text-slate-400 hover:border-slate-300'
                                                    }`}
                                                >
                                                    {cfg.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={() => {
                                logEvent('self_rating_submitted', {
                                    completed: true,
                                    selfRatingSituation: selfRating.situation,
                                    selfRatingTask:      selfRating.task,
                                    selfRatingAction:    selfRating.action,
                                    selfRatingResult:    selfRating.result,
                                });
                                setSelfRatingDone(true);
                            }}
                            disabled={!allRated}
                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-black text-sm uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-indigo-900/20"
                        >
                            {allRated ? 'See My Results →' : 'Rate all four to continue'}
                        </button>
                        <button
                            onClick={() => {
                                logEvent('self_rating_submitted', { completed: false });
                                setSelfRatingDone(true);
                            }}
                            className="w-full mt-3 py-2 text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-colors"
                        >
                            Skip
                        </button>
                    </div>
                </div>
            );
        }

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
                            {/* Mic test — visible always but labelled "Test Audio" for quick audio verification */}
                            <button
                                onClick={handleMicTest}
                                disabled={micTestState === 'recording'}
                                className={`px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] flex items-center gap-3 transition-all active:scale-95 border ${
                                    micTestState === 'recording'
                                        ? 'bg-rose-50 border-rose-200 text-rose-600 animate-pulse cursor-not-allowed'
                                        : micTestState === 'done'
                                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                                        : micTestState === 'error'
                                        ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                </svg>
                                {micTestState === 'recording' ? 'Recording 5s…' : micTestState === 'done' ? 'Audio ✓ Test Again' : micTestState === 'error' ? 'Mic Error — Retry' : 'Test Audio'}
                            </button>
                            <button
                                onClick={() => { setShowFlagModal(true); setFlagResult(null); }}
                                className="px-8 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-[11px] flex items-center gap-3 hover:bg-slate-50 transition-all active:scale-95"
                            >
                                <ShieldAlert size={18} /> Flag an Issue
                            </button>
                        </div>
                    </div>

                    {showFlagModal && (
                        <div className="fixed inset-0 bg-slate-900 bg-opacity-80 flex items-center justify-center z-[20000] animate-fade-in p-4" role="dialog" aria-modal="true">
                            <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full border border-slate-200">
                                <h2 className="text-lg font-black text-slate-900 tracking-tight mb-1">Flag This Report</h2>
                                <p className="text-xs text-slate-500 font-medium mb-6">Think a section of your feedback is inaccurate or unfair? Flag it — a human will review it. This does not change your report automatically.</p>

                                {flagResult ? (
                                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-sm font-medium text-emerald-800 mb-6">{flagResult}</div>
                                ) : (
                                    <>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Which section?</label>
                                        <select
                                            value={flagSection}
                                            onChange={e => setFlagSection(e.target.value)}
                                            className="w-full mb-4 px-4 py-3 rounded-2xl border border-slate-200 text-sm font-medium text-slate-700 focus:outline-none focus:border-indigo-400"
                                        >
                                            <option value="overall">Overall report</option>
                                            <option value="strengths">Strengths</option>
                                            <option value="weaknesses">Improvement areas</option>
                                            <option value="star_analysis">STAR analysis</option>
                                            <option value="coaching">Coaching suggestions</option>
                                            <option value="rubrics">Scores / ratings</option>
                                        </select>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">What's wrong? (optional)</label>
                                        <textarea
                                            value={flagNote}
                                            onChange={e => setFlagNote(e.target.value)}
                                            rows={4}
                                            placeholder="Tell us what seems off…"
                                            className="w-full mb-6 px-4 py-3 rounded-2xl border border-slate-200 text-sm font-medium text-slate-700 placeholder:text-slate-300 focus:outline-none focus:border-indigo-400 resize-none"
                                        />
                                    </>
                                )}

                                <div className="flex flex-col gap-3">
                                    {!flagResult && (
                                        <button
                                            onClick={handleSubmitFlag}
                                            disabled={flagSubmitting}
                                            className="w-full py-4 rounded-2xl font-black text-white bg-slate-900 hover:bg-indigo-600 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all uppercase tracking-[0.2em] text-xs"
                                        >
                                            {flagSubmitting ? 'Submitting…' : 'Submit Flag'}
                                        </button>
                                    )}
                                    <button onClick={() => setShowFlagModal(false)} className="w-full py-3 rounded-2xl font-black text-slate-500 hover:text-slate-800 transition-colors text-xs uppercase tracking-widest">
                                        {flagResult ? 'Close' : 'Cancel'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Preview mode banner */}
                    {previewMode && (
                        <div className="mt-6 p-5 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-start gap-4">
                            <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                                <Sparkles size={16} className="text-white" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 mb-1">Preview Mode — Sample Data</p>
                                <p className="text-xs font-medium text-indigo-800">This report is populated with realistic dummy data so you can explore every panel — feedback, insights, STAR analysis, transcript annotations, and CV missed opportunities — without completing a full interview. Use the <strong>Test Audio</strong> button above to verify your microphone and transcription are working.</p>
                            </div>
                        </div>
                    )}

                    {/* Mic test result panel */}
                    {(micTestState === 'done' || micTestState === 'error') && micTestResult && (
                        <div className={`mt-4 p-5 rounded-2xl border flex items-start gap-4 ${micTestState === 'error' ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'}`}>
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${micTestState === 'error' ? 'bg-rose-500' : 'bg-emerald-500'}`}>
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                    {micTestState === 'error'
                                        ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                        : <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />}
                                </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${micTestState === 'error' ? 'text-rose-600' : 'text-emerald-700'}`}>
                                    {micTestState === 'error' ? 'Audio Test Failed' : 'Audio Transcription Result'}
                                </p>
                                <p className={`text-sm font-medium leading-relaxed ${micTestState === 'error' ? 'text-rose-800' : 'text-emerald-900'}`}>{micTestResult}</p>
                                {micTestState === 'done' && <p className="text-[10px] text-emerald-600 font-bold mt-2 uppercase tracking-widest">Microphone and transcription are working correctly.</p>}
                            </div>
                            <button onClick={() => { setMicTestState('idle'); setMicTestResult(''); }} className="text-slate-400 hover:text-slate-600 transition-colors shrink-0">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                    )}

                    {detailedFeedback?.noData && (
                        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-amber-700 max-w-2xl">
                            <ShieldAlert size={20} />
                            <p className="text-xs font-bold uppercase tracking-widest">Warning: Minimal input signal detected. Results may be incomplete.</p>
                        </div>
                    )}

                    {isGeneratingFeedback ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-6">
                            <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                            <div className="text-center space-y-3">
                                <p className="text-sm font-black uppercase tracking-widest text-slate-900">Synthesizing Performance Summary</p>
                                <p className="text-[10px] font-medium text-slate-500">Analyzing authenticity and self-verification patterns...</p>
                                <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">You did great — your full report is being prepared.</p>
                                <p className="text-[10px] font-medium text-slate-400">This usually takes 20–30 seconds. Hang tight.</p>
                            </div>
                        </div>
                    ) : detailedFeedback ? (
                        <>


                        {/* ── Format selector — preview mode only ─────────────────── */}
                        {previewMode && (
                            <div className="mb-8 p-5 bg-white border border-slate-200 rounded-3xl flex items-center gap-3 flex-wrap shadow-sm">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest shrink-0">Report Format</span>
                                <div className="flex gap-2 flex-wrap">
                                    {([
                                        { id: 'narrative' as const, label: 'Narrative', hint: 'Full prose detail' },
                                        { id: 'visual' as const, label: 'Visual', hint: 'Charts & cards' },
                                        { id: 'digest' as const, label: 'Digest', hint: 'Bullet points only' },
                                        { id: 'focus' as const, label: 'Focus', hint: 'One section at a time' },
                                    ]).map(fmt => (
                                        <button key={fmt.id} onClick={() => setReportFormat(fmt.id)} title={fmt.hint}
                                            className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                                                reportFormat === fmt.id
                                                    ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                                                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-400 hover:text-slate-700'
                                            }`}>{fmt.label}</button>
                                    ))}
                                </div>
                                {reportFormat === 'focus' && (
                                    <select value={focusSection} onChange={e => setFocusSection(e.target.value as typeof focusSection)}
                                        className="ml-1 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200 bg-white text-slate-700 cursor-pointer focus:outline-none focus:border-indigo-400">
                                        <option value="star">STAR Analysis</option>
                                        <option value="feedback">Strengths & Weaknesses</option>
                                        <option value="coaching">Coaching & Suggestions</option>
                                        {researcherMode && <option value="insights">Research Insights</option>}
                                        <option value="cv">CV Alignment</option>
                                        <option value="practice">Practice Tasks</option>
                                    </select>
                                )}
                                <span className="text-[9px] text-slate-400 ml-auto hidden md:block">
                                    {reportFormat === 'narrative' ? 'Full prose — every section, all detail' :
                                     reportFormat === 'visual' ? 'Charts, bars, and cards — same data, visual first' :
                                     reportFormat === 'digest' ? 'Bullet points only — scannable at-a-glance' :
                                     'One section expanded — choose what to focus on'}
                                </span>
                            </div>
                        )}
                        {/* ── NARRATIVE (default + all real sessions) ─────────────── */}
                        {(!previewMode || reportFormat === 'narrative') && <>
                        {/* ── Confidence anchor — lead with what worked ── */}
                        {(() => {
                            const strengths = detailedFeedback.strengths ?? [];
                            if (!strengths.length) return null;
                            return (
                                <div className="mb-6 p-7 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-[32px]">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600 mb-4">Before anything else — what you did well</p>
                                    <div className="space-y-4">
                                        {strengths.map((raw: string, i: number) => {
                                            const [headline, detail] = raw.split('|').map((s: string) => s.trim());
                                            return (
                                                <div key={i} className="flex gap-3">
                                                    <span className="mt-1 w-4 h-4 shrink-0 flex items-center justify-center rounded-full bg-emerald-500 text-white text-[8px] font-black">{i + 1}</span>
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-800 leading-snug">{headline}</p>
                                                        {detail && <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">{detail}</p>}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <p className="text-[9px] font-medium text-emerald-500 mt-3">These are real. Hold onto them as you read the rest.</p>
                                    {/* Cross-session delta */}
                                    {prevSession && (() => {
                                        const labels = ['S','T','A','R'];
                                        const toStar = (s: number|null) => s === null ? '—' : s >= 80 ? '5★' : s >= 50 ? '3★' : '1★';
                                        const col = (s: number|null) => s === null ? 'text-slate-400' : s >= 80 ? 'text-emerald-600' : s >= 50 ? 'text-amber-500' : 'text-rose-500';
                                        return (
                                            <div className="mt-4 pt-4 border-t border-emerald-200">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600 mb-3">Your progress since last session · {prevSession.date}</p>
                                                <div className="grid grid-cols-4 gap-2">
                                                    {labels.map((l, i) => {
                                                        const prev = prevSession.starScores[i];
                                                        const curr = candidateStarCompletion[i];
                                                        const prevStar = toStar(prev);
                                                        const currStar = toStar(curr);
                                                        const improved = curr !== null && prev !== null && curr > prev;
                                                        return (
                                                            <div key={l} className="bg-white border border-slate-100 rounded-xl p-3 text-center">
                                                                <p className="text-[9px] font-black text-slate-400 mb-1">{l}</p>
                                                                <p className={`text-[10px] font-bold text-slate-400`}>{prevStar}</p>
                                                                <p className="text-[9px] text-slate-300 my-0.5">↓</p>
                                                                <p className={`text-[11px] font-black ${col(curr)} ${improved ? 'underline underline-offset-2' : ''}`}>{currStar}</p>
                                                                {improved && <p className="text-[8px] font-black text-emerald-500 mt-0.5">↑</p>}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })()}
                                    {/* Self-rating comparison */}
                                    {Object.values(selfRating).some(v => v !== null) && (() => {
                                        const comps = ['situation', 'task', 'action', 'result'] as const;
                                        const labels = { situation: 'S', task: 'T', action: 'A', result: 'R' };
                                        const colours = {
                                            strong:    'bg-emerald-100 text-emerald-700',
                                            partial:   'bg-amber-100 text-amber-700',
                                            struggled: 'bg-rose-100 text-rose-700',
                                        };
                                        return (
                                            <div className="mt-4 pt-4 border-t border-emerald-200">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600 mb-2">Your self-read</p>
                                                <div className="flex gap-2">
                                                    {comps.map(c => {
                                                        const r = selfRating[c];
                                                        return (
                                                            <div key={c} className={`flex-1 rounded-xl py-2 text-center ${r ? colours[r] : 'bg-slate-100 text-slate-400'}`}>
                                                                <p className="text-[10px] font-black">{labels[c]}</p>
                                                                <p className="text-[8px] font-bold capitalize">{r ?? '—'}</p>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                <p className="text-[9px] text-emerald-500 mt-2">Compare this with the STAR chart below.</p>
                                                {reflectionText.trim() && (
                                                    <div className="mt-3 pt-3 border-t border-emerald-200">
                                                        <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600 mb-1">Your reflection</p>
                                                        <p className="text-xs text-slate-500 font-medium italic leading-relaxed">"{reflectionText.trim()}"</p>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>
                            );
                        })()}
                        {/* Priority Action — one thing to walk away with */}
                        {(() => {
                            const priority = detailedFeedback.hiringProfileAlignment?.priorityFix
                                ?? detailedFeedback.meritVectors?.primarySuggestionAnchor
                                ?? detailedFeedback.actionableSuggestions?.[0]
                                ?? null;
                            return priority ? (
                                <div id="report-priority-action" className="mb-8 p-6 bg-slate-900 rounded-[32px] border border-indigo-500/30">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400 mb-2">Your One Priority</p>
                                    <p className="text-base font-bold text-white leading-relaxed">{priority}</p>
                                    <p className="text-[9px] font-medium text-slate-500 mt-3">Everything below supports this. Start here.</p>
                                </div>
                            ) : null;
                        })()}
                        <div className="space-y-8">
                            {/* ── Report sections — single column flow ── */}
                            <div className="space-y-8">
                                {/* Performance Summary */}
                                <section id="report-performance-summary" className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                                            <TrendingUp size={20} />
                                        </div>
                                        <h3 className="text-lg font-black uppercase tracking-widest text-slate-900">Profile Summary</h3>
                                    </div>

                                    {/* Key takeaways — performanceSummary split into scannable bullets */}
                                    {detailedFeedback.performanceSummary && (() => {
                                        const bullets = detailedFeedback.performanceSummary
                                            .split(/(?<=\.)\s+/)
                                            .map((s: string) => s.trim())
                                            .filter((s: string) => s.length > 10);
                                        return (
                                            <ul className="space-y-2 mb-6">
                                                {bullets.map((b: string, i: number) => (
                                                    <li key={i} className="flex gap-3 items-start">
                                                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                                                        <p className="text-sm font-medium text-slate-700 leading-relaxed">{b}</p>
                                                    </li>
                                                ))}
                                            </ul>
                                        );
                                    })()}

                                    {/* Strengths + Development areas — two columns */}
                                    {((detailedFeedback.strengths?.length ?? 0) > 0 || (detailedFeedback.weaknesses?.length ?? 0) > 0) && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                            {/* Strengths */}
                                            {(detailedFeedback.strengths?.length ?? 0) > 0 && (
                                                <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl">
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600 mb-3">Strengths</p>
                                                    <ul className="space-y-2">
                                                        {detailedFeedback.strengths.map((raw: string, i: number) => {
                                                            const headline = raw.split('|')[0].trim();
                                                            return (
                                                                <li key={i} className="flex gap-2 items-start">
                                                                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                                                    <p className="text-xs font-medium text-slate-700 leading-relaxed">{headline}</p>
                                                                </li>
                                                            );
                                                        })}
                                                    </ul>
                                                </div>
                                            )}
                                            {/* Development areas */}
                                            {(detailedFeedback.weaknesses?.length ?? 0) > 0 && (
                                                <div className="p-5 bg-amber-50 border border-amber-200 rounded-2xl">
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-amber-600 mb-3">Development Areas</p>
                                                    <ul className="space-y-2">
                                                        {detailedFeedback.weaknesses.map((raw: string, i: number) => {
                                                            const headline = raw.split('|')[0].trim();
                                                            return (
                                                                <li key={i} className="flex gap-2 items-start">
                                                                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                                                    <p className="text-xs font-medium text-slate-700 leading-relaxed">{headline}</p>
                                                                </li>
                                                            );
                                                        })}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {detailedFeedback.overallStarSynthesis && (
                                        <div className="mt-5 p-5 bg-indigo-50 rounded-2xl border border-indigo-100">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-indigo-500 mb-2">STAR Session Synthesis</p>
                                            <p className="text-sm font-medium text-slate-700 leading-relaxed">{detailedFeedback.overallStarSynthesis}</p>
                                        </div>
                                    )}

                                    {/* Sentence-Level Translation — what you said → interview-standard language */}
                                    {detailedFeedback.transcriptAnnotations && detailedFeedback.transcriptAnnotations.length > 0 && (
                                        <div className="mt-6 space-y-4">
                                            <div>
                                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-800">Your Words → Interview Standard</p>
                                                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">Each moment below shows exactly what you said, what it reveals, and how the same idea sounds in polished interview language — ready to use verbatim.</p>
                                            </div>
                                            {detailedFeedback.transcriptAnnotations.map((annotation, i) => (
                                                <div key={i} className="rounded-2xl border border-slate-200 overflow-hidden">
                                                    {/* Moment header */}
                                                    <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
                                                        <div className="flex items-start gap-2">
                                                            <span className="text-[8px] font-black text-indigo-400 bg-indigo-50 rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                                                            <p className="text-[10px] font-semibold text-slate-600 leading-relaxed italic">{annotation.moment}</p>
                                                        </div>
                                                    </div>
                                                    {/* Observation */}
                                                    <div className="px-5 py-3 border-b border-slate-100">
                                                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">What this reveals</p>
                                                        <p className="text-[11px] font-medium text-slate-700 leading-relaxed">{annotation.observation}</p>
                                                    </div>
                                                    {/* Standard version — the coaching gift */}
                                                    <div className="px-5 py-3 bg-gradient-to-br from-indigo-50 to-indigo-50/30 border-b border-indigo-100">
                                                        <p className="text-[9px] font-black uppercase tracking-widest text-indigo-500 mb-1">Interview-standard version</p>
                                                        <p className="text-[11px] font-semibold text-indigo-900 leading-relaxed">{annotation.standardVersion}</p>
                                                    </div>
                                                    {/* Principle */}
                                                    <div className="px-5 py-2.5 bg-slate-900/2">
                                                        <p className="text-[9px] text-slate-400 leading-relaxed italic">{annotation.principle}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Rubrics — researcher only (numerical scores not shown to candidates per FRAMEWORK.md ethical note) */}
                                    {researcherMode && <div id="report-rubrics-grid" className="mt-8 space-y-4">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Professional Rubrics (1–5 Scale)</p>
                                        {(detailedFeedback?.rubrics ? [
                                            { key: 'starCompletion', label: 'STAR Completion' },
                                            { key: 'evidenceSpecificity', label: 'Evidence Specificity' },
                                            { key: 'roleClarity', label: 'Role Clarity' },
                                            { key: 'jdAlignment', label: 'JD Alignment' },
                                            { key: 'confidence', label: 'Communication Clarity' },
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
                                    </div>}
                                </section>

                                {/* CV Missed Opportunities — prominent gap alert */}
                                {detailedFeedback.cvMissedOpportunities && detailedFeedback.cvMissedOpportunities.length > 0 && (
                                    <section className="bg-amber-50 p-8 rounded-[40px] border-2 border-amber-200 shadow-sm">
                                        <div className="flex items-start gap-4 mb-6">
                                            <div className="p-2 bg-amber-200 rounded-xl shrink-0">
                                                <Target size={20} className="text-amber-800" />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-black uppercase tracking-widest text-amber-900">CV Evidence You Already Have — But Didn't Use</h3>
                                                <p className="text-[11px] text-amber-700 mt-1 leading-relaxed font-medium">
                                                    Your CV documents real, relevant experience that interviewers would expect to hear. The entries below show exactly where that evidence would have been strongest — and how to deploy it next time.
                                                </p>
                                            </div>
                                        </div>
                                        <div className="space-y-5">
                                            {detailedFeedback.cvMissedOpportunities.map((opp, i) => (
                                                <div key={i} className="bg-white rounded-2xl border border-amber-100 overflow-hidden">
                                                    {/* CV Item */}
                                                    <div className="px-5 py-3 bg-amber-100/60 border-b border-amber-100">
                                                        <p className="text-[8px] font-black uppercase tracking-widest text-amber-600 mb-1">What You Have on Your CV</p>
                                                        <p className="text-[11px] font-bold text-amber-900 leading-relaxed">{opp.cvItem}</p>
                                                    </div>
                                                    {/* Where it applied */}
                                                    <div className="px-5 py-3 border-b border-slate-100">
                                                        <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">Where It Was Relevant</p>
                                                        <p className="text-[11px] font-medium text-slate-600 leading-relaxed">{opp.questionContext}</p>
                                                    </div>
                                                    {/* Why it fits */}
                                                    <div className="px-5 py-3 border-b border-slate-100">
                                                        <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">Why This Would Have Strengthened Your Answer</p>
                                                        <p className="text-[11px] font-medium text-slate-700 leading-relaxed">{opp.whyItFits}</p>
                                                    </div>
                                                    {/* Ready-to-use version */}
                                                    <div className="px-5 py-3 bg-indigo-50 border-b border-indigo-100">
                                                        <p className="text-[8px] font-black uppercase tracking-widest text-indigo-500 mb-1">How to Use It Next Time</p>
                                                        <p className="text-[11px] font-semibold text-indigo-900 leading-relaxed">{opp.exampleUsage}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                )}

                                <section className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
                                    <h3 className="text-sm font-black uppercase tracking-widest text-indigo-600 mb-4 flex items-center gap-2">
                                        <Award size={16} /> STAR Analysis
                                    </h3>
                                    {/* STAR Phase Weight Bar — NCS standard vs candidate actual */}
                                    <div className="mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                                        {/* NCS standard */}
                                        <div>
                                            <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-2">NCS Standard Weight</p>
                                            <div className="flex gap-0.5 items-end h-8 mb-0.5">
                                                {[{l:'S',w:15,c:'bg-teal-400'},{l:'T',w:15,c:'bg-amber-400'},{l:'A',w:60,c:'bg-rose-500'},{l:'R',w:10,c:'bg-orange-400'}].map(({l,w,c}) => (
                                                    <div key={l} className="flex flex-col items-center justify-end" style={{flex: w}}>
                                                        <div className={`w-full ${c} rounded-t opacity-40`} style={{height: `${Math.max(4, w * 0.4)}px`}} />
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="flex gap-0.5">
                                                {[{l:'S',w:15},{l:'T',w:15},{l:'A',w:60},{l:'R',w:10}].map(({l,w}) => (
                                                    <div key={l} className="text-center" style={{flex: w}}>
                                                        <span className="text-[8px] font-black text-slate-300">{l}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        {/* Candidate actual */}
                                        {candidateStarCompletion.some(v => v !== null) && (
                                            <div>
                                                <p className="text-[8px] font-black uppercase tracking-widest text-indigo-500 mb-2">Your Completion</p>
                                                <div className="flex gap-0.5 items-end h-8 mb-0.5">
                                                    {([{l:'S',c:'bg-teal-500'},{l:'T',c:'bg-amber-500'},{l:'A',c:'bg-indigo-600'},{l:'R',c:'bg-orange-500'}] as const).map(({l,c}, i) => {
                                                        const score = candidateStarCompletion[i];
                                                        const barH = score !== null ? Math.max(4, score * 0.32) : 4;
                                                        const barColor = score === null ? 'bg-slate-200' : score >= 80 ? c : score >= 50 ? 'bg-amber-400' : 'bg-rose-400';
                                                        return (
                                                            <div key={l} className="flex flex-col items-center justify-end" style={{flex: [15,15,60,10][i]}}>
                                                                <div className={`w-full ${barColor} rounded-t`} style={{height: `${barH}px`}} />
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                <div className="flex gap-0.5">
                                                    {[{l:'S',w:15},{l:'T',w:15},{l:'A',w:60},{l:'R',w:10}].map(({l,w},i) => (
                                                        <div key={l} className="text-center" style={{flex: w}}>
                                                            <span className={`text-[8px] font-black ${i === 2 ? 'text-indigo-500' : 'text-slate-400'}`}>{l}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <p className="text-[8px] text-slate-400 mt-2">Green = 80 %+ · Amber = 50–79 % · Red = below 50 %. Action (60 % weight) is the coaching priority.</p>
                                            </div>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {(detailedFeedback.starAnalysis && typeof detailedFeedback.starAnalysis === 'object') ? (['situation','task','action','result'] as const).map((key, i) => {
                                            const value = detailedFeedback.starAnalysis[key];
                                            const score = candidateStarCompletion[i];
                                            const ncsW = [15,15,60,10][i];
                                            const scoreColor = score === null ? 'bg-slate-200 text-slate-500' : score >= 80 ? 'bg-emerald-100 text-emerald-700' : score >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-600';
                                            return (
                                            <div key={key} className={`p-5 rounded-2xl border ${key === 'action' ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-100'}`}>
                                                <div className="flex items-center justify-between mb-2">
                                                    <h4 className={`text-[10px] font-black uppercase tracking-widest ${key === 'action' ? 'text-rose-500' : 'text-indigo-400'}`}>{key}</h4>
                                                    <div className="flex items-center gap-1.5">
                                                        {score !== null && (
                                                            <span className={`text-[8px] font-black px-2 py-0.5 rounded-full ${scoreColor}`}>You: {score >= 80 ? '5★' : score >= 50 ? '3★' : '1★'}</span>
                                                        )}
                                                        <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-slate-200 text-slate-400">NCS: {ncsW}%{key === 'action' ? ' ★' : ''}</span>
                                                    </div>
                                                </div>
                                                <p className="text-xs font-medium text-slate-700 leading-relaxed">{value}</p>
                                            </div>
                                        )}) : null}
                                    </div>
                                </section>

                                {/* STAR Mastery Progress — researcher-only (FRAMEWORK.md §9.2) */}
                                {researcherMode && detailedFeedback.masteryTracker && (
                                    <section className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
                                        <h3 className="text-sm font-black uppercase tracking-widest text-indigo-600 mb-2 flex items-center gap-2">
                                            <CheckCircle2 size={16} /> STAR Component Progress
                                        </h3>
                                        <p className="text-[9px] font-medium text-slate-400 mb-6">Which components you consistently demonstrate — consolidated across sessions</p>
                                        <div className="grid grid-cols-2 gap-3">
                                            {(['situation', 'task', 'action', 'result'] as const).map(c => {
                                                const comp = detailedFeedback.masteryTracker![c];
                                                const colors = {
                                                    reached: 'bg-emerald-50 border-emerald-200 text-emerald-700',
                                                    partial: 'bg-amber-50 border-amber-200 text-amber-700',
                                                    not_reached: 'bg-slate-50 border-slate-200 text-slate-500',
                                                };
                                                return (
                                                    <div key={c} className={`p-4 rounded-2xl border ${colors[comp.status]}`}>
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="text-[9px] font-black uppercase tracking-widest">{c}</span>
                                                            {comp.consolidated && <span className="px-2 py-0.5 bg-indigo-100 text-indigo-600 text-[8px] font-black rounded-full uppercase">Consolidated</span>}
                                                        </div>
                                                        <p className="text-[9px] font-medium capitalize">{comp.status.replace('_', ' ')}</p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </section>
                                )}

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

                                {/* Layer B — researcher only */}
                                {researcherMode && detailedFeedback.chcCognitiveDimensions && (
                                    <section className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm" id="report-chc-clusters">
                                        <h3 className="text-sm font-black uppercase tracking-widest text-indigo-600 mb-2 flex items-center gap-2">
                                            <Brain size={16} /> Cognitive Process Signals
                                        </h3>
                                        <p className="text-[9px] font-medium text-slate-400 mb-6">Process Overlap Theory (Kovacs & Conway, 2016) — exploratory proxy</p>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                            {([
                                                { key: 'abstractConceptualisation', label: 'Abstract Conceptualisation', color: 'indigo' },
                                                { key: 'activeExperimentation', label: 'Active Experimentation', color: 'violet' },
                                                { key: 'concreteExperience', label: 'Concrete Experience', color: 'blue' },
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
                                        {detailedFeedback.chcCognitiveDimensions.overallELCNote && (
                                            <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                                                <p className="text-[10px] font-medium text-indigo-800 italic">{detailedFeedback.chcCognitiveDimensions.overallELCNote}</p>
                                            </div>
                                        )}
                                    </section>
                                )}

                                {researcherMode && detailedFeedback.meritVectors && (
                                    <section className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
                                        <h3 className="text-sm font-black uppercase tracking-widest text-indigo-600 mb-2 flex items-center gap-2">
                                            <TrendingUp size={16} /> Behavioral Evidence Vectors
                                        </h3>
                                        <p className="text-[9px] font-medium text-slate-400 mb-6">Levashina & Campion (2007) · Ericsson (2016) — Session performance indicators</p>
                                        <div className="space-y-4">
                                            {(['personalAgency', 'skillSpecificity', 'impactArticulation'] as const).map((key) => {
                                                const v = detailedFeedback.meritVectors?.[key];
                                                if (!v) return null;
                                                const lowest = detailedFeedback.meritVectors?.lowestVector === key;
                                                return (
                                                    <div key={key} className={`p-4 rounded-2xl border ${lowest ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-100'}`}>
                                                        <div className="flex justify-between items-center mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{{ personalAgency: 'Personal Agency', skillSpecificity: 'Skill Specificity', impactArticulation: 'Impact Articulation' }[key]}</span>
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

                                {researcherMode && detailedFeedback.professionalSelfVerificationSignals && (
                                    <section className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
                                        <h3 className="text-sm font-black uppercase tracking-widest text-indigo-600 mb-2 flex items-center gap-2">
                                            <Award size={16} /> Professional Self-Verification
                                        </h3>
                                        <p className="text-[9px] font-medium text-slate-400 mb-6">Cable & Kay (2012) — Authenticity vs. Performance Mode</p>
                                        <div className="space-y-4 mb-4">
                                            {(['voice', 'motivation', 'explanation'] as const).map((key) => {
                                                const d = detailedFeedback.professionalSelfVerificationSignals?.[key];
                                                if (!d) return null;
                                                const isSelfVerifying = d.orientation === 'self_verifying';
                                                return (
                                                    <div key={key} className={`p-4 rounded-2xl border ${isSelfVerifying ? 'bg-emerald-50 border-emerald-100' : d.orientation === 'impression_managing' ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100'}`}>
                                                        <div className="flex justify-between items-center mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 capitalize">{key}</span>
                                                                <span className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-widest rounded-full ${isSelfVerifying ? 'bg-emerald-100 text-emerald-700' : d.orientation === 'impression_managing' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                                                                    {d.orientation?.replace(/_/g, ' ')}
                                                                </span>
                                                            </div>
                                                            <span className={`text-base font-black ${isSelfVerifying ? 'text-emerald-600' : d.orientation === 'impression_managing' ? 'text-amber-600' : 'text-slate-600'}`}>{d.score}</span>
                                                        </div>
                                                        <div className={`h-1.5 rounded-full mb-2 ${isSelfVerifying ? 'bg-emerald-200' : d.orientation === 'impression_managing' ? 'bg-amber-200' : 'bg-slate-200'}`}>
                                                            <div className={`h-full rounded-full ${isSelfVerifying ? 'bg-emerald-500' : d.orientation === 'impression_managing' ? 'bg-amber-500' : 'bg-slate-400'}`} style={{ width: `${d.score}%` }} />
                                                        </div>
                                                        <p className="text-[9px] text-slate-600 leading-snug">{d.evidenceBasis}</p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {detailedFeedback.professionalSelfVerificationSignals?.dominantMode && (
                                            <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 mb-4">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-indigo-600 mb-1">Dominant Mode</p>
                                                <p className="text-[10px] font-bold text-indigo-800 capitalize">{detailedFeedback.professionalSelfVerificationSignals.dominantMode?.replace(/_/g, ' ')}</p>
                                            </div>
                                        )}
                                        {detailedFeedback.professionalSelfVerificationSignals?.fitSignal && (
                                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 mb-2">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Fit Signal</p>
                                                <p className="text-[10px] font-medium text-slate-700 italic">"{detailedFeedback.professionalSelfVerificationSignals.fitSignal}"</p>
                                            </div>
                                        )}
                                        {detailedFeedback.professionalSelfVerificationSignals?.feedbackImplication && (
                                            <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-indigo-600 mb-1">Feedback Implication</p>
                                                <p className="text-[10px] font-medium text-indigo-800">{detailedFeedback.professionalSelfVerificationSignals.feedbackImplication}</p>
                                            </div>
                                        )}
                                    </section>
                                )}

                                {researcherMode && detailedFeedback.scaffoldedLearningSignal && (
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

                                {researcherMode && (detailedFeedback.algorithmicAversionSignal || detailedFeedback.socialIdentityAwareness) && (
                                    <section className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
                                        <h3 className="text-sm font-black uppercase tracking-widest text-indigo-600 mb-6 flex items-center gap-2">
                                            <ShieldCheck size={16} /> Research Guardrails
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {detailedFeedback.algorithmicAversionSignal && (
                                                <div className={`p-5 rounded-2xl border ${detailedFeedback.algorithmicAversionSignal.aversionDetected ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'}`}>
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">AI Trust Calibration</p>
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

                                {/* Calibration Accuracy — researcher only */}
                                {researcherMode && detailedFeedback.calibrationAccuracy && (
                                    <section className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
                                        <h3 className="text-sm font-black uppercase tracking-widest text-indigo-600 mb-2 flex items-center gap-2">
                                            <Scale size={16} /> Self-Calibration Accuracy
                                        </h3>
                                        <p className="text-[9px] font-medium text-slate-400 mb-6">Candidate self-rating vs. AI competency rating — calibration gap signal</p>
                                        <div className="grid grid-cols-2 gap-4 mb-4">
                                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Candidate Self-Rating</p>
                                                <p className="text-sm font-bold text-slate-800">{detailedFeedback.calibrationAccuracy.candidateSelfRating}</p>
                                            </div>
                                            <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-indigo-500 mb-1">AI Competency Rating</p>
                                                <p className="text-sm font-bold text-indigo-800">{detailedFeedback.calibrationAccuracy.aiCompetencyRating}</p>
                                            </div>
                                        </div>
                                        <div className={`p-4 rounded-2xl border mb-4 ${detailedFeedback.calibrationAccuracy.calibrationGap === 'overestimate' ? 'bg-rose-50 border-rose-200' : detailedFeedback.calibrationAccuracy.calibrationGap === 'underestimate' ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Calibration Gap — <span className="capitalize">{detailedFeedback.calibrationAccuracy.calibrationGap}</span></p>
                                            <p className="text-[10px] font-medium text-slate-700 leading-relaxed">{detailedFeedback.calibrationAccuracy.calibrationDirection}</p>
                                        </div>
                                        {detailedFeedback.calibrationAccuracy.priorSessionGaps.length > 0 && (
                                            <div className="mb-4">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Recurring Gaps (Cross-Session)</p>
                                                <ul className="space-y-1">
                                                    {detailedFeedback.calibrationAccuracy.priorSessionGaps.map((g, i) => (
                                                        <li key={i} className="text-[10px] font-medium text-slate-600 flex gap-2"><span className="text-slate-400">→</span>{g}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        <p className="text-[10px] font-medium text-slate-500 italic">{detailedFeedback.calibrationAccuracy.consistentPattern}</p>
                                    </section>
                                )}

                                {/* Empty state when CV was provided but JD wasn't substantive enough */}
                                {cvText && !jdcvAlignmentAnalysis && jobDescription.trim().length < 80 && (
                                    <section className="bg-slate-50 p-8 rounded-[40px] border border-dashed border-slate-200 space-y-3 text-center">
                                        <p className="text-xs font-black uppercase tracking-widest text-slate-400">CV vs Job Description</p>
                                        <p className="text-sm font-medium text-slate-500">
                                            Paste a full job description at setup to see how your CV aligns with the specific requirements of this role.
                                        </p>
                                        <p className="text-[10px] text-slate-400">Without a JD, there are no stated requirements to measure against.</p>
                                    </section>
                                )}

                                {jdcvAlignmentAnalysis && (() => {
                                    const a = jdcvAlignmentAnalysis;
                                    // Pull session responses to jdcv-prefixed questions
                                    const jdcvResponses = sessionLog.filter(e => e.questionText && activeQuestions.find(q => q.text === e.questionText && q.requirements?.[0]?.id?.startsWith('jdcv')));
                                    return (
                                    <section className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-8">
                                        {/* Header */}
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h3 className="text-sm font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2">
                                                    <Target size={16} /> Your CV vs This Job Description
                                                </h3>
                                                <p className="text-[9px] font-medium text-slate-400 mt-1">
                                                    Comparing your CV against the specific requirements in the {targetRole} JD at {companyName}
                                                </p>
                                            </div>
                                            {(() => {
                                                const items = a.experienceAlignment || [];
                                                const strong = items.filter(i => i.alignmentLevel === 'strong').length;
                                                const partial = items.filter(i => i.alignmentLevel === 'partial').length;
                                                const weak = items.filter(i => i.alignmentLevel === 'weak' || i.alignmentLevel === 'missing').length;
                                                const total = items.length || 1;
                                                const strongRatio = (strong + partial * 0.5) / total;
                                                const label = strongRatio >= 0.7 ? 'Strong Fit' : strongRatio >= 0.45 ? 'Good Fit' : strongRatio >= 0.25 ? 'Developing' : 'Gaps to Address';
                                                const cfg = strongRatio >= 0.7
                                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                                    : strongRatio >= 0.45
                                                    ? 'bg-amber-50 border-amber-300 text-amber-700'
                                                    : 'bg-rose-50 border-rose-300 text-rose-700';
                                                return (
                                                    <div className={`px-4 py-2 rounded-2xl border-2 text-center shrink-0 ${cfg}`}>
                                                        <p className="text-xs font-black uppercase tracking-widest">{label}</p>
                                                        <p className="text-[9px] font-bold opacity-70 mt-0.5">{strong} strong · {partial} partial · {weak} gap{weak !== 1 ? 's' : ''}</p>
                                                    </div>
                                                );
                                            })()}
                                        </div>

                                        {/* Summary */}
                                        {a.alignmentSummary && (
                                            <p className="text-sm text-slate-600 leading-relaxed">{a.alignmentSummary}</p>
                                        )}

                                        {/* Experience Alignment — JD requirement vs CV evidence */}
                                        {a.experienceAlignment?.length > 0 && (
                                            <div>
                                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">Experience vs JD Requirements</p>
                                                <div className="space-y-3">
                                                    {a.experienceAlignment.map((item, i) => (
                                                        <div key={i} className={`p-4 rounded-2xl border ${item.alignmentLevel === 'strong' ? 'bg-emerald-50 border-emerald-100' : item.alignmentLevel === 'partial' ? 'bg-amber-50 border-amber-100' : 'bg-rose-50 border-rose-100'}`}>
                                                            <div className="flex items-center justify-between mb-2">
                                                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">{item.jdRequirement}</p>
                                                                <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${item.alignmentLevel === 'strong' ? 'bg-emerald-200 text-emerald-700' : item.alignmentLevel === 'partial' ? 'bg-amber-200 text-amber-700' : item.alignmentLevel === 'weak' ? 'bg-orange-200 text-orange-700' : 'bg-rose-200 text-rose-700'}`}>{item.alignmentLevel}</span>
                                                            </div>
                                                            <p className="text-xs text-slate-600">{item.cvEvidence}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Strength & Gap areas */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {a.strengthAreas?.length > 0 && (
                                                <div>
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600 mb-3">Strength Areas</p>
                                                    <div className="space-y-2">
                                                        {a.strengthAreas.map((s, i) => (
                                                            <div key={i} className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
                                                                <p className="text-[9px] font-black text-emerald-700 uppercase tracking-widest">{s.area}</p>
                                                                <p className="text-[10px] text-slate-600 mt-1">{s.cvEvidence}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {a.gapAreas?.length > 0 && (
                                                <div>
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-rose-600 mb-3">Gap Areas</p>
                                                    <div className="space-y-2">
                                                        {a.gapAreas.map((g, i) => (
                                                            <div key={i} className="p-3 bg-rose-50 rounded-2xl border border-rose-100">
                                                                <p className="text-[9px] font-black text-rose-700 uppercase tracking-widest">{g.area}</p>
                                                                <p className="text-[10px] text-slate-600 mt-1">{g.suggestion}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Keyword audit */}
                                        {a.keywordAudit && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600 mb-2">Keywords Matched</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {(a.keywordAudit.present || []).slice(0, 12).map((kw, i) => (
                                                            <span key={i} className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[9px] font-black border border-emerald-200">{kw}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-rose-600 mb-2">Keywords Missing</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {(a.keywordAudit.missing || []).slice(0, 12).map((kw, i) => (
                                                            <span key={i} className="px-2 py-1 bg-rose-50 text-rose-700 rounded-lg text-[9px] font-black border border-rose-200">{kw}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* How they responded to alignment questions */}
                                        {jdcvResponses.length > 0 && (
                                            <div>
                                                <p className="text-[9px] font-black uppercase tracking-widest text-indigo-500 mb-3">How You Responded to Alignment Questions</p>
                                                <div className="space-y-3">
                                                    {jdcvResponses.map((entry, i) => (
                                                        <div key={i} className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                                                            <p className="text-[10px] font-black text-indigo-700 mb-2">"{entry.questionText}"</p>
                                                            <div className="flex gap-1 mb-2">
                                                                {['S','T','A','R'].map((s, si) => (
                                                                    <div key={si} className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black ${si <= entry.starPhaseReached ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-400'}`}>{s}</div>
                                                                ))}
                                                            </div>
                                                            {entry.summaryReport?.answerOverview && (
                                                                <p className="text-[10px] text-slate-600">{entry.summaryReport.answerOverview}</p>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </section>
                                    );
                                })()}

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

                            {/* ── Continuation ── */}
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
                                        <BookOpen size={16} /> Next Step
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

                                {researcherMode && (
                                    <section className="bg-amber-50 p-6 rounded-[32px] border border-amber-100">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-2">Bias & Fairness Audit</h4>
                                        <p className="text-[11px] font-medium text-amber-800 leading-relaxed italic">
                                            "{detailedFeedback.biasAndFairnessNote}"
                                        </p>
                                    </section>
                                )}

                                {researcherMode && (
                                    <section className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
                                        <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 mb-6 flex items-center gap-2">
                                            <BookOpen size={16} /> Interview Transcript (Masked)
                                        </h3>
                                        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 max-h-96 overflow-y-auto custom-scrollbar">
                                            <p className="text-xs font-medium text-slate-600 leading-relaxed whitespace-pre-wrap">
                                                {typeof detailedFeedback.maskedTranscript === 'object' ? (detailedFeedback.maskedTranscript as any)?.text : detailedFeedback.maskedTranscript || transcript || "No transcript data available."}
                                            </p>
                                        </div>
                                    </section>
                                )}

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

                        {/* ── Per-Question Coaching Breakdown ──────────────────────── */}
                        {sessionLog.length > 0 && (
                            <div className="space-y-6">
                                <div className="flex items-center gap-4 pt-4">
                                    <div className="flex-1 h-px bg-slate-200" />
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl"><FileText size={18} /></div>
                                        <h2 className="text-sm font-black uppercase tracking-widest text-slate-900">Per-Question Coaching</h2>
                                    </div>
                                    <div className="flex-1 h-px bg-slate-200" />
                                </div>
                                {sessionLog.map((entry, idx) => (
                                    <div key={idx} className="bg-white border border-slate-200 rounded-[40px] shadow-sm overflow-hidden">
                                        {/* Question header */}
                                        <div className="px-8 py-6 border-b border-slate-100 flex items-start justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                                <span className="text-[9px] font-black uppercase tracking-widest text-indigo-500">Q{entry.questionIndex + 1} · {CATEGORIES[entry.questionIndex] || 'General'}</span>
                                                <p className="text-base font-bold text-slate-900 mt-1 leading-snug">"{entry.questionText}"</p>
                                            </div>
                                            <div className="flex flex-col items-end gap-1 shrink-0">
                                                <div className="flex gap-1.5">
                                                    {(['S','T','A','R'] as const).map((s, i) => (
                                                        <div key={i} className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black ${i <= entry.starPhaseReached ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-300'}`}>{s}</div>
                                                    ))}
                                                </div>
                                                <div className="flex gap-1.5">
                                                    {(['situation','task','action','result'] as const).map((comp, i) => {
                                                        const st = entry.probeAnalysis?.star_status?.[comp];
                                                        const score = st === 'complete' ? 100 : st === 'partial' ? 50 : st === 'missing' ? 0 : null;
                                                        const label = score !== null ? (score >= 80 ? '5★' : score >= 50 ? '3★' : '1★') : ['15%','15%','60%','10%'][i];
                                                        const color = score === null ? (i === 2 ? 'text-indigo-300' : 'text-slate-200') : score >= 80 ? 'text-emerald-500' : score >= 50 ? 'text-amber-500' : 'text-rose-400';
                                                        return <div key={i} title={score !== null ? `${comp}: ${score >= 80 ? '5★' : score >= 50 ? '3★' : '1★'} · NCS weight ${['15','15','60','10'][i]}%` : `NCS weight ${['15','15','60','10'][i]}%`} className={`w-7 text-center text-[8px] font-bold ${color}`}>{label}</div>;
                                                    })}
                                                </div>
                                                {entry.summaryReport?.competencyDemonstrationLevel && (() => {
                                                    const lvl = entry.summaryReport!.competencyDemonstrationLevel!;
                                                    const colors: Record<string, string> = { Emerging: 'bg-rose-100 text-rose-700 border-rose-200', Developing: 'bg-amber-100 text-amber-700 border-amber-200', Established: 'bg-indigo-100 text-indigo-700 border-indigo-200', Advanced: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
                                                    return <span className={`mt-1 px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${colors[lvl] ?? 'bg-slate-100 text-slate-500 border-slate-200'}`}>{lvl}</span>;
                                                })()}
                                            </div>
                                        </div>

                                        <div className="px-8 py-6 space-y-5">
                                            {/* Response transcript */}
                                            {entry.transcriptSlice && (
                                                <details className="group">
                                                    <summary className="flex items-center justify-between cursor-pointer select-none list-none px-4 py-3 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-slate-100 transition-colors">
                                                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Your Response</span>
                                                        <span className="text-[9px] text-slate-400 group-open:hidden">View ▾</span>
                                                        <span className="text-[9px] text-slate-400 hidden group-open:inline">Close ▴</span>
                                                    </summary>
                                                    <div className="mt-2 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                                        <p className="text-sm text-slate-600 leading-relaxed font-medium">{entry.transcriptSlice}</p>
                                                    </div>
                                                </details>
                                            )}

                                            {/* How your answer grew (ZPD before/after) */}
                                            {entry.act1Analysis && entry.probeAnalysis && (() => {
                                                const signals = ['ownership_language', 'skill_language', 'impact_language'] as const;
                                                const labels: Record<string, string> = { ownership_language: 'Personal ownership', skill_language: 'Skill specificity', impact_language: 'Impact on others' };
                                                const anyChange = signals.some(s => entry.act1Analysis?.behavioural_evidence_signals?.[s] !== entry.probeAnalysis?.behavioural_evidence_signals?.[s]);
                                                if (!anyChange) return null;
                                                return (
                                                    <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100">
                                                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">How Your Answer Grew Under Probing</p>
                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                            {signals.map(s => {
                                                                const before = entry.act1Analysis?.behavioural_evidence_signals?.[s];
                                                                const after = entry.probeAnalysis?.behavioural_evidence_signals?.[s];
                                                                const improved = before === 'absent' && after === 'present';
                                                                if (before === after && before === 'absent') return null;
                                                                return (
                                                                    <div key={s} className="flex items-center justify-between gap-3 px-3 py-2 bg-white rounded-xl border border-slate-100">
                                                                        <span className="text-[10px] text-slate-600 font-medium">{labels[s]}</span>
                                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-lg ${before === 'present' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>{before === 'present' ? '✓' : '–'}</span>
                                                                            <span className="text-[9px] text-slate-300">→</span>
                                                                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-lg ${after === 'present' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>{after === 'present' ? '✓' : '–'}</span>
                                                                            {improved && <span className="text-emerald-500 font-black text-xs">↑</span>}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {entry.summaryReport && (() => {
                                                const r = entry.summaryReport!;
                                                const coachingLocked = !!r.selfAssessmentPrompt && !selfAssessmentResponses[entry.questionIndex];
                                                return (
                                                    <div className="space-y-4">
                                                        {/* Answer overview */}
                                                        {r.answerOverview && <p className="text-sm text-slate-700 leading-relaxed font-medium">{r.answerOverview}</p>}

                                                        {/* Self-assessment gate (kept if present) */}
                                                        {r.selfAssessmentPrompt && coachingLocked && (
                                                            <div className="p-5 bg-indigo-50 border border-indigo-100 rounded-3xl space-y-3">
                                                                <p className="text-[9px] font-black uppercase tracking-widest text-indigo-500">Before You Read the Coaching</p>
                                                                <p className="text-sm font-medium text-indigo-900 italic leading-relaxed">{r.selfAssessmentPrompt}</p>
                                                                <textarea
                                                                    className="w-full text-sm text-slate-700 bg-white border border-indigo-200 rounded-2xl p-3 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400 placeholder:text-slate-300"
                                                                    rows={2}
                                                                    placeholder="Write your honest self-assessment before reading the coaching..."
                                                                    value={selfAssessmentDrafts[entry.questionIndex] || ''}
                                                                    onChange={e => setSelfAssessmentDrafts(prev => ({ ...prev, [entry.questionIndex]: e.target.value }))}
                                                                />
                                                                <button
                                                                    className="w-full text-[9px] font-black uppercase tracking-widest text-white bg-indigo-500 hover:bg-indigo-600 px-4 py-2.5 rounded-xl transition-colors disabled:opacity-40"
                                                                    disabled={!(selfAssessmentDrafts[entry.questionIndex] || '').trim()}
                                                                    onClick={() => { const v = (selfAssessmentDrafts[entry.questionIndex] || '').trim(); if (v) setSelfAssessmentResponses(prev => ({ ...prev, [entry.questionIndex]: v })); }}
                                                                >See Coaching →</button>
                                                            </div>
                                                        )}

                                                        {!coachingLocked && (<>
                                                            {/* Strengths */}
                                                            {r.strengths?.length > 0 && (
                                                                <div className="space-y-2">
                                                                    <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600">What You Did Well</p>
                                                                    {r.strengths.map((s, i) => (
                                                                        <div key={i} className="flex gap-3 p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
                                                                            <span className="text-emerald-500 font-black text-sm shrink-0">✓</span>
                                                                            <p className="text-[12px] text-slate-700 font-medium leading-relaxed">{s}</p>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            {/* Development points */}
                                                            {r.developmentPoints?.length > 0 && (
                                                                <div className="space-y-2">
                                                                    <p className="text-[9px] font-black uppercase tracking-widest text-amber-600">Development Areas</p>
                                                                    {r.developmentPoints.map((dp, i) => (
                                                                        <div key={i} className="p-4 bg-amber-50 rounded-2xl border border-amber-100 space-y-1.5">
                                                                            <p className="text-[11px] font-black text-amber-800">{dp.gap}</p>
                                                                            <p className="text-[11px] text-slate-600 font-medium leading-relaxed">{dp.whyItMatters}</p>
                                                                            <p className="text-[11px] text-slate-700 font-bold leading-relaxed border-l-2 border-amber-300 pl-3">{dp.instruction}</p>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            {/* Probe engagement */}
                                                            {(r.probeEngagement || r.probeCorrelation) && (
                                                                <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 space-y-2">
                                                                    <p className="text-[9px] font-black uppercase tracking-widest text-indigo-500">Probing Analysis</p>
                                                                    {r.probeEngagement && <p className="text-[11px] text-indigo-800 font-medium leading-relaxed">{r.probeEngagement}</p>}
                                                                    {r.probeCorrelation && <p className="text-[11px] text-indigo-700 leading-relaxed font-medium italic">{r.probeCorrelation}</p>}
                                                                </div>
                                                            )}

                                                            {/* CV alignment */}
                                                            {r.cvAlignmentNote && (
                                                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">CV Alignment</p>
                                                                    <p className="text-[11px] text-slate-600 font-medium leading-relaxed">{r.cvAlignmentNote}</p>
                                                                </div>
                                                            )}

                                                            {/* Integrated coaching */}
                                                            {r.integratedCoaching && (
                                                                <div className="p-5 bg-slate-900 rounded-3xl space-y-3">
                                                                    <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Integrated Coaching</p>
                                                                    <p className="text-sm font-bold text-white leading-relaxed">{r.integratedCoaching}</p>
                                                                    {r.forwardOrientation && <p className="text-[11px] text-slate-400 font-medium leading-relaxed border-t border-white/10 pt-3">{r.forwardOrientation}</p>}
                                                                </div>
                                                            )}

                                                            {/* Practice task */}
                                                            {r.practiceTask && (
                                                                <div className="p-4 bg-indigo-600 rounded-2xl">
                                                                    <div className="flex items-center justify-between gap-2 mb-1.5">
                                                                        <p className="text-[9px] font-black uppercase tracking-widest text-indigo-200">Practice Task</p>
                                                                        <div className="flex items-center gap-2">
                                                                            {targetRole && <span className="text-[8px] font-black bg-indigo-500 text-indigo-100 px-2 py-0.5 rounded-full">{targetRole}</span>}
                                                                            {practiceDate && <span className="text-[8px] font-black bg-white/20 text-white px-2 py-0.5 rounded-full">By {practiceDate}</span>}
                                                                        </div>
                                                                    </div>
                                                                    <p className="text-[12px] font-bold text-white leading-relaxed">{r.practiceTask}</p>
                                                                </div>
                                                            )}

                                                            {/* ELC stage trace */}
                                                            {r.elcStages && (
                                                                <details className="group">
                                                                    <summary className="flex items-center gap-2 cursor-pointer select-none list-none px-4 py-3 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-slate-100 transition-colors">
                                                                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Learning Cycle</span>
                                                                        <span className="text-[9px] text-slate-400 ml-auto group-open:hidden">View ▾</span>
                                                                        <span className="text-[9px] text-slate-400 ml-auto hidden group-open:inline">Close ▴</span>
                                                                    </summary>
                                                                    <div className="mt-2 grid grid-cols-2 gap-2 p-3">
                                                                        {([['CE', 'Concrete Experience', r.elcStages.ce], ['RO', 'Reflective Observation', r.elcStages.ro], ['AC', 'Abstract Concept', r.elcStages.ac], ['AE', 'Experimentation', r.elcStages.ae]] as const).map(([code, label, text]) => (
                                                                            <div key={code} className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                                                                <div className="flex items-center gap-2 mb-1"><span className="text-[8px] font-black text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded">{code}</span><span className="text-[8px] font-black uppercase tracking-widest text-slate-400">{label}</span></div>
                                                                                <p className="text-[10px] text-slate-600 font-medium leading-relaxed">{text}</p>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </details>
                                                            )}

                                                            {/* GUIDANCE — probing details */}
                                                            {entry.probe && (
                                                                <details className="group">
                                                                    <summary className="flex items-center gap-2 cursor-pointer select-none list-none px-4 py-3 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-slate-100 transition-colors">
                                                                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Follor-up Guidance</span>
                                                                        <span className="text-[9px] text-slate-400 ml-auto group-open:hidden">View ▾</span>
                                                                        <span className="text-[9px] text-slate-400 ml-auto hidden group-open:inline">Close ▴</span>
                                                                    </summary>
                                                                    <div className="mt-2 p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                                                                        <div className="flex items-center gap-2 flex-wrap">
                                                                            <span className={`px-2.5 py-1 rounded-xl text-[8px] font-black uppercase tracking-widest ${entry.probe.probe_type === 'DEEPENING' ? 'bg-indigo-100 text-indigo-700' : entry.probe.probe_type === 'CLARIFYING' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{entry.probe.probe_type}</span>
                                                                            {entry.probeAnalysis?.depth_delta && <span className={`px-2.5 py-1 rounded-xl text-[8px] font-black uppercase tracking-widest ${entry.probeAnalysis.depth_delta === 'increased' ? 'bg-emerald-100 text-emerald-700' : entry.probeAnalysis.depth_delta === 'decreased' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'}`}>Depth {entry.probeAnalysis.depth_delta}</span>}
                                                                        </div>
                                                                        <p className="text-[11px] text-slate-700 font-bold italic">"{entry.probe.probe}"</p>
                                                                        {entry.probeAnalysis?.interpretation && <p className="text-[10px] text-slate-600 font-medium leading-relaxed">{entry.probeAnalysis.interpretation}</p>}
                                                                    </div>
                                                                </details>
                                                            )}
                                                        </>)}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <ImprovementPlan feedback={detailedFeedback} />
                        </>}

                        {/* ── VISUAL FORMAT ─────────────────────────────────────────── */}
                        {previewMode && reportFormat === 'visual' && (
                        <div className="space-y-8">
                            {/* Priority */}
                            {(detailedFeedback.meritVectors?.primarySuggestionAnchor ?? detailedFeedback.actionableSuggestions?.[0]) && (
                                <div className="p-6 bg-slate-900 rounded-[32px] border border-indigo-500/30">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400 mb-2">Your One Priority</p>
                                    <p className="text-base font-bold text-white leading-relaxed">{detailedFeedback.meritVectors?.primarySuggestionAnchor ?? detailedFeedback.actionableSuggestions[0]}</p>
                                </div>
                            )}
                            {/* STAR 4-column visual */}
                            <section className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-6">STAR Breakdown · NCS 2025 Weightings</p>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {([
                                        { key: 'situation' as const, label: 'Situation', weight: 15, color: 'bg-teal-500', light: 'bg-teal-50 border-teal-200 text-teal-700' },
                                        { key: 'task' as const, label: 'Task', weight: 15, color: 'bg-blue-500', light: 'bg-blue-50 border-blue-200 text-blue-700' },
                                        { key: 'action' as const, label: 'Action', weight: 60, color: 'bg-indigo-600', light: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
                                        { key: 'result' as const, label: 'Result', weight: 10, color: 'bg-purple-500', light: 'bg-purple-50 border-purple-200 text-purple-700' },
                                    ]).map(s => (
                                        <div key={s.key} className={`p-5 rounded-3xl border ${s.light} flex flex-col gap-3`}>
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-black uppercase tracking-widest">{s.label}</span>
                                                <span className={`text-xl font-black ${s.key === 'action' ? 'text-indigo-600' : ''}`}>{s.weight}%</span>
                                            </div>
                                            <div className="h-2 bg-white/60 rounded-full overflow-hidden">
                                                <div className={`h-2 ${s.color} rounded-full`} style={{ width: `${s.weight === 60 ? 100 : s.weight === 15 ? 25 : 17}%` }} />
                                            </div>
                                            <p className="text-[11px] leading-relaxed font-medium">{detailedFeedback.starAnalysis[s.key]}</p>
                                        </div>
                                    ))}
                                </div>
                            </section>
                            {/* Rubric bars — researcher-only, raw numeric scores (FRAMEWORK.md §3.2 Tier 1) */}
                            {researcherMode && <section className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-6">Performance Scores</p>
                                <div className="space-y-5">
                                    {([
                                        { label: 'STAR Completion', score: detailedFeedback.rubrics.starCompletion, note: detailedFeedback.rubrics.justifications.starCompletion },
                                        { label: 'Evidence Specificity', score: detailedFeedback.rubrics.evidenceSpecificity, note: detailedFeedback.rubrics.justifications.evidenceSpecificity },
                                        { label: 'Role Clarity', score: detailedFeedback.rubrics.roleClarity, note: detailedFeedback.rubrics.justifications.roleClarity },
                                        { label: 'JD Alignment', score: detailedFeedback.rubrics.jdAlignment, note: detailedFeedback.rubrics.justifications.jdAlignment },
                                        { label: 'Confidence', score: detailedFeedback.rubrics.confidence, note: detailedFeedback.rubrics.justifications.confidence },
                                    ]).map(r => (
                                        <div key={r.label}>
                                            <div className="flex justify-between items-center mb-1.5">
                                                <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">{r.label}</span>
                                                <span className="text-[11px] font-black text-slate-900">{r.score}<span className="text-slate-300">/5</span></span>
                                            </div>
                                            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                                                <div className={`h-3 rounded-full transition-all duration-700 ${r.score >= 4 ? 'bg-indigo-600' : r.score === 3 ? 'bg-amber-500' : 'bg-rose-400'}`}
                                                    style={{ width: `${r.score * 20}%` }} />
                                            </div>
                                            <p className="text-[10px] text-slate-500 mt-1 font-medium">{r.note}</p>
                                        </div>
                                    ))}
                                </div>
                            </section>}
                            {/* Strengths & Weaknesses cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <section className="bg-emerald-50 p-6 rounded-[32px] border border-emerald-200 space-y-4">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600">Strengths</p>
                                    {detailedFeedback.strengths.map((s, i) => {
                                        const parts = s.split('|');
                                        const headline = parts[0].trim();
                                        const signal = parts.find(p => p.trim().startsWith('Signal:'))?.replace('Signal:', '').trim();
                                        return (
                                            <div key={i} className="bg-white rounded-2xl p-4 border border-emerald-100">
                                                <div className="flex gap-3 items-start">
                                                    <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                                                        <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                                    </div>
                                                    <div>
                                                        <p className="text-[11px] font-bold text-slate-800 leading-relaxed">{headline}</p>
                                                        {signal && <p className="text-[10px] text-emerald-700 font-medium mt-1">{signal}</p>}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </section>
                                <section className="bg-amber-50 p-6 rounded-[32px] border border-amber-200 space-y-4">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-amber-600">Development Areas</p>
                                    {detailedFeedback.weaknesses.map((w, i) => {
                                        const parts = w.split('|');
                                        const headline = parts[0].trim();
                                        const rewrite = parts.find(p => p.trim().startsWith('Interview-standard version:'))?.replace('Interview-standard version:', '').trim();
                                        return (
                                            <div key={i} className="bg-white rounded-2xl p-4 border border-amber-100">
                                                <div className="flex gap-3 items-start">
                                                    <div className="w-6 h-6 bg-amber-400 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                                                        <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                                                    </div>
                                                    <div>
                                                        <p className="text-[11px] font-bold text-slate-800 leading-relaxed">{headline}</p>
                                                        {rewrite && <p className="text-[10px] text-amber-800 italic mt-2 border-l-2 border-amber-300 pl-2">{rewrite}</p>}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </section>
                            </div>
                            {/* Merit vectors bars — researcher-only, raw numeric scores (FRAMEWORK.md §3.2 Tier 1) */}
                            {researcherMode && detailedFeedback.meritVectors && (
                                <section className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-6">Behavioural Evidence Signals</p>
                                    <div className="space-y-4">
                                        {([
                                            { label: 'Personal Agency', score: detailedFeedback.meritVectors!.personalAgency.score, basis: detailedFeedback.meritVectors!.personalAgency.evidenceBasis },
                                            { label: 'Skill Specificity', score: detailedFeedback.meritVectors!.skillSpecificity.score, basis: detailedFeedback.meritVectors!.skillSpecificity.evidenceBasis },
                                            { label: 'Impact Articulation', score: detailedFeedback.meritVectors!.impactArticulation.score, basis: detailedFeedback.meritVectors!.impactArticulation.evidenceBasis },
                                        ]).map(v => (
                                            <div key={v.label}>
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">{v.label}</span>
                                                    <span className="text-[11px] font-black tabular-nums">{v.score}<span className="text-slate-300">/100</span></span>
                                                </div>
                                                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className={`h-2.5 rounded-full ${v.score >= 70 ? 'bg-indigo-600' : v.score >= 50 ? 'bg-amber-500' : 'bg-rose-400'}`}
                                                        style={{ width: `${v.score}%` }} />
                                                </div>
                                                <p className="text-[10px] text-slate-500 mt-1 font-medium">{v.basis}</p>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}
                            {/* Keywords pills */}
                            <section className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-4">Keyword Coverage</p>
                                <div className="space-y-3">
                                    <div className="flex flex-wrap gap-2">
                                        {detailedFeedback.keywordCoverage.found.map(k => (
                                            <span key={k} className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black border border-emerald-200">{k}</span>
                                        ))}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {detailedFeedback.keywordCoverage.missing.map(k => (
                                            <span key={k} className="px-3 py-1.5 bg-slate-100 text-slate-500 rounded-full text-[10px] font-black border border-slate-200 line-through decoration-rose-400">{k}</span>
                                        ))}
                                    </div>
                                    <p className="text-[9px] text-slate-400 font-medium">Green = present · Strikethrough = not used</p>
                                </div>
                            </section>
                            {/* Career roadmap */}
                            <section className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-6">Development Roadmap</p>
                                <div className="flex flex-col gap-3">
                                    {detailedFeedback.careerDevelopment.nextSteps.map((step, i) => (
                                        <div key={i} className="flex gap-4 items-start">
                                            <div className="w-7 h-7 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px] font-black shrink-0">{i + 1}</div>
                                            <p className="text-[12px] font-medium text-slate-700 leading-relaxed pt-1">{step}</p>
                                        </div>
                                    ))}
                                    {detailedFeedback.careerDevelopment.certifications.map((cert, i) => (
                                        <div key={`cert-${i}`} className="flex gap-4 items-start">
                                            <div className="w-7 h-7 bg-amber-400 text-white rounded-full flex items-center justify-center shrink-0">
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>
                                            </div>
                                            <p className="text-[12px] font-medium text-slate-700 leading-relaxed pt-1">{cert}</p>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </div>
                        )}

                        {/* ── DIGEST FORMAT ─────────────────────────────────────────── */}
                        {previewMode && reportFormat === 'digest' && (
                        <div className="space-y-5">
                            {/* At-a-glance header */}
                            <div className="p-6 bg-slate-900 rounded-[32px] border border-indigo-500/20">
                                <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400 mb-4">Session At a Glance</p>
                                {researcherMode && <div className="grid grid-cols-5 gap-3 mb-4">
                                    {([
                                        { label: 'STAR', score: detailedFeedback.rubrics.starCompletion },
                                        { label: 'Evidence', score: detailedFeedback.rubrics.evidenceSpecificity },
                                        { label: 'Clarity', score: detailedFeedback.rubrics.roleClarity },
                                        { label: 'Alignment', score: detailedFeedback.rubrics.jdAlignment },
                                        { label: 'Confidence', score: detailedFeedback.rubrics.confidence },
                                    ]).map(r => (
                                        <div key={r.label} className="text-center">
                                            <div className={`text-2xl font-black ${r.score >= 4 ? 'text-indigo-400' : r.score === 3 ? 'text-amber-400' : 'text-rose-400'}`}>{r.score}<span className="text-slate-600 text-sm">/5</span></div>
                                            <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-1">{r.label}</div>
                                        </div>
                                    ))}
                                </div>}
                                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-1">Priority</p>
                                <p className="text-sm font-bold text-white leading-relaxed">{detailedFeedback.meritVectors?.primarySuggestionAnchor ?? detailedFeedback.actionableSuggestions[0]}</p>
                            </div>
                            {/* Strengths bullets */}
                            <div className="bg-white p-6 rounded-3xl border border-slate-200">
                                <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600 mb-3">What Worked</p>
                                <ul className="space-y-2">
                                    {detailedFeedback.strengths.map((s, i) => (
                                        <li key={i} className="flex gap-3 items-start">
                                            <span className="text-emerald-500 font-black text-base leading-none mt-0.5">✓</span>
                                            <span className="text-[12px] font-medium text-slate-700 leading-relaxed">{s.split('|')[0].trim()}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            {/* Weaknesses bullets */}
                            <div className="bg-white p-6 rounded-3xl border border-slate-200">
                                <p className="text-[9px] font-black uppercase tracking-widest text-amber-600 mb-3">Development Areas</p>
                                <ul className="space-y-2">
                                    {detailedFeedback.weaknesses.map((w, i) => (
                                        <li key={i} className="flex gap-3 items-start">
                                            <span className="text-amber-500 font-black text-base leading-none mt-0.5">△</span>
                                            <span className="text-[12px] font-medium text-slate-700 leading-relaxed">{w.split('|')[0].trim()}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            {/* Suggestions numbered */}
                            <div className="bg-white p-6 rounded-3xl border border-slate-200">
                                <p className="text-[9px] font-black uppercase tracking-widest text-indigo-600 mb-3">Actionable Steps</p>
                                <ol className="space-y-3">
                                    {detailedFeedback.actionableSuggestions.map((s, i) => {
                                        const rewrite = s.split('|').find(p => p.trim().startsWith('Rewrite:'))?.replace('Rewrite:', '').trim() ?? s.split('|')[0].trim();
                                        return (
                                            <li key={i} className="flex gap-3 items-start">
                                                <span className="w-5 h-5 bg-indigo-600 text-white rounded-full text-[9px] font-black flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                                                <span className="text-[12px] font-medium text-slate-700 leading-relaxed">{rewrite}</span>
                                            </li>
                                        );
                                    })}
                                </ol>
                            </div>
                            {/* STAR one-liner per component */}
                            <div className="bg-white p-6 rounded-3xl border border-slate-200">
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">STAR Status</p>
                                <div className="grid grid-cols-2 gap-3">
                                    {([
                                        { label: 'S · Situation', text: detailedFeedback.starAnalysis.situation, w: 15 },
                                        { label: 'T · Task', text: detailedFeedback.starAnalysis.task, w: 15 },
                                        { label: 'A · Action', text: detailedFeedback.starAnalysis.action, w: 60 },
                                        { label: 'R · Result', text: detailedFeedback.starAnalysis.result, w: 10 },
                                    ]).map(c => (
                                        <div key={c.label} className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{c.label}</span>
                                                <span className="text-[9px] font-black text-indigo-600">{c.w}%</span>
                                            </div>
                                            <p className="text-[11px] text-slate-600 leading-snug font-medium">{c.text.split('.')[0]}.</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {/* Keywords compact */}
                            <div className="bg-white p-6 rounded-3xl border border-slate-200">
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3">Keywords</p>
                                <div className="flex flex-wrap gap-1.5 mb-2">
                                    {detailedFeedback.keywordCoverage.found.map(k => <span key={k} className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[9px] font-black">{k}</span>)}
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {detailedFeedback.keywordCoverage.missing.map(k => <span key={k} className="px-2.5 py-1 bg-slate-100 text-slate-400 rounded-full text-[9px] font-black line-through">{k}</span>)}
                                </div>
                            </div>
                            {/* Practice tasks from per-question reports */}
                            {sessionLog.some(e => e.summaryReport?.practiceTask) && (
                                <div className="bg-white p-6 rounded-3xl border border-slate-200">
                                    <div className="flex items-start justify-between gap-4 mb-4">
                                        <div>
                                            <p className="text-[9px] font-black uppercase tracking-widest text-indigo-600">Practice Tasks</p>
                                            {targetRole && <p className="text-[10px] text-slate-400 font-medium mt-0.5">For your {targetRole} interview</p>}
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">Do these by</label>
                                            <input
                                                type="text"
                                                value={practiceDate}
                                                onChange={e => setPracticeDate(e.target.value)}
                                                placeholder="e.g. Friday"
                                                className="w-28 px-3 py-1.5 rounded-xl border border-slate-200 text-[11px] font-bold text-slate-700 placeholder:text-slate-300 focus:outline-none focus:border-indigo-400"
                                            />
                                        </div>
                                    </div>
                                    <ul className="space-y-3">
                                        {sessionLog.filter(e => e.summaryReport?.practiceTask).map((e, i) => (
                                            <li key={i} className="flex gap-3 items-start p-3 bg-indigo-50 rounded-2xl border border-indigo-100">
                                                <span className="text-indigo-500 font-black text-base leading-none mt-0.5 shrink-0">→</span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[11px] font-medium text-slate-700 leading-relaxed">{e.summaryReport!.practiceTask}</p>
                                                    {practiceDate && (
                                                        <p className="text-[9px] font-black text-indigo-500 mt-1.5">Complete by {practiceDate}</p>
                                                    )}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                        )}

                        {/* ── FOCUS FORMAT ──────────────────────────────────────────── */}
                        {previewMode && reportFormat === 'focus' && (
                        <div className="space-y-8">
                            {focusSection === 'star' && (
                                <section className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-6">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl"><Target size={20} /></div>
                                        <h3 className="text-lg font-black uppercase tracking-widest text-slate-900">STAR Analysis</h3>
                                    </div>
                                    <p className="text-slate-700 leading-relaxed font-medium">{detailedFeedback.overallStarSynthesis}</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {([
                                            { label: 'Situation', weight: 15, text: detailedFeedback.starAnalysis.situation },
                                            { label: 'Task', weight: 15, text: detailedFeedback.starAnalysis.task },
                                            { label: 'Action', weight: 60, text: detailedFeedback.starAnalysis.action },
                                            { label: 'Result', weight: 10, text: detailedFeedback.starAnalysis.result },
                                        ]).map(s => (
                                            <div key={s.label} className={`p-5 rounded-3xl border ${s.label === 'Action' ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-200'}`}>
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{s.label}</span>
                                                    <span className={`text-sm font-black ${s.label === 'Action' ? 'text-indigo-600' : 'text-slate-400'}`}>{s.weight}% weight</span>
                                                </div>
                                                <p className="text-[12px] text-slate-700 leading-relaxed font-medium">{s.text}</p>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}
                            {focusSection === 'feedback' && (
                                <section className="space-y-6">
                                    <div className="bg-emerald-50 p-8 rounded-[40px] border border-emerald-200">
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl"><CheckCircle2 size={20} /></div>
                                            <h3 className="text-lg font-black uppercase tracking-widest text-slate-900">Strengths</h3>
                                        </div>
                                        <div className="space-y-4">
                                            {detailedFeedback.strengths.map((s, i) => {
                                                const parts = s.split('|');
                                                return (
                                                    <div key={i} className="bg-white rounded-2xl p-5 border border-emerald-100">
                                                        <p className="text-[11px] font-bold text-slate-800 leading-relaxed mb-2">{parts[0].trim()}</p>
                                                        {parts.slice(1).map((p, j) => <p key={j} className="text-[11px] text-slate-600 font-medium leading-relaxed">{p.trim()}</p>)}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <div className="bg-amber-50 p-8 rounded-[40px] border border-amber-200">
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="p-2 bg-amber-100 text-amber-600 rounded-xl"><ShieldAlert size={20} /></div>
                                            <h3 className="text-lg font-black uppercase tracking-widest text-slate-900">Development Areas</h3>
                                        </div>
                                        <div className="space-y-4">
                                            {detailedFeedback.weaknesses.map((w, i) => {
                                                const parts = w.split('|');
                                                return (
                                                    <div key={i} className="bg-white rounded-2xl p-5 border border-amber-100">
                                                        <p className="text-[11px] font-bold text-slate-800 leading-relaxed mb-2">{parts[0].trim()}</p>
                                                        {parts.slice(1).map((p, j) => <p key={j} className="text-[11px] text-slate-600 font-medium leading-relaxed">{p.trim()}</p>)}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </section>
                            )}
                            {focusSection === 'coaching' && (
                                <section className="space-y-6">
                                    <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl"><Sparkles size={20} /></div>
                                            <h3 className="text-lg font-black uppercase tracking-widest text-slate-900">Coaching &amp; Suggestions</h3>
                                        </div>
                                        <div className="space-y-5">
                                            {detailedFeedback.actionableSuggestions.map((s, i) => {
                                                const parts = s.split('|');
                                                const moment = parts.find(p => p.trim().startsWith('Moment:'))?.replace('Moment:', '').trim();
                                                const rewrite = parts.find(p => p.trim().startsWith('Rewrite:'))?.replace('Rewrite:', '').trim();
                                                const reinforce = parts.find(p => p.trim().startsWith('Reinforce:'))?.replace('Reinforce:', '').trim();
                                                return (
                                                    <div key={i} className="border border-slate-200 rounded-3xl overflow-hidden">
                                                        {moment && <div className="bg-slate-50 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">{moment}</div>}
                                                        {rewrite && <div className="bg-indigo-600 px-5 py-4"><p className="text-[12px] font-bold text-white leading-relaxed italic">"{rewrite}"</p></div>}
                                                        {reinforce && <div className="px-5 py-3"><p className="text-[11px] text-slate-600 font-medium leading-relaxed">{reinforce}</p></div>}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    {detailedFeedback.transcriptAnnotations && detailedFeedback.transcriptAnnotations.length > 0 && (
                                        <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-6">Your Words → Interview Standard</p>
                                            <div className="space-y-4">
                                                {detailedFeedback.transcriptAnnotations.map((a, i) => (
                                                    <div key={i} className="rounded-2xl border border-slate-200 overflow-hidden">
                                                        <div className="bg-slate-50 px-5 py-3 text-[10px] text-slate-500 font-medium">{a.moment}</div>
                                                        <div className="bg-indigo-600 px-5 py-4"><p className="text-[12px] font-bold text-white italic">"{a.standardVersion}"</p></div>
                                                        <div className="px-5 py-3"><p className="text-[11px] text-slate-500 font-medium">{a.principle}</p></div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </section>
                            )}
                            {focusSection === 'insights' && researcherMode && detailedFeedback.meritVectors && (
                                <section className="space-y-6">
                                    <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="p-2 bg-purple-100 text-purple-600 rounded-xl"><Layers size={20} /></div>
                                            <h3 className="text-lg font-black uppercase tracking-widest text-slate-900">Research Insights</h3>
                                        </div>
                                        <div className="space-y-5">
                                            {([
                                                { label: 'Personal Agency', score: detailedFeedback.meritVectors!.personalAgency.score, basis: detailedFeedback.meritVectors!.personalAgency.evidenceBasis, ref: 'Merit Vector' },
                                                { label: 'Skill Specificity', score: detailedFeedback.meritVectors!.skillSpecificity.score, basis: detailedFeedback.meritVectors!.skillSpecificity.evidenceBasis, ref: 'Merit Vector' },
                                                { label: 'Impact Articulation', score: detailedFeedback.meritVectors!.impactArticulation.score, basis: detailedFeedback.meritVectors!.impactArticulation.evidenceBasis, ref: 'Merit Vector' },
                                            ]).map(v => (
                                                <div key={v.label} className="p-5 bg-slate-50 rounded-3xl border border-slate-100">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">{v.label}</span>
                                                        <span className="text-xl font-black text-indigo-600">{v.score}<span className="text-slate-300 text-sm">/100</span></span>
                                                    </div>
                                                    <div className="h-2 bg-slate-200 rounded-full mb-3"><div className={`h-2 rounded-full ${v.score >= 70 ? 'bg-indigo-600' : v.score >= 50 ? 'bg-amber-500' : 'bg-rose-400'}`} style={{ width: `${v.score}%` }} /></div>
                                                    <p className="text-[11px] text-slate-600 font-medium leading-relaxed">{v.basis}</p>
                                                    <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">{v.ref}</span>
                                                </div>
                                            ))}
                                        </div>
                                        {detailedFeedback.scaffoldedLearningSignal && (
                                            <div className="mt-6 p-5 bg-indigo-50 rounded-3xl border border-indigo-100">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-indigo-600 mb-2">ZPD Scaffold Dependency</p>
                                                <div className="flex items-center gap-4">
                                                    <div className="text-2xl font-black text-indigo-600">{detailedFeedback.scaffoldedLearningSignal!.scaffoldDependency.score}<span className="text-indigo-300 text-sm">/100</span></div>
                                                    <div>
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-700">{detailedFeedback.scaffoldedLearningSignal!.scaffoldDependency.interpretation}</p>
                                                        <p className="text-[10px] text-indigo-600 font-medium mt-0.5">{detailedFeedback.scaffoldedLearningSignal!.zpdProgressionObservation}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </section>
                            )}
                            {focusSection === 'cv' && (
                                <section className="space-y-6">
                                    {detailedFeedback.cvMissedOpportunities && detailedFeedback.cvMissedOpportunities.length > 0 ? (
                                        <div className="bg-amber-50 p-8 rounded-[40px] border-2 border-amber-200 space-y-5">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-amber-600">CV Evidence You Didn't Deploy</p>
                                            {detailedFeedback.cvMissedOpportunities.map((opp, i) => (
                                                <div key={i} className="bg-white rounded-3xl p-6 border border-amber-100 space-y-3">
                                                    <div><span className="text-[9px] font-black uppercase tracking-widest text-amber-500">CV Item</span><p className="text-sm font-bold text-slate-800 mt-1">{opp.cvItem}</p></div>
                                                    <div><span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Where It Applied</span><p className="text-[12px] text-slate-600 font-medium mt-1">{opp.questionContext}</p></div>
                                                    <div><span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Why It Fits</span><p className="text-[12px] text-slate-600 font-medium mt-1">{opp.whyItFits}</p></div>
                                                    <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200"><span className="text-[9px] font-black uppercase tracking-widest text-amber-600">How to Use It</span><p className="text-[12px] text-amber-900 font-bold italic mt-1">"{opp.exampleUsage}"</p></div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="p-8 bg-emerald-50 rounded-[40px] border border-emerald-200 text-center">
                                            <p className="text-sm font-bold text-emerald-700">No CV gaps identified — your examples deployed your background well.</p>
                                        </div>
                                    )}
                                </section>
                            )}
                            {focusSection === 'practice' && (
                                <section className="space-y-5">
                                    <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
                                        <div className="flex items-start justify-between gap-4 mb-6">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl"><TrendingUp size={20} /></div>
                                                <div>
                                                    <h3 className="text-lg font-black uppercase tracking-widest text-slate-900">Practice Tasks</h3>
                                                    {targetRole && <p className="text-[10px] text-slate-400 font-medium mt-0.5">For your {targetRole} interview</p>}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">Do these by</label>
                                                <input
                                                    type="text"
                                                    value={practiceDate}
                                                    onChange={e => setPracticeDate(e.target.value)}
                                                    placeholder="e.g. Friday"
                                                    className="w-28 px-3 py-1.5 rounded-xl border border-slate-200 text-[11px] font-bold text-slate-700 placeholder:text-slate-300 focus:outline-none focus:border-indigo-400"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            {sessionLog.filter(e => e.summaryReport?.practiceTask).map((e, i) => (
                                                <div key={i} className="p-5 bg-slate-50 rounded-3xl border border-slate-100">
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Q{i + 1} · {e.questionText.substring(0, 60)}…</p>
                                                    <p className="text-[12px] font-bold text-slate-800 leading-relaxed">{e.summaryReport!.practiceTask}</p>
                                                    {practiceDate && <p className="text-[9px] font-black text-indigo-500 mt-2">Complete by {practiceDate}</p>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-6">Recommended Development</p>
                                        <div className="space-y-4">
                                            {detailedFeedback.careerDevelopment.nextSteps.map((step, i) => (
                                                <div key={i} className="flex gap-4 items-start">
                                                    <div className="w-7 h-7 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px] font-black shrink-0">{i + 1}</div>
                                                    <p className="text-[12px] font-medium text-slate-700 leading-relaxed pt-1">{step}</p>
                                                </div>
                                            ))}
                                            {detailedFeedback.careerDevelopment.certifications.map((cert, i) => (
                                                <div key={`cert-${i}`} className="flex gap-4 items-start">
                                                    <Award size={18} className="text-amber-500 shrink-0 mt-0.5" />
                                                    <p className="text-[12px] font-medium text-slate-700 leading-relaxed">{cert}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </section>
                            )}
                        </div>
                        )}

                        </>
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
                                                    <span className="text-[11px] font-black">
                                                        {coachingMode === 'star' ? STAR_LABELS[idx][0] : idx + 1}
                                                    </span>
                                                </div>
                                                <div className="flex-1">
                                                    {coachingMode === 'star' && (
                                                        <span className={`text-[9px] font-black uppercase tracking-widest ${idx === starPhase ? 'text-indigo-600' : 'text-slate-500'}`}>{STAR_LABELS[idx]}</span>
                                                    )}
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
                                    {condition !== 'minimal' && currentQuestion.difficulty && (
                                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter ${currentQuestion.difficulty === 'easy' ? 'bg-emerald-100 text-emerald-700' :
                                            currentQuestion.difficulty === 'medium' ? 'bg-amber-100 text-amber-700' :
                                                'bg-rose-100 text-rose-700'
                                            }`}>
                                            {currentQuestion.difficulty}
                                        </span>
                                    )}
                                    {condition !== 'minimal' && (
                                        <span className="text-[9px] font-black text-slate-400 tabular-nums">{currentQuestionIndex + 1}/{activeQuestions.length}</span>
                                    )}
                                    {demoMode && (
                                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[8px] font-black uppercase tracking-widest border border-amber-200">Demo</span>
                                    )}
                                </div>
                                {condition !== 'minimal' && (
                                    <div id="ascend-phase-indicators" className="flex gap-1.5">
                                        {STAR_LABELS.map((_, i) => (
                                            <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${starPhase === i ? 'w-10 bg-indigo-600 shadow-sm' : 'w-2 bg-slate-200'}`} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                id="ascend-deep-probe-button"
                                onClick={triggerProbing}
                                disabled={isGeneratingProbe || transcript.length < 20 || currentQuestionIndex === 0}
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
                            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Video Hidden Speak when ready</p>
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
                                ) : coachingMode === 'star' ? `Speak: ${STAR_LABELS[starPhase]}` : `Speak: Part ${starPhase + 1}`
                            ) : 'Stop Speaking'}
                        </button>
                        <button id="ascend-next-step-button" onClick={handleNextPhase} disabled={isGeneratingFeedback} className="px-8 py-4 bg-white border border-slate-200 rounded-2xl font-bold text-slate-700 shadow-md hover:bg-slate-50 transition-all hover:translate-x-1 disabled:opacity-50 disabled:cursor-not-allowed">
                            {isProbingActive
                                ? (currentQuestionIndex < activeQuestions.length - 1 ? 'Next Question →' : 'Finish Session')
                                : starPhase < 3
                                    ? 'Next Step'
                                    : currentQuestionIndex >= activeQuestions.length - 1
                                        ? (isGeneratingFeedback ? 'Preparing Report...' : 'Finish Session')
                                        : 'Deep Analyse & Advance'}
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
                            {isProbingActive ? 'Probing Pipeline' : currentQuestionIndex >= activeQuestions.length - 1 && starPhase >= 3 ? 'Session Complete' : 'Coherence Auditor'}
                        </h3>
                        <p className="text-xs font-bold text-slate-900 leading-tight">
                            {isProbingActive ? 'Deep Domain Analysis' : currentQuestionIndex >= activeQuestions.length - 1 && starPhase >= 3 ? 'Review your Report Tab, then click Finish Session.' : `"${currentQuestion.text}"`}
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
                        <div className="flex border-b bg-slate-50/30 p-1 gap-0.5">
                            {(['plan', 'notes', 'transcript', 'insights', 'report'] as ToolkitTab[]).map((tab) => (
                                <button
                                    key={tab}
                                    id={`tab-${tab}`}
                                    onClick={() => setActiveTab(tab)}
                                    className={`flex-1 py-2.5 text-[8px] font-black uppercase tracking-tight transition-all relative ${activeTab === tab
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
                                            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">
                                                {COACHING_HEADERS[coachingMode]}
                                            </h4>

                                            {coachingMode === 'motivational' && (
                                                <p className="text-[10px] text-indigo-500 font-medium mb-3 leading-relaxed">
                                                    Your introduction sets the tone for the entire interview. Take the interviewer through <span className="font-black">who you are</span>, the experiences that shaped you, <span className="font-black">what makes you genuinely different</span>, and why this opportunity matters to you. Interviewers remember candidates who tell a coherent story rather than listing their qualifications.
                                                </p>
                                            )}
                                            {coachingMode === 'situational' && (
                                                <p className="text-[10px] text-indigo-500 font-medium mb-3 leading-relaxed">
                                                    Academic projects, placements, society roles, and part-time work are all strong evidence of your capability. Focus on <span className="font-black">what you personally contributed</span> rather than what your group achieved together.
                                                </p>
                                            )}
                                            {coachingMode === 'jdcv' && (
                                                <p className="text-[10px] text-indigo-500 font-medium mb-3 leading-relaxed">
                                                    This question is drawn directly from your CV and the job description. Use your real experience to address what this role requires, and make the connection between your background and the opportunity explicit.
                                                </p>
                                            )}
                                            {coachingMode === 'jd-understanding' && (
                                                <p className="text-[10px] text-indigo-500 font-medium mb-3 leading-relaxed">
                                                    Show the interviewer that you have thought carefully about what this role actually involves beyond the job title. Candidates who understand the real demands of a role stand out immediately.
                                                </p>
                                            )}
                                            {coachingMode === 'cv-competency' && (
                                                <p className="text-[10px] text-indigo-500 font-medium mb-3 leading-relaxed">
                                                    This question is probing a specific claim or achievement from your CV. The more precise and concrete your answer, the more credible it becomes. Vague answers about things you have listed tend to raise more questions than they answer.
                                                </p>
                                            )}

                                            {/* Keyword Pathfinder — scaffolded condition only */}
                                            {liveTools.keywordPathfinder && currentQuestion.keywords?.length > 0 && (
                                                <div className="mb-4 p-3 bg-indigo-50 rounded-2xl border border-indigo-100">
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-indigo-500 mb-2">Keywords to hit</p>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {currentQuestion.keywords.map(kw => {
                                                            const hit = transcript.toLowerCase().includes(kw.toLowerCase());
                                                            return (
                                                                <span key={kw} className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                                                                    hit
                                                                        ? 'bg-emerald-100 text-emerald-700 line-through opacity-60'
                                                                        : 'bg-white border border-indigo-200 text-indigo-600'
                                                                }`}>
                                                                    {hit ? '✓ ' : ''}{kw}
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="space-y-3">
                                                {currentQuestion.requirements.map((req, idx) => (
                                                    <div key={req.id} className="flex items-start gap-3">
                                                        <div className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-black transition-all ${
                                                            idx < starPhase ? 'bg-emerald-500 border-emerald-500 text-white' :
                                                            idx === starPhase ? 'bg-white border-indigo-600 text-indigo-600 shadow-sm' :
                                                            'bg-white border-slate-200 text-slate-300'
                                                        }`}>
                                                            {idx < starPhase ? '✓' : idx + 1}
                                                        </div>
                                                        <div className="flex-1">
                                                            {coachingMode === 'star' && (
                                                                <p className={`text-[10px] font-black uppercase tracking-widest ${
                                                                    idx < starPhase ? 'text-emerald-600' :
                                                                    idx === starPhase ? 'text-indigo-600' : 'text-slate-400'
                                                                }`}>
                                                                    {STAR_LABELS[idx]}
                                                                </p>
                                                            )}
                                                            {coachingMode === 'motivational' && (
                                                                <p className={`text-[10px] font-black uppercase tracking-widest ${
                                                                    idx < starPhase ? 'text-emerald-600' :
                                                                    idx === starPhase ? 'text-indigo-600' : 'text-slate-400'
                                                                }`}>
                                                                    {MOTIVATIONAL_PHASE_LABELS[idx]}
                                                                </p>
                                                            )}
                                                            {coachingMode === 'situational' && (
                                                                <p className={`text-[10px] font-black uppercase tracking-widest ${
                                                                    idx < starPhase ? 'text-emerald-600' :
                                                                    idx === starPhase ? 'text-indigo-600' : 'text-slate-400'
                                                                }`}>
                                                                    {SITUATIONAL_PHASE_LABELS[idx]}
                                                                </p>
                                                            )}
                                                            {liveTools.questionChecklist && (
                                                                <p className={`text-[11px] font-medium leading-tight mt-0.5 ${
                                                                    idx === starPhase ? 'text-slate-900' : 'text-slate-400'
                                                                }`}>
                                                                    {req.text}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Competency label */}
                                            {currentQuestion.competency && (
                                                <div className="mt-4 flex items-center gap-2">
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Assessing</span>
                                                    <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                                                        {currentQuestion.competency}
                                                    </span>
                                                </div>
                                            )}

                                            {/* Excellence benchmark */}
                                            {currentQuestion.excellenceBenchmark && (
                                                <div className="mt-3 p-3 bg-amber-50 border border-amber-100 rounded-lg">
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-amber-600 mb-1">What excellent looks like</p>
                                                    <p className="text-[10px] text-amber-800 leading-relaxed font-medium">
                                                        {currentQuestion.excellenceBenchmark}
                                                    </p>
                                                </div>
                                            )}
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
                                            {coachingMode === 'motivational'
                                                ? <>Move naturally through each section as though you are sharing your story rather than reading from a checklist. The <span className="font-black uppercase tracking-widest">Direction</span> section is where many candidates lose momentum, so give genuine thought to how you connect your past to where you want to go.</>
                                                : coachingMode === 'situational'
                                                ? <>Academic and placement experiences carry real weight in interviews. The <span className="font-black uppercase tracking-widest">Actions</span> section is your opportunity to show exactly what you personally contributed, so be as specific as you can.</>
                                                : <>Interviewers remember the <span className="font-black uppercase tracking-widest">Action</span> section most. Phrases like &quot;I decided&quot; and &quot;I built&quot; create a stronger impression than &quot;we tried&quot;. Always close with a <span className="font-black uppercase tracking-widest">measurable Result</span>.</>
                                            }
                                        </p>
                                    </div>

                                    {isGeneratingProbe && (
                                        <div className="p-8 flex flex-col items-center justify-center text-center gap-4 bg-indigo-50/30 rounded-[32px] border-2 border-dashed border-indigo-100 animate-pulse">
                                            <div className="w-12 h-12 border-4 border-indigo-50 border-t-indigo-600 rounded-full animate-spin" />
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600">{reassuringMessage || "The next question is on its way. Be focused, Be ready"}</p>
                                                {reassuringMessage && !reassuringMessage.includes("redirecting") && (
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">You are doing well. Stay focused, the follow-up question will be ready in a while. Till then relax!</p>
                                                )}
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
                                        {transcriptionError ? (
                                            <p className="text-[11px] font-bold text-rose-600 leading-relaxed">{transcriptionError}</p>
                                        ) : (
                                            <p className="text-[11px] font-medium text-slate-600 leading-relaxed whitespace-pre-wrap">
                                                {transcript || "Awaiting verbal input..."}
                                            </p>
                                        )}
                                    </div>
                                    {isTranscribing && !transcriptionError && (
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

                                    {/* Learning Intention — set before session, assessed in feedback (SDT autonomy + goal-setting theory) */}
                                    {!detailedFeedback ? (
                                        <div className="p-3 bg-violet-50 border border-violet-200 rounded-2xl space-y-2">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-violet-500">Session Learning Goal</p>
                                            <p className="text-[10px] text-slate-500 leading-relaxed">What do you most want to improve in today's practice? Your feedback will assess whether you achieved it.</p>
                                            <textarea
                                                value={learningIntention}
                                                onChange={e => setLearningIntention(e.target.value)}
                                                placeholder="e.g. I want to give stronger Result statements with a specific outcome or number..."
                                                className="w-full text-[11px] text-slate-700 bg-white border border-violet-200 rounded-xl p-2 resize-none focus:outline-none focus:ring-1 focus:ring-violet-400 placeholder:text-slate-300"
                                                rows={2}
                                            />
                                        </div>
                                    ) : detailedFeedback.intentionAssessment ? (
                                        <div className="p-3 bg-violet-50 border border-violet-200 rounded-2xl space-y-1">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-violet-500">Goal Achievement</p>
                                            {learningIntention && <p className="text-[9px] text-violet-400 italic">Your goal: {learningIntention}</p>}
                                            <p className="text-[11px] font-medium text-violet-900 leading-relaxed">{detailedFeedback.intentionAssessment}</p>
                                        </div>
                                    ) : null}
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
                                                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                                                        <div className="flex gap-1">
                                                            {['S', 'T', 'A', 'R'].map((s, i) => (
                                                                <div key={i} className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black ${i <= entry.starPhaseReached ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-300'}`}>{s}</div>
                                                            ))}
                                                        </div>
                                                        <div className="flex gap-1">
                                                            {(['situation','task','action','result'] as const).map((comp, i) => {
                                                                const st = entry.probeAnalysis?.star_status?.[comp];
                                                                const score = st === 'complete' ? 100 : st === 'partial' ? 50 : st === 'missing' ? 0 : null;
                                                                const label = score !== null ? (score >= 80 ? '5★' : score >= 50 ? '3★' : '1★') : ['15%','15%','60%','10%'][i];
                                                                const color = score === null ? (i === 2 ? 'text-indigo-300' : 'text-slate-200') : score >= 80 ? 'text-emerald-500' : score >= 50 ? 'text-amber-500' : 'text-rose-400';
                                                                return <div key={i} title={score !== null ? `${comp}: ${score >= 80 ? '5★' : score >= 50 ? '3★' : '1★'} · NCS weight ${['15','15','60','10'][i]}%` : `NCS weight ${['15','15','60','10'][i]}%`} className={`w-5 text-center text-[7px] font-bold ${color}`}>{label}</div>;
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* RESPONSE — candidate's actual transcript for this question */}
                                                {entry.transcriptSlice && (
                                                    <details className="group">
                                                        <summary className="flex items-center justify-between cursor-pointer select-none list-none p-2.5 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100 transition-colors">
                                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Your Response</span>
                                                            <span className="text-[9px] text-slate-400 group-open:hidden">View ▾</span>
                                                            <span className="text-[9px] text-slate-400 hidden group-open:inline">Close ▴</span>
                                                        </summary>
                                                        <div className="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-100 max-h-40 overflow-y-auto">
                                                            <p className="text-[10px] text-slate-600 leading-relaxed whitespace-pre-wrap font-medium">{entry.transcriptSlice}</p>
                                                        </div>
                                                    </details>
                                                )}

                                                {/* Rich Summary Report */}
                                                {entry.summaryReport ? (
                                                    <div className="space-y-3">
                                                        {/* FEEDBACK label */}
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex-1 h-px bg-slate-100" />
                                                            <span className="text-[8px] font-black uppercase tracking-widest text-slate-300">Feedback</span>
                                                            <div className="flex-1 h-px bg-slate-100" />
                                                        </div>

                                                        {/* Component 1 — Self-Assessment Prompt (Boud & Molloy 2013: active metacognition before coaching unlocks) */}
                                                        {entry.summaryReport.selfAssessmentPrompt && (
                                                            <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-2xl space-y-2">
                                                                <p className="text-[9px] font-black uppercase tracking-widest text-indigo-500">Before You Read the Coaching</p>
                                                                <p className="text-[11px] font-medium text-indigo-900 leading-relaxed italic">{entry.summaryReport.selfAssessmentPrompt}</p>
                                                                {!selfAssessmentResponses[entry.questionIndex] ? (
                                                                    <>
                                                                        <textarea
                                                                            className="w-full text-[11px] text-slate-700 bg-white border border-indigo-200 rounded-xl p-2 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400 placeholder:text-slate-300"
                                                                            rows={2}
                                                                            placeholder="Write your honest self-assessment here before reading the coaching..."
                                                                            value={selfAssessmentDrafts[entry.questionIndex] || ''}
                                                                            onChange={e => setSelfAssessmentDrafts(prev => ({ ...prev, [entry.questionIndex]: e.target.value }))}
                                                                        />
                                                                        <button
                                                                            className="w-full text-[9px] font-black uppercase tracking-widest text-white bg-indigo-500 hover:bg-indigo-600 px-3 py-2 rounded-xl transition-colors disabled:opacity-40"
                                                                            disabled={!(selfAssessmentDrafts[entry.questionIndex] || '').trim()}
                                                                            onClick={() => {
                                                                                const r = (selfAssessmentDrafts[entry.questionIndex] || '').trim();
                                                                                if (r) setSelfAssessmentResponses(prev => ({ ...prev, [entry.questionIndex]: r }));
                                                                            }}
                                                                        >
                                                                            See Coaching →
                                                                        </button>
                                                                    </>
                                                                ) : (
                                                                    <div className="p-2 bg-indigo-100 rounded-xl">
                                                                        <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400 mb-1">Your Self-Assessment</p>
                                                                        <p className="text-[10px] text-indigo-800 italic leading-relaxed">{selfAssessmentResponses[entry.questionIndex]}</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Before/After Comparison — ZPD gap made visible (Vygotsky 1978) */}
                                                        {(!entry.summaryReport.selfAssessmentPrompt || selfAssessmentResponses[entry.questionIndex]) && entry.act1Analysis && entry.probeAnalysis && (() => {
                                                            const signals = ['ownership_language', 'skill_language', 'impact_language'] as const;
                                                            const labels: Record<string, string> = { ownership_language: 'Personal ownership', skill_language: 'Skill specificity', impact_language: 'Impact on others' };
                                                            const anyChange = signals.some(s =>
                                                                entry.act1Analysis?.behavioural_evidence_signals?.[s] !== entry.probeAnalysis?.behavioural_evidence_signals?.[s]
                                                            );
                                                            if (!anyChange) return null;
                                                            return (
                                                                <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl">
                                                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">How Your Answer Grew</p>
                                                                    <div className="space-y-1.5">
                                                                        {signals.map(s => {
                                                                            const before = entry.act1Analysis?.behavioural_evidence_signals?.[s];
                                                                            const after = entry.probeAnalysis?.behavioural_evidence_signals?.[s];
                                                                            const improved = before === 'absent' && after === 'present';
                                                                            const unchanged = before === after;
                                                                            if (unchanged && before === 'absent') return null;
                                                                            return (
                                                                                <div key={s} className="flex items-center justify-between gap-2">
                                                                                    <span className="text-[10px] text-slate-600">{labels[s]}</span>
                                                                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                                                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${before === 'present' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>{before === 'present' ? '✓' : '–'}</span>
                                                                                        <span className="text-[8px] text-slate-300">→</span>
                                                                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${after === 'present' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>{after === 'present' ? '✓' : '–'}</span>
                                                                                        {improved && <span className="text-[9px] text-emerald-600 font-black ml-0.5">↑</span>}
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })()}

                                                        {/* Gate coaching content on self-assessment submission when prompt exists */}
                                                        {entry.summaryReport.selfAssessmentPrompt && !selfAssessmentResponses[entry.questionIndex] ? null : (<>

                                                        {/* Competency Demonstration Level badge */}
                                                        {entry.summaryReport.competencyDemonstrationLevel && (() => {
                                                            const lvl = entry.summaryReport.competencyDemonstrationLevel!;
                                                            const cfg = {
                                                                Emerging:    { bg: 'bg-slate-100',  text: 'text-slate-600'   },
                                                                Developing:  { bg: 'bg-amber-100',  text: 'text-amber-800'   },
                                                                Established: { bg: 'bg-emerald-100', text: 'text-emerald-800' },
                                                                Advanced:    { bg: 'bg-indigo-100', text: 'text-indigo-800'  },
                                                            }[lvl];
                                                            return (
                                                                <div className={`px-3 py-2 rounded-xl flex items-center justify-between ${cfg.bg}`}>
                                                                    <span className={`text-[9px] font-black uppercase tracking-widest ${cfg.text}`}>Competency Demonstration</span>
                                                                    <span className={`text-[9px] font-black uppercase tracking-widest ${cfg.text}`}>{lvl}</span>
                                                                </div>
                                                            );
                                                        })()}

                                                        {/* Overview */}
                                                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Answer Overview</p>
                                                            <p className="text-[11px] font-medium text-slate-700 leading-relaxed">{entry.summaryReport.answerOverview}</p>
                                                        </div>

                                                        {/* Strengths */}
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

                                                        {/* GUIDANCE divider */}
                                                        <div className="flex items-center gap-2 pt-1">
                                                            <div className="flex-1 h-px bg-slate-100" />
                                                            <span className="text-[8px] font-black uppercase tracking-widest text-slate-300">Guidance</span>
                                                            <div className="flex-1 h-px bg-slate-100" />
                                                        </div>

                                                        {/* Development Points */}
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

                                                        {/* CV Alignment Note */}
                                                        {entry.summaryReport.cvAlignmentNote && (
                                                            <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-100">
                                                                <p className="text-[9px] font-black uppercase tracking-widest text-indigo-500 mb-1">Your Background & This Answer</p>
                                                                <p className="text-[10px] font-medium text-indigo-800 leading-relaxed">{entry.summaryReport.cvAlignmentNote}</p>
                                                            </div>
                                                        )}

                                                        {/* Probe Engagement */}
                                                        {entry.summaryReport.probeEngagement && (
                                                            <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-100">
                                                                <p className="text-[9px] font-black uppercase tracking-widest text-indigo-500 mb-1">Probe Engagement</p>
                                                                <p className="text-[10px] font-medium text-indigo-800 leading-relaxed">{entry.summaryReport.probeEngagement}</p>
                                                            </div>
                                                        )}

                                                        {/* Act-Probe Correlation */}
                                                        {entry.summaryReport.probeCorrelation && (
                                                            <div className="p-3 bg-indigo-50/50 rounded-2xl border border-indigo-100 border-dashed">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <Layers size={10} className="text-indigo-400" />
                                                                    <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Act-Probe Correlation</p>
                                                                </div>
                                                                <p className="text-[10px] font-medium text-indigo-800/80 leading-relaxed">{entry.summaryReport.probeCorrelation}</p>
                                                            </div>
                                                        )}

                                                        {/* Integrated Coaching */}
                                                        {entry.summaryReport.integratedCoaching && (
                                                            <div className="p-3 bg-indigo-600 rounded-2xl border border-indigo-700 shadow-lg shadow-indigo-900/10">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <Sparkles size={10} className="text-indigo-200" />
                                                                    <p className="text-[9px] font-black uppercase tracking-widest text-indigo-100">Integrated Excellence Guidance</p>
                                                                </div>
                                                                <p className="text-[10px] font-bold text-white leading-relaxed">{entry.summaryReport.integratedCoaching}</p>
                                                            </div>
                                                        )}

                                                        {/* Forward Orientation */}
                                                        {entry.summaryReport.forwardOrientation && (
                                                            <div className="p-3 bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl">
                                                                <p className="text-[9px] font-black uppercase tracking-widest text-indigo-200 mb-1">Where This Takes You</p>
                                                                <p className="text-[10px] font-medium text-white leading-relaxed">{entry.summaryReport.forwardOrientation}</p>
                                                            </div>
                                                        )}

                                                        {/* One Thing to Practise */}
                                                        {entry.summaryReport.practiceTask && (
                                                            <div className="p-3 bg-slate-900 rounded-2xl">
                                                                <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400 mb-1">One Thing to Practise</p>
                                                                <p className="text-[11px] font-bold text-white leading-snug">{entry.summaryReport.practiceTask}</p>
                                                            </div>
                                                        )}

                                                        {/* AMO Performance Context — shown when conditions affected performance */}
                                                        {entry.summaryReport.amoContextNote && (
                                                            <div className="p-3 bg-amber-50 border border-amber-100 rounded-2xl">
                                                                <p className="text-[9px] font-black uppercase tracking-widest text-amber-600 mb-1">Performance Context</p>
                                                                <p className="text-[11px] font-medium text-slate-700 leading-relaxed">{entry.summaryReport.amoContextNote}</p>
                                                            </div>
                                                        )}

                                                        {/* Per-question Kolb ELC stage trace */}
                                                        {entry.summaryReport.elcStages && (
                                                            <ELCQuestionTrace stages={entry.summaryReport.elcStages} />
                                                        )}
                                                        </>)}
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

                                                {/* PROBING section */}
                                                {entry.probe && (
                                                    <div className="space-y-2">
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex-1 h-px bg-slate-100" />
                                                            <span className="text-[8px] font-black uppercase tracking-widest text-slate-300">Probing</span>
                                                            <div className="flex-1 h-px bg-slate-100" />
                                                        </div>
                                                        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
                                                            <span className="text-[8px] font-black uppercase tracking-widest text-indigo-400">Follow-up · {entry.probe.probe_type.replace(/_/g, ' ')}</span>
                                                            <p className="text-[11px] font-bold text-indigo-900 mt-1 leading-tight">&ldquo;{entry.probe.probe}&rdquo;</p>
                                                            {entry.probe.rationale && (
                                                                <p className="text-[9px] text-indigo-500 mt-1.5 leading-relaxed italic">{entry.probe.rationale}</p>
                                                            )}
                                                        </div>
                                                        {entry.probeAnalysis && (
                                                            <div className="px-3 py-2 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5">
                                                                <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Probing Outcome</p>
                                                                <div className="flex flex-wrap gap-1.5">
                                                                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${entry.probeAnalysis.depth_delta === 'increased' ? 'bg-emerald-100 text-emerald-700' : entry.probeAnalysis.depth_delta === 'decreased' ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-500'}`}>
                                                                        Depth {entry.probeAnalysis.depth_delta}
                                                                    </span>
                                                                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${entry.probeAnalysis.probe_successful ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                                        {entry.probeAnalysis.probe_successful ? 'Probe effective' : 'Partial response'}
                                                                    </span>
                                                                </div>
                                                                {entry.probeAnalysis.interpretation && (
                                                                    <p className="text-[9px] text-slate-600 leading-relaxed">{entry.probeAnalysis.interpretation}</p>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Download and Modal Actions */}
                                                <div className="flex gap-2">
                                                    {entry.summaryReport && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setQuestionReportEntry(entry);
                                                            }}
                                                            className="flex-1 py-2 bg-indigo-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                                                        >
                                                            <BookOpen size={12} />
                                                            Full Coaching Report
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

                                    {/* Questions to Ask — NCS (2025) + Prospects (2025) */}
                                    {detailedFeedback && sessionLog.length > 0 && (
                                        <div className="bg-white border border-emerald-100 rounded-[24px] p-5 space-y-4 shadow-sm">
                                            <div>
                                                <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600">Interview Preparation · Questions to Ask</p>
                                                <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                                                    Preparing questions demonstrates commitment and helps you make an informed decision.{' '}
                                                    <span className="text-slate-400 italic">National Careers Service (2025)</span>
                                                </p>
                                            </div>

                                            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-2xl space-y-2">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700">NCS Guidance</p>
                                                <ul className="space-y-1.5">
                                                    {[
                                                        'Best questions relate to career progression, opportunities, and training in this role',
                                                        'Research salary for equivalent roles before your interview in case you need to negotiate',
                                                        'Politely ask for time to consider any decisions — you do not have to accept on the spot',
                                                        'Express your appreciation at the close of the interview'
                                                    ].map((tip, i) => (
                                                        <li key={i} className="text-[10px] text-slate-700 leading-relaxed flex gap-2">
                                                            <span className="text-emerald-500 font-black shrink-0">→</span>
                                                            {tip}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>

                                            <div>
                                                <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-2">7 Questions to Ask · Prospects (2025)</p>
                                                <div className="space-y-2">
                                                    {[
                                                        `What does a typical day look like in the ${targetRole} role?`,
                                                        'How would you describe the team I would be working with?',
                                                        'What are the biggest challenges someone new to this role might face in the first few months?',
                                                        'What training and professional development opportunities are available?',
                                                        'How is success measured in this role, and what would I need to achieve in my first three months?',
                                                        'What are the opportunities for progression within the organisation?',
                                                        'What do you enjoy most about working here?'
                                                    ].map((q, i) => (
                                                        <div key={i} className="flex gap-2 items-start p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                                                            <span className="text-[8px] font-black text-indigo-400 bg-indigo-50 rounded-full w-5 h-5 flex items-center justify-center shrink-0">{i + 1}</span>
                                                            <p className="text-[10px] font-medium text-slate-700 leading-relaxed">{q}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="p-3 bg-slate-800 rounded-2xl">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">One Tip</p>
                                                <p className="text-[10px] font-bold text-white leading-relaxed">Have 2–3 questions ready. If the interviewer already answers one during the conversation, move to the next — this shows you are engaged rather than working through a prepared list.</p>
                                            </div>
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
                    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    .no-print { display: none !important; }
                    body { background: white !important; }

                    /* Expand every scrollable/clipped container so nothing is cut off */
                    * { overflow: visible !important; max-height: none !important; height: auto !important; }
                    .min-h-screen { min-height: auto !important; }

                    .max-w-7xl { max-width: 100% !important; width: 100% !important; padding: 0 !important; margin: 0 !important; }
                    .shadow-sm, .shadow-xl, .shadow-2xl { box-shadow: none !important; }
                    .rounded-\[40px\], .rounded-3xl, .rounded-2xl { border-radius: 8px !important; }
                    button { display: none !important; }
                    .border { border: 1px solid #e2e8f0 !important; }
                    .text-indigo-600 { color: #4f46e5 !important; }
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

            {/* Session Log — Question Analysis Report Modal */}
            <AnimatePresence>
                {questionReportEntry && questionReportEntry.summaryReport && (
                    <QuestionReport
                        questionIndex={questionReportEntry.questionIndex}
                        questionText={questionReportEntry.questionText}
                        starPhaseReached={questionReportEntry.starPhaseReached}
                        summaryReport={questionReportEntry.summaryReport}
                        probeAnalysis={questionReportEntry.probeAnalysis}
                        participantId={participantId}
                        onClose={() => setQuestionReportEntry(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export default AscendPlatform;
