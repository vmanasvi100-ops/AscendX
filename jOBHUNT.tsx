
import React, { useState } from 'react';
import { 
  searchGlobalJobs, 
  searchHCIOpportunities, 
  searchUnderratedGems, 
  searchStealthVentures,
  extractJobListings,
  sanitizeUrl 
} from './services/geminiService';
import { JobListing } from './types';

interface Props {
  onAddJobs: (jobs: JobListing[]) => void;
}

type ScoutMode = 'STARTUPS' | 'UNDERRATED_GEMS' | 'ENTERPRISE' | 'OTHER_SPECIALIST';

const DomainScout: React.FC<Props> = ({ onAddJobs }) => {
  const [mode, setMode] = useState<ScoutMode>('STARTUPS');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [marketDossier, setMarketDossier] = useState<{ text: string, sources: any[] } | null>(null);
  const [foundJobs, setFoundJobs] = useState<any[]>([]);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  const handleScout = async () => {
    if (!searchTerm.trim()) {
      setError("Role required for PDP Scout.");
      return;
    }
    setLoading(true);
    setError(null);
    setMarketDossier(null);
    setFoundJobs([]);
    try {
        let result;
        if (mode === 'STARTUPS') result = await searchStealthVentures(searchTerm);
        else if (mode === 'UNDERRATED_GEMS') result = await searchUnderratedGems(searchTerm);
        else if (mode === 'ENTERPRISE') result = await searchGlobalJobs(searchTerm);
        else result = await searchHCIOpportunities(searchTerm);
        setMarketDossier(result);
    } catch (e) {
        setError("Scout protocol failure.");
    } finally {
        setLoading(false);
    }
  };

  const handleExtract = async () => {
    if (!marketDossier) return;
    setExtracting(true);
    try {
        const extracted = await extractJobListings(marketDossier.text);
        const jobs = extracted.map((j: any) => ({
            id: Math.random().toString(36).substr(2, 9),
            title: j.title,
            company: j.company,
            url: sanitizeUrl(j.url),
            platform: 'Primary Domain Hub',
            status: 'Discovered',
            dateAdded: new Date().toISOString(),
            category: j.category,
            isStealth: mode === 'STARTUPS',
            ghostProbability: j.ghostProbability,
            trapScore: j.trapScore
        }));
        setFoundJobs(jobs);
    } catch (e) {
        setError("NSP Extraction failure.");
    } finally {
        setExtracting(false);
    }
  };

  const trackJob = (job: any) => {
    onAddJobs([job]);
    setAddedIds(prev => new Set(prev).add(job.id));
  };

  const MODES: { id: ScoutMode; label: string; icon: React.ReactNode }[] = [
    { id: 'STARTUPS', label: 'Venture Anchor', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> },
    { id: 'UNDERRATED_GEMS', label: 'Hidden Gems', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg> },
    { id: 'ENTERPRISE', label: 'Enterprise Hubs', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg> },
    { id: 'OTHER_SPECIALIST', label: 'Innovation Labs', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a2 2 0 00-1.96 1.414l-.5 1.5a2 2 0 01-1.144 1.25l-2.02.76a2 2 0 01-1.92-.12l-1.5-1.125a2 2 0 00-2.31 0l-1.5 1.125a2 2 0 01-1.92.12l-2.02-.76a2 2 0 01-1.144-1.25l-.5-1.5a2 2 0 00-1.96-1.414l-2.387.477a2 2 0 00-1.022.547" /></svg> }
  ];

  return (
    <div className="flex flex-col gap-6 h-full p-2">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {MODES.map(m => (
          <button 
            key={m.id} 
            onClick={() => { setMode(m.id); setMarketDossier(null); setFoundJobs([]); }}
            className={`p-4 rounded-[24px] border-2 text-left transition-all ${mode === m.id ? 'border-indigo-600 bg-indigo-500/10 shadow-lg' : 'border-slate-800 bg-slate-900 hover:border-slate-700'}`}
          >
            <div className={`p-2 w-fit rounded-lg mb-2 ${mode === m.id ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>{m.icon}</div>
            <h4 className="text-[10px] font-black text-white uppercase tracking-widest">{m.label}</h4>
          </button>
        ))}
      </div>

      <div className="flex gap-3">
        <input 
          type="text" 
          value={searchTerm} 
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Enter exact user role... (Global Relevance Search)"
          className="flex-1 bg-slate-950 text-white rounded-2xl px-6 py-4 text-xs font-bold border border-slate-800 outline-none focus:border-indigo-500"
          onKeyDown={(e) => e.key === 'Enter' && handleScout()}
        />
        <button 
          onClick={handleScout} 
          disabled={loading}
          className="bg-indigo-600 text-white px-8 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-500 shadow-xl"
        >
          {loading ? 'Scouting...' : 'Start PDP Scout'}
        </button>
      </div>

      <div className="flex-1 bg-slate-950 rounded-[32px] border border-slate-800 overflow-hidden flex flex-col min-h-[400px]">
        {loading && (
          <div className="flex-1 flex flex-col items-center justify-center p-10 space-y-4 text-center">
             <div className="w-24 h-1 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 animate-[loading_2s_infinite]" style={{width: '30%'}} /></div>
             <p className="text-[10px] font-black uppercase text-indigo-400 animate-pulse tracking-widest">Bypassing Aggregators... Resolving Career Hubs</p>
          </div>
        )}

        {marketDossier && !loading && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 bg-slate-900/80 border-b border-slate-800 flex justify-between items-center">
              <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Global Dossier Compiled</span>
              <button 
                onClick={handleExtract} 
                disabled={extracting}
                className="px-6 py-3 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-500 shadow-lg"
              >
                {extracting ? 'Resolving Roots...' : 'Extract Opportunities'}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {foundJobs.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {foundJobs.map(job => (
                    <div key={job.id} className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between group hover:border-indigo-500 transition-all">
                      <div>
                        <div className="flex justify-between items-center mb-2">
                           <span className="text-[8px] font-black uppercase text-indigo-400 tracking-widest">Verified Primary Hub</span>
                           <div className="flex gap-1">
                             <div title={`Aggregator Trap: ${job.trapScore}%`} className={`w-1 h-3 rounded-full ${job.trapScore > 70 ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                             <div title={`Ghost Prob: ${job.ghostProbability}%`} className={`w-1 h-3 rounded-full ${job.ghostProbability > 50 ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                           </div>
                        </div>
                        <h5 className="text-[11px] font-black text-white leading-tight uppercase tracking-tight">{job.title}</h5>
                        <p className="text-[9px] font-bold text-slate-500 uppercase mt-1">{job.company}</p>
                      </div>
                      <div className="mt-4 pt-4 border-t border-slate-800/50 flex justify-between items-center">
                        <a href={job.url} target="_blank" className="text-[9px] font-black text-emerald-400 uppercase hover:underline flex items-center gap-1">
                          Official Career Root
                          <svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                        </a>
                        <button 
                          onClick={() => trackJob(job)}
                          disabled={addedIds.has(job.id)}
                          className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${addedIds.has(job.id) ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-indigo-600 text-white shadow-lg hover:bg-indigo-500'}`}
                        >
                          {addedIds.has(job.id) ? 'Tracked' : '+ Pipeline'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[11px] text-slate-400 leading-relaxed font-mono p-4">{marketDossier.text}</div>
              )}
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes loading { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }`}</style>
    </div>
  );
};

export default DomainScout;
