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
let viewStart = 0;
let viewEnd = series.candles.length;
let geometry = buildChartGeometry(series.candles.slice(viewStart, viewEnd));

function render() {
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
  viewStart = 0;
  viewEnd = next.candles.length;
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
  const length = 40 + Math.floor(Math.random() * 500); // 40..250
  const next = generateRandomSeries({
    symbol: initialSeries.symbol,
    interval: initialSeries.interval,
    length,
    startPrice,
    startTime,
  });
  setSeries(next);
});

canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    const total = series.candles.length;
    if (total <= MIN_VISIBLE) return;

    const rect = canvas.getBoundingClientRect();
    const xFrac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

    const span = viewEnd - viewStart;
    const anchor = viewStart + xFrac * span;

    const factor = e.deltaY < 0 ? 0.85 : 1.18;
    let newSpan = Math.round(span * factor);
    newSpan = Math.max(MIN_VISIBLE, Math.min(total, newSpan));
    if (newSpan === span) return;

    let newStart = Math.round(anchor - xFrac * newSpan);
    let newEnd = newStart + newSpan;
    if (newStart < 0) {
      newStart = 0;
      newEnd = newSpan;
    }
    if (newEnd > total) {
      newEnd = total;
      newStart = total - newSpan;
    }
    viewStart = newStart;
    viewEnd = newEnd;
    render();
  },
  { passive: false },
);

window.addEventListener("resize", () => uploadAndDraw(chart, geometry));

let panPointerId: number | null = null;
let panLastClientX = 0;
/** Accumulated fractional candle offset so sub-pixel drags add up. */
let panAccum = 0;

function applyPanByShift(shift: number): void {
  if (shift === 0) return;
  const total = series.candles.length;
  const span = viewEnd - viewStart;
  if (span >= total) return;
  let newStart = viewStart + shift;
  if (newStart < 0) newStart = 0;
  if (newStart + span > total) newStart = total - span;
  if (newStart === viewStart) return;
  viewStart = newStart;
  viewEnd = newStart + span;
  render();
}

canvas.addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return;
  panPointerId = e.pointerId;
  panLastClientX = e.clientX;
  panAccum = 0;
  canvas.setPointerCapture(e.pointerId);
  canvas.style.cursor = "grabbing";
  e.preventDefault();
});

canvas.addEventListener("pointermove", (e) => {
  if (panPointerId !== e.pointerId) return;
  const dx = e.clientX - panLastClientX;
  panLastClientX = e.clientX;
  const rect = canvas.getBoundingClientRect();
  const span = viewEnd - viewStart;
  panAccum += (-dx / rect.width) * span;
  const shift = Math.trunc(panAccum);
  if (shift !== 0) {
    panAccum -= shift;
    applyPanByShift(shift);
  }
});

function endPan(e: PointerEvent): void {
  if (panPointerId !== e.pointerId) return;
  panPointerId = null;
  panAccum = 0;
  canvas.style.cursor = "";
  if (canvas.hasPointerCapture(e.pointerId)) {
    canvas.releasePointerCapture(e.pointerId);
  }
}

canvas.addEventListener("pointerup", endPan);
canvas.addEventListener("pointercancel", endPan);
