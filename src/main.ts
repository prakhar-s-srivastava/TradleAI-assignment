import rawJson from "./candles.json";
import { renderAxisOverlay } from "./axisOverlay";
import { parseCandleSeries } from "./types/candle";
import { buildChartGeometry, initCandleChart, uploadAndDraw } from "./webgl/candleChart";

const series = parseCandleSeries(rawJson);

const title = document.getElementById("title");
const meta = document.getElementById("meta");
const canvas = document.getElementById("chart") as HTMLCanvasElement | null;
const axisOverlay = document.getElementById("axis-overlay");

if (!title || !meta || !canvas || !axisOverlay) {
  throw new Error("Missing DOM nodes");
}

title.textContent = `${series.symbol} · ${series.interval}`;
meta.textContent = `${series.candles.length} candles · WebGL2`;

const chart = initCandleChart(canvas);
const geometry = buildChartGeometry(series.candles);
renderAxisOverlay(axisOverlay, geometry.markersY, geometry.markersX, geometry.markersVolY, {
  bottomLabelNdc: geometry.bottomLabelNdc,
});

function frame() {
  uploadAndDraw(chart, geometry);
}

frame();
window.addEventListener("resize", frame);
