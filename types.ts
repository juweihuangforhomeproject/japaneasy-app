
export interface Word {
  id: string;
  kanji: string;
  furigana: string;
  meaning: string;
  type: 'verb' | 'noun' | 'adjective' | 'adverb' | 'particle' | 'other';
  example: string;
  exampleFurigana: string;
  exampleTranslation: string;
  conjugations?: {
    dictionary: string;
    masu: string;
    te: string;
    nai: string;
    ta: string;
  };
  addedAt: number;
  isSaved: boolean;
  masteryLevel: number; // 0: new, 1: learning, 2: mastered
}

export interface GrammarPoint {
  id: string;
  point: string;
  explanation: string;
  example: string;
  addedAt: number;
  rating: number; // 0-5 stars
}

export interface AnalysisResult {
  words: Omit<Word, 'id' | 'addedAt' | 'isSaved' | 'masteryLevel'>[];
  grammar: Omit<GrammarPoint, 'id' | 'addedAt' | 'rating'>[];
}

export type ViewState = 'home' | 'library' | 'flashcards' | 'test' | 'results' | 'grammar' | 'auth';

export interface UserProfile {
  id: string;
  email: string;
}
