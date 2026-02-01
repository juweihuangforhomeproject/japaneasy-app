
import Dexie from 'dexie';
import type { Table } from 'dexie';
import { Word, GrammarPoint } from '../types';

export class JapaneseDatabase extends Dexie {
  words!: Table<Word>;
  grammar!: Table<GrammarPoint>;

  constructor() {
    super('JapaneasyDB');
    this.version(1).stores({
      words: 'id, kanji, type, addedAt, isSaved, masteryLevel',
      grammar: 'id, point, addedAt, rating'
    });
  }

  async getAllWords() {
    return await this.words.reverse().sortBy('addedAt');
  }

  async getAllGrammar() {
    return await this.grammar.reverse().sortBy('addedAt');
  }

  async saveWord(word: Word) {
    return await this.words.put(word);
  }

  async bulkSaveWords(words: Word[]) {
    return await this.words.bulkPut(words);
  }

  async updateWord(id: string, updates: Partial<Word>) {
    return await this.words.update(id, updates);
  }

  async saveGrammar(grammar: GrammarPoint) {
    return await this.grammar.put(grammar);
  }

  async bulkSaveGrammar(grammar: GrammarPoint[]) {
    return await this.grammar.bulkPut(grammar);
  }

  async updateGrammar(id: string, updates: Partial<GrammarPoint>) {
    return await this.grammar.update(id, updates);
  }

  async deleteGrammar(id: string) {
    return await this.grammar.delete(id);
  }

  async deleteWord(id: string) {
    return await this.words.delete(id);
  }

  async exportData() {
    const words = await this.words.toArray();
    const grammar = await this.grammar.toArray();
    const data = JSON.stringify({ words, grammar, exportedAt: Date.now() });
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `japaneasy_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  }
}

export const db = new JapaneseDatabase();
