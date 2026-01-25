
export interface Comment {
  id: string;
  user: string;
  text: string;
  timestamp: number;
}

export interface TeamMember {
  id: string;
  name: string;
  role: 'Processor' | 'Manager';
  status: 'Online' | 'Offline';
  activity: string;
}

export interface QuoteData {
  id: string;
  carrier: string;
  origin: string;
  destination: string;
  weight: number;
  totalCost: number;
  surcharges: Array<{ name: string; amount: number }>;
  transitTime: string;
  status: 'pending' | 'analyzed' | 'flagged' | 'optimal';
  workflowStatus: 'uploaded' | 'analyzed' | 'reviewed' | 'approved';
  disputeDrafted?: boolean;
  reliabilityScore: number; // 0-100
  notes: Comment[];
  targetRate?: number;
  timestamp: number;
}

export interface LaneTrend {
  lane: string;
  history: Array<{ date: string; rate: number }>;
}

export interface CompanyProfile {
  name: string;
  profitGoal: number; // Percentage
  currency: string;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  credits: number;
  tier: 'free' | 'pro' | 'enterprise';
  stripeId?: string;
  createdAt?: any;
  lastSeen?: any;
}

export type AppView = 'landing' | 'onboarding' | 'dashboard' | 'quotes' | 'history' | 'analysis' | 'settings' | 'billing' | 'studio' | 'support' | 'scorecards' | 'team' | 'privacy' | 'terms' | 'cookies' | 'payment';

export enum ImageSize {
  K1 = '1K',
  K2 = '2K',
  K4 = '4K'
}
