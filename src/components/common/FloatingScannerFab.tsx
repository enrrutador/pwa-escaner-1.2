'use client';

import Link from 'next/link';

export function FloatingScannerFab() {
  return (
    <Link
      href="/scanner"
      className="fixed bottom-6 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-orange-500 text-white shadow-lg hover:bg-orange-600 transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-950"
      aria-label="Abrir escáner"
    >
      <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17l4 4m0 0l-4 4m4-4H3" />
      </svg>
    </Link>
  );
}
