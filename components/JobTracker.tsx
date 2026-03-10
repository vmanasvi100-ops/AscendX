
import React, { useState, useMemo } from 'react';
import { JobListing, JobStatus } from '../types';
import { isOfficialDomain } from '../services/geminiService';

interface Props {
  jobs: JobListing[];
  onUpdateJob: (id: string, updates: Partial<JobListing>) => void;
  onRemoveJob: (id: string) => void;
}

const STATUS_COLORS: Record<JobStatus, string> = {
  Discovered: 'bg-slate-500',
  Shortlisted: 'bg-indigo-500',
  Applied: 'bg-blue-500',
  Interviewing: 'bg-amber-500',
  Offer: 'bg-emerald-500',
  Rejected: 'bg-rose-500'
};

const JobTracker: React.FC<Props> = ({ jobs, onUpdateJob, onRemoveJob }) => {
  const [filter, setFilter] = useState<JobStatus | 'All'>('All');

  const stats = useMemo(() => {
    return {
      total: jobs.length,
      funnel: {
        shortlisted: jobs.filter(j => j.status === 'Shortlisted').length,
        applied: jobs.filter(j => j.status === 'Applied').length,
        interviews: jobs.filter(j => j.status === 'Interviewing').length,
      }
    };
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    return filter === 'All' ? jobs : jobs.filter(j => j.status === filter);
  }, [jobs, filter]);

  return (
    <div className="flex flex-col gap-6 h-full animate-fade-in">
      {/* High-Density 4-Panel Strategic Header */}
      <header className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-950 p-8 rounded-[40px] border border-slate-800 shadow-2xl">
        <div className="space-y-2 border-r border-slate-800">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Global Pipeline</p>
          <div className="flex items-baseline gap-2">
            <p className="text-4xl font-black text-white">{stats.total}</p>
            <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">Leads</span>
          </div>
        </div>
        <div className="space-y-2 border-r border-slate-800 pl-4">
          <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Shortlisted</p>
          <p className="text-4xl font-black text-white">{stats.funnel.shortlisted}</p>
        </div>
        <div className="space-y-2 border-r border-slate-800 pl-4">
          <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Applied</p>
          <p className="text-4xl font-black text-white">{stats.funnel.applied}</p>
        </div>
        <div className="space-y-2 pl-4">
          <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Interviews</p>
          <p className="text-4xl font-black text-white">{stats.funnel.interviews}</p>
        </div>
      </header>

      <nav className="flex gap-2 p-1.5 bg-slate-800 rounded-2xl border border-slate-700 overflow-x-auto custom-scrollbar">
        {['All', 'Discovered', 'Shortlisted', 'Applied', 'Interviewing', 'Offer', 'Rejected'].map(s => (
          <button 
            key={s} 
            onClick={() => setFilter(s as any)}
            className={`px-6 py-3 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all whitespace-nowrap ${filter === s ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
          >
            {s}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
        {filteredJobs.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center border-4 border-dashed border-slate-800 rounded-[40px] opacity-20 text-slate-400">
             <p className="text-[10px] font-black uppercase tracking-[0.4em]">Empty Pipeline</p>
          </div>
        ) : (
          filteredJobs.map(job => {
            const verified = isOfficialDomain(job.url, job.company);
            const isATS = /lever|greenhouse|workday|smartrecruiters|myworkdayjobs/i.test(job.url);
            
            return (
              <div key={job.id} className="bg-slate-900 border border-slate-800 rounded-[32px] p-6 hover:border-indigo-500 transition-all group shadow-xl">
                <div className="flex flex-col md:flex-row justify-between gap-6">
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest text-white ${STATUS_COLORS[job.status]}`}>
                        {job.status}
                      </span>
                      {verified && (
                        <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
                           <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                           {isATS ? 'Direct ATS Hub' : 'Verified Career Root'}
                        </span>
                      )}
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-white leading-tight group-hover:text-indigo-400 transition-colors uppercase tracking-tight">{job.title}</h4>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">{job.company}</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-3 justify-between shrink-0">
                    <select 
                      value={job.status} 
                      onChange={(e) => onUpdateJob(job.id, { status: e.target.value as JobStatus })}
                      className="bg-slate-950 text-slate-400 border border-slate-800 text-[10px] font-black uppercase p-2 rounded-xl outline-none focus:border-indigo-500"
                    >
                      {['Discovered', 'Shortlisted', 'Applied', 'Interviewing', 'Offer', 'Rejected'].map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <button onClick={() => onRemoveJob(job.id)} className="p-2 text-slate-600 hover:text-rose-500 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between items-center">
                  <a href={job.url} target="_blank" className="text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:underline flex items-center gap-2">
                    Access Official Career Hub
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                  </a>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default JobTracker;
