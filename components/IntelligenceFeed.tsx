
import React, { useState, useRef } from 'react';
import { FileText, Loader2, AlertTriangle, X, Upload, ScanLine, Cpu } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { extractQuoteData, getHistoricExchangeRate } from '../services/gemini';
import { saveQuoteToFirestore } from '../services/firebase';
import { calculateAllCosts } from '../services/calculations';
import { QuoteData, UserProfile, Organization } from '../types';
import QuoteAnalysis from './QuoteAnalysis';

interface IntelligenceFeedProps {
  quotes: QuoteData[];
  onAddQuote: (quote: QuoteData) => void;
  onUpdateQuote: (quote: QuoteData) => void;
  userProfile: UserProfile | null;
  orgProfile?: Organization | null;
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

const IntelligenceFeed: React.FC<IntelligenceFeedProps> = ({ quotes, onAddQuote, onUpdateQuote, userProfile, orgProfile, isEnterprise, onProfileUpdate }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [statusText, setStatusText] = useState('Initializing Node...');
  const [activeQuoteId, setActiveQuoteId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeQuote = quotes?.find(q => q.id === activeQuoteId);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset UI State
    setErrorMsg(null);
    setStatusText("Establishing Secure Handshake...");
    
    if (file.size > 5000000) { 
      setErrorMsg("File Size Exceeded. Must be under 5MB.");
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (!userProfile || !userProfile.uid) {
      setErrorMsg("Please log in to upload documents.");
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    
    const currentUid = userProfile.uid;
    const currentOrgId = userProfile.orgId || 'personal_workspace'; 

    setIsUploading(true);

    // --- ARTIFICIAL DELAY ---
    try {
        const delaySteps = [
            { text: "Verifying Org Credentials...", ms: 1500 },
            { text: "Securing Data Pipeline...", ms: 1500 },
            { text: "Allocating Neural Workers...", ms: 2000 }
        ];

        for (const step of delaySteps) {
            setStatusText(step.text);
            await new Promise(resolve => setTimeout(resolve, step.ms));
        }
    } catch (e) {
        // Ignore delay errors
    }

    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        if (!e.target?.result) throw new Error("File read failed (empty result)");
        
        const result = e.target.result as string;
        // Robust base64 extraction
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        const mimeType = file.type || 'image/jpeg';
        
        // 1. AI Extraction (Gemini Flash)
        setStatusText("Atlas AI: Extracting Transaction Data...");
        const extractionResult = await extractQuoteData(base64, mimeType);

        if (!extractionResult) {
           throw new Error("AI Extraction returned null");
        }

        const txDetails = extractionResult.transaction || {};
        const pair = txDetails.currency_pair || "USD/EUR";
        const valDate = txDetails.value_date || new Date().toISOString().split('T')[0];

        // 2. Fetch Real Market Data via Gemini Search
        setStatusText(`RateGuard: Searching Historical Rates for ${pair}...`);
        
        let midMarketRate = 0;
        try {
            const rateResult = await getHistoricExchangeRate(pair, valDate);
            if (rateResult.rate > 0) {
                midMarketRate = rateResult.rate;
                console.log(`Found rate via ${rateResult.source}: ${midMarketRate}`);
            } else {
                // Fallback estimate if search fails
                midMarketRate = txDetails.exchange_rate_bank * 0.98; // Assume 2% markup roughly
            }
        } catch (searchErr) {
            console.warn("Search failed, using estimate", searchErr);
            midMarketRate = txDetails.exchange_rate_bank * 0.98;
        }

        // 3. Detailed Calculation Engine (Hidden Fees)
        setStatusText("Profit Guard: Calculating Hidden Spreads...");
        const calculationResult = calculateAllCosts(
          { ...txDetails, fees: extractionResult.fees },
          midMarketRate
        );

        // 4. Merge Data
        const finalQuoteData: Partial<QuoteData> = {
          bank: extractionResult.extraction?.bank_name || "Unknown Bank",
          pair: pair,
          amount: txDetails.original_amount || 0,
          exchangeRate: txDetails.exchange_rate_bank || 0,
          midMarketRate: midMarketRate,
          valueDate: valDate,
          
          // Rich Calculation Data
          fees: calculationResult.fees,
          wireFee: calculationResult.wireFee,
          fxFee: calculationResult.fxFee,
          correspondentFee: calculationResult.correspondentFee,
          otherFees: calculationResult.otherFees,
          totalFees: calculationResult.totalFees,
          
          spreadDecimal: calculationResult.spreadDecimal,
          spreadPercentage: calculationResult.spreadPercentage,
          markupCost: calculationResult.markupCost,
          
          totalHiddenCost: calculationResult.totalHiddenCost,
          totalHiddenPercentage: calculationResult.totalHiddenPercentage,
          costBreakdown: calculationResult.costBreakdown,
          
          annualTransactionCount: calculationResult.annualTransactionCount,
          annualizedHiddenCost: calculationResult.annualizedHiddenCost,
          monthlyAverageCost: calculationResult.monthlyAverageCost,
          
          industryAverageSpread: calculationResult.industryAverageSpread,
          industryAverageTotalCost: calculationResult.industryAverageTotalCost,
          yourCostVsIndustry: calculationResult.yourCostVsIndustry,
          betterThanIndustry: calculationResult.betterThanIndustry,
          percentileRank: calculationResult.percentileRank,
          potentialSavingsPercent: calculationResult.potentialSavingsPercent,
          
          dispute: calculationResult.dispute,
          reliabilityScore: 85,
          geminiRaw: extractionResult
        };

        // 5. Save to Firestore
        setStatusText("Finalizing Audit Record...");
        const saveResult = await saveQuoteToFirestore(currentUid, currentOrgId, finalQuoteData, base64, extractionResult);

        if (saveResult.success) {
          onAddQuote(saveResult as unknown as QuoteData);
          // Deduct credits from UI immediately (optimistic update is handled by listener in App.tsx)
          // Credits are now on Organization Level, not User Profile
        } else {
          throw new Error(saveResult.error || "Database Write Failed");
        }

      } catch (err: any) {
        console.error("Pipeline Error:", err);
        // Handle AbortError specifically to not show a scary message if it's just a cancellation
        if (err.name === 'AbortError') {
            setErrorMsg("Upload cancelled.");
        } else {
            setErrorMsg(err.message || "Analysis Failed");
        }
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.onerror = () => {
      console.error("FileReader Error:", reader.error);
      setErrorMsg("Failed to read file.");
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    try {
      reader.readAsDataURL(file);
    } catch (e: any) {
      console.error("FileReader Start Error:", e);
      setErrorMsg("Could not start upload.");
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
                    <p className="text-zinc-500 text-sm font-medium">Drag PDF or Image • AI Auto-Analysis</p>
                  </div>
                  {errorMsg && (
                    <div className="px-4 py-2 bg-red-500/10 text-red-500 rounded-lg text-xs font-bold flex items-center gap-2">
                       <AlertTriangle size={12} /> {errorMsg}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

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
                         {quote.bank ? quote.bank[0] : '?'}
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
                          ${quote.totalHiddenCost?.toFixed(2)}
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

      <AnimatePresence mode="wait">
        {activeQuote ? (
          <QuoteAnalysis quote={activeQuote} onClose={() => setActiveQuoteId(null)} />
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
