
import React, { useState, useEffect } from 'react';
import { TrendingUp, ShieldCheck, Target, Zap, ChevronRight, AlertCircle, CheckCircle, Loader2, ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';
import { QuoteData, AppView, LiveRate } from '../types';
import { listenToRates, updateLiveRates } from '../services/firebase';

interface DashboardHomeProps {
  quotes: QuoteData[];
  onViewChange: (view: AppView) => void;
  onUpdateQuote?: (quote: QuoteData) => void;
}

const DashboardHome: React.FC<DashboardHomeProps> = ({ quotes, onViewChange, onUpdateQuote }) => {
  const [isApproving, setIsApproving] = useState(false);
  const [marketRates, setMarketRates] = useState<LiveRate[]>([]);
  // Safety Measure 2: Optional Chaining
  const flaggedCount = quotes?.filter(q => q.status === 'flagged').length || 0;
  const pendingReview = quotes?.filter(q => q.workflowStatus === 'reviewed').length || 0;

  // Real-time rates subscription
  useEffect(() => {
    const unsubscribe = listenToRates((rates) => {
      setMarketRates(rates || []);
    });
    return () => unsubscribe();
  }, []);

  // Simulation: Trigger rate updates every 5 seconds to show movement
  useEffect(() => {
    try {
      const interval = setInterval(() => {
        updateLiveRates().catch(e => console.warn("Sim update failed", e));
      }, 5000);
      // Initial call
      updateLiveRates();
      return () => clearInterval(interval);
    } catch(e) { console.error(e) }
  }, []);

  const handleBatchApprove = () => {
    if (!onUpdateQuote || !quotes) return;
    setIsApproving(true);
    setTimeout(() => {
      quotes.forEach(q => {
        if (q.workflowStatus === 'reviewed') {
          onUpdateQuote({ ...q, workflowStatus: 'approved' });
        }
      });
      setIsApproving(false);
    }, 1500);
  };
  
  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-white tracking-tighter mb-2">Daily Digest</h2>
          <p className="text-zinc-500 font-medium">System operational. Margin protection active at <span className="text-blue-500 font-bold">100% node coverage</span>.</p>
        </div>
        <div className="flex gap-4">
           <div className="px-6 py-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-4 shadow-xl shadow-emerald-500/5">
              <div className="p-3 bg-emerald-500 rounded-xl text-white"><ShieldCheck size={20} /></div>
              <div>
                 <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Margin Protected</div>
                 <div className="text-xl font-black text-white">$14,240.00</div>
              </div>
           </div>
        </div>
      </div>

      {/* Live Market Pulse Ticker (Real-Time Firestore Data) */}
      <div className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden py-3 relative">
        <div className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-[#0e121b] to-transparent w-20 z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 bg-gradient-to-l from-[#0e121b] to-transparent w-20 z-10 pointer-events-none" />
        
        <div className="flex items-center gap-4 px-6 border-b border-zinc-800/50 pb-2 mb-2">
           <Activity size={14} className="text-blue-500 animate-pulse" />
           <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Live Market Feed</span>
        </div>

        <div className="flex items-center gap-8 pl-4 overflow-x-auto no-scrollbar">
           {!marketRates || marketRates.length === 0 ? (
             <div className="text-xs text-zinc-600 animate-pulse px-4">Connecting to Exchange...</div>
           ) : (
             marketRates.map((rate) => (
               <div key={rate.id} className="flex items-center gap-3 shrink-0">
                 <span className="text-xs font-bold text-zinc-300">{rate.pair}</span>
                 <div className="flex items-center gap-1">
                   <span className={`text-xs font-mono font-black ${rate.trend === 'up' ? 'text-emerald-500' : 'text-red-500'}`}>
                     {rate.midMarketRate.toFixed(5)}
                   </span>
                   {rate.trend === 'up' ? <ArrowUpRight size={10} className="text-emerald-500" /> : <ArrowDownRight size={10} className="text-red-500" />}
                 </div>
                 <div className="flex items-center gap-1 bg-zinc-800/50 px-1.5 py-0.5 rounded">
                    <span className="text-[9px] text-zinc-500 uppercase">Spread</span>
                    <span className="text-[9px] font-bold text-blue-400">{rate.savingsPips} pips</span>
                 </div>
               </div>
             ))
           )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Flagged Alert Panel */}
        <div className="lg:col-span-2 bg-[#121826]/40 border border-zinc-800 rounded-[2.5rem] p-10 space-y-8 relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:scale-110 transition-transform">
              <AlertCircle size={160} />
           </div>
           
           <div className="flex items-center justify-between relative z-10">
              <h3 className="text-xl font-black text-white flex items-center gap-3 uppercase tracking-tighter">
                 <Zap className="text-orange-500" /> Critical Review Required
              </h3>
              <span className="px-4 py-1.5 bg-red-500/10 text-red-500 text-[10px] font-black uppercase rounded-full border border-red-500/20">
                 {flaggedCount} Flagged Items
              </span>
           </div>

           <div className="space-y-4 relative z-10">
              {(!quotes || quotes.filter(q => q.status === 'flagged').length === 0) ? (
                <div className="py-12 text-center text-zinc-600 italic text-sm border-2 border-dashed border-zinc-800 rounded-[2rem]">No critical flags at this node.</div>
              ) : (
                quotes.filter(q => q.status === 'flagged').slice(0, 2).map(q => (
                  <div key={q.id} className="p-6 bg-zinc-950/80 rounded-[1.5rem] border border-zinc-800 flex items-center justify-between hover:border-red-500/50 transition-all cursor-pointer" onClick={() => onViewChange('quotes')}>
                    <div className="flex items-center gap-6">
                        <div className="w-12 h-12 rounded-2xl bg-zinc-900 flex items-center justify-center font-black text-zinc-500">{q.carrier ? q.carrier[0] : '?'}</div>
                        <div>
                          <div className="text-lg font-bold text-white">{q.carrier}</div>
                          <div className="text-xs text-zinc-500">{q.origin} → {q.destination}</div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-xl font-black text-red-500 font-mono">${q.totalCost}</div>
                        <div className="text-[10px] font-bold text-zinc-600 uppercase">+11.4% DRIFT</div>
                    </div>
                  </div>
                ))
              )}
           </div>

           <button onClick={() => onViewChange('quotes')} className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-black uppercase text-xs tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2 relative z-10">
              View All Pipeline Items <ChevronRight size={16} />
           </button>
        </div>

        {/* Manager's Quick Actions */}
        <div className="space-y-8">
           <div className="bg-blue-600 rounded-[2.5rem] p-8 text-white space-y-6 shadow-2xl shadow-blue-500/20 relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 text-white opacity-10 group-hover:scale-110 transition-transform">
                <CheckCircle size={100} />
              </div>
              <h4 className="text-2xl font-black tracking-tighter uppercase relative z-10">Green Light Hub</h4>
              <p className="text-blue-100 text-sm leading-relaxed relative z-10">
                 You have <span className="font-bold underline underline-offset-4">{pendingReview} quotes</span> fully audited by Atlas and reviewed by your team. 
              </p>
              <button 
                onClick={handleBatchApprove}
                disabled={pendingReview === 0 || isApproving}
                className={`w-full py-4 bg-white text-blue-600 font-black uppercase text-xs tracking-widest rounded-2xl shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-2 relative z-10 ${pendingReview === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                 {isApproving ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle size={16} />}
                 {isApproving ? 'Approving Batch...' : 'Batch Approve All'}
              </button>
           </div>

           <div className="bg-zinc-900/50 border border-zinc-800 rounded-[2.5rem] p-8 space-y-6">
              <h4 className="text-sm font-black text-zinc-500 uppercase tracking-widest">Lane Goals</h4>
              <div className="space-y-4">
                 <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold">
                       <span className="text-zinc-400">SHA → LAX Target</span>
                       <span className="text-white">$1,350</span>
                    </div>
                    <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                       <div className="h-full bg-blue-500 w-[85%] shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                    </div>
                 </div>
                 <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold">
                       <span className="text-zinc-400">SEA → ROT Target</span>
                       <span className="text-white">$2,100</span>
                    </div>
                    <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                       <div className="h-full bg-emerald-500 w-[40%] shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    </div>
                 </div>
              </div>
              <button onClick={() => onViewChange('history')} className="w-full py-3 bg-zinc-800 text-zinc-500 text-[10px] font-black uppercase tracking-widest rounded-xl hover:text-white transition-all">
                Update Lane Targets
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardHome;
