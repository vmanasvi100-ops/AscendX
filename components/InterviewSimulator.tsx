
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mic, MicOff, Video, VideoOff, Play, Square, 
  ChevronRight, MessageSquare, BarChart3, 
  Target, Zap, AlertCircle, CheckCircle2,
  Settings, X, Maximize2, RefreshCw
} from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { interviewQuestions } from '../data/questions';
import type { Question, RecordingStatus } from '../types';

// Helper to encode audio for Gemini Live API
function encodeAudio(bytes: Uint8Array) {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

const InterviewSimulator: React.FC<{ onExit: () => void }> = ({ onExit }) => {
  const { videoEnabled, dyslexiaFont, persistedAuditResult } = useSettings();
  
  // Session State
  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [transcript, setTranscript] = useState<string>("");
  const [aiResponse, setAiResponse] = useState<string>("Welcome to your mock interview. I'm your AI coach. When you're ready, click 'Start Session' and I'll begin the interview.");
  const [isAiThinking, setIsAiThinking] = useState(false);
  
  // Media State
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null);
  const audioQueue = useRef<Int16Array[]>([]);
  const isPlaying = useRef(false);
  
  // Heuristics State
  const [pacing, setPacing] = useState(0); // WPM
  const [keywordsMatched, setKeywordsMatched] = useState<string[]>([]);
  const [starProgress, setStarProgress] = useState({ s: false, t: false, a: false, r: false });
  const [showReport, setShowReport] = useState(false);

  const currentQuestion = interviewQuestions[currentQuestionIndex];

  // Audio Playback Logic
  const playNextInQueue = useCallback(async () => {
    if (audioQueue.current.length === 0 || isPlaying.current || !audioContextRef.current) return;
    
    isPlaying.current = true;
    const pcmData = audioQueue.current.shift()!;
    
    const float32Data = new Float32Array(pcmData.length);
    for (let i = 0; i < pcmData.length; i++) {
      float32Data[i] = pcmData[i] / 32768.0;
    }
    
    const buffer = audioContextRef.current.createBuffer(1, float32Data.length, 24000);
    buffer.getChannelData(0).set(float32Data);
    
    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);
    source.onended = () => {
      isPlaying.current = false;
      playNextInQueue();
    };
    source.start();
  }, []);

  // Initialize Media
  useEffect(() => {
    async function initMedia() {
      try {
        let s: MediaStream;
        try {
          s = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "user", width: 1280, height: 720 }, 
            audio: true 
          });
        } catch (videoErr) {
          console.warn("Video failed, falling back to audio only:", videoErr);
          s = await navigator.mediaDevices.getUserMedia({ 
            audio: true 
          });
        }
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
      } catch (err) {
        console.error("Failed to access hardware:", err);
      }
    }
    initMedia();
    return () => {
      stream?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // Live API Connection
  const connectToAi = useCallback(async () => {
    if (!stream) return;

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    
    const sessionPromise = ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      callbacks: {
        onopen: () => {
          console.log("AI Connection Established");
          const source = audioContextRef.current!.createMediaStreamSource(stream);
          const processor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
          
          processor.onaudioprocess = (e) => {
            if (status !== 'recording') return;
            const inputData = e.inputBuffer.getChannelData(0);
            const int16 = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
              int16[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
            }
            const pcmBlob = { 
              data: encodeAudio(new Uint8Array(int16.buffer)), 
              mimeType: 'audio/pcm;rate=16000' 
            };
            sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
          };
          
          source.connect(processor);
          processor.connect(audioContextRef.current!.destination);
        },
        onmessage: async (message: LiveServerMessage) => {
          // Handle AI Voice Output
          const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
          if (base64Audio) {
            const binaryString = atob(base64Audio);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            audioQueue.current.push(new Int16Array(bytes.buffer));
            playNextInQueue();
          }

          // Handle Transcription
          if (message.serverContent?.inputTranscription) {
            const newText = message.serverContent.inputTranscription.text;
            setTranscript(prev => prev + " " + newText);
            analyzePacing(newText);
            checkKeywords(newText);
          }

          // Handle AI Text Response
          if (message.serverContent?.modelTurn?.parts[0]?.text) {
            setAiResponse(message.serverContent.modelTurn.parts[0].text);
            setIsAiThinking(false);
          }
        },
        onerror: (e) => console.error("AI Error:", e),
        onclose: () => console.log("AI Connection Closed")
      },
      config: {
        responseModalities: [Modality.AUDIO],
        inputAudioTranscription: {},
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } }
        },
        systemInstruction: `You are a professional, world-class recruitment auditor and interviewer. 
        
        CONTEXT:
        - Candidate's Resume Summary: ${persistedAuditResult?.summary || 'Not provided'}
        - Audit Insights: ${JSON.stringify(persistedAuditResult?.atsMapping || [])}
        - Current Question: ${currentQuestion.text}
        - Target Keywords: ${currentQuestion.keywords.join(', ')}
        
        YOUR MISSION:
        1. Conduct a realistic, high-stakes interview.
        2. Ask the current question clearly.
        3. Listen intently to the candidate's response.
        4. PROBING REQUIREMENT: After the candidate answers, you MUST ask a significant, non-sensitive, domain-specific probing question.
           - This question must be aligned with their resume/domain (based on the Audit Insights provided).
           - Use simple layman language.
           - Aim to uncover the candidate's personality and their potential future involvement/endeavors in the company.
           - Reflect on company culture or values (e.g., autonomy, competence, relatedness).
           - Be highly specific to the participant's immediate response.
           - Keep in mind Impression Management (how they present themselves), Procedural Justice (ensuring the process reflects fairness, voice, validation, respect, motivation, and clear information), and Social Identity Awareness (Highhouse et al., 2007) to observe if they are driven by intrinsic value expression or the pursuit of social recognition/alignment.
           - **Provide Explanations**: When asking follow-up probes, briefly explain *why* you are asking. Research shows that providing explanations in AI/video interviews increases fairness perceptions and organizational attractiveness (Chapman et al., 2003; Folger et al., 2022; McCarthy et al., 2017; Basch & Melchers, 2019; Hausknecht et al., 2004).
        5. Act as both a 'Standard Auditor' (checking for facts/STAR) and a 'Scientific Auditor' (analyzing behavioral patterns and coherence).
        6. Provide brief, encouraging follow-ups if they miss key STAR components.
        7. Move to the next question only after the probing phase is satisfied.
        
        Keep your tone professional, concise, and focused on deep job alignment.`
      }
    });

    sessionRef.current = await sessionPromise;
  }, [stream, status, currentQuestion, playNextInQueue, persistedAuditResult]);

  const startSession = async () => {
    setStatus('recording');
    await connectToAi();
    // Trigger the first question
    if (sessionRef.current) {
      sessionRef.current.sendRealtimeInput({
        text: "Please start the interview by asking the first question."
      });
    }
  };

  const stopSession = () => {
    setStatus('idle');
    if (sessionRef.current) {
      sessionRef.current.close();
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
  };

  const finishInterview = () => {
    stopSession();
    setShowReport(true);
  };

  // Heuristic Logic
  const analyzePacing = (text: string) => {
    const words = text.trim().split(/\s+/).length;
    // Simple WPM simulation
    setPacing(prev => Math.round((prev + (words * 12)) / 2)); 
  };

  const checkKeywords = (text: string) => {
    const lowerText = text.toLowerCase();
    const matches = currentQuestion.keywords.filter(kw => 
      lowerText.includes(kw.toLowerCase()) && !keywordsMatched.includes(kw)
    );
    if (matches.length > 0) {
      setKeywordsMatched(prev => [...prev, ...matches]);
    }
  };

  if (showReport) {
    return (
      <div className="h-screen w-screen bg-[#0A0A0B] flex items-center justify-center p-8 animate-fade-in">
        <div className="max-w-4xl w-full bg-[#0D0D0E] border border-white/10 rounded-[40px] p-12 shadow-2xl">
          <div className="flex items-center gap-6 mb-12">
            <div className="w-20 h-20 bg-emerald-500 rounded-3xl flex items-center justify-center shadow-2xl shadow-emerald-500/20">
              <CheckCircle2 className="w-10 h-10 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-black text-white tracking-tight">Interview Complete</h1>
              <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">Coherence Audit Report</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            <div className="p-6 bg-white/2 border border-white/5 rounded-3xl">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest block mb-2">Alignment Score</span>
              <div className="text-4xl font-black text-white">84%</div>
              <p className="text-[10px] text-emerald-400 font-bold mt-2">+12% from last session</p>
            </div>
            <div className="p-6 bg-white/2 border border-white/5 rounded-3xl">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest block mb-2">Avg Pacing</span>
              <div className="text-4xl font-black text-white">{pacing} <span className="text-sm text-slate-500">WPM</span></div>
              <p className="text-[10px] text-indigo-400 font-bold mt-2">Optimal: 130-160 WPM</p>
            </div>
            <div className="p-6 bg-white/2 border border-white/5 rounded-3xl">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest block mb-2">Keyword Coverage</span>
              <div className="text-4xl font-black text-white">{keywordsMatched.length} <span className="text-sm text-slate-500">/ {currentQuestion.keywords.length}</span></div>
              <p className="text-[10px] text-amber-400 font-bold mt-2">Focus on "Impact" metrics</p>
            </div>
          </div>

          <div className="space-y-6 mb-12">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest">AI Feedback Summary</h3>
            <div className="p-6 bg-indigo-500/5 border border-indigo-500/20 rounded-3xl">
              <p className="text-slate-300 leading-relaxed">
                Your narrative coherence is strong, particularly in the "Action" phase. However, your "Result" phase lacks quantifiable metrics. To improve your alignment with this role, ensure you mention specific percentages or dollar amounts when discussing outcomes.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <button onClick={onExit} className="flex-1 py-5 bg-white text-black rounded-2xl font-black uppercase tracking-widest hover:bg-slate-200 transition-all">Return to Dashboard</button>
            <button onClick={() => window.location.reload()} className="flex-1 py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-500 transition-all">Practice Again</button>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className={`h-screen w-screen bg-[#0A0A0B] text-slate-300 flex flex-col overflow-hidden ${dyslexiaFont ? 'font-dyslexia-friendly' : 'font-sans'}`}>
      
      {/* Top Navigation Bar */}
      <header className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-[#0A0A0B]/80 backdrop-blur-md z-50">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Zap className="w-5 h-5 text-white fill-white" />
          </div>
          <div>
            <h1 className="text-sm font-black uppercase tracking-[0.2em] text-white">Ascend Simulator</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Live Coherence Audit v2.4</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/10">
            <div className={`w-2 h-2 rounded-full ${status === 'recording' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
            <span className="text-[10px] font-black uppercase tracking-widest">
              {status === 'recording' ? 'Live Session' : 'Ready'}
            </span>
          </div>
          <button onClick={onExit} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* Left Sidebar: Questions & Progress */}
        <aside className="w-80 border-r border-white/5 flex flex-col bg-[#0D0D0E]">
          <div className="p-6 border-b border-white/5">
            <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-4">Interview Pipeline</h3>
            <div className="space-y-2">
              {interviewQuestions.map((q, idx) => (
                <div 
                  key={idx} 
                  className={`p-3 rounded-xl border transition-all ${
                    idx === currentQuestionIndex 
                      ? 'bg-indigo-600/10 border-indigo-500/50 text-white' 
                      : 'bg-white/2 border-white/5 opacity-40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] font-black uppercase tracking-widest">Question {idx + 1}</span>
                    {idx < currentQuestionIndex && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                  </div>
                  <p className="text-[11px] font-medium leading-relaxed line-clamp-2">{q.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
            <div>
              <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-4">Keyword Alignment</h3>
              <div className="flex flex-wrap gap-2">
                {currentQuestion.keywords.map((kw, idx) => (
                  <span 
                    key={idx} 
                    className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest transition-all ${
                      keywordsMatched.includes(kw) 
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                        : 'bg-white/5 text-slate-500 border border-white/10'
                    }`}
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-4">STAR Structure</h3>
              <div className="space-y-3">
                {['Situation', 'Task', 'Action', 'Result'].map((phase, idx) => (
                  <div key={phase} className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full border flex items-center justify-center text-[10px] font-black ${
                      idx === 0 ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'border-white/10 text-slate-600'
                    }`}>
                      {phase[0]}
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${idx === 0 ? 'text-white' : 'text-slate-600'}`}>
                      {phase}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Center: Video & HUD */}
        <section className="flex-1 relative flex flex-col bg-black">
          
          {/* Video Feed */}
          <div className="flex-1 relative overflow-hidden">
            {stream ? (
              <video 
                ref={videoRef} 
                autoPlay 
                muted 
                playsInline 
                className="w-full h-full object-cover opacity-80 grayscale-[20%] scale-x-[-1]" 
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-[#0A0A0B]">
                <div className="w-16 h-16 rounded-full border-2 border-white/10 border-t-indigo-500 animate-spin" />
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600">Initializing Hardware...</p>
              </div>
            )}

            {/* HUD Overlays */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Corner Accents */}
              <div className="absolute top-8 left-8 w-12 h-12 border-t-2 border-l-2 border-white/20" />
              <div className="absolute top-8 right-8 w-12 h-12 border-t-2 border-r-2 border-white/20" />
              <div className="absolute bottom-8 left-8 w-12 h-12 border-b-2 border-l-2 border-white/20" />
              <div className="absolute bottom-8 right-8 w-12 h-12 border-b-2 border-r-2 border-white/20" />

              {/* Pacing Widget */}
              <div className="absolute top-12 left-12 flex flex-col gap-1">
                <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Speech Pacing</span>
                <div className="flex items-end gap-1 h-8">
                  <span className="text-3xl font-black font-mono text-white leading-none">{pacing}</span>
                  <span className="text-[10px] font-bold text-slate-500 mb-1">WPM</span>
                </div>
                <div className="w-32 h-1 bg-white/10 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-indigo-500" 
                    animate={{ width: `${Math.min(100, (pacing / 180) * 100)}%` }}
                  />
                </div>
              </div>

              {/* AI Response Bubble */}
              <AnimatePresence>
                {aiResponse && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute bottom-12 left-1/2 -translate-x-1/2 w-full max-w-2xl px-8"
                  >
                    <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-6 h-6 bg-indigo-600 rounded-md flex items-center justify-center">
                          <MessageSquare className="w-3.5 h-3.5 text-white" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">AI Interviewer</span>
                      </div>
                      <p className="text-sm font-medium leading-relaxed text-white">
                        {aiResponse}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Controls Footer */}
          <footer className="h-24 border-t border-white/5 bg-[#0D0D0E] flex items-center justify-between px-12">
            <div className="flex items-center gap-8">
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Microphone</span>
                <div className="flex items-center gap-2">
                  <Mic className="w-4 h-4 text-emerald-500" />
                  <span className="text-[10px] font-bold text-white">Active</span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Camera</span>
                <div className="flex items-center gap-2">
                  <Video className="w-4 h-4 text-emerald-500" />
                  <span className="text-[10px] font-bold text-white">1080p HD</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {status === 'idle' ? (
                <button 
                  onClick={startSession}
                  className="px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black uppercase tracking-[0.2em] text-xs shadow-2xl shadow-indigo-500/20 transition-all hover:scale-105 active:scale-95 flex items-center gap-3"
                >
                  <Play className="w-4 h-4 fill-white" />
                  Start Session
                </button>
              ) : (
                <div className="flex gap-3">
                  <button 
                    onClick={stopSession}
                    className="px-6 py-4 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-black uppercase tracking-[0.2em] text-xs shadow-2xl shadow-rose-500/20 transition-all hover:scale-105 active:scale-95 flex items-center gap-3"
                  >
                    <Square className="w-4 h-4 fill-white" />
                    Stop
                  </button>
                  <button 
                    onClick={finishInterview}
                    className="px-10 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black uppercase tracking-[0.2em] text-xs shadow-2xl shadow-emerald-500/20 transition-all hover:scale-105 active:scale-95 flex items-center gap-3"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Finish Session
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4">
              <button className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors border border-white/10">
                <Settings className="w-5 h-5 text-slate-400" />
              </button>
              <button className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors border border-white/10">
                <Maximize2 className="w-5 h-5 text-slate-400" />
              </button>
            </div>
          </footer>
        </section>

        {/* Right Sidebar: Live Transcript & Analysis */}
        <aside className="w-96 border-l border-white/5 flex flex-col bg-[#0D0D0E]">
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Live Transcript</h3>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500">Real-time</span>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            <div className="space-y-6">
              {transcript ? (
                <p className="text-xs font-medium leading-relaxed text-slate-400">
                  {transcript}
                </p>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center opacity-20">
                  <MessageSquare className="w-12 h-12 mb-4" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Waiting for speech...</p>
                </div>
              )}
            </div>
          </div>

          <div className="p-6 border-t border-white/5 bg-black/20">
            <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-4">Coherence Audit</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400">Alignment Score</span>
                <span className="text-[10px] font-black text-white">84%</span>
              </div>
              <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-emerald-500" 
                  initial={{ width: 0 }}
                  animate={{ width: '84%' }}
                />
              </div>
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="w-3 h-3 text-indigo-400" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400">AI Insight</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  You're hitting the technical keywords well, but try to emphasize the "Result" phase more to prove impact.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.1); }
      `}</style>
    </div>
  );
};

export default InterviewSimulator;
