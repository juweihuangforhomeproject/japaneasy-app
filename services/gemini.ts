import { GoogleGenAI, Modality } from "@google/genai";
import { AnalysisResult } from "../types";

export class GeminiService {
  private async getAI() {
    // 優先從環境變數獲取 (Vercel Build-time or Node.js)
    let apiKey = process.env.API_KEY;
    
    // 如果環境變數為空，則嘗試從 window.aistudio 獲取 (AI Studio Runtime)
    if (!apiKey && window.aistudio) {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) {
        throw new Error("請先點擊按鈕授權 API 金鑰以繼續。");
      }
      apiKey = process.env.API_KEY; // 授權後此變數會被自動注入
    }

    if (!apiKey) {
      throw new Error("找不到 API 金鑰，請在 Vercel 設定中加入 API_KEY 或透過金鑰選擇器授權。");
    }

    return new GoogleGenAI({ apiKey });
  }

  async analyzeImage(base64Image: string, mimeType: string = 'image/jpeg'): Promise<AnalysisResult> {
    const ai = await this.getAI();
    
    // 使用 Pro 預覽版處理高難度的多型態日文解析
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
                { "point": "～は～です", "explanation": "基本的判斷句，...是...", "example": "私は学生です。" }
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
      const ai = await this.getAI();
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `請用親切且標準的日語發音唸出這個單字：${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' }, // 使用 Kore 作為日語推薦語音
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const audioBuffer = await this.decodeAudioData(this.decodeBase64(base64Audio), audioContext, 24000, 1);
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.start();
      }
    } catch (error) {
      console.error("發音播報失敗:", error);
    }
  }

  private decodeBase64(base64: string) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  private async decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  }
}

export const gemini = new GeminiService();