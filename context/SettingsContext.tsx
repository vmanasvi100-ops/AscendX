
import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import type { Settings, TimerDisplay, TimerFramingCondition, LiveTools, VisualFeedbackStyle, CoachMarkTheme, SpeechRate, TourResettableSettings, ExperimentCondition, Question, AuditResult } from '../types';
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
    const conditionParam = params.get('condition') as ExperimentCondition;
    const validConditions: ExperimentCondition[] = ['scaffolded', 'standard', 'minimal'];
    const condition = validConditions.includes(conditionParam) ? conditionParam : validConditions[Math.floor(Math.random() * 3)];
    return { pid, condition };
};

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
  const [isTourActive, setIsTourActive] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [finishSessionTrigger, setFinishSessionTrigger] = useState(false);
  const [originalSettings, setOriginalSettings] = useState<TourResettableSettings | null>(null);

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
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (context === undefined) throw new Error('useSettings must be used within a SettingsProvider');
  return context;
};
