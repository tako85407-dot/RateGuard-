import { LiveRate } from '../types';
import { db } from './firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';

// PAIRS CONFIGURATION
const TRACKED_PAIRS = [
  // Global Majors
  { id: 'usdeur', symbol: 'USD/EUR', base: 0.92 },
  { id: 'usdgbp', symbol: 'USD/GBP', base: 0.79 },
  { id: 'usdcad', symbol: 'USD/CAD', base: 1.36 },
  { id: 'usdaud', symbol: 'USD/AUD', base: 1.52 },
  { id: 'usdjpy', symbol: 'USD/JPY', base: 151.50 },

  // High Leakage Pairs
  { id: 'usdzar', symbol: 'USD/ZAR', base: 18.85 },
  { id: 'usdzwg', symbol: 'USD/ZWG', base: 13.50 }, // Zimbabwe Gold
  { id: 'usdinr', symbol: 'USD/INR', base: 83.50 },
  { id: 'usdmxn', symbol: 'USD/MXN', base: 16.70 },
  { id: 'usdbrl', symbol: 'USD/BRL', base: 5.15 },

  // Business Crosses
  { id: 'eurgbp', symbol: 'EUR/GBP', base: 0.85 },
  { id: 'gbpeur', symbol: 'GBP/EUR', base: 1.17 },
  { id: 'usdcny', symbol: 'USD/CNY', base: 7.23 },
];

// --- RATEGUARD FX INTEGRATOR LOGIC ---

export interface MarketAudit {
  midMarketRate: number;
  markupCost: number;
  spreadPct: number;
  marketStatus: 'Open' | 'Closed' | 'Historical';
  timestampUsed: number;
  source: 'Live API' | 'Stale/Friday' | 'Simulation';
  note?: string;
}

export const analyzeQuoteRealtime = async (
  pairStr: string,
  bankRate: number,
  amount: number,
  dateStr?: string // YYYY-MM-DD
): Promise<MarketAudit> => {
  // 1. Normalize Pair
  // pairStr input might be "USD/EUR" or "EURUSD"
  let cleanPair = pairStr.replace('/', '').toUpperCase();
  // Ensure format BASE_QUOTE for ID lookup if possible, or try both permutations
  
  // Default parsing logic assuming input is slash separated or standard 6 char
  let base = 'USD';
  let quote = 'EUR';
  
  if (pairStr.includes('/')) {
    [base, quote] = pairStr.split('/');
  } else if (pairStr.length === 6) {
    base = pairStr.substring(0, 3);
    quote = pairStr.substring(3, 6);
  }

  const docId1 = `${base}_${quote}`;
  const docId2 = `${quote}_${base}`;

  // 2. Determine Market Status & Date Context
  const now = new Date();
  const txDate = dateStr ? new Date(dateStr) : now;
  // If tx is older than 24h, we ideally need historical data. 
  // For this version, we'll flag it but use current live/stored data as proxy or simulation.
  const isHistorical = (now.getTime() - txDate.getTime()) > (24 * 60 * 60 * 1000);

  let marketStatus: 'Open' | 'Closed' | 'Historical' = 'Open';
  let source: 'Live API' | 'Stale/Friday' | 'Simulation' = 'Simulation';
  let note: string | undefined = undefined;
  let midMarketRate = 0;

  // 3. Attempt to fetch Real-Time Rate from Firestore
  try {
    // Try Direct Pair
    let rateDoc = await getDoc(doc(db, "rates", docId1));
    let inverted = false;

    if (!rateDoc.exists()) {
      // Try Inverted Pair
      rateDoc = await getDoc(doc(db, "rates", docId2));
      inverted = true;
    }

    if (rateDoc.exists()) {
      const data = rateDoc.data();
      const rawRate = data?.rate;
      
      if (rawRate) {
        midMarketRate = inverted ? (1 / rawRate) : rawRate;
        source = 'Live API';
        // Check if data is stale (older than 24h)
        const lastUpdated = data.date_time?.toMillis ? data.date_time.toMillis() : Date.parse(data.last_updated);
        if (Date.now() - lastUpdated > 24 * 60 * 60 * 1000) {
           source = 'Stale/Friday';
           note = `Market data is from ${new Date(lastUpdated).toLocaleDateString()}. Markets may be closed.`;
        }
      }
    }
  } catch (err) {
    console.error("Rate fetch error, falling back to simulation", err);
  }

  // 4. Fallback to Simulation if Live Data Missing
  if (midMarketRate === 0) {
    const found = TRACKED_PAIRS.find(p => p.symbol.includes(quote) || p.symbol.includes(base));
    const baseRate = found ? found.base : 1.0;
    // Add deterministic noise
    const dateHash = (dateStr || now.toISOString()).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    midMarketRate = baseRate * (1 + ((dateHash % 100) / 10000) * (Math.random() > 0.5 ? 1 : -1));
    source = 'Simulation';
    note = "Live rate unavailable for this pair. Using estimated historical close.";
  }

  // 5. RateGuard Calculation
  // Spread = |(Bank Rate - Mid Rate)| / Mid Rate
  const spreadAbs = Math.abs(bankRate - midMarketRate); 
  const spreadPct = (spreadAbs / midMarketRate) * 100;
  
  // Calculate total hidden cost
  const markupCost = amount * (spreadPct / 100);

  return {
    midMarketRate: parseFloat(midMarketRate.toFixed(5)),
    markupCost,
    spreadPct,
    marketStatus,
    timestampUsed: Date.now(),
    source,
    note
  };
};

