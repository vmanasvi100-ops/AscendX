
import { generateContent } from "./aiClient";
import { Question, JDCVAlignmentAnalysis } from "../types";

// Retry with exponential backoff — handles rate limits and transient failures
const withRetry = async <T>(fn: () => Promise<T>, retries = 3, delayMs = 1000): Promise<T> => {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt < retries - 1) {
        await new Promise(r => setTimeout(r, delayMs * Math.pow(2, attempt)));
      } else {
        throw err;
      }
    }
  }
  throw new Error('Max retries exceeded');
};

// ── Competency Taxonomy ───────────────────────────────────────────────────────
// 50-competency canonical set. All question generation selects from this list only.
// Fields: competency (name), excellenceBenchmark, discriminantSignals are derived per question.

const COMPETENCY_TAXONOMY = `
COMPETENCY TAXONOMY — select only from these 50 competencies, grouped by domain:
[Cognitive]      Analytical Reasoning | Systems Thinking | Learning Agility | Strategic Vision | Conceptual Thinking | Innovation & Creative Problem Solving | Critical Evaluation | Ambiguity Tolerance | Data-Driven Decision Making | Judgment & Risk Calibration
[Execution]      Results Orientation | Planning & Prioritisation | Adaptability & Flexibility | Project & Programme Delivery | Resourcefulness | Quality Orientation | Performance Under Pressure | Process Improvement & Efficiency
[Interpersonal]  Communication & Clarity | Active Listening | Cross-functional Influence | Stakeholder Management | Conflict Resolution | Negotiation & Persuasion | Collaborative Intelligence | Psychological Safety Creation | Feedback Exchange | Relationship Building
[Leadership]     People Development & Coaching | Team Building & Motivation | Inclusive Leadership | Delegation & Empowerment | Change Leadership | Vision & Direction Setting | Talent Identification | Organisational Navigation
[Character]      Integrity & Personal Ethics | Resilience & Emotional Regulation | Self-Awareness & Reflection | Ownership & Accountability | Growth Mindset | Humility & Openness | Ethical Judgment | Courage & Candour
[21st Century]   Digital Dexterity | Data Literacy | AI & Automation Literacy | Remote & Distributed Collaboration | Cross-cultural Intelligence | Continuous Self-Development
`;

const REDUNDANCY_RULES = `
REDUNDANCY RULES — never select these pairs together in the same set:
- Learning Agility + Growth Mindset (pick one)
- Learning Agility + Continuous Self-Development (pick one)
- Data-Driven Decision Making + Data Literacy (unless explicitly a data/analytics role)
- Cross-functional Influence + Relationship Building (pick based on context)
- Integrity & Personal Ethics + Ethical Judgment (unless compliance/legal/data ethics role)
- Analytical Reasoning + Conceptual Thinking (pick based on seniority — Analytical for applied, Conceptual for senior/research)
- Strategic Vision + Vision & Direction Setting (pick based on seniority)
- Collaborative Intelligence + Team Building & Motivation (Collaborative is IC behaviour, Team Building is manager behaviour — don't co-select at same level)
`;

const QUESTION_TYPE_RULE = `
QUESTION TYPE SELECTION:
- 'behavioural': candidate has relevant professional experience — "Tell me about a time..."
- 'situational': candidate is early-career, graduate, or career-changer — "What would you do if..."
- 'motivational': testing person-role/org fit — "What draws you to..." / "Why this role?"
- 'knowledge-probe': testing domain knowledge — "Walk me through how you would approach..."
Use CV experience level to decide: < 2 years relevant experience → prefer 'situational'. 2+ years → prefer 'behavioural'.
`;

const EXCELLENCE_BENCHMARK_RULE = `
excellenceBenchmark: Write exactly 2 sentences describing what an exceptional answer to THIS specific question demonstrates.
Be concrete — name the specific evidence, decision, or insight that characterises a truly outstanding response.
Tailor it to the competency and the question. No placeholder language.
Example for Learning Agility: "An exceptional answer names a specific domain where the candidate had zero prior knowledge and describes the exact steps they took to build it under time pressure. It shows a concrete decision they made differently as a direct result of that learning."
`;

const DISCRIMINANT_SIGNALS_RULE = `
discriminantSignals: Provide exactly 2–3 specific observable behaviours that ONLY appear in exceptional answers.
These distinguish a strong answer from an average one. They will be used to target probes and guide coaching.
Example for Learning Agility: ["Candidate specifies HOW they learned, not just WHAT they learned", "Candidate shows the learning changed a subsequent decision or behaviour", "Candidate voluntarily entered an unfamiliar domain without being asked"]
`;

