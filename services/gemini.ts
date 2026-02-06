
import { GoogleGenAI, Type } from "@google/genai";

const getAI = () => {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.API_KEY || '';
  if (!apiKey) {
    console.warn("Gemini API Key is missing.");
  }
  return new GoogleGenAI({ apiKey });
};

export const extractQuoteData = async (imageBase64: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
        { text: "Analyze this bank wire confirmation or FX trade receipt. Extract the following details into JSON: bank (name of institution), pair (e.g. USD/EUR), amount (transaction principal), exchangeRate (executed rate), valueDate (settlement date), and fees (array of objects with name and amount). If details are missing, infer from context or leave reasonable defaults." }
      ]
    },
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
