
import React from 'react';

export interface Heuristic {
  name: string;
  description: string;
  icon: React.ReactNode;
  uiElementIds: string[];
}

export interface RubricCriterion {
  id: string;
  label: string;
  weight: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export type JobStatus = 'Discovered' | 'Shortlisted' | 'Applied' | 'Interviewing' | 'Offer' | 'Rejected';

export interface JobListing {
  id: string;
  title: string;
  company: string;
  url: string;
  platform: string;
  status: JobStatus;
  dateAdded: string;
  category: string;
  followUpDate?: string;
  verified?: boolean;
  isStealth?: boolean;
}

export interface MeritVectors {
  autonomy: number;
  competence: number;
  relatedness: number;
}

export interface InternalBlueprint {
  operatingModel: string;
  commStyle: string;
  decisionMaking: string;
  unwrittenRules: string[];
}

export interface SignalAudit {
  lowSignalNarrative: string;
  highSignalAnchor: string;
  psychologicalJustification: string;
}

export interface AgencyShiftMetrics {
  currentAgencyLevel: number;
  targetAgencyLevel: number;
  shiftPercentage: number;
  magnitudeGap: string;
}

export interface ATSMapping {
  category: 'Qualifications' | 'Technical' | 'Desirable' | 'Certifications';
  criterion: string;
  evidenceFound: string;
  strength: 'Strong' | 'Weak' | 'Missing';
}

export interface MiniCaseStudy {
  title: string;
  context: string;
  tasks: string[];
  expectedSolutions: string;
  feedbackRationale: string;
}

export interface AuditResult {
  summary: string;
  alignmentScore: number;
  frictionPoints: string[];
  meritVectors: MeritVectors;
  internalWorkings: InternalBlueprint;
  agencyShift: AgencyShiftMetrics;
  atsMapping: ATSMapping[];
  optimisedCV: {
    professionalSummary: string;
    bulletPointOptimizations: Array<{
      original: string;
      optimised: string;
      logic: string;
      bloomLevel: number;
    }>;
  };
  biasMitigationSummary: string[];
  miniCaseStudy: MiniCaseStudy;
  tailoredQuestions: Question[];
}

export type TimerDisplay = 'progressBar' | 'countdown' | 'elapsed' | 'pacingAnchor';
export type VisualFeedbackStyle = 'minimalist' | 'gentle' | 'textOnly';
export type FeedbackStyle = 'direct' | 'suggestive' | 'pacing' | 'minimal';
export type CoachMarkTheme = 'default' | 'calm';
export type SpeechRate = number;

export type RecordingStatus = 'idle' | 'recording' | 'processing' | 'uploaded';
export type ExperimentCondition = 'scaffolded' | 'standard' | 'minimal';

export interface AIFeedback {
  overallImpression: string;
  strengths: string[];
  areasForImprovement: string[];
}

// Fix: Added SupportiveAIFeedback interface
export interface SupportiveAIFeedback {
  semantic_anchor: string;
  task_logic: string;
  reflective_prompt: string;
  metadata: {
    completeness_score: number;
  };
}

export type AnalyticsEventType = 
  | 'session_start' | 'session_exit' | 'phase_complete' | 'break_start' 
  | 'break_end' | 'integrity_warning' | 'sandbox_engaged' | 'promo_generated' 
  | 'session_complete' | 'feedback_generated' | 'intent_survey_submitted' 
  | 'scaffold_toggled' | 'data_synced' | 'data_exported';

export interface AnalyticsEvent {
  type: AnalyticsEventType;
  timestamp: number;
  participantId: string;
  condition: ExperimentCondition;
  metadata?: Record<string, any>;
}

export interface LiveTools {
  keywordPathfinder: boolean;
  fillerWordCounter: boolean;
  questionChecklist: boolean;
}

export interface Settings {
  timerDisplay: TimerDisplay;
  liveTools: LiveTools;
  dyslexiaFont: boolean;
  visualFeedback: VisualFeedbackStyle;
  audioCues: boolean;
  gamification: boolean;
  coachMarkTheme: CoachMarkTheme;
  readAloud: boolean;
  speechRate: SpeechRate;
  videoEnabled: boolean;
  participantId: string;
  condition: ExperimentCondition;
  cvText?: string;
}

// Fix: Added TourResettableSettings interface
export interface TourResettableSettings {
  timerDisplay: TimerDisplay;
  liveTools: LiveTools;
  dyslexiaFont: boolean;
  visualFeedback: VisualFeedbackStyle;
  audioCues: boolean;
  gamification: boolean;
  coachMarkTheme: CoachMarkTheme;
  videoEnabled: boolean;
}

// Fix: Added TourStep interface
export interface TourStep {
  id: string;
  targetId: string;
  title: string;
  content: string;
  placement: 'top' | 'bottom' | 'left' | 'right';
  component: 'welcome' | 'interview';
  section: string;
  action?: 'START_INTERVIEW';
}

export interface TriarchicMeritAlignment {
  analytical: { score: number; evidence: string };
  creative: { score: number; evidence: string };
  practical: { score: number; evidence: string };
  correlationNote: string;
}

export interface DetailedFeedback {
  noData?: boolean;
  performanceSummary: string;
  rubrics: {
    fluency: number;
    technicalCorrectness: number;
    confidence: number;
    culturalAlignment: number;
  };
  strengths: string[];
  weaknesses: string[];
  actionableSuggestions: string[];
  biasAndFairnessNote: string;
  starAnalysis: {
    situation: string;
    task: string;
    action: string;
    result: string;
  };
  keywordCoverage: {
    found: string[];
    missing: string[];
  };
  careerDevelopment: {
    certifications: string[];
    nextSteps: string[];
  };
  integrityViolation?: {
    detected: boolean;
    type: 'abusive_language' | 'sensitive_information' | 'none';
    note: string;
  };
  maskedTranscript: string;
  triarchicMeritAlignment?: TriarchicMeritAlignment;
  meritVectors?: MeritVectors;
}

export interface Probe {
  id: string;
  question: string;
  focus: 'strategic_alignment' | 'stakeholder_management' | 'operational_integrity';
  psychologicalPrinciple: 'Impression Management' | 'Procedural Justice' | 'Social Identity Awareness';
  rationale: string;
}

export interface ProbeAnalysis {
  strategicAlignment: string;
  stakeholderManagement: string;
  operationalIntegrity: string;
  impressionManagementScore: number; // 0-100
  proceduralJusticeNote: string;
  socialIdentityAwareness?: {
    valueExpression: number; // 0-100
    socialRecognition: number; // 0-100
    note: string;
  };
  integrityViolation?: {
    detected: boolean;
    type: 'abusive_language' | 'sensitive_information' | 'none';
    note: string;
  };
}

export interface Requirement {
    id: string;
    text: string;
    linkedKeywords: string[];
}

export interface Question {
    text: string;
    keywords: string[];
    requirements: Requirement[];
    difficulty?: 'easy' | 'medium' | 'hard';
}
