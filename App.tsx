
import React, { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';
import Auth from './components/Auth';
import Onboarding from './components/Onboarding';
import ErrorBoundary from './components/ErrorBoundary';
import { AppView, UserProfile, Organization } from './types';
import { auth, onAuthStateChanged, syncUserAndOrg, signOut, finishMagicLinkSignIn, listenToOrg } from './services/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>('landing');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [orgProfile, setOrgProfile] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  
  // Magic Link Completion State
  const [finishingLink, setFinishingLink] = useState(false);

  useEffect(() => {
    // 1. Handle Magic Link Re-entry
    const handleMagicLink = async () => {
       const url = window.location.href;
       // We let the service check if it is actually a magic link
       const result = await finishMagicLinkSignIn(url);
       
       if (result.notLink) {
         // Not a magic link, just proceed to normal auth check
         return;
       }

       setFinishingLink(true);

       if (result.needsEmail) {
         // Edge Case: User opened link on different device. 
         // For a complete flow, we ask them.
         const email = window.prompt("Please confirm your email address to complete the sign-in:");
         if (email) {
            await finishMagicLinkSignIn(url, email);
            // The onAuthStateChanged listener will pick up the user after this
         } else {
            alert("Email confirmation required. Please try logging in again.");
         }
       } else if (!result.success && result.error) {
         console.error("Link Sign-in Error:", result.error);
         alert("Invalid or expired login link.");
       }
       
       // Clean URL - Wrapped in try/catch to handle sandboxed/blob URL constraints
       try {
         window.history.replaceState({}, document.title, window.location.pathname);
       } catch (e) {
         console.warn("Could not clean URL history (likely sandboxed env):", e);
       }
       
       setFinishingLink(false);
    };

    handleMagicLink();

    // 2. Auth State Listener
    const unsubscribe = onAuthStateChanged(async (currentUser) => {
      setLoading(true);
      
      if (currentUser) {
        if (!currentUser.emailVerified && currentUser.providerData[0]?.providerId === 'password') {
          await signOut();
          setUserProfile(null);
          setOrgProfile(null);
          setView('landing');
          setLoading(false);
          alert("Please verify your email address to access the terminal.");
          return;
        }

        try {
          const { userProfile, orgProfile } = await syncUserAndOrg(currentUser);
          
          setUserProfile(userProfile);
          setOrgProfile(orgProfile);

          // Routing Logic - Updated for Fork Onboarding
          // If no orgId is present, we MUST go to Onboarding to Create or Join.
          if (!userProfile.orgId || !orgProfile) {
            setView('onboarding');
          } else if (!userProfile.country || !userProfile.taxID) {
            // Still show onboarding if compliance data is missing but org exists
            setView('onboarding');
          } else {
            setView('dashboard');
          }

        } catch (error) {
          console.error("Initialization Failed:", error);
          setUserProfile(null);
          setOrgProfile(null);
          setView('landing');
        }
      } else {
        setUserProfile(null);
        setOrgProfile(null);
        setView('landing');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 3. Org Listener for Credit Sync
  useEffect(() => {
     if (userProfile?.orgId) {
         const unsubOrg = listenToOrg(userProfile.orgId, (updatedOrg) => {
             setOrgProfile(updatedOrg);
         });
         return () => unsubOrg();
     }
  }, [userProfile?.orgId]);

  const handleLogout = async () => {
    await signOut();
    setUserProfile(null);
    setOrgProfile(null);
    setView('landing');
  };

  const handleOnboardingComplete = (data: any) => {
    if (userProfile) {
      // Optimistic update
      const updatedProfile = { ...userProfile, ...data };
      setUserProfile(updatedProfile);
      
      // If we just created/joined an org, we need to refresh to get orgProfile
      // But for speed, we assume sync will catch up on next reload or we could force a reload
      window.location.reload(); 
    }
  };

  const handleProfileUpdate = (updates: Partial<UserProfile>) => {
    if (userProfile) setUserProfile({ ...userProfile, ...updates });
  };

  if (loading || finishingLink) {
    return (
      <div className="min-h-screen bg-[#07090e] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
          <p className="text-zinc-500 text-xs font-black uppercase tracking-widest">
             {finishingLink ? 'Verifying Secure Link...' : 'Initializing Secure Node...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#07090e]">
        {view === 'landing' && (
          <LandingPage onEnter={() => setShowAuth(true)} />
        )}

        {view === 'onboarding' && (
          <Onboarding 
            onComplete={handleOnboardingComplete} 
            userProfile={userProfile} 
          />
        )}

        {view !== 'landing' && view !== 'onboarding' && (
          <Dashboard 
            currentView={view} 
            onViewChange={setView} 
            onLogout={handleLogout}
            userProfile={userProfile}
            orgProfile={orgProfile} // Pass Org Data
            onProfileUpdate={handleProfileUpdate}
          />
        )}

        <AnimatePresence>
          {showAuth && (
            <Auth 
              onClose={() => setShowAuth(false)} 
              onSuccess={() => setShowAuth(false)} 
            />
          )}
        </AnimatePresence>
      </div>
    </ErrorBoundary>
  );
};

export default App;
