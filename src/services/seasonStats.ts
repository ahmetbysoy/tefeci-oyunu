import { DecisionLog, TraderId } from '../types';

export interface TraderLogSummary {
  totalPnl: number;
  winCount: number;
  lossCount: number;
  consecutiveLosses: number;
}

export function summarizeTraderLogs(
  logs: DecisionLog[],
  traderId: TraderId,
  seasonId?: string,
): TraderLogSummary {
  const relevant = logs.filter(
    (log) => log.traderId === traderId && (!seasonId || log.seasonId === seasonId),
  );
  const newestFirst = [...relevant].sort((a, b) => b.timestamp - a.timestamp);
  let consecutiveLosses = 0;
  for (const log of newestFirst) {
    if (log.realizedPnl >= 0) break;
    consecutiveLosses++;
  }
  return {
    totalPnl: relevant.reduce((sum, log) => sum + log.realizedPnl, 0),
    winCount: relevant.filter((log) => log.realizedPnl >= 0).length,
    lossCount: relevant.filter((log) => log.realizedPnl < 0).length,
    consecutiveLosses,
  };
}
