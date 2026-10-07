import React from 'react';
import { Settings, Volume2, VolumeX } from 'lucide-react';
import { DataHealthStatus } from '../types';

interface HeaderBarProps {
  cashBalance: number;
  totalDistributedLoans: number;
  totalCollectedInterest: number;
  openPositionsCount: number;
  dataHealth: DataHealthStatus;
  onOpenSettings: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

const healthPresentation: Record<
  DataHealthStatus['status'],
  { label: string; classes: string; dot: string }
> = {
  CONNECTED: {
    label: 'CANLI',
    classes: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500 animate-pulse',
  },
  DEGRADED: {
    label: 'SINIRLI',
    classes: 'bg-amber-50 text-amber-800 border-amber-200',
    dot: 'bg-amber-500',
  },
  CONNECTING: {
    label: 'ISINIYOR',
    classes: 'bg-sky-50 text-sky-700 border-sky-200',
    dot: 'bg-sky-500 animate-pulse',
  },
  BLOCKED: {
    label: 'ERİŞİM ENGELLİ',
    classes: 'bg-rose-50 text-rose-700 border-rose-200',
    dot: 'bg-rose-500',
  },
  OFFLINE: {
    label: 'ÇEVRİMDIŞI',
    classes: 'bg-slate-100 text-slate-600 border-slate-200',
    dot: 'bg-slate-400',
  },
};

export const HeaderBar: React.FC<HeaderBarProps> = ({
  cashBalance,
  totalDistributedLoans,
  totalCollectedInterest,
  openPositionsCount,
  dataHealth,
  onOpenSettings,
  soundEnabled,
  onToggleSound,
}) => {
  const health = healthPresentation[dataHealth.status];
  const shouldWarn = ['BLOCKED', 'OFFLINE', 'CONNECTING'].includes(dataHealth.status);

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-purple-100 shadow-xs px-3 sm:px-4 py-2.5">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 shrink-0 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center text-white font-black text-sm shadow-xs">
            ₺
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-display font-extrabold text-base tracking-tight text-slate-900 leading-tight">
                TEFECİ
              </span>
              <div
                title={`${dataHealth.detail}. Kaynaklar: Binance public/market WebSocket + OI REST.`}
                className={`hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-mono font-bold border ${health.classes}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${health.dot}`} />
                <span>{health.label}</span>
                <span className="opacity-70">
                  C {dataHealth.readySymbols}/{dataHealth.totalSymbols} · OI {dataHealth.oiReadySymbols}/{dataHealth.totalSymbols}
                  {dataHealth.latencyMs !== null && (
                    <span className="hidden lg:inline"> · REST {dataHealth.latencyMs}ms</span>
                  )}
                </span>
              </div>
            </div>
            <div className="text-[10px] text-purple-700 font-semibold tracking-wider uppercase">
              Kripto Mıntıkası
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-slate-500 font-medium">Kasa Bakiyesi</span>
            <span className="text-sm sm:text-base font-bold font-mono text-purple-900 tabular-nums">
              ${cashBalance.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
          </div>

          <div className="hidden xs:flex flex-col items-end border-l border-purple-100 pl-2 sm:pl-3">
            <span className="text-[10px] text-slate-500 font-medium">Dağıtılan Borç</span>
            <span className="text-xs sm:text-sm font-semibold font-mono text-pink-700 tabular-nums">
              ${totalDistributedLoans.toLocaleString()}
            </span>
          </div>

          <div className="flex flex-col items-end border-l border-purple-100 pl-2 sm:pl-3">
            <span className="text-[10px] text-slate-500 font-medium">Faiz Geliri</span>
            <span className="text-xs sm:text-sm font-semibold font-mono text-emerald-700 tabular-nums">
              +${totalCollectedInterest.toLocaleString()}
            </span>
          </div>

          <div className="hidden md:flex flex-col items-end border-l border-purple-100 pl-3">
            <span className="text-[10px] text-slate-500 font-medium">Global Slot</span>
            <span className="text-xs font-bold font-mono text-slate-800">{openPositionsCount}/2</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onToggleSound}
            aria-label={soundEnabled ? 'Sesi Kapat' : 'Sesi Aç'}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-600 hover:text-purple-700 hover:bg-purple-50 transition-colors"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-purple-600" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
          </button>
          <button
            onClick={onOpenSettings}
            aria-label="Ayarlar"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-600 hover:text-purple-700 hover:bg-purple-50 transition-colors"
          >
            <Settings className="w-4 h-4 text-slate-600" />
          </button>
        </div>
      </div>

      <div className={`sm:hidden w-fit max-w-4xl mx-auto mt-2 flex items-center gap-1 rounded-md border px-2 py-1 text-[9px] font-bold ${health.classes}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${health.dot}`} />
        <span>{health.label}</span>
        <span className="font-normal opacity-80">· Çekirdek {dataHealth.readySymbols}/{dataHealth.totalSymbols} · OI {dataHealth.oiReadySymbols}/{dataHealth.totalSymbols}</span>
      </div>

      {shouldWarn && (
        <div className="max-w-4xl mx-auto mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[10px] text-amber-900">
          <strong>{health.label}:</strong> {dataHealth.detail}. Gerekli gerçek kaynaklar güncel olmadan yeni pozisyon açılmaz.
        </div>
      )}
    </header>
  );
};
