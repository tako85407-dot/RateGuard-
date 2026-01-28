
import React, { useState, useEffect } from 'react';
import { QuoteData, Audit } from '../types';
import { Search, Filter, MoreHorizontal, FileText, Users, Download } from 'lucide-react';
import { listenToOrgAudits, auth, syncUserToFirestore } from '../services/firebase';

const QuoteHistory: React.FC<{ quotes: QuoteData[] }> = () => {
  const [audits, setAudits] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);
  const [userOrg, setUserOrg] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        if (auth.currentUser) {
          const profile = await syncUserToFirestore(auth.currentUser);
          if (profile?.orgId) {
            setUserOrg(profile.orgId);
            // Subscribe to Shared Team Audits
            const unsubscribe = listenToOrgAudits(profile.orgId, (data) => {
              setAudits(data || []); // Ensure data is array
              setLoading(false);
            });
            return () => unsubscribe();
          } else {
              setLoading(false);
          }
        }
      } catch (e) {
        console.error("Audit init error", e);
        setLoading(false);
      }
    };
    init();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-3">
             <Users size={28} className="text-blue-500" />
             Team Audit History
          </h2>
          <p className="text-zinc-500">Real-time ledger of all audits performed by your organization.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 border border-zinc-800 hover:bg-zinc-900 rounded-xl text-sm font-bold flex items-center gap-2 transition-all">
            <Filter size={16} />
            Filter
          </button>
          <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-bold text-white transition-all flex items-center gap-2">
            <Download size={16} />
            Export Ledger
          </button>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex items-center gap-4">
          <Search size={18} className="text-zinc-500 ml-2" />
          <input 
            type="text" 
            placeholder="Search transaction ID, user, or currency pair..." 
            className="bg-transparent border-none outline-none text-sm text-zinc-300 w-full placeholder:text-zinc-700"
          />
        </div>

        {loading ? (
           <div className="py-20 text-center text-zinc-500 text-sm animate-pulse">Syncing Shared Ledger...</div>
        ) : !audits || audits.length === 0 ? (
          <div className="py-40 text-center flex flex-col items-center justify-center">
            <div className="w-20 h-20 bg-zinc-950 rounded-3xl flex items-center justify-center text-zinc-800 mb-6 border border-zinc-800 border-dashed">
              <FileText size={40} />
            </div>
            <h3 className="text-xl font-bold text-zinc-400">No Audits Found</h3>
            <p className="text-zinc-600 mt-2">Your team hasn't processed any transactions yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-zinc-800 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  <th className="p-6">Timestamp</th>
                  <th className="p-6">Auditor</th>
                  <th className="p-6">Pair</th>
                  <th className="p-6 text-right">Amount</th>
                  <th className="p-6 text-right">Bank Rate</th>
                  <th className="p-6 text-right">Leakage</th>
                  <th className="p-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {/* Safety Measure 3: Null Check for Map */}
                {audits && Array.isArray(audits) && audits.map((a) => (
                  <tr key={a.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-all group">
                    <td className="p-6 text-xs text-zinc-500 font-mono">
                      {new Date(a.timestamp).toLocaleString()}
                    </td>
                    <td className="p-6">
                      <div className="flex items-center gap-2">
                         <div className="w-6 h-6 rounded bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-400">
                            {a.userName ? a.userName[0] : '?'}
                         </div>
                         <span className="text-sm font-bold text-zinc-300">{a.userName}</span>
                      </div>
                    </td>
                    <td className="p-6">
                        <span className="px-2 py-1 bg-zinc-950 border border-zinc-800 rounded text-xs font-mono text-blue-400">
                           {a.pair}
                        </span>
                    </td>
                    <td className="p-6 text-right text-sm font-mono font-bold text-white">
                      {a.amount?.toLocaleString()}
                    </td>
                    <td className="p-6 text-right text-sm font-mono text-zinc-400">
                      {a.bankRate?.toFixed(4)}
                    </td>
                    <td className="p-6 text-right">
                       {a.leakage > 0 ? (
                         <span className="text-red-500 font-bold font-mono text-sm">-${a.leakage.toFixed(2)}</span>
                       ) : (
                         <span className="text-emerald-500 font-bold font-mono text-sm">Optimal</span>
                       )}
                    </td>
                    <td className="p-6 text-right">
                      <button className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-600 hover:text-white transition-all">
                        <MoreHorizontal size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuoteHistory;
