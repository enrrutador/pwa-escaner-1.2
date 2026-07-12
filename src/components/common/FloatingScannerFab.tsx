'use client';

import { useRef, useState, useCallback } from 'react';
import Link from 'next/link';

export function FloatingScannerFab() {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);
  const moved = useRef(false);
  const start = useRef({ x: 0, y: 0 });
  const origRect = useRef({ left: 0, top: 0 });

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
      href="/scanner"
      className="fab"
      style={pos ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' } : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onClick={(e) => { if (moved.current) e.preventDefault(); }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7V5a2 2 0 0 1 2-2h2" />
        <path d="M17 3h2a2 2 0 0 1 2 2v2" />
        <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
        <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
        <rect width="10" height="10" x="7" y="7" rx="1" />
      </svg>
    </Link>
  );
}
