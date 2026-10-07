import React, { useState, useEffect } from 'react';
import { binanceFeed } from '../services/binanceFeed';
import { exportLossLogsAsJson, exportLossLogsAsMarkdown } from '../services/logExporter';
import { DecisionLog } from '../types';
import { X, RotateCcw, Plus, FileText, Code, Gauge } from 'lucide-react';

interface SettingsModalProps {
  currentCash: number;
  decisionLogs: DecisionLog[];
  onClose: () => void;
  onResetGame: (startingCash: number) => void;
  soundEnabled: boolean;
  ttsEnabled: boolean;
  onToggleSound: () => void;
  onToggleTts: () => void;
  minimumLeverage: number;
  onMinimumLeverageChange: (minimumLeverage: number) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  currentCash,
  decisionLogs,
  onClose,
  onResetGame,
  soundEnabled,
  ttsEnabled,
  onToggleSound,
  onToggleTts,
  minimumLeverage,
  onMinimumLeverageChange,
}) => {
  const [selectedCoins, setSelectedCoins] = useState<string[]>(binanceFeed.getSymbols());
  const [availableCoins, setAvailableCoins] = useState<string[]>([]);
  const [coinInput, setCoinInput] = useState<string>('');
  const [cashInput, setCashInput] = useState<number>(50000);
  const [resetConfirmed, setResetConfirmed] = useState<boolean>(false);

  useEffect(() => {
    binanceFeed.fetchAvailableFuturesSymbols().then((list) => {
      setAvailableCoins(list);
    });
  }, []);

  const handleAddCoin = (symbol: string) => {
    const formatted = symbol.trim().toUpperCase();
    if (!formatted.endsWith('USDT')) return;
    if (selectedCoins.includes(formatted)) return;

    const updated = [...selectedCoins, formatted];
    setSelectedCoins(updated);
    binanceFeed.setSymbols(updated);
    setCoinInput('');
  };

  const handleRemoveCoin = (symbol: string) => {
    if (selectedCoins.length <= 1) return;
    const updated = selectedCoins.filter((s) => s !== symbol);
    setSelectedCoins(updated);
    binanceFeed.setSymbols(updated);
  };

  const filteredSuggestions = availableCoins
    .filter(
      (c) =>
        c.toLowerCase().includes(coinInput.toLowerCase()) &&
        !selectedCoins.includes(c)
    )
    .slice(0, 5);

  const lossCount = decisionLogs.filter((l) => l.realizedPnl < 0).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md">
      <div className="w-full max-w-lg bg-white rounded-3xl p-5 sm:p-6 shadow-2xl border border-purple-200 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700 text-lg">
              ⚙️
            </div>
            <div>
              <h3 className="font-display font-extrabold text-slate-900 text-base">
                Mıntıka Ayarları & Log İndir
              </h3>
              <p className="text-xs text-slate-500">Kasa, coin havuzu ve yapay zeka analiz raporları</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Section 1: AI Log Exporter */}
        <div className="bg-purple-50/70 p-4 rounded-2xl border border-purple-100 mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="font-display font-bold text-xs text-purple-950">
              Zarar Loglarını İndir (AI İyileştirmesi İçin)
            </span>
            <span className="text-[10px] font-mono font-bold bg-purple-200/60 text-purple-800 px-2 py-0.5 rounded-md">
              {lossCount} Zararlı İşlem
            </span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed mb-3">
            Tüm zarar eden pozisyonları, giriş anındaki gerçek indikatör değerleri (RSI, EMA, Bollinger, Derinlik, Fonlama) ve matematiksel nedenleriyle indirip ChatGPT / Claude gibi yapay zeka modellerine vererek stratejileri geliştirebilirsiniz.
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={() => exportLossLogsAsJson(decisionLogs)}
              className="flex-1 h-9 rounded-xl bg-white border border-purple-200 hover:bg-purple-50 text-purple-900 font-bold text-xs shadow-2xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <Code className="w-3.5 h-3.5 text-purple-600" />
              <span>JSON İndir (Ham Veri)</span>
            </button>

            <button
              onClick={() => exportLossLogsAsMarkdown(decisionLogs)}
              className="flex-1 h-9 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs shadow-2xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Markdown Raporu İndir</span>
            </button>
          </div>
        </div>

        {/* Section 2: Futures Coin Selection */}
        <div className="mb-5">
          <label className="block text-xs font-bold text-slate-800 mb-1.5">
            Mıntıka Coin Havuzu (Binance Futures USDT)
          </label>
          <p className="text-[11px] text-slate-500 mb-2">
            Traderlar aşağıdaki coinleri ortak havuzdan tarar ve kendi stratejilerine göre işlem açar.
          </p>

          {/* Active coin chips */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {selectedCoins.map((sym) => (
              <span
                key={sym}
                className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-mono font-semibold px-2.5 py-1 rounded-lg border border-slate-200"
              >
                <span>{sym}</span>
                {selectedCoins.length > 1 && (
                  <button
                    onClick={() => handleRemoveCoin(sym)}
                    className="hover:text-rose-600 transition-colors ml-0.5"
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
          </div>

          {/* Coin search & autocomplete */}
          <div className="relative">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Örn: BTCUSDT, SUIUSDT, NEARUSDT"
                value={coinInput}
                onChange={(e) => setCoinInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && coinInput) {
                    handleAddCoin(coinInput);
                  }
                }}
                className="flex-1 h-10 px-3 rounded-xl border border-slate-200 text-xs font-mono focus:outline-hidden focus:border-purple-600"
              />
              <button
                onClick={() => coinInput && handleAddCoin(coinInput)}
                className="h-10 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Ekle</span>
              </button>
            </div>

            {coinInput && filteredSuggestions.length > 0 && (
              <div className="absolute top-11 left-0 right-0 bg-white rounded-xl shadow-lg border border-purple-100 p-1.5 z-20 space-y-1">
                {filteredSuggestions.map((sug) => (
                  <button
                    key={sug}
                    onClick={() => handleAddCoin(sug)}
                    className="w-full text-left px-3 py-1.5 hover:bg-purple-50 rounded-lg text-xs font-mono text-slate-800 flex justify-between"
                  >
                    <span>{sug}</span>
                    <span className="text-[10px] text-purple-600 font-sans">Ekle +</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Section 3: Global leverage floor */}
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                <Gauge className="w-4 h-4" />
              </span>
              <div>
                <label htmlFor="minimum-leverage" className="block text-xs font-bold text-amber-950">
                  Minimum Kaldıraç
                </label>
                <p className="text-[10px] text-amber-800/75">Yalnızca bundan sonra açılacak işlemler</p>
              </div>
            </div>
            <span className="min-w-14 text-center rounded-xl bg-amber-600 px-2.5 py-1.5 font-mono text-base font-black text-white tabular-nums">
              {minimumLeverage}x
            </span>
          </div>

          <input
            id="minimum-leverage"
            type="range"
            min={1}
            max={50}
            step={1}
            value={minimumLeverage}
            onChange={(event) => onMinimumLeverageChange(Number(event.target.value))}
            className="w-full accent-amber-600 cursor-pointer"
            aria-valuetext={`${minimumLeverage} kat kaldıraç`}
          />

          <div className="grid grid-cols-5 gap-1.5 mt-2">
            {[2, 5, 10, 20, 50].map((leverage) => (
              <button
                key={leverage}
                type="button"
                onClick={() => onMinimumLeverageChange(leverage)}
                className={`rounded-lg border py-1 text-[10px] font-mono font-bold transition-colors ${
                  minimumLeverage === leverage
                    ? 'border-amber-600 bg-amber-600 text-white'
                    : 'border-amber-200 bg-white text-amber-900 hover:bg-amber-100'
                }`}
              >
                {leverage}x
              </button>
            ))}
          </div>

          <p className={`mt-2.5 text-[10px] leading-relaxed ${
            minimumLeverage >= 20 ? 'font-bold text-rose-700' : 'text-amber-900/75'
          }`}>
            Bu taban karakterlerin kişisel kaldıraç tavanını geçebilir. 20x ve üzeri,
            stop mesafesini ve likidasyon toleransını ciddi biçimde daraltır; mutlak motor sınırı 50x'tir.
          </p>
        </div>

        {/* Section 4: Sound & TTS */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          <button
            onClick={onToggleSound}
            className={`p-3 rounded-2xl border text-left transition-all ${
              soundEnabled
                ? 'bg-purple-50/70 border-purple-200 text-purple-900'
                : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}
          >
            <div className="text-xs font-bold mb-0.5">Web Audio Efektleri</div>
            <div className="text-[10px] opacity-75">
              {soundEnabled ? 'Açık (Kasa, Alarm, Gong)' : 'Kapalı'}
            </div>
          </button>

          <button
            onClick={onToggleTts}
            className={`p-3 rounded-2xl border text-left transition-all ${
              ttsEnabled
                ? 'bg-pink-50/70 border-pink-200 text-pink-900'
                : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}
          >
            <div className="text-xs font-bold mb-0.5">Türkçe Sesli TTS</div>
            <div className="text-[10px] opacity-75">
              {ttsEnabled ? 'Açık (Karakterler Konuşur)' : 'Kapalı'}
            </div>
          </button>
        </div>

        {/* Section 5: Reset Game Cash */}
        <div className="pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-800">
              Kasayı Sıfırla & Yeni Oyun
            </span>
            <span className="text-xs font-mono text-purple-700">
              Şu an: ${currentCash.toLocaleString()}
            </span>
          </div>

          <p className="text-[10px] text-slate-500 mb-2">
            Yeni sezon açılır; açık masa ve sezon istatistikleri sıfırlanır. Ömür boyu Sicil korunur, kapanmamış aktif borçlar temerrüt olarak kredi geçmişine işlenir.
          </p>

          <div className="flex gap-2 mb-3">
            {[20000, 50000, 100000].map((amount) => (
              <button
                key={amount}
                onClick={() => setCashInput(amount)}
                className={`flex-1 py-1.5 rounded-xl text-xs font-mono font-bold border transition-colors ${
                  cashInput === amount
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                ${(amount / 1000).toFixed(0)}k
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              onResetGame(cashInput);
              setResetConfirmed(true);
              setTimeout(() => {
                setResetConfirmed(false);
                onClose();
              }, 1000);
            }}
            className="w-full h-11 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>
              {resetConfirmed
                ? 'Kasa Başarıyla Sıfırlandı!'
                : `Tüm Masaları Sıfırla (${cashInput.toLocaleString()}$)`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
