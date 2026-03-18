
import React, { useState, useEffect, useCallback } from 'react';
import { SettingsProvider, useSettings } from './context/SettingsContext';
import AscendPlatform from './components/AscendPlatform';
import WelcomeScreen from './components/WelcomeScreen';
import TourGuide from './components/TourGuide';
import ProductDashboard from './components/ProductDashboard';
import { tourSteps } from './data';
import type { AnalyticsEvent, AnalyticsEventType } from './types';

type AppState = 'welcome' | 'interview';

const HardwareConsentModal = ({ onAllow, onClose, error, isLoading }: { onAllow: () => void; onClose: () => void; error: string | null; isLoading: boolean; }) => {
  const [cameraConsent, setCameraConsent] = useState(false);
  const [micConsent, setMicConsent] = useState(false);

  const canProceed = cameraConsent && micConsent;

  return (
    <div className="fixed inset-0 bg-slate-900 bg-opacity-80 flex items-center justify-center z-[20000] animate-fade-in p-4" aria-modal="true" role="dialog">
      <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-lg w-full border border-slate-200">
        <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-blue-100 rounded-2xl text-blue-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
            </div>
            <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Access Permissions</h2>
                <p className="text-sm text-slate-500 font-bold uppercase tracking-widest">Hardware Authorization</p>
            </div>
        </div>

        <p className="text-slate-600 font-medium leading-relaxed mb-8">
            To provide real-time feedback and session recording, Ascend needs access to your hardware. Please confirm the following:
        </p>

        <div className="space-y-4 mb-8">
            <label className="flex items-center gap-4 p-4 rounded-2xl border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer has-[:checked]:bg-blue-50 has-[:checked]:border-blue-500">
                <input 
                    type="checkbox" 
                    checked={cameraConsent} 
                    onChange={(e) => setCameraConsent(e.target.checked)}
                    className="w-5 h-5 accent-blue-600"
                />
                <div className="flex-1">
                    <span className="block font-black text-slate-900 text-sm uppercase tracking-widest">I allow Camera access</span>
                    <span className="text-xs text-slate-500">For visual cues and environment check.</span>
                </div>
            </label>
            <label className="flex items-center gap-4 p-4 rounded-2xl border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer has-[:checked]:bg-blue-50 has-[:checked]:border-blue-500">
                <input 
                    type="checkbox" 
                    checked={micConsent} 
                    onChange={(e) => setMicConsent(e.target.checked)}
                    className="w-5 h-5 accent-blue-600"
                />
                <div className="flex-1">
                    <span className="block font-black text-slate-900 text-sm uppercase tracking-widest">I allow Microphone access</span>
                    <span className="text-xs text-slate-500">For audio transcription and analysis.</span>
                </div>
            </label>
        </div>
        
        {error && (
            <div className="mb-8 p-4 bg-rose-50 border border-rose-100 text-rose-700 rounded-2xl text-xs flex items-start gap-3 animate-fade-in" role="alert">
                <div className="p-1.5 bg-rose-100 rounded-lg text-rose-600 shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <div className="space-y-2">
                    <p className="font-black uppercase tracking-widest text-rose-800">Permission Blocked</p>
                    <p className="leading-relaxed">{error}</p>
                    <div className="p-3 bg-white/50 rounded-xl border border-rose-200 text-slate-600 leading-normal">
                        <strong>To fix:</strong> Click the <span className="inline-flex items-center px-1.5 py-0.5 bg-slate-100 rounded border border-slate-300 mx-0.5 text-[9px] font-bold">Lock icon</span> or <span className="inline-flex items-center px-1.5 py-0.5 bg-slate-100 rounded border border-slate-300 mx-0.5 text-[9px] font-bold">Camera icon</span> in your browser's address bar and set access to <strong>"Allow"</strong>. Then refresh this page.
                    </div>
                </div>
            </div>
        )}

        <div className="flex flex-col gap-3">
          <button 
            onClick={onAllow} 
            disabled={!canProceed || isLoading} 
            className="w-full py-4 rounded-2xl font-black text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all shadow-xl shadow-blue-200 flex items-center justify-center gap-2 uppercase tracking-[0.2em] text-xs"
          >
            {isLoading ? (
                <div className="spinner w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
            ) : (
                'Enable & Continue'
            )}
          </button>
          <button onClick={onClose} disabled={isLoading} className="w-full py-3 rounded-2xl font-black text-slate-500 hover:text-slate-800 transition-colors text-xs uppercase tracking-widest">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

const AppContent: React.FC = () => {
  const { 
    dyslexiaFont, 
    isTourActive, 
    tourStep, 
    nextTourStep,
    endTour,
    setVideoEnabled,
    participantId,
    condition,
    setIsPredictiveActive, // Need this to reset home view
    setFinishSessionTrigger
  } = useSettings();
  const [appState, setAppState] = useState<AppState>('welcome');
  const [isConsentModalOpen, setIsConsentModalOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCheckingPermission, setIsCheckingPermission] = useState(false);

  // Analytics State
  const [analyticsEvents, setAnalyticsEvents] = useState<AnalyticsEvent[]>(() => {
    try {
      const saved = localStorage.getItem('ascend_global_event_log');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to load global log:", e);
      return [];
    }
  });
  const [showProductDashboard, setShowProductDashboard] = useState(false);

  useEffect(() => {
    localStorage.setItem('ascend_global_event_log', JSON.stringify(analyticsEvents));
  }, [analyticsEvents]);

  const logEvent = useCallback((type: AnalyticsEventType, metadata?: Record<string, any>) => {
    const newEvent: AnalyticsEvent = { 
        type, 
        timestamp: Date.now(), 
        participantId, 
        condition, 
        metadata 
    };
    setAnalyticsEvents(prev => [...prev, newEvent]);
  }, [participantId, condition]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
            e.preventDefault();
            setShowProductDashboard(prev => !prev);
        }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  const startInterview = () => {
    setIsConsentModalOpen(true);
    setCameraError(null);
  };
  
  const handleHardwareApproval = async () => {
    setCameraError(null);
    setIsCheckingPermission(true);
    try {
        let stream: MediaStream;
        try {
            // Request permissions for both devices
            stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: "user" },
                audio: true 
            });
        } catch (videoErr) {
            console.warn("Video failed, falling back to audio only:", videoErr);
            // Fallback to audio only
            stream = await navigator.mediaDevices.getUserMedia({ 
                audio: true 
            });
        }
        
        // CRITICAL: Immediately stop tracks to release hardware. 
        stream.getTracks().forEach(track => {
            track.stop();
            track.enabled = false;
        });
        
        // Success: Video state is now authorized for the simulation platform
        setVideoEnabled(true);
        setIsConsentModalOpen(false);
        setAppState('interview');
        
        if (isTourActive && tourSteps[tourStep].action === 'START_INTERVIEW') {
            nextTourStep();
        }
    } catch (err: any) {
        console.error("Hardware authorization failed:", err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            setCameraError("Permission denied. Browser access to camera/mic is currently blocked for this site.");
        } else if (err.name === 'NotFoundError') {
            setCameraError("Hardware not found. Please connect a microphone.");
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
            setCameraError("Device is busy. Another application might be using your microphone.");
        } else {
            setCameraError(`Initialization error: ${err.message || 'Unknown error'}.`);
        }
    } finally {
        setIsCheckingPermission(false);
    }
  };

  const handleNextStep = () => {
    const currentStep = tourSteps[tourStep];
    if (currentStep.action === 'START_INTERVIEW') {
      startInterview();
    } else if (currentStep.action === 'FINISH_SESSION') {
      setFinishSessionTrigger(true);
      nextTourStep();
    } else if (tourStep === tourSteps.length - 1) {
      // Tour finished! Return to welcome screen for fresh start/configuration
      endTour();
      setAppState('welcome');
    } else {
      nextTourStep();
    }
  };

  const handleExitInterview = () => {
    logEvent('session_exit');
    setIsPredictiveActive(false); // CRITICAL: Reset to Main Homepage view
    setAppState('welcome');
    // Ensure scrolling to top
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  return (
    <div className={`min-h-screen w-screen overflow-x-hidden bg-slate-100 text-slate-800 font-sans antialiased ${dyslexiaFont ? 'font-dyslexia-friendly' : ''}`}>
      {appState === 'welcome' && <WelcomeScreen onStart={startInterview} logEvent={logEvent} />}
      {appState === 'interview' && <AscendPlatform logEvent={logEvent} onExit={handleExitInterview} />}

      {showProductDashboard && (
        <ProductDashboard 
            events={analyticsEvents} 
            onClose={() => setShowProductDashboard(false)} 
        />
      )}

      {isConsentModalOpen && (
        <HardwareConsentModal 
            onAllow={handleHardwareApproval}
            onClose={() => setIsConsentModalOpen(false)}
            error={cameraError}
            isLoading={isCheckingPermission}
        />
      )}
      
      {isTourActive && tourSteps[tourStep] && (
        <TourGuide
          step={tourSteps[tourStep]}
          currentStepIndex={tourStep}
          totalSteps={tourSteps.length}
          onNext={handleNextStep}
          onSkipSection={nextTourStep}
          onExit={() => endTour()}
        />
      )}

      {/* Copyright Watermark */}
      <div className="fixed bottom-3 right-5 z-[10000] pointer-events-none select-none opacity-20 hover:opacity-40 transition-opacity">
        <div className="flex flex-col items-end">
          <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400">© 2026 ASCEND: Practice Smart, Perform Better</p>
          <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">Confidential Proprietary System • All Rights Reserved</p>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <SettingsProvider>
      <AppContent />
    </SettingsProvider>
  );
};

export default App;
