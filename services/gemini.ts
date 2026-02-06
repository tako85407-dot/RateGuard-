
import { GoogleGenAI, Type } from "@google/genai";

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

  if (textToAnalyze && textToAnalyze.length > 0) {
    contentsPayload.parts.push({ 
      text: `Here is the OCR text transcript of a bank wire or FX trade receipt:
      
      """
      ${textToAnalyze}
      """

      Analyze this text. Extract the following details into JSON: bank (name of institution), pair (e.g. USD/EUR), amount (transaction principal), exchangeRate (executed rate), valueDate (settlement date), and fees (array of objects with name and amount). If details are missing, infer from context or leave reasonable defaults.` 
    });
  } else {
    // Fallback to Gemini Vision if DeepSeek text is empty
    // IMPORTANT: Use the correct mimeType (e.g., application/pdf) so Gemini doesn't error with INVALID_ARGUMENT
    contentsPayload.parts.push({ inlineData: { mimeType: mimeType, data: base64 } });
    contentsPayload.parts.push({ text: "Analyze this bank wire confirmation or FX trade receipt. Extract the following details into JSON: bank (name of institution), pair (e.g. USD/EUR), amount (transaction principal), exchangeRate (executed rate), valueDate (settlement date), and fees (array of objects with name and amount)." });
  }

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: contentsPayload,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          bank: { type: Type.STRING },
          pair: { type: Type.STRING },
          amount: { type: Type.NUMBER },
          exchangeRate: { type: Type.NUMBER },
          valueDate: { type: Type.STRING },
          fees: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                amount: { type: Type.NUMBER }
              }
            }
          }
        },
        required: ["bank", "pair", "amount", "exchangeRate"]
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
