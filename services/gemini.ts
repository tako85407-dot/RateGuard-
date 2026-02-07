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
              { 
                type: "text", 
                text: `EXTRACT EVERYTHING. 
                
                I need a verbatim transcription of every single piece of text, number, code, address, and table found in this document. 
                Do not summarize. Do not skip "irrelevant" parts. 
                If there is a table, transcribe every row and column.
                If there are small print terms, transcribe them.
                
                After the transcription, specifically list out any Fees, Taxes, or Surcharges found in a list format.` 
              },
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

const RATEGUARD_SYSTEM_INSTRUCTION = `You are RateGuard FX Analyzer, a specialized financial document analysis system. Your job is to extract and calculate FX transaction data with 100% accuracy based on the provided text.

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
   - Mid-Market Rate = you lookup current rate for timestamp
   - Spread % = ((Bank Rate - Mid-Market Rate) / Mid-Market Rate) × 100
   - If Bank Rate < Mid-Market Rate (rare), spread is negative (bank gave better rate)

4. **AMOUNT EXTRACTION**:
   - Original Amount: Amount BEFORE conversion (e.g., $50,000.00 USD)
   - Converted Amount: Amount AFTER conversion (e.g., €45,600.00 EUR)
   - Never confuse these

## OUTPUT FORMAT - STRICT JSON

{
  "extraction": {
    "bank_name": "JPMORGAN CHASE BANK, N.A.",
    "transaction_date": "2024-01-15",
    "transaction_time": "09:23:47 EST",
    "reference_number": "WT-2024-0115-78432",
    "sender_name": "ACME IMPORT EXPORT LLC",
    "sender_account_masked": "****4521",
    "beneficiary_name": "EURO SUPPLIERS GMBH",
    "beneficiary_bank": "DEUTSCHE BANK AG, FRANKFURT",
    "swift_bic": "DEUTDEFFXXX",
    "iban": "DE89370400440532013000"
  },
  "transaction": {
    "original_amount": 50000.00,
    "original_currency": "USD",
    "converted_amount": 45600.00,
    "converted_currency": "EUR",
    "exchange_rate_bank": 0.9120,
    "currency_pair": "USD/EUR",
    "value_date": "2024-01-15"
  },
  "fees": {
    "items": [
      {
        "type": "Wire Transfer Fee",
        "amount": 35.00,
        "currency": "USD"
      },
      {
        "type": "Foreign Exchange Fee",
        "amount": 125.00,
        "currency": "USD",
        "percentage": "0.25%"
      },
      {
        "type": "Correspondent Bank Fee",
        "amount": 20.00,
        "currency": "USD"
      }
    ],
    "total_fees": 180.00,
    "total_fees_currency": "USD",
    "fee_calculation_verified": "35.00 + 125.00 + 20.00 = 180.00"
  },
  "analysis": {
    "mid_market_rate": 0.9250,
    "rate_source": "XE.com historical for 2024-01-15 09:23 EST",
    "bank_spread_percentage": 1.405,
    "bank_spread_calculation": "((0.9250 - 0.9120) / 0.9250) × 100 = 1.405%",
    "cost_of_spread_usd": 703.13,
    "cost_of_spread_calculation": "50000 × (0.9250 - 0.9120) / 0.9250 = 703.13",
    "total_cost_usd": 883.13,
    "total_cost_breakdown": "Spread cost $703.13 + Fees $180.00 = $883.13",
    "annualized_cost_if_monthly": 10597.56,
    "annualized_calculation": "883.13 × 12 = 10597.56"
  },
  "dispute": {
    "recommended": true,
    "reason": "Spread 1.405% above mid-market is above typical 0.5-1.0% for this volume",
    "suggested_rate_negotiation": 0.9180,
    "potential_annual_savings": 4239.02
  },
  "verification": {
    "math_check": "45600 EUR ÷ 50000 USD = 0.9120 ✓ Matches document rate",
    "fee_check": "35 + 125 + 20 = 180 ✓ Matches document total",
    "completeness_score": "10/10 - All fields extracted"
  }
}

## CALCULATION STEPS - FOLLOW EXACTLY

Step 1: Extract all raw data from document (amounts, rates, fees)
Step 2: Verify fee total matches sum of line items
Step 3: Lookup mid-market rate for exact timestamp
Step 4: Calculate spread % using formula
Step 5: Calculate spread cost in original currency
Step 6: Add fees to get total transaction cost
Step 7: Annualize if regular transaction pattern detected
Step 8: Generate dispute recommendation with specific rate target

## ERROR PREVENTION CHECKLIST

Before outputting, verify:
- [ ] Fee total = sum of individual fees (not inflated)
- [ ] Currency pair direction is correct (From/To)
- [ ] Exchange rate matches document exactly
- [ ] All percentages calculated correctly
- [ ] Annualized figures use correct multiplier

## SPECIAL CASES

**If fees section is unclear or missing:**
- Set fees.items to empty array []
- Set total_fees to 0.00
- Add note: "Fees not clearly itemized in document"

**If exchange rate is missing:**
- Calculate from Original ÷ Converted amounts
- Add note: "Rate calculated from amounts, not explicitly stated"

**If document is not an FX transaction:**
- Return error object: {"error": "Not an FX transaction", "document_type": "detected_type"}
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

  // 3. Send to Gemini for JSON Extraction (Gemini 2.0 Flash Exp for Thinking)
  const ai = getAI();
  const contentsPayload: any = { parts: [] };

  const promptText = textToAnalyze 
    ? `Here is the full verbatim extraction of a bank wire or FX trade receipt provided by DeepSeek OCR:
      
      """
      ${textToAnalyze}
      """

      You are the "Brain" of RateGuard. Analyze this raw text. 
      Map every single finding into the JSON schema. 
      Use your reasoning to calculate spreads and totals.`
    : `Analyze this bank wire confirmation or FX trade receipt image using the RateGuard FX Analyzer rules.`;

  if (textToAnalyze) {
    contentsPayload.parts.push({ text: promptText });
  } else {
    // Fallback to Gemini Vision if DeepSeek text is empty
    contentsPayload.parts.push({ inlineData: { mimeType: mimeType, data: base64 } });
    contentsPayload.parts.push({ text: promptText });
  }

  // UPDATED MODEL: Using gemini-2.0-flash-exp as 2.5-flash-latest was not found
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: contentsPayload,
    config: {
      systemInstruction: RATEGUARD_SYSTEM_INSTRUCTION,
      thinkingConfig: { thinkingBudget: 2048 }, // Enable Thinking for complex analysis
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
              sender_account_masked: { type: Type.STRING },
              beneficiary_name: { type: Type.STRING },
              beneficiary_bank: { type: Type.STRING },
              swift_bic: { type: Type.STRING },
              iban: { type: Type.STRING }
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
                    currency: { type: Type.STRING },
                    percentage: { type: Type.STRING }
                  }
                }
              },
              total_fees: { type: Type.NUMBER },
              total_fees_currency: { type: Type.STRING },
              fee_calculation_verified: { type: Type.STRING }
            }
          },
          analysis: {
            type: Type.OBJECT,
            properties: {
              mid_market_rate: { type: Type.NUMBER },
              rate_source: { type: Type.STRING },
              bank_spread_percentage: { type: Type.NUMBER },
              bank_spread_calculation: { type: Type.STRING },
              cost_of_spread_usd: { type: Type.NUMBER },
              cost_of_spread_calculation: { type: Type.STRING },
              total_cost_usd: { type: Type.NUMBER },
              total_cost_breakdown: { type: Type.STRING },
              annualized_cost_if_monthly: { type: Type.NUMBER },
              annualized_calculation: { type: Type.STRING }
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
              math_check: { type: Type.STRING },
              fee_check: { type: Type.STRING },
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
    model: 'gemini-2.0-flash-exp', // Updated to 2.0-flash-exp
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
  // Using gemini-2.5-flash-image as requested
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [{ text: prompt }]
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