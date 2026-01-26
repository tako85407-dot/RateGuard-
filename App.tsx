
import React, { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';
import Auth from './components/Auth';
import Onboarding from './components/Onboarding';
import { AppView, CompanyProfile, UserProfile } from './types';
import { auth, onAuthStateChanged, syncUserToFirestore, signOut, handleGoogleSignIn } from './services/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>('landing');
  const [user, setUser] = useState<any>(null); // Firebase User
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    // Auth Listener
    const unsubscribe = onAuthStateChanged(async (currentUser) => {
      
      // Strict Verification Check
      if (currentUser && !currentUser.emailVerified && currentUser.providerData[0]?.providerId === 'password') {
        // If password user is somehow logged in but not verified, force sign out.
        // This ensures they only access app after clicking verify link and logging in again.
        await signOut();
        setUser(null);
        setUserProfile(null);
        setView('landing');
        setLoading(false);
        return;
      }

      setUser(currentUser);
      
      if (currentUser) {
        // Fetch Profile from Firestore
        try {
          const profile = await syncUserToFirestore(currentUser);
          setUserProfile(profile);
          
          // Logic: Check for Compliance Data (Country/TaxID)
          // If profile exists but missing country/taxID, force Onboarding
          if (profile && (!profile.country || !profile.taxID)) {
             setView('onboarding');
          } else if (profile) {
             setView('dashboard');
          } else {
             // Fallback if sync fails initially
             setView('landing'); 
          }
        } catch (error) {
          console.error("Profile sync failed", error);
        }
      } else {
        setUserProfile(null);
        setView('landing');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAuthSuccess = async () => {
     setShowAuth(false);
     // Auth listener will handle redirection
  };

  const handleLogout = async () => {
    await signOut();
    setUserProfile(null);
    setView('landing');
  };

  const handleOnboardingComplete = (data: any) => {
    // Optimistically update profile to avoid reload delay
    if (userProfile) {
       setUserProfile({ ...userProfile, ...data });
    }
    setView('dashboard');
  };

  // Helper to update profile locally
  const handleProfileUpdate = (updates: Partial<UserProfile>) => {
    if (userProfile) {
      setUserProfile({ ...userProfile, ...updates });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07090e] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
          <p className="text-zinc-500 text-xs font-black uppercase tracking-widest">Initializing Secure Node...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07090e]">
      {view === 'landing' && (
        <LandingPage onEnter={() => setShowAuth(true)} />
      )}

      {view === 'onboarding' && (
        <Onboarding onComplete={handleOnboardingComplete} />
      )}

      {view !== 'landing' && view !== 'onboarding' && (
        <Dashboard 
          currentView={view} 
          onViewChange={setView} 
          onLogout={handleLogout}
          userProfile={userProfile}
          onProfileUpdate={handleProfileUpdate}
        />
      )}

      <AnimatePresence>
        {showAuth && (
          <Auth 
            onClose={() => setShowAuth(false)} 
            onSuccess={handleAuthSuccess} 
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
