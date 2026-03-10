import React, { useState, useLayoutEffect, useRef } from 'react';
import { TourStep } from '../types';

interface TourGuideProps {
    step: TourStep;
    currentStepIndex: number;
    totalSteps: number;
    onNext: () => void;
    onSkipSection: () => void;
    onExit: () => void;
}

const getPopoverPosition = (targetRect: DOMRect, placement: TourStep['placement']) => {
    // Estimate popover dimensions. For a fixed-width popover, an estimate is efficient.
    const popoverRect = { width: 320, height: 180 }; 
    const gap = 16; // The space between the target and the popover.

    let top = 0;
    let left = 0;

    // 1. Calculate the ideal position based on the desired placement.
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

    // 2. Dynamically adjust the position to ensure it's fully visible within the viewport.
    // Adjust left position to prevent horizontal overflow.
    if (left < gap) {
        left = gap;
    } else if (left + popoverRect.width > window.innerWidth - gap) {
        left = window.innerWidth - popoverRect.width - gap;
    }

    // Adjust top position to prevent vertical overflow.
    if (top < gap) {
        top = gap;
    } else if (top + popoverRect.height > window.innerHeight - gap) {
        top = window.innerHeight - popoverRect.height - gap;
    }

    return { top, left };
};


const TourGuide: React.FC<TourGuideProps> = ({ step, currentStepIndex, totalSteps, onNext, onSkipSection, onExit }) => {
    const [highlightStyle, setHighlightStyle] = useState<React.CSSProperties>({ opacity: 0 });
    const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({ opacity: 0, transform: 'translateY(10px)' });
    const prevTargetRef = useRef<HTMLElement | null>(null);
    const prevTargetStyleRef = useRef<{ zIndex: string, position: string } | null>(null);

    useLayoutEffect(() => {
        // First, clean up styles from the *previous* target element
        if (prevTargetRef.current && prevTargetStyleRef.current) {
            prevTargetRef.current.style.zIndex = prevTargetStyleRef.current.zIndex;
            prevTargetRef.current.style.position = prevTargetStyleRef.current.position;
        }

        const targetElement = document.getElementById(step.targetId);

        if (targetElement) {
            // Save current target and its original styles for the *next* cleanup
            prevTargetRef.current = targetElement;
            prevTargetStyleRef.current = {
                zIndex: targetElement.style.zIndex,
                position: targetElement.style.position,
            };

            // Elevate the current target element above the overlay
            targetElement.style.position = 'relative';
            targetElement.style.zIndex = '9999';

            // Hide previous popover/highlight to prepare for transition
            setHighlightStyle(prev => ({ ...prev, opacity: 0 }));
            setPopoverStyle(prev => ({ ...prev, opacity: 0, transform: 'translateY(10px)' }));

            // Smooth scroll the target element into the middle of the viewport
            targetElement.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'nearest'
            });

            // Wait for the smooth scroll animation to finish before positioning
            // Reduced to 50ms for near-instant positioning after scroll start
            const scrollTimeout = setTimeout(() => {
                const rect = targetElement.getBoundingClientRect();
                const popoverPos = getPopoverPosition(rect, step.placement);
                const padding = 4;

                // Set styles for the highlight box to surround the element
                setHighlightStyle({
                    top: rect.top - padding,
                    left: rect.left - padding,
                    width: rect.width + padding * 2,
                    height: rect.height + padding * 2,
                    opacity: 1
                });
                
                // Set styles for the popover's position
                setPopoverStyle({
                    top: popoverPos.top,
                    left: popoverPos.left,
                    opacity: 1,
                    transform: 'translateY(0px)',
                });

            }, 50); 

            return () => clearTimeout(scrollTimeout);
        } else {
            // If target isn't found (e.g., during component transition), hide everything
            setHighlightStyle({ opacity: 0 });
            setPopoverStyle({ opacity: 0, transform: 'translateY(10px)' });
        }
    }, [step.targetId, step.placement]);

     // Final cleanup when the tour component unmounts
    React.useEffect(() => {
        return () => {
            if (prevTargetRef.current && prevTargetStyleRef.current) {
                prevTargetRef.current.style.zIndex = prevTargetStyleRef.current.zIndex;
                prevTargetRef.current.style.position = prevTargetStyleRef.current.position;
            }
        };
    }, []);

    return (
        // Wrapper with pointer-events:auto is necessary so its children can be clicked
        <div style={{ pointerEvents: 'auto' }}>
            <div className="tour-overlay" onClick={onExit} style={{ opacity: highlightStyle['opacity'] ? 1 : 0 }}></div>
            <div className="tour-highlight-box" style={highlightStyle} />
            <div 
                className="tour-popover bg-white rounded-lg shadow-2xl w-80" 
                style={{
                    ...popoverStyle,
                    // snappier durations
                    transition: 'top 0.1s ease-in-out, left 0.1s ease-in-out, opacity 0.2s ease-out, transform 0.2s ease-out'
                }}
                role="dialog"
                aria-labelledby="tour-title"
                aria-describedby="tour-content"
            >
                <div className="p-5 relative">
                     <button 
                        onClick={onExit} 
                        className="absolute top-3 right-3 p-1 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
                        aria-label="Close tour"
                    >
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
                            <button 
                                onClick={onSkipSection}
                                className="font-semibold text-sm text-slate-500 hover:text-slate-700 transition-colors"
                            >
                                Skip
                            </button>
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