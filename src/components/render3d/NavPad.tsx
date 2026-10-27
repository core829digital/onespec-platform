"use client";

/**
 * On-screen arrows to move around the 3D room without dragging: turn (or slide) while a button is held, zoom in and out. They also answer
 * the keyboard arrows and + / -. Dragging stays available; this is the way that costs nothing on a slow screen and works with one finger.
 */
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Minus, Move, Plus, RotateCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { NavInput } from "./Render3DViewer";

const IDLE: NavInput = { yaw: 0, pitch: 0, zoom: 0, panX: 0, panY: 0 };

export interface NavPadLabels {
  pad: string;
  rotate: string;
  slide: string;
  up: string;
  down: string;
  left: string;
  right: string;
  zoomIn: string;
  zoomOut: string;
}

export function NavPad({ onNavigate, labels }: { onNavigate: (v: NavInput) => void; labels: NavPadLabels }) {
  const [slide, setSlide] = useState(false);
  const held = useRef(new Set<string>());
  const slideRef = useRef(false);

  const push = useCallback(() => {
    const h = held.current;
    const dir = (neg: string, pos: string) => (h.has(pos) ? 1 : 0) - (h.has(neg) ? 1 : 0);
    const x = dir("left", "right");
    const y = dir("down", "up");
    const zoom = dir("out", "in");
    onNavigate(slideRef.current ? { yaw: 0, pitch: 0, zoom, panX: x, panY: y } : { yaw: x, pitch: y, zoom, panX: 0, panY: 0 });
  }, [onNavigate]);

  const press = useCallback((k: string) => { held.current.add(k); push(); }, [push]);
  const release = useCallback((k: string) => { held.current.delete(k); push(); }, [push]);
  const stopAll = useCallback(() => { held.current.clear(); onNavigate(IDLE); }, [onNavigate]);

  // The keyboard: arrows and + / - (not while typing in a field).
  useEffect(() => {
    const map: Record<string, string> = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down", "+": "in", "=": "in", "-": "out", _: "out" };
    const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));
    const down = (e: KeyboardEvent) => {
      const k = map[e.key];
      if (!k || typing(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault();
      press(k);
    };
    const up = (e: KeyboardEvent) => {
      const k = map[e.key];
      if (k) release(k);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", stopAll);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", stopAll);
      onNavigate(IDLE);
    };
  }, [press, release, stopAll, onNavigate]);

  // Changing between turning and sliding while a button is held would leave it stuck: stop first.
  useEffect(() => {
    slideRef.current = slide;
    stopAll();
  }, [slide, stopAll]);

  const btn = (k: string, label: string, icon: ReactNode, area: string) => (
    <button
      key={k}
      type="button"
      className="r3d-btn r3d-nav-btn"
      style={{ gridArea: area }}
      aria-label={label}
      title={label}
      data-testid={`r3d-nav-${k}`}
      onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture?.(e.pointerId); press(k); }}
      onPointerUp={() => release(k)}
      onPointerCancel={() => release(k)}
      onLostPointerCapture={() => release(k)}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!e.repeat) press(k); } }}
      onKeyUp={(e) => { if (e.key === "Enter" || e.key === " ") release(k); }}
    >
      {icon}
    </button>
  );

  return (
    <div className="r3d-nav" role="group" aria-label={labels.pad} data-testid="r3d-nav">
      <div className="r3d-nav-grid">
        {btn("up", labels.up, <ArrowUp size={20} aria-hidden="true" />, "u")}
        {btn("left", labels.left, <ArrowLeft size={20} aria-hidden="true" />, "l")}
        <button
          type="button"
          className="r3d-btn r3d-nav-btn"
          style={{ gridArea: "c" }}
          aria-pressed={slide}
          aria-label={slide ? labels.slide : labels.rotate}
          title={slide ? labels.slide : labels.rotate}
          data-testid="r3d-nav-mode"
          onClick={() => setSlide((v) => !v)}
        >
          {slide ? <Move size={18} aria-hidden="true" /> : <RotateCw size={18} aria-hidden="true" />}
        </button>
        {btn("right", labels.right, <ArrowRight size={20} aria-hidden="true" />, "r")}
        {btn("down", labels.down, <ArrowDown size={20} aria-hidden="true" />, "d")}
      </div>
      <div className="r3d-nav-zoom">
        {btn("in", labels.zoomIn, <Plus size={20} aria-hidden="true" />, "")}
        {btn("out", labels.zoomOut, <Minus size={20} aria-hidden="true" />, "")}
      </div>
    </div>
  );
}
