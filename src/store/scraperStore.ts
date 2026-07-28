// src/store/scraperStore.ts
// Estado global del scraper de autocompletado.
// Lo usa AppShell para animar el logo/cubo superior izquierdo.

import { create } from 'zustand';

type EstadoScraper = 'inactivo' | 'procesando' | 'finalizado';

interface ScraperState {
  estado: EstadoScraper;
  total: number;
  procesados: number;
  completados: number;
  setProcesando: (total: number) => void;
  setProgreso: (procesados: number, completados: number) => void;
  setFinalizado: (total: number, completados: number) => void;
  reset: () => void;
}

export const useScraperStore = create<ScraperState>((set) => ({
  estado: 'inactivo',
  total: 0,
  procesados: 0,
  completados: 0,
  setProcesando: (total) => set({ estado: 'procesando', total, procesados: 0, completados: 0 }),
  setProgreso: (procesados, completados) => set({ procesados, completados }),
  setFinalizado: (total, completados) => set({ estado: 'finalizado', total, completados }),
  reset: () => set({ estado: 'inactivo', total: 0, procesados: 0, completados: 0 }),
}));
