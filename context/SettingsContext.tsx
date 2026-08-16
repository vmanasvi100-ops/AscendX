
import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import type { Settings, TimerDisplay, TimerFramingCondition, LiveTools, VisualFeedbackStyle, CoachMarkTheme, SpeechRate, TourResettableSettings, ExperimentCondition, Question, AuditResult, JDCVAlignmentAnalysis, CandidateProfile, MesoAccumulator, MesoDelta, SessionRecord, CompetencyDemonstrationLevel, MasteryComponent, RegFocusDelta, FeedbackOrientationDelta, CareerAdaptabilityStage, ScaffoldTrend } from '../types';
import { tourSteps, interviewQuestions } from '../data';

interface SettingsContextType extends Settings {
  setParticipantId: (id: string) => void;
  setTimerDisplay: (timerDisplay: TimerDisplay) => void;
  setLiveTools: (liveTools: LiveTools) => void;
  setDyslexiaFont: (enabled: boolean) => void;
  setVisualFeedback: (visualFeedback: VisualFeedbackStyle) => void;
  setAudioCues: (enabled: boolean) => void;
  setGamification: (enabled: boolean) => void;
  setReadAloud: (enabled: boolean) => void;
  setSpeechRate: (speechRate: SpeechRate) => void;
  setVideoEnabled: (enabled: boolean) => void;
  setCoachMarkTheme: (theme: CoachMarkTheme) => void;
  cvText: string;
  setCvText: (text: string) => void;
  activeQuestions: Question[];
  setActiveQuestions: (questions: Question[]) => void;
  timerFramingCondition: TimerFramingCondition;
  setTimerFramingCondition: (condition: TimerFramingCondition) => void;
  companyName: string;
  setCompanyName: (name: string) => void;
  targetRole: string;
  setTargetRole: (role: string) => void;
  jobDescription: string;
  setJobDescription: (description: string) => void;
  
  // Persistence for Return Navigation
  persistedAuditResult: AuditResult | null;
  setPersistedAuditResult: (res: AuditResult | null) => void;
  isPredictiveActive: boolean;
  setIsPredictiveActive: (active: boolean) => void;

  isTourActive: boolean;
  tourStep: number;
  startTour: () => void;
  nextTourStep: () => void;
  jumpToTourStep: (stepIndex: number) => void;
  endTour: (options?: { restore?: boolean }) => void;
  finishSessionTrigger: boolean;
  setFinishSessionTrigger: (trigger: boolean) => void;
  questionsFinalized: boolean;
  setQuestionsFinalized: (v: boolean) => void;
  phase2Started: boolean;
  setPhase2Started: (v: boolean) => void;
  jdcvAlignmentAnalysis: JDCVAlignmentAnalysis | null;
  setJdcvAlignmentAnalysis: (v: JDCVAlignmentAnalysis | null) => void;
  candidateProfile: CandidateProfile | null;
  setCandidateProfile: (profile: CandidateProfile | null) => void;
  preSessionAnswer: string | null;
  setPreSessionAnswer: (answer: string | null) => void;

  // Meso accumulator — cross-session personality-adaptive architecture
  mesoAccumulator: MesoAccumulator | null;
  saveMesoAccumulator: (accumulator: MesoAccumulator) => void;
  computeMesoDelta: (sessions: SessionRecord[]) => MesoDelta | null;
  deriveUpdatedCandidateProfile: () => Partial<CandidateProfile> | null;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const generateUniqueId = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `ASC-${timestamp}-${random}`;
};

function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

