// src/lib/eventBus.ts
// EventBus simple para notificar cambios en productos/movimientos y recargar métricas en tiempo real.

type Listener = () => void;

const listeners = new Set<Listener>();

export const eventBus = {
  emit() {
    listeners.forEach((l) => {
      try { l(); } catch (e) { console.error('[eventBus] listener error:', e); }
    });
  },
  on(listener: Listener) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
};
