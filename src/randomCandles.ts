import type { Candle, CandleSeries } from "./types/candle";

const INTERVAL_MS: Record<string, number> = {
  "1m": 60_000,
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
  "1h": 60 * 60_000,
  "4h": 4 * 60 * 60_000,
  "1d": 24 * 60 * 60_000,
};

function intervalToMs(interval: string): number {
  return INTERVAL_MS[interval] ?? 60_000;
}

export type RandomSeed = {
  symbol: string;
  interval: string;
  length: number;
  /** Anchor price for the first candle's open. */
  startPrice: number;
  /** Anchor open time (ms since epoch) for the first candle. */
  startTime: number;
};

/** Random walk OHLCV series; each candle's open == previous close. */
export function generateRandomSeries(seed: RandomSeed): CandleSeries {
  const stepMs = intervalToMs(seed.interval);
  const candles: Candle[] = [];
  let open = seed.startPrice;
  const vol0 = Math.max(1, Math.round(seed.startPrice * 0.0002));

  for (let i = 0; i < seed.length; i++) {
    const drift = (Math.random() - 0.5) * seed.startPrice * 0.0015;
    const close = Math.max(0.01, open + drift);
    const wickRange = Math.abs(drift) + seed.startPrice * 0.0008 * (0.5 + Math.random());
    const high = Math.max(open, close) + Math.random() * wickRange;
    const low = Math.min(open, close) - Math.random() * wickRange;
    const v = +(vol0 * (0.5 + Math.random() * 1.5)).toFixed(2);

    candles.push({
      t: seed.startTime + i * stepMs,
      o: +open.toFixed(2),
      h: +high.toFixed(2),
      l: +low.toFixed(2),
      c: +close.toFixed(2),
      v,
    });

    open = close;
  }

  return { symbol: seed.symbol, interval: seed.interval, candles };
}
