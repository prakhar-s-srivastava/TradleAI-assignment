import type { AxisMarkerVolY, AxisMarkerX, AxisMarkerY } from "./webgl/candleChart";

function formatPrice(p: number): string {
  if (Math.abs(p) >= 1000) return p.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return p.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function formatVolume(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(2)}k`;
  return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export type AxisOverlayLayout = {
  /** NDC y where the time-label row sits (between price and volume panes). */
  bottomLabelNdc: number;
};

function clampPct(p: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, p));
}

/** Place HTML labels over the chart (percent layout matches WebGL NDC). */
export function renderAxisOverlay(
  overlay: HTMLElement,
  markersY: AxisMarkerY[],
  markersX: AxisMarkerX[],
  markersVolY: AxisMarkerVolY[],
  layout: AxisOverlayLayout,
): void {
  overlay.replaceChildren();

  for (const { price, yNdc } of markersY) {
    const topPct = (1 - yNdc) * 50;
    if (topPct < 4) continue;
    const el = document.createElement("span");
    el.className = "axis-y";
    el.textContent = formatPrice(price);
    el.style.top = `${clampPct(topPct, 4, 96)}%`;
    overlay.appendChild(el);
  }

  for (const { volume, yNdc } of markersVolY) {
    const topPct = (1 - yNdc) * 50;
    const el = document.createElement("span");
    el.className = "axis-vol-y";
    el.textContent = formatVolume(volume);
    el.style.top = `${clampPct(topPct, 4, 98)}%`;
    overlay.appendChild(el);
  }

  for (const { label, xNdc } of markersX) {
    const el = document.createElement("span");
    el.className = "axis-x";
    el.textContent = label;
    el.style.left = `${(xNdc + 1) * 50}%`;
    el.style.top = `${(1 - layout.bottomLabelNdc) * 50}%`;
    el.style.transform = "translate(-50%, -50%)";
    overlay.appendChild(el);
  }
}
