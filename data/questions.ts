
import type { Question } from '../types';

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
