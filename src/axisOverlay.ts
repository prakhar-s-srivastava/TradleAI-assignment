import type { AxisMarkerX, AxisMarkerY } from "./webgl/candleChart";

function formatPrice(p: number): string {
  if (Math.abs(p) >= 1000) return p.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return p.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/** Place HTML labels over the chart (percent layout matches WebGL NDC). */
export function renderAxisOverlay(
  overlay: HTMLElement,
  markersY: AxisMarkerY[],
  markersX: AxisMarkerX[],
): void {
  overlay.replaceChildren();

  for (const { price, yNdc } of markersY) {
    const el = document.createElement("span");
    el.className = "axis-y";
    el.textContent = formatPrice(price);
    el.style.top = `${(1 - yNdc) * 50}%`;
    overlay.appendChild(el);
  }

  for (const { label, xNdc } of markersX) {
    const el = document.createElement("span");
    el.className = "axis-x";
    el.textContent = label;
    el.style.left = `${(xNdc + 1) * 50}%`;
    overlay.appendChild(el);
  }
}