export const generateInitialQuestions = async (
  jobDescription: string,
  companyName: string,
  targetRole: string,
  companyLink?: string
): Promise<Question[]> => {
  const prompt = `
You are a senior occupational psychologist designing a structured competency interview.
Generate exactly 5 interview questions for the role below, following a warmup-to-strategic progression.

### CONTEXT
Company: ${companyName}
Target Role: ${targetRole}
JD Link: ${companyLink || "N/A"}
Job Description: ${jobDescription}

### STEP 1 — SELECT COMPETENCIES
Read the JD carefully. Select 5 competencies from the taxonomy below — one per question.
Drive selection from JD content, NOT the job title.
Apply the redundancy rules strictly.

${COMPETENCY_TAXONOMY}
${REDUNDANCY_RULES}

### STEP 2 — ASSIGN QUESTION TYPE & DIFFICULTY
${QUESTION_TYPE_RULE}

Difficulty progression (fixed):
- Q1: easy + motivational — warmup, why this role/company (always 'motivational' type)
- Q2: easy + behavioural/situational — first competency probe
- Q3: medium + behavioural/situational — role-specific competency
- Q4: medium + behavioural/situational — complex scenario
- Q5: hard + behavioural/situational — strategic or high-stakes competency

### STEP 3 — GENERATE QUESTIONS WITH FULL METADATA
${EXCELLENCE_BENCHMARK_RULE}
${DISCRIMINANT_SIGNALS_RULE}
${QUESTION_TYPE_COACHING_RULE}

### OUTPUT FORMAT
Return a JSON array of exactly 5 Question objects. Each must match this structure exactly:
{
  "text": "Full interview question — 1-2 sentences, natural spoken language",
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "difficulty": "easy" | "medium" | "hard",
  "questionType": "behavioural" | "situational" | "motivational" | "knowledge-probe",
  "competency": "Exact competency name from the taxonomy",
  "excellenceBenchmark": "Two sentences. What an exceptional answer to this specific question demonstrates. For motivational questions: what a compelling introduction looks like — not a STAR story.",
  "discriminantSignals": ["signal 1", "signal 2", "signal 3"],
  "requirements": [
    { "id": "q1-s", "text": "Framework-specific coaching prompt for component 1 — see QUESTION_TYPE_COACHING_RULE", "linkedKeywords": ["keyword1"] },
    { "id": "q1-t", "text": "Framework-specific coaching prompt for component 2", "linkedKeywords": ["keyword2"] },
    { "id": "q1-a", "text": "Framework-specific coaching prompt for component 3", "linkedKeywords": ["keyword3"] },
    { "id": "q1-r", "text": "Framework-specific coaching prompt for component 4", "linkedKeywords": ["keyword1", "keyword2"] }
  ]
}
CRITICAL: Q1 is always motivational — its requirements MUST use the INTRODUCTION framework (Who → Journey → Edge → Direction), not STAR.
Return ONLY the JSON array. No markdown, no explanation.
  `;

  const response = await withRetry(() => generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { responseMimeType: "application/json" },
  }));

  try {
    const questions: Question[] = JSON.parse(response.text || "[]");

    // Safety net: guarantee every question has all 4 STAR requirements
    const STAR_DEFAULTS = [
      { suffix: 's', label: 'Situation', fallback: 'Situation: Describe the context and background of the scenario.' },
      { suffix: 't', label: 'Task',      fallback: 'Task: Explain your specific responsibility in that situation.' },
      { suffix: 'a', label: 'Action',    fallback: 'Action: Detail the exact steps you took to address the challenge.' },
      { suffix: 'r', label: 'Result',    fallback: 'Result: Share the measurable outcome and what you learned.' },
    ];

    return questions.map((q, qi) => {
      const reqs = q.requirements || [];
      const padded = STAR_DEFAULTS.map((star, i) => {
        const existing = reqs[i];
        if (existing) return existing;
        return {
          id: `q${qi + 1}-${star.suffix}`,
          text: star.fallback,
          linkedKeywords: q.keywords?.slice(0, 1) || [],
        };
      });
      return { ...q, requirements: padded };
    });
  } catch (err) {
    console.error("Failed to parse generated questions:", err);
    return [];
  }
};

// ── Shared helpers ────────────────────────────────────────────────────────────

