
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { Word, GrammarPoint } from '../types';

// ==========================================
// 【請在這裡填入你的 Supabase 資訊】
// ==========================================
const supabaseUrl = 'https://bguiuhcqvlgqtpdlxebl.supabase.co'; // 已修復空格
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJndWl1aGNxdmxncXRwZGx4ZWJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MDUzMzEsImV4cCI6MjA4NDQ4MTMzMX0.iNLCPHZG8LbBiEUzKK7JnZaja2i-BBiTVrhkMGXpOuI';
// ==========================================

export const supabase: SupabaseClient | null = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export const supabaseService = {
  isConfigured(): boolean {
    return !!supabase && supabaseUrl.trim() !== '' && supabaseAnonKey.trim() !== '';
  },

  async getCurrentUser(): Promise<User | null> {
    if (!this.isConfigured() || !supabase) return null;
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  },

  async signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
  },

  async fetchWords() {
    if (!supabase) return [];
    const user = await this.getCurrentUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('words')
      .select('*')
      .eq('user_id', user.id)
      .order('added_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(d => ({
      ...d,
      exampleFurigana: d.example_furigana,
      exampleTranslation: d.example_translation,
      addedAt: d.added_at,
      masteryLevel: d.mastery_level,
      isSaved: d.is_saved
    })) as Word[];
  },

  async upsertWord(word: Word) {
    if (!supabase) return;
    const user = await this.getCurrentUser();
    if (!user) return;

    const { error } = await supabase.from('words').upsert({
      id: word.id,
      user_id: user.id,
      kanji: word.kanji,
      furigana: word.furigana,
      meaning: word.meaning,
      type: word.type,
      example: word.example,
      example_furigana: word.exampleFurigana,
      example_translation: word.exampleTranslation,
      conjugations: word.conjugations,
      added_at: word.addedAt,
      is_saved: word.isSaved,
      mastery_level: word.masteryLevel
    });
    if (error) throw error;
  },

  async fetchGrammar() {
    if (!supabase) return [];
    const user = await this.getCurrentUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('grammar_points')
      .select('*')
      .eq('user_id', user.id)
      .order('added_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(d => ({
      ...d,
      addedAt: d.added_at
    })) as GrammarPoint[];
  },

  async upsertGrammar(grammar: GrammarPoint) {
    if (!supabase) return;
    const user = await this.getCurrentUser();
    if (!user) return;

    const { error } = await supabase.from('grammar_points').upsert({
      id: grammar.id,
      user_id: user.id,
      point: grammar.point,
      explanation: grammar.explanation,
      example: grammar.example,
      added_at: grammar.addedAt,
      rating: grammar.rating
    });
    if (error) throw error;
  },

  async deleteGrammar(id: string) {
    if (!supabase) return;
    const user = await this.getCurrentUser();
    if (!user) return;

    const { error } = await supabase
      .from('grammar_points')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
  },

  async deleteWord(id: string) {
    if (!supabase) return;
    const user = await this.getCurrentUser();
    if (!user) return;

    const { error } = await supabase
      .from('words')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
  }
};
