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

const extractFeesWithRegex = (text: string) => {
  const fees = { wire: 0, fx: 0, correspondent: 0, total: 0 };
  const allAmounts = [...text.matchAll(/\$(\d{1,3}(,\d{3})*(\.\d{2})?)/g)]
    .map(m => parseFloat(m[1].replace(/,/g, '')));

  const wireMatch = text.match(/Wire[^$]*\$(\d[\d,]*\.?\d*)/i);
  const fxMatch = text.match(/(Foreign Exchange|FX)[^$]*\$(\d[\d,]*\.?\d*)/i);
  const corrMatch = text.match(/Correspondent[^$]*\$(\d[\d,]*\.?\d*)/i);
  const totalMatch = text.match(/Total Fees[^$]*\$(\d[\d,]*\.?\d*)/i);

  if (wireMatch) fees.wire = parseFloat(wireMatch[1].replace(/,/g, ''));
  if (fxMatch) fees.fx = parseFloat(fxMatch[1].replace(/,/g, ''));
  if (corrMatch) fees.correspondent = parseFloat(corrMatch[1].replace(/,/g, ''));
  if (totalMatch) fees.total = parseFloat(totalMatch[1].replace(/,/g, ''));

  const calculatedSum = fees.wire + fees.fx + fees.correspondent;
  if (fees.total === 0 || Math.abs(fees.total - calculatedSum) > 0.01) {
    if (allAmounts.length >= 4 && fees.total === 0) {
       fees.total = Math.max(...allAmounts);
    } else {
       fees.total = calculatedSum;
    }
  }
  return fees;
};

// --- SYSTEM INSTRUCTIONS ---

const ATLAS_PERSONA = `You are the RateGuard Data Auditor. Your task is to extract bank confirmation data into a strict JSON format.`;

const EXTRACTION_INSTRUCTION = `You are the RateGuard Data Auditor. Your task is to extract bank confirmation data into a strict JSON format based on the provided schema.

## CRITICAL RULES:
1. Return ONLY the JSON object. No markdown, no 'Here is your data', no backticks.
2. Convert all amounts to FLOATS (e.g., 125000.00). Remove currency symbols ($) and commas.
3. If a field is missing, use null or 0.
4. Double-check the FX Rate; ensure it is a number.

## FIELD MAPPING:
- "tx_ref" (Transaction Reference) -> extraction.transaction_reference
- "sender" (Account Name) -> extraction.sender_name
- "recipient" (Beneficiary Name) -> extraction.beneficiary_name
- "amount_usd" (Original Amount) -> transaction.original_amount
- "fx_rate" (Exchange Rate) -> transaction.exchange_rate_bank
- "total_fees" (Sum of all fees) -> fees.total_fees

## ANALYSIS LOGIC:
- You must also calculate the spread cost ('analysis.cost_of_spread_usd') based on the extracted 'exchange_rate_bank' vs the 'mid_market_rate'.
`;

// Relaxed extraction schema (removed required fields to prevent Gemini validation errors)
const EXTRACTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    extraction: {
      type: Type.OBJECT,
      properties: {
        transaction_reference: { type: Type.STRING }, // Mapped from tx_ref
        bank_name: { type: Type.STRING },
        transaction_date: { type: Type.STRING },
        sender_name: { type: Type.STRING },
        beneficiary_name: { type: Type.STRING }
      },
      // No required fields
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
  }
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
  const regexHints = extractFeesWithRegex(cleanedText);

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `
      Data:
      ${cleanedText}
      
      Hints:
      Total Fees: $${regexHints.total}
      
      Instructions:
      Extract fields based on schema. Use 0 or null if missing.
      `,
      config: {
        systemInstruction: EXTRACTION_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: EXTRACTION_SCHEMA,
        temperature: 0.1,
      }
    });

    const cleanJson = cleanJsonOutput(response.text || "{}");
    return JSON.parse(cleanJson);

  } catch (error) {
    console.error("Gemini Analysis Failed:", error);
    // Return a partial object so the app doesn't crash completely
    return {
      extraction: { bank_name: "Unidentified Bank" },
      transaction: { amount: 0, currency_pair: "USD/EUR" },
      fees: { items: [], total_fees: regexHints.total },
      analysis: { total_cost_usd: 0 },
      dispute: { recommended: false }
    };
  }
};

// --- MAIN PIPELINE ---
export const extractQuoteData = async (base64: string, mimeType: string = 'image/jpeg') => {
  let rawText = "";

  try {
     rawText = await performOCRWithGLM(base64);
  } catch (e: any) {
     console.log("Switching to Gemini Vision pipeline...");
     rawText = await performOCRWithGemini(base64, mimeType);
  }
  
  if (!rawText || rawText.length < 5) {
    // If OCR fails completely, return a dummy object to allow manual entry (or let UI handle error)
    throw new Error("Document appeared empty or unreadable.");
  }

  const structuredData = await analyzeTextWithGemini(rawText);
  return structuredData;
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