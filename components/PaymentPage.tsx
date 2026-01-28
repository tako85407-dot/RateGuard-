
import React, { useEffect, useState } from 'react';
import { ShieldCheck, Zap, CheckCircle, CreditCard, Sparkles, Clock, Loader2 } from 'lucide-react';
import { PRICING_PLAN } from '../constants';
import { processEnterpriseUpgrade } from '../services/firebase';
import { auth } from '../services/firebase';

const PaymentPage: React.FC = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Determine the current user UID
    const uid = auth.currentUser?.uid;

    const renderPaypalButton = () => {
      // Safety Measure 4: Try/Catch for External Script
      try {
        const paypal = (window as any).paypal;
        // Updated container ID matching the provided snippet
        const containerId = 'paypal-button-container-P-1UB7789392647964ANF3SL4I';
        const planId = 'P-1UB7789392647964ANF3SL4I';
        
        // Ensure container exists before rendering
        const container = document.getElementById(containerId);

        if (paypal && container && container.innerHTML === '') {
            paypal.Buttons({
              style: {
                shape: 'rect',
                color: 'gold',
                layout: 'vertical',
                label: 'subscribe'
              },
              createSubscription: function(data: any, actions: any) {
                return actions.subscription.create({
                  /* Creates the subscription */
                  plan_id: planId
                });
              },
              onApprove: function(data: any, actions: any) {
                setIsProcessing(true);
                // data.subscriptionID contains the new subscription ID
                if (uid && data.subscriptionID) {
                   // We pass the subscription ID as the transaction ID reference
                   processEnterpriseUpgrade(uid, data.subscriptionID).then((upgraded) => {
                     if (upgraded) {
                       setSuccess(true);
                       // Reload to reflect role changes
                       window.location.reload(); 
                     }
                     setIsProcessing(false);
                   });
                } else {
                   setIsProcessing(false);
                   alert('Subscription approved, but user session not found. Please contact support.');
                }
              }
            }).render('#' + containerId);
        }
      } catch (err) {
        console.error("PayPal Initialization Error:", err);
      }
    };

    if (!success) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(renderPaypalButton, 500);
      return () => clearTimeout(timer);
    }
  }, [success]);

  if (success) {
     return (
        <div className="flex items-center justify-center min-h-[60vh] text-center">
           <div className="space-y-6">
              <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-500 mx-auto">
                 <CheckCircle size={48} />
              </div>
              <h2 className="text-3xl font-black text-white uppercase">License Activated</h2>
              <p className="text-zinc-500">Your enterprise node is now fully operational.</p>
           </div>
        </div>
     );
  }

  return (
    <div className="max-w-6xl mx-auto py-10 px-4 space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-700">
      {/* Header Section */}
      <div className="text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-600/10 border border-blue-600/20 text-blue-400 rounded-full text-[10px] font-black uppercase tracking-[0.2em]">
          <ShieldCheck size={14} />
          Enterprise-Grade Infrastructure
        </div>
        <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter uppercase leading-none">
          Activate Your <br /> <span className="text-blue-500">Defense Terminal</span>
        </h1>
        <p className="text-zinc-500 max-w-2xl mx-auto font-medium text-lg leading-relaxed">
          Secure the Global Enterprise license. One-time activation for the current cycle.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-12 items-start">
        {/* Benefits Panel */}
        <div className="space-y-8 bg-zinc-900/40 border border-zinc-800 rounded-[2.5rem] p-10 shadow-2xl">
          <div className="space-y-2">
            <h3 className="text-2xl font-black text-white uppercase tracking-tight">Standard Benefits</h3>
            <p className="text-zinc-500 text-sm">Everything you need to audit high-volume freight lanes.</p>
          </div>

          <div className="grid gap-6">
            {[
              { icon: <Zap className="text-blue-500" />, title: "Unlimited Atlas AI Audits", desc: "Process unlimited PDFs/JPGs without caps." },
              { icon: <Sparkles className="text-purple-500" />, title: "Profit Guard™ Memory", desc: "AI-driven comparison against your own historical lane rates." },
              { icon: <CheckCircle className="text-indigo-500" />, title: "Auto-Dispute Engine", desc: "One-click professional emails to carriers for surcharge drift." }
            ].map((benefit, i) => (
              <div key={i} className="flex gap-5 group">
                <div className="w-12 h-12 bg-zinc-950 rounded-2xl border border-zinc-800 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  {benefit.icon}
                </div>
                <div>
                  <h4 className="text-white font-black text-sm uppercase tracking-widest">{benefit.title}</h4>
                  <p className="text-zinc-500 text-xs leading-relaxed mt-1 font-medium">{benefit.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-8 border-t border-zinc-800/50">
            <div className="flex items-center gap-4 text-xs font-black uppercase tracking-widest text-zinc-500">
               <ShieldCheck size={18} className="text-emerald-500" />
               SECURE 256-BIT ENCRYPTION
            </div>
          </div>
        </div>

        {/* Payment Action Panel */}
        <div className="bg-white rounded-[2.5rem] p-10 text-zinc-950 space-y-8 shadow-2xl relative overflow-hidden">
          {isProcessing && (
             <div className="absolute inset-0 bg-white/90 z-50 flex items-center justify-center flex-col gap-4">
                <Loader2 className="animate-spin text-blue-600" size={40} />
                <span className="font-black uppercase tracking-widest text-xs">Provisioning Enterprise Node...</span>
             </div>
          )}

          <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
            <CreditCard size={120} className="text-black" />
          </div>

          <div className="space-y-2 relative z-10">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600">Enterprise Standard</div>
            <div className="flex items-baseline gap-2">
              <span className="text-6xl font-black tracking-tighter">$231</span>
              <span className="text-zinc-500 text-xl font-black">USD</span>
            </div>
            <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">
              Includes $31.00 Tax (15.5%)
            </p>
          </div>

          <div className="space-y-6 relative z-10">
            <div className="text-center text-[10px] font-black text-zinc-400 uppercase tracking-widest">
              Secure Checkout via PayPal
            </div>
            {/* PayPal Button Container - ID Must Match Render Call */}
            <div id="paypal-button-container-P-1UB7789392647964ANF3SL4I" className="min-h-[150px]"></div>
          </div>

          <div className="flex items-center justify-center gap-2 text-[9px] font-black text-zinc-400 uppercase tracking-widest pt-4 border-t border-zinc-100">
            <ShieldCheck size={12} />
            Instant Activation upon payment
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentPage;
