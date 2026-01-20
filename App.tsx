import React, { useState, useEffect, useMemo } from 'react';
import { Word, GrammarPoint, ViewState, AnalysisResult } from './types';
import { gemini } from './services/gemini';
import { db } from './services/db';
import { 
  Camera, 
  BookOpen, 
  Layers, 
  BrainCircuit, 
  Plus,
  X,
  CheckCircle2,
  ScrollText,
  RotateCcw,
  Star,
  Download,
  Volume2,
  History,
  Trophy,
  ChevronRight,
  ChevronLeft,
  Settings,
  ShieldCheck,
  ExternalLink,
  AlertCircle
} from 'lucide-react';
import WordCard from './components/WordCard';

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<ViewState>('home');
  const [library, setLibrary] = useState<Word[]>([]);
  const [grammarLibrary, setGrammarLibrary] = useState<GrammarPoint[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [currentResult, setCurrentResult] = useState<AnalysisResult | null>(null);
  const [libraryFilter, setLibraryFilter] = useState<'all' | 'saved'>('all');
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  // 1. 檢查 API Key 狀態
  useEffect(() => {
    const checkKey = async () => {
      if (process.env.API_KEY) {
        setHasApiKey(true);
      } else if (window.aistudio) {
        const has = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(has);
      } else {
        setHasApiKey(false);
      }
    };
    checkKey();
  }, []);

  // 2. 初始載入資料
  useEffect(() => {
    const loadLocalData = async () => {
      const [words, grammar] = await Promise.all([
        db.getAllWords(),
        db.getAllGrammar()
      ]);
      setLibrary(words);
      setGrammarLibrary(grammar);
    };
    loadLocalData();
  }, []);

  const handleAuthorize = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      // 根據規範：假設選擇成功並直接繼續，以避免同步延遲造成的 race condition
      setHasApiKey(true);
    } else {
      alert("請在支援的環境中使用，或在 Vercel 中設定 API_KEY。");
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setAnalyzing(true);
    
    const mimeType = file.type;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result?.toString().split(',')[1];
      if (base64) {
        try {
          const result = await gemini.analyzeImage(base64, mimeType);
          setCurrentResult(result);
          const now = Date.now();
          
          const newWords: Word[] = result.words.map(w => ({
            id: crypto.randomUUID(),
            kanji: w.kanji,
            furigana: w.furigana,
            meaning: w.meaning,
            type: w.type as any,
            example: w.example,
            exampleFurigana: w.exampleFurigana,
            exampleTranslation: w.exampleTranslation,
            conjugations: w.conjugations,
            addedAt: now,
            isSaved: false,
            masteryLevel: 0
          }));

          const newGrammar: GrammarPoint[] = result.grammar.map(g => ({
            id: crypto.randomUUID(),
            point: g.point,
            explanation: g.explanation,
            example: g.example,
            addedAt: now,
            rating: 0
          }));

          await Promise.all([
            db.bulkSaveWords(newWords),
            db.bulkSaveGrammar(newGrammar)
          ]);

          const [allWords, allGrammar] = await Promise.all([
            db.getAllWords(),
            db.getAllGrammar()
          ]);
          setLibrary(allWords);
          setGrammarLibrary(allGrammar);
          setActiveView('results');
        } catch (err: any) {
          console.error("分析錯誤:", err);
          // 根據規範：如果錯誤包含關鍵訊息，重置金鑰狀態
          if (err.message?.includes("entity was not found") || err.message?.includes("API Key") || err.message?.includes("API_KEY")) {
            setHasApiKey(false);
          }
          alert('分析失敗：' + (err.message || '請再試一次。'));
        } finally {
          setAnalyzing(false);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const toggleSaveWord = async (id: string) => {
    const word = library.find(w => w.id === id);
    if (word) {
      const updatedWord = { ...word, isSaved: !word.isSaved };
      setLibrary(prev => prev.map(w => w.id === id ? updatedWord : w));
      await db.updateWord(id, { isSaved: updatedWord.isSaved });
    }
  };

  const updateMastery = async (id: string, direction: 'known' | 'unknown') => {
    const word = library.find(w => w.id === id);
    if (word) {
      const level = direction === 'known' ? 2 : 1;
      const updatedWord = { ...word, masteryLevel: level };
      setLibrary(prev => prev.map(w => w.id === id ? updatedWord : w));
      await db.updateWord(id, { masteryLevel: level });
    }
  };

  // --- 引導視圖 ---
  if (hasApiKey === false) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-indigo-50 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
        <div className="w-20 h-20 bg-white rounded-3xl shadow-xl flex items-center justify-center mb-6">
          <BrainCircuit className="w-10 h-10 text-indigo-600 animate-pulse" />
        </div>
        <h1 className="text-2xl font-black text-indigo-900 mb-2 tracking-tight">啟動 Japaneasy</h1>
        <p className="text-gray-500 mb-8 text-sm leading-relaxed">
          為了啟動 AI 分析功能，我們需要您授權使用您的 Google Gemini API 金鑰。請點擊下方按鈕進行設定。
        </p>
        <button 
          onClick={handleAuthorize}
          className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <ShieldCheck className="w-5 h-5" />
          授權並開啟 App
        </button>
        <a 
          href="https://ai.google.dev/gemini-api/docs/billing" 
          target="_blank" 
          rel="noreferrer"
          className="mt-6 text-xs text-indigo-400 underline font-medium flex items-center gap-1"
        >
          查看帳單與付費說明 <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    );
  }

  if (hasApiKey === null) return null; // 載入中

  return (
    <div className="max-w-md mx-auto min-h-screen bg-gray-50 flex flex-col relative pb-24 shadow-2xl overflow-hidden">
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md px-6 py-4 flex justify-between items-center border-b border-gray-100">
        <button onClick={() => setActiveView('home')} className="text-xl font-black text-indigo-900 tracking-tighter flex items-center gap-2">
          <BrainCircuit className="w-6 h-6 text-indigo-600" />
          Japaneasy
        </button>
        <button onClick={() => db.exportData()} className="p-2 text-gray-400 hover:text-indigo-600"><Download className="w-5 h-5" /></button>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4">
        {analyzing ? (
          <div className="h-[60vh] flex flex-col items-center justify-center space-y-6">
            <div className="w-20 h-20 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
            <p className="text-gray-900 font-bold text-center">正在解析日文內容...<br/><span className="text-xs text-gray-400 font-normal mt-2 block tracking-wider">這通常需要 10-15 秒</span></p>
          </div>
        ) : (
          <>
            {activeView === 'home' && <HomeView onUpload={handleFileUpload} library={library} />}
            {activeView === 'library' && (
              <LibraryView 
                library={library} 
                filter={libraryFilter} 
                setFilter={setLibraryFilter} 
                onToggleSave={toggleSaveWord} 
              />
            )}
            {activeView === 'flashcards' && (
              <FlashcardView 
                words={library.filter(w => w.isSaved)} 
                onMastered={(id) => updateMastery(id, 'known')} 
                onFail={(id) => updateMastery(id, 'unknown')}
                onClose={() => setActiveView('home')}
              />
            )}
            {activeView === 'test' && <TestView library={library} onComplete={() => setActiveView('home')} />}
            {activeView === 'grammar' && <GrammarLibraryView grammarItems={grammarLibrary} />}
            {activeView === 'results' && currentResult && (
              <div className="space-y-6 animate-in slide-in-from-bottom duration-500">
                <div className="flex justify-between items-center px-2">
                  <h2 className="text-xl font-bold">分析結果</h2>
                  <button onClick={() => setActiveView('library')} className="text-indigo-600 font-bold text-sm">查看全部</button>
                </div>
                {library.slice(0, 15).map(word => (
                  <WordCard key={word.id} word={word} onToggleSave={toggleSaveWord} />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/95 backdrop-blur-md border-t border-gray-100 px-6 py-3 flex justify-between items-center z-30">
        <NavItem icon={<BookOpen />} label="單字庫" active={activeView === 'library'} onClick={() => setActiveView('library')} />
        <NavItem icon={<Layers />} label="閃卡" active={activeView === 'flashcards'} onClick={() => setActiveView('flashcards')} />
        <div className="relative -top-8">
          <label className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center shadow-2xl cursor-pointer active:scale-90 transition-transform hover:bg-indigo-700">
            <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            <Camera className="w-8 h-8 text-white" />
          </label>
        </div>
        <NavItem icon={<ScrollText />} label="文法" active={activeView === 'grammar'} onClick={() => setActiveView('grammar')} />
        <NavItem icon={<CheckCircle2 />} label="測驗" active={activeView === 'test'} onClick={() => setActiveView('test')} />
      </nav>
    </div>
  );
};

const NavItem = ({ icon, label, active, onClick }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-all ${active ? 'text-indigo-600 scale-110' : 'text-gray-400'}`}>
    {React.cloneElement(icon, { className: 'w-6 h-6' })}
    <span className="text-[10px] font-black">{label}</span>
  </button>
);

const HomeView = ({ onUpload, library }: any) => {
  const masteredCount = library.filter((w: any) => w.masteryLevel === 2).length;
  const masteryPercent = library.length > 0 ? Math.round((masteredCount / library.length) * 100) : 0;
  
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[2.5rem] p-8 text-white shadow-2xl overflow-hidden relative">
        <div className="relative z-10">
          <h2 className="text-2xl font-black mb-2 leading-tight">今天想學習<br />什麼新單字？</h2>
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 border border-white/20">
              <p className="text-2xl font-black">{library.length}</p>
              <p className="text-[10px] opacity-70 font-bold uppercase tracking-wider">總單字量</p>
            </div>
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 border border-white/20">
              <p className="text-2xl font-black">{masteryPercent}%</p>
              <p className="text-[10px] opacity-70 font-bold uppercase tracking-wider">熟練進度</p>
            </div>
          </div>
        </div>
      </div>

      <section className="space-y-4">
        <h3 className="text-lg font-black flex items-center gap-2 px-2">
          <Plus className="w-5 h-5 text-indigo-600" />
          開始新課程
        </h3>
        <label className="group border-2 border-dashed border-gray-200 bg-white rounded-[2rem] p-10 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-300 transition-all active:scale-95">
          <input type="file" accept="image/*" className="hidden" onChange={onUpload} />
          <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Camera className="w-8 h-8 text-indigo-600" />
          </div>
          <p className="font-bold text-gray-700">拍攝或上傳教材圖片</p>
        </label>
      </section>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
          <History className="w-5 h-5 text-orange-600 mb-2" />
          <h4 className="font-bold text-sm">最近加入</h4>
          <p className="text-xs text-gray-400 mt-1">複習最近掃描的內容</p>
        </div>
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
          <Trophy className="w-5 h-5 text-green-600 mb-2" />
          <h4 className="font-bold text-sm">成就獎章</h4>
          <p className="text-xs text-gray-400 mt-1">連續學習 3 天！</p>
        </div>
      </div>
    </div>
  );
};

const LibraryView = ({ library, filter, setFilter, onToggleSave }: any) => {
  const filteredLibrary = useMemo(() => filter === 'all' ? library : library.filter((w: any) => w.isSaved), [library, filter]);
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center px-2">
        <h2 className="text-xl font-bold">單字庫 ({filteredLibrary.length})</h2>
        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button onClick={() => setFilter('all')} className={`px-3 py-1 rounded-lg text-xs font-bold ${filter === 'all' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400'}`}>全部</button>
          <button onClick={() => setFilter('saved')} className={`px-3 py-1 rounded-lg text-xs font-bold ${filter === 'saved' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400'}`}>已收藏</button>
        </div>
      </div>
      <div className="space-y-4">
        {filteredLibrary.map((word: Word) => (
          <WordCard key={word.id} word={word} onToggleSave={onToggleSave} />
        ))}
      </div>
    </div>
  );
};

const FlashcardView = ({ words, onMastered, onFail, onClose }: any) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const currentWord = words[currentIndex];

  const handleDrag = (e: any) => {
    if (!isDragging) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const startX = (e.currentTarget as any)._startX || clientX;
    setDragOffset(clientX - startX);
  };

  const startDrag = (e: any) => {
    setIsDragging(true);
    (e.currentTarget as any)._startX = e.touches ? e.touches[0].clientX : e.clientX;
  };

  const endDrag = () => {
    setIsDragging(false);
    if (Math.abs(dragOffset) > 120) {
      if (dragOffset > 0) onMastered(currentWord.id);
      else onFail(currentWord.id);
      setIsFlipped(false);
      if (currentIndex < words.length - 1) setCurrentIndex(prev => prev + 1);
      else { alert("複習完畢！"); onClose(); }
    }
    setDragOffset(0);
  };

  if (!currentWord) return <div className="p-20 text-center text-gray-400 font-bold">尚無收藏單字</div>;

  return (
    <div className="h-full flex flex-col pt-4">
      <div className="flex justify-between mb-8 px-4">
        <button onClick={onClose} className="p-2 bg-gray-100 rounded-full"><X className="w-5 h-5" /></button>
        <p className="font-bold text-gray-400 tracking-widest">{currentIndex + 1} / {words.length}</p>
        <div className="w-9 h-9"></div>
      </div>
      <div className="relative flex-1 px-4 perspective-1000">
        <div 
          onMouseDown={startDrag} onMouseMove={handleDrag} onMouseUp={endDrag} onMouseLeave={endDrag}
          onTouchStart={startDrag} onTouchMove={handleDrag} onTouchEnd={endDrag}
          onClick={() => !isDragging && Math.abs(dragOffset) < 5 && setIsFlipped(!isFlipped)}
          style={{ transform: `translateX(${dragOffset}px) rotate(${dragOffset/12}deg)`, transition: isDragging ? 'none' : 'transform 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}
          className="relative w-full aspect-[3/4.5] cursor-grab active:cursor-grabbing"
        >
          <div className={`relative w-full h-full transition-transform duration-700 preserve-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
            <div className="absolute inset-0 backface-hidden bg-white rounded-[2.5rem] shadow-xl border p-10 flex flex-col items-center justify-center text-center">
              <span className="text-xs font-bold text-indigo-500 mb-6 uppercase tracking-widest">{currentWord.type}</span>
              <h3 className="text-5xl font-black japanese-text mb-4 text-gray-900">{currentWord.kanji}</h3>
              <p className="text-xl text-gray-300 font-medium">【{currentWord.furigana}】</p>
            </div>
            <div className="absolute inset-0 backface-hidden rotate-y-180 bg-indigo-900 rounded-[2.5rem] shadow-xl p-8 flex flex-col items-center justify-center text-center text-white">
              <h3 className="text-3xl font-bold mb-4">{currentWord.meaning}</h3>
              <p className="japanese-text text-sm mb-6 opacity-80 leading-relaxed">{currentWord.example}</p>
              <button onClick={(e) => { e.stopPropagation(); gemini.playPronunciation(currentWord.kanji); }} className="w-14 h-14 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 active:scale-90 transition-all shadow-inner"><Volume2 /></button>
            </div>
          </div>
        </div>
      </div>
      <div className="py-10 flex justify-center gap-12">
        <button onClick={() => { setDragOffset(-200); endDrag(); }} className="w-16 h-16 rounded-full bg-white shadow-lg text-red-500 border border-red-50"><ChevronLeft className="mx-auto" /></button>
        <button onClick={() => { setDragOffset(200); endDrag(); }} className="w-16 h-16 rounded-full bg-indigo-600 shadow-lg text-white"><ChevronRight className="mx-auto" /></button>
      </div>
    </div>
  );
};

const TestView = ({ library, onComplete }: any) => {
  const [testWords, setTestWords] = useState<Word[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [testType, setTestType] = useState<'all' | 'recent' | null>(null);

  const startTest = (type: 'all' | 'recent') => {
    let pool = [...library];
    if (type === 'recent') {
      const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      pool = pool.filter(w => w.addedAt > weekAgo);
    }
    if (pool.length < 3) { alert("單字量不足！"); return; }
    setTestWords(pool.sort(() => 0.5 - Math.random()).slice(0, 15));
    setTestType(type);
    setCurrentIndex(0);
    setScore(0);
  };

  const handleAnswer = (correct: boolean) => {
    if (correct) setScore(prev => prev + 1);
    setShowAnswer(true);
    setTimeout(() => {
      setShowAnswer(false);
      if (currentIndex < testWords.length - 1) setCurrentIndex(prev => prev + 1);
      else { alert(`測驗結束！得分：${score + (correct ? 1 : 0)} / ${testWords.length}`); setTestType(null); }
    }, 1200);
  };

  if (!testType) {
    return (
      <div className="space-y-6 pt-10 px-4">
        <Trophy className="w-16 h-16 text-yellow-500 mx-auto" />
        <h2 className="text-2xl font-black text-center">單字挑戰</h2>
        <button onClick={() => startTest('all')} className="w-full bg-white p-6 rounded-3xl shadow-sm border flex justify-between items-center font-bold">全部單字測驗 <ChevronRight/></button>
        <button onClick={() => startTest('recent')} className="w-full bg-white p-6 rounded-3xl shadow-sm border flex justify-between items-center font-bold">最近 7 天單字測驗 <ChevronRight/></button>
      </div>
    );
  }

  const currentWord = testWords[currentIndex];
  return (
    <div className="pt-10 flex flex-col h-full px-4">
      <div className="bg-white rounded-[2.5rem] shadow-xl border p-12 text-center mb-8 min-h-[250px] flex flex-col items-center justify-center">
        <h3 className="text-5xl font-black mb-4 text-gray-900 japanese-text">{currentWord.kanji}</h3>
        {showAnswer ? (
          <p className="text-2xl font-bold text-indigo-600 animate-in zoom-in">{currentWord.meaning}</p>
        ) : (
          <p className="text-gray-400 tracking-widest text-sm uppercase font-bold">請問這是什麼意思？</p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4 mt-auto mb-10">
        <button disabled={showAnswer} onClick={() => handleAnswer(false)} className="bg-white border p-6 rounded-3xl font-bold text-red-500 shadow-sm active:scale-95 disabled:opacity-50">不記得了</button>
        <button disabled={showAnswer} onClick={() => handleAnswer(true)} className="bg-indigo-600 p-6 rounded-3xl font-bold text-white shadow-lg active:scale-95 disabled:opacity-50">我知道！</button>
      </div>
    </div>
  );
};

const GrammarLibraryView = ({ grammarItems }: any) => (
  <div className="space-y-6 pt-4 px-4">
    <h2 className="text-xl font-bold flex items-center gap-2 text-indigo-900"><ScrollText className="text-indigo-600" /> 文法筆記</h2>
    {grammarItems.map((item: GrammarPoint) => (
      <div key={item.id} className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-xl font-black text-gray-900 mb-2 japanese-text">{item.point}</h3>
        <p className="text-gray-600 text-sm mb-4 leading-relaxed">{item.explanation}</p>
        <div className="bg-indigo-50 p-4 rounded-2xl text-sm italic border border-indigo-100 text-indigo-800">「{item.example}」</div>
      </div>
    ))}
  </div>
);

export default App;