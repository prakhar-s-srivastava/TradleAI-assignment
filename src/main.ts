import rawJson from "./candles.json";
import { renderAxisOverlay } from "./axisOverlay";
import { generateRandomSeries } from "./randomCandles";
import type { CandleSeries } from "./types/candle";
import { parseCandleSeries } from "./types/candle";
import { buildChartGeometry, initCandleChart, uploadAndDraw } from "./webgl/candleChart";

const initialSeries = parseCandleSeries(rawJson);

const titleEl = document.getElementById("title");
const metaEl = document.getElementById("meta");
const canvasEl = document.getElementById("chart") as HTMLCanvasElement | null;
const axisOverlayEl = document.getElementById("axis-overlay");
const randomizeBtn = document.getElementById("randomize") as HTMLButtonElement | null;
const downloadJsonBtn = document.getElementById("download-json") as HTMLButtonElement | null;

if (!titleEl || !metaEl || !canvasEl || !axisOverlayEl || !randomizeBtn || !downloadJsonBtn) {
  throw new Error("Missing DOM nodes");
}

const canvas: HTMLCanvasElement = canvasEl;

const title: HTMLElement = titleEl;
const meta: HTMLElement = metaEl;
const axisOverlay: HTMLElement = axisOverlayEl;

const MIN_VISIBLE = 3;

const chart = initCandleChart(canvas);
let series: CandleSeries = initialSeries;
/** Floating-point view window so smooth zoom/pan steps accumulate. */
let viewStartF = 0;
let viewSpanF = series.candles.length;
let viewStart = 0;
let viewEnd = series.candles.length;
let geometry = buildChartGeometry(series.candles.slice(viewStart, viewEnd));

function commitView() {
  const total = series.candles.length;
  if (viewSpanF < MIN_VISIBLE) viewSpanF = MIN_VISIBLE;
  if (viewSpanF > total) viewSpanF = total;
  if (viewStartF < 0) viewStartF = 0;
  if (viewStartF + viewSpanF > total) viewStartF = total - viewSpanF;
  viewStart = Math.max(0, Math.round(viewStartF));
  viewEnd = Math.min(total, Math.round(viewStartF + viewSpanF));
  if (viewEnd - viewStart < MIN_VISIBLE) {
    viewEnd = Math.min(total, viewStart + MIN_VISIBLE);
  }
}

function render() {
  commitView();
  const visible = series.candles.slice(viewStart, viewEnd);
  title.textContent = `${series.symbol} · ${series.interval}`;
  meta.textContent = `${visible.length} / ${series.candles.length} candles · WebGL2`;
  geometry = buildChartGeometry(visible);
  renderAxisOverlay(axisOverlay, geometry.markersY, geometry.markersX, geometry.markersVolY, {
    bottomLabelNdc: geometry.bottomLabelNdc,
  });
  uploadAndDraw(chart, geometry);
}

function setSeries(next: CandleSeries) {
  series = next;
  viewStartF = 0;
  viewSpanF = next.candles.length;
  render();
}

function downloadSeriesJson(s: CandleSeries): void {
  const body = JSON.stringify(s, null, 2);
  const blob = new Blob([body], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safe = s.symbol.replace(/[^\w.-]+/g, "_");
  a.download = `${safe}-${s.interval}.json`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

setSeries(initialSeries);

downloadJsonBtn.addEventListener("click", () => {
  downloadSeriesJson(series);
});

randomizeBtn.addEventListener("click", () => {
  const startPrice = initialSeries.candles[0]?.o ?? 100;
  const startTime = initialSeries.candles[0]?.t ?? Date.now();
  const length = 40 + Math.floor(Math.random() * 5000); // 40..250
  const next = generateRandomSeries({
    symbol: initialSeries.symbol,
    interval: initialSeries.interval,
    length,
    startPrice,
    startTime,
  });
  setSeries(next);
});

/** Wheel-delta to log-zoom factor (per pixel of `deltaY`). Higher = faster zoom. */
const ZOOM_PER_PIXEL = 0.004;
/** Damping multiplier applied to mouse-pan speed (1 = chart sticks to cursor). */
const PAN_DAMPING = 0.45;

canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    const total = series.candles.length;
    if (total <= MIN_VISIBLE) return;

    const rect = canvas.getBoundingClientRect();
    const xFrac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

    let dy = e.deltaY;
    if (e.deltaMode === 1) dy *= 16;
    else if (e.deltaMode === 2) dy *= rect.height;

    const factor = Math.exp(dy * ZOOM_PER_PIXEL);
    const anchor = viewStartF + xFrac * viewSpanF;
    const newSpan = Math.max(MIN_VISIBLE, Math.min(total, viewSpanF * factor));
    if (newSpan === viewSpanF) return;

    viewStartF = anchor - xFrac * newSpan;
    viewSpanF = newSpan;
    render();
  },
  { passive: false },
);

window.addEventListener("resize", () => uploadAndDraw(chart, geometry));

let panPointerId: number | null = null;
let panLastClientX = 0;

canvas.addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return;
  panPointerId = e.pointerId;
  panLastClientX = e.clientX;
  canvas.setPointerCapture(e.pointerId);
  canvas.style.cursor = "grabbing";
  e.preventDefault();
});

canvas.addEventListener("pointermove", (e) => {
  if (panPointerId !== e.pointerId) return;
  const dx = e.clientX - panLastClientX;
  panLastClientX = e.clientX;
  if (dx === 0) return;
  const rect = canvas.getBoundingClientRect();
  viewStartF += (-dx / rect.width) * viewSpanF * PAN_DAMPING;
  render();
});

function endPan(e: PointerEvent): void {
  if (panPointerId !== e.pointerId) return;
  panPointerId = null;
  canvas.style.cursor = "";
  if (canvas.hasPointerCapture(e.pointerId)) {
    canvas.releasePointerCapture(e.pointerId);
  }
}

canvas.addEventListener("pointerup", endPan);
canvas.addEventListener("pointercancel", endPan);
