
import React, { useState, useRef, useEffect } from 'react';
import { 
  LogOut, Bell, Menu, X, LayoutDashboard, Settings as SettingsIcon, 
  HelpCircle, ChevronRight, FileText, History, Users, Award, BarChart2,
  Shield, Scale, Cookie, CreditCard, ChevronLeft, Zap, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './Sidebar';
import IntelligenceFeed from './IntelligenceFeed';
import DashboardHome from './DashboardHome';
import QuoteHistory from './QuoteHistory';
import LaneAnalysis from './LaneAnalysis';
import Billing from './Billing';
import Settings from './Settings';
import Support from './Support';
import ImageStudio from './ImageStudio';
import CarrierScorecards from './CarrierScorecards';
import TeamWorkspace from './TeamWorkspace';
import ProfitGuardSidebar from './ProfitGuardSidebar';
import PrivacyPolicy from './PrivacyPolicy';
import TermsAndConditions from './TermsAndConditions';
import CookiePolicy from './CookiePolicy';
import PaymentPage from './PaymentPage';
import WelcomeTour from './WelcomeTour';
import { AppView, QuoteData, UserProfile, Organization } from '../types';
import { fetchOrgQuotes, markIntroSeen } from '../services/firebase';

interface DashboardProps {
  currentView: AppView;
  onViewChange: (view: AppView) => void;
  onLogout: () => void;
  userProfile: UserProfile | null;
  orgProfile: Organization | null; // Added Org Profile
  onProfileUpdate?: (updates: Partial<UserProfile>) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ currentView, onViewChange, onLogout, userProfile, orgProfile, onProfileUpdate }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isNavMenuOpen, setIsNavMenuOpen] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [showTour, setShowTour] = useState(false);
  const navMenuRef = useRef<HTMLDivElement>(null);
  const [quotes, setQuotes] = useState<QuoteData[]>([]);

  // Enterprise Helper
  const isEnterprise = orgProfile?.plan === 'enterprise';

  // Defensive Data Loading
  useEffect(() => {
    const loadData = async () => {
      // Gate: Don't fetch if crucial IDs are missing
      if (!userProfile?.uid || !userProfile?.orgId) return;

      // Check for Intro Tour
      if (userProfile.hasSeenIntro === false) {
        setShowTour(true);
      }

      setIsLoadingData(true);
      try {
        const orgQuotes = await fetchOrgQuotes(userProfile.orgId);
        if (orgQuotes && Array.isArray(orgQuotes)) {
          setQuotes(orgQuotes);
        }
      } catch (error) {
        console.error("Dashboard Load Error:", error);
      } finally {
        setIsLoadingData(false);
      }
    };
    
    if (userProfile && orgProfile) {
        loadData();
    }
  }, [userProfile?.uid, userProfile?.orgId]);

  const handleTourClose = async () => {
    setShowTour(false);
    if (userProfile?.uid) {
      await markIntroSeen(userProfile.uid);
      if (onProfileUpdate) onProfileUpdate({ hasSeenIntro: true });
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navMenuRef.current && !navMenuRef.current.contains(event.target as Node)) {
        setIsNavMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // DEFENSIVE: Block Rendering if critical data is missing
  if (!userProfile || !orgProfile) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#0e121b] text-zinc-500 gap-3">
        <Loader2 className="animate-spin" size={24} />
        <span className="font-bold tracking-widest text-xs uppercase">Loading Organization Node...</span>
      </div>
    );
  }

  const addQuote = (newQuote: QuoteData) => {
    setQuotes(prev => [newQuote, ...prev]);
  };

  const updateQuote = (updated: QuoteData) => {
    setQuotes(prev => prev.map(q => q.id === updated.id ? updated : q));
  };

  const handleNavigate = (view: AppView) => {
    onViewChange(view);
    setIsNavMenuOpen(false);
  };

  const renderView = () => {
    switch (currentView) {
      case 'dashboard': return <DashboardHome quotes={quotes} onViewChange={onViewChange} onUpdateQuote={updateQuote} />;
      // Pass orgProfile and isEnterprise down to IntelligenceFeed for credit logic
      case 'quotes': return <IntelligenceFeed quotes={quotes} onAddQuote={addQuote} onUpdateQuote={updateQuote} userProfile={userProfile} orgProfile={orgProfile} isEnterprise={isEnterprise} onProfileUpdate={onProfileUpdate} />;
      case 'history': return <QuoteHistory quotes={quotes} />;
      case 'analysis': return <LaneAnalysis quotes={quotes} />;
      case 'team': return <TeamWorkspace />;
      case 'billing': return <Billing onViewChange={onViewChange} userProfile={userProfile} orgProfile={orgProfile} />;
      case 'payment': return <PaymentPage orgId={orgProfile.id} />; // Pass OrgId to Payment
      case 'settings': return <Settings userProfile={userProfile} onProfileUpdate={onProfileUpdate} />;
      case 'support': return <Support />;
      case 'studio': return <ImageStudio />;
      case 'scorecards': return <CarrierScorecards quotes={quotes} />;
      case 'privacy': return <PrivacyPolicy onBack={() => onViewChange('dashboard')} />;
      case 'terms': return <TermsAndConditions onBack={() => onViewChange('dashboard')} />;
      case 'cookies': return <CookiePolicy onBack={() => onViewChange('dashboard')} />;
      default: return <DashboardHome quotes={quotes} onViewChange={onViewChange} onUpdateQuote={updateQuote} />;
    }
  };

  return (
    <div className="flex h-screen bg-[#0e121b] text-zinc-100 overflow-hidden relative">
      <AnimatePresence>
        {showTour && <WelcomeTour onClose={handleTourClose} />}
      </AnimatePresence>

      <Sidebar 
        currentView={currentView} 
        onViewChange={onViewChange} 
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="h-16 px-8 flex items-center justify-between border-b border-zinc-800/50 bg-[#0e121b]/80 backdrop-blur-md z-50">
          <div className="flex items-center gap-6">
            <div className="relative" ref={navMenuRef}>
              <button 
                onClick={() => setIsNavMenuOpen(!isNavMenuOpen)}
                className={`p-2 rounded-lg transition-all ${isNavMenuOpen ? 'bg-blue-600 text-white' : 'hover:bg-zinc-800 text-zinc-400'}`}
              >
                {isNavMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
              <AnimatePresence>
                {isNavMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute top-full left-0 mt-3 w-72 bg-[#1a2133] border border-zinc-800 rounded-2xl shadow-2xl p-2 z-[60]"
                  >
                    <div className="px-4 py-3 border-b border-zinc-800/50 mb-2">
                      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Platform Command</span>
                    </div>
                    <div className="grid grid-cols-1 gap-1">
                      {[
                        { id: 'dashboard', label: 'Executive Dashboard', icon: <LayoutDashboard size={18} /> },
                        { id: 'quotes', label: 'Review Queue (Ops)', icon: <FileText size={18} /> },
                        { id: 'payment', label: 'Subscription Activation', icon: <CreditCard size={18} /> },
                        { id: 'team', label: 'Team Workspace', icon: <Users size={18} /> },
                        { id: 'history', label: 'Lane Memory', icon: <History size={18} /> },
                        { id: 'scorecards', label: 'Scorecards', icon: <Award size={18} /> },
                        { id: 'analysis', label: 'Analytics', icon: <BarChart2 size={18} /> },
                        { id: 'settings', label: 'Settings', icon: <SettingsIcon size={18} /> },
                        { id: 'privacy', label: 'Privacy Policy', icon: <Shield size={18} /> },
                        { id: 'terms', label: 'Terms of Service', icon: <Scale size={18} /> },
                        { id: 'cookies', label: 'Cookie Policy', icon: <Cookie size={18} /> },
                        { id: 'support', label: 'Support', icon: <HelpCircle size={18} /> }
                      ].map(item => (
                        <button 
                          key={item.id}
                          onClick={() => handleNavigate(item.id as AppView)} 
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentView === item.id ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
                        >
                          {item.icon} <span className="text-sm font-bold">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <h1 className="text-xs font-black tracking-[0.2em] text-zinc-400 uppercase hidden sm:block">
              {orgProfile.name} Terminal
            </h1>
          </div>
          <div className="flex items-center gap-4">
            {/* Credit / Plan Display */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${isEnterprise ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>
                <Zap size={12} className={isEnterprise ? "fill-emerald-500" : (orgProfile.credits > 0 ? "fill-yellow-500 text-yellow-500" : "")} />
                <span className="text-[10px] font-black uppercase tracking-widest">
                  {isEnterprise ? 'UNLIMITED' : `${orgProfile.credits ?? 0} CREDITS`}
                </span>
            </div>

            {!isEnterprise && (
              <button onClick={() => onViewChange('payment')} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all hidden sm:block">
                Upgrade Node
              </button>
            )}
            
            <button className="p-2 text-zinc-400 hover:text-white transition-colors relative">
              <Bell size={18} />
              <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-500 rounded-full" />
            </button>
            <div className="h-8 w-px bg-zinc-800 mx-2" />
            <button onClick={onLogout} className="flex items-center gap-2 px-4 py-2 text-zinc-500 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest">
              <ChevronLeft size={16} />
              Landing
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto flex flex-col lg:flex-row bg-[#0e121b]">
          <div className="flex-1 p-6 lg:p-10">
            <AnimatePresence mode="wait">
              <motion.div key={currentView} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                {renderView()}
              </motion.div>
            </AnimatePresence>
          </div>
          {['dashboard', 'quotes', 'history'].includes(currentView) ? <ProfitGuardSidebar quotes={quotes} /> : null}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
