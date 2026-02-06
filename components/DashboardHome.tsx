
import React, { useState, useEffect } from 'react';
import { TrendingUp, ShieldCheck, Zap, ChevronRight, AlertCircle, CheckCircle, Loader2, ArrowUpRight, ArrowDownRight, Activity, Globe } from 'lucide-react';
import { QuoteData, AppView, LiveRate } from '../types';
import { fetchMarketRates } from '../services/marketData';

interface DashboardHomeProps {
  quotes: QuoteData[];
  onViewChange: (view: AppView) => void;
  onUpdateQuote?: (quote: QuoteData) => void;
}

const DashboardHome: React.FC<DashboardHomeProps> = ({ quotes, onViewChange, onUpdateQuote }) => {
  const [isApproving, setIsApproving] = useState(false);
  const [marketRates, setMarketRates] = useState<LiveRate[]>([]);
  const [source, setSource] = useState<'live' | 'simulated'>('simulated');
  
  const flaggedCount = quotes?.filter(q => q.status === 'flagged').length || 0;
  const pendingReview = quotes?.filter(q => q.workflowStatus === 'reviewed').length || 0;

  // Calculate Total Recovered
  const totalRecovered = quotes?.reduce((acc, q) => acc + (q.markupCost || 0), 0) || 0;

  useEffect(() => {
    const fetchRates = async () => {
      const data = await fetchMarketRates();
      setMarketRates(data.rates);
      setSource(data.source);
    };
    fetchRates();
    const interval = setInterval(fetchRates, 3000);
    return () => clearInterval(interval);
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
          <h2 className="text-4xl font-black text-white tracking-tighter mb-2">Treasury Digest</h2>
          <p className="text-zinc-500 font-medium">System operational. <span className="text-blue-500 font-bold">FX Spread Protection</span> active.</p>
        </div>
        <div className="flex gap-4">
           <div className="px-6 py-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-4 shadow-xl shadow-emerald-500/5">
              <div className="p-3 bg-emerald-500 rounded-xl text-white"><ShieldCheck size={20} /></div>
              <div>
                 <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Fees Recovered</div>
                 <div className="text-xl font-black text-white">${totalRecovered.toLocaleString()}</div>
              </div>
           </div>
        </div>
      </div>

      {/* Massive FX Ticker */}
      <div className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden py-3 relative">
        <div className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-[#0e121b] to-transparent w-20 z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 bg-gradient-to-l from-[#0e121b] to-transparent w-20 z-10 pointer-events-none" />
        
        <div className="flex items-center gap-4 px-6 border-b border-zinc-800/50 pb-2 mb-2">
           <div className={`w-2 h-2 rounded-full ${source === 'live' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
           <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">
             Massive FX Feed {source === 'simulated' && '(Simulation Mode)'}
           </span>
        </div>

        <div className="flex items-center gap-8 pl-4 overflow-x-auto no-scrollbar">
           {!marketRates || marketRates.length === 0 ? (
             <div className="text-xs text-zinc-600 animate-pulse px-4">Initializing Feed...</div>
           ) : (
             marketRates.map((rate) => (
               <div key={rate.id} className="flex items-center gap-4 shrink-0 pr-8 border-r border-zinc-800/50 last:border-0">
                 <div className="space-y-0.5">
                    <span className="text-xs font-bold text-zinc-300 block">{rate.pair}</span>
                    <div className="flex items-center gap-1">
                      <span className={`text-xs font-mono font-black ${rate.trend === 'up' ? 'text-emerald-500' : 'text-red-500'}`}>
                        {rate.midMarketRate?.toFixed(5)}
                      </span>
                      {rate.trend === 'up' ? <ArrowUpRight size={10} className="text-emerald-500" /> : <ArrowDownRight size={10} className="text-red-500" />}
                    </div>
                 </div>
                 <div className="space-y-0.5 text-right">
                    <div className="text-[9px] text-zinc-500 uppercase font-bold">Bank Spread</div>
                    <div className="text-[10px] font-mono text-zinc-400">{(rate.bankRate).toFixed(4)}</div>
                 </div>
                 <div className="bg-blue-500/10 px-2 py-1 rounded">
                    <div className="text-[9px] text-blue-500 uppercase font-black">Leakage</div>
                    <div className="text-[10px] font-mono text-white font-bold">{rate.savingsPips} pips</div>
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
                 <Zap className="text-orange-500" /> High Markup Detected
              </h3>
              <span className="px-4 py-1.5 bg-red-500/10 text-red-500 text-[10px] font-black uppercase rounded-full border border-red-500/20">
                 {flaggedCount} High Fees
              </span>
           </div>

           <div className="space-y-4 relative z-10">
              {(!quotes || quotes.filter(q => q.status === 'flagged').length === 0) ? (
                <div className="py-12 text-center text-zinc-600 italic text-sm border-2 border-dashed border-zinc-800 rounded-[2rem]">No excessive markups detected today.</div>
              ) : (
                quotes.filter(q => q.status === 'flagged').slice(0, 2).map(q => (
                  <div key={q.id} className="p-6 bg-zinc-950/80 rounded-[1.5rem] border border-zinc-800 flex items-center justify-between hover:border-red-500/50 transition-all cursor-pointer" onClick={() => onViewChange('quotes')}>
                    <div className="flex items-center gap-6">
                        <div className="w-12 h-12 rounded-2xl bg-zinc-900 flex items-center justify-center font-black text-zinc-500">{q.bank ? q.bank[0] : '?'}</div>
                        <div>
                          <div className="text-lg font-bold text-white">{q.bank}</div>
                          <div className="text-xs text-zinc-500">{q.pair} • {q.valueDate}</div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-xl font-black text-red-500 font-mono">${q.markupCost?.toFixed(2)}</div>
                        <div className="text-[10px] font-bold text-zinc-600 uppercase">Hidden Fee</div>
                    </div>
                  </div>
                ))
              )}
           </div>

           <button onClick={() => onViewChange('quotes')} className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-black uppercase text-xs tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2 relative z-10">
              View All Audits <ChevronRight size={16} />
           </button>
        </div>

        {/* Manager's Quick Actions */}
        <div className="space-y-8">
           <div className="bg-blue-600 rounded-[2.5rem] p-8 text-white space-y-6 shadow-2xl shadow-blue-500/20 relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 text-white opacity-10 group-hover:scale-110 transition-transform">
                <CheckCircle size={100} />
              </div>
              <h4 className="text-2xl font-black tracking-tighter uppercase relative z-10">Dispute Center</h4>
              <p className="text-blue-100 text-sm leading-relaxed relative z-10">
                 You have <span className="font-bold underline underline-offset-4">{pendingReview} audits</span> ready for dispute generation.
              </p>
              <button 
                onClick={handleBatchApprove}
                disabled={pendingReview === 0 || isApproving}
                className={`w-full py-4 bg-white text-blue-600 font-black uppercase text-xs tracking-widest rounded-2xl shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-2 relative z-10 ${pendingReview === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                 {isApproving ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle size={16} />}
                 {isApproving ? 'Generating...' : 'Batch Dispute'}
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardHome;
