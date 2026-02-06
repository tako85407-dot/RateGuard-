
import React, { useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart,
  Area,
  Line
} from 'recharts';
import { QuoteData } from '../types';

const LaneAnalysis: React.FC<{ quotes: QuoteData[] }> = ({ quotes }) => {
  
  const trendData = useMemo(() => {
    if (quotes.length === 0) return [];
    const grouped: Record<string, { total: number, count: number }> = {};
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    quotes.forEach(q => {
       const date = new Date(q.createdAt);
       const month = months[date.getMonth()];
       if (!grouped[month]) grouped[month] = { total: 0, count: 0 };
       grouped[month].total += q.markupCost || 0;
       grouped[month].count += 1;
    });

    return Object.keys(grouped).map(key => ({
      name: key,
      markup: Math.round(grouped[key].total / grouped[key].count),
      target: 50 // Target max markup
    }));
  }, [quotes]);

  const bankData = useMemo(() => {
     const counts: Record<string, number> = {};
     quotes.forEach(q => {
        counts[q.bank] = (counts[q.bank] || 0) + 1;
     });
     return Object.keys(counts).map(k => ({ name: k, count: counts[k] }));
  }, [quotes]);

  if (quotes.length === 0) {
     return (
        <div className="flex flex-col items-center justify-center min-h-[400px] bg-zinc-900/40 rounded-[2.5rem] border border-zinc-800/50">
           <h3 className="text-xl font-bold text-zinc-400">No Analytics Available</h3>
           <p className="text-zinc-600 text-sm mt-2">Upload bank wires to generate live markup insights.</p>
        </div>
     );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">Avg Markup Cost</h3>
            <div className="px-2 py-1 bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase rounded">Live Data</div>
          </div>
          
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorMarkup" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="name" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px' }}
                  itemStyle={{ color: '#fafafa' }}
                />
                <Area type="monotone" dataKey="markup" stroke="#ef4444" fillOpacity={1} fill="url(#colorMarkup)" strokeWidth={2} />
                <Line type="monotone" dataKey="target" stroke="#3b82f6" strokeDasharray="5 5" dot={false} strokeWidth={1} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 space-y-6">
          <h3 className="text-lg font-bold">Bank Volume</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bankData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="name" stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#52525b" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px' }}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
          <h3 className="text-lg font-bold">Execution Benchmarking</h3>
          <button className="text-sm font-bold text-blue-500 hover:text-blue-400">Export CSV</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="p-6 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Pair</th>
                <th className="p-6 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Bank</th>
                <th className="p-6 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Markup Cost</th>
                <th className="p-6 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody>
              {quotes.slice(0, 5).map((q, i) => (
                <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors">
                  <td className="p-6 text-sm font-bold">{q.pair}</td>
                  <td className="p-6 text-sm font-mono text-zinc-400">{q.bank}</td>
                  <td className="p-6 text-sm font-mono text-zinc-100">${q.markupCost?.toFixed(2)}</td>
                  <td className="p-6">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                      (q.markupCost || 0) > 200 ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'
                    }`}>
                      {(q.markupCost || 0) > 200 ? 'High' : 'Fair'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default LaneAnalysis;
