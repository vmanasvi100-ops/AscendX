
import { Question, TourStep } from './types';

export const interviewQuestions: Question[] = [
    {
        text: "Tell me about a time you had to handle a challenging project. What was the situation, what actions did you take, and what was the result?",
        keywords: [
            "Collaborated", "Improved", "Resolved", "Learned", "Challenge", "Ownership", "Impact"
        ],
        requirements: [
            { id: 'star-s', text: 'Situation: Describe the specific challenge or project.', linkedKeywords: ['Challenge'] },
            { id: 'star-t', text: 'Task: Explain your exact responsibility and goal.', linkedKeywords: ['Ownership'] },
            { id: 'star-a', text: 'Action: Detail the steps you took to address it.', linkedKeywords: ['Collaborated', 'Improved', 'Resolved'] },
            { id: 'star-r', text: 'Result: Share the final outcome and what you learned.', linkedKeywords: ['Impact', 'Learned'] },
        ]
    },
    {
        text: "Describe a situation where you had to work with a difficult team member. How did you handle it and what was the outcome?",
        keywords: [
            "Teamwork", "Conflict", "Collaboration", "Empathy",
            "Communication", "Resolved", "Negotiated", "Productive",
            "Positive Outcome", "Professionalism", "Shared Goal", "Feedback"
        ],
        requirements: [
            { id: 'conflict-s', text: 'Situation: Describe the team context and the conflict.', linkedKeywords: ['Teamwork', 'Conflict'] },
            { id: 'conflict-t', text: 'Task: Explain your goal in resolving the friction.', linkedKeywords: ['Professionalism'] },
            { id: 'conflict-a', text: 'Action: Detail how you communicated and collaborated.', linkedKeywords: ['Communication', 'Empathy', 'Negotiated'] },
            { id: 'conflict-r', text: 'Result: Summarize the positive impact on the team.', linkedKeywords: ['Resolved', 'Productive', 'Positive Outcome', 'Shared Goal'] },
        ]
    }
];

export const tourSteps: TourStep[] = [
    // 1 — Setup
    {
        id: 'welcome-7-setup',
        targetId: 'welcome-standard-jd',
        title: 'Set Up Your Session',
        content: "Enter the company name, target role, and paste the job description. Upload your CV for personalised questions tailored to your background.",
        placement: 'top',
        component: 'welcome',
        section: 'setup',
    },
    // 2 — Start
    {
        id: 'welcome-8-start',
        targetId: 'welcome-start-button',
        title: "Ready? Let's Go.",
        content: "Once your details are in, click here to generate your questions and begin the session.",
        placement: 'top',
        component: 'welcome',
        section: 'start',
        action: 'START_INTERVIEW',
    },
    // 3 — STAR coaching plan
    {
        id: 'interview-5-star',
        targetId: 'ascend-toolkit-star',
        title: 'Your STAR Coaching Plan',
        content: "This panel shows exactly what to include in each part of your answer — Situation, Task, Action, Result. Check it before you speak.",
        placement: 'left',
        component: 'interview',
        section: 'star',
    },
    // 4 — Record
    {
        id: 'interview-6-record',
        targetId: 'ascend-record-button',
        title: 'Start Speaking',
        content: "Hit this to start recording your answer. Hit it again when you're done. The system transcribes in real-time.",
        placement: 'top',
        component: 'interview',
        section: 'record',
    },
    // 5 — Navigate STAR phases
    {
        id: 'interview-7-process',
        targetId: 'ascend-next-step-button',
        title: 'Move Through STAR',
        content: 'Use "Next Step" to advance through each STAR phase. Once you complete all four, you can move to the next question.',
        placement: 'top',
        component: 'interview',
        section: 'process',
    },
    // 6 — Deep Probe
    {
        id: 'probing-2-manual',
        targetId: 'ascend-deep-probe-button',
        title: 'Challenge Yourself',
        content: 'Use Deep Probe to get an AI follow-up question that pushes you to add more depth and evidence to your answer.',
        placement: 'bottom',
        component: 'interview',
        section: 'probing',
    },
    // 7 — Flash reports
    {
        id: 'toolkit-reports-1',
        targetId: 'ascend-toolkit-reports',
        title: 'Instant Feedback',
        content: "After each answer, a Flash Report appears here — your strengths, what was missing, and what to improve on the next question.",
        placement: 'left',
        component: 'interview',
        section: 'reports',
    },
    // 8 — Finish
    {
        id: 'interview-8-finish',
        targetId: 'ascend-next-step-button',
        title: 'Finish & Get Your Report',
        content: "When you've answered all questions, click 'Finish Session' to generate your full Coherence Audit report.",
        placement: 'top',
        component: 'interview',
        section: 'finish',
        action: 'FINISH_SESSION',
    },
];
