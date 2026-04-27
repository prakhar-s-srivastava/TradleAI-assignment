/** Single OHLCV candle from the feed */
export interface Candle {
  /** Open time (ms since epoch) */
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

/** Top-level payload wrapping candles for a symbol/interval */
export interface CandleSeries {
  symbol: string;
  interval: string;
  candles: Candle[];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function num(v: unknown, field: string): number {
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new TypeError(`Expected number for ${field}`);
  }
  return v;
}

/** Parse one raw candle object into a {@link Candle} */
export function candleFromUnknown(raw: unknown): Candle {
  if (!isRecord(raw)) throw new TypeError("Candle must be an object");
  return {
    t: num(raw.t, "t"),
    o: num(raw.o, "o"),
    h: num(raw.h, "h"),
    l: num(raw.l, "l"),
    c: num(raw.c, "c"),
    v: num(raw.v, "v"),
  };
}

/** Parse full JSON payload into {@link CandleSeries} */
export function parseCandleSeries(json: unknown): CandleSeries {
  if (!isRecord(json)) throw new TypeError("Root must be an object");
  const symbol = json.symbol;
  const interval = json.interval;
  const candlesRaw = json.candles;
  if (typeof symbol !== "string") throw new TypeError("symbol must be a string");
  if (typeof interval !== "string") throw new TypeError("interval must be a string");
  if (!Array.isArray(candlesRaw)) throw new TypeError("candles must be an array");
  return {
    symbol,
    interval,
    candles: candlesRaw.map(candleFromUnknown),
  };
}
