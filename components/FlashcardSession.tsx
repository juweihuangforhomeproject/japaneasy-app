import React, { useState } from 'react';
import { PartyPopper, RotateCcw, ChevronLeft } from 'lucide-react';

const FlashcardSession = ({ words, onMastered, onFail, onTooHard, onBack, filterName }: any) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [isCompleted, setIsCompleted] = useState(false);

    const currentWord = words[currentIndex];

    const next = () => {
        if (currentIndex >= words.length - 1) {
            setIsCompleted(true);
        } else {
            setIsFlipped(false);
            setCurrentIndex(prev => prev + 1);
        }
    };

    // Safety check: Ensure currentIndex is within bounds if list shrinks
    React.useEffect(() => {
        if (currentIndex >= words.length && words.length > 0) {
            setCurrentIndex(words.length - 1);
        }
    }, [words.length, currentIndex]);

    if (isCompleted || words.length === 0) {
        return (
            <div className="h-[70vh] flex flex-col items-center justify-center text-center space-y-8 animate-in fade-in duration-500">
                <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center text-green-600 shadow-lg animate-bounce">
                    <PartyPopper className="w-12 h-12" />
                </div>
                <div>
                    <h2 className="text-3xl font-black mb-2">複習完成！</h2>
                    <p className="text-gray-500 text-lg">太棒了！你已經複習完此分類的卡片。</p>
                </div>
                <div className="space-x-4">
                    <button
                        onClick={onBack}
                        className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all inline-flex items-center gap-2"
                    >
                        <ChevronLeft className="w-5 h-5" />
                        回到閃卡首頁
                    </button>
                    <button
                        onClick={() => { setIsCompleted(false); setCurrentIndex(0); setIsFlipped(false); }}
                        className="px-8 py-4 bg-white text-gray-600 border border-gray-200 rounded-2xl font-bold shadow-sm hover:bg-gray-50 active:scale-95 transition-all inline-flex items-center gap-2"
                    >
                        <RotateCcw className="w-5 h-5" />
                        再複習一次
                    </button>
                </div>
            </div>
        );
    }

    if (!currentWord) return <div className="p-20 text-center">Loading card data...</div>;

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom duration-500">
            <div className="flex justify-between items-center">
                <button onClick={onBack} className="p-2 -ml-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all" title="回分類選單"><ChevronLeft className="w-6 h-6" /></button>
                <div className="flex flex-col items-center">
                    <h2 className="text-sm font-bold opacity-50 uppercase tracking-widest">{filterName}</h2>
                </div>
                <span className="text-indigo-600 font-bold bg-indigo-50 px-3 py-1 rounded-full text-xs">{currentIndex + 1} / {words.length}</span>
            </div>

            <div onClick={() => setIsFlipped(!isFlipped)} className="h-[28rem] w-full relative cursor-pointer perspective-1000 group">
                <div className={`w-full h-full transition-all duration-500 bg-white rounded-[2.5rem] p-8 shadow-2xl border-2 flex flex-col items-center justify-center ${isFlipped ? 'bg-indigo-50 text-gray-900 border-indigo-200 rotate-y-180' : 'text-indigo-900 border-white group-hover:border-indigo-100'}`}>
                    {!isFlipped ? (
                        <>
                            <h3 className="text-4xl font-black japanese-text text-center">{currentWord.kanji}</h3>
                            <p className="mt-4 text-xs opacity-40">點擊翻面</p>
                        </>
                    ) : (
                        <div className="text-center w-full max-h-full overflow-y-auto custom-scrollbar">
                            <h3 className="text-2xl font-black japanese-text mb-1 text-gray-900">{currentWord.kanji}</h3>
                            <p className="text-indigo-600 japanese-text mb-4 text-sm font-medium">【{currentWord.furigana}】</p>

                            <h3 className="text-xl font-bold mb-4 bg-white py-2 rounded-xl text-gray-900 shadow-sm border border-gray-100">{currentWord.meaning}</h3>
                            <p className="text-gray-700 text-sm px-4 mb-4 font-medium">{currentWord.example}</p>

                            {currentWord.type === 'verb' && currentWord.conjugations && (
                                <div className="bg-white rounded-xl p-3 text-sm mt-2 mx-2 border border-blue-100 shadow-sm">
                                    <p className="text-[10px] uppercase text-indigo-400 font-bold mb-2 tracking-widest text-left">動詞變化</p>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-left">
                                        <div className="flex justify-between border-b border-gray-100 pb-1"><span className="text-gray-400 text-xs">ます形</span> <span className="japanese-text font-bold text-gray-800">{currentWord.conjugations.masu}</span></div>
                                        <div className="flex justify-between border-b border-gray-100 pb-1"><span className="text-gray-400 text-xs">て形</span> <span className="japanese-text font-bold text-gray-800">{currentWord.conjugations.te}</span></div>
                                        <div className="flex justify-between border-b border-gray-100 pb-1"><span className="text-gray-400 text-xs">ない形</span> <span className="japanese-text font-bold text-gray-800">{currentWord.conjugations.nai}</span></div>
                                        <div className="flex justify-between"><span className="text-gray-400 text-xs">た形</span> <span className="japanese-text font-bold text-gray-800">{currentWord.conjugations.ta}</span></div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
                <button onClick={() => { onTooHard(currentWord.id); next(); }} className="py-4 rounded-2xl bg-red-50 text-red-500 font-bold shadow-sm active:scale-95 transition-all text-sm">太難了</button>
                <button onClick={() => { onFail(currentWord.id); next(); }} className="py-4 rounded-2xl bg-white border border-gray-100 text-gray-500 font-bold shadow-sm active:scale-95 transition-all text-sm">還不熟</button>
                <button onClick={() => { onMastered(currentWord.id); next(); }} className="py-4 rounded-2xl bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-100 active:scale-95 transition-all text-sm">記住了</button>
            </div>
        </div>
    );
};

export default FlashcardSession;
