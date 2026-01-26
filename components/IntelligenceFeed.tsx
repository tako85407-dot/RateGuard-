
import React, { useState, useRef } from 'react';
import { 
  FileText, 
  Loader2, 
  AlertTriangle,
  Mail,
  MessageSquare,
  X,
  Send,
  Cpu,
  Search,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { extractQuoteData } from '../services/gemini';
import { saveQuoteToFirestore, logAnalyticsEvent } from '../services/firebase';
import { QuoteData, Comment, UserProfile } from '../types';

interface IntelligenceFeedProps {
  quotes: QuoteData[];
  onAddQuote: (quote: QuoteData) => void;
  onUpdateQuote: (quote: QuoteData) => void;
  userProfile: UserProfile | null;
  onProfileUpdate?: (updates: Partial<UserProfile>) => void;
}

const IntelligenceFeed: React.FC<IntelligenceFeedProps> = ({ quotes, onAddQuote, onUpdateQuote, userProfile, onProfileUpdate }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [activeQuoteId, setActiveQuoteId] = useState<string | null>(null);
  const [disputeModal, setDisputeModal] = useState<QuoteData | null>(null);
  const [newComment, setNewComment] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeQuote = quotes.find(q => q.id === activeQuoteId);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 0. File Size Check (Firestore Limit < 1MB)
    if (file.size > 1000000) { // 1MB Safe margin
      setErrorMsg("File Size Exceeded. PDF/Image must be under 1MB for Firestore storage.");
      return;
    }

    // 1. Credit / Role Check
    const hasCredits = userProfile && userProfile.credits > 0;
    const isEnterprise = userProfile && userProfile.role === 'enterprise';
    
    if (!userProfile || (!hasCredits && !isEnterprise)) {
      setErrorMsg("Insufficient Credits. Please upgrade to Enterprise.");
      return;
    }

    setIsUploading(true);
    setErrorMsg(null);
    logAnalyticsEvent('analysis_started', { fileSize: file.size });

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const base64 = (e.target?.result as string).split(',')[1];
        
        // 2. AI Extraction
        const extracted = await extractQuoteData(base64);
        
        // 3. Save to Firestore (Quotes Collection)
        const result = await saveQuoteToFirestore(
          userProfile.uid, 
          extracted, 
          base64, 
          extracted // geminiRaw
        );

        if (result.success && result.id) {
          // Construct local object for UI
          const newQuote: QuoteData = {
             id: result.id,
             userId: userProfile.uid,
             ...extracted,
             status: extracted.totalCost > 2000 ? 'flagged' : 'analyzed',
             workflowStatus: 'uploaded',
             reliabilityScore: 85,
             timestamp: Date.now(),
             notes: []
          };

          onAddQuote(newQuote);
          
          // Optimistically update credits locally
          if (onProfileUpdate && !isEnterprise) {
            onProfileUpdate({ credits: (userProfile.credits || 0) - 1 });
          }
          
          logAnalyticsEvent('analysis_complete', { 
            carrier: newQuote.carrier, 
            cost: newQuote.totalCost 
          });
        } else {
          throw new Error(result.error || "Database Transaction failed");
        }

      } catch (error: any) { 
        console.error(error); 
        setErrorMsg(error.toString());
        logAnalyticsEvent('error_boundary', { message: 'analysis_failed', error: error.toString() });
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

  return (
    <div className="flex gap-8 h-full relative">
      <div className="flex-1 space-y-8 animate-in fade-in duration-500 overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Review Queue</h2>
          <div className="flex gap-4">
             {/* Team Indicators */}
             <div className="flex -space-x-2">
                {[1, 2].map(i => <div key={i} className="w-8 h-8 rounded-full border-2 border-[#0e121b] bg-zinc-800 flex items-center justify-center text-[10px] font-bold">U{i}</div>)}
             </div>
          </div>
        </div>
        
        <div 
          onClick={() => {
            if (userProfile && (userProfile.credits > 0 || userProfile.role === 'enterprise')) {
              fileInputRef.current?.click();
            } else {
              setErrorMsg("Insufficient Credits to process.");
            }
          }}
          className={`relative h-48 border-2 border-dashed rounded-[2rem] flex flex-col items-center justify-center cursor-pointer transition-all group overflow-hidden ${
            userProfile?.credits === 0 && userProfile.role !== 'enterprise'
              ? 'border-red-500/20 bg-red-500/5 hover:bg-red-500/10' 
              : 'border-zinc-800 bg-[#161c28]/40 hover:bg-[#1c2436]/60'
          }`}
        >
          <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileUpload} accept="application/pdf,image/*" />
          
          <div className="space-y-4 text-center">
            {userProfile?.credits === 0 && userProfile.role !== 'enterprise' ? (
              <Lock className="text-red-500 mx-auto" size={40} />
            ) : (
              <FileText className="text-zinc-600 group-hover:text-blue-500 mx-auto transition-colors" size={40} />
            )}
            
            <div>
              <p className={`text-[10px] font-black tracking-[0.3em] uppercase ${userProfile?.credits === 0 && userProfile.role !== 'enterprise' ? 'text-red-500' : 'text-zinc-500'}`}>
                {userProfile?.credits === 0 && userProfile.role !== 'enterprise' ? "Credits Depleted" : "Drop Carrier Quote"}
              </p>
              <p className="text-[9px] font-bold text-zinc-700 uppercase mt-1">
                {userProfile?.credits === 0 && userProfile.role !== 'enterprise' ? "Upgrade to Enterprise for Unlimited" : "PDF / JPG (Max 1MB)"}
              </p>
            </div>
          </div>

          <AnimatePresence>
            {isUploading && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-[#0e121b]/95 flex flex-col items-center justify-center rounded-[2rem] backdrop-blur-xl z-20"
              >
                <div className="flex flex-col items-center gap-4">
                  <div className="flex items-center gap-3">
                    <Cpu className="text-blue-500 animate-spin-slow" size={20} />
                    <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] animate-pulse">Gemini Extraction...</span>
                  </div>
                  <div className="text-[9px] font-mono text-zinc-600 uppercase">Encrypting & Storing in Firestore...</div>
                </div>
              </motion.div>
            )}
            
            {errorMsg && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
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
                  <th className="px-8 py-6">Pipeline Status</th>
                  <th className="px-8 py-6">Carrier / Reliability</th>
                  <th className="px-8 py-6">Lane Pair</th>
                  <th className="px-8 py-6 text-blue-400">Total Cost</th>
                  <th className="px-8 py-6 text-right">Terminal Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/30">
                {quotes.map((q) => (
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
                    <td className="px-8 py-8">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-sm font-black text-white">{q.carrier}</span>
                        <div className="flex items-center gap-2">
                           <div className="w-16 h-1 bg-zinc-800 rounded-full overflow-hidden">
                              <div className={`h-full ${q.reliabilityScore > 80 ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${q.reliabilityScore}%` }} />
                           </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-8 text-sm font-bold text-zinc-400">{q.origin} <span className="text-zinc-600">→</span> {q.destination}</td>
                    <td className="px-8 py-8 text-lg font-black font-mono text-white">${q.totalCost.toLocaleString()}</td>
                    <td className="px-8 py-8">
                       <div className="flex items-center justify-end gap-3">
                          {q.status === 'flagged' && !q.disputeDrafted && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); setDisputeModal(q); }}
                              className="p-2.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl transition-all border border-red-500/20 shadow-lg shadow-red-500/5"
                            >
                              <Mail size={16} />
                            </button>
                          )}
                          <button className="p-2.5 bg-zinc-800 hover:bg-blue-600 text-zinc-500 hover:text-white rounded-xl transition-all border border-zinc-700/50">
                             <MessageSquare size={16} />
                          </button>
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Collaboration Sidebar */}
      <AnimatePresence>
        {activeQuoteId && (
          <motion.div 
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 300, opacity: 0 }}
            className="w-80 bg-[#121826] border-l border-zinc-800 p-8 flex flex-col gap-8 shadow-[-20px_0_40px_rgba(0,0,0,0.5)] z-40"
          >
            <div className="flex items-center justify-between">
               <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">Operational Comms</h3>
               <button onClick={() => setActiveQuoteId(null)} className="text-zinc-500 hover:text-white transition-colors"><X size={18} /></button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
               {activeQuote?.notes.length === 0 ? (
                 <div className="text-center py-20 text-zinc-700 text-[10px] font-bold uppercase tracking-widest border border-dashed border-zinc-800/50 rounded-2xl flex flex-col items-center gap-3">
                   <Search size={24} className="opacity-20" />
                   No terminal updates.
                 </div>
               ) : (
                 activeQuote?.notes.map(note => (
                   <div key={note.id} className="p-4 bg-zinc-900/50 rounded-2xl border border-zinc-800 space-y-2 group">
                      <div className="flex items-center justify-between">
                         <span className="text-[10px] font-black text-blue-500 uppercase tracking-tighter">{note.user}</span>
                         <span className="text-[9px] text-zinc-600">NOW</span>
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
                 placeholder="Tag @team for margin review..."
                 className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-xs text-white resize-none outline-none focus:border-blue-500/50 h-28 font-medium placeholder:text-zinc-700"
               />
               <button 
                 onClick={addComment}
                 className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2 shadow-xl shadow-blue-500/10"
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
