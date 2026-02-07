import { GoogleGenAI, Type } from "@google/genai";

// --- CONFIGURATION ---

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

const getZhipuKey = () => getEnv('ZHIPUAI_API_KEY');
const getGeminiKey = () => getEnv('GEMINI_API_KEY');

// --- TEXT PRE-PROCESSING ---

const cleanOcrText = (text: string): string => {
  return text
    .replace(/═+/g, '---')
    .replace(/_+/g, '---')
    .replace(/\s{3,}/g, '\n')
    .replace(/(Wire Transfer Fee:\s+)(Foreign Exchange Fee:)/g, '$1\n$2')
    .replace(/(\$\d+[\d,]*\.?\d*)\s+(\$\d+[\d,]*\.?\d*)/g, '$1\n$2')
    .replace(/(Fee:)(\s*)(\$\d)/gi, '$1 $3')
    .replace(/(\$\d+\.\d+)(\()/g, '$1 $2')
    .trim();
};

const cleanJsonOutput = (text: string): string => {
  // Remove markdown code blocks if present
  let clean = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');
  return clean.trim();
};

// --- SYSTEM INSTRUCTIONS ---

const ATLAS_PERSONA = `You are the RateGuard Data Auditor. Your task is to extract bank confirmation data.`;

// STRICT USER PROMPT
const EXTRACTION_INSTRUCTION = `Extract data from this bank confirmation.
MAPPING RULES:
Bank Name: Look at the very first line of the document. If it says 'JPMORGAN CHASE', 'CHASE', or 'JPM', the bank is 'JPMorgan Chase'.
Numerical Values: You MUST strip all symbols ($, ¥, ,) and return only numbers with decimals. (Example: $125,000.00 -> 125000.00).
Output Format: Return a flat JSON object with these EXACT keys:
bank_name: (String)
transaction_id: (From Transaction Reference)
amount: (Float)
currency: (String, e.g., 'USD')
exchange_rate: (Float)
total_fees: (Float)
STRICT: Do not include markdown code blocks. If you cannot find a value, use null, never 0 unless the document explicitly says zero.`;

// Flat schema matches the user prompt exactly
const EXTRACTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    bank_name: { type: Type.STRING },
    transaction_id: { type: Type.STRING },
    amount: { type: Type.NUMBER },
    currency: { type: Type.STRING },
    exchange_rate: { type: Type.NUMBER },
    total_fees: { type: Type.NUMBER }
  }
};

// --- LOGIC: BANK NORMALIZATION (Thomas James Audit Logic) ---
const normalizeBankName = (rawName: string | undefined): string => {
  if (!rawName) return "Unidentified Bank";
  const upper = rawName.toUpperCase();
  
  if (upper.includes("CHASE") || upper.includes("JPM")) {
    return "JPMorgan Chase";
  }
  if (upper.includes("CITI")) {
    return "Citibank";
  }
  if (upper.includes("WELLS")) {
    return "Wells Fargo";
  }
  if (upper.includes("AMERICA") || upper.includes("BOA")) {
    return "Bank of America";
  }
  if (upper.includes("HSBC")) {
    return "HSBC";
  }
  
  return "External/International Bank";
};

// --- ZHIPU AI (GLM-4V) FOR OCR ---
const performOCRWithGLM = async (base64Image: string): Promise<string> => {
  const apiKey = getZhipuKey();
  if (!apiKey) throw new Error("ZHIPU_MISSING");

  const url = "https://open.bigmodel.cn/api/paas/v4/chat/completions";

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "glm-4v", 
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Transcribe all text and numbers from this financial document exactly as they appear. Do not summarize." },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 2000
      })
    });

    if (!response.ok) throw new Error(`ZHIPU_API_ERROR: ${response.status}`);
    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  } catch (error) {
    console.warn("GLM-4V OCR Failed, falling back.", error);
    throw new Error("ZHIPU_FAILED");
  }
};

// --- GEMINI VISION (OCR FALLBACK) ---
const performOCRWithGemini = async (base64Image: string, mimeType: string): Promise<string> => {
  const apiKey = getGeminiKey();
  if (!apiKey) throw new Error("Gemini API Key is missing.");
  
  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { text: "Transcribe text from image. Return only text." },
          { inlineData: { mimeType, data: base64Image } }
        ]
      }
    });
    return response.text || "";
  } catch (error) {
    console.error("Gemini Vision Failed:", error);
    throw new Error("Vision Sensors Failed.");
  }
};

