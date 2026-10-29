
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

// Renamed from 'AmoReadiness'/ability·motivation·opportunity — Appelbaum et al. (2000)'s AMO model
// describes organizational-level performance drivers; it is not something inferable as a trait from
// a single interview response. These are plain-language observations used only to decide whether a
// weak response should be attributed to missing skill evidence, low engagement, or format pressure —
// not a measurement of the candidate's actual ability, motivation, or opportunity.
export interface PerformanceContextSignal {
  skill_evidence_level: 'high' | 'moderate' | 'low';
  engagement_level: 'high' | 'moderate' | 'low';
  format_conditions_level: 'high' | 'moderate' | 'low';
  context_note: string;
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
  | 'cv_uploaded' | 'cv_upload_declined' | 'questions_generated' | 'profile_submitted'
  | 'probe_used'
  | 'question_answered' | 'reflection_submitted' | 'self_rating_submitted'
  | 'support_used';

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
  seeksFeedback: 'proactive' | 'responsive' | 'avoidant' | 'uncertain';  // Carless & Young 2024
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
  // Clear Mode (accessibility — adapted/explicit question presentation). Off by default; the
  // candidate switches it on themselves in Support settings. Informed by Maras et al.'s University
  // of Bath study on adapted interview questions for autistic candidates — never shown or framed
  // as diagnosis-linked, just a presentation preference anyone can choose.
  clearModeEnabled: boolean;
  clearModeAppearance: ClearModeAppearance;
  // Reflection Library clip saving. Off by default — opt-in only, per the same Support settings
  // page as Clear Mode. 'device' stores clips locally (IndexedDB) only; they are never uploaded,
  // never analysed beyond the transcript already produced for coaching, and never used to train
  // any model. No 'device_and_account' (cloud) tier yet — that needs real encrypted backend
  // storage and is out of scope for this slice.
  saveClips: ClipSaveMode;
  // Spoken-voice preferences for Talk It Through and Explain It Visually's narration — a candidate
  // choice, not a default imposed on everyone. 'any' lets the browser pick its default voice.
  // Gender matching is heuristic (the Web Speech API doesn't expose real voice-gender metadata,
  // only names) — see services/voicePersona.ts for the honest caveat on that.
  voiceGenderPreference: VoiceGenderPreference;
  voiceTone: VoiceTone;
  aiTutorVoiceMode: AITutorVoiceMode;
  visualExplanationsTrigger: VisualExplanationsTrigger;
}

