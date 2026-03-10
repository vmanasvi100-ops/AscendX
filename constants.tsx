import React from 'react';
import type { Heuristic } from './types';

const CheckCircleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3 inline-block text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const SparklesIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3 inline-block text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
);

const BeakerIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3 inline-block text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path fillRule="evenodd" d="M3.25 2.75a.75.75 0 00-1.5 0v17.5a.75.75 0 001.5 0v-2.616c2.47-1.144 4.093-3.612 4.093-6.384 0-.649-.079-1.28-.228-1.884a.75.75 0 00-.506-.506C5.53 8.706 4.9 8.627 4.25 8.627c-2.772 0-5.24 1.623-6.384 4.093H2.5a.75.75 0 000-1.5H.75v-2.616c1.144-2.47 3.612-4.093 6.384-4.093.649 0 1.28.079 1.884.228a.75.75 0 00.506.506c.149.604.228 1.235.228 1.884 0 2.772-1.623 5.24-4.093 6.384V20.25z" clipRule="evenodd" />
    </svg>
);

const ShieldCheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3 inline-block text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 20.944a11.955 11.955 0 019-4.944 11.955 11.955 0 019 4.944 12.02 12.02 0 00-2.382-8.944z" />
    </svg>
);

const InformationCircleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3 inline-block text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

export const heuristics: Heuristic[] = [
    { name: "Visibility of System Status", description: "The interface shows your progress and time, so you always know what's happening.", icon: <CheckCircleIcon />, uiElementIds: ['ascend-progress-bar', 'ascend-timer'] },
    { name: "User Control and Freedom", description: "You can customize settings on the welcome screen and control tools like the timer.", icon: <SparklesIcon />, uiElementIds: ['welcome-feedback-preferences', 'ascend-timer'] },
    { name: "Aesthetic and Minimalist Design", description: "The clean layout and collapsible sections help you focus on your response without distraction.", icon: <BeakerIcon />, uiElementIds: ['ascend-platform-layout', 'ascend-toolkit-section'] },
    { name: "Error Prevention", description: "The camera confirmation modal helps prevent issues before the interview starts.", icon: <ShieldCheckIcon />, uiElementIds: ['welcome-start-button'] },
    { name: "Help and Documentation", description: "Help icons provide guidance exactly when and where you need it.", icon: <InformationCircleIcon />, uiElementIds: ['ascend-toolkit-section'] }
];