const STAR_FALLBACKS = [
  { suffix: 's', fallback: 'Situation: Describe the context and background of the scenario.' },
  { suffix: 't', fallback: 'Task: Explain your specific responsibility in that situation.' },
  { suffix: 'a', fallback: 'Action: Detail the exact steps you took to address the challenge.' },
  { suffix: 'r', fallback: 'Result: Share the measurable outcome and what you learned.' },
];

const isValidReqText = (text: string | undefined): boolean =>
  !!text?.trim() && !text.includes('[') && !text.includes(']');

const padQuestions = (questions: Question[], prefix: string): Question[] =>
  questions.map((q, qi) => {
    const reqs = q.requirements || [];
    const padded = STAR_FALLBACKS.map((star, i) => {
      const existing = reqs[i];
      if (existing && isValidReqText(existing.text)) return existing;
      return { id: `${prefix}${qi + 1}-${star.suffix}`, text: star.fallback, linkedKeywords: q.keywords?.slice(0, 1) || [] };
    });
    return { ...q, requirements: padded };
  });

const parseQuestions = (text: string | null | undefined, prefix: string, label: string): Question[] => {
  try {
    const questions: Question[] = JSON.parse(text || '[]');
    return padQuestions(questions, prefix);
  } catch (err) {
    console.error(`Failed to parse ${label} questions:`, err);
    return [];
  }
};

const QUESTION_TYPE_COACHING_RULE = `
Each requirement "text" field must be a specific, actionable coaching prompt tailored to THIS question and its questionType.
Use the framework that matches the questionType. Never apply STAR to a motivational or situational question.

FRAMEWORK BY QUESTION TYPE:

▸ questionType = "motivational" — use the INTRODUCTION framework (ids: -s / -t / -a / -r map to Who / Journey / Edge / Direction):
  s → "Who you are: Open with your current role or field of study, and name one defining quality that shows how you work. Be specific to your own story rather than describing a generic quality."
  t → "Your journey: Share two or three specific experiences, either professional or academic, that are most relevant to this role. Name the actual project, placement, or achievement so your answer feels real and grounded."
  a → "Your edge: Identify the specific skill, perspective, or quality that makes you stand out from others applying for this same role. Support it with one concrete piece of evidence from your background."
  r → "Your direction: Explain why this role at this company is the natural next step in your journey. Connect where you have been to where you are heading, and show that this choice is intentional rather than opportunistic."

▸ questionType = "situational" — use the CONTEXTUAL EXPERIENCE framework (ids: -s / -t / -a / -r map to Context / Your Role / Actions / Outcome):
  s → "Context: Set the scene clearly. Was this a university project, a placement, a society role, an internship, or part-time work? Give enough background so the interviewer can picture the situation."
  t → "Your role: Be specific about your own responsibility rather than describing the group's. Starting with 'I was responsible for' will always carry more weight than 'we had to'."
  a → "What you did: Walk through the exact steps you personally took. For academic or learning contexts, show how you applied your knowledge to the real problem rather than simply describing what you studied."
  r → "The outcome: Share what happened as a direct result of your actions. Include any feedback you received, what you learned, or what you would approach differently next time. Genuine reflection is always more compelling than a polished and perfect story."

▸ questionType = "behavioural" — use the STAR framework (ids: -s / -t / -a / -r):
  s → "Situation: Set the scene by sharing the context, who was involved, and what made this situation a meaningful example of this competency."
  t → "Task: Share your specific responsibility in this situation rather than the team's overall goal. What outcome were you personally accountable for delivering?"
  a → "Action: Name the two or three specific decisions or steps you personally took. Phrases like 'I decided to' and 'I specifically chose' carry far more weight than 'we tried to'."
  r → "Result: Describe what changed because of your actions. Include a measurable outcome such as a number, a timeline, or a named business impact, and close with what you took away from the experience."

▸ questionType = "knowledge-probe" — use the DOMAIN EXPERTISE framework (ids: -s / -t / -a / -r map to Principle / Application / Trade-offs / Evidence):
  s → "Principle: State the core approach, framework, or method you would apply, and briefly explain why it is the right fit for this specific situation."
  t → "Application: Walk through how you would apply it in this context. Be concrete by naming the steps, tools, or decisions you would make."
  a → "Trade-offs: Every approach has its limitations. Name one area where this method falls short, and explain how you would address or compensate for it."
  r → "Evidence: Connect your reasoning to a time when you applied this kind of thinking, even if it was in a learning, academic, or project setting. Grounding your answer in real experience shows the interviewer it is not just theoretical."

Never use placeholder brackets. Every requirement must be immediately useful to the candidate the moment they read it.`;

