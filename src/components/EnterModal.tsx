import React from 'react';
import { soundService } from '../services/soundAndTts';
import { Sparkles, Coins, Zap, Shield } from 'lucide-react';

interface EnterModalProps {
  onEnter: () => void;
}

export const EnterModal: React.FC<EnterModalProps> = ({ onEnter }) => {
  const handleStart = () => {
    soundService.unlockAudio();
    soundService.playCashSound();
    soundService.speak(
      'Reis hoş geldin mıntıkaya! Masalar tütüyor, içeride para kokusu var!',
      'cirak'
    );
    onEnter();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md">
      <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-purple-200 text-center animate-in fade-in zoom-in-95 duration-200">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-tr from-purple-600 via-pink-500 to-rose-400 flex items-center justify-center text-3xl shadow-lg shadow-purple-500/25">
          🗡️
        </div>

        <h2 className="font-display font-extrabold text-2xl text-slate-900 tracking-tight mb-2">
          Mıntıka Seni Bekliyor!
        </h2>

        <p className="text-sm text-slate-600 leading-relaxed mb-6">
          İstanbul arka sokaklarının en gözü kara tefecisisin. 5 kurnaz trader canlı Binance Futures tahtalarında scalping yapıyor. Parası biten kapına dayanacak, faizi sen belirleyeceksin!
        </p>

        <div className="grid grid-cols-2 gap-2 text-left mb-6 bg-purple-50/70 p-3.5 rounded-2xl border border-purple-100">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-purple-600 shrink-0" />
            <span className="text-xs font-semibold text-slate-800">50,000$ Başlangıç</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-pink-600 shrink-0" />
            <span className="text-xs font-semibold text-slate-800">Canlı Binance WSS</span>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
            <span className="text-xs font-semibold text-slate-800">Türkçe Sesli TTS</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-pink-600 shrink-0" />
            <span className="text-xs font-semibold text-slate-800">Çırak & Tehdit Masası</span>
          </div>
        </div>

        <button
          onClick={handleStart}
          className="w-full h-13 rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-rose-500 text-white font-bold text-base shadow-lg shadow-purple-600/30 hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          <span>Mahalleye Gir</span>
          <span className="text-lg">➔</span>
        </button>

        <p className="mt-3 text-[11px] text-slate-400">
          *Hoparlörü açın; Çırak Ferhat ve traderlar sesli konuşacaktır.
        </p>
      </div>
    </div>
  );
};
