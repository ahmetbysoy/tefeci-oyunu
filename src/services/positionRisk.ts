import { ExitReason, MarketTicker, OrderSide, Position } from '../types';

export interface PositionExitDecision {
  reason: ExitReason;
  exitPrice: number;
}

export function calculateNetBreakEvenPrice(
  entryPrice: number,
  side: OrderSide,
  takerFeeRate = 0.0005,
  roundTripSlippageRate = 0.0002,
): number {
  const halfSlippage = roundTripSlippageRate / 2;
  if (side === 'LONG') {
    return (
      entryPrice * (1 + halfSlippage) * (1 + takerFeeRate) /
      ((1 - halfSlippage) * (1 - takerFeeRate))
    );
  }
  return (
    entryPrice * (1 - halfSlippage) * (1 - takerFeeRate) /
    ((1 + halfSlippage) * (1 + takerFeeRate))
  );
}

export function resolvePositionExit(
  position: Position,
  ticker: MarketTicker,
  now: number,
): PositionExitDecision | null {
  const markPrice = ticker.markPrice || ticker.lastPrice;
  const isLiquidated =
    (position.side === 'LONG' && markPrice <= position.liquidationPrice) ||
    (position.side === 'SHORT' && markPrice >= position.liquidationPrice);
  if (isLiquidated) return { reason: 'LIQUIDATED', exitPrice: markPrice };

  const hitStop =
    (position.side === 'LONG' && ticker.lastPrice <= position.stopLossPrice) ||
    (position.side === 'SHORT' && ticker.lastPrice >= position.stopLossPrice);
  if (hitStop) {
    const reason: ExitReason = position.isTrailingActive
      ? 'TRAILING_STOP'
      : position.isBreakevenSet
        ? 'BREAKEVEN'
        : 'STOP_LOSS';
    return { reason, exitPrice: ticker.lastPrice };
  }

  const hitTakeProfit =
    (position.side === 'LONG' && ticker.lastPrice >= position.takeProfitPrice) ||
    (position.side === 'SHORT' && ticker.lastPrice <= position.takeProfitPrice);
  if (hitTakeProfit) {
    return { reason: 'TAKE_PROFIT', exitPrice: position.takeProfitPrice };
  }

  const holdingMs = now - position.openTime;
  if (holdingMs >= position.maxHoldMinutes * 60_000 && position.unrealizedPnl <= 0) {
    return { reason: 'TIME_STOP', exitPrice: ticker.lastPrice };
  }

  return null;
}
