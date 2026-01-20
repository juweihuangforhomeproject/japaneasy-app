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
  ExternalLink
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

  // 1. 初始化：檢查 API Key 狀態
  useEffect(() => {
    const checkApiKey = async () => {
      // 如果 process.env 已經有值，直接通過
      if (process.env.API_KEY) {
        setHasApiKey(true);
        return;
      }
      
      // 否則檢查 window.aistudio
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
      } else {
        // 如果連 window.aistudio 都沒有，可能不在支援的 preview 環境
        setHasApiKey(false);
      }
    };
    checkApiKey();
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

  const handleOpenKeySelector = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      // 根據規範，呼叫後直接假設成功並進入 App
      setHasApiKey(true);
    } else {
      alert('無法開啟金鑰選擇器。請確認您是在正確的環境中執行，或在 Vercel 中設定 API_KEY 環境變數。');
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
          // 如果是因為金鑰遺失而失敗，重新啟動引導
          if (err.message?.includes("API key") || err.message?.includes("not found")) {
            setHasApiKey(false);
          }
          alert('分析失敗：' + (err.message || '發生未知錯誤，請檢查您的網路或金鑰。'));
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

  // --- 視圖組件 ---

  // 金鑰設定畫面 (Onboarding)
  if (hasApiKey === false) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-white flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-700">
        <div className="w-24 h-24 bg-indigo-600 rounded-[2rem] shadow-2xl shadow-indigo-200 flex items-center justify-center mb-8">
          <BrainCircuit className="w-12 h-12 text-white animate-pulse" />
        </div>
        <h1 className="text-3xl font-black text-gray-900 mb-4 tracking-tighter">啟動 Japaneasy</h1>
        <p className="text-gray-500 mb-10 leading-relaxed text-sm">
          為了提供精準的 AI 日文分析功能，我們需要您授權使用您的 Gemini API 金鑰。請點擊下方按鈕進行設定。
        </p>
        
        <div className="w-full space-y-4">
          <button 
            onClick={handleOpenKeySelector}
            className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-3"
          >
            <ShieldCheck className="w-6 h-6" />
            設定並授權 API 金鑰
          </button>
          
          <a 
            href="https://ai.google.dev/gemini-api/docs/billing" 
            target="_blank" 
            rel="noreferrer"
            className="flex items-center justify-center gap-1 text-xs text-indigo-400 font-bold hover:text-indigo-600 transition-colors py-2"
          >
            查看帳單說明 <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        
        <div className="mt-12 p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-start gap-3 text-left">
          <Settings className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
          <p className="text-[10px] text-gray-400">
            您的金鑰將僅用於此應用程式的 API 請求，我們不會儲存您的私人金鑰。請確保選擇了已啟用付款方式的專案。
          </p>
        </div>
      </div>
    );
  }

  // 載入中畫面
  if (hasApiKey === null) {
    return (
      <div className="max-w-md mx-auto min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  // 主 App 畫面
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
            <p className="text-gray-900 font-bold text-center animate-pulse">正在解析日文單字與文法...<br/><span className="text-xs text-gray-400 font-normal mt-2 block">這通常需要 10-15 秒</span></p>
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
  <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-all ${active ? 'text-indigo-600 scale-110' : 'text-gray-400 hover:text-indigo-300'}`}>
    {React.cloneElement(icon, { className: 'w-6 h-6' })}
    <span className="text-[10px] font-black uppercase tracking-tighter">{label}</span>
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
              <p className="text-[10px] opacity-70 font-bold uppercase tracking-wider">熟練度</p>
            </div>
          </div>
        </div>
      </div>

      <section className="space-y-4">
        <h3 className="text-lg font-black flex items-center gap-2 px-2 text-gray-800">
          <Plus className="w-5 h-5 text-indigo-600" />
          掃描教材
        </h3>
        <label className="group border-2 border-dashed border-gray-200 bg-white rounded-[2rem] p-10 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/20 transition-all active:scale-95">
          <input type="file" accept="image/*" className="hidden" onChange={onUpload} />
          <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Camera className="w-8 h-8 text-indigo-600" />
          </div>
          <p className="font-bold text-gray-700">拍攝或上傳圖片</p>
          <p className="text-[10px] text-gray-400 mt-2 font-medium">支援日文課本、報紙或筆記</p>
        </label>
      </section>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-start gap-2">
          <History className="w-5 h-5 text-orange-600" />
          <h4 className="font-bold text-sm">複習進度</h4>
          <div className="w-full bg-gray-50 h-1 rounded-full overflow-hidden">
            <div className="bg-orange-400 h-full w-[40%]"></div>
          </div>
        </div>
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-start gap-2">
          <Trophy className="w-5 h-5 text-green-600" />
          <h4 className="font-bold text-sm">學習成就</h4>
          <p className="text-[10px] text-gray-400">連續 3 天達標！</p>
        </div>
      </div>
    </div>
  );
};

const LibraryView = ({ library, filter, setFilter, onToggleSave }: any) => {
  const filteredLibrary = useMemo(() => filter === 'all' ? library : library.filter((w: any) => w.isSaved), [library, filter]);
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex justify-between items-center px-2 mb-2">
        <h2 className="text-xl font-bold text-indigo-900">單字庫 ({filteredLibrary.length})</h2>
        <div className="flex bg-gray-200/50 p-1 rounded-xl">
          <button onClick={() => setFilter('all')} className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${filter === 'all' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400'}`}>全部</button>
          <button onClick={() => setFilter('saved')} className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${filter === 'saved' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400'}`}>已收藏</button>
        </div>
      </div>
      {filteredLibrary.length === 0 ? (
        <div className="text-center py-20 opacity-30 flex flex-col items-center">
          <BookOpen className="w-16 h-16 mb-4" />
          <p className="font-bold">尚無資料，請先掃描教材</p>
        </div>
      ) : (
        <div className="space-y-4 pb-10">
          {filteredLibrary.map((word: Word) => (
            <WordCard key={word.id} word={word} onToggleSave={onToggleSave} />
          ))}
        </div>
      )}
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
      else { alert("太棒了！您已複習完所有單字。"); onClose(); }
    }
    setDragOffset(0);
  };

  if (!currentWord) return (
    <div className="h-[60vh] flex flex-col items-center justify-center space-y-4 p-8 text-center">
      <Layers className="w-16 h-16 text-gray-200" />
      <p className="text-gray-400 font-bold">目前沒有收藏單字，請到單字庫中收藏一些單字再來練習吧！</p>
      <button onClick={onClose} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-bold">返回首頁</button>
    </div>
  );

  return (
    <div className="h-full flex flex-col pt-4">
      <div className="flex justify-between items-center mb-8 px-4">
        <button onClick={onClose} className="p-2 bg-white rounded-full shadow-sm"><X className="w-5 h-5" /></button>
        <div className="flex flex-col items-center">
          <p className="font-black text-gray-300 text-xs tracking-widest uppercase">Flashcard</p>
          <p className="font-bold text-indigo-600">{currentIndex + 1} / {words.length}</p>
        </div>
        <div className="w-9 h-9"></div>
      </div>
      
      <div className="relative flex-1 px-4 perspective-1000">
        <div 
          onMouseDown={startDrag} onMouseMove={handleDrag} onMouseUp={endDrag} onMouseLeave={endDrag}
          onTouchStart={startDrag} onTouchMove={handleDrag} onTouchEnd={endDrag}
          onClick={() => !isDragging && Math.abs(dragOffset) < 5 && setIsFlipped(!isFlipped)}
          style={{ transform: `translateX(${dragOffset}px) rotate(${dragOffset/12}deg)`, transition: isDragging ? 'none' : 'transform 0.6s cubic-bezier(0.23, 1, 0.32, 1)' }}
          className="relative w-full aspect-[3/4.5] cursor-grab active:cursor-grabbing"
        >
          {/* 滑動提示標籤 */}
          <div style={{ opacity: dragOffset > 0 ? Math.min(dragOffset/100, 1) : 0 }} className="absolute top-10 left-10 z-20 bg-green-500 text-white px-4 py-2 rounded-xl font-black text-xl rotate-[-12deg] border-4 border-white">記得</div>
          <div style={{ opacity: dragOffset < 0 ? Math.min(-dragOffset/100, 1) : 0 }} className="absolute top-10 right-10 z-20 bg-red-500 text-white px-4 py-2 rounded-xl font-black text-xl rotate-[12deg] border-4 border-white">忘記</div>

          <div className={`relative w-full h-full transition-transform duration-700 preserve-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
            {/* 正面 */}
            <div className="absolute inset-0 backface-hidden bg-white rounded-[3rem] shadow-2xl border border-gray-100 p-10 flex flex-col items-center justify-center text-center">
              <span className="text-xs font-black text-indigo-400 bg-indigo-50 px-4 py-1.5 rounded-full mb-8 uppercase tracking-[0.2em]">{currentWord.type}</span>
              <h3 className="text-6xl font-black japanese-text mb-4 text-gray-900 leading-tight">{currentWord.kanji}</h3>
              <p className="text-2xl text-gray-300 font-medium japanese-text">【{currentWord.furigana}】</p>
              <div className="mt-16 flex flex-col items-center gap-2 opacity-20">
                <RotateCcw className="w-5 h-5 animate-spin-slow" />
                <span className="text-[10px] font-bold uppercase tracking-widest">點擊翻面</span>
              </div>
            </div>
            {/* 背面 */}
            <div className="absolute inset-0 backface-hidden rotate-y-180 bg-indigo-900 rounded-[3rem] shadow-2xl p-10 flex flex-col items-center justify-center text-center text-white">
              <h3 className="text-3xl font-black mb-6">{currentWord.meaning}</h3>
              <div className="w-12 h-1 bg-white/20 rounded-full mb-8"></div>
              <p className="japanese-text text-base mb-2 opacity-90 leading-relaxed">{currentWord.example}</p>
              <p className="text-sm font-medium opacity-60 italic mb-10">{currentWord.exampleTranslation}</p>
              <button 
                onClick={(e) => { e.stopPropagation(); gemini.playPronunciation(currentWord.kanji); }} 
                className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 active:scale-90 transition-all shadow-inner"
              >
                <Volume2 className="w-8 h-8 text-white" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="py-12 flex justify-center gap-10">
        <button onClick={() => { setDragOffset(-200); endDrag(); }} className="w-20 h-20 rounded-full bg-white shadow-xl flex items-center justify-center text-red-500 hover:text-red-600 active:scale-90 transition-all border border-red-50">
          <ChevronLeft className="w-10 h-10" />
        </button>
        <button onClick={() => { setDragOffset(200); endDrag(); }} className="w-20 h-20 rounded-full bg-indigo-600 shadow-xl flex items-center justify-center text-white hover:bg-indigo-700 active:scale-90 transition-all">
          <ChevronRight className="w-10 h-10" />
        </button>
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
    if (pool.length < 3) { alert("單字量不足！請先掃描更多教材。"); return; }
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
      else { 
        alert(`測驗結束！您的得分：${score + (correct ? 1 : 0)} / ${testWords.length}`); 
        setTestType(null); 
        onComplete();
      }
    }, 1200);
  };

  if (!testType) {
    return (
      <div className="space-y-6 pt-10 px-4 animate-in fade-in duration-500">
        <div className="text-center mb-10">
          <Trophy className="w-20 h-20 text-yellow-500 mx-auto mb-4 drop-shadow-xl" />
          <h2 className="text-3xl font-black text-gray-900 tracking-tighter">單字力大挑戰</h2>
          <p className="text-gray-400 mt-2 text-sm font-medium">每天 15 題，強化記憶深度</p>
        </div>
        <button onClick={() => startTest('all')} className="w-full bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex justify-between items-center group hover:border-indigo-500 transition-all active:scale-95">
          <div className="text-left">
            <h4 className="font-black text-gray-800 text-lg">全部單字隨機測驗</h4>
            <p className="text-xs text-gray-400 mt-1">從您所有分析過的單字中隨機抽取</p>
          </div>
          <ChevronRight className="text-indigo-600 group-hover:translate-x-1 transition-transform" />
        </button>
        <button onClick={() => startTest('recent')} className="w-full bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex justify-between items-center group hover:border-indigo-500 transition-all active:scale-95">
          <div className="text-left">
            <h4 className="font-black text-gray-800 text-lg">最近 7 天新單字測驗</h4>
            <p className="text-xs text-gray-400 mt-1">針對一週內新學的內容進行鞏固</p>
          </div>
          <ChevronRight className="text-indigo-600 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    );
  }

  const currentWord = testWords[currentIndex];
  return (
    <div className="pt-6 flex flex-col h-full px-4 animate-in slide-in-from-right duration-500">
      <div className="flex justify-between items-center mb-6 px-2">
        <div className="bg-gray-200 h-2 rounded-full w-2/3 overflow-hidden">
          <div className="bg-indigo-600 h-full transition-all duration-700" style={{ width: `${((currentIndex + 1) / testWords.length) * 100}%` }}></div>
        </div>
        <span className="text-xs font-black text-indigo-600 uppercase tracking-widest">{currentIndex + 1} / {testWords.length}</span>
      </div>

      <div className="bg-white rounded-[3rem] shadow-2xl border border-gray-50 p-12 text-center mb-10 min-h-[300px] flex flex-col items-center justify-center">
        <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.3em] mb-8">請問這單字的意思是？</p>
        <h3 className="text-5xl font-black mb-4 japanese-text text-gray-900">{currentWord.kanji}</h3>
        <p className="text-xl text-gray-400 japanese-text mb-10">【{currentWord.furigana}】</p>
        
        {showAnswer && (
          <div className="animate-in zoom-in duration-300 bg-indigo-50 px-8 py-4 rounded-2xl">
            <p className="text-3xl font-black text-indigo-700">{currentWord.meaning}</p>
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-2 gap-4 mt-auto mb-10">
        <button disabled={showAnswer} onClick={() => handleAnswer(false)} className="bg-white border-2 border-gray-100 p-8 rounded-[2rem] font-black text-gray-400 hover:text-red-500 hover:border-red-100 transition-all active:scale-90 disabled:opacity-50">忘記了</button>
        <button disabled={showAnswer} onClick={() => handleAnswer(true)} className="bg-indigo-600 p-8 rounded-[2rem] font-black text-white shadow-xl shadow-indigo-100 active:scale-90 transition-all disabled:opacity-50">記得了！</button>
      </div>
    </div>
  );
};

const GrammarLibraryView = ({ grammarItems }: any) => (
  <div className="space-y-6 pt-4 px-2 animate-in fade-in duration-500">
    <h2 className="text-xl font-bold flex items-center gap-2 text-indigo-900 px-2"><ScrollText className="text-indigo-600" /> 文法重點總覽</h2>
    {grammarItems.length === 0 ? (
      <div className="text-center py-20 opacity-30 flex flex-col items-center">
        <ScrollText className="w-16 h-16 mb-4" />
        <p className="font-bold text-gray-500">目前尚無文法紀錄</p>
      </div>
    ) : (
      <div className="space-y-4 pb-10">
        {grammarItems.map((item: GrammarPoint) => (
          <div key={item.id} className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-50 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-black text-gray-900 japanese-text border-b-2 border-indigo-100 pb-1">{item.point}</h3>
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map(i => <Star key={i} className={`w-3 h-3 ${i <= item.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-100'}`} />)}
              </div>
            </div>
            <p className="text-gray-600 text-sm leading-relaxed mb-6 bg-gray-50/50 p-4 rounded-2xl border border-gray-100/50 font-medium">{item.explanation}</p>
            <div className="space-y-2">
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">情境例句</p>
              <div className="bg-indigo-50/30 p-4 rounded-2xl text-gray-800 japanese-text font-medium text-sm border border-indigo-50">
                {item.example}
              </div>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

export default App;