
import React, { useEffect, useState, useRef } from 'react';
import { ShieldCheck, Zap, CheckCircle, CreditCard, Loader2 } from 'lucide-react';
import { processEnterpriseUpgrade, auth } from '../services/firebase';

interface PaymentPageProps {
  orgId: string;
}

const PaymentPage: React.FC<PaymentPageProps> = ({ orgId }) => {
  const [success, setSuccess] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  // Helper for Robust Env Vars
  const getEnv = (key: string) => {
    let value = '';
    if (typeof window !== 'undefined' && (import.meta && import.meta.env)) {
       value = import.meta.env[`VITE_${key}`] || 
               import.meta.env[`NEXT_PUBLIC_${key}`] || 
               import.meta.env[key] || '';
    }
