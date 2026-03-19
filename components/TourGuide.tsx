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

// Keep tour overlays above app modals/overlays (e.g., loading states) so coach marks remain visible.
const TOUR_Z_INDEX = 99999;
const HIGHLIGHT_Z_INDEX = TOUR_Z_INDEX - 1;
const OVERLAY_Z_INDEX = TOUR_Z_INDEX - 2;
const POPOVER_Z_INDEX = TOUR_Z_INDEX;

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
        // Report detail sections (performance summary, rubrics, CHC, insights) are rendered only after
        // the AI feedback API call completes. Use a much longer retry window (90s) so the tour waits
        // for real content instead of falling back to a floating centered popover over the loading state.
        const reportDetailTargets = [
            'report-performance-summary',
            'report-rubrics-grid',
            'report-chc-clusters',
            'report-actionable-insights',
        ];
        const maxRetries = reportDetailTargets.includes(step.targetId) ? 450 : 60;
        let timeoutId: NodeJS.Timeout | null = null;

        const centerPopover = () => {
            setPopoverStyle({
                top: Math.max(16, window.innerHeight / 2 - 90),
                left: Math.max(16, window.innerWidth / 2 - 160),
                opacity: 1,
                transform: 'translateY(0px)',
            });
        };

        const isVisibleElement = (element: HTMLElement) => {
            const style = window.getComputedStyle(element);
            return (
                style.visibility !== 'hidden' &&
                style.display !== 'none' &&
                element.offsetWidth > 0 &&
                element.offsetHeight > 0
            );
        };

        const positionForElement = (element: HTMLElement) => {
            const rect = element.getBoundingClientRect();
            const popoverPos = getPopoverPosition(rect, step.placement);
            const padding = 4;

            setHighlightStyle({
                top: rect.top - padding,
                left: rect.left - padding,
                width: rect.width + padding * 2,
                height: rect.height + padding * 2,
                opacity: 1,
            });

            setPopoverStyle({
                top: popoverPos.top,
                left: popoverPos.left,
                opacity: 1,
                transform: 'translateY(0px)',
            });
        };

        const findAndPosition = () => {
            // Restore styles on previous target
            if (prevTargetRef.current && prevTargetStyleRef.current) {
                prevTargetRef.current.style.zIndex = prevTargetStyleRef.current.zIndex;
                prevTargetRef.current.style.position = prevTargetStyleRef.current.position;
                prevTargetRef.current = null;
            }

            // Primary target lookup
            let targetElement: HTMLElement | null = document.getElementById(step.targetId);

            // Fallback: If tour is at the start-step and the consent modal is open, highlight the "Enable & Continue" button.
            if (!targetElement && step.targetId === 'welcome-start-button') {
                const consentDialog = document.querySelector('[role="dialog"][aria-modal="true"]');
                if (consentDialog instanceof HTMLElement) {
                    targetElement = consentDialog.querySelector('button');
                }
            }

            if (targetElement && isVisibleElement(targetElement)) {
                prevTargetRef.current = targetElement;
                prevTargetStyleRef.current = {
                    zIndex: targetElement.style.zIndex,
                    position: targetElement.style.position,
                };

                const currentPos = window.getComputedStyle(targetElement).position;
                if (currentPos === 'static') {
                    targetElement.style.position = 'relative';
                }
                targetElement.style.zIndex = `${HIGHLIGHT_Z_INDEX - 1}`;

                // Show the popover immediately while we compute the final placement.
                setHighlightStyle(prev => ({ ...prev, opacity: 0 }));
                centerPopover();

                targetElement.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'nearest' });

                timeoutId = setTimeout(() => {
                    // If the element has been removed from the DOM, try again.
                    if (!document.body.contains(targetElement)) {
                        if (retryCount < maxRetries) {
                            retryCount++;
                            timeoutId = setTimeout(findAndPosition, 200);
                        }
                        return;
                    }

                    if (!isVisibleElement(targetElement) && retryCount < maxRetries) {
                        retryCount++;
                        timeoutId = setTimeout(findAndPosition, 200);
                        return;
                    }

                    positionForElement(targetElement);
                }, 150);
            } else if (retryCount < maxRetries) {
                retryCount++;
                // Show the tour popover quickly while we wait for the element to appear.
                setHighlightStyle({ opacity: 0 });
                centerPopover();
                timeoutId = setTimeout(findAndPosition, 200);
            } else {
                // Fallback: element not found — keep popover centered.
                setHighlightStyle({ opacity: 0 });
                centerPopover();
            }
        };

        const repositionOnLayoutChange = () => {
            const targetElement = document.getElementById(step.targetId);
            if (targetElement && isVisibleElement(targetElement)) {
                positionForElement(targetElement);
            }
        };

        findAndPosition();
        window.addEventListener('resize', repositionOnLayoutChange);
        window.addEventListener('scroll', repositionOnLayoutChange, true);

        return () => {
            if (timeoutId) clearTimeout(timeoutId);
            window.removeEventListener('resize', repositionOnLayoutChange);
            window.removeEventListener('scroll', repositionOnLayoutChange, true);
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
        <div style={{ pointerEvents: 'none' }}>
            <div
                className="tour-overlay fixed inset-0 bg-slate-900/40"
                style={{ opacity: highlightStyle['opacity'] ? 1 : 0, zIndex: OVERLAY_Z_INDEX, pointerEvents: 'none' }}
            />
            <div
                className="tour-highlight-box"
                style={{ ...highlightStyle, zIndex: HIGHLIGHT_Z_INDEX, pointerEvents: 'none' }}
            />
            <div
                className="tour-popover bg-white rounded-lg shadow-2xl w-80"
                style={{
                    ...popoverStyle,
                    zIndex: POPOVER_Z_INDEX,
                    pointerEvents: 'auto',
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