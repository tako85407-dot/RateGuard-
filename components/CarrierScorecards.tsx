import React from 'react';
import { QuoteData } from '../types';
import { Star, AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const cardVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 100 }
  }
};

const CarrierScorecards: React.FC<{ quotes: QuoteData[] }> = ({ quotes }) => {
  const carriers = [
    { name: 'JP Morgan', score: 88, spread: '0.8%', fees: 'Low', trend: 'up' },
    { name: 'Chase', score: 65, spread: '2.5%', fees: 'High', trend: 'down' },
    { name: 'Wells Fargo', score: 72, spread: '1.9%', fees: 'Med', trend: 'down' },
    { name: 'Wise Business', score: 95, spread: '0.4%', fees: 'Min', trend: 'up' }
  ];

  return (
    <motion.div 
      className="space-y-10"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div>
        <h2 className="text-3xl font-bold text-white mb-2">Bank Scorecards</h2>
        <p className="text-zinc-500">The Reliability Layer: Fairness of execution vs mid-market benchmarks.</p>
      </div>

      <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {carriers.map(c => (
          <motion.div 
            key={c.name} 
            variants={cardVariants}
            whileHover={{ y: -5, borderColor: 'rgba(59, 130, 246, 0.3)' }}
            className="bg-[#121826]/40 border border-zinc-800 rounded-[2rem] p-8 space-y-6 transition-all group shadow-lg"
          >
             <div className="flex items-center justify-between">
                <div className="w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center font-black text-blue-500">{c.name[0]}</div>
                {c.trend === 'up' ? <TrendingUp size={18} className="text-emerald-500" /> : <TrendingDown size={18} className="text-red-500" />}
             </div>
             <div>
                <h3 className="text-xl font-black text-white">{c.name}</h3>
                <div className="flex items-center gap-1 mt-1">
                   {[1,2,3,4,5].map(i => <Star key={i} size={12} className={i <= Math.round(c.score/20) ? "fill-blue-500 text-blue-500" : "text-zinc-800"} />)}
                </div>
             </div>
             <div className="space-y-4">
                <div className="flex justify-between items-center text-xs">
                   <span className="text-zinc-500 font-bold uppercase tracking-widest">Fairness Score</span>
                   <span className={`font-black ${c.score > 80 ? 'text-emerald-500' : 'text-red-500'}`}>{c.score}</span>
                </div>
                <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                   <div className={`h-full ${c.score > 80 ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${c.score}%` }} />
                </div>
             </div>
             <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-800/50">
                <div className="space-y-1">
                   <div className="text-[10px] font-black text-zinc-600 uppercase">Avg Spread</div>
                   <div className="text-sm font-bold text-white">{c.spread}</div>
                </div>
                <div className="space-y-1">
                   <div className="text-[10px] font-black text-zinc-600 uppercase">Hidden Fees</div>
                   <div className="text-sm font-bold text-white">{c.fees}</div>
                </div>
             </div>
          </motion.div>
        ))}
      </motion.div>

      <motion.div 
        variants={cardVariants}
        className="bg-zinc-900/50 border border-zinc-800 rounded-[2.5rem] p-10 flex flex-col md:flex-row gap-10 items-center hover:bg-zinc-900/70 transition-colors"
      >
         <div className="w-24 h-24 bg-blue-600/10 rounded-full flex items-center justify-center text-blue-500 shrink-0 border border-blue-500/20 shadow-[0_0_30px_rgba(37,99,235,0.2)] animate-pulse">
            <AlertTriangle size={48} />
         </div>
         <div className="space-y-4">
            <h3 className="text-2xl font-black text-white tracking-tighter">Profit Guard Warning</h3>
            <p className="text-zinc-400 leading-relaxed text-sm">
              Bank <span className="text-white font-bold">Chase</span> is currently executing USD/EUR at 2.5% above mid-market, however, Atlas has tracked <span className="text-emerald-500 font-bold underline">Wise Business</span> at 0.4% spread. We recommend executing this wire via Wise to save ~$2,100.
            </p>
         </div>
         <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-8 py-4 bg-white text-[#121826] font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-xl shrink-0 transition-all"
         >
            Switch Provider
         </motion.button>
      </motion.div>
    </motion.div>
  );
};

export default CarrierScorecards;