const getInitialParticipantData = () => {
    const params = new URLSearchParams(window.location.search);
    let pid = params.get('pid') || sessionStorage.getItem('ascend_active_pid');
    if (!pid) {
        pid = generateUniqueId();
        sessionStorage.setItem('ascend_active_pid', pid);
    }
    const validConditions: ExperimentCondition[] = ['scaffolded', 'standard', 'minimal'];
    const CONDITION_KEY = 'ascend_condition_lock';
    const locked = localStorage.getItem(CONDITION_KEY) as ExperimentCondition | null;
    let condition: ExperimentCondition;
    if (locked && validConditions.includes(locked)) {
        condition = locked;
    } else {
        const conditionParam = params.get('condition') as ExperimentCondition;
        condition = validConditions.includes(conditionParam) ? conditionParam : validConditions[Math.floor(Math.random() * 3)];
        localStorage.setItem(CONDITION_KEY, condition);
    }
    return { pid, condition };
};

function leastSquaresSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((a, b) => a + b, 0) / n;
  const denom = values.reduce((s, _, i) => s + (i - xMean) ** 2, 0);
  if (denom === 0) return 0;
  return values.reduce((s, y, i) => s + (i - xMean) * (y - yMean), 0) / denom;
}

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { pid: initialPid, condition: initialCondition } = getInitialParticipantData();

  const [participantId, setParticipantId] = useState<string>(initialPid);
  const [condition] = useState<ExperimentCondition>(initialCondition);
  const [timerDisplay, setTimerDisplay] = useState<TimerDisplay>('progressBar');
  const [liveTools, setLiveTools] = useState<LiveTools>({
    keywordPathfinder: condition === 'scaffolded',
    fillerWordCounter: false,
    questionChecklist: condition === 'scaffolded',
  });
  const [dyslexiaFont, setDyslexiaFont] = useState(true);
  const [visualFeedback, setVisualFeedback] = useState<VisualFeedbackStyle>('gentle');
  const [audioCues, setAudioCues] = useState(false);
  const [gamification, setGamification] = useState(condition !== 'minimal');
  const [readAloud, setReadAloud] = useState(true);
  const [speechRate, setSpeechRate] = useState<SpeechRate>(1);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [coachMarkTheme, setCoachMarkTheme] = useState<CoachMarkTheme>('default');
  const [cvText, setCvText] = useState("");
  const [timerFramingCondition, setTimerFramingCondition] = useState<TimerFramingCondition>('elapsed');
  const [companyName, setCompanyName] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [jobDescription, setJobDescription] = useState("");

  // Return Persistence
  const [persistedAuditResult, setPersistedAuditResult] = useState<AuditResult | null>(null);
  const [isPredictiveActive, setIsPredictiveActive] = useState(false);

  const [activeQuestions, setActiveQuestions] = useState<Question[]>(() => shuffleArray(interviewQuestions));
  const [questionsFinalized, setQuestionsFinalized] = useState(false);
  const [phase2Started, setPhase2Started] = useState(false);
  const [jdcvAlignmentAnalysis, setJdcvAlignmentAnalysis] = useState<JDCVAlignmentAnalysis | null>(null);
  const [candidateProfile, setCandidateProfile] = useState<CandidateProfile | null>(null);
  const [preSessionAnswer, setPreSessionAnswer] = useState<string | null>(null);
  const [mesoAccumulator, setMesoAccumulator] = useState<MesoAccumulator | null>(() => {
    try {
      const stored = localStorage.getItem('ascendx_meso_accumulator');
      return stored ? (JSON.parse(stored) as MesoAccumulator) : null;
    } catch { return null; }
  });
  const [isTourActive, setIsTourActive] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [finishSessionTrigger, setFinishSessionTrigger] = useState(false);
  const [originalSettings, setOriginalSettings] = useState<TourResettableSettings | null>(null);

  const saveMesoAccumulator = (accumulator: MesoAccumulator) => {
    setMesoAccumulator(accumulator);
    try { localStorage.setItem('ascendx_meso_accumulator', JSON.stringify(accumulator)); } catch { /* storage full */ }
  };

  const computeMesoDelta = (sessions: SessionRecord[]): MesoDelta | null => {
    if (sessions.length < 2) return null;

    const levelMap: Record<CompetencyDemonstrationLevel, number> = {
      Emerging: 1, Developing: 2, Established: 3, Advanced: 4,
    };
    const sessionMeans = sessions
      .map(s => {
        const valid = s.competencyLevels.map(l => levelMap[l]).filter(Boolean);
        return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
      })
      .filter((v): v is number => v !== null);
    const competencySlope = sessionMeans.length >= 2 ? leastSquaresSlope(sessionMeans) : 0;

    // ZPD lower boundary (Vygotsky 1978): unprobed/Act-1 performance, not overall session competency.
    const lowerBoundaryValues = sessions
      .map(s => s.lowerBoundaryLevel ? levelMap[s.lowerBoundaryLevel] : null)
      .filter((v): v is number => v !== null);
    const lowerBoundarySlope = lowerBoundaryValues.length >= 2 ? leastSquaresSlope(lowerBoundaryValues) : 0;

    const scaffoldSlope = leastSquaresSlope(sessions.map(s => s.scaffoldDependencyScore));
    const mesoScaffoldReduced = scaffoldSlope < -0.1;
    const scaffoldTrend: ScaffoldTrend =
      scaffoldSlope < -0.1 ? 'reducing' :
      scaffoldSlope > 0.1  ? 'increasing' :
      sessions.length >= 2 ? 'stable' : 'insufficient_data';

    const first = sessions[0];
    const last  = sessions[sessions.length - 1];
    let regulatoryShift: RegFocusDelta;
    if (first.regulatoryFocus === 'prevention' && (last.regulatoryFocus === 'promotion' || last.regulatoryFocus === 'mixed'))
      regulatoryShift = 'prevention_to_promotion';
    else if (first.regulatoryFocus === 'promotion' && last.regulatoryFocus === 'prevention')
      regulatoryShift = 'promotion_to_prevention';
    else if (last.regulatoryFocus === 'promotion') regulatoryShift = 'stable_promotion';
    else if (last.regulatoryFocus === 'prevention') regulatoryShift = 'stable_prevention';
    else regulatoryShift = 'stable_mixed';

    const orientOrd: Record<string, number> = { avoidant: 0, uncertain: 1, responsive: 2, proactive: 3 };
    const orientDiff = (orientOrd[last.feedbackOrientation] ?? 1) - (orientOrd[first.feedbackOrientation] ?? 1);
    const feedbackOrientationDelta: FeedbackOrientationDelta =
      orientDiff > 0 ? 'improving' : orientDiff < 0 ? 'declining' : 'stable';

    const anxietyCounts: Record<string, number> = {};
    sessions.forEach(s => { anxietyCounts[s.anxietyLevel] = (anxietyCounts[s.anxietyLevel] ?? 0) + 1; });
    const dominantAnxietyLevel = (Object.entries(anxietyCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'mild') as MesoDelta['dominantAnxietyLevel'];

    const allComponents: MasteryComponent[] = ['situation', 'task', 'action', 'result'];
    const masteryConsolidated = allComponents.filter(c =>
      sessions.filter(s => s.starComponentsReached.includes(c)).length >= 2
    );

    const stageOrder: CareerAdaptabilityStage[] = ['concern', 'control', 'curiosity', 'confidence'];
    const currentCareerAdaptabilityStage = stageOrder[Math.min(masteryConsolidated.length, stageOrder.length - 1)];

    const prevSession = sessions[sessions.length - 2];
    const forwardOrientationActioned =
      prevSession.forwardOrientationNotes.length > 0 &&
      last.starComponentsReached.length > prevSession.starComponentsReached.length;
    const priorFeedForwardAction = prevSession.forwardOrientationNotes.slice(-1)[0] ?? null;

    return {
      sessionCount: sessions.length,
      competencySlope,
      scaffoldTrend,
      mesoScaffoldReduced,
      regulatoryShift,
      feedbackOrientationDelta,
      dominantAnxietyLevel,
      masteryConsolidated,
      forwardOrientationActioned,
      currentCareerAdaptabilityStage,
      priorFeedForwardAction,
      zpd_lowerBoundaryAdvanced: lowerBoundaryValues.length >= 2 ? lowerBoundarySlope > 0 : false,
    };
  };

  const deriveUpdatedCandidateProfile = (): Partial<CandidateProfile> | null => {
    if (!mesoAccumulator?.delta) return null;
    const { delta } = mesoAccumulator;
    const patch: Partial<CandidateProfile> = {};

    if (delta.regulatoryShift === 'prevention_to_promotion') patch.regulatoryFocus = 'mixed';
    else if (delta.regulatoryShift === 'stable_promotion')   patch.regulatoryFocus = 'promotion';
    else if (delta.regulatoryShift === 'stable_prevention')  patch.regulatoryFocus = 'prevention';

    if      (delta.feedbackOrientationDelta === 'improving') patch.seeksFeedback = 'responsive';
    else if (delta.feedbackOrientationDelta === 'declining') patch.seeksFeedback = 'avoidant';

    patch.anxietyLevel = delta.dominantAnxietyLevel;
    return Object.keys(patch).length ? patch : null;
  };

  const startTour = () => {
    setOriginalSettings({ timerDisplay, liveTools, dyslexiaFont, visualFeedback, audioCues, gamification, videoEnabled });
    setTimerDisplay('progressBar');
    setLiveTools({ keywordPathfinder: false, fillerWordCounter: false, questionChecklist: false });
    setDyslexiaFont(false);
    setVisualFeedback('gentle');
    setAudioCues(false);
    setGamification(false);
    setVideoEnabled(false);
    setTourStep(0);
    setIsTourActive(true);
  };

  const nextTourStep = () => {
    if (tourStep < tourSteps.length - 1) setTourStep(prev => prev + 1);
    else endTour({ restore: true });
  };

  const jumpToTourStep = (stepIndex: number) => {
    if (stepIndex >= 0 && stepIndex < tourSteps.length) setTourStep(stepIndex);
  };

  const endTour = (options: { restore?: boolean } = { restore: true }) => {
    if (options.restore && originalSettings) {
      setTimerDisplay(originalSettings.timerDisplay);
      setLiveTools(originalSettings.liveTools);
      setDyslexiaFont(originalSettings.dyslexiaFont);
      setVisualFeedback(originalSettings.visualFeedback);
      setAudioCues(originalSettings.audioCues);
      setGamification(originalSettings.gamification);
      setVideoEnabled(originalSettings.videoEnabled);
    }
    setOriginalSettings(null);
    setIsTourActive(false);
    setTourStep(0);
  };

  const value = {
    participantId, setParticipantId, condition, timerDisplay, setTimerDisplay, liveTools, setLiveTools,
    dyslexiaFont, setDyslexiaFont, visualFeedback, setVisualFeedback, audioCues, setAudioCues,
    gamification, setGamification, readAloud, setReadAloud,
    speechRate, setSpeechRate, videoEnabled, setVideoEnabled, coachMarkTheme, setCoachMarkTheme, cvText, setCvText, activeQuestions, setActiveQuestions,
    timerFramingCondition, setTimerFramingCondition,
    companyName, setCompanyName, targetRole, setTargetRole, jobDescription, setJobDescription,
    persistedAuditResult, setPersistedAuditResult, isPredictiveActive, setIsPredictiveActive,
    isTourActive, tourStep, startTour, nextTourStep, jumpToTourStep, endTour,
    finishSessionTrigger, setFinishSessionTrigger,
    questionsFinalized, setQuestionsFinalized,
    phase2Started, setPhase2Started,
    jdcvAlignmentAnalysis, setJdcvAlignmentAnalysis,
    candidateProfile, setCandidateProfile,
    preSessionAnswer, setPreSessionAnswer,
    mesoAccumulator, saveMesoAccumulator, computeMesoDelta, deriveUpdatedCandidateProfile,
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (context === undefined) throw new Error('useSettings must be used within a SettingsProvider');
  return context;
};
