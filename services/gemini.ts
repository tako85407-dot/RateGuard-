import { GoogleGenAI, Type } from "@google/genai";

// --- CONFIGURATION ---

const getEnv = (key: string) => {
  // Check process.env (Vercel/Node)
  if (typeof process !== 'undefined' && process.env) {
    return process.env[`VITE_${key}`] || 
           process.env[`NEXT_PUBLIC_${key}`] || 
           process.env[key] || 
           '';
  }
  // Check import.meta.env (Vite)
  if (import.meta && import.meta.env) {
    return import.meta.env[`VITE_${key}`] || 
           import.meta.env[`NEXT_PUBLIC_${key}`] || 
           import.meta.env[key] || 
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
Never mention internal model names. Always refer to yourself as "Atlas".`;

const EXTRACTION_INSTRUCTION = `You are RateGuard's Logic Engine. Your goal is to convert raw OCR text from a bank document into structured JSON.

## CRITICAL RULES
1. **FEE CALCULATION**: Only sum fees EXPLICITLY listed.
2. **CURRENCY PAIR**: Format as XXX/YYY (e.g. USD/EUR).
3. **SPREAD CALCULATION**: 
   - If mid-market rate is provided in context, use it. 
   - Otherwise, estimate based on the provided 'value_date' and standard historical rates for that pair.
   - Calculate 'markup_cost' = (Bank Rate vs Mid-Market Rate diff) * Amount.

## OUTPUT JSON SCHEMA
Return strictly JSON. No markdown blocking.`;

// Defined extraction schema for better reliability
const EXTRACTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    extraction: {
      type: Type.OBJECT,
      properties: {
        bank_name: { type: Type.STRING },
        transaction_date: { type: Type.STRING },
        sender_name: { type: Type.STRING },
        beneficiary_name: { type: Type.STRING }
      },
      required: ["bank_name"]
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
    },
    analysis: {
      type: Type.OBJECT,
      properties: {
        mid_market_rate: { type: Type.NUMBER },
        cost_of_spread_usd: { type: Type.NUMBER },
        total_cost_usd: { type: Type.NUMBER }
      }
    },
    dispute: {
      type: Type.OBJECT,
      properties: {
        recommended: { type: Type.BOOLEAN },
        reason: { type: Type.STRING }
      }
    }
  },
  required: ["extraction", "transaction", "analysis"]
};

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

    if (!response.ok) {
       // Handle CORS or API errors gracefully by throwing
       throw new Error(`ZHIPU_API_ERROR: ${response.status}`);
    }
    
    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  } catch (error) {
    console.warn("GLM-4V OCR Failed or CORS blocked, falling back to Gemini Vision.", error);
    throw new Error("ZHIPU_FAILED");
  }
};

// --- GEMINI VISION (OCR FALLBACK) ---
const performOCRWithGemini = async (base64Image: string, mimeType: string): Promise<string> => {
  const apiKey = getGeminiKey();
  if (!apiKey) throw new Error("Gemini API Key is missing.");

  const ai = new GoogleGenAI({ apiKey });
  
  try {
    // Using gemini-3-flash-preview for speed in fallback
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { text: "Transcribe all text and numbers from this financial document exactly as they appear. Return only the text. If there are tables, preserve the row/column structure." },
          { inlineData: { mimeType, data: base64Image } }
        ]
      }
    });
    return response.text || "";
  } catch (error) {
    console.error("Gemini Vision Failed:", error);
    throw new Error("Atlas Vision Sensors Failed. Please ensure the image is clear.");
  }
};

// --- GEMINI ANALYSIS (LOGIC) ---
const analyzeTextWithGemini = async (ocrText: string): Promise<any> => {
  const apiKey = getGeminiKey();
  if (!apiKey) throw new Error("Gemini API Key is missing.");
  
  const ai = new GoogleGenAI({ apiKey });

  try {
    // Using gemini-3-pro-preview for complex reasoning and JSON extraction
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Here is the raw text extracted from the document:\n\n${ocrText}`,
      config: {
        systemInstruction: EXTRACTION_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: EXTRACTION_SCHEMA,
        temperature: 0.1,
      }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("Empty response from Logic Engine.");
    return JSON.parse(jsonText.trim());

  } catch (error) {
    console.error("Gemini Analysis Failed:", error);
    throw new Error("Atlas Logic Core Failed.");
  }
};

// --- MAIN PIPELINE ---
export const extractQuoteData = async (base64: string, mimeType: string = 'image/jpeg') => {
  let rawText = "";

  // 1. Try GLM-4V first (if key exists)
  try {
     rawText = await performOCRWithGLM(base64);
  } catch (e: any) {
     // 2. Fallback to Gemini Vision
     console.log("Switching to Gemini Vision pipeline...");
     rawText = await performOCRWithGemini(base64, mimeType);
  }
  
  if (!rawText || rawText.length < 10) {
    throw new Error("Document appeared empty or unreadable.");
  }

  // 3. Structured Analysis
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
      model: 'gemini-3-flash-preview',
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
  const apiKey = getGeminiKey();
  if (!apiKey) throw new Error("Gemini API Key is missing.");

  const ai = new GoogleGenAI({ apiKey });
  const model = (size === '2K' || size === '4K') ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
  
  try {
    const response = await ai.models.generateContent({
      model,
      contents: { parts: [{ text: prompt }] },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
          ...(model === 'gemini-3-pro-image-preview' ? { imageSize: size } : {})
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Image Generation Failed:", error);
    throw error;
  }
};

// --- IMAGE EDITING ---
export const editImageWithAI = async (imageBase64: string, prompt: string) => {
  const apiKey = getGeminiKey();
  if (!apiKey) throw new Error("Gemini API Key is missing.");
  
  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { data: imageBase64, mimeType: 'image/jpeg' } },
          { text: prompt }
        ]
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Image Editing Failed:", error);
    throw error;
  }
};