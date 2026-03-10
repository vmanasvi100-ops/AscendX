
import React from 'react';
import type { AIFeedback, FeedbackStyle } from '../types';

const AIFeedbackDisplay = ({ feedback, isLoading, feedbackStyle }: { feedback: AIFeedback | null; isLoading: boolean; feedbackStyle: FeedbackStyle; }) => {
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-6 text-center bg-slate-50 rounded-lg h-full">
                <div className="spinner w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
                <h3 className="font-semibold text-slate-700">Gathering Reflections...</h3>
                <p className="text-sm text-slate-500">The AI is reflecting on your response patterns.</p>
            </div>
        );
    }

    if (!feedback) {
        return null;
    }

    const ThumbsUpIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
            <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333V17a1 1 0 001 1h6.364a1 1 0 00.942-.671l1.659-5.808a1 1 0 00-.942-1.329H9V6.5a1.5 1.5 0 00-3 0v3.833z" />
        </svg>
    );

    const LightbulbIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-500" viewBox="0 0 20 20" fill="currentColor">
            <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.657a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 14.95a1 1 0 001.414 1.414l.707-.707a1 1 0 00-1.414-1.414l-.707.707zM4 10a1 1 0 01-1 1H2a1 1 0 110-2h1a1 1 0 011 1zM10 18a1 1 0 001-1v-1a1 1 0 10-2 0v1a1 1 0 001 1zM8.94 6.553a1 1 0 00-1.88 0l-1.06 3.183A1 1 0 007 11.423V14a1 1 0 001 1h4a1 1 0 001-1v-2.577a1 1 0 00-.94-1.688l-1.06-3.183z" />
        </svg>
    );

    const HeaderIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
    );

    const getTitles = () => {
        switch (feedbackStyle) {
            case 'suggestive':
                return {
                    strengthsTitle: "Prompts for Deeper Reflection",
                    improvementsTitle: null
                };
            case 'pacing':
                return {
                    strengthsTitle: "Observations on Flow",
                    improvementsTitle: "Ideas to Explore with Pacing"
                };
            case 'direct':
            default:
                return {
                    strengthsTitle: "Great Building Blocks",
                    improvementsTitle: "Areas to Consider Next"
                };
        }
    };

    const { strengthsTitle, improvementsTitle } = getTitles();

    return (
        <div>
            <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                 <HeaderIcon />
                 Observations & Reflections
            </h3>

            <div className="space-y-6">
                <div>
                    <h4 className="font-semibold text-slate-700 mb-2">Overall Perspective</h4>
                    <p className="text-sm text-slate-600 p-3 bg-slate-50 rounded-md border border-slate-200">
                        {feedback.overallImpression}
                    </p>
                </div>
                
                {feedback.strengths.length > 0 && (
                     <div>
                        <h4 className="font-semibold text-slate-700 mb-2 flex items-center gap-2">
                            <ThumbsUpIcon /> {strengthsTitle}
                        </h4>
                        <ul className="space-y-2">
                            {feedback.strengths.map((item, index) => (
                                <li key={index} className="text-sm text-slate-600 p-3 bg-green-50 rounded-md border border-green-200">{item}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {improvementsTitle && feedback.areasForImprovement.length > 0 && (
                     <div>
                        <h4 className="font-semibold text-slate-700 mb-2 flex items-center gap-2">
                            <LightbulbIcon /> {improvementsTitle}
                        </h4>
                        <ul className="space-y-2">
                            {feedback.areasForImprovement.map((item, index) => (
                                 <li key={index} className="text-sm text-slate-600 p-3 bg-yellow-50 rounded-md border border-yellow-200">{item}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AIFeedbackDisplay;
