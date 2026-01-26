
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, Loader2, X, ShieldCheck, LogIn, AlertCircle, Chrome, UserPlus, ArrowRight, CheckCircle2 } from 'lucide-react';
import { handleGoogleSignIn, handleEmailSignUp, handleEmailSignIn } from '../services/firebase';

interface AuthProps {
  onClose: () => void;
  onSuccess: () => void;
}

const Auth: React.FC<AuthProps> = ({ onClose, onSuccess }) => {
  const [method, setMethod] = useState<'google' | 'email'>('email');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Verification State
  const [verificationSent, setVerificationSent] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  });

  const onGoogleClick = async () => {
    setLoading(true);
    setError(null);
    try {
      await handleGoogleSignIn();
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const onEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === 'signup') {
        if (!formData.name) throw new Error("Name is required");
        await handleEmailSignUp(formData.email, formData.password, formData.name);
        setVerificationSent(true);
      } else {
        await handleEmailSignIn(formData.email, formData.password);
        onSuccess();
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed");
      // If error is verification related, maybe stay on signin
    } finally {
      setLoading(false);
    }
  };

  if (verificationSent) {
    return (
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl"
      >
        <div className="w-full max-w-md bg-[#0e121b] border border-zinc-800 p-10 rounded-[2.5rem] text-center space-y-6">
           <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-500 mx-auto border border-blue-500/20">
              <Mail size={32} />
           </div>
           <div>
             <h2 className="text-2xl font-black text-white uppercase">Verify Your Email</h2>
             <p className="text-zinc-500 mt-2 text-sm leading-relaxed">
               We've sent a verification link to <span className="text-white font-bold">{formData.email}</span>. 
               Please click the link to activate your node, then sign in.
             </p>
           </div>
           <button 
             onClick={() => { setVerificationSent(false); setMode('signin'); }}
             className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 text-white font-black uppercase text-xs tracking-widest rounded-2xl transition-all"
           >
             Back to Sign In
           </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="relative w-full max-w-md bg-[#0e121b] border border-zinc-800 p-8 rounded-[2.5rem] shadow-2xl overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 animate-pulse" />
        
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        <div className="space-y-6">
          <div className="text-center space-y-2 mb-2">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center mx-auto shadow-xl shadow-blue-500/20 mb-3">
              <ShieldCheck className="text-white" size={20} />
            </div>
            <h2 className="text-2xl font-black text-white tracking-tighter uppercase">
              {mode === 'signin' ? 'Terminal Access' : 'Initialize Node'}
            </h2>
          </div>

          {/* Mode Switcher */}
          <div className="grid grid-cols-2 gap-2 bg-zinc-900/50 p-1 rounded-xl">
             <button 
               onClick={() => setMode('signin')}
               className={`py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${mode === 'signin' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
             >
               Sign In
             </button>
             <button 
               onClick={() => setMode('signup')}
               className={`py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${mode === 'signup' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
             >
               Create Account
             </button>
          </div>

          <form onSubmit={onEmailSubmit} className="space-y-4">
             {mode === 'signup' && (
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">Full Name</label>
                  <div className="relative">
                    <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                    <input 
                      type="text" 
                      placeholder="Agent Name"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3.5 pl-12 pr-4 text-sm text-white outline-none focus:border-blue-500/50 transition-all placeholder:text-zinc-700"
                    />
                  </div>
                </div>
             )}
             
             <div className="space-y-1">
                <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                  <input 
                    type="email" 
                    placeholder="name@logistics.com"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3.5 pl-12 pr-4 text-sm text-white outline-none focus:border-blue-500/50 transition-all placeholder:text-zinc-700"
                  />
                </div>
             </div>

             <div className="space-y-1">
                <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                  <input 
                    type="password" 
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3.5 pl-12 pr-4 text-sm text-white outline-none focus:border-blue-500/50 transition-all placeholder:text-zinc-700"
                  />
                </div>
             </div>

             <button 
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase text-xs tracking-widest rounded-2xl transition-all shadow-xl shadow-blue-500/10 active:scale-[0.98] flex items-center justify-center gap-2 mt-2"
              >
                {loading ? <Loader2 className="animate-spin" size={16} /> : (mode === 'signin' ? <LogIn size={16} /> : <ArrowRight size={16} />)}
                {mode === 'signin' ? 'Authenticate' : 'Initialize Account'}
              </button>
          </form>

          <div className="flex items-center gap-4">
            <div className="h-px bg-zinc-800 flex-1" />
            <span className="text-[9px] font-black text-zinc-600 uppercase">Or Continue With</span>
            <div className="h-px bg-zinc-800 flex-1" />
          </div>

          <button 
            onClick={onGoogleClick}
            disabled={loading}
            className="w-full py-3 bg-white text-[#0e121b] font-black uppercase text-xs tracking-widest rounded-2xl transition-all shadow-lg hover:bg-zinc-200 active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50"
          >
            <Chrome size={18} />
            Google Workspace
          </button>
            
          <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-500"
                >
                  <AlertCircle size={14} className="shrink-0" />
                  {error}
                </motion.div>
              )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default Auth;
