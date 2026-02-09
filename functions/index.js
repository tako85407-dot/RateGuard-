const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");

admin.initializeApp();
const db = admin.firestore();

// Pairs to track - Updated to specific user request including ZWG and High Leakage pairs
const CURRENCY_PAIRS = [
  "USD-EUR", "USD-GBP", "USD-CAD", "USD-AUD", "USD-JPY", // Majors
  "USD-ZAR", "USD-ZWG", "USD-INR", "USD-MXN", "USD-BRL", // High Leakage
  "EUR-GBP", "GBP-EUR", "USD-CNY"                        // Business Crosses
];

// Support both standard env vars (e.g. locally or other platforms) and Firebase config
const SERPAPI_KEY = process.env.SERPAPI_API_KEY || functions.config().serpapi?.key;

/**
 * Shared logic to fetch rates from SerpApi and update Firestore.
 */
async function performRateSync() {
  if (!SERPAPI_KEY) {
    console.error("Skipping Sync: SERPAPI_API_KEY is missing.");
    throw new Error("SERPAPI_API_KEY missing");
  }

  const batch = db.batch();
  const timestamp = admin.firestore.FieldValue.serverTimestamp();
  const results = [];

  const promises = CURRENCY_PAIRS.map(async (pairString) => {
    const query = pairString;
    const docId = pairString.replace('-', '_'); // e.g. USD-EUR -> USD_EUR
    
    try {
      // Fetch from SerpApi (Google Finance Engine)
      const response = await axios.get("https://serpapi.com/search", {
        params: {
          engine: "google_finance",
          q: query,
          api_key: SERPAPI_KEY
        }
      });

      // Extract Rate - Robust checking for Google Finance structure
      let rate = 0;
      const data = response.data;
      
      if (data.summary && data.summary.price) {
         rate = parseFloat(data.summary.price);
      } else if (data.markets) {
         // SerpApi keys can be dynamic, check query exact, lowercase, or uppercase
         const marketKey = Object.keys(data.markets).find(k => k.toLowerCase() === query.toLowerCase());
         if (marketKey && data.markets[marketKey]) {
            rate = data.markets[marketKey].price;
         }
      }

      if (!rate || isNaN(rate)) {
        console.warn(`Could not parse rate for ${query} from SerpApi response.`);
        return;
      }

      // RateGuard Calculations
      // Bank Spread: Base Rate + 2.5% markup (Industry Standard)
      const bankSpread = rate * 1.025;
      // Leakage: Difference between bank rate and mid-market
      const leakage = bankSpread - rate;

      const docRef = db.collection("rates").doc(docId);
      batch.set(docRef, {
        rate: rate,
        bank_spread: parseFloat(bankSpread.toFixed(4)),
        leakage: parseFloat(leakage.toFixed(4)),
        date_time: timestamp,
        last_updated: new Date().toISOString()
      }, { merge: true });
      
      results.push({ pair: query, rate });

    } catch (err) {
      console.error(`Error processing ${query}:`, err.message);
    }
  });

  await Promise.all(promises);
  await batch.commit();
  return results;
}

/**
 * Scheduled Function: Runs 7 times a day
 * Cron: 0 0,3,7,10,14,17,21 * * * (UTC)
 */
exports.scheduledCurrencySync = functions.pubsub
  .schedule("0 0,3,7,10,14,17,21 * * *")
  .timeZone("UTC")
  .onRun(async (context) => {
    try {
      await performRateSync();
      console.log("Scheduled currency sync completed.");
    } catch (error) {
      console.error("Scheduled currency sync failed:", error);
    }
  });

/**
 * HTTP Function: Trigger Manually
 * Usage: Call this endpoint to force a sync (e.g. during deployment hooks).
 */
exports.forceCurrencySync = functions.https.onRequest(async (req, res) => {
  try {
    const results = await performRateSync();
    res.json({ success: true, updated: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});