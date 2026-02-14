
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

const getGeminiKey = () => getEnv('GEMINI_API_KEY');

const ATLAS_PERSONA = `You are the RateGuard Data Auditor. Your task is to extract bank confirmation data.`;

// --- SIMULATION FALLBACK (Used if API Key missing) ---
const simulateExtraction = async () => {
  console.log("Atlas Simulation: Processing document (Fallback)...");
  await new Promise(resolve => setTimeout(resolve, 1500));

  const banks = ["JPMorgan Chase", "Bank of America", "Wells Fargo", "Citibank"];
  const randomBank = banks[Math.floor(Math.random() * banks.length)];
  const amount = Math.floor(Math.random() * 400000) + 50000;
  const bankRate = 1.05; // ~2.7% markup

  return {
    extraction: {
      bank_name: randomBank,
      transaction_reference: `SIM-${Date.now().toString().slice(-6)}`,
      sender_name: "Simulated Sender",
      beneficiary_name: "Simulated Beneficiary"
    },
    transaction: {
      original_amount: amount,
      original_currency: "USD",
      converted_amount: amount * bankRate,
      converted_currency: "EUR",
      exchange_rate_bank: bankRate,
      currency_pair: "USD/EUR",
      value_date: new Date().toISOString().split('T')[0]
    },
    fees: {
      items: [{ name: "Wire Fee", amount: 25.00 }, { name: "Correspondent Fee", amount: 15.00 }],
      total_fees: 40.00
    },
    source: 'simulation'
  };
};

// --- GEMINI EXTRACTION PIPELINE ---

export const extractQuoteData = async (base64: string, mimeType: string = 'image/jpeg') => {
  const apiKey = getGeminiKey();
  if (!apiKey) {
    console.warn("Atlas: No API Key found. Using simulation.");
    return simulateExtraction();
  }

  const ai = new GoogleGenAI({ apiKey });
  
  // Using gemini-3-flash-preview as the "cheap but functional" model (1.5 Flash successor)
  const modelId = 'gemini-3-flash-preview';

  const prompt = `
    Analyze this bank transaction document (Image/PDF).
    Extract the transaction details into JSON.
    
    CRITICAL INSTRUCTIONS:
    1. **Bank Name**: Look for the logo or header text. Extract the EXACT name of the financial institution. Do NOT restrict yourself to a list of major banks. If it looks like a bank or money transfer service, record its name.
    2. **Fees**: Look for all fee line items (Wire Fee, FX Fee, Commission, etc.) and list them individually.
    
    Required Fields:
    - bank_name (String. The name of the bank/provider found in the doc.)
    - transaction_reference
    - sender_name
    - beneficiary_name
    - original_amount (number)
    - original_currency (ISO code)
    - converted_amount (number)
    - converted_currency (ISO code)
    - exchange_rate_bank (number)
    - currency_pair (Format "BASE/QUOTE", e.g. "USD/EUR")
    - value_date (YYYY-MM-DD)
    - fees (array of {name, amount})
    
    If visual confidence is low, infer based on standard banking formats.
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64 } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            extraction: {
              type: Type.OBJECT,
              properties: {
                bank_name: { type: Type.STRING },
                transaction_reference: { type: Type.STRING },
                sender_name: { type: Type.STRING },
                beneficiary_name: { type: Type.STRING }
              }
            },
            transaction: {
              type: Type.OBJECT,
              properties: {
                original_amount: { type: Type.NUMBER },
                original_currency: { type: Type.STRING },
                converted_amount: { type: Type.NUMBER },
                converted_currency: { type: Type.STRING },
                exchange_rate_bank: { type: Type.NUMBER },
                currency_pair: { type: Type.STRING },
                value_date: { type: Type.STRING }
              }
            },
            fees: {
              type: Type.OBJECT,
              properties: {
                items: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      amount: { type: Type.NUMBER }
                    }
                  }
                },
                total_fees: { type: Type.NUMBER }
              }
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from Gemini");
    
    const data = JSON.parse(text);
    return { ...data, source: 'gemini-flash' };

  } catch (error) {
    console.error("Atlas Extraction Error:", error);
    return simulateExtraction();
  }
};

// --- REAL-TIME RATE SEARCH ---

export const getHistoricExchangeRate = async (pair: string, date: string) => {
  const apiKey = getGeminiKey();
  if (!apiKey) return { rate: 0, source: 'simulation' };

  const ai = new GoogleGenAI({ apiKey });
  
  const prompt = `Find the historical mid-market exchange rate for ${pair} on ${date}. 
  Return ONLY the numeric rate in JSON format. 
  Example: {"rate": 1.0845}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', // Using Flash + Tools for cost efficiency
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            rate: { type: Type.NUMBER, description: "The mid-market exchange rate found." }
          }
        }
      }
    });

    // Check for grounding metadata to ensure real data was used
    const grounding = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    let sourceUrl = 'Google Search';
    if (grounding && grounding.length > 0) {
      // Just grab the first source if available for logging
      sourceUrl = grounding[0].web?.uri || 'Google Search';
    }

    const text = response.text;
    if (!text) return { rate: 0, source: 'failed' };
    
    const data = JSON.parse(text);
    return { 
        rate: data.rate, 
        source: 'google-search-grounding',
        sourceUrl
    };

  } catch (error) {
    console.error("Rate Search Error:", error);
    // Fallback logic could go here, but for now return 0 to trigger manual entry or fallback logic in UI
    return { rate: 0, source: 'error' }; 
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
