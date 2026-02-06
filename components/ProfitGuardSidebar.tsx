
import React from 'react';
import { 
  AlertCircle, 
  HelpCircle,
  TrendingUp,
  History
} from 'lucide-react';
import { 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { QuoteData } from '../types';

interface ProfitGuardSidebarProps {
  quotes: QuoteData[];
}

const trendData = [
  { val: 1.0850 }, { val: 1.0820 }, { val: 1.0910 }, { val: 1.0890 }, { val: 1.0840 }, { val: 1.0860 }, { val: 1.0880 }, { val: 1.0900 }
];

const ProfitGuardSidebar: React.FC<ProfitGuardSidebarProps> = ({ quotes }) => {
  const flagged = quotes.find(q => q.status === 'flagged');

  return (
    <aside className="w-full lg:w-[360px] bg-[#0e121b] border-l border-zinc-800/80 p-8 flex flex-col gap-8 sticky top-0 h-full overflow-y-auto hidden xl:flex shadow-[-10px_0_30px_rgba(0,0,0,0.5)]">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em] flex items-center gap-2">
          Profit Guard™ Hub
        </h3>
        <HelpCircle size={14} className="text-zinc-700" />
      </div>

      <section className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-6 shadow-inner">
        <div className="flex items-center gap-3">
           <History size={16} className="text-blue-500" />
           <h4 className="text-xs font-black text-zinc-300 uppercase tracking-widest">Pair Memory: USD → EUR</h4>
        </div>
        
        <div className="grid grid-cols-1 gap-4">
           <div className="flex justify-between items-center p-3 bg-zinc-950 rounded-xl border border-zinc-800/50">
              <span className="text-[10px] font-bold text-zinc-500 uppercase">Mid-Market</span>
              <span className="text-sm font-black text-emerald-500 font-mono">1.0850</span>
           </div>
           <div className="flex justify-between items-center p-3 bg-zinc-950 rounded-xl border border-zinc-800/50">
              <span className="text-[10px] font-bold text-zinc-500 uppercase">Bank Rate</span>
              <span className="text-sm font-black text-blue-400 font-mono">1.1050</span>
           </div>
           <div className="flex justify-between items-center p-4 bg-red-500/10 rounded-xl border border-red-500/20">
              <div className="flex flex-col">
                 <span className="text-[10px] font-black text-red-500 uppercase">Hidden Markup</span>
                 <span className="text-xl font-black text-white font-mono">1.84%</span>
              </div>
              <div className="text-right">
                 <div className="text-[10px] font-black text-red-500">+$284.00</div>
              </div>
           </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="p-6 bg-red-500/5 border border-red-500/20 rounded-2xl relative overflow-hidden group">
          <div className="flex gap-4 relative z-10">
            <AlertCircle className="text-red-500 shrink-0" size={24} />
            <div className="space-y-2">
              <div className="text-[10px] font-black text-red-400 uppercase tracking-widest">Atlas Audit Alert</div>
              <p className="text-xs text-zinc-300 leading-relaxed font-medium">
                Surcharge drift detected. Wire {flagged?.id || 'N/A'} is bleeding <span className="text-red-500 font-black">2.1%</span> margin on execution.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
           <h3 className="text-[10px] font-black text-zinc-500 uppercase">EUR Volatility</h3>
           <TrendingUp size={14} className="text-zinc-600" />
        </div>
        <div className="h-24 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData}>
              <Area type="monotone" dataKey="val" stroke="#ef4444" fill="#ef4444" fillOpacity={0.1} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="mt-auto space-y-4">
        <div className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800">
           <div className="flex items-center justify-between text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-2">
              <span>Atlas Sync State</span>
              <span className="text-emerald-500">Live</span>
           </div>
           <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
              <div className="w-2/3 h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
           </div>
        </div>
        <button className="w-full py-4 bg-zinc-100 hover:bg-white text-[#121826] font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all shadow-2xl active:scale-95">
           Generate Daily Digest
        </button>
      </div>
    </aside>
  );
};

export default ProfitGuardSidebar;
