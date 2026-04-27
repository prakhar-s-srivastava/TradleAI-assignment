import type { Candle } from "../types/candle";
import fragSource from "../shaders/candle.frag?raw";
import vertSource from "../shaders/candle.vert?raw";

const STRIDE = 5; // x, y, r, g, b

function compileShader(
  gl: WebGL2RenderingContext,
  type: GLenum,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("createShader failed");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? "";
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${log}`);
  }
  return shader;
}

function createProgram(
  gl: WebGL2RenderingContext,
  vert: string,
  frag: string,
): WebGLProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vert);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, frag);
  const program = gl.createProgram();
  if (!program) throw new Error("createProgram failed");
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? "";
    gl.deleteProgram(program);
    throw new Error(`Program link error: ${log}`);
  }
  return program;
}

function pushQuad(
  out: number[],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  r: number,
  g: number,
  b: number,
): void {
  const tri = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => {
    out.push(ax, ay, r, g, b, bx, by, r, g, b, cx, cy, r, g, b);
  };
  tri(x0, y0, x1, y0, x0, y1);
  tri(x1, y0, x1, y1, x0, y1);
}

function pushLine(
  out: number[],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  r: number,
  g: number,
  b: number,
): void {
  out.push(x0, y0, r, g, b, x1, y1, r, g, b);
}

const GRID_RGB: [number, number, number] = [0.2, 0.24, 0.3];
const AXIS_RGB: [number, number, number] = [0.52, 0.58, 0.65];

function niceStep(range: number, targetTicks: number): number {
  const rough = range / Math.max(1, targetTicks);
  if (!Number.isFinite(rough) || rough <= 0) return 1;
  const exp = Math.floor(Math.log10(rough));
  const fract = rough / 10 ** exp;
  const niceFract = fract <= 1 ? 1 : fract <= 2 ? 2 : fract <= 5 ? 5 : 10;
  return niceFract * 10 ** exp;
}

export type ChartLayout = {
  minP: number;
  maxP: number;
  invRange: number;
  margin: number;
  span: number;
  n: number;
  priceToY: (p: number) => number;
  plotLeft: number;
  plotRight: number;
};

function computeLayout(candles: Candle[]): ChartLayout | null {
  if (candles.length === 0) return null;
  let minP = Infinity;
  let maxP = -Infinity;
  for (const c of candles) {
    minP = Math.min(minP, c.l, c.h);
    maxP = Math.max(maxP, c.l, c.h);
  }
  const padY = (maxP - minP) * 0.06 || 1;
  minP -= padY;
  maxP += padY;
  const invRange = 1 / (maxP - minP);
  const priceToY = (p: number) => -1 + 2 * ((p - minP) * invRange);
  const margin = 0.06;
  const span = 2 - 2 * margin;
  return {
    minP,
    maxP,
    invRange,
    margin,
    span,
    n: candles.length,
    priceToY,
    plotLeft: -1 + margin,
    plotRight: 1 - margin,
  };
}

export type AxisMarkerY = { price: number; yNdc: number };
export type AxisMarkerX = { label: string; xNdc: number };

/** Line list (GL_LINES): grid + tick marks + axes; triangles: candles */
export type ChartGeometry = {
  lineVerts: Float32Array;
  triVerts: Float32Array;
  markersY: AxisMarkerY[];
  markersX: AxisMarkerX[];
};

function formatTimeLabel(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function buildChartGeometry(candles: Candle[]): ChartGeometry {
  const layout = computeLayout(candles);
  if (!layout) {
    return {
      lineVerts: new Float32Array(0),
      triVerts: new Float32Array(0),
      markersY: [],
      markersX: [],
    };
  }
  const lines: number[] = [];
  const [gr, gg, gb] = GRID_RGB;
  const [ar, ag, ab] = AXIS_RGB;
  const { plotLeft: xl, plotRight: xr, span, n, priceToY, minP, maxP } = layout;
  const tickNdc = 0.018;

  const step = niceStep(maxP - minP, 6);
  const start = Math.ceil(minP / step) * step;
  const hCount = Math.max(0, Math.floor((maxP - start) / step) + 1);
  const markersY: AxisMarkerY[] = [];
  for (let k = 0; k < hCount; k++) {
    const p = start + k * step;
    const y = priceToY(p);
    pushLine(lines, xl, y, xr, y, gr, gg, gb);
    pushLine(lines, xl - tickNdc, y, xl, y, ar, ag, ab);
    markersY.push({ price: p, yNdc: y });
  }

  for (let i = 0; i <= n; i++) {
    const x = xl + (span * i) / n;
    pushLine(lines, x, -1, x, 1, gr, gg, gb);
    pushLine(lines, x, -1, x, -1 + tickNdc, ar, ag, ab);
  }

  pushLine(lines, xl, -1, xl, 1, ar, ag, ab);
  pushLine(lines, xl, -1, xr, -1, ar, ag, ab);

  const markersX: AxisMarkerX[] = [];
  for (let i = 0; i < n; i++) {
    const xCenter = xl + (span * (i + 0.5)) / n;
    markersX.push({ label: formatTimeLabel(candles[i]!.t), xNdc: xCenter });
  }

  const verts: number[] = [];
  const bodyHalf = (span / n) * 0.32;
  const wickHalf = (span / n) * 0.06;

  for (let i = 0; i < n; i++) {
    const c = candles[i]!;
    const xCenter = xl + (span * (i + 0.5)) / n;
    const bull = c.c >= c.o;
    const r = bull ? 0.2 : 0.93;
    const g = bull ? 0.78 : 0.26;
    const b = bull ? 0.35 : 0.27;
    const rW = r * 0.85;
    const gW = g * 0.85;
    const bW = b * 0.85;

    const yL = priceToY(c.l);
    const yH = priceToY(c.h);
    const yO = priceToY(c.o);
    const yC = priceToY(c.c);
    const yBody0 = Math.min(yO, yC);
    const yBody1 = Math.max(yO, yC);

    pushQuad(verts, xCenter - wickHalf, yL, xCenter + wickHalf, yH, rW, gW, bW);

    const minBody = 0.008;
    let y0 = yBody0;
    let y1 = yBody1;
    if (y1 - y0 < minBody) {
      const mid = (y0 + y1) * 0.5;
      y0 = mid - minBody * 0.5;
      y1 = mid + minBody * 0.5;
    }
    pushQuad(verts, xCenter - bodyHalf, y0, xCenter + bodyHalf, y1, r, g, b);
  }

  return {
    lineVerts: new Float32Array(lines),
    triVerts: new Float32Array(verts),
    markersY,
    markersX,
  };
}

export type CandleChartGL = {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  vao: WebGLVertexArrayObject;
  buffer: WebGLBuffer;
  aPosition: number;
  aColor: number;
};

export function initCandleChart(canvas: HTMLCanvasElement): CandleChartGL {
  const gl = canvas.getContext("webgl2", { antialias: true, premultipliedAlpha: false });
  if (!gl) throw new Error("WebGL2 not available");

  const program = createProgram(gl, vertSource, fragSource);
  const aPosition = gl.getAttribLocation(program, "a_position");
  const aColor = gl.getAttribLocation(program, "a_color");

  const vao = gl.createVertexArray();
  if (!vao) throw new Error("createVertexArray failed");
  gl.bindVertexArray(vao);

  const buffer = gl.createBuffer();
  if (!buffer) throw new Error("createBuffer failed");
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

  const stride = STRIDE * Float32Array.BYTES_PER_ELEMENT;
  gl.enableVertexAttribArray(aPosition);
  gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, stride, 0);
  gl.enableVertexAttribArray(aColor);
  gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, stride, 2 * Float32Array.BYTES_PER_ELEMENT);

  gl.bindVertexArray(null);

  return { gl, program, vao, buffer, aPosition, aColor };
}

export function uploadAndDraw(chart: CandleChartGL, geom: ChartGeometry): void {
  const { gl, program, vao, buffer } = chart;
  const dpr = Math.min(window.devicePixelRatio ?? 1, 2);
  const canvas = gl.canvas as HTMLCanvasElement;
  const w = Math.floor(canvas.clientWidth * dpr);
  const h = Math.floor(canvas.clientHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  gl.viewport(0, 0, canvas.width, canvas.height);

  gl.clearColor(0.086, 0.106, 0.133, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  const { lineVerts, triVerts } = geom;
  const lineBytes = lineVerts.byteLength;
  const totalBytes = lineBytes + triVerts.byteLength;

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, totalBytes, gl.DYNAMIC_DRAW);
  if (lineBytes) gl.bufferSubData(gl.ARRAY_BUFFER, 0, lineVerts);
  if (triVerts.byteLength) gl.bufferSubData(gl.ARRAY_BUFFER, lineBytes, triVerts);

  gl.useProgram(program);
  gl.bindVertexArray(vao);

  const lineCount = lineVerts.length / STRIDE;
  const triCount = triVerts.length / STRIDE;
  if (lineCount > 0) {
    gl.drawArrays(gl.LINES, 0, lineCount);
  }
  if (triCount > 0) {
    gl.drawArrays(gl.TRIANGLES, lineCount, triCount);
  }
  gl.bindVertexArray(null);
}
