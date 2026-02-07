import { LiveRate } from '../types';

// Helper for Robust Env Vars
const getEnv = (key: string) => {
  let value = '';
  if (import.meta && (import.meta as any).env) {
    value = (import.meta as any).env[`VITE_${key}`] || 
            (import.meta as any).env[`NEXT_PUBLIC_${key}`] || 
            (import.meta as any).env[key] || 
            '';
  }
  if (value) return value;

  if (typeof process !== 'undefined' && process.env) {
    value = process.env[`VITE_${key}`] || 
            process.env[`NEXT_PUBLIC_${key}`] || 
            process.env[key] || 
            '';
  }
  return value;
};

// CONFIGURATION
const MASSIVE_API_BASE = "https://api.massive-fx.com/v1"; 
const API_KEY = getEnv("MASSIVE_API_KEY");

if (!API_KEY) {
  console.warn("RateGuard Warning: MASSIVE_API_KEY is not defined. Falling back to High-Fidelity Simulation Mode.");
}

// PAIRS CONFIGURATION
const TRACKED_PAIRS = [
  { id: 'eurusd', symbol: 'EUR/USD', base: 1.0850 },
  { id: 'gbpusd', symbol: 'GBP/USD', base: 1.2650 },
  { id: 'usdcad', symbol: 'USD/CAD', base: 1.4150 },
  { id: 'usdjpy', symbol: 'USD/JPY', base: 151.20 },
  { id: 'audusd', symbol: 'AUD/USD', base: 0.6540 },
  { id: 'usdzar', symbol: 'USD/ZAR', base: 18.950 },
  { id: 'usdtry', symbol: 'USD/TRY', base: 32.100 },
  { id: 'usdmyr', symbol: 'USD/MYR', base: 4.750 },
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
  // 1. Normalize Pair (e.g., "USD/EUR")
  // Default to USD base if ambiguous, matching prompt requirement
  const cleanPair = pairStr.includes('/') ? pairStr : `USD/${pairStr}`;
  const [base, quote] = cleanPair.split('/');

  // 2. Determine Market Status & Date Context
  const now = new Date();
  const txDate = dateStr ? new Date(dateStr) : now;
  const isHistorical = (now.getTime() - txDate.getTime()) > (24 * 60 * 60 * 1000);

  // Market Hours: Closes Friday 5PM ET (~22:00 UTC), Opens Sunday 5PM ET
  const day = now.getUTCDay(); // 0 = Sun, 6 = Sat
  const hour = now.getUTCHours();
  
  // Weekend Logic: Sat is closed. Sun < 22:00 UTC is closed. Fri > 22:00 UTC is closed.
  const isWeekend = (day === 6) || (day === 0 && hour < 22) || (day === 5 && hour >= 22);

  let marketStatus: 'Open' | 'Closed' | 'Historical' = 'Open';
  let source: 'Live API' | 'Stale/Friday' | 'Simulation' = 'Simulation';
  let note: string | undefined = undefined;
  let dateToFetch = dateStr || now.toISOString().split('T')[0];

  if (isHistorical) {
    marketStatus = 'Historical';
  } else if (isWeekend) {
    marketStatus = 'Closed';
    source = 'Stale/Friday';
    
    // Calculate last Friday's date
    const friday = new Date();
    // Calculate days to subtract to get to last Friday
    // If Sat(6) -> -1. If Sun(0) -> -2.
    const daysToFriday = (day + 2) % 7; 
    friday.setDate(now.getDate() - daysToFriday);
    dateToFetch = friday.toISOString().split('T')[0];
    
    note = `Live markets are closed. Using Friday's Closing Rate (${dateToFetch}) for this audit.`;
  } else {
    source = API_KEY ? 'Live API' : 'Simulation';
  }

  let midMarketRate = 0;

  // 3. Fetch Data (Massive API / Simulation)
  if (!API_KEY) {
     // SIMULATION: Find base rate and apply slight variation
     const found = TRACKED_PAIRS.find(p => p.symbol.includes(quote) || p.symbol.includes(base));
     const baseRate = found ? found.base : 1.0;
     // Add deterministic "noise" based on date characters to simulate historical variance
     const dateHash = dateToFetch.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
     midMarketRate = baseRate * (1 + (dateHash % 100) / 10000);
  } else {
     try {
       // Construct URL: /v1/conversion/
       let url = `${MASSIVE_API_BASE}/conversion/?from=${base}&to=${quote}&amount=1`;
       
       if (marketStatus === 'Historical' || marketStatus === 'Closed') {
         url += `&date=${dateToFetch}`;
       }

       const res = await fetch(url, { headers: { 'Authorization': `Bearer ${API_KEY}` }});
       if (!res.ok) throw new Error("Massive API Error");
       
       const data = await res.json();
       // Assuming response format: { result: 1.0850, ... }
       if (data.result) {
         midMarketRate = Number(data.result);
       } else {
         throw new Error("Invalid Response");
       }
     } catch (e) {
       console.warn("RateGuard Integrator: API Fail, reverting to simulation.", e);
       source = 'Simulation';
       note = note ? `${note} (API Unreachable)` : "Market Data API Unreachable. Using internal reference rates.";
       const found = TRACKED_PAIRS.find(p => p.symbol.includes(quote));
       midMarketRate = found ? found.base : 1.0;
     }
  }

  // 4. RateGuard Calculation: 'Spread' = ((Bank Rate - Market Rate) / Market Rate) * 100
  // Handle directionality: Spread is always the loss.
  // If we are selling USD for EUR, and Bank gives 0.9 EUR but Market is 1.0 EUR, we lost.
  // We assume Bank Rate is always worse (the "rip-off").
  const spreadAbs = Math.abs(bankRate - midMarketRate); // Simple diff
  const spreadPct = (spreadAbs / midMarketRate) * 100;
  
  // Calculate total hidden cost
  const markupCost = amount * (spreadPct / 100);

  return {
    midMarketRate,
    markupCost,
    spreadPct,
    marketStatus,
    timestampUsed: Date.now(),
    source,
    note
  };
};

// --- EXISTING SIMULATION & TICKER LOGIC ---

/**
 * High-Fidelity Simulation Generator (For Dashboard Ticker)
 */
export const generateLiveRates = (count: number = 8): LiveRate[] => {
  const now = Date.now();
  const rates: LiveRate[] = [];

  for (let i = 0; i < count; i++) {
    const pair = TRACKED_PAIRS[i % TRACKED_PAIRS.length];
    
    // 1. Organic Volatility (Random Walk)
    const noise = Math.random() * (i >= TRACKED_PAIRS.length ? 0.005 : 0);
    const volatility = (Math.random() - 0.5) * 0.002; 
    const midMarket = pair.base * (1 + volatility + noise);
    
    // 2. Bank Spread Logic (The "Rip-off" Rate)
    const bankSpreadPct = 0.022; 
    const bankRate = midMarket * (1 + bankSpreadPct);

    // 3. RateGuard Spread Logic (The "Fair" Rate)
    const guardSpreadPct = 0.003;
    const guardRate = midMarket * (1 + guardSpreadPct);

    // 4. Calculate Leakage (Pips)
    const leakage = bankRate - guardRate;
    const pips = Math.abs(Math.round(leakage * 10000));

    // 5. Trend Determination
    const trend = Math.random() > 0.5 ? 'up' : 'down';

    rates.push({
      id: `rate_${pair.id}_${now}_${i}`,
      pair: pair.symbol,
      timestamp: now,
      midMarketRate: parseFloat(midMarket.toFixed(5)),
      bankRate: parseFloat(bankRate.toFixed(5)),
      rateGuardRate: parseFloat(guardRate.toFixed(5)),
      savingsPips: pips,
      trend: trend
    });
  }

  return rates;
};

/**
 * Primary Data Fetcher (For Dashboard Ticker)
 */
export const fetchMarketRates = async (): Promise<{ source: 'live' | 'simulated', rates: LiveRate[] }> => {
  if (!API_KEY) {
    return { source: 'simulated', rates: generateLiveRates(TRACKED_PAIRS.length) };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s Timeout

    // Using /rates endpoint for ticker bulk fetch
    const response = await fetch(`${MASSIVE_API_BASE}/rates?pairs=${TRACKED_PAIRS.map(p => p.id).join(',')}`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    
    const liveRates: LiveRate[] = TRACKED_PAIRS.map((pair) => {
        let rawRate = pair.base;

        if (data.rates && data.rates[pair.id]) {
            rawRate = Number(data.rates[pair.id]);
        } else if (data[pair.id]) {
            rawRate = Number(data[pair.id]);
        } else if (Array.isArray(data)) {
            const found = data.find((r: any) => 
                (r.symbol && r.symbol.toLowerCase() === pair.symbol.toLowerCase()) || 
                (r.id && r.id.toLowerCase() === pair.id.toLowerCase())
            );
            if (found) {
                rawRate = Number(found.price || found.rate || found.value || found.ask);
            }
        }

        if (isNaN(rawRate) || rawRate === 0) rawRate = pair.base;

        const midMarket = rawRate;
        const bankSpreadPct = 0.022; 
        const guardSpreadPct = 0.003; 

        const bankRate = midMarket * (1 + bankSpreadPct);
        const guardRate = midMarket * (1 + guardSpreadPct);
        const leakage = bankRate - guardRate;
        const pips = Math.abs(Math.round(leakage * 10000));
        const trend = Math.random() > 0.5 ? 'up' : 'down';

        return {
            id: `live_${pair.id}_${Date.now()}`,
            pair: pair.symbol,
            timestamp: Date.now(),
            midMarketRate: parseFloat(midMarket.toFixed(5)),
            bankRate: parseFloat(bankRate.toFixed(5)),
            rateGuardRate: parseFloat(guardRate.toFixed(5)),
            savingsPips: pips,
            trend: trend
        };
    });

    return { source: 'live', rates: liveRates }; 

  } catch (error) {
    console.warn("Massive FX Feed Unreachable (Running Simulation):", error);
    return { source: 'simulated', rates: generateLiveRates(TRACKED_PAIRS.length) };
  }
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