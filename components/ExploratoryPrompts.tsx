import React from 'react';
import type { Requirement } from '../types';

const ExploratoryPrompts = ({ requirements }: { requirements: Requirement[] }) => {
    return (
        <div className="space-y-3">
            {requirements.map((req) => (
                <div key={req.id} className="flex items-start p-3 bg-slate-50 rounded-lg">
                    <div className="flex-shrink-0 mr-3 mt-1">
                        <svg className="h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <p className="text-sm text-slate-700">{req.text}</p>
                </div>
            ))}
        </div>
    );
};

export default ExploratoryPrompts;
