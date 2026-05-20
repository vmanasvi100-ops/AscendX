
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
  roleAlignmentScore: number;
  alignmentSummary: string;
  keywordAudit: {
    present: string[];
    missing: string[];
    vocabularyStrengths: string[];
  };
  starEvidenceQuality: Array<{
    roleTitle: string;
    situation: 'evidenced' | 'partial' | 'implied' | 'missing';
    task: 'evidenced' | 'partial' | 'implied' | 'missing';
    action: 'evidenced' | 'partial' | 'implied' | 'missing';
    result: 'evidenced' | 'partial' | 'implied' | 'missing';
  }>;
  coherenceFlags: Array<{
    claim: string;
    probeTarget: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  questionPrimingBrief: {
    topCompetenciesToProbe: string[];
    cvClaimsToVerify: string[];
    strongestExperienceToLeverage: string;
  };
  cvCHCSignal: {
    gc_estimate: 'strong' | 'moderate' | 'weak';
    gq_estimate: 'strong' | 'moderate' | 'weak';
    note: string;
  };
}

// ─── Framework Evaluation Types — DMGT-AMO-ZPD-DCT ──────────────────
export type CompetencyDemonstrationLevel = 'Emerging' | 'Developing' | 'Established' | 'Advanced';

export interface AmoReadiness {
  ability: 'high' | 'moderate' | 'low';
  motivation: 'high' | 'moderate' | 'low';
  opportunity: 'high' | 'moderate' | 'low';
  amo_note: string;
}

export type TimerDisplay = 'progressBar' | 'countdown' | 'elapsed' | 'pacingAnchor';
export type TimerFramingCondition = 'elapsed' | 'duration' | 'used';
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
  | 'scaffold_toggled' | 'data_synced' | 'data_exported'
  | 'feedback_report_opened' | 'practice_task_noted'
  | 'cv_uploaded' | 'questions_generated' | 'profile_submitted';

export interface AnalyticsEvent {
  type: AnalyticsEventType;
  timestamp: number;
  participantId: string;
  condition: ExperimentCondition;
  metadata?: Record<string, any>;
}

export interface CandidateProfile {
  experience: 'novice' | 'some' | 'experienced' | 'expert';
  feedbackLiteracy: 'absorbs' | 'reflects' | 'overwhelmed' | 'uncertain';
  regulatoryFocus: 'promotion' | 'prevention' | 'mixed' | 'unclear';
  anxietyLevel: 'low' | 'mild' | 'moderate' | 'high';
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
  readAloud: boolean;
  speechRate: SpeechRate;
  videoEnabled: boolean;
  participantId: string;
  condition: ExperimentCondition;
  cvText?: string;
  coachMarkTheme: CoachMarkTheme;
}

// Fix: Added TourResettableSettings interface
export interface TourResettableSettings {
  timerDisplay: TimerDisplay;
  liveTools: LiveTools;
  dyslexiaFont: boolean;
  visualFeedback: VisualFeedbackStyle;
  audioCues: boolean;
  gamification: boolean;
  videoEnabled: boolean;
}

// Fix: Added TourStep interface
export interface TourStep {
  id: string;
  targetId: string;
  title: string;
  content: string;
  placement: 'top' | 'bottom' | 'left' | 'right';
  component: 'welcome' | 'interview' | 'report';
  section: string;
  action?: 'START_INTERVIEW' | 'FINISH_SESSION';
}

// ─── AscendX Layer B Types — v5.0 ──────────────────────────────────
export interface MeritVector {
  score: number;
  evidenceBasis: string;
}

export interface MeritVectors {
  autonomy: MeritVector;
  competence: MeritVector;
  relatedness: MeritVector;
  lowestVector: 'autonomy' | 'competence' | 'relatedness';
  primarySuggestionAnchor: string;
}

export interface ProfessionalSelfVerificationSignalDimension {
  score: number;
  orientation: 'self_verifying' | 'impression_managing' | 'balanced';
  evidenceBasis: string;
}

export interface ProfessionalSelfVerificationSignals {
  voice: ProfessionalSelfVerificationSignalDimension;
  motivation: ProfessionalSelfVerificationSignalDimension;
  explanation: ProfessionalSelfVerificationSignalDimension;
  dominantMode: 'self_verifying' | 'impression_managing' | 'mixed';
  fitSignal: string;
  feedbackImplication: string;
  researchNote: string;
}