export type ClearModeAppearance = 'one_at_a_time' | 'checklist' | 'standard';
export type ClipSaveMode = 'off' | 'device';
export type VoiceGenderPreference = 'any' | 'male' | 'female';
export type VoiceTone = 'warm' | 'direct';
// 'text_only' silences Talk It Through's speechSynthesis narration entirely — the candidate still
// sees the Clear Picture and the audio-primary thread UI, just with the one "Speaking…" indicator
// never firing. Default 'spoken_and_text' preserves exactly the prior always-speaks behavior.
export type AITutorVoiceMode = 'spoken_and_text' | 'text_only';
// Controls whether the "Explain this visually" button appears at all. 'always_show_button' and
// 'only_when_asked' currently render identically (the button is always visible either way,
// nothing auto-opens the panel) — true "always" behavior (auto-playing a visual explanation
// without a click) isn't built, since that would mean auto-triggering an AI generation call
// rather than only on explicit request, a real behavior and cost change left for later. 'never'
// hides the button entirely.
export type VisualExplanationsTrigger = 'always_show_button' | 'only_when_asked' | 'never';

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
  personalAgency: MeritVector;
  skillSpecificity: MeritVector;
  impactArticulation: MeritVector;
  lowestVector: 'personalAgency' | 'skillSpecificity' | 'impactArticulation';
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
  algorithmicAversionSignal: AlgorithmicAversionSignal;
  socialIdentityAwareness: SocialIdentityAwareness;
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
    confidence: number;
    justifications: {
      starCompletion: string;
      evidenceSpecificity: string;
      roleClarity: string;
      jdAlignment: string;
      confidence: string;
    }
  };

  // Layer B - Researcher Signals
  meritVectors?: {
    personalAgency: { score: number; evidenceBasis: string };
    skillSpecificity: { score: number; evidenceBasis: string };
    impactArticulation: { score: number; evidenceBasis: string };
    lowestVector: 'personalAgency' | 'skillSpecificity' | 'impactArticulation';
    primarySuggestionAnchor: string;
  };
  // Deprecated alias of presentationRegisterSignals, computed server-side for backward compat — kept
  // only because AscendPlatform.tsx (sealed) reads this shape directly. Cable & Kay's self-verification
  // is a felt alignment between self-concept and self-presentation, validated via dedicated instruments;
  // comparing CV wording to transcript wording cannot measure that. New code should use
  // presentationRegisterSignals instead.
  professionalSelfVerificationSignals?: {
    voice: { score: number; orientation: 'self_verifying' | 'impression_managing' | 'balanced'; evidenceBasis: string };
    motivation: { score: number; orientation: 'self_verifying' | 'impression_managing' | 'balanced'; evidenceBasis: string };
    explanation: { score: number; orientation: 'self_verifying' | 'impression_managing' | 'balanced'; evidenceBasis: string };
    dominantMode: 'self_verifying' | 'impression_managing' | 'mixed';
    fitSignal: string;
    feedbackImplication: string;
    researchNote: string;
  };
  // Word-choice/elaboration register signal (honestly named — the actual source of truth).
  presentationRegisterSignals?: {
    voice: { score: number; orientation: 'spontaneous' | 'rehearsed' | 'balanced'; evidenceBasis: string };
    motivation: { score: number; orientation: 'spontaneous' | 'rehearsed' | 'balanced'; evidenceBasis: string };
    explanation: { score: number; orientation: 'spontaneous' | 'rehearsed' | 'balanced'; evidenceBasis: string };
    dominantMode: 'spontaneous' | 'rehearsed' | 'mixed';
    fitSignal: string;
    feedbackImplication: string;
    researchNote: string;
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
  // Deprecated alias of elcStageSignals, computed server-side for backward compat — kept only because
  // AscendPlatform.tsx (sealed) reads this shape directly. "CHC" (Cattell-Horn-Carroll) is a cognitive-
  // ability taxonomy; an interview transcript cannot measure cognitive ability, so new code should use
  // elcStageSignals instead. Inner fields were already Kolb-ELC-named — only this container name carried
  // the ability-measurement framing.
  chcCognitiveDimensions?: {
    abstractConceptualisation: { score: number | null; evidenceBasis: string; validityDisclaimer: string };
    activeExperimentation: { score: number | null; evidenceBasis: string; validityDisclaimer: string };
    concreteExperience: { score: number | null; evidenceBasis: string; validityDisclaimer: string };
    overallELCNote: string;
    researchNote: string;
  };
  elcStageSignals?: {
    abstractConceptualisation: { score: number | null; evidenceBasis: string; validityDisclaimer: string };
    activeExperimentation: { score: number | null; evidenceBasis: string; validityDisclaimer: string };
    concreteExperience: { score: number | null; evidenceBasis: string; validityDisclaimer: string };
    overallELCNote: string;
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

  // Layer B — Meso extensions (researcher only, absent for first-session candidates)
  masteryTracker?: {
    situation: { status: 'reached' | 'partial' | 'not_reached'; consolidated: boolean };
    task:      { status: 'reached' | 'partial' | 'not_reached'; consolidated: boolean };
    action:    { status: 'reached' | 'partial' | 'not_reached'; consolidated: boolean };
    result:    { status: 'reached' | 'partial' | 'not_reached'; consolidated: boolean };
    consolidatedComponents: string[];
  };
  calibrationAccuracy?: {
    candidateSelfRating: string;
    aiCompetencyRating: string;
    calibrationGap: 'overestimate' | 'accurate' | 'underestimate';
    calibrationDirection: string;
    priorSessionGaps: string[];
    consistentPattern: string;
  };

  // ── CANDIDATE-FACING IMPROVEMENT TARGETS ─────────────────────────
  cvMissedOpportunities?: Array<{
    cvItem: string;          // the specific CV entry that was relevant but not deployed
    questionContext: string; // the question/moment where it applied
    whyItFits: string;       // why this CV item was the right evidence (formal, warm, 2–3 sentences)
    exampleUsage: string;    // complete ready-to-use sentence showing how to deploy it
  }> | null;

  transcriptAnnotations?: Array<{
    moment: string;          // attribution + verbatim phrase: "When describing X, you said: '[phrase]'"
    observation: string;     // what the phrase reveals — positive first, then what remains (2–3 sentences)
    standardVersion: string; // complete interview-standard rewrite in the candidate's voice
    principle: string;       // one plain-English sentence naming the underlying principle
  }> | null;

  amoPerformanceContext?: string | null;  // session-level AMO note — plain English, candidate-facing (Appelbaum et al., 2000)
  feedbackApproachLevel?: 'Emerging' | 'Developing' | 'Established' | 'Advanced' | null;  // CDL level that drove the feedback approach (Nicol & Macfarlane-Dick 2006)
  intentionAssessment?: string | null;  // did the session meet the student's pre-session learning goal? (goal-setting theory; SDT autonomy)

  verbalImprovementPlan?: {
    fillerPatterns: string;
    pacingAssessment: string;
    clarityTargets: string[];
    practiceMethod: string;
  } | null;

  hiringProfileAlignment?: {
    whatInterviewersLookFor: string[];
    candidateAlignedStrengths: string[];
    profileGaps: string[];
    priorityFix: string;
  } | null;

  elcLearningCycle?: {
    concreteExperienceBaseline: string;
    reflectiveObservationInsight: string;
    abstractPrinciple: string;
    experimentationTarget: string;
  } | null;
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
  // Who triggered this probe — 'system' (automatic, fires once per question after STAR completion)
  // vs 'candidate' (manual "Deep Probe" button). Scaffold-dependency metrics should only be driven
  // by system-initiated probes — a candidate choosing to ask for more probes is feedback-seeking
  // behaviour, not evidence of dependency, and conflating the two overstates how much support
  // someone needed.
  initiated_by?: 'system' | 'candidate';
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
  behavioural_evidence_signals: {
    ownership_language: 'present' | 'absent';   // personal agency — "I decided / I chose"
    skill_language: 'present' | 'absent';        // specific skill execution — named outputs
    impact_language: 'present' | 'absent';       // impact on others — named people / team effects
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
  // Deprecated alias of behavioral_evidence_vectors, computed server-side for backward compat —
  // kept only because QuestionReport.tsx and AscendPlatform.tsx (sealed) read this shape directly.
  // 'autonomy'/'competence'/'relatedness' are SDT need-satisfaction constructs (felt psychological
  // states, validated only via instruments like the BPNS scale) — a transcript language count is
  // not that measurement. New code should use behavioral_evidence_vectors instead.
  merit_vectors: {
    autonomy: number;      // = behavioral_evidence_vectors.personal_agency
    competence: number;    // = behavioral_evidence_vectors.skill_specificity
    relatedness: number;   // = behavioral_evidence_vectors.impact_articulation
    lowest_vector: 'autonomy' | 'competence' | 'relatedness';
  };
  // Behavioral evidence density counts (honestly named — the actual source of truth).
  behavioral_evidence_vectors?: {
    personal_agency: number;
    skill_specificity: number;
    impact_articulation: number;
    lowest_vector: 'personal_agency' | 'skill_specificity' | 'impact_articulation';
  };
  // Deprecated alias of presentation_register, computed server-side for backward compat — kept only
  // because QuestionReport.tsx and AscendPlatform.tsx (sealed) read this shape directly. Goffman's
  // front-stage/back-stage and Cable & Kay's self-verification are both constructs a single response's
  // phrasing register cannot validly measure — this is a word-choice observation, not authenticity.
  presentation_authenticity: {
    front_stage: number;  // = presentation_register.rehearsed_language
    back_stage: number;   // = presentation_register.spontaneous_language
  };
  // Language-register word-choice signal (honestly named — the actual source of truth).
  presentation_register?: {
    rehearsed_language: number;
    spontaneous_language: number;
  };
  // Deprecated alias of response_quality_signals, computed server-side for backward compat —
  // kept only because QuestionReport.tsx and AscendPlatform.tsx (sealed) read this shape directly.
  // 'gc'/'gf'/'gq' were Cattell-Horn-Carroll cognitive-ability codes; an interview transcript
  // cannot measure cognitive ability, so new code should use response_quality_signals instead.
  chc_signals: {
    gc: 'strong' | 'moderate' | 'weak';   // = response_quality_signals.domain_language
    gf: 'strong' | 'moderate' | 'weak';   // = response_quality_signals.adaptive_reasoning
    gq: 'strong' | 'moderate' | 'weak';   // = response_quality_signals.evidence_specificity
    lowest_signal: 'gc' | 'gf' | 'gq';
  };
  // Kolb ELC stage-completion language-pattern signals (honestly named — the actual source of truth).
  response_quality_signals?: {
    domain_language: 'strong' | 'moderate' | 'weak';      // Kolb AC — domain knowledge applied
    adaptive_reasoning: 'strong' | 'moderate' | 'weak';   // Kolb AE — adaptive reasoning under probing
    evidence_specificity: 'strong' | 'moderate' | 'weak'; // Kolb CE — measurable, specific outcomes
    lowest_signal: 'domain_language' | 'adaptive_reasoning' | 'evidence_specificity';
  };

  algorithmic_aversion: {
    detected: boolean;
    evidence: string | null;
  };

  // DMGT-AMO-ZPD-DCT Framework signals (additive — all optional for backward compat)
  competency_demonstration_level?: CompetencyDemonstrationLevel;
  competency_demonstration_descriptor?: string;
  performance_context_signal?: PerformanceContextSignal;
  zpd_boundary_type?: 'act_one' | 'probed';

  // Competency verification + Tomlinson (2017) Graduate Capital correlation
  // (additive — optional for backward compat; does not alter existing probing logic)
  competency_verification?: {
    competency_tested: string;
    verified: boolean;
    evidence_quote: string;
    confidence: 'low' | 'moderate' | 'high';
  };
  // Deprecated alias of strength_domain_signal, computed server-side for backward compat — kept only
  // because AscendPlatform.tsx (sealed) reads this shape directly. Tomlinson (2017)'s graduate capital
  // model is a validated employability framework; a single response's evidence domain is not a
  // measurement of a candidate's actual capital reserves. New code should use strength_domain_signal.
  graduate_capital_signal?: GraduateCapitalSignal;
  // Evidence-domain classification (honestly named — the actual source of truth).
  strength_domain_signal?: StrengthDomainSignal;
}

// Design reference only: Tomlinson, M. (2017). Forms of graduate capital and their relationship to
// graduate employability. Education + Training, 59(4), 338–352. https://doi.org/10.1108/ET-05-2016-0090
// — used to choose which evidence domains are worth distinguishing, not as a claim that a single
// response validly measures "capital" in Tomlinson's psychometric sense.
export type StrengthDomain = 'technical_skill' | 'relationship_network' | 'professional_fit' | 'resilience' | 'professional_narrative';

export interface StrengthDomainSignal {
  primary_domain: StrengthDomain;
  secondary_domain: StrengthDomain | null;
  evidence_basis: string;
}

// Deprecated — kept only for the graduate_capital_signal backward-compat alias shape above.
export type GraduateCapital = 'human' | 'social' | 'cultural' | 'psychological' | 'identity';

export interface GraduateCapitalSignal {
  primary_capital: GraduateCapital;
  secondary_capital: GraduateCapital | null;
  evidence_basis: string;
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
  breakContextGap?: string | null;        // forward orientation from this question — seeded into next session break state
  amoContextNote?: string | null;         // AMO context — plain English note when conditions affected performance (Appelbaum et al., 2000)

  // Per-question Kolb ELC stage trace — shown to candidate immediately after each question
  elcStages?: {
    ce: string;   // Concrete Experience — what their answer showed about their current level
    ro: string;   // Reflective Observation — what the probe revealed that the main answer did not
    ac: string;   // Abstract Conceptualisation — the transferable principle this question produced
    ae: string;   // Active Experimentation — the single action to test on the next question
  } | null;
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

// ── MESO ACCUMULATOR TYPES ─────────────────────────────────────────
// Cross-session personality-adaptive architecture (Higgins 1997; Carless & Young 2024;
// Boud & Molloy 2013; Hattie & Timperley 2007; Savickas 2012; Luthans 2007)

export type RegFocusDelta =
  | 'stable_promotion'
  | 'stable_prevention'
  | 'stable_mixed'
  | 'prevention_to_promotion'
  | 'promotion_to_prevention';

export type FeedbackOrientationDelta = 'improving' | 'stable' | 'declining' | 'insufficient_data';
// Renamed from 'CareerAdaptabilityStage'/concern·control·curiosity·confidence (Savickas 2012's 4Cs) —
// this is computed directly from masteryConsolidated.length (a cross-session STAR-component count),
// not a measurement of the candidate's actual felt career-adaptability resources, which Savickas's
// model validates via the CAAS instrument. Kept (renamed, not removed) because the underlying
// next-stage-only sequencing has real coaching value for the Growth Summary.
export type CoachingProgressionStage  = 'planning' | 'ownership' | 'exploration' | 'consolidation';
export type ScaffoldTrend            = 'reducing' | 'stable' | 'increasing' | 'insufficient_data';
export type MasteryComponent         = 'situation' | 'task' | 'action' | 'result';

export interface SessionRecord {
  sessionId: string;
  timestamp: number;
  condition: ExperimentCondition;
  competencyLevels: CompetencyDemonstrationLevel[];
  lowerBoundaryLevel: CompetencyDemonstrationLevel | null;  // ZPD lower boundary — unprobed (Act 1) performance, averaged across this session's questions
  upperBoundaryLevel: CompetencyDemonstrationLevel | null;  // ZPD upper boundary — scaffolded (post-probe) performance, averaged across this session's questions
  scaffoldDependencyScore: number;          // 0–100
  regulatoryFocus: 'promotion' | 'prevention' | 'mixed' | 'unclear';
  feedbackOrientation: 'proactive' | 'responsive' | 'avoidant' | 'uncertain';
  anxietyLevel: 'low' | 'mild' | 'moderate' | 'high';
  selfReportedAnxietyLevel: string;         // free-text from pre-session question
  forwardOrientationNotes: string[];        // Component 5 text from each question
  starComponentsReached: MasteryComponent[];
  feedbackSeekingCount?: number;            // candidate-initiated Deep Probe requests — kept separate from scaffoldDependencyScore
}

export interface MesoDelta {
  sessionCount: number;
  competencySlope: number;                  // least-squares slope across sessions (positive = improving)
  // A slope through <3 points has no residual degrees of freedom — these two fields let callers
  // check whether competencySlope is statistically estimable at all before acting on it.
  competencyTrendReliable: boolean;         // true only when sessionCount (with valid data) >= 3
  competencySlopeStandardError: number | null;
  scaffoldTrend: ScaffoldTrend;
  mesoScaffoldReduced: boolean;             // true when scaffoldDependencyScore slope < -0.1 AND reliable (n>=3)
  regulatoryShift: RegFocusDelta;
  feedbackOrientationDelta: FeedbackOrientationDelta;
  dominantAnxietyLevel: 'low' | 'mild' | 'moderate' | 'high';
  masteryConsolidated: MasteryComponent[];  // STAR components evidenced in ≥ 2 sessions
  forwardOrientationActioned: boolean;      // did Session N evidence Session N-1's recommendation?
  currentCoachingProgressionStage: CoachingProgressionStage;
  priorFeedForwardAction: string | null;    // last forwardOrientation note from Session N-1
  zpd_lowerBoundaryAdvanced: boolean;       // true if ZPD lower boundary trend is reliable (n>=3) AND rising
  zpdTrendReliable: boolean;                // true only when lower-boundary data points >= 3
}

export interface MesoAccumulator {
  participantId: string;
  sessions: SessionRecord[];
  delta: MesoDelta | null;
  lastUpdated: number;
}
