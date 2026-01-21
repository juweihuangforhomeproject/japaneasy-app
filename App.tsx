
import React, { useState, useEffect, useMemo } from 'react';
import { Word, GrammarPoint, ViewState, AnalysisResult, UserProfile } from './types';
import { gemini } from './services/gemini';
import { db } from './services/db';
import { supabase, supabaseService } from './services/supabase';
import { 
  Camera, 
  BookOpen, 
  Layers, 
  BrainCircuit, 
  Upload, 
  Plus,
  Loader2,
  X,
  CheckCircle2,
  ScrollText,
  PartyPopper,
  RotateCcw,
  Star,
  Download,
  Database,
  RefreshCcw,
  CloudAlert,
  LogIn,
  LogOut,
  User as UserIcon,
  Mail,
  Lock,
  Calendar,
  Bookmark
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
  const [lastSaved, setLastSaved] = useState<string>('');
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

  // 監聽登入狀態變化
  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setCurrentUser({ id: session.user.id, email: session.user.email || '' });
        // 登入後啟動同步
        syncWithCloud(session.user.id);
      } else {
        setCurrentUser(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const syncWithCloud = async (userId?: string) => {
    if (!supabaseService.isConfigured() || isSyncing) return;
    const user = userId ? { id: userId } : await supabaseService.getCurrentUser();
    if (!user) return;

    setIsSyncing(true);
    try {
      // 1. 先把本地現有的資料推送到雲端 (Upsert)，防止登入後離線資料遺失
      const localWords = await db.getAllWords();
      const localGrammar = await db.getAllGrammar();
      
      await Promise.all([
        ...localWords.map(w => supabaseService.upsertWord(w)),
        ...localGrammar.map(g => supabaseService.upsertGrammar(g))
      ]);

      // 2. 從雲端抓取最新的完整資料
      const [cloudWords, cloudGrammar] = await Promise.all([
        supabaseService.fetchWords(),
        supabaseService.fetchGrammar()
      ]);

      // 3. 更新本地資料庫與狀態
      await Promise.all([
        db.bulkSaveWords(cloudWords),
        db.bulkSaveGrammar(cloudGrammar)
      ]);
      
      setLibrary(cloudWords);
      setGrammarLibrary(cloudGrammar);
      setLastSaved(new Date().toLocaleTimeString());
    } catch (err: any) {
      const errorMsg = err?.message || err?.details || "未知同步錯誤";
      console.error("同步失敗:", errorMsg);
      // 只有在真的出錯時才警告，避免干擾使用者
      if (errorMsg.includes("policy") || errorMsg.includes("relation")) {
        alert(`雲端同步失敗: ${errorMsg}\n\n請檢查 Supabase 的 SQL 設定。`);
      }
    } finally {
      setIsSyncing(false);
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

          // 儲存至本地
          await Promise.all([
            db.bulkSaveWords(newWords),
            db.bulkSaveGrammar(newGrammar)
          ]);

          // 如果已登入，立即嘗試同步至雲端
          if (currentUser) {
            Promise.all([
              ...newWords.map(w => supabaseService.upsertWord(w)),
              ...newGrammar.map(g => supabaseService.upsertGrammar(g))
            ]).then(() => setLastSaved(new Date().toLocaleTimeString()))
              .catch(err => console.error('背景同步失敗', err));
          }

          // 更新介面顯示
          const [allWords, allGrammar] = await Promise.all([
            db.getAllWords(),
            db.getAllGrammar()
          ]);
          setLibrary(allWords);
          setGrammarLibrary(allGrammar);
          setActiveView('results');
        } catch (err: any) {
          console.error("分析錯誤:", err);
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
      if (currentUser) {
        supabaseService.upsertWord(updatedWord).catch(e => console.error("雲端同步失敗", e));
      }
    }
  };

  const updateGrammarRating = async (id: string, rating: number) => {
    const grammar = grammarLibrary.find(g => g.id === id);
    if (grammar) {
      const updatedGrammar = { ...grammar, rating };
      setGrammarLibrary(prev => prev.map(g => g.id === id ? updatedGrammar : g));
      await db.updateGrammar(id, { rating });
      if (currentUser) {
        supabaseService.upsertGrammar(updatedGrammar).catch(e => console.error("雲端同步失敗", e));
      }
    }
  };

  const updateMastery = async (id: string, direction: 'known' | 'unknown') => {
    const word = library.find(w => w.id === id);
    if (word) {
      const level = direction === 'known' ? 2 : 1;
      const updatedWord = { ...word, masteryLevel: level };
      setLibrary(prev => prev.map(w => w.id === id ? updatedWord : w));
      await db.updateWord(id, { masteryLevel: level });
      if (currentUser) {
        supabaseService.upsertWord(updatedWord).catch(e => console.error("雲端同步失敗", e));
      }
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-gray-50 flex flex-col relative pb-24 shadow-2xl">
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md px-6 py-4 flex justify-between items-center border-b border-gray-100">
        <div className="flex flex-col">
          <button onClick={() => setActiveView('home')} className="text-xl font-black text-indigo-900 tracking-tighter flex items-center gap-2 hover:opacity-70 transition-opacity">
            <BrainCircuit className="w-6 h-6 text-indigo-600" />
            Japaneasy
          </button>
          <div className="flex items-center gap-1.5 mt-0.5">
            {!isCloudConfigured ? (
              <div className="flex items-center gap-1 text-[10px] text-orange-400 font-bold uppercase tracking-tight">
                <CloudAlert className="w-2.5 h-2.5" /> 尚未設定金鑰
              </div>
            ) : !currentUser ? (
              <button onClick={() => setActiveView('auth')} className="flex items-center gap-1 text-[10px] text-indigo-500 font-bold uppercase tracking-tight hover:underline">
                <LogIn className="w-2.5 h-2.5" /> 點此登入雲端
              </button>
            ) : (
              <div className="flex items-center gap-1 text-[10px] text-green-500 font-bold uppercase tracking-tight">
                {isSyncing ? <RefreshCcw className="w-2.5 h-2.5 animate-spin" /> : <CheckCircle2 className="w-2.5 h-2.5" />}
                {isSyncing ? '同步中...' : `已連線雲端 · ${lastSaved || '同步完成'}`}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {isCloudConfigured && (
            <button onClick={() => setActiveView('auth')} className={`p-2 rounded-full transition-colors ${currentUser ? 'text-indigo-600 bg-indigo-50' : 'text-gray-400 hover:bg-gray-100'}`} title="帳號資訊">
              <UserIcon className="w-5 h-5" />
            </button>
          )}
          <button onClick={() => db.exportData()} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400" title="下載備份">
            <Download className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 px-6 py-6 overflow-y-auto">
        {analyzing ? (
          <div className="h-[60vh] flex flex-col items-center justify-center space-y-6 animate-in fade-in duration-700">
            <div className="relative">
              <div className="w-20 h-20 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
              <Camera className="w-8 h-8 text-indigo-600 absolute inset-0 m-auto" />
            </div>
            <div className="text-center px-8">
              <p className="text-gray-900 font-bold text-lg">正在深度分析圖片...</p>
              <p className="text-gray-400 text-sm mt-1">AI 正在努力識讀文字並產生時態...</p>
            </div>
          </div>
        ) : (
          <>
            {activeView === 'home' && <HomeView onUpload={handleFileUpload} library={library} currentUser={currentUser} isConfigured={isCloudConfigured} />}
            {activeView === 'library' && <LibraryView library={library} filter={libraryFilter} setFilter={setLibraryFilter} onToggleSave={toggleSaveWord} />}
            {activeView === 'flashcards' && (
              <FlashcardView 
                words={library.filter(w => w.isSaved)} 
                onMastered={(id) => updateMastery(id, 'known')} 
                onFail={(id) => updateMastery(id, 'unknown')}
              />
            )}
            {activeView === 'test' && <TestView library={library} />}
            {activeView === 'grammar' && (
              <GrammarLibraryView 
                grammarItems={grammarLibrary} 
                onUpdateRating={updateGrammarRating} 
              />
            )}
            {activeView === 'results' && currentResult && (
              <ResultView 
                result={currentResult} 
                library={library} 
                onToggleSave={toggleSaveWord} 
                onBack={() => { setActiveView('library'); setLibraryFilter('all'); }} 
              />
            )}
            {activeView === 'auth' && <AuthView user={currentUser} onBack={() => setActiveView('home')} onSync={() => syncWithCloud()} isSyncing={isSyncing} />}
          </>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/95 backdrop-blur-md border-t border-gray-100 px-6 py-3 flex justify-between items-center z-30">
        <NavItem icon={<BookOpen />} label="單字庫" active={activeView === 'library' || activeView === 'results'} onClick={() => setActiveView('library')} />
        <NavItem icon={<Layers />} label="閃卡" active={activeView === 'flashcards'} onClick={() => setActiveView('flashcards')} />
        <div className="relative -top-8">
          <label className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center shadow-2xl shadow-indigo-300 cursor-pointer active:scale-90 transition-transform hover:bg-indigo-700">
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
  <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-all ${active ? 'text-indigo-600 scale-110' : 'text-gray-400 hover:text-gray-600'}`}>
    {React.cloneElement(icon, { className: 'w-6 h-6' })}
    <span className={`text-[10px] font-black ${active ? 'opacity-100' : 'opacity-70'}`}>{label}</span>
  </button>
);

const HomeView = ({ onUpload, library, currentUser, isConfigured }: any) => {
  const masteredCount = library.filter((w: any) => w.masteryLevel === 2).length;
  const masteryPercent = library.length > 0 ? Math.round((masteredCount / library.length) * 100) : 0;
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10"><Database className="w-40 h-40 rotate-12" /></div>
        <h2 className="text-2xl font-black mb-2 relative z-10 leading-tight">你好呀！<br />準備好學習了嗎？</h2>
        <p className="text-indigo-100 opacity-90 mb-8 text-sm relative z-10 font-medium">
          {!isConfigured ? "請依照指示設定 Supabase 金鑰以啟用同步。" : currentUser ? `已登入：${currentUser.email}` : "登入後即可在不同裝置同步單字。"}
        </p>
        <div className="grid grid-cols-2 gap-4 relative z-10">
          <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-5 border border-white/20">
            <p className="text-3xl font-black mb-1">{library.length}</p>
            <p className="text-[10px] uppercase font-bold tracking-widest opacity-60">累積單字</p>
          </div>
          <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-5 border border-white/20">
            <p className="text-3xl font-black mb-1">{masteryPercent}%</p>
            <p className="text-[10px] uppercase font-bold tracking-widest opacity-60">掌握進度</p>
          </div>
        </div>
      </div>
      <section>
        <h3 className="text-lg font-black mb-4 flex items-center gap-2 text-gray-900"><Upload className="w-5 h-5 text-indigo-500" />開始學習</h3>
        <label className="border-4 border-dashed border-gray-100 bg-white rounded-[2rem] p-12 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-200 hover:bg-indigo-50/30 transition-all group">
          <input type="file" accept="image/*" className="hidden" onChange={onUpload} />
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-indigo-100 transition-all">
            <Plus className="w-8 h-8 text-gray-400 group-hover:text-indigo-600" />
          </div>
          <p className="text-gray-900 font-bold">點擊拍照或上傳</p>
          <p className="text-gray-400 text-xs mt-1">AI 將自動分析並生成單字卡</p>
        </label>
      </section>
    </div>
  );
};

const LibraryView = ({ library, filter, setFilter, onToggleSave }: any) => {
  const filteredLibrary = useMemo(() => {
    return filter === 'all' ? library : library.filter((w: any) => w.isSaved);
  }, [library, filter]);

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-indigo-600" />
          {filter === 'all' ? '所有單字' : '已收藏單字'} ({filteredLibrary.length})
        </h2>
        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button 
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${filter === 'all' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400'}`}
          >
            全部
          </button>
          <button 
            onClick={() => setFilter('saved')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${filter === 'saved' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400'}`}
          >
            已收藏
          </button>
        </div>
      </div>
      <div className="grid gap-4">
        {filteredLibrary.map((word: Word) => (
          <WordCard key={word.id} word={word} onToggleSave={onToggleSave} />
        ))}
        {filteredLibrary.length === 0 && (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
            <p className="text-gray-400">{filter === 'all' ? '目前還沒有單字，快去掃描吧！' : '目前沒有收藏的單字'}</p>
          </div>
        )}
      </div>
    </div>
  );
};

const GrammarLibraryView = ({ grammarItems, onUpdateRating }: any) => (
  <div className="space-y-6 animate-in fade-in duration-500">
    <h2 className="text-xl font-bold flex items-center gap-2">
      <ScrollText className="w-6 h-6 text-indigo-600" />
      語法重點 ({grammarItems.length})
    </h2>
    <div className="grid gap-4">
      {grammarItems.map((item: any) => (
        <div key={item.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-bold text-indigo-600 japanese-text">{item.point}</h3>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} onClick={() => onUpdateRating(item.id, star)}>
                  <Star className={`w-4 h-4 ${star <= item.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`} />
                </button>
              ))}
            </div>
          </div>
          <p className="text-gray-700 text-sm leading-relaxed mb-4 bg-gray-50 p-4 rounded-xl">{item.explanation}</p>
          <div className="border-t border-gray-50 pt-4">
            <p className="text-[10px] uppercase font-bold text-gray-400 mb-1 tracking-widest">範例</p>
            <p className="japanese-text text-gray-800 font-medium">{item.example}</p>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const ResultView = ({ result, library, onToggleSave, onBack }: any) => (
  <div className="space-y-8 animate-in slide-in-from-right duration-500">
    <div className="flex items-center gap-4">
      <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full"><RotateCcw className="w-6 h-6 text-gray-400" /></button>
      <h2 className="text-2xl font-bold">分析結果</h2>
    </div>
    <div className="bg-green-50 rounded-3xl p-6 border border-green-100 flex items-center gap-4">
      <div className="bg-green-500 p-3 rounded-2xl text-white"><PartyPopper className="w-6 h-6" /></div>
      <div>
        <p className="text-green-800 font-bold">成功提取！</p>
        <p className="text-green-600 text-xs">找到 {result.words.length} 個單字與 {result.grammar.length} 個語法點</p>
      </div>
    </div>
    <div className="grid gap-4">
      {result.words.map((word: any, idx: number) => {
        const savedWord = library.find((w: any) => w.kanji === word.kanji);
        return <WordCard key={idx} word={savedWord || word} onToggleSave={onToggleSave} />;
      })}
    </div>
    <button onClick={onBack} className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold shadow-xl">返回首頁</button>
  </div>
);

const FlashcardView = ({ words, onMastered, onFail }: any) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  if (words.length === 0) return <div className="text-center py-20 px-8 bg-white rounded-3xl border border-dashed border-gray-200">請先在單字庫中收藏單字，才能進行閃卡複習</div>;
  const currentWord = words[currentIndex];
  const next = () => { setIsFlipped(false); setCurrentIndex(prev => (prev + 1) % words.length); };
  return (
    <div className="space-y-8 animate-in slide-in-from-bottom duration-500">
      <div className="flex justify-between items-center"><h2 className="text-xl font-bold">閃卡複習</h2><span className="text-indigo-600 font-bold">{currentIndex + 1} / {words.length}</span></div>
      <div onClick={() => setIsFlipped(!isFlipped)} className="h-80 w-full relative cursor-pointer">
        <div className={`w-full h-full transition-all duration-500 bg-white rounded-[2.5rem] p-8 shadow-xl border border-gray-100 flex flex-col items-center justify-center ${isFlipped ? 'bg-indigo-600 text-white' : 'text-indigo-900'}`}>
          {!isFlipped ? (
            <>
              <h3 className="text-4xl font-black japanese-text text-center">{currentWord.kanji}</h3>
              <p className="mt-4 text-xs opacity-40">點擊翻面</p>
            </>
          ) : (
            <div className="text-center">
              <p className="text-indigo-200 japanese-text mb-2">【{currentWord.furigana}】</p>
              <h3 className="text-3xl font-bold mb-4">{currentWord.meaning}</h3>
              <p className="text-indigo-100 text-sm px-4">{currentWord.example}</p>
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <button onClick={() => { onFail(currentWord.id); next(); }} className="py-4 rounded-2xl bg-white border border-gray-100 text-gray-500 font-bold shadow-sm active:scale-95 transition-all">還不熟</button>
        <button onClick={() => { onMastered(currentWord.id); next(); }} className="py-4 rounded-2xl bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-100 active:scale-95 transition-all">記住了</button>
      </div>
    </div>
  );
};

const TestView = ({ library }: any) => {
  const [started, setStarted] = useState(false);
  const [score, setScore] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [range, setRange] = useState<'all' | '7days' | '30days'>('all');
  const [source, setSource] = useState<'all' | 'saved'>('all');

  const testWords = useMemo(() => {
    if (!started) return [];
    let pool = source === 'all' ? [...library] : library.filter((w: any) => w.isSaved);
    const now = Date.now();
    if (range === '7days') pool = pool.filter(w => now - w.addedAt < 7 * 24 * 60 * 60 * 1000);
    if (range === '30days') pool = pool.filter(w => now - w.addedAt < 30 * 24 * 60 * 60 * 1000);
    return pool.sort(() => Math.random() - 0.5).slice(0, 15);
  }, [library, started, range, source]);

  const currentWord = testWords[currentIndex];
  const options = useMemo(() => {
    if (!currentWord) return [];
    const others = library.filter((w: any) => w.id !== currentWord.id).sort(() => Math.random() - 0.5).slice(0, 3).map((w: any) => w.meaning);
    return [...others, currentWord.meaning].sort(() => Math.random() - 0.5);
  }, [currentIndex, testWords, library]);

  const handleAnswer = (answer: string) => {
    if (answer === testWords[currentIndex].meaning) setScore(score + 1);
    if (currentIndex + 1 < testWords.length) setCurrentIndex(currentIndex + 1);
    else setIsGameOver(true);
  };

  if (!started) return (
    <div className="h-[70vh] flex flex-col items-center justify-center space-y-8 animate-in fade-in duration-500">
      <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600"><CheckCircle2 className="w-10 h-10" /></div>
      <div className="text-center">
        <h2 className="text-2xl font-black mb-2">測驗設定</h2>
        <p className="text-gray-400 text-sm">每次測驗包含最多 15 個單字</p>
      </div>
      <div className="w-full space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><Calendar className="w-3.5 h-3.5" /> 範圍</p>
          <div className="grid grid-cols-3 gap-2">
            {(['all', '7days', '30days'] as const).map(r => (
              <button key={r} onClick={() => setRange(r)} className={`py-3 rounded-xl text-xs font-bold transition-all border ${range === r ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-400 border-gray-100'}`}>
                {r === 'all' ? '全部' : r === '7days' ? '最近 7 天' : '最近 30 天'}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2"><Bookmark className="w-3.5 h-3.5" /> 類型</p>
          <div className="grid grid-cols-2 gap-2">
            {(['all', 'saved'] as const).map(s => (
              <button key={s} onClick={() => setSource(s)} className={`py-3 rounded-xl text-xs font-bold transition-all border ${source === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-400 border-gray-100'}`}>
                {s === 'all' ? '所有單字' : '只考收藏'}
              </button>
            ))}
          </div>
        </div>
      </div>
      <button onClick={() => setStarted(true)} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all">開始測驗</button>
    </div>
  );

  if (isGameOver) return (
    <div className="h-[70vh] flex flex-col items-center justify-center text-center space-y-8">
      <div className="w-24 h-24 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-600 shadow-lg animate-bounce"><Star className="w-12 h-12 fill-yellow-600" /></div>
      <div>
        <h2 className="text-4xl font-black mb-2">測驗結束！</h2>
        <p className="text-gray-500 text-lg">答對數：<span className="text-indigo-600 font-black">{score} / {testWords.length}</span></p>
      </div>
      <button onClick={() => { setStarted(false); setScore(0); setCurrentIndex(0); setIsGameOver(false); }} className="px-12 py-4 bg-gray-900 text-white rounded-2xl font-bold shadow-xl active:scale-95 transition-all">再考一次</button>
    </div>
  );

  return (
    <div className="space-y-8 animate-in slide-in-from-right duration-500">
      <div className="flex justify-between items-center"><h2 className="text-xl font-bold">單字挑戰</h2><span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full font-bold">{currentIndex + 1} / {testWords.length}</span></div>
      <div className="bg-white rounded-[2.5rem] p-12 shadow-xl border border-gray-100 text-center"><h3 className="text-5xl font-black japanese-text text-indigo-900">{currentWord.kanji}</h3></div>
      <div className="grid gap-3">
        {options.map((opt, i) => <button key={i} onClick={() => handleAnswer(opt)} className="w-full text-left p-5 rounded-2xl bg-white border border-gray-100 hover:bg-indigo-50 hover:border-indigo-300 transition-all font-medium text-gray-700 active:scale-95">{opt}</button>)}
      </div>
    </div>
  );
};

const AuthView = ({ user, onBack, onSync, isSyncing }: { user: UserProfile | null, onBack: () => void, onSync: () => void, isSyncing: boolean }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setError('');
    try {
      if (isLogin) {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
      } else {
        const { error: authError } = await supabase.auth.signUp({ email, password });
        if (authError) throw authError;
        alert('驗證信已寄出，請檢查信箱以完成註冊！');
      }
      onBack();
    } catch (err: any) { setError(err.message || '認證失敗，請檢查資料'); }
    finally { setLoading(false); }
  };

  const handleSignOut = async () => { await supabaseService.signOut(); onBack(); };
  
  if (user) return (
    <div className="space-y-8 animate-in slide-in-from-right duration-300">
      <div className="flex items-center gap-4"><button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full"><X className="w-6 h-6" /></button><h2 className="text-2xl font-bold">雲端帳號</h2></div>
      <div className="bg-white rounded-3xl p-8 text-center shadow-sm border border-gray-100">
        <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4"><UserIcon className="w-10 h-10" /></div>
        <h3 className="font-bold text-lg mb-1">{user.email}</h3>
        <p className="text-gray-400 text-sm mb-8">您的資料正在即時同步中</p>
        
        <div className="space-y-3">
          <button 
            onClick={onSync} 
            disabled={isSyncing}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-indigo-50 text-indigo-600 font-bold hover:bg-indigo-100 transition-colors"
          >
            {isSyncing ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCcw className="w-5 h-5" />}
            {isSyncing ? '同步中...' : '手動觸發同步'}
          </button>
          
          <button 
            onClick={handleSignOut} 
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-gray-50 text-red-500 font-bold hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-5 h-5" /> 登出帳號
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-in slide-in-from-right duration-300">
      <div className="flex items-center gap-4"><button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full"><X className="w-6 h-6" /></button><h2 className="text-2xl font-bold">{isLogin ? '登入雲端' : '註冊帳號'}</h2></div>
      <form onSubmit={handleAuth} className="space-y-4">
        {error && <div className="p-4 bg-red-50 text-red-500 text-sm rounded-2xl font-medium">{error}</div>}
        <div className="relative"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /><input type="email" placeholder="電子郵件" required className="w-full bg-white border border-gray-200 rounded-2xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="relative"><Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /><input type="password" placeholder="密碼" required className="w-full bg-white border border-gray-200 rounded-2xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <button disabled={loading} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold shadow-xl flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all">{loading ? <Loader2 className="w-5 h-5 animate-spin" /> : isLogin ? '登入' : '立即註冊'}</button>
        <p className="text-center text-gray-500 text-sm pt-4">{isLogin ? '還沒有帳號？' : '已經有帳號？'}<button type="button" onClick={() => setIsLogin(!isLogin)} className="ml-2 text-indigo-600 font-bold hover:underline">{isLogin ? '立即註冊' : '登入帳號'}</button></p>
      </form>
    </div>
  );
};

export default App;
