import { Question } from '../types';

// ── Motivational / Introductory — no STAR required ───────────────────────────
// requirements here are "What to Cover" coaching points, not STAR phases

const MOTIVATIONAL_QUESTIONS: Question[] = [
  {
    text: "Tell me about yourself and what brings you here today.",
    keywords: ["Background", "Unique Value", "Aspiration", "Role Fit"],
    difficulty: "easy",
    questionType: "motivational",
    requirements: [
      { id: "mot1-1", text: "Who you are: Ground your answer in your current reality. If you are studying, name your degree, institution, and what drew you to that field. If you are working, state your current or most recent role, the organisation, and the domain you operate in. Be specific — not just a title.", linkedKeywords: ["Background"] },
      { id: "mot1-2", text: "Your path and skills: Describe the experiences — academic, professional, or project-based — that have shaped your capabilities. Identify the skills you have built and what makes your combination of experiences distinctive. What can you do that most candidates at your level cannot?", linkedKeywords: ["Unique Value"] },
      { id: "mot1-3", text: "What you are seeking: Be honest about what you want next — growth in a specific area, a shift in domain, deeper responsibility, or exposure to a particular type of work. Vague answers like 'a challenge' or 'growth' do not land. Name the specific thing.", linkedKeywords: ["Aspiration"] },
      { id: "mot1-4", text: "Why here and why now: Connect your background, skills, and aspiration directly to this role and organisation. Show that this is a deliberate step in your progression — not a default option. End with the specific value you are ready to contribute from day one.", linkedKeywords: ["Role Fit"] },
    ],
  },
  {
    text: "Why do you want this role, and why this company specifically?",
    keywords: ["Motivation", "Company Research", "Fit"],
    difficulty: "easy",
    questionType: "motivational",
    requirements: [
      { id: "mot2-1", text: "Role fit: What specifically about this role excites you — not just the title, but the day-to-day work?", linkedKeywords: ["Motivation"] },
      { id: "mot2-2", text: "Company research: Name something specific about this company — culture, mission, product, or recent news — that resonates with you.", linkedKeywords: ["Company Research"] },
      { id: "mot2-3", text: "Personal alignment: How does this opportunity connect to where you want to go in your career?", linkedKeywords: ["Fit"] },
      { id: "mot2-4", text: "Avoid: Don't say 'great opportunity' or 'well-known company' without specifics — interviewers hear that constantly.", linkedKeywords: ["Motivation"] },
    ],
  },
  {
    text: "Where do you see yourself in three to five years?",
    keywords: ["Ambition", "Growth", "Realism"],
    difficulty: "easy",
    questionType: "motivational",
    requirements: [
      { id: "mot3-1", text: "Direction: Share a genuine career ambition — what kind of impact or expertise do you want to have?", linkedKeywords: ["Ambition"] },
      { id: "mot3-2", text: "Link to role: Explain how this position is a meaningful step toward that goal.", linkedKeywords: ["Growth"] },
      { id: "mot3-3", text: "Realism: Keep it grounded — interviewers value self-awareness over grand claims.", linkedKeywords: ["Realism"] },
      { id: "mot3-4", text: "Avoid: Don't say 'your job' or give a non-answer. Show genuine forward thinking.", linkedKeywords: ["Ambition"] },
    ],
  },
  {
    text: "What is your greatest professional strength, and how does it show up in your work?",
    keywords: ["Self-Awareness", "Evidence", "Relevance"],
    difficulty: "easy",
    questionType: "motivational",
    requirements: [
      { id: "mot4-1", text: "Name it clearly: State one genuine strength — not a list, one focused answer lands better.", linkedKeywords: ["Self-Awareness"] },
      { id: "mot4-2", text: "Show it: Give a brief, specific example of when this strength made a real difference.", linkedKeywords: ["Evidence"] },
      { id: "mot4-3", text: "Connect it: Explain why this strength is directly relevant to what this role demands.", linkedKeywords: ["Relevance"] },
      { id: "mot4-4", text: "Keep it honest: Overused answers ('I'm a perfectionist', 'I work too hard') signal low self-awareness.", linkedKeywords: ["Self-Awareness"] },
    ],
  },
];

// ── Classic Behavioural — full STAR coaching ──────────────────────────────────

