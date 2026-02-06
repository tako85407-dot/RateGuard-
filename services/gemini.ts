import { GoogleGenAI, Type, Schema } from "@google/genai";

const getAI = () => {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.API_KEY || '';
  if (!apiKey) {
    console.warn("Gemini API Key is missing.");
  }
  return new GoogleGenAI({ apiKey });
};

const getDeepSeekKey = () => {
  return process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY || '';
};

// Function to perform OCR using DeepSeek
const performDeepSeekOCR = async (base64: string, mimeType: string): Promise<string> => {
  const apiKey = getDeepSeekKey();
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is missing. Cannot perform OCR.");
  }

  // Construct Data URL with correct mime type
  const dataUrl = `data:${mimeType};base64,${base64}`;

  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat", 
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Please transcribe all text visible in this document verbatim. Do not summarize, just output the raw text found." },
              {
                type: "image_url",
                image_url: {
                  url: dataUrl
                }
              }
            ]
          }
        ],
        stream: false
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("DeepSeek OCR Error:", err);
      throw new Error(`DeepSeek API Error: ${response.status}`);
    }

    const data = await response.json();
    const ocrText = data.choices?.[0]?.message?.content || "";
    return ocrText;

  } catch (error) {
    console.error("DeepSeek Request Failed", error);
    throw error;
  }
};

const RATEGUARD_SYSTEM_INSTRUCTION = `You are RateGuard FX Analyzer, a specialized financial document analysis system. Your job is to extract and calculate FX transaction data with 100% accuracy.

## CRITICAL RULES - NEVER VIOLATE

1. **FEE CALCULATION**: Only sum fees EXPLICITLY listed in the document. Never invent or estimate fees.
   - If document shows: Wire Fee $35 + FX Fee $125 + Correspondent Fee $20
   - Total fees = $35 + $125 + $20 = $180
   - NEVER say $1,100 or any other number

2. **CURRENCY PAIR IDENTIFICATION**:
   - From: Original Amount currency (e.g., USD)
   - To: Converted Amount currency (e.g., EUR)
   - Format: ALWAYS as XXX/YYY (e.g., USD/EUR)

3. **EXCHANGE RATE ANALYSIS**:
   - Bank Rate = rate shown in document
   - Mid-Market Rate = you lookup current rate for timestamp (estimate closely if precise data unavailable)
   - Spread % = ((Bank Rate - Mid-Market Rate) / Mid-Market Rate) × 100
   - If Bank Rate < Mid-Market Rate (rare), spread is negative (bank gave better rate)

4. **AMOUNT EXTRACTION**:
   - Original Amount: Amount BEFORE conversion (e.g., $50,000.00 USD)
   - Converted Amount: Amount AFTER conversion (e.g., €45,600.00 EUR)
   - Never confuse these

## CALCULATION STEPS - FOLLOW EXACTLY

Step 1: Extract all raw data from document (amounts, rates, fees)
Step 2: Verify fee total matches sum of line items
Step 3: Lookup mid-market rate for exact timestamp
Step 4: Calculate spread % using formula
Step 5: Calculate spread cost in original currency
Step 6: Add fees to get total transaction cost
Step 7: Annualize if regular transaction pattern detected
Step 8: Generate dispute recommendation with specific rate target

## SPECIAL CASES

**If fees section is unclear or missing:**
- Set fees.items to empty array []
- Set total_fees to 0.00
- Add note: "Fees not clearly itemized in document"

**If exchange rate is missing:**
- Calculate from Original ÷ Converted amounts
- Add note: "Rate calculated from amounts, not explicitly stated"
`;

export const extractQuoteData = async (base64: string, mimeType: string = 'image/jpeg') => {
  // 1. Enforce 1 second delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  let textToAnalyze = "";

  try {
    // 2. Perform OCR with DeepSeek
    console.log(`Starting DeepSeek OCR for ${mimeType}...`);
    textToAnalyze = await performDeepSeekOCR(base64, mimeType);
    console.log("DeepSeek OCR Result length:", textToAnalyze.length);
  } catch (error) {
    console.warn("DeepSeek OCR failed, falling back to Gemini Vision direct processing.", error);
    textToAnalyze = ""; 
  }

  // 3. Send to Gemini for JSON Extraction
  const ai = getAI();
  const contentsPayload: any = { parts: [] };

  const promptText = textToAnalyze 
    ? `Here is the OCR text transcript of a bank wire or FX trade receipt:
      
      """
      ${textToAnalyze}
      """

      Analyze this text using the RateGuard FX Analyzer rules.`
    : `Analyze this bank wire confirmation or FX trade receipt image using the RateGuard FX Analyzer rules.`;

  if (textToAnalyze) {
    contentsPayload.parts.push({ text: promptText });
  } else {
    // Fallback to Gemini Vision if DeepSeek text is empty
    contentsPayload.parts.push({ inlineData: { mimeType: mimeType, data: base64 } });
    contentsPayload.parts.push({ text: promptText });
  }

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: contentsPayload,
    config: {
      systemInstruction: RATEGUARD_SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          extraction: {
            type: Type.OBJECT,
            properties: {
              bank_name: { type: Type.STRING },
              transaction_date: { type: Type.STRING },
              transaction_time: { type: Type.STRING },
              reference_number: { type: Type.STRING },
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
            },
            required: ["original_amount", "exchange_rate_bank", "currency_pair"]
          },
          fees: {
            type: Type.OBJECT,
            properties: {
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    type: { type: Type.STRING },
                    amount: { type: Type.NUMBER },
                    currency: { type: Type.STRING }
                  }
                }
              },
              total_fees: { type: Type.NUMBER },
              total_fees_currency: { type: Type.STRING }
            }
          },
          analysis: {
            type: Type.OBJECT,
            properties: {
              mid_market_rate: { type: Type.NUMBER },
              bank_spread_percentage: { type: Type.NUMBER },
              cost_of_spread_usd: { type: Type.NUMBER },
              total_cost_usd: { type: Type.NUMBER }
            }
          },
          dispute: {
            type: Type.OBJECT,
            properties: {
              recommended: { type: Type.BOOLEAN },
              reason: { type: Type.STRING },
              suggested_rate_negotiation: { type: Type.NUMBER },
              potential_annual_savings: { type: Type.NUMBER }
            }
          },
          verification: {
            type: Type.OBJECT,
            properties: {
              completeness_score: { type: Type.STRING }
            }
          }
        }
      }
    }
  });

  return JSON.parse(response.text || '{}');
};

export const chatWithAtlas = async (message: string, history: {role: string, parts: {text: string}[]}[] = []) => {
  const ai = getAI();
  const chat = ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction: "You are Atlas, a specialized FX Treasury AI assistant for RateGuard. You help CFOs and Controllers understand bank spreads, mid-market rates, correspondent fees, and currency hedging strategies. You are aggressive about saving money on hidden bank markups."
    },
    history: history
  });

  const response = await chat.sendMessage({ message });
  return response.text;
};

export const editImageWithAI = async (imageBase64: string, prompt: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { inlineData: { data: imageBase64, mimeType: 'image/jpeg' } },
        { text: prompt }
      ]
    }
  });

  if (response.candidates?.[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
  }
  return null;
};

export const generateImageWithAI = async (prompt: string, size: '1K' | '2K' | '4K') => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: {
      parts: [{ text: prompt }]
    },
    config: {
      imageConfig: {
        aspectRatio: "1:1",
        imageSize: size
      }
    }
  });

  if (response.candidates?.[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
  }
  return null;
};