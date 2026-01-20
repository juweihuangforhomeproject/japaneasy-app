
import React from 'react';
import { Word } from '../types';
import { Volume2, Bookmark, BookmarkCheck, ChevronDown, ChevronUp } from 'lucide-react';
import { gemini } from '../services/gemini';

interface WordCardProps {
  word: Word;
  onToggleSave: (id: string) => void;
  showConjugationsDefault?: boolean;
}

const WordCard: React.FC<WordCardProps> = ({ word, onToggleSave, showConjugationsDefault = false }) => {
  const [expanded, setExpanded] = React.useState(showConjugationsDefault);

  const playAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    gemini.playPronunciation(word.kanji);
  };

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 transition-all hover:shadow-md">
      <div className="flex justify-between items-start">
        <div>
          <span className="text-xs font-medium text-indigo-500 bg-indigo-50 px-2 py-1 rounded-full mb-2 inline-block">
            {word.type.toUpperCase()}
          </span>
          <div className="flex items-center gap-2">
            <h3 className="text-2xl font-bold japanese-text">{word.kanji}</h3>
            <button 
              onClick={playAudio}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <Volume2 className="w-5 h-5 text-indigo-600" />
            </button>
          </div>
          <p className="text-sm text-gray-500 japanese-text mb-2">【{word.furigana}】</p>
          <p className="text-lg text-gray-800 font-medium">{word.meaning}</p>
        </div>
        <button 
          onClick={() => onToggleSave(word.id)}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          {word.isSaved ? (
            <BookmarkCheck className="w-6 h-6 text-yellow-500 fill-yellow-500" />
          ) : (
            <Bookmark className="w-6 h-6 text-gray-300" />
          )}
        </button>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-50">
        <p className="text-sm text-gray-400 mb-1">例句：</p>
        <p className="japanese-text text-gray-700 leading-relaxed font-medium">{word.example}</p>
        {word.exampleFurigana && (
          <p className="text-xs text-gray-400 japanese-text mb-1 italic">（{word.exampleFurigana}）</p>
        )}
        <p className="text-sm text-gray-500">{word.exampleTranslation}</p>
      </div>

      {word.type === 'verb' && word.conjugations && (
        <div className="mt-4">
          <button 
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-wider"
          >
            時態變化 {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          
          {expanded && (
            <div className="mt-2 grid grid-cols-2 gap-2 bg-indigo-50 p-3 rounded-xl text-sm">
              <div><span className="text-gray-500 block">辭書型</span><span className="japanese-text font-medium">{word.conjugations.dictionary}</span></div>
              <div><span className="text-gray-500 block">ます型</span><span className="japanese-text font-medium">{word.conjugations.masu}</span></div>
              <div><span className="text-gray-500 block">て型</span><span className="japanese-text font-medium">{word.conjugations.te}</span></div>
              <div><span className="text-gray-500 block">ない型</span><span className="japanese-text font-medium">{word.conjugations.nai}</span></div>
              <div className="col-span-2"><span className="text-gray-500 block">た型</span><span className="japanese-text font-medium">{word.conjugations.ta}</span></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WordCard;
