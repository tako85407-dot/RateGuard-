import React, { useState, useRef } from 'react';
import { FileText, Loader2, AlertTriangle, MessageSquare, X, Send, Cpu, Search, Lock, ScanLine, Upload, ChevronRight, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { extractQuoteData } from '../services/gemini';
import { saveQuoteToFirestore } from '../services/firebase';
import { analyzeQuoteRealtime } from '../services/marketData';
import { QuoteData, Comment, UserProfile } from '../types';

interface IntelligenceFeedProps {
  quotes: QuoteData[];
  onAddQuote: (quote: QuoteData) => void;
  onUpdateQuote: (quote: QuoteData) => void;
  userProfile: UserProfile | null;
  isEnterprise: boolean;
  onProfileUpdate?: (updates: Partial<UserProfile>) => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 100 }
  }
};

const IntelligenceFeed: React.FC<IntelligenceFeedProps> = ({ quotes, onAddQuote, onUpdateQuote, userProfile, isEnterprise, onProfileUpdate }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [statusText, setStatusText] = useState('Initializing Node...');
  const [activeQuoteId, setActiveQuoteId] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeQuote = quotes?.find(q => q.id === activeQuoteId);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset States
    setErrorMsg(null);
    setStatusText("Encrypting Stream...");
    
    // 1. Validation
    if (file.size > 5000000) { 
      setErrorMsg("File Size Exceeded. Must be under 5MB.");
      return;
    }

    const hasCredits = userProfile && userProfile.credits > 0;
    if (!userProfile || (!hasCredits && !isEnterprise)) {
      setErrorMsg("Insufficient Credits. Please upgrade to Enterprise.");
      return;
    }
    
    const currentUid = userProfile.uid;
    const currentOrgId = userProfile.orgId;

    if (!currentUid || !currentOrgId) {
        setErrorMsg("Session Error. Please reload.");
        return;
    }

    setIsUploading(true);

    try {
      // 2. Convert to Base64
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        try {
          const base64 = (reader.result as string).split(',')[1];
          const mimeType = file.type || 'image/jpeg';
          
          // 3. AI Extraction
          setStatusText("Atlas AI: Extracting Trade Data...");
          const extractionResult = await extractQuoteData(base64, mimeType);

          // 4. Market Analysis
          setStatusText("Profit Guard: Benchmarking Rates...");
          const quoteDetails = extractionResult.transaction || {};
          const audit = await analyzeQuoteRealtime(
            quoteDetails.currency_pair || "USD/EUR",
            quoteDetails.exchange_rate_bank || 1.0,
            quoteDetails.original_amount || 10000,
            quoteDetails.value_date
          );

          // 5. Merge Data
          const finalQuoteData: Partial<QuoteData> = {
            bank: extractionResult.extraction?.bank_name || "Unknown Bank",
            pair: quoteDetails.currency_pair || "USD/EUR",
            amount: quoteDetails.original_amount || 0,
            exchangeRate: quoteDetails.exchange_rate_bank || 0,
            midMarketRate: audit.midMarketRate,
            markupCost: audit.markupCost,
            valueDate: quoteDetails.value_date,
            fees: extractionResult.fees?.items || [],
            geminiRaw: extractionResult
          };

          // 6. Save to Firestore
          setStatusText("Finalizing Audit Record...");
          const saveResult = await saveQuoteToFirestore(currentUid, currentOrgId, finalQuoteData, base64, extractionResult);

          if (saveResult.success) {
            onAddQuote(saveResult as QuoteData); // Optimistic Update
            // Update credits locally if not enterprise
            if (!isEnterprise && onProfileUpdate && userProfile) {
                onProfileUpdate({ credits: userProfile.credits - 1 });
            }
          } else {
            throw new Error(saveResult.error || "Database Write Failed");
          }

        } catch (err: any) {
          console.error("Pipeline Error:", err);
          setErrorMsg(err.message || "Analysis Failed");
        } finally {
          setIsUploading(false);
          // Clear input
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
    } catch (err: any) {
      console.error("Upload Error:", err);
      setErrorMsg("File Read Error");
      setIsUploading(false);
    }
  };

  return (
    <motion.div 
      className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[calc(100vh-140px)]"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* LEFT: Feed & Upload */}
      <div className="lg:col-span-2 flex flex-col gap-6 h-full overflow-hidden">
        
        {/* Upload Area */}
        <motion.div variants={itemVariants} className="shrink-0">
          <div 
            onClick={() => !isUploading && fileInputRef.current?.click()}
            className={`
              relative overflow-hidden rounded-[2.5rem] border-2 border-dashed transition-all cursor-pointer group
              ${isUploading ? 'bg-zinc-900 border-blue-500/50' : 'bg-[#121826]/40 border-zinc-800 hover:bg-zinc-900 hover:border-blue-500/30'}
              h-48 flex flex-col items-center justify-center
            `}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              className="hidden" 
              accept=".pdf,.jpg,.jpeg,.png"
              disabled={isUploading}
            />
            
            <AnimatePresence mode="wait">
              {isUploading ? (
                <motion.div 
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex flex-col items-center gap-4 relative z-10"
                >
                  <Loader2 size={40} className="text-blue-500 animate-spin" />
                  <div className="space-y-1 text-center">
                     <div className="text-lg font-black text-white uppercase tracking-tight">{statusText}</div>
                     <div className="text-xs text-blue-500 font-mono">Running Neural Net inference...</div>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                  className="flex flex-col items-center gap-4 text-center group-hover:scale-105 transition-transform duration-500"
                >
                  <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-500/20 mb-2">
                    <Upload className="text-white" size={28} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white uppercase tracking-tight">Ingest Quote</h3>
                    <p className="text-zinc-500 text-sm font-medium">Drag PDF or Image • Max 5MB</p>
                  </div>
                  {errorMsg && (
                    <div className="px-4 py-2 bg-red-500/10 text-red-500 rounded-lg text-xs font-bold flex items-center gap-2">
                       <AlertTriangle size={12} /> {errorMsg}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Background Effects */}
            {!isUploading && (
               <div className="absolute inset-0 bg-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            )}
          </div>
        </motion.div>

        {/* Audit Stream */}
        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          <div className="space-y-4">
            <motion.h3 variants={itemVariants} className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] sticky top-0 bg-[#0e121b] py-2 z-10">
              Recent Analysis Stream
            </motion.h3>
            
            {quotes.length === 0 ? (
               <motion.div variants={itemVariants} className="py-20 text-center space-y-4">
                  <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center mx-auto border border-zinc-800 border-dashed text-zinc-700">
                     <ScanLine size={32} />
                  </div>
                  <p className="text-zinc-600 font-medium">No intelligence data found.</p>
               </motion.div>
            ) : (
               quotes.map((quote) => (
                <motion.div 
                  key={quote.id}
                  variants={itemVariants}
                  onClick={() => setActiveQuoteId(quote.id)}
                  whileHover={{ scale: 1.01, x: 4 }}
                  className={`
                    p-6 rounded-[1.5rem] border cursor-pointer transition-all relative overflow-hidden group
                    ${activeQuoteId === quote.id 
                      ? 'bg-blue-900/10 border-blue-500/50 shadow-lg shadow-blue-900/20' 
                      : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'}
                  `}
                >
                  <div className="flex justify-between items-start relative z-10">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg shadow-inner ${
                         quote.status === 'flagged' ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'
                      }`}>
                         {quote.bank[0]}
                      </div>
                      <div>
                         <h4 className="font-bold text-white text-lg">{quote.bank}</h4>
                         <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono">
                            <span>{quote.pair}</span>
                            <span>•</span>
                            <span>{new Date(quote.createdAt).toLocaleDateString()}</span>
                         </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                       <div className={`text-xl font-black font-mono ${quote.status === 'flagged' ? 'text-red-500' : 'text-zinc-400'}`}>
                          ${quote.markupCost?.toFixed(2)}
                       </div>
                       <div className="text-[9px] font-bold uppercase text-zinc-600 tracking-wider">Hidden Cost</div>
                    </div>
                  </div>
                  
                  {activeQuoteId === quote.id && (
                     <motion.div layoutId="highlight" className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />
                  )}
                </motion.div>
               ))
            )}
          </div>
        </div>
      </div>

      {/* RIGHT: Detail View */}
      <AnimatePresence mode="wait">
        {activeQuote ? (
          <motion.div 
            key={activeQuote.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="bg-[#121826]/60 border border-zinc-800 rounded-[2.5rem] p-8 h-full overflow-y-auto custom-scrollbar relative shadow-2xl"
          >
             <button 
               onClick={() => setActiveQuoteId(null)}
               className="absolute top-6 right-6 p-2 text-zinc-500 hover:text-white transition-colors"
             >
               <X size={20} />
             </button>

             <div className="space-y-8">
                <div>
                   <div className="inline-flex items-center gap-2 px-3 py-1 bg-zinc-900 rounded-full text-[10px] font-black text-zinc-500 uppercase tracking-widest border border-zinc-800 mb-4">
                      <Cpu size={12} /> Atlas ID: {activeQuote.id.slice(0, 8)}
                   </div>
                   <h2 className="text-3xl font-black text-white tracking-tighter mb-1">{activeQuote.bank}</h2>
                   <p className="text-zinc-500 font-mono text-sm">{activeQuote.pair} Execution Analysis</p>
                </div>

                <div className="space-y-4">
                   <div className="p-6 bg-zinc-900 rounded-[1.5rem] border border-zinc-800 space-y-4">
                      <div className="flex justify-between items-center pb-4 border-b border-zinc-800">
                         <span className="text-xs text-zinc-500 font-bold uppercase">Bank Rate</span>
                         <span className="text-xl font-mono text-white font-bold">{activeQuote.exchangeRate}</span>
                      </div>
                      <div className="flex justify-between items-center pb-4 border-b border-zinc-800">
                         <span className="text-xs text-zinc-500 font-bold uppercase">Mid-Market</span>
                         <span className="text-xl font-mono text-emerald-500 font-bold">{activeQuote.midMarketRate?.toFixed(5)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2">
                         <span className="text-xs text-red-500 font-black uppercase">Spread Cost</span>
                         <span className="text-2xl font-mono text-red-500 font-black">${activeQuote.markupCost?.toFixed(2)}</span>
                      </div>
                   </div>

                   {/* AI Insight */}
                   <div className="p-6 bg-blue-600/10 border border-blue-600/20 rounded-[1.5rem] space-y-3">
                      <div className="flex items-center gap-2 text-blue-400 font-black text-xs uppercase tracking-widest">
                         <Search size={14} /> AI Recommendation
                      </div>
                      <p className="text-sm text-blue-100 leading-relaxed font-medium">
                         {activeQuote.status === 'flagged' 
                           ? "This quote exceeds your 1.5% markup threshold. We recommend initiating a dispute for the $200+ drift."
                           : "This rate is within acceptable market bounds. No action needed."}
                      </p>
                      {activeQuote.status === 'flagged' && (
                         <button className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg">
                            Draft Dispute Email
                         </button>
                      )}
                   </div>

                   {/* Fees */}
                   {activeQuote.fees && activeQuote.fees.length > 0 && (
                     <div className="space-y-3">
                        <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Explicit Fees</h4>
                        {activeQuote.fees.map((fee, i) => (
                           <div key={i} className="flex justify-between items-center p-3 bg-zinc-900/50 rounded-xl border border-zinc-800/50">
                              <span className="text-sm text-zinc-300 font-medium">{fee.name}</span>
                              <span className="text-sm text-white font-bold">${fee.amount.toFixed(2)}</span>
                           </div>
                        ))}
                     </div>
                   )}
                </div>
             </div>
          </motion.div>
        ) : (
          <div className="hidden lg:flex flex-col items-center justify-center h-full text-center p-10 border border-zinc-800 rounded-[2.5rem] bg-[#121826]/20 border-dashed">
             <div className="w-24 h-24 bg-zinc-900 rounded-[2rem] flex items-center justify-center mb-6 text-zinc-700 shadow-xl">
                <FileText size={48} />
             </div>
             <h3 className="text-xl font-black text-zinc-500 uppercase">Select an Audit</h3>
             <p className="text-zinc-600 text-sm mt-2 max-w-xs">Click on any transaction from the feed to view the full Atlas breakdown.</p>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default IntelligenceFeed;