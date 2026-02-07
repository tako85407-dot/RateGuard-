import React, { useEffect, useState } from 'react';
import { ShieldCheck, Zap, CheckCircle, CreditCard, Sparkles, Loader2 } from 'lucide-react';
import { processEnterpriseUpgrade, auth } from '../services/firebase';

interface PaymentPageProps {
  orgId: string;
}

const PaymentPage: React.FC<PaymentPageProps> = ({ orgId }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  // Use the env var or fallback to the provided client ID
  const PAYPAL_CLIENT_ID = import.meta.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || (process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID as string) || "AcfpjwLgDGThXpyOnYWUoWdFG7SM_h485vJULqGENmPyeiwfD20Prjfx6xRrqYOSZlM4s-Rnh3OfjXhk";

  useEffect(() => {
    // Check if script already exists to avoid duplicates
    if (document.getElementById('paypal-sdk')) {
      setScriptLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.id = 'paypal-sdk';
    script.src = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&vault=true&intent=subscription`;
    script.setAttribute('data-sdk-integration-source', 'button-factory');
    script.async = true;
    script.onload = () => setScriptLoaded(true);
    script.onerror = (err) => {
      console.error("PayPal Script Load Error", err);
    };
    document.body.appendChild(script);

    return () => {
      // Optional cleanup
    };
  }, []);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!orgId || !uid || !scriptLoaded) return;

    const renderPaypalButton = () => {
      const paypal = (window as any).paypal;
      const containerId = 'paypal-button-container-P-1UB7789392647964ANF3SL4I';
      const planId = 'P-1UB7789392647964ANF3SL4I';
      
      const container = document.getElementById(containerId);

      // Ensure container exists and is empty before rendering
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
                plan_id: planId
              });
            },
            onApprove: function(data: any, actions: any) {
              setIsProcessing(true);
              if (data.subscriptionID) {
                 processEnterpriseUpgrade(uid, orgId, data.subscriptionID).then((upgraded) => {
                   if (upgraded) {
                     setSuccess(true);
                     window.location.reload(); 
                   } else {
                     alert("Upgrade recorded but sync failed. Please contact support.");
                   }
                   setIsProcessing(false);
                 });
              } else {
                 setIsProcessing(false);
                 alert('Error: No subscription ID returned.');
              }
            },
            onError: function (err: any) {
              console.error("PayPal Button Error:", err);
              // Do not auto-fix or hide error, let user see console or alert
              alert("PayPal Error: " + err);
            }
          }).render('#' + containerId);
      }
    };

    if (!success) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(renderPaypalButton, 500);
      return () => clearTimeout(timer);
    }
  }, [success, orgId, scriptLoaded]);

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

  if (!orgId) return <div className="text-center p-10">Loading Billing Node...</div>;

  return (
    <div className="max-w-6xl mx-auto py-10 px-4 space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <div className="text-center space-y-6">
        <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter uppercase leading-none">
          Activate Your <br /> <span className="text-blue-500">Defense Terminal</span>
        </h1>
        <p className="text-zinc-500 max-w-2xl mx-auto font-medium text-lg leading-relaxed">
          Upgrade Organization: {orgId}
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-12 items-start">
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
        </div>

        <div className="bg-white rounded-[2.5rem] p-10 text-zinc-950 space-y-8 shadow-2xl relative overflow-hidden">
          {(isProcessing || !scriptLoaded) && (
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
            {/* The Container ID must match what is used in the render call */}
            <div id="paypal-button-container-P-1UB7789392647964ANF3SL4I" className="min-h-[150px]"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentPage;