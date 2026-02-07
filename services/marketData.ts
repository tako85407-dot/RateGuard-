import { LiveRate } from '../types';

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

// CONFIGURATION
const MASSIVE_API_URL = "https://api.massive-fx.com/v1/rates"; 
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

/**
 * High-Fidelity Simulation Generator
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
 * Primary Data Fetcher
 */
export const fetchMarketRates = async (): Promise<{ source: 'live' | 'simulated', rates: LiveRate[] }> => {
  if (!API_KEY) {
    return { source: 'simulated', rates: generateLiveRates(TRACKED_PAIRS.length) };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s Timeout

    const response = await fetch(`${MASSIVE_API_URL}?pairs=${TRACKED_PAIRS.map(p => p.id).join(',')}`, {
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

    return { source: 'live', rates: [] }; 

  } catch (error) {
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