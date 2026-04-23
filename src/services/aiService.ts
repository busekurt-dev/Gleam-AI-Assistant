import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import products from "../products.json";

export interface UserProfile {
  likedCategories: string[];
  pastPurchases: string[];
  preferredBrands: string[];
  budgetSensitivity: 'Düşük' | 'Orta' | 'Yüksek';
}

export interface ComparisonResult {
  recommendations: {
    id: string;
    productName: string;
    reasoning: string;
    personalizedReasoning: string;
    pricePerformanceScore: number;
    confidenceScore: number;
    technicalHighlight: string;
    // Fields for web results (AI sourced)
    price?: number;
    category?: string;
    specs?: Record<string, string>;
    description?: string;
    marketPrices?: {
      mediamarkt?: { price: number };
      vatan?: { price: number };
      teknosa?: { price: number };
    };
  }[];
  analysis: string;
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function getSmartRecommendations(query: string, profile?: UserProfile, excludeIds: string[] = []): Promise<ComparisonResult> {
  try {
    const context = JSON.stringify(products);
    const profileContext = profile ? `\n\nKullanıcı Profili:\n${JSON.stringify(profile)}` : "";
    const exclusionContext = excludeIds.length > 0 ? `\n\nÖNEMLİ: Bu ID'lere sahip ürünleri daha önce önerdin, lütfen bunlardan FARKLI 3 yeni ürün seç: ${excludeIds.join(", ")}` : "";
    
    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Sorgu: "${query}"${profileContext}${exclusionContext}\nKatalog: ${context}`,
      config: {
        tools: [{ googleSearch: {} }],
        toolConfig: { includeServerSideToolInvocations: true },
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        systemInstruction: `Hızlı pazar analiz uzmanısın. Katalog ve Google Search kullanarak en iyi 3 teknoloji ürününü bul.
        
        Kurallar:
        - Katalogda varsa önceliklendir, yoksa en güncel pazar verilerini getir.
        - Farklı 3 ürün seç. Boş dönme.
        - Specs alanını gerçeğe uygun doldur (İşlemci, Ekran vb.).
        - ID Formatı: Katalog ID veya web_result_AD.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recommendations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  productName: { type: Type.STRING },
                  reasoning: { type: Type.STRING },
                  personalizedReasoning: { type: Type.STRING },
                  pricePerformanceScore: { type: Type.NUMBER },
                  confidenceScore: { type: Type.NUMBER },
                  technicalHighlight: { type: Type.STRING },
                  price: { type: Type.NUMBER },
                  category: { type: Type.STRING },
                  specs: { 
                    type: Type.OBJECT, 
                    additionalProperties: { type: Type.STRING }
                  },
                  description: { type: Type.STRING },
                  marketPrices: {
                    type: Type.OBJECT,
                    properties: {
                      mediamarkt: { type: Type.OBJECT, properties: { price: { type: Type.NUMBER } } },
                      vatan: { type: Type.OBJECT, properties: { price: { type: Type.NUMBER } } },
                      teknosa: { type: Type.OBJECT, properties: { price: { type: Type.NUMBER } } }
                    }
                  }
                },
                required: ["id", "productName", "reasoning", "personalizedReasoning", "pricePerformanceScore", "confidenceScore", "technicalHighlight"]
              }
            },
            analysis: { type: Type.STRING }
          },
          required: ["recommendations", "analysis"]
        }
      }
    });

    const responseText = result.text || "";
    if (!responseText) {
      throw new Error("Yapay zeka yanıt vermedi. Lütfen tekrar deneyin.");
    }

    // Clean any prefix text often added by models
    let jsonContent = responseText.trim();
    if (jsonContent.includes('{')) {
      jsonContent = jsonContent.substring(jsonContent.indexOf('{'), jsonContent.lastIndexOf('}') + 1);
    }
    
    // Clean markdown blocks
    const cleanedText = jsonContent.replace(/```json\n?|\n?```/g, '').trim();
    const parsedData = JSON.parse(cleanedText);

    if (!parsedData.recommendations || !Array.isArray(parsedData.recommendations)) {
      throw new Error("Gelen verilerde bir sorun oluştu. Lütfen tekrar tarama yapın.");
    }

    return parsedData;
  } catch (e) {
    console.error("AI Recommendation Error:", e);
    throw new Error("Tavsiyeler oluşturulurken bir hata oluştu. Lütfen bağlantınızı kontrol edin.");
  }
}
