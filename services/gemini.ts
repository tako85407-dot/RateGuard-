import { GoogleGenAI, Type } from "@google/genai";

// --- CONFIGURATION ---

const getEnv = (key: string) => {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[`VITE_${key}`] || 
           process.env[`NEXT_PUBLIC_${key}`] || 
           process.env[key] || 
           '';
  }
  return '';
};

const getZhipuKey = () => getEnv('ZHIPUAI_API_KEY');

// --- TEXT PRE-PROCESSING (ROBUSTNESS LAYER) ---

const cleanOcrText = (text: string): string => {
  return text
    // Fix common header separators
    .replace(/═+/g, '---')
    .replace(/_+/g, '---')
    // Fix multiple spaces
    .replace(/\s{3,}/g, '\n')
    // Fix specific Chase/Bank merged line headers
    .replace(/(Wire Transfer Fee:\s+)(Foreign Exchange Fee:)/g, '$1\n$2')
    // Fix merged dollar amounts (e.g. "$35.00 $125.00")
    .replace(/(\$\d+[\d,]*\.?\d*)\s+(\$\d+[\d,]*\.?\d*)/g, '$1\n$2')
    // Fix "Fee: $Amount" spacing issues
    .replace(/(Fee:)(\s*)(\$\d)/gi, '$1 $3')
    // Fix trailing percentages merged with amounts (e.g. "$125.00(0.25%)")
    .replace(/(\$\d+\.\d+)(\()/g, '$1 $2')
    .trim();
};

const extractFeesWithRegex = (text: string) => {
  const fees = {
    wire: 0,
    fx: 0,
    correspondent: 0,
    total: 0
  };

  // Extract all dollar amounts in the text to find candidates
  const allAmounts = [...text.matchAll(/\$(\d{1,3}(,\d{3})*(\.\d{2})?)/g)]
    .map(m => parseFloat(m[1].replace(/,/g, '')));

  // Specific Pattern Matching
  const wireMatch = text.match(/Wire[^$]*\$(\d[\d,]*\.?\d*)/i);
  const fxMatch = text.match(/(Foreign Exchange|FX)[^$]*\$(\d[\d,]*\.?\d*)/i);
  const corrMatch = text.match(/Correspondent[^$]*\$(\d[\d,]*\.?\d*)/i);
  const totalMatch = text.match(/Total Fees[^$]*\$(\d[\d,]*\.?\d*)/i);

  if (wireMatch) fees.wire = parseFloat(wireMatch[1].replace(/,/g, ''));
  if (fxMatch) fees.fx = parseFloat(fxMatch[1].replace(/,/g, ''));
  if (corrMatch) fees.correspondent = parseFloat(corrMatch[1].replace(/,/g, ''));
  if (totalMatch) fees.total = parseFloat(totalMatch[1].replace(/,/g, ''));

  // Logic: If we found individual fees but no total, or total doesn't match, calculate sum
  const calculatedSum = fees.wire + fees.fx + fees.correspondent;
  if (fees.total === 0 || Math.abs(fees.total - calculatedSum) > 0.01) {
    // If we have at least 3 amounts and the logic seems to be "List then Total"
    if (allAmounts.length >= 4 && fees.total === 0) {
       // Chase often lists: Wire, FX, Corr, Total. 
       // If regex failed but we have a cluster of numbers, take the largest as total
       fees.total = Math.max(...allAmounts);
    } else {
       fees.total = calculatedSum;
    }
  }

  return fees;
};

// --- SYSTEM INSTRUCTIONS ---

const ATLAS_PERSONA = `You are Atlas, the central intelligence node for RateGuard. 
You assist Finance teams in analyzing bank wires, detecting hidden spreads, and negotiating better FX rates.
You are professional, concise, and focused on saving the user money.
Never mention internal model names. Always refer to yourself as "Atlas".`;

const EXTRACTION_INSTRUCTION = `You are RateGuard's Logic Engine. Your goal is to convert raw OCR text from a bank document into structured JSON.

## CRITICAL: HANDLING CORRUPTED OCR
The input text may have merged lines or missing line breaks (e.g., "Wire Fee: $35.00 Foreign Exchange Fee: $125.00").
You must intelligently separate these fields based on context.

## EXTRACTION RULES
1. **FEE LOGIC**: 
   - Look for specific fees: "Wire Transfer", "Foreign Exchange" (FX), "Correspondent".
   - If a line contains two dollar amounts (e.g. "$35.00 $125.00"), the first is likely the Wire Fee, the second is the FX Fee.
   - Use the "HINTS" provided in the prompt to validate your findings.
2. **CURRENCY PAIR**: Format as XXX/YYY (e.g. USD/EUR).
3. **SPREAD CALCULATION**: 
   - If 'mid_market_rate' is NOT in document, estimate it based on the 'value_date'.
   - Calculate 'markup_cost' = (Bank Rate vs Mid-Market Rate diff) * Amount.
   - 'total_cost_usd' should include explicit fees + markup cost.

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
  // Using direct process.env.API_KEY as per guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
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
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // 1. Clean the text using Regex rules
  const cleanedText = cleanOcrText(ocrText);
  
  // 2. Pre-calculate fees to give hints to the model
  const regexHints = extractFeesWithRegex(cleanedText);

  try {
    // Using gemini-3-pro-preview for complex reasoning and JSON extraction
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `
      Here is the processed text extracted from the document:
      ---------------------------------------------------
      ${cleanedText}
      ---------------------------------------------------

      HINTS (REGEX EXTRACTION):
      - Likely Wire Fee: $${regexHints.wire}
      - Likely FX Fee: $${regexHints.fx}
      - Likely Correspondent Fee: $${regexHints.correspondent}
      - Likely Total Fees: $${regexHints.total}

      INSTRUCTIONS:
      Use the cleaned text as the primary source. Use the HINTS to verify or correct if the text is ambiguous.
      Return the data strictly fitting the schema.
      `,
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

  // 3. Structured Analysis with Robust Cleaning
  const structuredData = await analyzeTextWithGemini(rawText);
  return structuredData;
};

// --- SUPPORT CHAT (Gemini) ---
export const chatWithAtlas = async (message: string, history: {role: string, parts: {text: string}[]}[] = []) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    // Using gemini-3-flash-preview for general support/Q&A
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
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
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