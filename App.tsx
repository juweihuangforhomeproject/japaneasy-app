import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Word, GrammarPoint, ViewState, AnalysisResult, UserProfile } from './types';
import { gemini } from './services/gemini';
import { db } from './services/db';
import { supabase, supabaseService } from './services/supabase';
import { 
  Camera, 
  BookOpen, 
  Layers, 
  BrainCircuit, 
  Plus,
  Loader2,
  X,
  CheckCircle2,
  ScrollText,
  PartyPopper,
  RotateCcw,
  Star,
  Download,
  RefreshCcw,
  User as UserIcon,
  ChevronRight,
  ChevronLeft,
  Volume2,
  Calendar,
  History,
  Trophy,
  Undo2
} from 'lucide-react';
import WordCard from './components/WordCard';

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<ViewState>('home');
  const [library, setLibrary] = useState<Word[]>([]);
  const [grammarLibrary, setGrammarLibrary] = useState<GrammarPoint[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCloudConfigured, setIsCloudConfigured] = useState(supabaseService.isConfigured());
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [currentResult, setCurrentResult] = useState<AnalysisResult | null>(null);
  const [libraryFilter, setLibraryFilter] = useState<'all' | 'saved'>('all');

  // 初始化：從本地資料庫載入
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
          alert('分析失敗：' + (err.message || '請再試一次。並確認 Vercel 中的 API_KEY 已設定且已重新部署。'));
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

  return (
    <div className="max-w-md mx-auto min-h-screen bg-gray-50 flex flex-col relative pb-24 shadow-2xl overflow-hidden">
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md px-6 py-4 flex justify-between items-center border-b border-gray-100">
        <button onClick={() => setActiveView('home')} className="text-xl font-black text-indigo-900 tracking-tighter flex items-center gap-2">
          <BrainCircuit className="w-6 h-6 text-indigo-600" />
          Japaneasy
        </button>
        <div className="flex items-center gap-1">
          <button onClick={() => db.exportData()} className="p-2 text-gray-400 hover:text-indigo-600"><Download className="w-5 h-5" /></button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4">
        {analyzing ? (
          <div className="h-[60vh] flex flex-col items-center justify-center space-y-6">
            <div className="w-20 h-20 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
            <p className="text-gray-900 font-bold text-center">正在解析圖片內容...<br/><span className="text-xs text-gray-400 font-normal">這通常需要 10-20 秒</span></p>
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
                <div className="flex justify-between items-center">
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
          <label className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center shadow-2xl cursor-pointer active:scale-90 transition-transform">
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
        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
      </div>

      <section className="space-y-4">
        <h3 className="text-lg font-black flex items-center gap-2 px-2">
          <Plus className="w-5 h-5 text-indigo-600" />
          開始新課程
        </h3>
        <label className="group border-2 border-dashed border-gray-200 bg-white rounded-[2rem] p-10 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-all active:scale-95">
          <input type="file" accept="image/*" className="hidden" onChange={onUpload} />
          <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Camera className="w-8 h-8 text-indigo-600" />
          </div>
          <p className="font-bold text-gray-700">拍攝或上傳教材圖片</p>
          <p className="text-xs text-gray-400 mt-1">AI 將自動為您分析單字與語法</p>
        </label>
      </section>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
          <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center mb-3">
            <History className="w-5 h-5 text-orange-600" />
          </div>
          <h4 className="font-bold text-sm">最近加入</h4>
          <p className="text-xs text-gray-400 mt-1">複習您最近 24 小時內的學習內容</p>
        </div>
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center mb-3">
            <Trophy className="w-5 h-5 text-green-600" />
          </div>
          <h4 className="font-bold text-sm">成就獎章</h4>
          <p className="text-xs text-gray-400 mt-1">已連續學習 3 天！再接再厲</p>
        </div>
      </div>
    </div>
  );
};

const LibraryView = ({ library, filter, setFilter, onToggleSave }: any) => {
  const filteredLibrary = useMemo(() => filter === 'all' ? library : library.filter((w: any) => w.isSaved), [library, filter]);
  
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex justify-between items-center px-2">
        <h2 className="text-xl font-bold">單字庫 ({filteredLibrary.length})</h2>
        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button 
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${filter === 'all' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400'}`}
          >全部</button>
          <button 
            onClick={() => setFilter('saved')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${filter === 'saved' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400'}`}
          >已收藏</button>
        </div>
      </div>
      
      {filteredLibrary.length === 0 ? (
        <div className="text-center py-20 opacity-40">
          <BookOpen className="w-12 h-12 mx-auto mb-4" />
          <p className="font-bold">尚無單字，快去上傳圖片吧！</p>
        </div>
      ) : (
        <div className="space-y-4">
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

  const handleDrag = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const startX = (e.currentTarget as any)._startX || clientX;
    setDragOffset(clientX - startX);
  };

  const startDrag = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    (e.currentTarget as any)._startX = 'touches' in e ? e.touches[0].clientX : e.clientX;
  };

  const endDrag = () => {
    setIsDragging(false);
    if (Math.abs(dragOffset) > 120) {
      if (dragOffset > 0) {
        onMastered(currentWord.id);
      } else {
        onFail(currentWord.id);
      }
      handleNext();
    }
    setDragOffset(0);
  };

  const handleNext = () => {
    setIsFlipped(false);
    if (currentIndex < words.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      alert("太棒了！已複習完所有收藏單字。");
      onClose();
    }
  };

  if (!currentWord) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center space-y-4">
        <Layers className="w-16 h-16 text-gray-200" />
        <p className="text-gray-400 font-bold">您還沒有收藏任何單字喔！</p>
        <button onClick={onClose} className="bg-indigo-600 text-white px-6 py-2 rounded-full font-bold">回去加入收藏</button>
      </div>
    );
  }

  const rotation = dragOffset / 10;
  const opacity = Math.min(Math.abs(dragOffset) / 100, 1);

  return (
    <div className="h-full flex flex-col pt-10">
      <div className="flex justify-between items-center mb-8 px-4">
        <button onClick={onClose} className="p-2 bg-gray-100 rounded-full"><X className="w-5 h-5" /></button>
        <p className="font-bold text-gray-500">{currentIndex + 1} / {words.length}</p>
        <div className="w-9 h-9"></div>
      </div>

      <div className="relative flex-1 perspective-1000">
        <div 
          onMouseDown={startDrag}
          onMouseMove={handleDrag}
          onMouseUp={endDrag}
          onMouseLeave={endDrag}
          onTouchStart={startDrag}
          onTouchMove={handleDrag}
          onTouchEnd={endDrag}
          onClick={() => !isDragging && Math.abs(dragOffset) < 5 && setIsFlipped(!isFlipped)}
          style={{ 
            transform: `translateX(${dragOffset}px) rotate(${rotation}deg)`,
            transition: isDragging ? 'none' : 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
          }}
          className="relative w-full aspect-[3/4] cursor-grab active:cursor-grabbing"
        >
          {/* Swipe Indicators */}
          <div 
            style={{ opacity: dragOffset > 0 ? opacity : 0 }}
            className="absolute inset-0 z-20 flex items-center justify-center bg-green-500/20 rounded-[2.5rem] pointer-events-none"
          >
            <div className="bg-green-500 text-white font-black text-2xl px-6 py-2 rounded-full transform -rotate-12 border-4 border-white">熟練</div>
          </div>
          <div 
            style={{ opacity: dragOffset < 0 ? opacity : 0 }}
            className="absolute inset-0 z-20 flex items-center justify-center bg-red-500/20 rounded-[2.5rem] pointer-events-none"
          >
            <div className="bg-red-500 text-white font-black text-2xl px-6 py-2 rounded-full transform rotate-12 border-4 border-white">不熟</div>
          </div>

          {/* Card Body */}
          <div className={`relative w-full h-full transition-transform duration-700 preserve-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
            {/* Front */}
            <div className="absolute inset-0 backface-hidden bg-white rounded-[2.5rem] shadow-xl border border-gray-100 p-10 flex flex-col items-center justify-center text-center">
              <span className="text-xs font-bold text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full mb-6 uppercase tracking-widest">{currentWord.type}</span>
              <h3 className="text-5xl font-black japanese-text mb-4">{currentWord.kanji}</h3>
              <p className="text-xl text-gray-400 font-medium japanese-text">【{currentWord.furigana}】</p>
              <div className="mt-12 flex items-center gap-2 text-gray-300">
                <RotateCcw className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-widest">點擊翻面</span>
              </div>
            </div>
            {/* Back */}
            <div className="absolute inset-0 backface-hidden rotate-y-180 bg-indigo-900 rounded-[2.5rem] shadow-xl p-8 flex flex-col items-center justify-center text-center text-white">
              <h3 className="text-3xl font-bold mb-4">{currentWord.meaning}</h3>
              <div className="w-full h-px bg-white/20 mb-6"></div>
              <p className="japanese-text text-sm mb-2 opacity-80">{currentWord.example}</p>
              <p className="text-xs opacity-60 italic mb-6">（{currentWord.exampleFurigana}）</p>
              <p className="text-sm font-medium">{currentWord.exampleTranslation}</p>
              <button 
                onClick={(e) => { e.stopPropagation(); gemini.playPronunciation(currentWord.kanji); }}
                className="mt-8 w-14 h-14 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                <Volume2 className="w-6 h-6 text-white" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="py-10 flex justify-center gap-12">
        <button onClick={() => { setDragOffset(-200); endDrag(); }} className="w-16 h-16 rounded-full bg-white shadow-lg border border-red-50 flex items-center justify-center text-red-500 active:scale-90 transition-transform">
          <ChevronLeft className="w-8 h-8" />
        </button>
        <button onClick={() => { setDragOffset(200); endDrag(); }} className="w-16 h-16 rounded-full bg-indigo-600 shadow-lg flex items-center justify-center text-white active:scale-90 transition-transform">
          <ChevronRight className="w-8 h-8" />
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
    
    if (pool.length < 5) {
      alert("單字量不足（至少需要 5 個），請先多分析一些圖片。");
      return;
    }
    
    const shuffled = pool.sort(() => 0.5 - Math.random()).slice(0, 15);
    setTestWords(shuffled);
    setTestType(type);
    setCurrentIndex(0);
    setScore(0);
  };

  const handleAnswer = (correct: boolean) => {
    if (correct) setScore(prev => prev + 1);
    setShowAnswer(true);
    setTimeout(() => {
      setShowAnswer(false);
      if (currentIndex < testWords.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        setTestType(null);
      }
    }, 1500);
  };

  if (!testType) {
    return (
      <div className="space-y-6 pt-10">
        <div className="text-center mb-10">
          <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-black">單字挑戰</h2>
          <p className="text-gray-400">測試您的日文熟練度</p>
        </div>
        <button onClick={() => startTest('all')} className="w-full bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex items-center justify-between group hover:border-indigo-500 transition-all">
          <div className="text-left">
            <h4 className="font-black text-lg">全部挑戰</h4>
            <p className="text-xs text-gray-400">從所有單字中隨機抽取 15 題</p>
          </div>
          <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all"><ChevronRight /></div>
        </button>
        <button onClick={() => startTest('recent')} className="w-full bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex items-center justify-between group hover:border-indigo-500 transition-all">
          <div className="text-left">
            <h4 className="font-black text-lg">最近加強</h4>
            <p className="text-xs text-gray-400">複習最近 7 天內加入的內容</p>
          </div>
          <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all"><ChevronRight /></div>
        </button>
      </div>
    );
  }

  const currentWord = testWords[currentIndex];

  return (
    <div className="pt-10 flex flex-col h-full">
      <div className="flex justify-between items-center mb-8">
        <div className="flex-1 bg-gray-100 h-2 rounded-full overflow-hidden mr-4">
          <div className="bg-indigo-600 h-full transition-all duration-500" style={{ width: `${((currentIndex + 1) / testWords.length) * 100}%` }}></div>
        </div>
        <span className="text-xs font-bold text-gray-400">{currentIndex + 1} / {testWords.length}</span>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-xl border border-gray-100 p-10 text-center mb-8">
        <p className="text-xs font-bold text-gray-400 mb-6 uppercase tracking-widest">請回答這個單字的意思</p>
        <h3 className="text-5xl font-black japanese-text mb-2">{currentWord.kanji}</h3>
        <p className="text-xl text-indigo-400 japanese-text mb-8">【{currentWord.furigana}】</p>
        
        {showAnswer && (
          <div className="animate-in fade-in slide-in-from-top duration-300">
            <div className="w-full h-px bg-gray-50 mb-6"></div>
            <h4 className="text-2xl font-bold text-indigo-900">{currentWord.meaning}</h4>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button 
          disabled={showAnswer}
          onClick={() => handleAnswer(false)} 
          className="bg-white border-2 border-gray-100 p-6 rounded-3xl font-bold text-gray-500 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-all disabled:opacity-50"
        >不記得了</button>
        <button 
          disabled={showAnswer}
          onClick={() => handleAnswer(true)} 
          className="bg-indigo-600 p-6 rounded-3xl font-bold text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all disabled:opacity-50"
        >我知道！</button>
      </div>
    </div>
  );
};

const GrammarLibraryView = ({ grammarItems }: any) => {
  return (
    <div className="space-y-6 pt-4 animate-in fade-in duration-500">
      <h2 className="text-xl font-bold px-2 flex items-center gap-2">
        <ScrollText className="text-indigo-600" />
        文法筆記
      </h2>
      {grammarItems.length === 0 ? (
        <div className="text-center py-20 opacity-40">
          <ScrollText className="w-12 h-12 mx-auto mb-4" />
          <p className="font-bold">尚無文法資料</p>
        </div>
      ) : (
        <div className="space-y-4 pb-10">
          {grammarItems.map((item: GrammarPoint) => (
            <div key={item.id} className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-50">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-black text-indigo-900 japanese-text">{item.point}</h3>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star key={s} className={`w-3 h-3 ${s <= item.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`} />
                  ))}
                </div>
              </div>
              <p className="text-gray-600 text-sm leading-relaxed mb-4">{item.explanation}</p>
              <div className="bg-indigo-50/50 p-4 rounded-2xl">
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">例句範本</p>
                <p className="japanese-text text-sm font-medium text-gray-700">{item.example}</p>
              </div>
              <p className="text-[10px] text-gray-300 mt-4 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                學習於 {new Date(item.addedAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default App;