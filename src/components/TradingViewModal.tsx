import React from 'react';
import { X, ExternalLink, LineChart } from 'lucide-react';

interface TradingViewModalProps {
  symbol: string;
  onClose: () => void;
}

export const TradingViewModal: React.FC<TradingViewModalProps> = ({
  symbol,
  onClose,
}) => {
  const tvSymbol = `BINANCE:${symbol}.P`;
  const tvUrl = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tvSymbol)}`;
  // Embed TradingView lightweight widget URL
  const embedUrl = `https://s.tradingview.com/widgetembed/?frameElementId=tradingview_widget&symbol=${encodeURIComponent(
    tvSymbol
  )}&interval=1&hidesidetoolbar=0&symboledit=1&saveimage=0&toolbarbg=f1f3f6&studies=[]&theme=light&style=1&timezone=Europe%2FIstanbul&studies_overrides={}&overrides={}&enabled_features=[]&disabled_features=[]&locale=tr`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-md">
      <div className="w-full max-w-4xl h-[85vh] bg-white rounded-3xl shadow-2xl border border-purple-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Top Header */}
        <div className="px-4 py-3 bg-purple-50/80 border-b border-purple-100 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white flex items-center justify-center text-xs font-black shadow-xs">
              TV
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-extrabold text-slate-900 text-sm">
                  {symbol} Canlı Grafik
                </span>
                <span className="text-[10px] font-mono font-bold bg-purple-200/60 text-purple-800 px-2 py-0.5 rounded-md">
                  Binance Futures Perpetual
                </span>
              </div>
              <div className="text-[11px] text-slate-500">
                TradingView 1 Dakikalık Canlı Mumlar & İndikatörler
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <a
              href={tvUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="h-8 px-3 rounded-xl bg-white border border-purple-200 hover:bg-purple-100 text-purple-900 font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 text-purple-600" />
              <span className="hidden xs:inline">Yeni Sekmede Aç</span>
            </a>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Iframe Body */}
        <div className="flex-1 w-full bg-slate-50 relative">
          <iframe
            title={`TradingView Chart ${symbol}`}
            src={embedUrl}
            className="w-full h-full border-0"
            allow="fullscreen"
          />
        </div>
      </div>
    </div>
  );
};