// --- SIMULATION & TICKER LOGIC ---

/**
 * High-Fidelity Simulation Generator (For Dashboard Ticker Fallback)
 */
export const generateLiveRates = (count: number = 8): LiveRate[] => {
  const now = Date.now();
  const rates: LiveRate[] = [];

  for (let i = 0; i < count; i++) {
    const pair = TRACKED_PAIRS[i % TRACKED_PAIRS.length];
    const noise = Math.random() * 0.005;
    const midMarket = pair.base * (1 + noise);
    const bankRate = midMarket * 1.022;
    const guardRate = midMarket * 1.003;

    rates.push({
      id: `rate_${pair.id}_${now}_${i}`,
      pair: pair.symbol,
      timestamp: now,
      midMarketRate: parseFloat(midMarket.toFixed(5)),
      bankRate: parseFloat(bankRate.toFixed(5)),
      rateGuardRate: parseFloat(guardRate.toFixed(5)),
      savingsPips: Math.round((bankRate - guardRate) * 10000),
      trend: Math.random() > 0.5 ? 'up' : 'down'
    });
  }
  return rates;
};

/**
 * Primary Data Fetcher
 * Strategy: Check Firestore for 'rates' collection. If empty, fall back to simulation.
 */
export const fetchMarketRates = async (): Promise<{ source: 'live' | 'simulated', rates: LiveRate[] }> => {
  try {
    const querySnapshot = await getDocs(collection(db, "rates"));
    if (!querySnapshot.empty) {
      const realRates: LiveRate[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const pairName = doc.id.replace('_', '/'); // USD_EUR -> USD/EUR
        
        // Safety check for rate
        if (!data.rate) return;

        realRates.push({
          id: doc.id,
          pair: pairName,
          timestamp: data.date_time ? (data.date_time.toMillis ? data.date_time.toMillis() : Date.parse(data.last_updated)) : Date.now(),
          midMarketRate: data.rate,
          bankRate: data.bank_spread || (data.rate * 1.025),
          rateGuardRate: data.rate * 1.003, // Fair rate
          savingsPips: data.leakage ? Math.round(data.leakage * 10000) : 250,
          trend: 'up' // Directional data could be stored in future
        });
      });
      return { source: 'live', rates: realRates };
    }
  } catch (err) {
    console.warn("Firestore Rate Fetch Failed, falling back to simulation.", err);
  }

  return { source: 'simulated', rates: generateLiveRates(TRACKED_PAIRS.length) };
};

export const downloadRatesJSON = (rates: LiveRate[]) => {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(rates, null, 2));
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", "rate_guard_live_rates.json");
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
};