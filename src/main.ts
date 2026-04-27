import rawJson from "./candles.json";
import { parseCandleSeries } from "./types/candle";
import { buildCandleVertices, initCandleChart, uploadAndDraw } from "./webgl/candleChart";

const series = parseCandleSeries(rawJson);

const title = document.getElementById("title");
const meta = document.getElementById("meta");
const canvas = document.getElementById("chart") as HTMLCanvasElement | null;

if (!title || !meta || !canvas) {
  throw new Error("Missing DOM nodes");
}

title.textContent = `${series.symbol} · ${series.interval}`;
meta.textContent = `${series.candles.length} candles · WebGL2`;

const chart = initCandleChart(canvas);
const vertices = buildCandleVertices(series.candles);

function frame() {
  uploadAndDraw(chart, vertices);
}

frame();
window.addEventListener("resize", frame);