export interface ImpressionManagementScore {
  frontStageScore: number;
  backStageScore: number;
  dominantMode: 'front_stage' | 'back_stage' | 'balanced';
  authenticitySignal: string;
  feedbackImplication: string;
}

export interface AlgorithmicAversionSignal {
  aversionDetected: boolean;
  aversionEvidence: string | null;
  feedbackImplication: string;
}

export interface SocialIdentityAwareness {
  activated: boolean;
  valueExpressionScore: number | null;
  socialRecognitionScore: number | null;
  dominantMotivation: 'value_expression' | 'social_recognition' | null;
  scopeNote: string;
}

// ─── NEW v5.0: CHC Cognitive Dimensions (replaces Sternberg) ────────
export interface CHCDimension {
  score: number | null;
  evidenceBasis: string;
  validityDisclaimer: string;
}

export interface CHCCognitiveDimensions {
  crystallisedIntelligence: CHCDimension;  // Gc
  fluidIntelligence: CHCDimension;          // Gf
  practicalReasoning: CHCDimension;         // Gq
  overallCHCNote: string;
  researchNote: string;
}

// ─── NEW v5.0: Scaffolded Learning Signal (Vygotsky / Wood et al.) ──
export interface ScaffoldedLearningSignal {
  zpdProgressionObservation: string;
  scaffoldDependency: {
    score: number;
    interpretation: 'scaffolded' | 'independent' | 'declining';
    researchNote: string;
  };
  zoneOfProximalDevelopmentEstimate: {
    lowerBoundary: string;
    upperBoundary: string;
    developmentGap: string;
    practiceRecommendation: string;
  };
  phasingEffectiveness: {
    phase1Score: number | null;
    phase2Score: number | null;
    phase3Score: number | null;
    trajectory: 'improving' | 'stable' | 'declining' | 'variable';
  };
}

// ─── COMPLETE LayerBSignals interface ────────────────────────────────
export interface LayerBSignals {
  meritVectors: MeritVectors;
  professionalSelfVerificationSignals: ProfessionalSelfVerificationSignals;
  impressionManagementScore: ImpressionManagementScore;
  algorithmicAversionSignal: AlgorithmicAversionSignal;
  socialIdentityAwareness: SocialIdentityAwareness;
  chcCognitiveDimensions: CHCCognitiveDimensions;
  scaffoldedLearningSignal: ScaffoldedLearningSignal;
  psychologicalSafetyScore: {
    score: number;
    checklist: Record<string, boolean>;
  };
  biasAndFairnessNote: {
    potentialBiasSignals: string[];
    mitigationActions: string[];
    overallFairnessNote: string;
  };
  maskedTranscript: {
    text: string;
  };
}

export interface DetailedFeedback {
  noData?: boolean;

  // Layer A - Candidate Facing
  performanceSummary: string;
  overallStarSynthesis: string;
  strengths: string[];
  weaknesses: string[];
  actionableSuggestions: string[];
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
  rubrics: {
    starCompletion: number;
    evidenceSpecificity: number;
    roleClarity: number;
    jdAlignment: number;
    communicationClarity: number;
    justifications: {
      starCompletion: string;
      evidenceSpecificity: string;
      roleClarity: string;
      jdAlignment: string;
      communicationClarity: string;
    }
  };

