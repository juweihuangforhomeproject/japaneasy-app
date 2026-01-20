import { GoogleGenAI, Modality } from "@google/genai";
import { AnalysisResult } from "../types";

export class GeminiService {
  async analyzeImage(base64Image: string, mimeType: string = 'image/jpeg'): Promise<AnalysisResult> {
    // 每次呼叫時才建立實例，確保抓到最新的 API Key
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Image,
            },
          },
          {
            text: `請分析這張圖片中的日文內容，提取關鍵單字 (10-15個) 與重要的文法點，並嚴格以繁體中文與 JSON 格式回傳。
            
            1. 單字需包含漢字 (kanji)、假名 (furigana)、中文意思 (meaning)、詞性 (type: verb/noun/adjective/adverb/other)、例句 (example)、例句假名 (exampleFurigana)、例句翻譯 (exampleTranslation)。
            2. 若單字為動詞 (verb)，請在 conjugations 欄位提供五種變化 (dictionary, masu, te, nai, ta)。
            3. 文法需包含文法點名稱 (point)、繁體中文解釋 (explanation)、例句 (example)。

            JSON 結構範例：
            {
              "words": [
                {
                  "kanji": "勉強",
                  "furigana": "べんきょう",
                  "meaning": "學習",
                  "type": "noun",
                  "example": "毎日日本語を勉強します。",
                  "exampleFurigana": "まいにちにほんごをべんきょうします",
                  "exampleTranslation": "每天學習日文。"
                }
              ],
              "grammar": [
                { "point": "～は～です", "explanation": "基本的判斷句，...是...", "example": "私は學生です。" }
              ]
            }`,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
      },
    });

    try {
      const text = response.text || '{}';
      const sanitized = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(sanitized) as AnalysisResult;
    } catch (e) {
      console.error("Gemini 解析失敗:", e, response.text);
      throw new Error("AI 回傳的資料格式解析失敗，請再試一次。");
    }
  }

  async playPronunciation(text: string) {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `朗讀日文單字：${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const binaryString = atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        const dataInt16 = new Int16Array(bytes.buffer);
        const frameCount = dataInt16.length;
        const buffer = audioContext.createBuffer(1, frameCount, 24000);
        const channelData = buffer.getChannelData(0);
        for (let i = 0; i < frameCount; i++) {
          channelData[i] = dataInt16[i] / 32768.0;
        }

        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start();
      }
    } catch (error) {
      console.error("發音播報失敗:", error);
    }
  }
}

export const gemini = new GeminiService();