// --- GEMINI ANALYSIS (LOGIC) ---
const analyzeTextWithGemini = async (ocrText: string): Promise<any> => {
  const apiKey = getGeminiKey();
  if (!apiKey) throw new Error("Gemini API Key is missing.");

  const ai = new GoogleGenAI({ apiKey });
  const cleanedText = cleanOcrText(ocrText);

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Data:\n${cleanedText}`,
      config: {
        systemInstruction: EXTRACTION_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: EXTRACTION_SCHEMA,
        temperature: 0.1,
      }
    });

    const cleanJson = cleanJsonOutput(response.text || "{}");
    const flatData = JSON.parse(cleanJson);

    // --- APPLY "THOMAS JAMES" AUDIT LOGIC ---
    const processedBank = normalizeBankName(flatData.bank_name);
    
    // Fallback spread logic if not explicit (Assumes 2.5% industry average for calculation visual)
    const amount = Number(flatData.amount) || 0;
    const rate = Number(flatData.exchange_rate) || 0;
    const estimatedMidMarket = rate > 0 ? rate / 1.025 : 0; // Reverse engineer a "fair" rate
    const estimatedSpreadCost = (amount > 0 && rate > 0) ? (amount * 0.025) : 0; 

    // --- RECONSTRUCT NESTED OBJECT FOR APP COMPATIBILITY ---
    return {
      extraction: {
        bank_name: processedBank,
        transaction_reference: flatData.transaction_id || 'N/A',
        sender_name: null,
        beneficiary_name: null 
      },
      transaction: {
        original_amount: amount,
        original_currency: flatData.currency || 'USD',
        converted_amount: null,
        converted_currency: null,
        exchange_rate_bank: rate,
        currency_pair: flatData.currency ? `USD/${flatData.currency}` : 'USD/EUR', // Inference based on currency
        value_date: new Date().toISOString().split('T')[0]
      },
      fees: {
        items: [],
        total_fees: Number(flatData.total_fees) || 0
      },
      analysis: {
        mid_market_rate: Number(estimatedMidMarket.toFixed(4)),
        cost_of_spread_usd: Number(estimatedSpreadCost.toFixed(2)),
        total_cost_usd: (Number(flatData.total_fees) || 0) + estimatedSpreadCost
      },
      dispute: {
        recommended: estimatedSpreadCost > 100,
        reason: estimatedSpreadCost > 100 ? "Spread exceeds 2.0%" : null
      }
    };

  } catch (error) {
    console.error("Gemini Analysis Failed:", error);
    // Return a partial object so the app doesn't crash completely
    return {
      extraction: { bank_name: "Unidentified Bank" },
      transaction: { amount: 0, currency_pair: "USD/EUR" },
      fees: { items: [], total_fees: 0 },
      analysis: { total_cost_usd: 0 },
      dispute: { recommended: false }
    };
  }
};

// --- INTERNAL AI PIPELINE (FALLBACK) ---
const extractQuoteDataViaLocalAI = async (base64: string, mimeType: string = 'image/jpeg') => {
  let rawText = "";

  try {
     rawText = await performOCRWithGLM(base64);
  } catch (e: any) {
     console.log("Switching to Gemini Vision pipeline...");
     rawText = await performOCRWithGemini(base64, mimeType);
  }
  
  if (!rawText || rawText.length < 5) {
    throw new Error("Document appeared empty or unreadable.");
  }

  const structuredData = await analyzeTextWithGemini(rawText);
  return structuredData;
};

// --- MAIN PIPELINE (WEBHOOK FIRST) ---
export const extractQuoteData = async (base64: string, mimeType: string = 'image/jpeg') => {
  const WEBHOOK_URL = "https://eoqquswfp7c5ke3.m.pipedream.net";
  
  // 1. Try Webhook Integration
  try {
    console.log("Atlas: Uploading to Integration Node (Pipedream)...");
    
    // Using a simpler JSON payload for webhook compatibility
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file: base64,
        mimeType: mimeType,
        timestamp: Date.now()
      })
    });

    if (!response.ok) {
      throw new Error(`Integration Node Error: ${response.status}`);
    }

    const data = await response.json();
    console.log("Integration Node Response:", data);

    // 2. Map Webhook Response to RateGuard Schema
    // Handles various response structures (flat or nested in data/body)
    const source = data.data || data.body || data;

    // Helper for case-insensitive key lookup
    const find = (keys: string[]) => {
      const lowerKeys = keys.map(k => k.toLowerCase());
      for (const k of Object.keys(source)) {
        if (lowerKeys.includes(k.toLowerCase())) return source[k];
      }
      return null;
    };

    // Extract fields
    const bank = find(['bank', 'bank_name', 'institution']) || "Unidentified Bank";
    const amount = parseFloat(find(['amount', 'principal', 'original_amount', 'val'])) || 0;
    const rate = parseFloat(find(['rate', 'exchange_rate', 'fx_rate', 'price', 'exchange_rate_bank'])) || 0;
    const currency = find(['currency', 'original_currency', 'source_currency', 'code']) || "USD";
    const date = find(['date', 'value_date', 'transaction_date', 'time']) || new Date().toISOString().split('T')[0];
    const fees = parseFloat(find(['fees', 'fee', 'total_fees', 'commission'])) || 0;
    const pair = find(['pair', 'currency_pair']) || (currency === 'USD' ? 'USD/EUR' : `USD/${currency}`);

    // Fallback calculation logic if webhook doesn't provide analysis
    const estimatedMidMarket = rate > 0 ? rate / 1.025 : 0;
    const estimatedSpreadCost = (amount > 0 && rate > 0) ? (amount * 0.025) : 0;

    return {
      extraction: {
        bank_name: normalizeBankName(bank),
        transaction_reference: find(['id', 'ref', 'reference', 'transaction_id']) || `WEBHOOK-${Date.now()}`,
        sender_name: null,
        beneficiary_name: null
      },
      transaction: {
        original_amount: amount,
        original_currency: currency,
        converted_amount: null,
        converted_currency: null,
        exchange_rate_bank: rate,
        currency_pair: pair,
        value_date: date
      },
      fees: {
        items: [],
        total_fees: fees
      },
      analysis: {
        mid_market_rate: Number(estimatedMidMarket.toFixed(4)),
        cost_of_spread_usd: Number(estimatedSpreadCost.toFixed(2)),
        total_cost_usd: fees + estimatedSpreadCost
      },
      dispute: {
        recommended: estimatedSpreadCost > 100,
        reason: estimatedSpreadCost > 100 ? "Spread exceeds 2.0%" : null
      },
      source: 'webhook'
    };

  } catch (error) {
    console.warn("Integration Node Unreachable, switching to On-Device Intelligence:", error);
    // 3. Fallback to Local/Gemini Pipeline
    return extractQuoteDataViaLocalAI(base64, mimeType);
  }
};

// --- SUPPORT CHAT ---
export const chatWithAtlas = async (message: string, history: {role: string, parts: {text: string}[]}[] = []) => {
  const apiKey = getGeminiKey();
  if (!apiKey) return "Atlas Disconnected: Missing API Key.";

  const ai = new GoogleGenAI({ apiKey });
  try {
    const chat = ai.chats.create({
      model: 'gemini-3-flash-preview',
      config: { systemInstruction: ATLAS_PERSONA, temperature: 0.7 },
      history: history 
    });
    const result = await chat.sendMessage({ message });
    return result.text;
  } catch (error) {
    return "Atlas is temporarily unavailable.";
  }
};

// --- IMAGE GEN ---
export const generateImageWithAI = async (prompt: string, size: '1K' | '2K' | '4K') => {
  const apiKey = getGeminiKey();
  if (!apiKey) throw new Error("Missing Key");
  const ai = new GoogleGenAI({ apiKey });
  const model = (size === '2K' || size === '4K') ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
  
  try {
    const response = await ai.models.generateContent({
      model,
      contents: { parts: [{ text: prompt }] },
      config: { imageConfig: { aspectRatio: "1:1", ...(model === 'gemini-3-pro-image-preview' ? { imageSize: size } : {}) } }
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    return null;
  } catch (error) { throw error; }
};

export const editImageWithAI = async (imageBase64: string, prompt: string) => {
  const apiKey = getGeminiKey();
  if (!apiKey) throw new Error("Missing Key");
  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ inlineData: { data: imageBase64, mimeType: 'image/jpeg' } }, { text: prompt }] }
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    return null;
  } catch (error) { throw error; }
};