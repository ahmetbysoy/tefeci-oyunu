import React, { useState } from 'react';
import { DecisionLog, ExitReason, TraderProfile } from '../types';
import { CHARACTER_DATA } from '../services/dialogues';
import {
  Award,
  TrendingUp,
  TrendingDown,
  Clock,
  Shield,
  Target,
  Sparkles,
  Filter,
  CheckCircle,
  XCircle,
  Flame,
  Snowflake,
  ExternalLink,
} from 'lucide-react';

interface SicilTabProps {
  decisionLogs: DecisionLog[];
  traders: Record<string, TraderProfile>;
  seasonId: string;
}

export const SicilTab: React.FC<SicilTabProps> = ({ decisionLogs, traders, seasonId }) => {
  const [filterType, setFilterType] = useState<'all' | 'win' | 'loss'>('all');
  const [selectedTrader, setSelectedTrader] = useState<string>('all');
  const [scope, setScope] = useState<'season' | 'lifetime'>('season');

  const scopedLogs = scope === 'season'
    ? decisionLogs.filter((log) => log.seasonId === seasonId)
    : decisionLogs;

  const filteredLogs = scopedLogs.filter((log) => {
    if (filterType === 'win' && log.realizedPnl < 0) return false;
    if (filterType === 'loss' && log.realizedPnl >= 0) return false;
    if (selectedTrader !== 'all' && log.traderId !== selectedTrader) return false;
    return true;
  });

  // Calculate Metrics
  const totalTrades = scopedLogs.length;
  const wins = scopedLogs.filter((l) => l.realizedPnl >= 0);
  const losses = scopedLogs.filter((l) => l.realizedPnl < 0);
  const totalWinAmount = wins.reduce((acc, l) => acc + l.realizedPnl, 0);
  const totalLossAmount = Math.abs(losses.reduce((acc, l) => acc + l.realizedPnl, 0));
  const cumulativePnl = scopedLogs.reduce((acc, l) => acc + l.realizedPnl, 0);

  const winRate = totalTrades > 0 ? (wins.length / totalTrades) * 100 : 0;
  const profitFactor = totalLossAmount > 0
    ? totalWinAmount / totalLossAmount
    : totalWinAmount > 0
      ? Number.POSITIVE_INFINITY
      : 0;

  const avgWin = wins.length > 0 ? totalWinAmount / wins.length : 0;
  const avgLoss = losses.length > 0 ? totalLossAmount / losses.length : 0;
  const expectancy =
    totalTrades > 0
      ? (winRate / 100) * avgWin - ((100 - winRate) / 100) * avgLoss
      : 0;

  const knownDurations = scopedLogs
    .map((log) => log.holdingDurationSeconds)
    .filter((duration) => duration >= 0);
  const avgDuration = knownDurations.length > 0
    ? Math.round(knownDurations.reduce((sum, duration) => sum + duration, 0) / knownDurations.length)
    : null;

  // Generate Cumulative PnL curve data points for SVG
  const pnlCurvePoints = (() => {
    if (scopedLogs.length === 0) return [];
    // Chronological order (oldest to newest)
    const reversed = [...scopedLogs].sort((a, b) => a.timestamp - b.timestamp);
    let current = 0;
    const points: number[] = [0];
    reversed.forEach((l) => {
      current += l.realizedPnl;
      points.push(current);
    });
    return points;
  })();

  const minPoint = Math.min(0, ...pnlCurvePoints);
  const maxPoint = Math.max(10, ...pnlCurvePoints);
  const range = maxPoint - minPoint || 1;

  const svgWidth = 400;
  const svgHeight = 100;

  const polylineCoords = pnlCurvePoints
    .map((val, idx) => {
      const x = (idx / Math.max(1, pnlCurvePoints.length - 1)) * svgWidth;
      const y = svgHeight - ((val - minPoint) / range) * (svgHeight - 16) - 8;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const getExitBadge = (reason: ExitReason) => {
    switch (reason) {
      case 'TAKE_PROFIT':
        return { label: '🎯 Kâr Al (TP)', style: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'BREAKEVEN':
        return { label: '🛡️ Başa Baş Stop', style: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'TRAILING_STOP':
        return { label: '📈 Takip Eden Stop', style: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      case 'TIME_STOP':
        return { label: '⏱️ Zaman Stopu', style: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'STOP_LOSS':
        return { label: '🛑 Stop Loss', style: 'bg-rose-50 text-rose-700 border-rose-200' };
      case 'LIQUIDATED':
        return { label: '💥 Likidasyon', style: 'bg-red-100 text-red-800 border-red-300' };
      default:
        return { label: reason, style: 'bg-slate-50 text-slate-700 border-slate-200' };
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-700 via-indigo-700 to-slate-900 p-4.5 rounded-3xl text-white shadow-md">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-base">
              📜
            </span>
            <div>
              <h2 className="font-display font-extrabold text-base tracking-tight">
                Mıntıka Sicil Defteri
              </h2>
              <p className="text-[11px] text-purple-200">
                Traderların işlem karnesi, disiplin karneleri ve kümülatif PnL eğrisi
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 rounded-xl bg-white/10 p-1 text-[10px] font-bold">
            <button
              onClick={() => setScope('season')}
              className={`px-2 py-1 rounded-lg ${scope === 'season' ? 'bg-white text-purple-800' : 'text-white/80'}`}
            >
              Bu sezon
            </button>
            <button
              onClick={() => setScope('lifetime')}
              className={`px-2 py-1 rounded-lg ${scope === 'lifetime' ? 'bg-white text-purple-800' : 'text-white/80'}`}
            >
              Ömür boyu (son 500)
            </button>
            <span className="px-1 font-mono">{totalTrades}</span>
          </div>
        </div>

        {/* Big PnL & Win Rate summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-white/10 text-center">
          <div>
            <span className="text-[10px] text-purple-200 block font-medium">Kümülatif Net PnL</span>
            <span
              className={`font-mono font-black text-lg tabular-nums ${
                cumulativePnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {cumulativePnl >= 0 ? '+' : ''}{cumulativePnl.toFixed(1)} USDT
            </span>
          </div>

          <div>
            <span className="text-[10px] text-purple-200 block font-medium">Win Rate</span>
            <span className="font-mono font-black text-lg text-white tabular-nums">
              %{winRate.toFixed(1)}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-purple-200 block font-medium">Profit Factor</span>
            <span className="font-mono font-black text-lg text-emerald-300 tabular-nums">
              {Number.isFinite(profitFactor) ? `${profitFactor.toFixed(2)}x` : '∞'}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-purple-200 block font-medium">Beklenti / İşlem</span>
            <span
              className={`font-mono font-black text-lg tabular-nums ${
                expectancy >= 0 ? 'text-emerald-300' : 'text-rose-300'
              }`}
            >
              {expectancy >= 0 ? '+' : ''}{expectancy.toFixed(1)} USDT
            </span>
          </div>
        </div>
      </div>

      {/* Cumulative Net PnL Chart */}
      {pnlCurvePoints.length > 1 && (
        <div className="bg-white p-4 rounded-3xl border border-purple-100 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-purple-600" />
              <span>Birikimli Net PnL Performans Eğrisi</span>
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              {avgDuration === null
                ? 'Ort. Süre: bilinmiyor'
                : `Ort. Süre: ${Math.floor(avgDuration / 60)}d ${avgDuration % 60}s`}
            </span>
          </div>

          <div className="h-28 w-full bg-slate-50/70 rounded-2xl p-2 border border-slate-100 flex items-center justify-center relative overflow-hidden">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-full overflow-visible"
              preserveAspectRatio="none"
            >
              {/* Zero line */}
              <line
                x1="0"
                y1={svgHeight - ((0 - minPoint) / range) * (svgHeight - 16) - 8}
                x2={svgWidth}
                y2={svgHeight - ((0 - minPoint) / range) * (svgHeight - 16) - 8}
                stroke="#cbd5e1"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
              {/* Curve */}
              <polyline
                fill="none"
                stroke={cumulativePnl >= 0 ? '#10b981' : '#f43f5e'}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={polylineCoords}
              />
            </svg>
          </div>
        </div>
      )}

      {/* Trader Power Rankings & Risk Memory States */}
      <div className="bg-white p-4 rounded-3xl border border-purple-100 shadow-xs">
        <h3 className="font-display font-bold text-xs text-slate-800 mb-3 flex items-center gap-1.5">
          <Award className="w-4 h-4 text-purple-600" />
          <span>Trader Güç Sıralaması & Risk Hafızası</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {Object.values(traders).map((trader) => {
            const char = CHARACTER_DATA[trader.id];
            const traderLogs = scopedLogs.filter((log) => log.traderId === trader.id);
            const traderWins = traderLogs.filter((log) => log.realizedPnl >= 0).length;
            const traderLosses = traderLogs.length - traderWins;
            const traderPnl = traderLogs.reduce((sum, log) => sum + log.realizedPnl, 0);
            const isFrozen = trader.riskMode === 'BUZDA';
            const isCautious = trader.riskMode === 'TEMKINLI';

            return (
              <div
                key={trader.id}
                className="p-2.5 rounded-2xl border border-slate-100 bg-slate-50/60 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{char.badgeIcon}</span>
                  <div>
                    <div className="font-bold text-slate-900 leading-tight">
                      {trader.name}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {traderWins}K / {traderLosses}Z · {scope === 'season' ? 'sezon' : 'ömür boyu'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-right">
                  <div>
                    <div
                      className={`font-mono font-bold text-xs tabular-nums ${
                        traderPnl >= 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {traderPnl >= 0 ? '+' : ''}{traderPnl.toFixed(0)} USDT
                    </div>
                    <span
                      className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md ${
                        isFrozen
                          ? 'bg-blue-100 text-blue-700 border border-blue-200'
                          : isCautious
                          ? 'bg-amber-100 text-amber-700 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {isFrozen ? '❄️ BUZDA' : isCautious ? '⚠️ TEMKİNLİ' : 'NORMAL'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl text-xs">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1 rounded-lg font-bold transition-colors ${
              filterType === 'all'
                ? 'bg-white text-purple-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tümü ({scopedLogs.length})
          </button>
          <button
            onClick={() => setFilterType('win')}
            className={`px-3 py-1 rounded-lg font-bold transition-colors ${
              filterType === 'win'
                ? 'bg-white text-emerald-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Kârlı ({wins.length})
          </button>
          <button
            onClick={() => setFilterType('loss')}
            className={`px-3 py-1 rounded-lg font-bold transition-colors ${
              filterType === 'loss'
                ? 'bg-white text-rose-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Zararlı ({losses.length})
          </button>
        </div>

        {/* Trader Filter Dropdown */}
        <select
          value={selectedTrader}
          onChange={(e) => setSelectedTrader(e.target.value)}
          className="h-8 px-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 bg-white"
        >
          <option value="all">Tüm Traderlar</option>
          {Object.values(traders).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {/* Trades History Cards */}
      {filteredLogs.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 border border-purple-100 text-center text-xs text-slate-500">
          Sicil defterinde henüz kapanmış işlem kaydı yok. Traderlar işlem kapattıkça tüm detaylar buraya işlenecek.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map((log) => {
            const char = CHARACTER_DATA[log.traderId];
            const isWin = log.realizedPnl >= 0;
            const exitBadge = getExitBadge(log.exitReason);
            const hasKnownDuration = log.holdingDurationSeconds >= 0;
            const durationMin = hasKnownDuration ? Math.floor(log.holdingDurationSeconds / 60) : 0;
            const durationSec = hasKnownDuration ? log.holdingDurationSeconds % 60 : 0;

            return (
              <div
                key={log.id}
                className="bg-white rounded-3xl p-4 border border-purple-100 shadow-xs hover:border-purple-200 transition-all text-xs"
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{char.badgeIcon}</span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-display font-extrabold text-slate-900 text-sm">
                          {log.symbol}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                            log.side === 'LONG'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {log.side} {log.leverage}x
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-700">
                          {log.confidenceScore}p Teyit
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {log.traderName} · Rejim: {log.marketRegime} · Veri: {log.entryIndicators.dataQuality}{log.seasonId === 'legacy' ? ' (legacy/doğrulanmamış)' : ''}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div
                      className={`font-mono font-black text-sm tabular-nums ${
                        isWin ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {isWin ? '+' : ''}{log.realizedPnl.toFixed(2)} USDT
                    </div>
                    <div
                      className={`text-[10px] font-mono font-bold tabular-nums ${
                        isWin ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {isWin ? '+' : ''}%{log.roePercent.toFixed(1)} ROE ·{' '}
                      {log.rMultiple >= 0 ? '+' : ''}{log.rMultiple.toFixed(2)}R
                    </div>
                  </div>
                </div>

                {/* Exit reason & duration badge */}
                <div className="flex items-center justify-between gap-2 py-1.5 px-2 bg-slate-50 rounded-xl mb-2.5">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${exitBadge.style}`}
                  >
                    {exitBadge.label}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Süre: {hasKnownDuration ? `${durationMin}d ${durationSec}s` : 'bilinmiyor'} · Komisyon: {(log.feePaid || 0).toFixed(2)} USDT
                  </span>
                </div>

                {/* Niye Girdi? & Ne Oldu? */}
                <div className="space-y-1.5 text-[11px] bg-purple-50/40 p-2.5 rounded-2xl border border-purple-100/50">
                  <div>
                    <span className="font-bold text-purple-900 block">💡 Niye Girdi?</span>
                    <p className="text-slate-600">{log.whyOpened}</p>
                  </div>
                  <div>
                    <span className="font-bold text-slate-800 block">📊 Ne Oldu?</span>
                    <p className="text-slate-600">{log.whyFailedOrWon}</p>
                  </div>
                  {log.aiImprovementNote && (
                    <div className="pt-1 border-t border-purple-100 text-[10px] text-purple-800">
                      <span className="font-bold">Öneri:</span> {log.aiImprovementNote}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
