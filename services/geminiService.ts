import { ReceiptData } from "../types";
import { GoogleGenAI } from "@google/genai";

// Em um ambiente puramente client-side (Vite) sem backend, a chave deve vir do usuário ou de env.
// ATENÇÃO: Em produção real com muitos usuários, isso deve ser um proxy.
// Para este App Pessoal (Local First), ler do LocalStorage é aceitável.

export const IS_AI_ENABLED = true;

const getApiKey = () => {
  // 1. Tenta pegar do LocalStorage (definido pelo usuário)
  const userKey = localStorage.getItem('dividi_gemini_key');
  if (userKey) return userKey;
  
  // 2. Fallback para env var de desenvolvimento
  return (import.meta as any).env?.VITE_GOOGLE_API_KEY;
};

export const analyzeReceipt = async (base64Image: string): Promise<ReceiptData> => {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    throw new Error("API Key do Google Gemini não configurada. Adicione nas configurações do perfil.");
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    // Prompt otimizado para extração de recibos
    const prompt = `
      Analyze this receipt image and extract the following data in JSON format:
      - total (number)
      - date (ISO string YYYY-MM-DD)
      - merchant (string name)
      - category (one of: food, transport, accommodation, entertainment, utilities, other)
      - itemsList (array of objects with name, price, quantity)
      - drinkTotal (sum of alcoholic beverages if any, otherwise 0)
      - foodTotal (sum of food items)
      
      Return ONLY raw JSON, no markdown formatting.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-latest', // Modelo rápido e eficiente
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: prompt }
        ]
      }
    });

    const text = response.text;
    
    // Limpeza básica caso o modelo retorne markdown ```json ... ```
    const cleanText = text?.replace(/```json/g, '').replace(/```/g, '').trim();
    
    if (!cleanText) throw new Error("Empty response from AI");

    const data = JSON.parse(cleanText);
    return data as ReceiptData;

  } catch (err: any) {
    console.error("Gemini Service Error:", err);
    if (err.message.includes('API Key')) throw err;
    throw new Error("Falha ao analisar recibo. Verifique a imagem ou tente novamente.");
  }
};