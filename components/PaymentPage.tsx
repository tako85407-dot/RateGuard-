import React, { useEffect, useState, useRef } from 'react';
import { ShieldCheck, Zap, CheckCircle, CreditCard, Loader2 } from 'lucide-react';
import { processEnterpriseUpgrade, auth } from '../services/firebase';

interface PaymentPageProps {
  orgId: string;
}

const PaymentPage: React.FC<PaymentPageProps> = ({ orgId }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const paypalRef = useRef<HTMLDivElement>(null);

  // Helper for Robust Env Vars
  const getEnv = (key: string) => {
    if (typeof process !== 'undefined' && process.env) {
      return process.env[`VITE_${key}`] || 
             process.env[`NEXT_PUBLIC_${key}`] || 
             process.env[key] || 
             '';
    }
    if (import.meta && import.meta.env) {
      return import.meta.env[`VITE_${key}`] || 
             import.meta.env[`NEXT_PUBLIC_${key}`] || 
             import.meta.env[key] || 
             '';
    }
    return '';
  };

  const CLIENT_ID = getEnv("PAYPAL_CLIENT_ID") || "AcfpjwLgDGThXpyOnYWUoWdFG7SM_h485vJULqGENmPyeiwfD20Prjfx6xRrqYOSZlM4s-Rnh3OfjXhk";
  const PLAN_ID = "P-1UB7789392647964ANF3SL4I";

  useEffect(() => {
    // 1. Load PayPal Script Directly
    if (!window.paypal) {
      const script = document.createElement('script');
      script.src = `https://www.paypal.com/sdk/js?client-id=${CLIENT_ID}&vault=true&intent=subscription`;
      script.setAttribute('data-sdk-integration-source', 'button-factory');
      script.async = true;
      script.onload = () => setScriptLoaded(true);
      document.body.appendChild(script);
    } else {
      setScriptLoaded(true);
    }
  }, [CLIENT_ID]);

  useEffect(() => {
    // 2. Render Buttons
    if (scriptLoaded && window.paypal && paypalRef.current && orgId) {
       // Clear container to prevent duplicate buttons
       paypalRef.current.innerHTML = "";

       const uid = auth.currentUser?.uid;
       if (!uid) return;

       try {
         window.paypal.Buttons({
            style: {
                shape: 'rect',
                color: 'gold',
                layout: 'vertical',
                label: 'subscribe'
            },
            createSubscription: function(data: any, actions: any) {
              return actions.subscription.create({
                plan_id: PLAN_ID
              });
            },
            onApprove: function(data: any, actions: any) {
              setIsProcessing(true);
              processEnterpriseUpgrade(uid, orgId, data.subscriptionID).then((upgraded) => {
                 if (upgraded) {
                   setSuccess(true);
                   setTimeout(() => window.location.reload(), 2000);
                 } else {
                   alert("Payment verified, but account sync failed. Please contact support.");
                 }
                 setIsProcessing(false);
              });
            },
            onError: (err: any) => {
               console.error("PayPal Error:", err);
            }
         }).render(paypalRef.current);

       } catch (err) {
         console.error("Button Render Failed:", err);
       }
    }
  }, [scriptLoaded, orgId]);

  if (success) {
     return (
        <div className="flex items-center justify-center min-h-[60vh] text-center animate-in fade-in zoom-in duration-500">
           <div className="space-y-6">
              <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-500 mx-auto border border-emerald-500/30 shadow-lg shadow-emerald-500/20">
                 <CheckCircle size={48} />
              </div>
              <div>
                <h2 className="text-3xl font-black text-white uppercase tracking-tight">License Activated</h2>
                <p className="text-zinc-500 mt-2">Enterprise protocols engaged. Reloading terminal...</p>
              </div>
           </div>
        </div>
     );
  }

  return (
    <div className="max-w-6xl mx-auto py-10 px-4 space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <div className="text-center space-y-6">
        <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter uppercase leading-none">
          Activate Your <br /> <span className="text-blue-500">Defense Terminal</span>
        </h1>
        <p className="text-zinc-500 max-w-2xl mx-auto font-medium text-lg leading-relaxed">
          Secure node upgrade for Organization: <span className="text-white font-mono">{orgId}</span>
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-12 items-start">
        <div className="space-y-8 bg-zinc-900/40 border border-zinc-800 rounded-[2.5rem] p-10 shadow-2xl">
          <div className="space-y-2">
            <h3 className="text-2xl font-black text-white uppercase tracking-tight">Enterprise Capabilities</h3>
            <p className="text-zinc-500 text-sm">Unlock the full power of the Atlas AI engine.</p>
          </div>
          <div className="grid gap-6">
            {[
              { icon: <Zap className="text-blue-500" />, title: "Unlimited AI Audits", desc: "Remove the 5-quote cap. Process high-volume batches." },
              { icon: <ShieldCheck className="text-emerald-500" />, title: "Priority Processing", desc: "Skip the queue with dedicated GPU allocation." },
              { icon: <CheckCircle className="text-indigo-500" />, title: "Dispute Automation", desc: "Generate legal-grade dispute letters instantly." }
            ].map((benefit, i) => (
              <div key={i} className="flex gap-5 group">
                <div className="w-12 h-12 bg-zinc-950 rounded-2xl border border-zinc-800 flex items-center justify-center shrink-0 group-hover:border-blue-500/30 transition-colors">
                  {benefit.icon}
                </div>
                <div>
                  <h4 className="text-white font-black text-sm uppercase tracking-widest">{benefit.title}</h4>
                  <p className="text-zinc-500 text-xs leading-relaxed mt-1 font-medium">{benefit.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] p-10 text-zinc-950 space-y-8 shadow-2xl relative overflow-hidden">
          {isProcessing && (
             <div className="absolute inset-0 bg-white/95 z-50 flex items-center justify-center flex-col gap-4 backdrop-blur-sm">
                <Loader2 className="animate-spin text-blue-600" size={40} />
                <span className="font-black uppercase tracking-widest text-xs">Provisioning Enterprise Node...</span>
             </div>
          )}

          <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
            <CreditCard size={120} className="text-black" />
          </div>

          <div className="space-y-2 relative z-10">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600">Monthly License</div>
            <div className="flex items-baseline gap-2">
              <span className="text-6xl font-black tracking-tighter">$199</span>
              <span className="text-zinc-500 text-xl font-black">USD</span>
            </div>
            <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">
              + Applicable Taxes
            </p>
          </div>

          <div className="space-y-6 relative z-10">
            <div className="text-center text-[10px] font-black text-zinc-400 uppercase tracking-widest">
              Secure Checkout via PayPal
            </div>
            
            <div ref={paypalRef} className="w-full relative z-20 min-h-[150px]">
              {!scriptLoaded && (
                <div className="flex items-center justify-center py-4 gap-2 text-zinc-400 border border-zinc-200 rounded-lg">
                  <Loader2 className="animate-spin" size={16} />
                  <span className="text-xs font-bold uppercase tracking-widest">Loading Gateway...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentPage;