
import { GoogleGenAI, Modality } from "@google/genai";
import { AnalysisResult } from "../types";

export class GeminiService {
  async analyzeImage(base64Image: string, mimeType: string = 'image/jpeg'): Promise<AnalysisResult> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // 使用 gemini-3-flash-preview 進行快速且準確的影像分析
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Image,
            },
          },
          {
            text: `請分析這張圖片中的日文內容，並嚴格遵守以下 JSON 格式回傳。
            
            1. 提取至少 10-15 個重要的日文單字。
            2. 如果是動詞 (verb)，必須包含 conjugations (時態變化)。
            3. 提取重要的文法點 (grammar)。
            4. 所有的解釋與翻譯請使用「繁體中文」。

            JSON 結構範例：
            {
              "words": [
                {
                  "kanji": "單字",
                  "furigana": "讀音",
                  "meaning": "意思",
                  "type": "verb|noun|adjective|adverb|other",
                  "example": "例句",
                  "exampleFurigana": "例句讀音",
                  "exampleTranslation": "例句翻譯",
                  "conjugations": {
                    "dictionary": "辭書型", "masu": "ます型", "te": "て型", "nai": "ない型", "ta": "た型"
                  }
                }
              ],
              "grammar": [
                { "point": "文法", "explanation": "中文解釋", "example": "例句" }
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
      // 清理可能存在的 markdown 標記（預防萬一）
      const sanitized = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(sanitized) as AnalysisResult;
    } catch (e) {
      console.error("Gemini 解析失敗:", e, response.text);
      throw new Error("AI 回傳格式錯誤，請再試一次。");
    }
  }

  async playPronunciation(text: string) {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `朗讀：${text}` }] }],
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
        const audioBuffer = await this.decodeAudioData(this.decodeBase64(base64Audio), audioContext, 24000, 1);
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.start();
      }
    } catch (error) {
      console.error("發音失敗:", error);
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
