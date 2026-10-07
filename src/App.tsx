import React, { useState, useEffect } from 'react';
import { tradingEngine } from './services/tradingEngine';
import { soundService } from './services/soundAndTts';
import { Loan, Position, TraderProfile } from './types';
import { HeaderBar } from './components/HeaderBar';
import { EnterModal } from './components/EnterModal';
import { LeaderboardTab } from './components/LeaderboardTab';
import { PositionsTab } from './components/PositionsTab';
import { DebtBookTab } from './components/DebtBookTab';
import { NewsFeedTab } from './components/NewsFeedTab';
import { SicilTab } from './components/SicilTab';
import { NegotiationModal } from './components/NegotiationModal';
import { SettingsModal } from './components/SettingsModal';
import { Users, Zap, BookOpen, Newspaper, ScrollText } from 'lucide-react';
import confetti from 'canvas-confetti';

type TabType = 'leaderboard' | 'positions' | 'debtbook' | 'news' | 'sicil';

export default function App() {
  const [hasEntered, setHasEntered] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<TabType>('leaderboard');
  const [engineState, setEngineState] = useState(() => ({
    cashBalance: tradingEngine.cashBalance,
    totalDistributedLoans: tradingEngine.totalDistributedLoans,
    totalCollectedInterest: tradingEngine.totalCollectedInterest,
    traders: { ...tradingEngine.traders },
    openPositions: [...tradingEngine.openPositions],
    loans: [...tradingEngine.loans],
    newsFeed: [...tradingEngine.newsFeed],
    decisionLogs: [...tradingEngine.decisionLogs],
    dataHealth: tradingEngine.dataHealth,
    seasonId: tradingEngine.seasonId,
    minimumLeverage: tradingEngine.settings.minimumLeverage,
  }));

  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(true);
  const [activeNegotiationLoan, setActiveNegotiationLoan] = useState<Loan | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = tradingEngine.subscribe(() => {
      setEngineState({
        cashBalance: tradingEngine.cashBalance,
        totalDistributedLoans: tradingEngine.totalDistributedLoans,
        totalCollectedInterest: tradingEngine.totalCollectedInterest,
        traders: { ...tradingEngine.traders },
        openPositions: [...tradingEngine.openPositions],
        loans: [...tradingEngine.loans],
        newsFeed: [...tradingEngine.newsFeed],
        decisionLogs: [...tradingEngine.decisionLogs],
        dataHealth: tradingEngine.dataHealth,
        seasonId: tradingEngine.seasonId,
        minimumLeverage: tradingEngine.settings.minimumLeverage,
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundService.setSoundEnabled(next);
  };

  const handleToggleTts = () => {
    const next = !ttsEnabled;
    setTtsEnabled(next);
    soundService.setTtsEnabled(next);
  };

  const handleOpenNegotiation = (loan: Loan) => {
    setActiveNegotiationLoan(loan);
  };

  const handleCloseNegotiation = () => {
    setActiveNegotiationLoan(null);
  };

  const handleSubmitOffer = (loanId: string, rate: number, term: number) => {
    const res = tradingEngine.submitLoanOffer(loanId, rate, term);
    if (res.accepted) {
      try {
        confetti({
          particleCount: 40,
          spread: 60,
          origin: { y: 0.7 },
        });
      } catch {
        // ignore
      }
    }
    return res;
  };

  const handleThreaten = (loanId: string) => {
    tradingEngine.executeThreatAction(loanId);
  };

  const handleDoubleInterest = (loanId: string) => {
    tradingEngine.executeDoubleInterestAction(loanId);
  };

  const handleResetGame = (startingCash: number) => {
    tradingEngine.resetGame(startingCash);
  };

  const handleMinimumLeverageChange = (minimumLeverage: number) => {
    tradingEngine.setMinimumLeverage(minimumLeverage);
  };

  const pendingLoansCount = engineState.loans.filter((l) => l.status === 'PROPOSAL').length;
  const overdueLoansCount = engineState.loans.filter((l) => l.status === 'OVERDUE').length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fdf2f8] via-[#fae8ff] to-[#f5d0fe]/30 text-slate-900 flex flex-col pb-20">
      {/* Welcome & Audio Unlock Overlay */}
      {!hasEntered && <EnterModal onEnter={() => setHasEntered(true)} />}

      {/* Top Header Sticky Bar */}
      <HeaderBar
        cashBalance={engineState.cashBalance}
        totalDistributedLoans={engineState.totalDistributedLoans}
        totalCollectedInterest={engineState.totalCollectedInterest}
        openPositionsCount={engineState.openPositions.length}
        dataHealth={engineState.dataHealth}
        onOpenSettings={() => setIsSettingsOpen(true)}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-3 sm:p-4">
        {activeTab === 'leaderboard' && (
          <LeaderboardTab
            traders={engineState.traders}
            openPositions={engineState.openPositions}
            loans={engineState.loans}
            onOpenNegotiation={handleOpenNegotiation}
          />
        )}

        {activeTab === 'positions' && (
          <PositionsTab
            positions={engineState.openPositions}
            traders={engineState.traders}
          />
        )}

        {activeTab === 'debtbook' && (
          <DebtBookTab
            loans={engineState.loans}
            traders={engineState.traders}
            onThreaten={handleThreaten}
            onDoubleInterest={handleDoubleInterest}
            onOpenNegotiation={handleOpenNegotiation}
          />
        )}

        {activeTab === 'news' && <NewsFeedTab news={engineState.newsFeed} />}

        {activeTab === 'sicil' && (
          <SicilTab
            decisionLogs={engineState.decisionLogs}
            traders={engineState.traders}
            seasonId={engineState.seasonId}
          />
        )}
      </main>

      {/* Fixed Bottom Navigation Bar (5 Tabs) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md border-t border-purple-100 shadow-lg px-2 py-1">
        <div className="max-w-md mx-auto grid grid-cols-5 items-center h-14">
          {/* Tab 1: Leaderboard */}
          <button
            onClick={() => {
              soundService.playClickSound();
              setActiveTab('leaderboard');
            }}
            className={`min-h-[44px] flex flex-col items-center justify-center transition-colors relative ${
              activeTab === 'leaderboard'
                ? 'text-purple-700 font-bold'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Users className="w-4.5 h-4.5" />
            <span className="text-[9px] mt-0.5 tracking-tight">Mıntıka</span>
            {pendingLoansCount > 0 && (
              <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-pink-500 animate-ping" />
            )}
          </button>

          {/* Tab 2: Positions */}
          <button
            onClick={() => {
              soundService.playClickSound();
              setActiveTab('positions');
            }}
            className={`min-h-[44px] flex flex-col items-center justify-center transition-colors relative ${
              activeTab === 'positions'
                ? 'text-purple-700 font-bold'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Zap className="w-4.5 h-4.5" />
            <span className="text-[9px] mt-0.5 tracking-tight">Pozisyon</span>
            {engineState.openPositions.length > 0 && (
              <span className="absolute top-1 right-1.5 text-[8px] font-mono font-bold bg-purple-100 text-purple-700 px-1 rounded-full">
                {engineState.openPositions.length}
              </span>
            )}
          </button>

          {/* Tab 3: Debt Book */}
          <button
            onClick={() => {
              soundService.playClickSound();
              setActiveTab('debtbook');
            }}
            className={`min-h-[44px] flex flex-col items-center justify-center transition-colors relative ${
              activeTab === 'debtbook'
                ? 'text-purple-700 font-bold'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-4.5 h-4.5" />
            <span className="text-[9px] mt-0.5 tracking-tight">Defter</span>
            {overdueLoansCount > 0 && (
              <span className="absolute top-1 right-1.5 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            )}
          </button>

          {/* Tab 4: News Feed */}
          <button
            onClick={() => {
              soundService.playClickSound();
              setActiveTab('news');
            }}
            className={`min-h-[44px] flex flex-col items-center justify-center transition-colors relative ${
              activeTab === 'news'
                ? 'text-purple-700 font-bold'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Newspaper className="w-4.5 h-4.5" />
            <span className="text-[9px] mt-0.5 tracking-tight">Haber</span>
          </button>

          {/* Tab 5: Sicil (Performance Ledger) */}
          <button
            onClick={() => {
              soundService.playClickSound();
              setActiveTab('sicil');
            }}
            className={`min-h-[44px] flex flex-col items-center justify-center transition-colors relative ${
              activeTab === 'sicil'
                ? 'text-purple-700 font-bold'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <ScrollText className="w-4.5 h-4.5" />
            <span className="text-[9px] mt-0.5 tracking-tight">Sicil</span>
            {engineState.decisionLogs.length > 0 && (
              <span className="absolute top-1 right-1 text-[8px] font-mono font-bold bg-emerald-100 text-emerald-800 px-1 rounded-full">
                {engineState.decisionLogs.length}
              </span>
            )}
          </button>
        </div>
      </nav>

      {/* Modals */}
      {activeNegotiationLoan && (
        <NegotiationModal
          loan={activeNegotiationLoan}
          trader={engineState.traders[activeNegotiationLoan.traderId]}
          sharkBalance={engineState.cashBalance}
          onClose={handleCloseNegotiation}
          onSubmitOffer={handleSubmitOffer}
        />
      )}

      {isSettingsOpen && (
        <SettingsModal
          currentCash={engineState.cashBalance}
          decisionLogs={engineState.decisionLogs}
          onClose={() => setIsSettingsOpen(false)}
          onResetGame={handleResetGame}
          soundEnabled={soundEnabled}
          ttsEnabled={ttsEnabled}
          onToggleSound={handleToggleSound}
          onToggleTts={handleToggleTts}
          minimumLeverage={engineState.minimumLeverage}
          onMinimumLeverageChange={handleMinimumLeverageChange}
        />
      )}
    </div>
  );
}
