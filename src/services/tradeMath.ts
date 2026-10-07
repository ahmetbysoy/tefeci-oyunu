import { OrderSide } from '../types';

export interface TradePnl {
  effectiveEntryPrice: number;
  effectiveExitPrice: number;
  grossPnl: number;
  feePaid: number;
  netPnl: number;
}

export function calculateTradePnl(
  entryPrice: number,
  exitPrice: number,
  size: number,
  side: OrderSide,
  takerFeeRate = 0.0005,
  roundTripSlippageRate = 0.0002,
): TradePnl {
  const halfSlippage = roundTripSlippageRate / 2;
  const effectiveEntryPrice = side === 'LONG'
    ? entryPrice * (1 + halfSlippage)
    : entryPrice * (1 - halfSlippage);
  const effectiveExitPrice = side === 'LONG'
    ? exitPrice * (1 - halfSlippage)
    : exitPrice * (1 + halfSlippage);
  const direction = side === 'LONG' ? 1 : -1;
  const grossPnl =
    (effectiveExitPrice - effectiveEntryPrice) * size * direction;
  const feePaid =
    (effectiveEntryPrice * size + effectiveExitPrice * size) * takerFeeRate;
  return {
    effectiveEntryPrice,
    effectiveExitPrice,
    grossPnl,
    feePaid,
    netPnl: grossPnl - feePaid,
  };
}