// ── JD + CV Alignment ─────────────────────────────────────────────────────────
export const generateJDCVAlignmentQuestions = async (
  jobDescription: string,
  cvText: string,
  targetRole: string,
  companyName: string
): Promise<{ questions: Question[]; analysis: JDCVAlignmentAnalysis | null }> => {
  // Both CV and JD must be present — without a JD there are no stated requirements to measure against
  if (!cvText.trim()) return { questions: [], analysis: null };
  if (!jobDescription.trim()) return { questions: [], analysis: null };

  // JD quality gate: reject random characters / keyboard mashing
  // Requires at least 8 distinct words AND at least one recognisable JD signal word
  const jdWords = jobDescription.trim().toLowerCase().match(/\b[a-z]{2,}\b/g) || [];
  const distinctJdWords = new Set(jdWords);
  const JD_SIGNAL_WORDS = new Set([
    'role', 'position', 'responsibilities', 'requirements', 'skills', 'experience',
    'manage', 'lead', 'develop', 'support', 'team', 'work', 'will', 'ability',
    'knowledge', 'degree', 'years', 'strong', 'working', 'business', 'candidate',
    'minimum', 'preferred', 'required', 'seeking', 'looking', 'join', 'help',
    'communicate', 'collaborate', 'deliver', 'drive', 'build', 'ensure', 'provide',
  ]);
  const hasSignalWord = jdWords.some(w => JD_SIGNAL_WORDS.has(w));
  if (distinctJdWords.size < 8 || !hasSignalWord) {
    return { questions: [], analysis: null };
  }
  const prompt = `
You are a senior occupational psychologist and behavioural interview designer.
Compare this candidate's CV against the job description for ${targetRole} at ${companyName}.

### JOB DESCRIPTION
${jobDescription.slice(0, 2000)}

### CANDIDATE CV
${cvText.slice(0, 2000)}

### YOUR TASK
Return a single JSON object with two keys: "questions" and "analysis".

"questions": array of exactly 3 interview questions targeting the most critical competency gaps or unverified CV claims.
- Select each question's competency from the taxonomy below — pick gap competencies (in JD but weak in CV)
- Apply the redundancy rules
${COMPETENCY_TAXONOMY}
${REDUNDANCY_RULES}
${QUESTION_TYPE_RULE}
- Difficulty: medium to hard
- Keep questions to 1-2 sentences — natural spoken language
${QUESTION_TYPE_COACHING_RULE}
${EXCELLENCE_BENCHMARK_RULE}
${DISCRIMINANT_SIGNALS_RULE}

Each question object must include: "text", "keywords", "difficulty",
"questionType" (behavioural/situational based on CV experience level),
"competency" (exact name from taxonomy),
"excellenceBenchmark" (2 sentences),
"discriminantSignals" (array of 2-3),
and exactly 4 "requirements" (S/T/A/R). Use ids like "jdcv1-s", "jdcv1-t", "jdcv1-a", "jdcv1-r".

"analysis": a detailed alignment report with this exact structure:
{
  "alignmentSummary": "<2-3 sentences — overall fit, key strengths, critical gaps>",
  "strengthAreas": [{ "area": "<competency>", "cvEvidence": "<what CV shows>", "jdRequirement": "<what JD asks>" }],
  "gapAreas": [{ "area": "<competency>", "jdRequirement": "<what is required>", "suggestion": "<how to address in interview>" }],
  "experienceAlignment": [{ "jdRequirement": "<specific JD requirement>", "cvEvidence": "<closest CV match or 'No direct evidence'>", "alignmentLevel": "strong"|"partial"|"weak"|"missing" }],
  "keywordAudit": { "present": ["<keyword in both>"], "missing": ["<in JD, absent from CV>"] }
}

IMPORTANT for experienceAlignment: score each JD requirement independently and honestly.
"strong" = clear, specific CV evidence directly matching the requirement.
"partial" = related experience but not a direct match — some transfer needed.
"weak" = tangential experience only — significant gap exists.
"missing" = no CV evidence at all for this requirement.

Return ONLY the JSON object. No markdown, no explanation.
  `;
  try {
    const response = await withRetry(() => generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { responseMimeType: 'application/json' }
    }));
    const parsed = JSON.parse(response.text || '{}');
    const questions = parseQuestions(JSON.stringify(parsed.questions || []), 'jdcv', 'JD-CV alignment');
    const analysis: JDCVAlignmentAnalysis | null = parsed.analysis || null;
    return { questions, analysis };
  } catch (err) {
    console.error('Failed to generate JD-CV alignment:', err);
    return { questions: [], analysis: null };
  }
};

