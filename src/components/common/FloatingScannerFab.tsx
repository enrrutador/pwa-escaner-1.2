'use client';

import { useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSettingsStore } from '@/store/settingsStore';

const COLORS = [
  'oklch(62% 0.17 258)',   // naranja default
  'oklch(55% 0.22 270)',   // azul
  'oklch(60% 0.18 145)',   // verde
  'oklch(65% 0.20 30)',    // rojo
  'oklch(70% 0.15 85)',    // amarillo
  'oklch(68% 0.18 320)',   // rosa
  'oklch(62% 0.16 200)',   // cyan
  'oklch(72% 0.12 60)',    // dorado
];

export function FloatingScannerFab() {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);
  const moved = useRef(false);
  const start = useRef({ x: 0, y: 0 });
  const origRect = useRef({ left: 0, top: 0 });
  const fabColor = useSettingsStore((s) => s.fabColor);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    moved.current = false;
    dragging.current = true;
    start.current = { x: e.clientX, y: e.clientY };
    const r = (e.target as HTMLElement).getBoundingClientRect();
    origRect.current = { left: r.left, top: r.top };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved.current = true;
    if (moved.current) {
      setPos({ x: origRect.current.left + dx, y: origRect.current.top + dy });
    }
  }, []);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  return (
    <Link
      href="/scanner?auto=1"
      className="fab"
      style={{
        ...(pos ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' } : {}),
        background: fabColor,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onClick={(e) => { if (moved.current) e.preventDefault(); }}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7V5a2 2 0 0 1 2-2h2" />
        <path d="M17 3h2a2 2 0 0 1 2 2v2" />
        <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
        <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
        <rect width="10" height="10" x="7" y="7" rx="1" />
      </svg>
    </Link>
  );
}
