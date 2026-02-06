
import React from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  History, 
  BarChart2, 
  Settings,
  HelpCircle,
  Image as ImageIcon,
  CreditCard,
  Award,
  Users
} from 'lucide-react';

export const NAVIGATION_ITEMS = [
  { id: 'dashboard', label: 'Treasury Dashboard', icon: <LayoutDashboard size={18} /> },
  { id: 'quotes', label: 'FX Audit Queue', icon: <FileText size={18} /> },
  { id: 'history', label: 'Rate Memory', icon: <History size={18} /> },
  { id: 'team', label: 'Finance Team', icon: <Users size={18} /> },
];

export const SYSTEM_ITEMS = [
  { id: 'scorecards', label: 'Bank Scorecards', icon: <Award size={16} /> },
  { id: 'analysis', label: 'Spread Analytics', icon: <BarChart2 size={16} /> },
  { id: 'studio', label: 'Dispute Studio', icon: <ImageIcon size={16} /> },
  { id: 'billing', label: 'Subscription', icon: <CreditCard size={16} /> },
  { id: 'settings', label: 'Settings', icon: <Settings size={16} /> },
  { id: 'support', label: 'Support', icon: <HelpCircle size={16} /> },
];

export const PRICING_PLAN = {
  name: 'Global Controller',
  price: 199,
  period: 'month',
  features: [
    'Unlimited Bank Wire Audits',
    'Profit Guard™ FX Benchmarking',
    'Bank Hidden Fee Scorecards',
    'Auto-Dispute Email Generator',
    'SOC 2 Type II Pending Security'
  ]
};