// ── CV Competency (experience & achievements) ─────────────────────────────────
export const generateCVCompetencyQuestions = async (
  cvText: string,
  targetRole: string,
  companyName: string
): Promise<Question[]> => {
  if (!cvText.trim()) return [];
  const prompt = `
You are a senior occupational psychologist. Based on this candidate's CV, generate exactly 3 behavioural
interview questions that probe whether their stated competencies and achievements are genuinely evidenced.

### CANDIDATE CV
${cvText.slice(0, 3000)}

### CONTEXT
Target Role: ${targetRole} at ${companyName}

### STEP 1 — SELECT COMPETENCIES
Identify 3 competencies that the CV claims or implies. Select these from the taxonomy below.
These questions probe the depth behind CV claims — always 'behavioural' type (past evidence exists).
Apply the redundancy rules.
${COMPETENCY_TAXONOMY}
${REDUNDANCY_RULES}

### STEP 2 — GENERATE QUESTIONS
- Each question probes one specific CV claim or achievement — not a generic prompt
- Keep to 1-2 sentences — natural spoken language
- Difficulty: medium to hard
${QUESTION_TYPE_COACHING_RULE}
${EXCELLENCE_BENCHMARK_RULE}
${DISCRIMINANT_SIGNALS_RULE}

### OUTPUT FORMAT
Return a JSON array of exactly 3 Question objects, each with:
"text", "keywords", "difficulty", "questionType" (always "behavioural" for CV questions),
"competency" (exact name from taxonomy), "excellenceBenchmark" (2 sentences),
"discriminantSignals" (array of 2-3), and exactly 4 "requirements" (S/T/A/R).
Use ids like "cv1-s", "cv1-t", "cv1-a", "cv1-r".
Return ONLY the JSON array. No markdown, no explanation.
  `;
  const response = await withRetry(() => generateContent({ model: 'gemini-3-flash-preview', contents: [{ role: 'user', parts: [{ text: prompt }] }], config: { responseMimeType: 'application/json' } }));
  return parseQuestions(response.text, 'cv', 'CV competency');
};

// ── JD Understanding ──────────────────────────────────────────────────────────
export const generateJDUnderstandingQuestions = async (
  jobDescription: string,
  targetRole: string,
  companyName: string
): Promise<Question[]> => {
  const prompt = `
You are a senior occupational psychologist. Based on this job description, generate exactly 3 questions
that test whether the candidate has genuinely thought about what this specific role demands and why.

### JOB DESCRIPTION
${jobDescription.slice(0, 2000)}

### CONTEXT
Target Role: ${targetRole} at ${companyName}

### STEP 1 — SELECT COMPETENCIES
Select 3 competencies from the taxonomy that are most relevant to understanding and thriving in this role.
Prefer: Ambiguity Tolerance, Stakeholder Management, Organisational Navigation, Strategic Vision,
Judgment & Risk Calibration — but always driven by JD content, not defaults.
Apply the redundancy rules.
${COMPETENCY_TAXONOMY}
${REDUNDANCY_RULES}
${QUESTION_TYPE_RULE}

### STEP 2 — GENERATE QUESTIONS
- Questions reveal whether the candidate has thought deeply about role demands — not just the job title
- Mix of 'motivational' and 'situational' question types (not behavioral — these don't require past experience)
- Keep to 1-2 sentences — natural spoken language
- Difficulty: easy to medium
${QUESTION_TYPE_COACHING_RULE}
${EXCELLENCE_BENCHMARK_RULE}
${DISCRIMINANT_SIGNALS_RULE}

### OUTPUT FORMAT
Return a JSON array of exactly 3 Question objects, each with:
"text", "keywords", "difficulty", "questionType" (motivational or situational),
"competency" (exact name from taxonomy), "excellenceBenchmark" (2 sentences),
"discriminantSignals" (array of 2-3), and exactly 4 "requirements" (S/T/A/R).
Use ids like "jd1-s", "jd1-t", "jd1-a", "jd1-r".
Return ONLY the JSON array. No markdown, no explanation.
  `;
  const response = await withRetry(() => generateContent({ model: 'gemini-3-flash-preview', contents: [{ role: 'user', parts: [{ text: prompt }] }], config: { responseMimeType: 'application/json' } }));
  return parseQuestions(response.text, 'jd', 'JD understanding');
};
