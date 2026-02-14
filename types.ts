

export interface Comment {
  id: string;
  user: string;
  text: string;
  timestamp: number;
}

export interface TeamMember {
  id: string;
  name: string;
  role: 'Auditor' | 'Controller' | 'Manager' | 'Processor' | 'admin' | 'member';
  status: 'Online' | 'Offline';
  activity: string;
  email?: string;
}

export interface FeeItem {
  type: string;
  amount: number;
  currency: string;
  percentage?: string | null;
  description?: string;
  category?: 'wire' | 'fx' | 'correspondent' | 'other';
}

export interface CostBreakdownItem {
  amount: number;
  percentage: number;
  label: string;
}

export interface QuoteData {
  id: string; // Firestore AutoID
  orgId: string;
  userId: string;
  createdAt: number;
  updatedAt: number;
  
  // Status Tracking
  status: 'uploaded' | 'processing' | 'analyzed' | 'flagged' | 'optimal' | 'error';
  workflowStatus: 'uploaded' | 'ocr_complete' | 'extracted' | 'analyzed' | 'reviewed' | 'approved' | 'error';
  reliabilityScore: number;
  
  // Source Document
  fileUrl?: string; // Optional if using base64 for demo
  fileType?: string;
  fileName?: string;
  pdfBase64?: string | null;
  ocrText?: string;
  
  // Extracted Bank Information
  bank: string;
  bankCode?: string;
  referenceNumber?: string;
  transactionDate?: string;
  valueDate: string;
  senderName?: string;
  recipientName?: string;
  
  // Transaction Details
  amount: number; // Original amount
  originalCurrency?: string;
  convertedAmount?: number;
  convertedCurrency?: string;
  pair: string; // "USD/EUR"
  
  // Exchange Rates
  exchangeRate: number; // Bank Rate
  midMarketRate: number; // Real market rate
  
  // DETAILED FEE STRUCTURE
  fees: FeeItem[];
  
  // INDIVIDUAL FEE COMPONENTS
  wireFee: number;
  fxFee: number;
  correspondentFee: number;
  otherFees: number;
  totalFees: number; // Sum of explicit fees
  
  // HIDDEN COST CALCULATIONS
  spreadDecimal: number;
  spreadPercentage: number;
  markupCost: number; // Spread Cost
  
  // TOTAL HIDDEN COST
  totalHiddenCost: number; // totalFees + markupCost
  totalHiddenPercentage: number;
  
  // COST BREAKDOWN
  costBreakdown: {
    fees: CostBreakdownItem;
    spread: CostBreakdownItem;
    total: CostBreakdownItem;
  };
  
  // ANNUALIZED PROJECTIONS
  annualTransactionCount: number;
  annualizedHiddenCost: number;
  monthlyAverageCost: number;
  
  // INDUSTRY COMPARISON
  industryAverageSpread: number;
  industryAverageTotalCost: number;
  yourCostVsIndustry: number;
  betterThanIndustry: boolean;
  percentileRank: string;
  potentialSavingsPercent: number;
  
  // DISPUTE & RECOMMENDATIONS
  dispute: {
    recommended: boolean;
    priority: "high" | "medium" | "low";
    reason: string;
    suggestedNegotiatedRate: number;
    targetSpreadPercentage: number;
    potentialSavingsPerTransaction: number;
    potentialAnnualSavings: number;
    disputeLetterGenerated: boolean;
    disputeLetterText?: string | null;
  };
  
  // RAW DATA & USER ACTIONS
  geminiRaw?: any;
  disputeDrafted?: boolean;
  notes: Comment[];
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

export interface Organization {
  id: string;
  name: string;
  adminId: string;
  members: string[];
  plan: 'free' | 'enterprise';
  maxSeats: number;
  credits: number; // Shared organization credits
  createdAt: number;
}

export interface Audit {
  id: string;
  orgId: string;
  userId: string;
  quoteId: string;
  timestamp: number;
  leakageAmount: number;
  leakagePercentage: number;
  pair: string;
  bank: string;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  orgId?: string;
  role: 'admin' | 'member';
  credits: number; // Legacy, referenced but logic moved to Org
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
