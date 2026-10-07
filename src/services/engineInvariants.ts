import { Position, TraderId } from '../types';

export const MAX_GLOBAL_OPEN_POSITIONS = 2;

export function canReservePositionSlot(
  positions: Pick<Position, 'traderId'>[],
  traderId: TraderId,
) {
  return (
    positions.length < MAX_GLOBAL_OPEN_POSITIONS &&
    !positions.some((position) => position.traderId === traderId)
  );
}
