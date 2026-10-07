import React from 'react';
import { Loan, Position, TraderId, TraderProfile } from '../types';
import { TrendingUp, AlertTriangle, HandCoins, Award, LineChart, ExternalLink, Users, ArrowRight } from 'lucide-react';
import { CHARACTER_DATA } from '../services/dialogues';

interface LeaderboardTabProps {
  traders: Record<TraderId, TraderProfile>;
  openPositions: Position[];
  loans: Loan[];
  onOpenNegotiation: (loan: Loan) => void;
}

export const LeaderboardTab: React.FC<LeaderboardTabProps> = ({
  traders,
  openPositions,
  loans,
  onOpenNegotiation,
}) => {
  // Sort traders by total PnL
  const sortedTraders = (Object.values(traders) as TraderProfile[]).sort(
    (a, b) => b.totalPnl - a.totalPnl
  );

  // Pending proposals waiting at the door in queue order
  const pendingProposals = loans.filter((l) => l.status === 'PROPOSAL');

  return (
    <div className="space-y-4">
      {/* Kapıdaki Borç Kuyruğu (Queue at the door) */}
      {pendingProposals.length > 0 && (
        <div className="bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 p-4 rounded-3xl text-white shadow-md border border-pink-300/30">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-pink-300 animate-ping" />
              <h2 className="font-display font-extrabold text-base tracking-tight">
                Kapıda Borç Kuyruğu ({pendingProposals.length} Trader Sırada!)
              </h2>
            </div>
            <span className="text-[11px] font-mono bg-white/20 px-2 py-0.5 rounded-md font-bold">
              Sermayesizler
            </span>
          </div>

          <p className="text-xs text-pink-100 mb-3 leading-relaxed">
            Traderların cebinde 5 kuruş yok, hepsi senden ilk sermayesini almak için sıraya girdi! İstediğine istediğin faiz ve vadeyle borç verip masaya oturt.
          </p>

          <div className="space-y-2">
            {pendingProposals.map((loan, qIndex) => {
              const char = CHARACTER_DATA[loan.traderId];
              const trader = traders[loan.traderId];
              const repaymentCount = trader.loansPaidOnTime + trader.loansPaidLate + trader.loansDefaulted;
              const isFirst = qIndex === 0;

              return (
                <div
                  key={loan.id}
                  className={`rounded-2xl p-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 transition-all ${
                    isFirst
                      ? 'bg-white text-slate-900 shadow-md ring-2 ring-pink-400'
                      : 'bg-white/10 text-white hover:bg-white/15'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div
                        className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${char.avatarBg} flex items-center justify-center text-xl text-white shadow-xs shrink-0`}
                      >
                        {char.badgeIcon}
                      </div>
                      <span
                        className={`absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full font-mono font-black text-[10px] flex items-center justify-center ${
                          isFirst
                            ? 'bg-pink-600 text-white ring-2 ring-white'
                            : 'bg-purple-900 text-purple-200'
                        }`}
                      >
                        {qIndex + 1}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-display font-bold text-sm">
                          {char.name} ({char.nickname})
                        </span>
                        {isFirst && (
                          <span className="text-[10px] font-extrabold bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded-md">
                            Sıradaki!
                          </span>
                        )}
                      </div>
                      <div
                        className={`text-xs ${
                          isFirst ? 'text-slate-500' : 'text-purple-200'
                        }`}
                      >
                        Talep: <span className="font-bold font-mono">{loan.principal} USDT</span> · Vade: {loan.termMinutes} dk · Sicil: {repaymentCount > 0 ? `${trader.creditRating} (${trader.expectedCollectionRate}/100)` : 'Yeni (ödeme geçmişi yok)'}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => onOpenNegotiation(loan)}
                    className={`h-9 px-4 rounded-xl font-bold text-xs flex items-center gap-1.5 shrink-0 shadow-xs active:scale-[0.97] transition-all ml-auto ${
                      isFirst
                        ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white hover:opacity-95 shadow-pink-500/25 animate-pulse'
                        : 'bg-white/20 hover:bg-white/30 text-white'
                    }`}
                  >
                    <HandCoins className="w-3.5 h-3.5" />
                    <span>{isFirst ? 'Masaya Çağır' : 'Sıradan Al'}</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Intro banner */}
      <div className="bg-gradient-to-r from-purple-100/90 via-pink-100/80 to-purple-50 p-4 rounded-3xl border border-purple-200/60 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-base text-purple-950">
            Mıntıka Masaları & Trader Kadrosu
          </h2>
          <p className="text-xs text-purple-800/80 mt-0.5">
            Borcunu alan trader canlı Binance Futures tahtasında scalping yapar.
          </p>
        </div>
        <div className="w-10 h-10 rounded-2xl bg-white/80 shadow-xs flex items-center justify-center text-lg shrink-0">
          🎯
        </div>
      </div>

      {/* Trader Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {sortedTraders.map((trader, index) => {
          const traderPositions = openPositions.filter((p) => p.traderId === trader.id);
          const activeLoan = loans.find(
            (l) => l.traderId === trader.id && (l.status === 'ACTIVE' || l.status === 'OVERDUE')
          );
          const pendingLoanProposal = loans.find(
            (l) => l.traderId === trader.id && l.status === 'PROPOSAL'
          );

          const completedTrades = trader.winCount + trader.lossCount;
          const repaymentCount = trader.loansPaidOnTime + trader.loansPaidLate + trader.loansDefaulted;
          const winRate = completedTrades > 0
            ? (trader.winCount / completedTrades) * 100
            : null;

          return (
            <div
              key={trader.id}
              className="bg-white rounded-3xl p-4.5 border border-purple-100 shadow-xs hover:border-purple-300 transition-all flex flex-col justify-between"
            >
              <div>
                {/* Header: Avatar, Name, Rank */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${trader.avatarBg} flex items-center justify-center text-2xl shadow-sm text-white`}
                    >
                      {trader.badgeIcon}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-display font-bold text-slate-900 text-sm">
                          {trader.name}
                        </span>
                        <span className="text-[11px] font-semibold text-purple-600">
                          #{index + 1}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 font-medium">
                        {trader.title}
                      </div>
                    </div>
                  </div>

                  {/* Loan Proposal CTA Button */}
                  {pendingLoanProposal && (
                    <button
                      onClick={() => onOpenNegotiation(pendingLoanProposal)}
                      className="animate-bounce bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow-md shadow-pink-500/20 flex items-center gap-1 shrink-0"
                    >
                      <HandCoins className="w-3.5 h-3.5" />
                      <span>Sırada ({pendingLoanProposal.principal}$)</span>
                    </button>
                  )}
                </div>

                {/* Strategy desc */}
                <p className="text-xs text-slate-600 line-clamp-2 mb-3 bg-slate-50/80 p-2 rounded-xl border border-slate-100">
                  {trader.strategyDescription}
                </p>

                {/* Preferred coins with TradingView links */}
                <div className="flex items-center gap-1.5 flex-wrap mb-3">
                  <span className="text-[10px] text-slate-400 font-medium">Coinler:</span>
                  {trader.preferredCoins.map((coin) => (
                    <a
                      key={coin}
                      href={`https://www.tradingview.com/chart/?symbol=BINANCE:${encodeURIComponent(coin)}.P`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`${coin} TradingView grafiği`}
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 text-[10px] font-mono font-semibold rounded-md border border-slate-200/80 transition-colors"
                    >
                      <span>{coin}</span>
                      <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                    </a>
                  ))}
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-3 gap-2 bg-purple-50/40 p-2.5 rounded-2xl border border-purple-100/50 mb-3 text-center">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Serbest Bakiye</span>
                    <span
                      className={`text-xs font-bold font-mono tabular-nums ${
                        trader.balance === 0 ? 'text-rose-600' : 'text-slate-800'
                      }`}
                    >
                      ${trader.balance.toFixed(0)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Sezon Net PnL</span>
                    <span
                      className={`text-xs font-bold font-mono tabular-nums ${
                        trader.totalPnl >= 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {trader.totalPnl >= 0 ? '+' : ''}
                      ${trader.totalPnl.toFixed(0)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Sezon Win Rate</span>
                    <span className="text-xs font-bold font-mono text-purple-700 tabular-nums">
                      {winRate === null ? '—' : `%${winRate.toFixed(0)}`}
                    </span>
                  </div>
                </div>

                <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-amber-100 bg-amber-50/70 px-2.5 py-2 text-[10px]">
                  <div>
                    <span className="font-bold text-amber-900">
                      Kredi Sicili {repaymentCount > 0 ? trader.creditRating : 'YENİ'}
                    </span>
                    <span className="text-amber-800/80">
                      {repaymentCount > 0 ? ` · Tahsil skoru ${trader.expectedCollectionRate}/100` : ' · Henüz skor yok'}
                    </span>
                  </div>
                  <span className="font-mono text-slate-600" title="Vaktinde / gecikmiş / temerrüt">
                    {trader.loansPaidOnTime}V · {trader.loansPaidLate}G · {trader.loansDefaulted}T
                  </span>
                </div>
              </div>

              {/* Footer status & Loan Indicator */}
              <div className="pt-2 border-t border-purple-50 flex items-center justify-between text-[11px]">
                <div className="text-slate-600 truncate max-w-[200px]">
                  <span className="font-semibold text-slate-800">Durum:</span>{' '}
                  {traderPositions.length > 0 ? (
                    <span className="text-purple-700 font-medium">
                      {traderPositions.length} Açık Pozisyon ({traderPositions[0].symbol})
                    </span>
                  ) : (
                    <span className={trader.balance === 0 ? 'text-pink-600 font-semibold' : ''}>
                      {trader.statusText}
                    </span>
                  )}
                </div>

                {activeLoan ? (
                  <span
                    className={`font-semibold text-xs tabular-nums ${
                      activeLoan.status === 'OVERDUE' ? 'text-rose-600 animate-pulse' : 'text-pink-600'
                    }`}
                  >
                    Borç: ${activeLoan.totalDue.toFixed(0)}
                  </span>
                ) : (
                  <span className="text-slate-400">
                    {trader.balance === 0 ? 'Borç Bekliyor' : 'Borcu Yok'}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
