import React, { useState } from 'react';
import { Loan, TraderProfile } from '../types';
import { CHARACTER_DATA } from '../services/dialogues';
import { X, HandCoins, Check, MessageSquare, Scale, Sparkles } from 'lucide-react';

interface NegotiationModalProps {
  loan: Loan;
  trader: TraderProfile;
  sharkBalance: number;
  onClose: () => void;
  onSubmitOffer: (
    loanId: string,
    proposedRate: number,
    proposedTerm: number
  ) => { accepted: boolean; counterOffer?: { rate: number; term: number; speech: string } };
}

export const NegotiationModal: React.FC<NegotiationModalProps> = ({
  loan,
  trader,
  sharkBalance,
  onClose,
  onSubmitOffer,
}) => {
  const [interestRate, setInterestRate] = useState<number>(20);
  const [termMinutes, setTermMinutes] = useState<number>(10);
  const [negotiationText, setNegotiationText] = useState<string>(
    loan.lastCounterOffer?.speech ||
      `Abi kurbanın olayım bana ${loan.principal} USDT lazım. Faizini helalinden kes!`
  );
  const [hasAgreed, setHasAgreed] = useState<boolean>(false);

  const char = CHARACTER_DATA[loan.traderId];
  const expectedProfit = (loan.principal * interestRate) / 100;
  const totalRepayment = loan.principal + expectedProfit;
  const repaymentCount = trader.loansPaidOnTime + trader.loansPaidLate + trader.loansDefaulted;
  const repaymentRatio = trader.totalBorrowed > 0
    ? Math.min(100, (trader.totalRepaid / trader.totalBorrowed) * 100)
    : 0;

  const handlePropose = () => {
    const res = onSubmitOffer(loan.id, interestRate, termMinutes);
    if (res.accepted) {
      setHasAgreed(true);
      setTimeout(() => {
        onClose();
      }, 1600);
    } else if (res.counterOffer) {
      setNegotiationText(res.counterOffer.speech);
      setInterestRate(res.counterOffer.rate);
      setTermMinutes(res.counterOffer.term);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md">
      <div className="w-full max-w-md bg-white rounded-3xl p-5 shadow-2xl border border-purple-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${char.avatarBg} flex items-center justify-center text-xl text-white shadow-xs`}
            >
              {char.badgeIcon}
            </div>
            <div>
              <h3 className="font-display font-extrabold text-slate-900 text-base leading-tight">
                Borç Masası: {char.name}
              </h3>
              <p className="text-xs text-purple-700 font-medium">{char.title}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Speech Bubble */}
        <div className="bg-purple-50/80 p-3.5 rounded-2xl border border-purple-100 mb-4 relative">
          <div className="flex items-start gap-2">
            <MessageSquare className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
            <p className="text-xs text-purple-950 font-medium italic leading-relaxed">
              "{negotiationText}"
            </p>
          </div>
        </div>

        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-950">
          <div className="flex items-center justify-between gap-2">
            <strong>Kredi Sicili: {repaymentCount > 0 ? trader.creditRating : 'YENİ'}</strong>
            <span className="font-mono">
              {repaymentCount > 0 ? `Tahsil skoru ${trader.expectedCollectionRate}/100` : 'Skor için veri yok'}
            </span>
          </div>
          <div className="mt-1 text-amber-800">
            Vaktinde {trader.loansPaidOnTime} · Gecikmiş {trader.loansPaidLate} · Temerrüt {trader.loansDefaulted}
            {trader.totalBorrowed > 0 ? ` · Kayıtlı ödeme/orijinal anapara %${repaymentRatio.toFixed(0)}` : ''}
          </div>
        </div>

        {/* Loan Request Summary */}
        <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100 text-center mb-4">
          <div>
            <span className="text-[10px] text-slate-400 block font-medium">Talep Edilen Miktar</span>
            <span className="font-mono font-bold text-slate-900 text-base tabular-nums">
              {loan.principal} USDT
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block font-medium">Sözleşme Faizi (tahsil edilirse)</span>
            <span className="font-mono font-bold text-emerald-600 text-base tabular-nums">
              +{expectedProfit.toFixed(0)} USDT
            </span>
          </div>
        </div>

        {/* Rate & Term Sliders */}
        <div className="space-y-4 mb-5">
          <div>
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="font-bold text-slate-700">Faiz Oranı (%)</span>
              <span className="font-mono font-black text-pink-600 text-sm">
                %{interestRate}
              </span>
            </div>
            <input
              type="range"
              min="5"
              max="50"
              step="1"
              value={interestRate}
              onChange={(e) => setInterestRate(Number(e.target.value))}
              className="w-full accent-pink-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>%5 (İnsaflı)</span>
              <span>%25 (Orta Mahalle)</span>
              <span>%50 (Acımasız)</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="font-bold text-slate-700">Geri Ödeme Vadesi (Dakika)</span>
              <span className="font-mono font-black text-purple-600 text-sm">
                {termMinutes} Dakika
              </span>
            </div>
            <input
              type="range"
              min="3"
              max="30"
              step="1"
              value={termMinutes}
              onChange={(e) => setTermMinutes(Number(e.target.value))}
              className="w-full accent-purple-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>3 dk (Yıldırım Scalp)</span>
              <span>15 dk (Standart)</span>
              <span>30 dk (Uzun)</span>
            </div>
          </div>
        </div>

        {/* Total Return Box */}
        <div className="bg-gradient-to-r from-purple-100/70 to-pink-100/70 p-3 rounded-2xl border border-purple-200/60 flex items-center justify-between mb-5">
          <span className="text-xs font-bold text-purple-950">Sözleşme Toplamı:</span>
          <span className="font-mono font-extrabold text-purple-900 text-base tabular-nums">
            {totalRepayment.toFixed(0)} USDT
          </span>
        </div>

        {/* Action Button */}
        {hasAgreed ? (
          <div className="w-full h-12 rounded-2xl bg-emerald-600 text-white font-bold flex items-center justify-center gap-2">
            <Check className="w-5 h-5" />
            <span>Anlaşma Masada İmzalandı!</span>
          </div>
        ) : (
          <button
            onClick={handlePropose}
            disabled={sharkBalance < loan.principal}
            className="w-full h-12 rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-rose-500 text-white font-bold text-sm shadow-lg shadow-purple-600/25 hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <HandCoins className="w-4 h-4" />
            <span>
              {sharkBalance < loan.principal
                ? 'Kasada Yetersiz Bakiye!'
                : 'Parayı Ver & Sözleşmeyi Bağla'}
            </span>
          </button>
        )}
      </div>
    </div>
  );
};
