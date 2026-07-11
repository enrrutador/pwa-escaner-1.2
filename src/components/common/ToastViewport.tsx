'use client';

import { useUIStore } from '@/store/uiStore';

export function ToastViewport() {
  const { toasts, quitarToast } = useUIStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-24 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl animate-slide-up ${
            toast.tipo === 'exito' && 'bg-green-600/90'
          } ${toast.tipo === 'error' && 'bg-red-600/90'} ${
            toast.tipo === 'info' && 'bg-cyan-600/90'
          } ${toast.tipo === 'advertencia' && 'bg-orange-600/90'}`}
          onClick={() => quitarToast(toast.id)}
        >
          <span className="text-sm">{toast.mensaje}</span>
        </div>
      ))}
    </div>
  );
}
