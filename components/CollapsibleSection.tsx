
import React, { useState, ReactNode } from 'react';

const HelpIcon = ({ onClick }: { onClick: (event: React.MouseEvent) => void }) => (
    <button onClick={onClick} className="ml-2 p-1 -m-1 rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500" aria-label="Get help for this section">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    </button>
);

const ChevronIcon = ({ isOpen }: { isOpen: boolean }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-slate-500 transform transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
);

interface CollapsibleSectionProps {
    title: string;
    children: ReactNode;
    defaultOpen?: boolean;
    helpTopicId?: string;
    onShowHelp?: (topicId: string, event: React.MouseEvent) => void;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ title, children, defaultOpen = false, helpTopicId, onShowHelp }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="py-2 first:pt-0 last:pb-0">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex justify-between items-center text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded-md"
                aria-expanded={isOpen}
            >
                <div className="flex items-center">
                    <h3 className="text-base font-bold text-slate-800 tracking-tight">{title}</h3>
                     {helpTopicId && onShowHelp && (
                        <HelpIcon onClick={(e) => {
                            e.stopPropagation(); // Prevent collapsing when clicking help
                            onShowHelp(helpTopicId, e);
                        }} />
                    )}
                </div>
                <ChevronIcon isOpen={isOpen} />
            </button>
            <div
                className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
            >
                <div className="overflow-hidden">
                    <div className="pt-4 pb-2">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CollapsibleSection;
