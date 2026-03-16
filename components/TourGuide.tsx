import React, { useState, useLayoutEffect, useRef, useEffect } from 'react';
import { TourStep } from '../types';
import { useSettings } from '../context/SettingsContext';

interface TourGuideProps {
    step: TourStep;
    currentStepIndex: number;
    totalSteps: number;
    onNext: () => void;
    onSkipSection: () => void;
    onExit: () => void;
}

const getPopoverPosition = (targetRect: DOMRect, placement: TourStep['placement']) => {
    const popoverRect = { width: 320, height: 180 }; 
    const gap = 16;

    let top = 0;
    let left = 0;

    switch (placement) {
        case 'bottom':
            top = targetRect.top + targetRect.height + gap;
            left = targetRect.left + targetRect.width / 2 - popoverRect.width / 2;
            break;
        case 'top':
            top = targetRect.top - popoverRect.height - gap;
            left = targetRect.left + targetRect.width / 2 - popoverRect.width / 2;
            break;
        case 'left':
            top = targetRect.top + targetRect.height / 2 - popoverRect.height / 2;
            left = targetRect.left - popoverRect.width - gap;
            break;
        case 'right':
            top = targetRect.top + targetRect.height / 2 - popoverRect.height / 2;
            left = targetRect.left + targetRect.width + gap;
            break;
    }

    if (left < gap) left = gap;
    else if (left + popoverRect.width > window.innerWidth - gap) left = window.innerWidth - popoverRect.width - gap;

    if (top < gap) top = gap;
    else if (top + popoverRect.height > window.innerHeight - gap) top = window.innerHeight - popoverRect.height - gap;

    return { top, left };
};

const TourGuide: React.FC<TourGuideProps> = ({ step, currentStepIndex, totalSteps, onNext, onSkipSection, onExit }) => {
    const { audioCues, speechRate } = useSettings();
    const [highlightStyle, setHighlightStyle] = useState<React.CSSProperties>({ opacity: 0 });
    const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({ opacity: 0, transform: 'translateY(10px)' });
    const prevTargetRef = useRef<HTMLElement | null>(null);
    const prevTargetStyleRef = useRef<{ zIndex: string, position: string } | null>(null);

    // Audio Support for Tour steps
    useEffect(() => {
        if (audioCues && step) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(`${step.title}. ${step.content}`);
            utterance.rate = speechRate * 0.95; // Slightly slower for clarity
            window.speechSynthesis.speak(utterance);
        }
        return () => window.speechSynthesis.cancel();
    }, [step, audioCues, speechRate]);

    useLayoutEffect(() => {
        let retryCount = 0;
        const maxRetries = 20; // Try for ~3 seconds
        let timeoutId: NodeJS.Timeout;

        const findAndPosition = () => {
            if (prevTargetRef.current && prevTargetStyleRef.current) {
                prevTargetRef.current.style.zIndex = prevTargetStyleRef.current.zIndex;
                prevTargetRef.current.style.position = prevTargetStyleRef.current.position;
            }

            const targetElement = document.getElementById(step.targetId);

            if (targetElement) {
                prevTargetRef.current = targetElement;
                prevTargetStyleRef.current = {
                    zIndex: targetElement.style.zIndex,
                    position: targetElement.style.position,
                };

                const currentPos = window.getComputedStyle(targetElement).position;
                if (currentPos === 'static') {
                    targetElement.style.position = 'relative';
                }
                targetElement.style.zIndex = '12005';

                setHighlightStyle(prev => ({ ...prev, opacity: 0 }));
                setPopoverStyle(prev => ({ ...prev, opacity: 0, transform: 'translateY(10px)' }));

                targetElement.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'nearest' });

                timeoutId = setTimeout(() => {
                    const rect = targetElement.getBoundingClientRect();
                    const popoverPos = getPopoverPosition(rect, step.placement);
                    const padding = 4;

                    setHighlightStyle({
                        top: rect.top - padding,
                        left: rect.left - padding,
                        width: rect.width + padding * 2,
                        height: rect.height + padding * 2,
                        opacity: 1
                    });
                    
                    setPopoverStyle({
                        top: popoverPos.top,
                        left: popoverPos.left,
                        opacity: 1,
                        transform: 'translateY(0px)',
                    });
                }, 150); 
            } else if (retryCount < maxRetries) {
                retryCount++;
                timeoutId = setTimeout(findAndPosition, 150);
            } else {
                setHighlightStyle({ opacity: 0 });
                setPopoverStyle({ opacity: 0, transform: 'translateY(10px)' });
            }
        };

        findAndPosition();

        return () => {
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [step.targetId, step.placement]);

    useEffect(() => {
        return () => {
            if (prevTargetRef.current && prevTargetStyleRef.current) {
                prevTargetRef.current.style.zIndex = prevTargetStyleRef.current.zIndex;
                prevTargetRef.current.style.position = prevTargetStyleRef.current.position;
            }
        };
    }, []);

    return (
        <div style={{ pointerEvents: 'auto' }}>
            <div className="tour-overlay !z-[10000] fixed inset-0 bg-slate-900/40" style={{ opacity: highlightStyle['opacity'] ? 1 : 0 }}></div>
            <div className="tour-highlight-box !z-[12006] pointer-events-none" style={highlightStyle} />
            <div 
                className="tour-popover bg-white rounded-lg shadow-2xl w-80 !z-[12007]" 
                style={{
                    ...popoverStyle,
                    transition: 'top 0.1s ease-in-out, left 0.1s ease-in-out, opacity 0.2s ease-out, transform 0.2s ease-out'
                }}
                role="dialog"
                aria-labelledby="tour-title"
                aria-describedby="tour-content"
            >
                <div className="p-5 relative">
                     <button onClick={onExit} className="absolute top-3 right-3 p-1 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400" aria-label="Close tour">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    <h3 id="tour-title" className="text-lg font-bold text-slate-800 pr-8">{step.title}</h3>
                    <p id="tour-content" className="mt-2 text-sm text-slate-600">{step.content}</p>
                </div>
                <div className="px-5 py-3 bg-slate-50 flex justify-between items-center rounded-b-lg">
                     <span className="text-sm text-slate-500">{currentStepIndex + 1} / {totalSteps}</span>
                    <div className="flex items-center gap-4">
                        {currentStepIndex < totalSteps - 1 && (
                            <button onClick={onSkipSection} className="font-semibold text-sm text-slate-500 hover:text-slate-700 transition-colors">Skip</button>
                        )}
                        <button 
                            onClick={onNext}
                            className={`px-4 py-2 rounded-lg font-semibold text-sm text-white bg-blue-600 hover:bg-blue-700 transition-colors focus:outline-none focus:ring-4 focus:ring-blue-300 ${currentStepIndex === totalSteps - 1 ? 'animate-pulse-strong' : ''}`}
                        >
                            {currentStepIndex === totalSteps - 1 ? 'Finish' : 'Next'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TourGuide;