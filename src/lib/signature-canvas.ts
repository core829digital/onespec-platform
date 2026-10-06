/**
 * The signature pad's drawing engine: pointer events (mouse, touch and pen through one path), strokes kept as points,
 * redrawn on every resize and theme change, exported as a black-on-white PNG. No React in here, so it can be tested in a real browser.
 *
 * Why strokes and not pixels: the pad is sized AFTER layout (it can appear when data has loaded, or when a tab opens), and the ink colour
 * follows the theme. Keeping the points lets the pad repaint itself at the right size and colour at any moment, and lets the saved picture
 * be rendered separately, always dark ink on a white page.
 */
import { EXPORT_WIDTH, INK_SAVED, INK_WIDTH, isRealSignature, strokeStats, type Point, type Stroke } from "./signature";

export interface SignatureCanvasOptions {
  /** The saved picture (PNG data URL) once a real signature exists; null when there is none (empty, cleared, or just a dot). */
  onChange: (dataUrl: string | null) => void;
  /** True as soon as anything is drawn (hides the "sign here" hint). */
  onInk?: (hasInk: boolean) => void;
  /** Ink colour on screen. */
  ink: string;
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke, color: string, width: number): void {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (stroke.length === 0) return;
  if (stroke.length < 3) {
    // a tap: a dot; two points: a straight line
    if (stroke.length === 1) {
      ctx.beginPath();
      ctx.arc(stroke[0].x, stroke[0].y, width / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      ctx.lineTo(stroke[1].x, stroke[1].y);
      ctx.stroke();
    }
    return;
  }
  // smooth the line through the midpoints of the samples
  ctx.beginPath();
  ctx.moveTo(stroke[0].x, stroke[0].y);
  for (let i = 1; i < stroke.length - 1; i++) {
    const mx = (stroke[i].x + stroke[i + 1].x) / 2;
    const my = (stroke[i].y + stroke[i + 1].y) / 2;
    ctx.quadraticCurveTo(stroke[i].x, stroke[i].y, mx, my);
  }
  const last = stroke[stroke.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
}

export class SignatureCanvas {
  private strokes: Stroke[] = [];
  private current: Stroke | null = null;
  private activePointer: number | null = null;
  private ctx: CanvasRenderingContext2D;
  private cssWidth = 0;
  private cssHeight = 0;
  private dpr = 1;
  private ink: string;
  private observer: ResizeObserver | null = null;
  private readonly handlers: Array<[string, (e: PointerEvent) => void]>;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly opts: SignatureCanvasOptions,
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas is not available");
    this.ctx = ctx;
    this.ink = opts.ink;
    canvas.style.touchAction = "none";
    canvas.style.userSelect = "none";
    this.handlers = [
      ["pointerdown", (e) => this.down(e)],
      ["pointermove", (e) => this.move(e)],
      ["pointerup", (e) => this.up(e)],
      ["pointercancel", (e) => this.up(e)],
    ];
    for (const [name, fn] of this.handlers) canvas.addEventListener(name, fn as EventListener);
    // Sized now and on every later layout change (a pad that appears late, a rotated phone, a resized window).
    this.resize();
    if (typeof ResizeObserver !== "undefined") {
      this.observer = new ResizeObserver(() => this.resize());
      this.observer.observe(canvas);
    }
  }

  destroy(): void {
    for (const [name, fn] of this.handlers) this.canvas.removeEventListener(name, fn as EventListener);
    this.observer?.disconnect();
  }

  setInk(color: string): void {
    if (color === this.ink) return;
    this.ink = color;
    this.redraw();
  }

  clear(): void {
    this.strokes = [];
    this.current = null;
    this.redraw();
    this.emit();
  }

  hasInk(): boolean {
    return this.strokes.length > 0;
  }

  /** The strokes, for tests and for repainting. */
  getStrokes(): Stroke[] {
    return this.strokes;
  }

  /** The picture that gets saved: dark ink on white, fixed width, proportions of the pad. */
  exportPng(): string | null {
    if (this.cssWidth <= 0 || this.cssHeight <= 0) return null;
    const scale = EXPORT_WIDTH / this.cssWidth;
    const out = document.createElement("canvas");
    out.width = EXPORT_WIDTH;
    out.height = Math.max(1, Math.round(this.cssHeight * scale));
    const octx = out.getContext("2d");
    if (!octx) return null;
    octx.fillStyle = "#ffffff";
    octx.fillRect(0, 0, out.width, out.height);
    octx.scale(scale, scale);
    for (const s of this.strokes) drawStroke(octx, s, INK_SAVED, INK_WIDTH);
    return out.toDataURL("image/png");
  }

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    const dpr = window.devicePixelRatio || 1;
    if (rect.width === this.cssWidth && rect.height === this.cssHeight && dpr === this.dpr) return;
    this.cssWidth = rect.width;
    this.cssHeight = rect.height;
    this.dpr = dpr;
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.redraw();
  }

  private redraw(): void {
    const { ctx, canvas, dpr } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const s of this.strokes) drawStroke(ctx, s, this.ink, INK_WIDTH);
  }

  private point(e: PointerEvent): Point {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private down(e: PointerEvent): void {
    if (this.activePointer !== null) return; // a second finger / the palm does not start another stroke
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    this.activePointer = e.pointerId;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* capture is a nicety (keeps the line going outside the pad); drawing works without it */
    }
    this.current = [this.point(e)];
    this.strokes.push(this.current);
    drawStroke(this.ctx, this.current, this.ink, INK_WIDTH);
    this.opts.onInk?.(true);
  }

  private move(e: PointerEvent): void {
    if (e.pointerId !== this.activePointer || !this.current) return;
    e.preventDefault();
    const samples = typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : [];
    const events = samples.length > 0 ? samples : [e];
    for (const ev of events) {
      const p = this.point(ev);
      const prev = this.current[this.current.length - 1];
      if (Math.hypot(p.x - prev.x, p.y - prev.y) < 0.5) continue;
      this.current.push(p);
    }
    // repaint the live stroke over a clean page so the smoothing never leaves ghost segments
    this.redraw();
  }

  private up(e: PointerEvent): void {
    if (e.pointerId !== this.activePointer) return;
    this.activePointer = null;
    this.current = null;
    try {
      this.canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    this.emit();
  }

  private emit(): void {
    this.opts.onInk?.(this.strokes.length > 0);
    this.opts.onChange(isRealSignature(this.strokes) ? this.exportPng() : null);
  }
}

export { strokeStats };
