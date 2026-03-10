import React, { useState, useEffect, useRef } from 'react';
import type { CoachMarkTheme } from '../types';
import { useSettings } from '../context/SettingsContext';

const GuidedCoachMark = ({ text, onEnd, theme, initialPosition }: { text: string; onEnd: () => void; theme: CoachMarkTheme; initialPosition: { top: number, left: number }}) => {
    const { readAloud, speechRate } = useSettings();
    const [isMounted, setIsMounted] = useState(false);
    const selfRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState(initialPosition);

    useEffect(() => {
        setPosition(initialPosition);
    }, [initialPosition]);

    useEffect(() => {
        const timer = setTimeout(() => setIsMounted(true), 50);
        return () => clearTimeout(timer);
    }, []);
    
    const handleDismiss = () => {
        setIsMounted(false);
        setTimeout(onEnd, 100); // Drastically reduced exit transition for snappiness
    };

    // Effect for auto-dismissal
    useEffect(() => {
        if (!isMounted) return;

        if (readAloud && text) {
            window.speechSynthesis.cancel();
            
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = speechRate;
            utterance.onend = () => {
                setTimeout(handleDismiss, 100); 
            };
            window.speechSynthesis.speak(utterance);

            return () => {
                utterance.onend = null;
                window.speechSynthesis.cancel();
            };
        } else {
            // Faster reading time: 200ms per word, min 2s
            const words = text.split(' ').length;
            const readingTime = Math.max(2000, words * 200); 
            const timer = setTimeout(handleDismiss, readingTime);
            return () => clearTimeout(timer);
        }

    }, [text, readAloud, speechRate, isMounted, onEnd]);

    // Keyboard support
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') handleDismiss();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    const themeClasses = {
        default: { bg: 'bg-slate-900/95' },
        calm: { bg: 'bg-slate-800/95' }
    };
    const currentTheme = themeClasses[theme] || themeClasses.default;

    return (
        <div 
            ref={selfRef} 
            style={{ 
                ...position, 
                position: 'fixed', 
                zIndex: 100,
                maxWidth: 380,
                opacity: isMounted ? 1 : 0,
                transform: `translateY(${isMounted ? 0 : '8px'})`,
                transition: 'top 0.1s ease-out, left 0.1s ease-out, opacity 0.2s ease-out, transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)'
            }} 
            role="alert"
            aria-live="assertive"
            className={`${currentTheme.bg} backdrop-blur-md text-white rounded-2xl shadow-2xl flex items-start p-4 pr-10 gap-3 border border-white/10`}
        >
             <div className="flex-shrink-0 mt-0.5 text-blue-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
             </div>
             <p className="text-[11px] leading-relaxed font-medium text-slate-100">{text}</p>
             
             {/* Added explicit close button for user control */}
             <button 
                onClick={handleDismiss}
                className="absolute top-3 right-3 p-1 rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition-all active:scale-90"
                aria-label="Dismiss guidance"
             >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
             </button>
        </div>
    );
};

export default GuidedCoachMark;