
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
    {
        id: 'welcome-1-header',
        targetId: 'welcome-header',
        title: 'Welcome to Ascend!',
        content: "This quick tour will walk you through customizing your interview experience. Your settings are saved and restored after the tour.",
        placement: 'bottom',
        component: 'welcome',
        section: 'welcome',
    },
    {
        id: 'welcome-2-audio',
        targetId: 'welcome-audio-toggle',
        title: 'Audio Assistance',
        content: 'First, let\'s try the audio cues. Click this toggle to have setup options read aloud as you interact with them.',
        placement: 'bottom',
        component: 'welcome',
        section: 'audio',
    },
    {
        id: 'welcome-3-timer-header',
        targetId: 'welcome-timer-display',
        title: 'Customize Your Timer',
        content: 'You can choose how the timer is displayed. Let\'s look at the options.',
        placement: 'bottom',
        component: 'welcome',
        section: 'timer',
    },
    {
        id: 'welcome-4-timer-progress',
        targetId: 'timer-progress',
        title: 'Timer: Progress Bar',
        content: 'This is a calm, visual bar that fills up over time. Many find this less distracting.',
        placement: 'right',
        component: 'welcome',
        section: 'timer',
    },
    {
        id: 'welcome-5-timer-countdown',
        targetId: 'timer-countdown',
        title: 'Timer: Countdown',
        content: 'A standard numeric countdown. Choose this if you prefer a clear display of the time remaining.',
        placement: 'left',
        component: 'welcome',
        section: 'timer',
    },
    {
        id: 'welcome-13-tools-header',
        targetId: 'welcome-live-tools',
        title: 'Activate Live Tools',
        content: "You can enable specific tools to help you during the interview. Let's try enabling them now.",
        placement: 'top',
        component: 'welcome',
        section: 'tools',
    },
    {
        id: 'welcome-14-tool-keyword',
        targetId: 'live-tool-keyword',
        title: 'Live Tool: Keyword Pathfinder',
        content: 'This tool provides a checklist of relevant keywords. Click the toggle to enable it.',
        placement: 'right',
        component: 'welcome',
        section: 'tools',
    },
    {
        id: 'welcome-15-tool-checklist',
        targetId: 'live-tool-checklist',
        title: 'Live Tool: Question Checklist',
        content: 'This gives you a structural checklist (like STAR) to follow. Click to enable it.',
        placement: 'right',
        component: 'welcome',
        section: 'tools',
    },
    {
        id: 'welcome-19-accessibility-header',
        targetId: 'welcome-accessibility',
        title: 'Accessibility Options',
        content: 'We offer features to create a more comfortable experience. Let\'s try a couple.',
        placement: 'top',
        component: 'welcome',
        section: 'accessibility',
    },
    {
        id: 'welcome-20-start-button',
        targetId: 'welcome-start-button',
        title: "You're All Set!",
        content: "Once you're happy with your settings, click here to begin. You will be asked for camera permission next.",
        placement: 'top',
        component: 'welcome',
        section: 'start',
        action: 'START_INTERVIEW',
    },
    {
        id: 'interview-1-layout',
        targetId: 'ascend-platform-layout',
        title: 'The Interview Platform',
        content: "This is your main workspace. On the left, you'll find the question and your video feed. On the right are your support tools.",
        placement: 'bottom',
        component: 'interview',
        section: 'intro',
    },
    {
        id: 'interview-2-question',
        targetId: 'ascend-question-prompt',
        title: 'Your Interview Question',
        content: "The current question is displayed here. You can use the speaker icon to have it read aloud.",
        placement: 'bottom',
        component: 'interview',
        section: 'question',
    },
     {
        id: 'interview-3-video',
        targetId: 'ascend-video-feed',
        title: 'Your Video Feed',
        content: "This shows your camera feed. Use the eye icon in the corner to hide your video for comfort. A 'REC' indicator will appear when recording.",
        placement: 'top',
        component: 'interview',
        section: 'video',
    },
    {
        id: 'interview-4-record',
        targetId: 'ascend-record-button',
        title: 'Record Your Answer',
        content: "When you're ready, press this button to start and stop your recording.",
        placement: 'top',
        component: 'interview',
        section: 'record',
    },
     {
        id: 'interview-5-toolkit',
        targetId: 'ascend-toolkit-section',
        title: 'Your Supportive Toolkit',
        content: "This sidebar contains the feedback tools you enabled, like the checklist and keyword ideas, to help you structure your thoughts.",
        placement: 'left',
        component: 'interview',
        section: 'toolkit',
    },
    {
        id: 'interview-6-finish',
        targetId: 'ascend-platform-layout',
        title: 'Ready to Go!',
        content: "You've completed the tour! You now have all the information you need to start your practice session. Good luck!",
        placement: 'bottom',
        component: 'interview',
        section: 'finish',
    }
];
