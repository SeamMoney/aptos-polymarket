import type { Market } from "./types";

const TBD_LABEL = "TBD";

function parseEndDateToMs(endDate?: string): number | null {
  if (!endDate || endDate === TBD_LABEL) return null;
  const parsed = Date.parse(endDate);
  return Number.isNaN(parsed) ? null : parsed;
}

export function isClosedFromTimestamp(endTime?: number, resolved?: boolean): boolean {
  if (resolved) return true;
  if (!endTime) return false;
  return endTime > 0 && endTime * 1000 < Date.now();
}

export function isMarketClosed(market: Market): boolean {
  if (market.resolved) return true;
  if (isClosedFromTimestamp(market.endTime, false)) return true;
  const parsed = parseEndDateToMs(market.endDate);
  return parsed ? parsed < Date.now() : false;
}
