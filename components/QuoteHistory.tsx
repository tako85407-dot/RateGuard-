import React, { useState } from 'react';
import { QuoteData } from '../types';
import { Search, Filter, FileText, Download, AlertCircle, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const rowVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0 }
};

const QuoteHistory: React.FC<{ quotes: QuoteData[] }> = ({ quotes }) => {
  const [filter, setFilter] = useState('');

  const filteredQuotes = quotes.filter(q => 
    q.bank?.toLowerCase().includes(filter.toLowerCase()) || 
    q.pair?.toLowerCase().includes(filter.toLowerCase()) ||
    q.id?.includes(filter)
  );

  return (
    <motion.div 
      className="space-y-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-3">
             <FileText size={28} className="text-blue-500" />
             Quote Ledger
          </h2>
          <p className="text-zinc-500">Secure record of all analyzed FX documents and their extraction details.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 border border-zinc-800 hover:bg-zinc-900 rounded-xl text-sm font-bold flex items-center gap-2 transition-all">
            <Filter size={16} />
            Filter
          </button>
          <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-bold text-white transition-all flex items-center gap-2">
            <Download size={16} />
            Export CSV
          </button>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex items-center gap-4">
          <Search size={18} className="text-zinc-500 ml-2" />
          <input 
            type="text" 
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search bank, currency pair, or ID..." 
            className="bg-transparent border-none outline-none text-sm text-zinc-300 w-full placeholder:text-zinc-700"
          />
        </div>

        {!quotes || quotes.length === 0 ? (
          <div className="py-40 text-center flex flex-col items-center justify-center">
            <div className="w-20 h-20 bg-zinc-950 rounded-3xl flex items-center justify-center text-zinc-800 mb-6 border border-zinc-800 border-dashed">
              <FileText size={40} />
            </div>
            <h3 className="text-xl font-bold text-zinc-400">No Quotes Analyzed</h3>
            <p className="text-zinc-600 mt-2">Upload a document to populate your ledger.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-zinc-800 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  <th className="p-6">Date</th>
                  <th className="p-6">Bank</th>
                  <th className="p-6">Pair</th>
                  <th className="p-6 text-right">Amount</th>
                  <th className="p-6 text-right">Bank Rate</th>
                  <th className="p-6 text-right">Mid-Market</th>
                  <th className="p-6 text-right">Hidden Cost</th>
                  <th className="p-6 text-right">Status</th>
                </tr>
              </thead>
              <motion.tbody 
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                {filteredQuotes.map((q) => (
                  <motion.tr 
                    key={q.id} 
                    variants={rowVariants}
                    className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-all group"
                  >
                    <td className="p-6 text-xs text-zinc-500 font-mono">
                      {new Date(q.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-6">
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400">
                            {q.bank ? q.bank[0] : '?'}
                         </div>
                         <span className="text-sm font-bold text-zinc-300">{q.bank}</span>
                      </div>
                    </td>
                    <td className="p-6">
                        <span className="px-2 py-1 bg-zinc-950 border border-zinc-800 rounded text-xs font-mono text-blue-400">
                           {q.pair}
                        </span>
                    </td>
                    <td className="p-6 text-right text-sm font-mono font-bold text-white">
                      {q.amount?.toLocaleString()}
                    </td>
                    <td className="p-6 text-right text-sm font-mono text-zinc-400">
                      {q.exchangeRate?.toFixed(4)}
                    </td>
                    <td className="p-6 text-right text-sm font-mono text-emerald-500/50">
                      {q.midMarketRate?.toFixed(4) || '-'}
                    </td>
                    <td className="p-6 text-right">
                       <span className={`font-bold font-mono text-sm ${q.markupCost > 0 ? 'text-red-500' : 'text-zinc-500'}`}>
                         ${q.markupCost?.toFixed(2)}
                       </span>
                    </td>
                    <td className="p-6 text-right">
                      <div className="flex justify-end">
                        {q.status === 'flagged' ? (
                          <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-red-500/10 text-red-500 text-[10px] font-black uppercase tracking-widest border border-red-500/20">
                             <AlertCircle size={10} /> High Fees
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">
                             <CheckCircle size={10} /> Optimal
                          </span>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </motion.tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default QuoteHistory;