  // Layer B - Researcher Signals
  meritVectors?: {
    autonomy: { score: number; evidenceBasis: string };
    competence: { score: number; evidenceBasis: string };
    relatedness: { score: number; evidenceBasis: string };
    lowestVector: 'autonomy' | 'competence' | 'relatedness';
    primarySuggestionAnchor: string;
  };
  professionalSelfVerificationSignals?: {
    voice: { score: number; orientation: 'self_verifying' | 'impression_managing' | 'balanced'; evidenceBasis: string };
    motivation: { score: number; orientation: 'self_verifying' | 'impression_managing' | 'balanced'; evidenceBasis: string };
    explanation: { score: number; orientation: 'self_verifying' | 'impression_managing' | 'balanced'; evidenceBasis: string };
    dominantMode: 'self_verifying' | 'impression_managing' | 'mixed';
    fitSignal: string;
    feedbackImplication: string;
    researchNote: string;
  };
  impressionManagementScore?: {
    frontStageScore: number;
    backStageScore: number;
    dominantMode: 'front_stage' | 'back_stage' | 'balanced';
    authenticitySignal: string;
    feedbackImplication: string;
  };
  algorithmicAversionSignal?: {
    aversionDetected: boolean;
    aversionEvidence: string | null;
    feedbackImplication: string;
  };
  socialIdentityAwareness?: {
    activated: boolean;
    valueExpressionScore: number | null;
    socialRecognitionScore: number | null;
    dominantMotivation: 'value_expression' | 'social_recognition' | null;
    scopeNote: string;
  };
  chcCognitiveDimensions?: {
    crystallisedIntelligence: { score: number | null; evidenceBasis: string; validityDisclaimer: string };
    fluidIntelligence: { score: number | null; evidenceBasis: string; validityDisclaimer: string };
    practicalReasoning: { score: number | null; evidenceBasis: string; validityDisclaimer: string };
    overallCHCNote: string;
    researchNote: string;
  };
  scaffoldedLearningSignal?: {
    zpdProgressionObservation: string;
    scaffoldDependency: { score: number; interpretation: 'scaffolded' | 'independent' | 'declining'; researchNote: string };
    zoneOfProximalDevelopmentEstimate: { lowerBoundary: string; upperBoundary: string; developmentGap: string; practiceRecommendation: string };
    phasingEffectiveness: { phase1Score: number | null; phase2Score: number | null; phase3Score: number | null; trajectory: 'improving' | 'stable' | 'declining' | 'variable' };
  };
  psychologicalSafetyScore?: {
    score: number;
    checklist: {
      taskLevelOnly: boolean;
      noDemotivatorsUsed: boolean;
      rationalePresent: boolean;
      atLeastFiveSuggestions: boolean;
      strengthsFirst: boolean;
      warmTone: boolean;
    };
  };
  biasAndFairnessNote?: string;
  integrityViolation?: {
    detected: boolean;
    type: 'abusive_language' | 'sensitive_information' | 'low_value' | 'out_of_context';
    note: string;
  };
  maskedTranscript: {
    text: string;
  };
}

export interface Probe {
  id?: string;
  probe: string;
  probe_type: 'CLARIFYING' | 'CONCRETE' | 'DEEPENING' | 'REDIRECTING' | 'STRATEGIC' | 'INSUFFICIENT_CONTEXT';
  rationale: string;
  contextual_anchor: string;
  scaffold_phase: 1 | 2 | 3;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  question_type: 'INTRODUCTORY_ALIGNMENT' | 'CORE_COMPETENCY' | 'STRATEGIC_HIGH_STAKES';
  zpd_note: string;
}


export interface StarStatus {
  situation: 'complete' | 'partial' | 'missing' | 'not_yet_required';
  task: 'complete' | 'partial' | 'missing' | 'not_yet_required';
  action: 'complete' | 'partial' | 'missing' | 'not_yet_required';
  result: 'complete' | 'partial' | 'missing' | 'not_yet_required';
}

export interface CoachingGuidance {
  framework_gap: string;
  instruction: string;
  example_phrase: string;
  priority: 'high' | 'medium' | 'low';
}

export interface ProbeAnalysis {
  probe_successful: boolean;
  depth_delta: 'increased' | 'same' | 'decreased';
  evidence_added: string;
  star_status: StarStatus;
  weakest_star_component: keyof StarStatus | null;
  contextual_anchor: string;
  suggested_next_probe_type: 'CLARIFYING' | 'CONCRETE' | 'DEEPENING' | 'STRATEGIC' | null;
  sdt_signals: {
    autonomy_language: 'present' | 'absent';
    competence_language: 'present' | 'absent';
    relatedness_language: 'present' | 'absent';
  };
  scaffold_dependency_signal: 'relied_heavily' | 'used_moderately' | 'independent';
  interpretation: string;
  pj_observations: string[];
  novel_claim_introduced: boolean;
  proceed: boolean;
  reason: string;
  verbatimProbe?: string;
  coaching_tip?: string;
  coaching_guidance?: CoachingGuidance;

  // Continuous Analysis Signals (Returned every time)
  merit_vectors: {
    autonomy: number;
    competence: number;
    relatedness: number;
    lowest_vector: 'autonomy' | 'competence' | 'relatedness';
  };
  goffman_scores: {
    front_stage: number;
    back_stage: number;
  };
  chc_signals: {
    gc: 'strong' | 'moderate' | 'weak';
    gf: 'strong' | 'moderate' | 'weak';
    gq: 'strong' | 'moderate' | 'weak';
    lowest_signal: 'gc' | 'gf' | 'gq';
  };

