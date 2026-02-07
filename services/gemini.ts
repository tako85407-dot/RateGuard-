
import { GoogleGenAI } from "@google/genai";

// --- CONFIGURATION ---

// Helper to check all possible prefix variations for Vercel/Vite compatibility
const getEnv = (key: string) => {
  // Check process.env (polyfilled by vite.config.ts)
  if (typeof process !== 'undefined' && process.env) {
    return process.env[`VITE_${key}`] || 
           process.env[`NEXT_PUBLIC_${key}`] || 
           process.env[key] || 
           '';
  }
  return '';
};

const getZhipuKey = () => getEnv('ZHIPUAI_API_KEY');
const getGeminiKey = () => getEnv('GEMINI_API_KEY');

// --- SYSTEM INSTRUCTIONS ---

const ATLAS_PERSONA = `You are Atlas, the central intelligence node for RateGuard. 
You assist Finance teams in analyzing bank wires, detecting hidden spreads, and negotiating better FX rates.
You are professional, concise, and focused on saving the user money.
Never mention internal model names (like Gemini or GLM). Always refer to yourself as "Atlas".`;

const EXTRACTION_INSTRUCTION = `You are RateGuard's Logic Engine. Your goal is to convert raw OCR text from a bank document into structured JSON.

## CRITICAL RULES
1. **FEE CALCULATION**: Only sum fees EXPLICITLY listed.
2. **CURRENCY PAIR**: Format as XXX/YYY (e.g. USD/EUR).
3. **SPREAD CALCULATION**: 
   - If mid-market rate is provided in context, use it. 
   - Otherwise, estimate based on the provided 'value_date' and standard historical rates for that pair.
   - Calculate 'markup_cost' = (Bank Rate vs Mid-Market Rate diff) * Amount.

## OUTPUT JSON SCHEMA
Return strictly JSON. No markdown blocking.
{
  "extraction": {
    "bank_name": "string",
    "transaction_date": "YYYY-MM-DD",
    "sender_name": "string",
    "beneficiary_name": "string"
  },
  "transaction": {
    "original_amount": number,
    "original_currency": "XXX",
    "converted_amount": number,
    "converted_currency": "YYY",
    "exchange_rate_bank": number,
    "currency_pair": "XXX/YYY",
    "value_date": "YYYY-MM-DD"
  },
  "fees": {
    "items": [{ "name": "string", "amount": number }],
    "total_fees": number
  },
  "analysis": {
    "mid_market_rate": number,
    "cost_of_spread_usd": number,
    "total_cost_usd": number
  },
  "dispute": {
    "recommended": boolean,
    "reason": "string"
  }
}`;

// --- ZHIPU AI (GLM-4V) FOR OCR ---
const performOCRWithGLM = async (base64Image: string): Promise<string> => {
  const apiKey = getZhipuKey();
  if (!apiKey) throw new Error("ZHIPU_MISSING");

  const url = "https://open.bigmodel.cn/api/paas/v4/chat/completions";

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
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

    if (!response.ok) throw new Error(`Status ${response.status}`);
    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  } catch (error) {
    console.warn("GLM-4V OCR Failed or CORS blocked, falling back to Gemini Vision.", error);
    throw new Error("ZHIPU_FAILED");
  }
};

// --- GEMINI VISION FALLBACK ---
const performOCRWithGemini = async (base64Image: string, mimeType: string): Promise<string> => {
  const apiKey = getGeminiKey();
  if (!apiKey) throw new Error("Gemini API Key is missing.");

  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview',
      contents: [
        {
          role: 'user',
          parts: [
            { text: "Transcribe all text and numbers from this financial document exactly as they appear. Return only the text." },
            { inlineData: { mimeType, data: base64Image } }
          ]
        }
      ]
    });
    return response.text || "";
  } catch (error) {
    console.error("Gemini Vision Failed:", error);
    throw new Error("Atlas Vision Sensors Failed.");
  }
};

// --- GEMINI FOR ANALYSIS ---
const analyzeTextWithGemini = async (ocrText: string): Promise<any> => {
  const apiKey = getGeminiKey();
  if (!apiKey) throw new Error("Gemini API Key is missing.");

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview',
      contents: [
        {
          role: 'user',
          parts: [
            { text: EXTRACTION_INSTRUCTION },
            { text: `Here is the raw text extracted from the document:\n\n${ocrText}` }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        temperature: 0.1,
      }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("Empty response from Logic Engine.");
    return JSON.parse(jsonText);

  } catch (error) {
    console.error("Gemini Analysis Failed:", error);
    throw new Error("Atlas Logic Core Failed.");
  }
};

// --- MAIN PIPELINE ---
export const extractQuoteData = async (base64: string, mimeType: string = 'image/jpeg') => {
  let rawText = "";

  // 1. Try GLM-4V first
  try {
     rawText = await performOCRWithGLM(base64);
  } catch (e: any) {
     // 2. Fallback to Gemini 2.5 Flash if Zhipu is missing or fails (CORS/Error)
     console.log("Switching to Gemini Vision pipeline...");
     rawText = await performOCRWithGemini(base64, mimeType);
  }
  
  if (!rawText) throw new Error("Document was unreadable by all nodes.");

  // 3. Send extracted text to Gemini for Logic/Math/Structuring
  const structuredData = await analyzeTextWithGemini(rawText);

  return structuredData;
};

// --- SUPPORT CHAT (Gemini) ---
export const chatWithAtlas = async (message: string, history: {role: string, parts: {text: string}[]}[] = []) => {
  const apiKey = getGeminiKey();
  if (!apiKey) return "Atlas Disconnected: Missing API Key.";

  const ai = new GoogleGenAI({ apiKey });

  try {
    const chat = ai.chats.create({
      model: 'gemini-2.5-flash-preview',
      config: {
        systemInstruction: ATLAS_PERSONA,
        temperature: 0.7,
      },
      history: history 
    });

    const result = await chat.sendMessage({ message });
    return result.text;

  } catch (error) {
    console.error("Chat Error:", error);
    return "Atlas is temporarily unavailable. Please check your connection.";
  }
};

// --- IMAGE GENERATION ---
export const generateImageWithAI = async (prompt: string, size: '1K' | '2K' | '4K') => {
  return null; 
};

export const editImageWithAI = async (imageBase64: string, prompt: string) => {
   return null; 
};
