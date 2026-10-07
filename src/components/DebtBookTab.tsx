import React from 'react';
import { Loan, TraderProfile } from '../types';
import { Clock, AlertCircle, ArrowUpRight, ShieldCheck, Flame, Scale } from 'lucide-react';
import { CHARACTER_DATA } from '../services/dialogues';

interface DebtBookTabProps {
  loans: Loan[];
  traders: Record<string, TraderProfile>;
  onThreaten: (loanId: string) => void;
  onDoubleInterest: (loanId: string) => void;
  onOpenNegotiation: (loan: Loan) => void;
}

export const DebtBookTab: React.FC<DebtBookTabProps> = ({
  loans,
  traders,
  onThreaten,
  onDoubleInterest,
  onOpenNegotiation,
}) => {
  const activeAndOverdue = loans.filter(
    (l) => l.status === 'ACTIVE' || l.status === 'OVERDUE'
  );
  const pendingProposals = loans.filter((l) => l.status === 'PROPOSAL');
  const paidLoans = loans.filter((l) => l.status === 'PAID');
  const defaultedLoans = loans.filter((l) => l.status === 'DEFAULTED');

  return (
    <div className="space-y-4">
      {/* Pending Proposals at Door */}
      {pendingProposals.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-pink-700 uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-pink-500 animate-ping" />
            <span>Kapıda Borç İsteyenler ({pendingProposals.length})</span>
          </div>

          {pendingProposals.map((loan) => {
            const char = CHARACTER_DATA[loan.traderId];
            return (
              <div
                key={loan.id}
                className="bg-white rounded-3xl p-4 border border-pink-200 shadow-sm flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${char.avatarBg} flex items-center justify-center text-xl text-white shadow-xs shrink-0`}
                  >
                    {char.badgeIcon}
                  </div>
                  <div>
                    <div className="font-display font-bold text-slate-900 text-sm">
                      {char.name} ({char.nickname})
                    </div>
                    <div className="text-xs text-slate-500">
                      Talep: <span className="font-bold text-slate-800 font-mono">{loan.principal} USDT</span> · Vade: {loan.termMinutes} dk
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onOpenNegotiation(loan)}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md shadow-purple-600/20 hover:opacity-95 active:scale-[0.98] transition-all whitespace-nowrap"
                >
                  Pazarlık Masası
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Active & Overdue Debt Ledger */}
      <div className="space-y-2.5">
        <h3 className="font-display font-bold text-sm text-slate-900">
          Mıntıka Borç Defteri ({activeAndOverdue.length} Aktif Borç)
        </h3>

        {activeAndOverdue.length === 0 ? (
          <div className="bg-white rounded-3xl p-6 border border-purple-100 text-center text-xs text-slate-500">
            Şu an mıntıkada ödenmemiş borç yok. Herkes hesabını gördü veya yeni borç teklifi bekliyor.
          </div>
        ) : (
          <div className="space-y-3">
            {activeAndOverdue.map((loan) => {
              const char = CHARACTER_DATA[loan.traderId];
              const isOverdue = loan.status === 'OVERDUE';
              const minutes = Math.floor(loan.remainingSeconds / 60);
              const seconds = loan.remainingSeconds % 60;
              const remainingRatio = Math.min(
                1,
                loan.remainingSeconds / Math.max(1, loan.termMinutes * 60),
              );
              const pressureLabel = isOverdue
                ? 'VADE TASFİYESİ'
                : remainingRatio <= 0.2
                  ? 'KUMARBAZ: SON ÇIKIŞ'
                  : remainingRatio <= 0.5
                    ? 'KUMARBAZ: RİSK ARTIYOR'
                    : 'NORMAL AV';
              const pressureWidth = Math.max(4, Math.round((1 - remainingRatio) * 100));

              return (
                <div
                  key={loan.id}
                  className={`bg-white rounded-3xl p-4.5 border transition-all ${
                    isOverdue
                      ? 'border-rose-300 ring-2 ring-rose-500/20 shadow-md'
                      : 'border-purple-100 shadow-xs'
                  }`}
                >
                  {/* Top Bar */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${char.avatarBg} flex items-center justify-center text-xl text-white shadow-xs shrink-0`}
                      >
                        {char.badgeIcon}
                      </div>
                      <div>
                        <div className="font-display font-bold text-slate-900 text-sm">
                          {char.name} ({char.nickname})
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {char.title}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] text-slate-400 font-medium">Sözleşme Alacağı</div>
                      <div className="font-mono font-bold text-base text-purple-950 tabular-nums">
                        {loan.totalDue.toFixed(0)} USDT
                      </div>
                    </div>
                  </div>

                  {/* Loan Details Grid */}
                  <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-2xl border border-slate-100 text-xs mb-3.5 text-center">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Anapara (USDT)</span>
                      <span className="font-mono font-semibold text-slate-800 tabular-nums">
                        {loan.principal}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Faiz Oranı</span>
                      <span className="font-mono font-bold text-pink-600 tabular-nums">
                        %{loan.interestRate}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Kalan Süre</span>
                      <span
                        className={`font-mono font-bold tabular-nums flex items-center justify-center gap-1 ${
                          isOverdue ? 'text-rose-600 animate-pulse' : 'text-slate-800'
                        }`}
                      >
                        <Clock className="w-3 h-3 inline" />
                        {isOverdue ? 'GEÇTİ!' : `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`}
                      </span>
                    </div>
                  </div>

                  <div className="mb-3.5 rounded-xl border border-amber-100 bg-amber-50/70 px-2.5 py-2">
                    <div className="mb-1.5 flex items-center justify-between gap-2 text-[9px] font-bold uppercase tracking-wide">
                      <span className="text-amber-800">Borç Baskısı</span>
                      <span className={isOverdue || remainingRatio <= 0.2 ? 'text-rose-700' : 'text-amber-700'}>
                        {pressureLabel}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-amber-100">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isOverdue || remainingRatio <= 0.2 ? 'bg-rose-600' : 'bg-amber-500'
                        }`}
                        style={{ width: `${pressureWidth}%` }}
                      />
                    </div>
                  </div>

                  {/* Actions for Loan Shark */}
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                    <button
                      onClick={() => onThreaten(loan.id)}
                      className="flex-1 h-10 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 text-white font-bold text-xs shadow-sm hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
                    >
                      <Flame className="w-3.5 h-3.5" />
                      <span>Çırağı Gönder, Korkut</span>
                    </button>

                    <button
                      onClick={() => onDoubleInterest(loan.id)}
                      className="flex-1 h-10 rounded-xl bg-gradient-to-r from-purple-700 to-indigo-700 text-white font-bold text-xs shadow-sm hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
                    >
                      <Scale className="w-3.5 h-3.5 shrink-0" />
                      <span className="leading-tight">
                        Faizi Bindir
                        <span className="block text-[9px] font-medium opacity-80">Vade sabit</span>
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Paid Loans History */}
      {defaultedLoans.length > 0 && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3">
          <h4 className="text-xs font-bold text-rose-800 mb-2">Temerrüt Kayıtları ({defaultedLoans.length})</h4>
          <div className="space-y-1 text-[11px] text-rose-700">
            {defaultedLoans.map((loan) => (
              <div key={loan.id} className="flex items-center justify-between">
                <span>{CHARACTER_DATA[loan.traderId].name}</span>
                <span className="font-mono">Ödenmemiş: {loan.totalDue.toFixed(0)} USDT</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {paidLoans.length > 0 && (
        <div className="mt-4 pt-4 border-t border-purple-100">
          <h4 className="text-xs font-bold text-slate-600 mb-2">
            Tahsil Edilen Son Borçlar ({paidLoans.length})
          </h4>
          <div className="space-y-1.5">
            {paidLoans.slice(0, 5).map((pl) => (
              <div
                key={pl.id}
                className="bg-white p-2.5 rounded-xl border border-slate-100 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span className="font-semibold text-slate-800">
                    {CHARACTER_DATA[pl.traderId].name}
                  </span>
                </div>
                <div className="font-mono text-emerald-700 font-bold tabular-nums">
                  +{pl.totalDue.toFixed(0)} USDT (%{pl.interestRate} Faiz)
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
