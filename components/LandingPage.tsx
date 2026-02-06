
import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Zap, 
  ArrowRight, 
  CheckCircle2,
  Lock,
  Globe,
  FileText,
  Users,
  Award,
  History,
  X,
  Cookie,
  Settings as SettingsIcon,
  LogIn,
  TrendingUp,
  DollarSign,
  Search,
  AlertTriangle,
  BarChart3,
  ArrowRightLeft,
  ChevronDown,
  LayoutDashboard,
  ArrowDownRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PRICING_PLAN } from '../constants';
import PrivacyPolicy from './PrivacyPolicy';
import TermsAndConditions from './TermsAndConditions';
import CookiePolicy from './CookiePolicy';

interface LandingPageProps {
  onEnter: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onEnter }) => {
  const [activeOverlay, setActiveOverlay] = useState<'privacy' | 'terms' | 'cookies' | null>(null);
  const [showConsent, setShowConsent] = useState(false);
  const [calcVolume, setCalcVolume] = useState(1000000);
  const [calcSavings, setCalcSavings] = useState(25000);

  useEffect(() => {
    // Calculator logic: 2.5% avg spread
    setCalcSavings(Math.round(calcVolume * 0.025));
  }, [calcVolume]);

  useEffect(() => {
    const consent = localStorage.getItem('rateguard_cookie_consent');
    if (!consent) {
      const timer = setTimeout(() => setShowConsent(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleConsent = (level: 'all' | 'essential') => {
    localStorage.setItem('rateguard_cookie_consent', level);
    setShowConsent(false);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } }
  };

  if (activeOverlay) {
    return (
      <div className="min-h-screen bg-[#07090e] p-6 lg:p-20 relative z-[200]">
        <button 
          onClick={() => setActiveOverlay(null)}
          className="fixed top-8 right-8 z-[110] p-4 bg-zinc-900 border border-zinc-800 rounded-full text-zinc-500 hover:text-white transition-all shadow-2xl"
        >
          <X size={24} />
        </button>
        {activeOverlay === 'privacy' && <PrivacyPolicy onBack={() => setActiveOverlay(null)} />}
        {activeOverlay === 'terms' && <TermsAndConditions onBack={() => setActiveOverlay(null)} />}
        {activeOverlay === 'cookies' && <CookiePolicy onBack={() => setActiveOverlay(null)} />}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07090e] text-zinc-100 selection:bg-blue-500/30 overflow-x-hidden scroll-smooth font-sans">
      <div className="fixed top-0 left-1/4 -translate-x-1/2 w-full h-[800px] bg-blue-600/5 blur-[160px] pointer-events-none -z-10" />
      <div className="fixed bottom-0 right-1/4 translate-x-1/2 w-full h-[800px] bg-emerald-600/5 blur-[160px] pointer-events-none -z-10" />

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-[100] border-b border-zinc-800/50 bg-[#07090e]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center font-black italic shadow-2xl shadow-blue-500/20 group-hover:scale-110 transition-transform">R</div>
            <span className="text-xl font-black tracking-tighter">RateGuard <span className="text-blue-500">FX</span></span>
          </div>
          <div className="hidden lg:flex items-center gap-10 text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500">
            <a href="#problem" className="hover:text-white transition-colors">The Problem</a>
            <a href="#calculator" className="hover:text-white transition-colors">Calculator</a>
            <a href="#process" className="hover:text-white transition-colors">How It Works</a>
            <a href="#comparison" className="hover:text-white transition-colors">Comparison</a>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={onEnter}
              className="px-6 py-3 rounded-xl bg-white text-[#07090e] font-black text-xs uppercase tracking-widest hover:bg-zinc-200 active:scale-95 transition-all shadow-xl shadow-white/5 flex items-center gap-2"
            >
              <LogIn size={14} />
              Free Audit
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-48 pb-32 px-6 overflow-hidden">
        <motion.div 
          className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-20 items-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={containerVariants}
        >
          <div className="text-left space-y-10 relative z-10">
            <motion.div variants={itemVariants} className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black tracking-[0.2em] uppercase">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Bank Markups Exposed
            </motion.div>
            
            <motion.h1 variants={itemVariants} className="text-5xl md:text-7xl font-black tracking-tighter leading-[0.9] text-white">
              Recover 2-4% on <br /> <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-600">Every Wire.</span>
            </motion.h1>
            
            <motion.p variants={itemVariants} className="text-lg text-zinc-400 max-w-xl leading-relaxed font-medium">
              Banks hide billions in "No Fee" wires by inflating the exchange rate. 
              RateGuard AI analyzes your PDF confirmations, exposes the hidden spread, and generates dispute letters instantly.
            </motion.p>
            
            <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center gap-6 pt-4">
              <button 
                onClick={onEnter}
                className="w-full sm:w-auto px-10 py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-2xl shadow-blue-500/20 active:scale-95 transition-all group"
              >
                Start Free Audit
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
              <div className="flex flex-col">
                <div className="flex -space-x-3 overflow-hidden p-1">
                  {['JP', 'GS', 'HS', 'WF'].map((initials, i) => (
                    <div key={i} className="inline-block h-8 w-8 rounded-full ring-4 ring-[#07090e] bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[8px] font-black uppercase text-zinc-400">
                      {initials}
                    </div>
                  ))}
                  <div className="inline-block h-8 w-8 rounded-full ring-4 ring-[#07090e] bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white">+2k</div>
                </div>
                <div className="mt-1 text-[10px] text-zinc-500 font-black uppercase tracking-widest">
                  Over $1.2B Audited
                </div>
              </div>
            </motion.div>
          </div>

          <motion.div variants={itemVariants} className="relative lg:block hidden">
            <div className="relative z-10 perspective-1000">
              <motion.div 
                animate={{ rotateY: [0, 5, 0], rotateX: [0, 5, 0] }}
                transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-6 shadow-2xl glow-blue overflow-hidden group transform transition-all hover:scale-[1.02]"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-transparent pointer-events-none" />
                
                {/* Simulated Header */}
                <div className="flex items-center justify-between mb-6 px-4 py-3 bg-black/40 rounded-2xl border border-zinc-800/50">
                  <div className="flex gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/40" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/40" />
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/40" />
                  </div>
                  <div className="flex items-center gap-2">
                     <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                     <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">LIVE_MARKET_FEED</div>
                  </div>
                </div>

                {/* Simulated Data */}
                <div className="space-y-6 font-mono">
                  {/* Graph Placeholder */}
                  <div className="h-32 w-full bg-black/20 rounded-2xl border border-zinc-800/50 flex items-end justify-between p-4 gap-2">
                     {[40, 65, 55, 80, 45, 70, 90, 60, 85].map((h, i) => (
                        <div key={i} className="w-full bg-blue-500/20 rounded-t-sm relative group/bar" style={{ height: `${h}%` }}>
                           <div className="absolute bottom-0 left-0 w-full bg-blue-500 rounded-t-sm transition-all duration-1000 group-hover/bar:bg-blue-400" style={{ height: `${h * 0.4}%` }} />
                        </div>
                     ))}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-black/40 rounded-2xl border border-zinc-800">
                      <span className="text-zinc-600 block mb-2 text-[9px] font-black uppercase tracking-widest">Mid-Market (True)</span>
                      <span className="text-emerald-400 text-lg font-bold">1.0850</span> <span className="text-zinc-600 text-xs">EUR/USD</span>
                    </div>
                    <div className="p-4 bg-black/40 rounded-2xl border border-zinc-800">
                      <span className="text-zinc-600 block mb-2 text-[9px] font-black uppercase tracking-widest">Bank Rate (Charged)</span>
                      <span className="text-red-400 text-lg font-bold">1.1120</span> <span className="text-zinc-600 text-xs">EUR/USD</span>
                    </div>
                  </div>
                  
                  <div className="p-6 bg-red-500/5 border border-red-500/20 rounded-2xl space-y-4 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-red-500/10 blur-xl rounded-full" />
                    <div className="flex items-center justify-between relative z-10">
                      <div className="flex items-center gap-2">
                         <Zap size={14} className="text-red-500 animate-pulse" />
                         <span className="text-red-500 font-black text-[10px] uppercase tracking-widest">Markup Detected</span>
                      </div>
                      <span className="text-[10px] text-zinc-500 uppercase font-bold">Spread: 2.48%</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                       <span className="text-3xl font-black text-white">$2,480.00</span>
                       <span className="text-xs text-zinc-500 font-medium">Overpayment</span>
                    </div>
                    <button onClick={onEnter} className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-black uppercase text-[9px] tracking-widest rounded-xl transition-all shadow-lg shadow-red-500/20">
                      Recover Funds Now
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
            
            {/* Background Decor */}
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-emerald-600/10 rounded-full blur-[100px] -z-10 animate-pulse" />
            <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-blue-600/10 rounded-full blur-[100px] -z-10 animate-pulse" style={{ animationDelay: '1s' }} />
          </motion.div>
        </motion.div>
      </section>

      {/* Social Proof Ticker */}
      <div className="py-10 bg-[#0a0c12] border-y border-zinc-900 overflow-hidden relative">
        <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[#0a0c12] to-transparent z-10" />
        <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-[#0a0c12] to-transparent z-10" />
        <div className="max-w-7xl mx-auto px-6 mb-6 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600">Trusted by Finance Teams At</p>
        </div>
        <div className="flex gap-20 animate-marquee whitespace-nowrap px-10 items-center justify-center opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
           {['Global Logistics Inc', 'Pacific Imports', 'EuroTrade Ltd', 'Nexus Freight', 'Apex Capital', 'Vertex Shipping'].map((name, i) => (
             <div key={i} className="flex items-center gap-3 text-xl font-black text-zinc-400">
                <Globe size={24} className="text-zinc-600" /> {name}
             </div>
           ))}
           {/* Duplicate for seamless loop */}
           {['Global Logistics Inc', 'Pacific Imports', 'EuroTrade Ltd', 'Nexus Freight', 'Apex Capital', 'Vertex Shipping'].map((name, i) => (
             <div key={`dup-${i}`} className="flex items-center gap-3 text-xl font-black text-zinc-400">
                <Globe size={24} className="text-zinc-600" /> {name}
             </div>
           ))}
        </div>
      </div>

      {/* The Problem Section */}
      <section id="problem" className="py-32 px-6">
         <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
               <div className="space-y-8">
                  <h2 className="text-4xl md:text-5xl font-black text-white tracking-tighter uppercase leading-none">
                     The "<span className="text-red-500">No Fee</span>" Lie.
                  </h2>
                  <p className="text-lg text-zinc-400 leading-relaxed font-medium">
                     Banks advertise "$0 Wire Fees" because they make their real money on the <strong>Spread</strong>. They artificially deflate the exchange rate they give you, pocketing the difference.
                  </p>
                  <ul className="space-y-4">
                     {[
                        "You see: 1 EUR = 1.11 USD",
                        "Real Rate: 1 EUR = 1.08 USD",
                        "You Lose: $3,000 on a $100k wire"
                     ].map((point, i) => (
                        <li key={i} className="flex items-center gap-3 text-zinc-300 font-bold">
                           <X className="text-red-500" size={20} /> {point}
                        </li>
                     ))}
                  </ul>
               </div>
               <div className="bg-zinc-900 rounded-[2.5rem] border border-zinc-800 p-8 relative overflow-hidden">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-red-500/20 blur-[100px] rounded-full pointer-events-none" />
                  <div className="relative z-10 space-y-6">
                     <div className="flex justify-between items-center bg-black/50 p-6 rounded-2xl border border-zinc-800">
                        <span className="text-zinc-500 font-black uppercase tracking-widest text-xs">Advertised Fee</span>
                        <span className="text-emerald-500 font-black text-2xl">$0.00</span>
                     </div>
                     <div className="flex justify-center">
                        <ArrowDownRight size={32} className="text-zinc-600" />
                     </div>
                     <div className="flex justify-between items-center bg-red-500/10 p-6 rounded-2xl border border-red-500/20">
                        <div>
                           <span className="text-red-400 font-black uppercase tracking-widest text-xs block">Hidden Spread Cost</span>
                           <span className="text-[10px] text-zinc-500 uppercase">2.5% Markup</span>
                        </div>
                        <span className="text-white font-black text-2xl">$2,500.00</span>
                     </div>
                  </div>
               </div>
            </div>
         </div>
      </section>

      {/* How It Works */}
      <section id="process" className="py-32 px-6 bg-[#0c0f17] border-y border-zinc-900">
         <div className="max-w-7xl mx-auto space-y-20">
            <div className="text-center space-y-4">
               <h2 className="text-4xl font-black text-white tracking-tighter uppercase">From Upload to Refund</h2>
               <p className="text-zinc-500">Three steps to reclaiming your margins.</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-12 relative">
               <div className="absolute top-1/2 left-0 w-full h-1 bg-zinc-900 -translate-y-1/2 hidden md:block z-0" />
               
               {[
                  { title: "Upload Confirmation", desc: "Drag & drop your PDF bank receipt or trade confirmation.", icon: <FileText size={32} /> },
                  { title: "AI Analysis", desc: "Atlas scans the trade time and compares it to live mid-market data.", icon: <Search size={32} /> },
                  { title: "Recover Funds", desc: "Download a dispute letter and send it to your bank rep.", icon: <DollarSign size={32} /> }
               ].map((step, i) => (
                  <div key={i} className="relative z-10 bg-[#0c0f17] p-6 text-center space-y-6 group">
                     <div className="w-24 h-24 mx-auto bg-zinc-900 border border-zinc-800 rounded-[2rem] flex items-center justify-center text-blue-500 shadow-2xl group-hover:scale-110 transition-transform duration-500">
                        {step.icon}
                     </div>
                     <div className="space-y-2">
                        <div className="inline-block px-3 py-1 bg-zinc-900 rounded-full text-[10px] font-black text-zinc-500 uppercase tracking-widest border border-zinc-800">Step 0{i+1}</div>
                        <h3 className="text-xl font-black text-white">{step.title}</h3>
                        <p className="text-sm text-zinc-500 max-w-xs mx-auto">{step.desc}</p>
                     </div>
                  </div>
               ))}
            </div>
         </div>
      </section>

      {/* Calculator Section */}
      <section id="calculator" className="py-32 px-6">
         <div className="max-w-5xl mx-auto bg-[#121826] border border-zinc-800 rounded-[3rem] p-10 lg:p-20 relative overflow-hidden shadow-2xl">
             <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none"><DollarSign size={200} /></div>
             <div className="relative z-10 space-y-12">
                <div className="text-center space-y-6">
                   <h2 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tight leading-none">Calculate Your Losses</h2>
                   <p className="text-zinc-500 text-lg">Move the slider to match your annual international wire volume.</p>
                </div>
                
                <div className="space-y-10">
                   <div className="space-y-4">
                      <div className="flex justify-between items-end">
                         <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Annual Volume</span>
                         <span className="text-4xl font-black text-white font-mono">${calcVolume.toLocaleString()}</span>
                      </div>
                      <input 
                         type="range" min="100000" max="10000000" step="100000" 
                         value={calcVolume} onChange={(e) => setCalcVolume(parseInt(e.target.value))}
                         className="w-full h-4 bg-zinc-900 rounded-full appearance-none cursor-pointer accent-blue-600 hover:accent-blue-500 transition-all"
                      />
                      <div className="flex justify-between text-[10px] font-black text-zinc-600 uppercase tracking-widest">
                         <span>$100k</span>
                         <span>$10M+</span>
                      </div>
                   </div>

                   <div className="grid md:grid-cols-2 gap-6">
                      <div className="p-8 bg-black/40 rounded-[2rem] border border-zinc-800 flex flex-col items-center justify-center gap-2">
                         <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Avg Bank Markup</div>
                         <div className="text-4xl font-black text-zinc-300">2.5%</div>
                         <div className="text-[10px] text-zinc-600 font-medium">Industry Standard</div>
                      </div>
                      <div className="p-8 bg-emerald-500/10 rounded-[2rem] border border-emerald-500/20 flex flex-col items-center justify-center gap-2 shadow-[0_0_40px_rgba(16,185,129,0.1)]">
                         <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Recoverable Cash</div>
                         <div className="text-5xl font-black text-white tracking-tight">${calcSavings.toLocaleString()}</div>
                         <div className="text-[10px] text-emerald-500/60 font-medium">Per Year</div>
                      </div>
                   </div>
                   
                   <div className="flex justify-center">
                      <button onClick={onEnter} className="px-12 py-5 bg-white text-[#0e121b] font-black uppercase text-sm tracking-widest rounded-2xl hover:bg-zinc-200 transition-all shadow-xl hover:scale-105 active:scale-95">
                         Audit My Last Wire Now
                      </button>
                   </div>
                </div>
             </div>
         </div>
      </section>

      {/* Feature Grid */}
      <section id="features" className="py-32 px-6 border-t border-zinc-900 bg-[#0a0c12]">
        <div className="max-w-7xl mx-auto space-y-24">
          <div className="text-center space-y-4">
            <h2 className="text-4xl md:text-6xl font-black text-white tracking-tighter uppercase">The Treasury Defense Suite</h2>
            <p className="text-zinc-500 font-medium max-w-2xl mx-auto">Institutional-grade tools for the modern CFO.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { 
                icon: <FileText className="text-blue-500" />, 
                title: "Spread Detection", 
                desc: "Atlas AI reads your PDF bank confirmations and calculates the exact markup over mid-market rates instantly." 
              },
              { 
                icon: <History className="text-emerald-500" />, 
                title: "Historical Benchmarking", 
                desc: "Compare your rates against 90-day averages and industry standards. Know if you're getting a fair deal." 
              },
              { 
                icon: <Zap className="text-orange-500" />, 
                title: "Auto-Dispute Engine", 
                desc: "Generate professional dispute emails to your bank representative with one click when markups exceed 1%." 
              },
              { 
                icon: <Award className="text-indigo-500" />, 
                title: "Bank Scorecards", 
                desc: "Rate your banking partners based on transparency and spread fairness. Data to negotiate better tiers." 
              },
              { 
                icon: <Users className="text-purple-500" />, 
                title: "Savings Dashboard", 
                desc: "Track recovered costs and projected annual savings in real-time. Report ROI to your board." 
              },
              { 
                icon: <ShieldCheck className="text-red-500" />, 
                title: "Profit Guard™ Alerts", 
                desc: "Live monitoring of your target pairs. If a quote bleeds your profit, you'll see a red alert before you wire." 
              }
            ].map((feat, idx) => (
              <motion.div 
                key={idx}
                whileHover={{ y: -8 }}
                className="p-10 rounded-[2.5rem] bg-zinc-900/30 border border-zinc-800/50 hover:border-blue-500/30 transition-all space-y-6 group"
              >
                <div className="w-14 h-14 bg-zinc-900 rounded-2xl flex items-center justify-center border border-zinc-800 group-hover:bg-blue-600/10 group-hover:border-blue-500/50 transition-all shadow-xl">
                  {feat.icon}
                </div>
                <h3 className="text-xl font-black text-white">{feat.title}</h3>
                <p className="text-zinc-500 text-sm leading-relaxed font-medium">{feat.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section id="comparison" className="py-32 px-6">
         <div className="max-w-5xl mx-auto space-y-16">
            <div className="text-center space-y-4">
               <h2 className="text-4xl font-black text-white tracking-tighter uppercase">Stop Fighting Blind</h2>
               <p className="text-zinc-500">How RateGuard stacks up against the competition.</p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
               <div className="grid grid-cols-4 bg-black/40 border-b border-zinc-800 text-[10px] font-black uppercase tracking-widest text-zinc-500 p-6">
                  <div className="col-span-1">Feature</div>
                  <div className="col-span-1 text-center">Traditional Banks</div>
                  <div className="col-span-1 text-center">Wise / Revolut</div>
                  <div className="col-span-1 text-center text-blue-500">RateGuard</div>
               </div>
               {[
                  { label: "Exchange Rate", bank: "Inflated (Hidden)", neo: "Mid-Market", rg: "Audit & Dispute" },
                  { label: "Transparent Fees", bank: "No", neo: "Yes", rg: "Enforced" },
                  { label: "Relationship", bank: "Required", neo: "Switch Required", rg: "Keep Existing" },
                  { label: "Avg Markup", bank: "2.0% - 4.0%", neo: "0.5%", rg: "Recover 2%+" },
               ].map((row, i) => (
                  <div key={i} className="grid grid-cols-4 p-6 border-b border-zinc-800/50 items-center hover:bg-zinc-800/20 transition-colors">
                     <div className="col-span-1 font-bold text-white text-sm">{row.label}</div>
                     <div className="col-span-1 text-center text-zinc-500 text-sm font-medium">{row.bank}</div>
                     <div className="col-span-1 text-center text-zinc-400 text-sm font-medium">{row.neo}</div>
                     <div className="col-span-1 text-center text-blue-400 text-sm font-black">{row.rg}</div>
                  </div>
               ))}
            </div>
         </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-32 px-6 border-t border-zinc-900">
        <div className="max-w-3xl mx-auto space-y-16">
          <div className="text-center space-y-4">
            <h2 className="text-4xl font-black text-white tracking-tighter uppercase">Common Questions</h2>
          </div>
          <div className="space-y-6">
            {[
              { q: "Is this legal?", a: "Absolutely. You have a right to know the fair market value of the currency you are buying. Banks rely on opacity; we provide transparency." },
              { q: "How is this different from Wise?", a: "We monitor your EXISTING bank relationships. You don't need to switch banks or change your workflow. We just help you negotiate better rates with them." },
              { q: "What banks do you support?", a: "We support PDF confirmations from all major global banks including JP Morgan, Citi, HSBC, Wells Fargo, and Bank of America." },
              { q: "Is my data secure?", a: "Yes. We use SOC 2 pending security protocols and 256-bit encryption. We only read trade details, we do not have access to move funds." }
            ].map((item, i) => (
              <div key={i} className="p-8 bg-zinc-900/40 border border-zinc-800 rounded-[2rem] space-y-3 hover:bg-zinc-900/60 transition-colors">
                <h4 className="text-lg font-bold text-white flex items-center gap-3">
                   <ChevronDown size={16} className="text-zinc-600" />
                   {item.q}
                </h4>
                <p className="text-zinc-500 text-sm leading-relaxed pl-7">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-40 px-6 relative overflow-hidden">
         <div className="absolute inset-0 bg-blue-600/5 pointer-events-none" />
         <div className="max-w-4xl mx-auto text-center space-y-10 relative z-10">
            <h2 className="text-5xl md:text-7xl font-black text-white tracking-tighter uppercase leading-none">
               Stop Bleeding Cash.
            </h2>
            <p className="text-xl text-zinc-400 font-medium max-w-2xl mx-auto">
               Your next wire is likely padded with 2.5% in hidden fees. Upload it now and see the truth.
            </p>
            <button 
                onClick={onEnter}
                className="px-16 py-6 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase text-sm tracking-widest rounded-2xl shadow-2xl hover:scale-105 transition-all"
            >
               Run Free Audit
            </button>
            <p className="text-xs text-zinc-600 font-bold uppercase tracking-widest">No credit card required • Instant Analysis</p>
         </div>
      </section>

      <footer className="py-24 px-6 border-t border-zinc-900 bg-[#07090e]">
        <div className="max-w-7xl mx-auto grid md:grid-cols-4 gap-16">
          <div className="space-y-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-black italic shadow-2xl shadow-blue-500/20">R</div>
              <span className="text-2xl font-black tracking-tighter">RateGuard FX</span>
            </div>
            <p className="text-xs text-zinc-600 font-bold leading-relaxed uppercase tracking-widest">Defending importer margins with institutional-grade AI.</p>
          </div>
          {[
            { title: "Platform", links: ["FX Audit", "Rate Memory", "Dispute Studio", "Bank Scorecards"] },
            { title: "Company", links: ["About", "Careers", "Contact", "Partners"] },
            { title: "Legal", links: ["Privacy", "Terms", "Cookies"] }
          ].map((col, i) => (
            <div key={i} className="space-y-8">
              <h5 className="text-[10px] font-black tracking-[0.3em] uppercase text-zinc-500">{col.title}</h5>
              <ul className="space-y-4">
                {col.links.map((l, j) => (
                  <li key={j}>
                    <button 
                      onClick={() => {
                        const key = l.toLowerCase();
                        if (['privacy', 'terms', 'cookies'].includes(key)) setActiveOverlay(key as any);
                      }} 
                      className="text-[11px] font-black uppercase tracking-widest text-zinc-600 hover:text-white transition-colors text-left"
                    >
                      {l}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="max-w-7xl mx-auto mt-20 pt-10 border-t border-zinc-900 flex justify-between items-center">
           <span className="text-[10px] font-bold text-zinc-700 uppercase">© 2026 RateGuard Inc. All rights reserved.</span>
           <div className="flex gap-4">
              <Globe size={16} className="text-zinc-700 hover:text-white cursor-pointer transition-colors" />
           </div>
        </div>
      </footer>

      <AnimatePresence>
        {showConsent && (
          <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }} className="fixed bottom-6 left-6 right-6 lg:left-1/2 lg:-translate-x-1/2 lg:w-full lg:max-w-3xl z-[200]">
            <div className="bg-[#121826] border border-zinc-800 p-6 lg:p-8 rounded-[2rem] shadow-2xl flex flex-col lg:flex-row items-center gap-6 lg:gap-10">
               <div className="p-4 bg-blue-500/10 rounded-2xl text-blue-500 shrink-0"><Cookie size={32} /></div>
               <div className="space-y-2 flex-1 text-center lg:text-left">
                  <h4 className="text-white font-black text-sm uppercase tracking-widest">Cookie Consent Node</h4>
                  <p className="text-xs text-zinc-400 font-medium leading-relaxed">RateGuard uses essential cookies to maintain your terminal session.</p>
               </div>
               <div className="flex flex-wrap justify-center gap-3 shrink-0">
                  <button onClick={() => handleConsent('all')} className="px-6 py-3 bg-white text-[#07090e] font-black uppercase text-[10px] tracking-widest rounded-xl hover:bg-zinc-200 transition-all">Accept All</button>
                  <button onClick={() => setActiveOverlay('cookies')} className="p-3 bg-zinc-900 text-zinc-500 border border-zinc-800 rounded-xl hover:text-white transition-all"><SettingsIcon size={18} /></button>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LandingPage;
