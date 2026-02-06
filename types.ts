
export interface Comment {
  id: string;
  user: string;
  text: string;
  timestamp: number;
}

export interface TeamMember {
  id: string;
  name: string;
  role: 'Auditor' | 'Controller' | 'Manager' | 'Processor';
  status: 'Online' | 'Offline';
  activity: string;
}

export interface QuoteData {
  id: string; // Firestore AutoID
  userId: string;
  orgId: string;
  bank: string; // Renamed from carrier
  pair: string; // Renamed from origin/destination (e.g. USD/EUR)
  amount: number; // The principal amount
  exchangeRate: number; // The executed rate
  midMarketRate?: number; // The fair rate at that time
  markupCost: number; // The hidden fee calculated
  fees: Array<{ name: string; amount: number }>; // Explicit fees
  valueDate: string; // Settlement date
  status: 'pending' | 'analyzed' | 'flagged' | 'optimal';
  workflowStatus: 'uploaded' | 'analyzed' | 'reviewed' | 'approved';
  disputeDrafted?: boolean;
  reliabilityScore: number;
  notes: Comment[];
  pdfBase64?: string;
  geminiRaw?: any;
  createdAt: number;
}

export interface LiveRate {
  id: string;
  pair: string;
  timestamp: number;
  midMarketRate: number;
  bankRate: number; 
  rateGuardRate: number;
  savingsPips: number;
  trend: 'up' | 'down';
}

export interface LaneTrend {
  lane: string;
  history: Array<{ date: string; rate: number }>;
}

export interface CompanyProfile {
  name: string;
  profitGoal: number;
  currency: string;
}

export interface Organization {
  id: string;
  name: string;
  adminId: string;
  members: string[];
  plan: 'free' | 'enterprise';
  maxSeats: number;
  createdAt: number;
}

export interface Audit {
  id: string;
  orgId: string;
  userId: string;
  userName: string;
  pair: string;
  amount: number;
  bankRate: number;
  midMarketRate: number;
  leakage: number;
  timestamp: number;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  orgId?: string;
  role: 'admin' | 'member';
  credits: number;
  companyName?: string;
  country?: string;
  taxID?: string;
  hasSeenIntro?: boolean;
  createdAt?: number;
  lastSeen?: number;
}

export type AppView = 'landing' | 'onboarding' | 'dashboard' | 'quotes' | 'history' | 'analysis' | 'settings' | 'billing' | 'studio' | 'support' | 'scorecards' | 'team' | 'privacy' | 'terms' | 'cookies' | 'payment';

export enum ImageSize {
  K1 = '1K',
  K2 = '2K',
  K4 = '4K'
}