const BEHAVIOURAL_QUESTIONS: Question[] = [
  {
    text: "Tell me about a time you had to lead a team through a difficult or uncertain situation.",
    keywords: ["Leadership", "Resilience", "Decision-Making"],
    difficulty: "medium",
    questionType: "behavioural",
    requirements: [
      { id: "beh1-s", text: "Situation: What was the context — team size, the challenge, and why it was difficult or uncertain?", linkedKeywords: ["Leadership"] },
      { id: "beh1-t", text: "Task: What was your specific responsibility? Were you the formal lead or did you step up?", linkedKeywords: ["Leadership"] },
      { id: "beh1-a", text: "Action: What specific steps did you take — how did you communicate, make decisions, and keep the team moving?", linkedKeywords: ["Decision-Making"] },
      { id: "beh1-r", text: "Result: What was the outcome? Include any measurable impact and what you personally learned.", linkedKeywords: ["Resilience"] },
    ],
  },
  {
    text: "Describe a time you had a conflict with a colleague or stakeholder — how did you handle it?",
    keywords: ["Conflict Resolution", "Communication", "Professionalism"],
    difficulty: "medium",
    questionType: "behavioural",
    requirements: [
      { id: "beh2-s", text: "Situation: Briefly describe the relationship and what triggered the conflict — be factual, not emotional.", linkedKeywords: ["Communication"] },
      { id: "beh2-t", text: "Task: What was your goal in resolving it — maintaining the working relationship, reaching a decision, or something else?", linkedKeywords: ["Professionalism"] },
      { id: "beh2-a", text: "Action: What exactly did you do — did you initiate a conversation, involve a third party, or change your own approach?", linkedKeywords: ["Conflict Resolution"] },
      { id: "beh2-r", text: "Result: How did it resolve? What was the impact on the team or project, and what did you take away from it?", linkedKeywords: ["Communication"] },
    ],
  },
  {
    text: "Tell me about a time you had to deliver something under significant time pressure.",
    keywords: ["Prioritisation", "Delivery", "Pressure"],
    difficulty: "medium",
    questionType: "behavioural",
    requirements: [
      { id: "beh3-s", text: "Situation: What was the deliverable, what was the deadline, and why was it tight?", linkedKeywords: ["Pressure"] },
      { id: "beh3-t", text: "Task: What was your specific responsibility within the delivery — what were you accountable for?", linkedKeywords: ["Delivery"] },
      { id: "beh3-a", text: "Action: How did you prioritise, manage your time, and handle any obstacles that came up?", linkedKeywords: ["Prioritisation"] },
      { id: "beh3-r", text: "Result: Did you deliver? What was the outcome, and what would you do differently with more time?", linkedKeywords: ["Delivery"] },
    ],
  },
  {
    text: "Tell me about a time you failed or made a significant mistake — what happened and what did you do?",
    keywords: ["Accountability", "Learning", "Resilience"],
    difficulty: "medium",
    questionType: "behavioural",
    requirements: [
      { id: "beh4-s", text: "Situation: What was the context — be honest, interviewers value candour over a sanitised story.", linkedKeywords: ["Accountability"] },
      { id: "beh4-t", text: "Task: What were you responsible for that went wrong?", linkedKeywords: ["Accountability"] },
      { id: "beh4-a", text: "Action: What did you do when you realised the mistake — how did you take ownership and address it?", linkedKeywords: ["Resilience"] },
      { id: "beh4-r", text: "Result: What was the final outcome, and what concrete change did you make to prevent it recurring?", linkedKeywords: ["Learning"] },
    ],
  },
  {
    text: "Describe a time you had to adapt quickly to a major change at work.",
    keywords: ["Adaptability", "Flexibility", "Resilience"],
    difficulty: "medium",
    questionType: "behavioural",
    requirements: [
      { id: "beh5-s", text: "Situation: What changed — strategy, team, technology, or something else? How sudden or significant was it?", linkedKeywords: ["Adaptability"] },
      { id: "beh5-t", text: "Task: What did you need to do differently as a result of the change?", linkedKeywords: ["Flexibility"] },
      { id: "beh5-a", text: "Action: How did you respond — what did you do to get up to speed, adjust your approach, or support others?", linkedKeywords: ["Adaptability"] },
      { id: "beh5-r", text: "Result: What was the outcome? How did the change affect your performance or the team's?", linkedKeywords: ["Resilience"] },
    ],
  },
  {
    text: "Tell me about a time you had to influence someone without having direct authority over them.",
    keywords: ["Influence", "Stakeholder Management", "Communication"],
    difficulty: "hard",
    questionType: "behavioural",
    requirements: [
      { id: "beh6-s", text: "Situation: Who were you trying to influence — a peer, senior, or external stakeholder — and what was the context?", linkedKeywords: ["Stakeholder Management"] },
      { id: "beh6-t", text: "Task: What outcome were you trying to achieve, and why did it matter?", linkedKeywords: ["Influence"] },
      { id: "beh6-a", text: "Action: What approach did you take — how did you build the case, adapt your style, and bring them along?", linkedKeywords: ["Communication"] },
      { id: "beh6-r", text: "Result: Were you successful? What was the outcome, and what did you learn about influencing others?", linkedKeywords: ["Influence"] },
    ],
  },
];

// ── Combined repository export ────────────────────────────────────────────────
export const QUESTION_REPOSITORY: Question[] = [
  ...MOTIVATIONAL_QUESTIONS,
  ...BEHAVIOURAL_QUESTIONS,
];
