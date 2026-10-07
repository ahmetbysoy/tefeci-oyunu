import React from 'react';
import { NewsEvent } from '../types';
import { Volume2, Sparkles, AlertTriangle, ShieldCheck, Flame, TrendingUp } from 'lucide-react';
import { soundService } from '../services/soundAndTts';
import { CHARACTER_DATA } from '../services/dialogues';

interface NewsFeedTabProps {
  news: NewsEvent[];
}

export const NewsFeedTab: React.FC<NewsFeedTabProps> = ({ news }) => {
  const getBadgeStyle = (type: NewsEvent['type']) => {
    switch (type) {
      case 'LIQUIDATION':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'MASSIVE_PROFIT':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'THREAT':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'LOAN_OVERDUE':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-pink-50 text-pink-700 border-pink-200';
    }
  };

  const handleSpeakEvent = (event: NewsEvent) => {
    soundService.speak(event.message, event.speaker);
  };

  return (
    <div className="space-y-3">
      {/* Newspaper Header */}
      <div className="bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 p-4 rounded-3xl text-white shadow-sm flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-pink-200 font-semibold tracking-wider uppercase">
            <span>Çırak Gazetesi</span>
            <span>·</span>
            <span>Canlı Sokak Bülteni</span>
          </div>
          <h2 className="font-display font-black text-lg tracking-tight mt-0.5">
            Mıntıkada Neler Dönüyor?
          </h2>
        </div>
        <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-xl">
          📰
        </div>
      </div>

      {/* Events List */}
      {news.length === 0 ? (
        <div className="bg-white rounded-3xl p-6 border border-purple-100 text-center text-xs text-slate-500">
          Henüz yeni bir vukuat yok. Mahalle sakin ama traderlar tetikte!
        </div>
      ) : (
        <div className="space-y-2.5">
          {news.map((item) => {
            const char = CHARACTER_DATA[item.speaker];
            const timeStr = new Date(item.timestamp).toLocaleTimeString('tr-TR', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });

            return (
              <div
                key={item.id}
                className={`bg-white rounded-2xl p-3.5 border transition-all ${
                  item.urgent
                    ? 'border-rose-300 ring-2 ring-rose-500/15 shadow-sm'
                    : 'border-purple-100'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{char.badgeIcon}</span>
                    <span className="font-bold text-xs text-slate-900">
                      {item.speakerName}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {timeStr}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getBadgeStyle(
                        item.type
                      )}`}
                    >
                      {item.badge}
                    </span>

                    <button
                      onClick={() => handleSpeakEvent(item)}
                      title="Sesli Dinle"
                      className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed pl-6">
                  {item.message}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
