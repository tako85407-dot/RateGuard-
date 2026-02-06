
import React, { useState, useRef } from 'react';
import { FileText, Loader2, AlertTriangle, MessageSquare, X, Send, Cpu, Search, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { extractQuoteData } from '../services/gemini';
import { saveQuoteToFirestore, logAnalyticsEvent } from '../services/firebase';
import { QuoteData, Comment, UserProfile } from '../types';

interface IntelligenceFeedProps {
  quotes: QuoteData[];
  onAddQuote: (quote: QuoteData) => void;
  onUpdateQuote: (quote: QuoteData) => void;
  userProfile: UserProfile | null;
  isEnterprise: boolean;
  onProfileUpdate?: (updates: Partial<UserProfile>) => void;
}

const IntelligenceFeed: React.FC<IntelligenceFeedProps> = ({ quotes, onAddQuote, onUpdateQuote, userProfile, isEnterprise, onProfileUpdate }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [activeQuoteId, setActiveQuoteId] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeQuote = quotes?.find(q => q.id === activeQuoteId);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 1000000) {
      setErrorMsg("File Size Exceeded. PDF/Image must be under 1MB.");
      return;
    }

    const hasCredits = userProfile && userProfile.credits > 0;
    if (!userProfile || (!hasCredits && !isEnterprise)) {
      setErrorMsg("Insufficient Credits. Please upgrade to Enterprise.");
      return;
    }
    
    if (!userProfile.orgId) {
        setErrorMsg("Organization Profile missing. Please refresh.");
        return;
    }

    setIsUploading(true);
    setErrorMsg(null);
    logAnalyticsEvent('analysis_started', { fileSize: file.size });

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const base64 = (e.target?.result as string).split(',')[1];
        const extracted = await extractQuoteData(base64);
        
        const result = await saveQuoteToFirestore(
          userProfile.uid,
          userProfile.orgId!,
          extracted, 
          base64, 
          extracted
        );

        if (result.success) {
          const newQuote: QuoteData = {
             id: result.id,
             userId: userProfile.uid,
             orgId: userProfile.orgId!,
             ...extracted,
             // Explicit fallback for new FX fields if extraction missed them to prevent runtime crash
             bank: extracted.bank || 'Unknown Bank',
             pair: extracted.pair || 'USD/EUR',
             amount: extracted.amount || 0,
             exchangeRate: extracted.exchangeRate || 1.0,
             markupCost: result.markupCost || 0,
             status: (result.markupCost || 0) > 200 ? 'flagged' : 'analyzed',
             workflowStatus: 'uploaded',
             reliabilityScore: 85,
             createdAt: Date.now(),
             notes: []
          };

          onAddQuote(newQuote);
          
          if (onProfileUpdate && !isEnterprise) {
            onProfileUpdate({ credits: Math.max(0, (userProfile.credits || 0) - 1) });
          }
        } else {
          throw new Error(result.error || "Database Transaction failed");
        }

      } catch (error: any) { 
        console.error(error); 
        setErrorMsg(error.toString());
      } finally { 
        setIsUploading(false); 
      }
    };
    reader.readAsDataURL(file);
  };

  const cycleStatus = (quote: QuoteData) => {
    const statuses: Array<QuoteData['workflowStatus']> = ['uploaded', 'analyzed', 'reviewed', 'approved'];
    const nextIndex = (statuses.indexOf(quote.workflowStatus) + 1) % statuses.length;
    onUpdateQuote({ ...quote, workflowStatus: statuses[nextIndex] });
  };

  const addComment = () => {
    if (!activeQuote || !newComment) return;
    const comment: Comment = {
      id: Date.now().toString(),
      user: userProfile?.displayName || 'Manager',
      text: newComment,
      timestamp: Date.now()
    };
    onUpdateQuote({ ...activeQuote, notes: [...activeQuote.notes, comment] });
    setNewComment('');
  };

  const isLocked = !isEnterprise && userProfile?.credits === 0;

  return (
    <div className="flex gap-8 h-full relative">
      <div className="flex-1 space-y-8 animate-in fade-in duration-500 overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter">FX Audit Queue</h2>
          <div className="flex gap-4">
             <div className="flex -space-x-2">
                {[1, 2].map(i => <div key={i} className="w-8 h-8 rounded-full border-2 border-[#0e121b] bg-zinc-800 flex items-center justify-center text-[10px] font-bold">U{i}</div>)}
             </div>
          </div>
        </div>
        
        <div 
          onClick={() => {
            if (!isLocked) fileInputRef.current?.click();
            else setErrorMsg("Insufficient Credits.");
          }}
          className={`relative h-48 border-2 border-dashed rounded-[2rem] flex flex-col items-center justify-center cursor-pointer transition-all group overflow-hidden ${
            isLocked
              ? 'border-red-500/20 bg-red-500/5 hover:bg-red-500/10' 
              : 'border-zinc-800 bg-[#161c28]/40 hover:bg-[#1c2436]/60'
          }`}
        >
          <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileUpload} accept="application/pdf,image/*" />
          
          <div className="space-y-4 text-center">
            {isLocked ? (
              <Lock className="text-red-500 mx-auto" size={40} />
            ) : (
              <FileText className="text-zinc-600 group-hover:text-blue-500 mx-auto transition-colors" size={40} />
            )}
            
            <div>
              <p className={`text-[10px] font-black tracking-[0.3em] uppercase ${isLocked ? 'text-red-500' : 'text-zinc-500'}`}>
                {isLocked ? "Credits Depleted" : "Drop Bank Confirmation"}
              </p>
              <p className="text-zinc-700 text-[9px] font-bold uppercase mt-1">
                {isLocked ? "Upgrade to Enterprise for Unlimited" : "PDF / JPG (Max 1MB)"}
              </p>
            </div>
          </div>

          <AnimatePresence>
            {isUploading && (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-[#0e121b]/95 flex flex-col items-center justify-center rounded-[2rem] backdrop-blur-xl z-20"
              >
                <div className="flex flex-col items-center gap-4">
                  <div className="flex items-center gap-3">
                    <Cpu className="text-blue-500 animate-spin-slow" size={20} />
                    <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] animate-pulse">Atlas Analyzing Spread...</span>
                  </div>
                </div>
              </motion.div>
            )}
            
            {errorMsg && (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-[#0e121b]/95 flex flex-col items-center justify-center rounded-[2rem] backdrop-blur-xl z-20 text-center p-8 space-y-4"
              >
                <AlertTriangle className="text-red-500" size={48} />
                <div className="text-red-500 font-bold">{errorMsg}</div>
                <button 
                  onClick={(e) => { e.stopPropagation(); setErrorMsg(null); }}
                  className="px-6 py-3 bg-zinc-800 rounded-xl text-xs font-bold uppercase tracking-widest text-white hover:bg-zinc-700"
                >
                  Dismiss
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <section className="bg-[#121826]/40 border border-zinc-800/50 rounded-[2.5rem] overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-900/30 text-[10px] text-zinc-500 uppercase font-black tracking-[0.2em]">
                  <th className="px-8 py-6">Status</th>
                  <th className="px-8 py-6">Bank</th>
                  <th className="px-8 py-6">Pair / Rate</th>
                  <th className="px-8 py-6 text-blue-400">Amount</th>
                  <th className="px-8 py-6 text-right text-red-400">Hidden Markup</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/30">
                {quotes?.map((q) => (
                  <tr key={q.id} className="group hover:bg-zinc-800/20 transition-all cursor-pointer" onClick={() => setActiveQuoteId(q.id)}>
                    <td className="px-8 py-8">
                      <button 
                        onClick={(e) => { e.stopPropagation(); cycleStatus(q); }}
                        className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${
                          q.workflowStatus === 'approved' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' :
                          q.workflowStatus === 'reviewed' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' :
                          'bg-zinc-800/50 border-zinc-700 text-zinc-500'
                        }`}
                      >
                        {q.workflowStatus}
                      </button>
                    </td>
                    <td className="px-8 py-8 font-bold text-white">{q.bank}</td>
                    <td className="px-8 py-8 text-sm">
                      <div className="font-bold text-zinc-400">{q.pair}</div>
                      <div className="font-mono text-xs text-zinc-600">@ {q.exchangeRate}</div>
                    </td>
                    <td className="px-8 py-8 text-lg font-black font-mono text-white">${q.amount?.toLocaleString()}</td>
                    <td className="px-8 py-8 text-right font-black font-mono text-red-500">
                       ${q.markupCost?.toFixed(2) || '0.00'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <AnimatePresence>
        {activeQuoteId && (
          <motion.div 
            initial={{ x: 300, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 300, opacity: 0 }}
            className="w-80 bg-[#121826] border-l border-zinc-800 p-8 flex flex-col gap-8 shadow-[-20px_0_40px_rgba(0,0,0,0.5)] z-40"
          >
            <div className="flex items-center justify-between">
               <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">Dispute Log</h3>
               <button onClick={() => setActiveQuoteId(null)} className="text-zinc-500 hover:text-white transition-colors"><X size={18} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
               {(!activeQuote?.notes || activeQuote.notes.length === 0) ? (
                 <div className="text-center py-20 text-zinc-700 text-[10px] font-bold uppercase tracking-widest border border-dashed border-zinc-800/50 rounded-2xl flex flex-col items-center gap-3">
                   <Search size={24} className="opacity-20" />
                   No dispute notes.
                 </div>
               ) : (
                 activeQuote.notes.map(note => (
                   <div key={note.id} className="p-4 bg-zinc-900/50 rounded-2xl border border-zinc-800 space-y-2">
                      <div className="flex items-center justify-between">
                         <span className="text-[10px] font-black text-blue-500 uppercase tracking-tighter">{note.user}</span>
                      </div>
                      <p className="text-xs text-zinc-300 leading-relaxed font-medium">{note.text}</p>
                   </div>
                 ))
               )}
            </div>

            <div className="space-y-4">
               <textarea 
                 value={newComment}
                 onChange={(e) => setNewComment(e.target.value)}
                 className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-xs text-white resize-none outline-none focus:border-blue-500/50 h-28"
                 placeholder="Draft dispute message..."
               />
               <button 
                 onClick={addComment}
                 className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl"
               >
                 <Send size={14} /> Update Context
               </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default IntelligenceFeed;
