
import React, { useState, useEffect, useMemo } from 'react';
import { Word, GrammarPoint, ViewState, AnalysisResult, UserProfile } from './types';
import { gemini } from './services/gemini';
import { db } from './services/db';
import { supabase, supabaseService } from './services/supabase';
import {
  Camera,
  Image as ImageIcon,
  BookOpen,
  Star,
  RotateCcw,
  PartyPopper,
  Trash2,
  Mic,
  Volume2,
  Upload,
  X,
  Search,
  Filter,
  ScrollText,
  Bookmark,
  BookmarkCheck,
  Layers,
  BrainCircuit,
  Plus,
  Loader2,
  CheckCircle2,
  Download,
  Database,
  RefreshCcw,
  CloudAlert,
  LogIn,
  LogOut,
  User as UserIcon,
  Mail,
  Calendar,
  Lock,
  ChevronLeft,
  ChevronRight
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

          const newWords: Word[] = (result.words || []).map(w => ({
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

          const newGrammar: GrammarPoint[] = (result.grammar || []).map(g => ({
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

  const handleDeleteGrammar = async (id: string) => {
    if (window.confirm('確定要刪除這個語法重點嗎？')) {
      const grammar = grammarLibrary.find(g => g.id === id);
      if (grammar) {
        setGrammarLibrary(prev => prev.filter(g => g.id !== id));
        await db.deleteGrammar(id);
        if (currentUser) {
          supabaseService.deleteGrammar(id).catch(e => console.error("雲端刪除失敗", e));
        }
      }
    }
  };

  const handleDeleteWord = async (id: string) => {
    if (window.confirm('確定要刪除這個單字嗎？刪除後無法復原。')) {
      const word = library.find(w => w.id === id);
      if (word) {
        setLibrary(prev => prev.filter(w => w.id !== id));
        await db.deleteWord(id);
        if (currentUser) {
          supabaseService.deleteWord(id).catch(e => console.error("雲端刪除失敗", e));
        }
      }
    }
  };

  const updateMastery = async (id: string, direction: 'known' | 'unknown' | 'too_hard') => {
    const word = library.find(w => w.id === id);
    if (word) {
      let level = 1; // Default: unknown / learning
      if (direction === 'known') level = 2;
      if (direction === 'too_hard') level = 3;

      // Keep bookmark status even if mastered
      const isSaved = word.isSaved;

      const updatedWord = { ...word, masteryLevel: level, isSaved };
      setLibrary(prev => prev.map(w => w.id === id ? updatedWord : w));
      await db.updateWord(id, { masteryLevel: level, isSaved });
      if (currentUser) {
        supabaseService.upsertWord(updatedWord).catch(e => console.error("雲端同步失敗", e));
      }
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-gray-50 flex flex-col relative pb-24 shadow-2xl">
      <header 
        className="sticky top-0 z-20 bg-white/90 backdrop-blur-md px-6 pb-4 flex justify-between items-center border-b border-gray-100"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}
      >
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
            {activeView === 'home' && <HomeView onUpload={handleFileUpload} library={library} currentUser={currentUser} isConfigured={isCloudConfigured} onAuth={() => setActiveView('auth')} />}
            {activeView === 'library' && <LibraryView library={library} filter={libraryFilter} setFilter={setLibraryFilter} onToggleSave={toggleSaveWord} onDelete={handleDeleteWord} />}
            {activeView === 'flashcards' && (
              <FlashcardView
                library={library}
                onMastered={(id: string) => updateMastery(id, 'known')}
                onFail={(id: string) => updateMastery(id, 'unknown')}
                onTooHard={(id: string) => updateMastery(id, 'too_hard')}
              />
            )}
            {activeView === 'test' && <ResultsView library={library} />}
            {activeView === 'grammar' && (
              <GrammarLibraryView
                grammarItems={grammarLibrary}
                onUpdateRating={updateGrammarRating}
                onDelete={handleDeleteGrammar}
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
        <NavItem icon={<PartyPopper />} label="成果" active={activeView === 'test'} onClick={() => setActiveView('test')} />
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

const HomeView = ({ onUpload, library, currentUser, isConfigured, onAuth }: any) => {
  const masteredCount = library.filter((w: any) => w.masteryLevel === 2).length;
  const masteryPercent = library.length > 0 ? Math.round((masteredCount / library.length) * 100) : 0;
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10"><Database className="w-40 h-40 rotate-12" /></div>
        <h2 className="text-2xl font-black mb-2 relative z-10 leading-tight">你好呀！<br />準備好學習了嗎？</h2>
        <p className="text-indigo-100 opacity-90 mb-8 text-sm relative z-10 font-medium">
          {!isConfigured ? "請依照指示設定 Supabase 金鑰以啟用同步。" : currentUser ? `已登入：${currentUser.email}` : <button onClick={onAuth} className="underline hover:text-white transition-colors">點此登入雲端</button>}
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

const LibraryView = ({ library, filter, setFilter, onToggleSave, onDelete }: any) => {
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
          <WordCard key={word.id} word={word} onToggleSave={onToggleSave} onDelete={onDelete} />
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

const GrammarLibraryView = ({ grammarItems, onUpdateRating, onDelete }: any) => {
  const [filter, setFilter] = useState<'all' | 'saved'>('all');

  const filteredItems = useMemo(() => {
    return filter === 'all' ? grammarItems : grammarItems.filter((g: any) => g.rating > 0);
  }, [grammarItems, filter]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <ScrollText className="w-6 h-6 text-indigo-600" />
          語法重點 ({filteredItems.length})
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
        {filteredItems.map((item: any) => (
          <div key={item.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 group relative">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-bold text-indigo-600 japanese-text pr-8">{item.point}</h3>
              <div className="flex gap-1">
                <button
                  onClick={() => onDelete(item.id)}
                  className="p-2 hover:bg-red-50 text-gray-300 hover:text-red-500 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                  title="刪除"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => onUpdateRating(item.id, item.rating > 0 ? 0 : 1)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  {item.rating > 0 ? (
                    <BookmarkCheck className="w-6 h-6 text-yellow-500 fill-yellow-500" />
                  ) : (
                    <Bookmark className="w-6 h-6 text-gray-300" />
                  )}
                </button>
              </div>
            </div>

            <p className="text-gray-700 text-sm leading-relaxed mb-4 bg-gray-50 p-4 rounded-xl">{item.explanation}</p>
            <div className="border-t border-gray-50 pt-4">
              <p className="text-[10px] uppercase font-bold text-gray-400 mb-1 tracking-widest">範例</p>
              <p className="japanese-text text-gray-800 font-medium">{item.example}</p>
            </div>
          </div>
        ))}
        {filteredItems.length === 0 && (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
            <p className="text-gray-400">{filter === 'all' ? '目前還沒有語法重點，快去掃描吧！' : '目前沒有收藏的語法重點'}</p>
          </div>
        )}
      </div>
    </div>
  );
};

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

import FlashcardSession from './components/FlashcardSession';

const FlashcardView = ({ library, onMastered, onFail, onTooHard }: any) => {
  const [filter, setFilter] = useState<'saved' | 'new' | 'too_hard' | 'learning' | 'mastered' | null>(null);

  // Compute counts for the selection screen
  const counts = useMemo(() => ({
    saved: library.filter((w: any) => w.isSaved).length,
    new: library.filter((w: any) => w.isSaved && w.masteryLevel === 0).length,
    too_hard: library.filter((w: any) => w.isSaved && w.masteryLevel === 3).length,
    learning: library.filter((w: any) => w.isSaved && w.masteryLevel === 1).length,
    mastered: library.filter((w: any) => w.isSaved && w.masteryLevel === 2).length,
  }), [library]);

  const words = useMemo(() => {
    if (!filter) return [];
    if (filter === 'saved') return library.filter((w: any) => w.isSaved);
    if (filter === 'new') return library.filter((w: any) => w.isSaved && w.masteryLevel === 0);
    if (filter === 'too_hard') return library.filter((w: any) => w.isSaved && w.masteryLevel === 3);
    if (filter === 'learning') return library.filter((w: any) => w.isSaved && w.masteryLevel === 1);
    if (filter === 'mastered') return library.filter((w: any) => w.isSaved && w.masteryLevel === 2);
    return [];
  }, [library, filter]);

  // View: Selection Screen (Initial State)
  if (!filter) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <h2 className="text-2xl font-black text-gray-900 mb-6">你要複習哪一類？</h2>
        <div className="grid grid-cols-1 gap-4">
          <button
            onClick={() => setFilter('saved')}
            className="group relative p-6 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-3xl text-white shadow-xl hover:shadow-2xl transition-all active:scale-95 flex items-center justify-between overflow-hidden"
          >
            <div className="relative z-10 flex flex-col items-start">
              <span className="text-3xl font-black">{counts.saved}</span>
              <span className="text-sm font-bold opacity-80">全部單字</span>
            </div>
            <Layers className="w-12 h-12 opacity-20 absolute right-4 bottom-4 group-hover:scale-125 transition-transform" />
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center relative z-10"><ChevronRight className="w-5 h-5 text-white" /></div>
          </button>

          <div className="grid grid-cols-2 gap-4">
            {[
              { id: 'new', label: '新單字', count: counts.new, icon: Star, color: 'bg-orange-50 text-orange-600', hover: 'hover:bg-orange-100' },
              { id: 'mastered', label: '已記住', count: counts.mastered, icon: CheckCircle2, color: 'bg-green-50 text-green-600', hover: 'hover:bg-green-100' },
              { id: 'learning', label: '還不熟', count: counts.learning, icon: BrainCircuit, color: 'bg-indigo-50 text-indigo-600', hover: 'hover:bg-indigo-100' },
              { id: 'too_hard', label: '太難了', count: counts.too_hard, icon: CloudAlert, color: 'bg-red-50 text-red-600', hover: 'hover:bg-red-100' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setFilter(item.id as any)}
                className={`p-5 rounded-3xl transition-all active:scale-95 flex flex-col items-start gap-3 shadow-sm border border-transparent hover:border-black/5 ${item.color} ${item.hover}`}
              >
                <item.icon className="w-6 h-6" />
                <div>
                  <span className="text-2xl font-black block">{item.count}</span>
                  <span className="text-xs font-bold opacity-70">{item.label}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // View: Empty State for Filter
  if (words.length === 0) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex justify-between items-center">
          <button onClick={() => setFilter(null)} className="p-2 -ml-2 hover:bg-gray-100 rounded-full text-gray-500"><ChevronLeft className="w-6 h-6" /></button>
          <h2 className="text-xl font-bold">閃卡複習</h2>
          <div className="w-10"></div>{/* Spacer */}
        </div>
        <div className="text-center py-24 px-8 bg-white rounded-[2.5rem] border-2 border-dashed border-gray-100 flex flex-col items-center justify-center">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4 text-gray-300">
            <Layers className="w-8 h-8" />
          </div>
          <p className="text-gray-900 font-bold mb-1">找不到相關單字</p>
          <p className="text-gray-400 text-sm mb-6">這個分類目前是空的</p>
          <button onClick={() => setFilter(null)} className="px-6 py-3 bg-indigo-50 text-indigo-600 font-bold rounded-xl text-sm hover:bg-indigo-100 transition-colors">
            選擇其他分類
          </button>
        </div>
      </div>
    );
  }

  const getFilterName = (f: string) => {
    switch (f) {
      case 'saved': return '全部待背';
      case 'new': return '新單字';
      case 'too_hard': return '太難了';
      case 'learning': return '還不熟';
      case 'mastered': return '已記住';
      default: return '複習';
    }
  };

  return (
    <FlashcardSession
      key={filter} // Key forces remount on filter change, resetting index
      words={words}
      onMastered={onMastered}
      onFail={onFail}
      onTooHard={onTooHard}
      onBack={() => setFilter(null)}
      filterName={getFilterName(filter)}
    />
  );
};

const ResultsView = ({ library }: any) => {
  const [filter, setFilter] = useState<'all' | 'mastered' | 'learning' | 'too_hard'>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [selectedWordIndex, setSelectedWordIndex] = useState<number | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);

  const filteredLibrary = useMemo(() => {
    let result = library;

    // Filter by mastery level
    if (filter === 'mastered') result = library.filter((w: any) => w.masteryLevel === 2);
    else if (filter === 'learning') result = library.filter((w: any) => w.masteryLevel === 1);
    else if (filter === 'too_hard') result = library.filter((w: any) => w.masteryLevel === 3);

    // Sort by date
    return result.sort((a: any, b: any) => {
      return sortOrder === 'newest' ? b.addedAt - a.addedAt : a.addedAt - b.addedAt;
    });
  }, [library, filter, sortOrder]);

  useEffect(() => {
    setIsFlipped(false);
  }, [selectedWordIndex]);

  const getStatusBadge = (level: number) => {
    if (level === 2) return <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded-lg text-[10px] font-bold">記住了</span>;
    if (level === 3) return <span className="bg-red-100 text-red-700 px-2 py-1 rounded-lg text-[10px] font-bold">太難了</span>;
    if (level === 1) return <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-lg text-[10px] font-bold">還不熟</span>;
    return <span className="bg-gray-50 text-gray-400 px-2 py-1 rounded-lg text-[10px] font-bold">新單字</span>;
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedWordIndex !== null && selectedWordIndex < filteredLibrary.length - 1) {
      setSelectedWordIndex(selectedWordIndex + 1);
    }
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedWordIndex !== null && selectedWordIndex > 0) {
      setSelectedWordIndex(selectedWordIndex - 1);
    }
  };

  // Calculate counts for filters
  const counts = {
    all: library.length,
    mastered: library.filter((w: any) => w.masteryLevel === 2).length,
    learning: library.filter((w: any) => w.masteryLevel === 1).length,
    too_hard: library.filter((w: any) => w.masteryLevel === 3).length
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <PartyPopper className="w-6 h-6 text-indigo-600" />
          學習成果 ({filteredLibrary.length})
        </h2>
        <button onClick={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')} className="text-xs font-bold text-gray-400 hover:text-indigo-600 flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {sortOrder === 'newest' ? '最新優先' : '舊的優先'}
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
        {[
          { id: 'all', label: `全部 (${counts.all})` },
          { id: 'mastered', label: `記住了 (${counts.mastered})`, color: 'bg-indigo-50 text-indigo-600' },
          { id: 'learning', label: `還不熟 (${counts.learning})`, color: 'bg-gray-50 text-gray-600' },
          { id: 'too_hard', label: `太難了 (${counts.too_hard})`, color: 'bg-red-50 text-red-600' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => { setFilter(tab.id as any); setSelectedWordIndex(null); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${filter === tab.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : tab.color || 'bg-white border border-gray-100 text-gray-400'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 pb-20">
        {filteredLibrary.map((word: Word, index: number) => (
          <div
            key={word.id}
            onClick={() => setSelectedWordIndex(index)}
            className="bg-white p-4 rounded-2xl border border-gray-100 flex justify-between items-center shadow-sm cursor-pointer hover:border-indigo-200 hover:bg-indigo-50/30 transition-all active:scale-95"
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-black text-lg japanese-text">{word.kanji}</h3>
                {getStatusBadge(word.masteryLevel)}
              </div>
              <p className="text-xs text-gray-400">{word.meaning} · {word.furigana}</p>
            </div>
            <div className="text-[10px] font-bold text-gray-300">
              {new Date(word.addedAt).toLocaleDateString()}
            </div>
          </div>
        ))}
        {filteredLibrary.length === 0 && (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
            <p className="text-gray-400">沒有符合條件的單字</p>
          </div>
        )}
      </div>

      {selectedWordIndex !== null && filteredLibrary[selectedWordIndex] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white rounded-[2.5rem] p-6 shadow-2xl relative flex flex-col items-center">
            <button
              onClick={() => setSelectedWordIndex(null)}
              className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors z-10"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>

            <div onClick={() => setIsFlipped(!isFlipped)} className="w-full h-80 relative cursor-pointer perspective-1000 mt-6 mb-4">
              <div className={`w-full h-full transition-all duration-500 bg-white rounded-[2rem] border-2 border-indigo-50 flex flex-col items-center justify-center ${isFlipped ? 'bg-indigo-50' : ''}`}>
                {!isFlipped ? (
                  <>
                    <h3 className="text-4xl font-black japanese-text text-center text-gray-900">{filteredLibrary[selectedWordIndex].kanji}</h3>
                    <p className="mt-4 text-xs text-indigo-400 font-bold uppercase tracking-widest">點擊翻面</p>
                  </>
                ) : (
                  <div className="text-center w-full max-h-full overflow-y-auto px-4 custom-scrollbar">
                    <h3 className="text-2xl font-black japanese-text mb-1 text-gray-900">{filteredLibrary[selectedWordIndex].kanji}</h3>
                    <p className="text-indigo-600 japanese-text mb-4 text-sm font-medium">【{filteredLibrary[selectedWordIndex].furigana}】</p>
                    <h3 className="text-xl font-bold mb-4 bg-white py-2 rounded-xl text-gray-900 shadow-sm border border-gray-100">{filteredLibrary[selectedWordIndex].meaning}</h3>
                    <p className="text-gray-700 text-sm mb-2 font-medium">{filteredLibrary[selectedWordIndex].example}</p>
                    {filteredLibrary[selectedWordIndex].type === 'verb' && filteredLibrary[selectedWordIndex].conjugations && (
                      <div className="bg-white rounded-xl p-2 text-xs mt-2 border border-blue-100">
                        <p className="text-[10px] text-indigo-400 font-bold mb-1">動詞變化</p>
                        <div className="grid grid-cols-2 gap-1 text-left">
                          <span>ます: {filteredLibrary[selectedWordIndex].conjugations.masu}</span>
                          <span>て: {filteredLibrary[selectedWordIndex].conjugations.te}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between w-full px-4 pt-2">
              <button
                onClick={handlePrev}
                disabled={selectedWordIndex === 0}
                className="p-3 rounded-xl bg-gray-100 text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-indigo-100 hover:text-indigo-600 transition-all active:scale-95"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <span className="font-bold text-gray-400 text-sm">
                {selectedWordIndex + 1} / {filteredLibrary.length}
              </span>
              <button
                onClick={handleNext}
                disabled={selectedWordIndex === filteredLibrary.length - 1}
                className="p-3 rounded-xl bg-gray-100 text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-indigo-100 hover:text-indigo-600 transition-all active:scale-95"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      )}
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