  algorithmic_aversion: {
    detected: boolean;
    evidence: string | null;
  };

  // DMGT-AMO-ZPD-DCT Framework signals (additive — all optional for backward compat)
  competency_demonstration_level?: CompetencyDemonstrationLevel;
  competency_demonstration_descriptor?: string;
  amo_readiness?: AmoReadiness;
  zpd_boundary_type?: 'act_one' | 'probed';
}

export interface QuestionSummaryReport {
  questionId: string;
  questionText: string;
  answerOverview: string;
  strengths: string[];
  developmentPoints: {
    gap: string;
    whyItMatters: string;
    instruction: string;
  }[];
  probeEngagement: string;
  probeCorrelation: string;
  integratedCoaching: string;
  practiceTask: string;
  timestamp: number;
  allProbeAnalyses?: ProbeAnalysis[];

  // Five-Component Feedback Sequence (DMGT-AMO-ZPD-DCT framework)
  selfAssessmentPrompt?: string;           // Component 1: Boud & Molloy
  calibrationNote?: string;                // Component 2: Hattie + PsyCap Efficacy
  competencyDemonstrationLevel?: CompetencyDemonstrationLevel; // Component 3a
  competencyDemonstrationDescriptor?: string;                  // Component 3b
  forwardOrientation?: string;             // Component 5: Career Adaptability + PsyCap Hope
  cvAlignmentNote?: string;               // CV cross-reference: what their background reveals about their answer
}

export interface QuestionDataAccumulator {
  questionId: string;
  transcript: string;
  phaseAnalyses: ProbeAnalysis[];
  probeAnalyses: ProbeAnalysis[];
  timerFramingCondition: TimerFramingCondition;
  responseDurations: {
    actOne: number;
    probes: number[];
  };
}

export interface Step0Signals {
  sdt_merit_vectors: {
    autonomy: number;
    competence: number;
    relatedness: number;
    lowest_merit_vector: 'autonomy' | 'competence' | 'relatedness';
  };
  goffman_impression_management: {
    front_stage_score: number;
    back_stage_score: number;
  };
  algorithmic_aversion: {
    aversion_detected: boolean;
    aversion_evidence: string | null;
  };
  highhouse_social_identity: {
    activated: boolean;
    value_expression_score: number | null;
    social_recognition_score: number | null;
    dominant_motivation: 'value_expression' | 'social_recognition' | null;
  };
  chc_cognitive_first_pass: {
    gc_signal: 'strong' | 'moderate' | 'weak';
    gf_signal: 'strong' | 'moderate' | 'weak';
    gq_signal: 'strong' | 'moderate' | 'weak';
    lowest_chc_signal: 'gc' | 'gf' | 'gq';
  };
  scaffold_dependency_first_pass: {
    phase1_quality: number | null;
    phase3_quality: number | null;
    scaffold_dependency_estimate: 'high' | 'moderate' | 'low' | 'insufficient_data';
  };
  psychological_safety_score: number;
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
  questionType?: 'behavioural' | 'motivational' | 'situational' | 'knowledge-probe';
  competency?: string;                 // which of the 50 competencies this assesses
  excellenceBenchmark?: string;        // what an exceptional answer demonstrates (2 sentences)
  discriminantSignals?: string[];      // 2–3 signals that separate good from exceptional
}

export interface JDCVAlignmentAnalysis {
  matchScore?: number;                         // deprecated — UI derives fit label from experienceAlignment instead
  alignmentSummary: string;                    // 2-3 sentence overview
  strengthAreas: Array<{
    area: string;                              // e.g. "Project Management"
    cvEvidence: string;                        // what the CV says
    jdRequirement: string;                     // what the JD asks for
  }>;
  gapAreas: Array<{
    area: string;                              // e.g. "Cloud Infrastructure"
    jdRequirement: string;                     // what's missing
    suggestion: string;                        // how to address in interview
  }>;
  experienceAlignment: Array<{
    jdRequirement: string;                     // specific JD requirement
    cvEvidence: string;                        // closest CV evidence
    alignmentLevel: 'strong' | 'partial' | 'weak' | 'missing';
  }>;
  keywordAudit: {
    present: string[];
    missing: string[];
  };
}
