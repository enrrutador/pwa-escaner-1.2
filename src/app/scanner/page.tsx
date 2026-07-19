'use client';

import { useState, useEffect, useRef, useCallback, Suspense, lazy } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUIStore } from '@/store/uiStore';
import { dbEscaneos } from '@/lib/db-escaneos';
import { dbProductos } from '@/lib/db-productos';
import type { BarcodeScannerHandle } from '@/components/scanner/BarcodeScanner';

const BarcodeScanner = lazy(() => import('@/components/scanner/BarcodeScanner'));

function ScannerInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { mostrarToast } = useUIStore();

  const [activo, setActivo] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);
  const [escaneado, setEscaneado] = useState('');
  const [torchOn, setTorchOn] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [buscando, setBuscando] = useState(false);

  const scannerRef = useRef<BarcodeScannerHandle>(null);

  useEffect(() => {
    const cleanup = () => {
      scannerRef.current?.apagarCamara();
    };
    // Solo apagar al cerrar la página del escáner (unmount), no en popstate
    return () => {
      cleanup();
    };
  }, []);

  const onScan = useCallback(async (codigo: string, _formato: string) => {
    if (buscando) return;

    // Limpiar el código: solo dígitos para EAN/UPC
    const codigoLimpio = codigo.trim().replace(/[^0-9]/g, '');

    setEscaneado(codigoLimpio);
    setActivo(false);
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 300);
    setBuscando(true);

    try {
      const producto = await dbProductos.obtenerPorCodigoBarras(codigoLimpio)
        || await dbProductos.obtenerPorPlu(codigoLimpio);

      if (producto) {
        await dbEscaneos.registrar({
          codigo: codigoLimpio, origen: 'camara', resultado: 'encontrado',
          productoId: producto.id, nombreProducto: producto.nombre,
          imagen: producto.imagen ?? null,
        });
        router.push(`/producto/${producto.id}/editar`);
        return;
      }

      const res = await fetch(`/api/buscar?q=${encodeURIComponent(codigoLimpio)}`);
      const data = await res.json();
      const externos = data.resultados || [];

      if (externos.length > 0) {
        const p = externos[0];
        await dbEscaneos.registrar({
          codigo: codigoLimpio, origen: 'camara', resultado: 'encontrado',
          nombreProducto: p.nombre, imagen: p.imagen ?? null,
        });
        const params = new URLSearchParams({
          cod: codigoLimpio, nom: p.nombre || '', img: p.imagen || '',
          des: p.descripcion || '', pre: String(p.precio || ''), mar: p.marca || '',
        });
        router.push(`/inventario/nuevo?${params.toString()}`);
      } else {
        await dbEscaneos.registrar({
          codigo: codigoLimpio, origen: 'camara', resultado: 'no_encontrado',
        });
        router.push(`/inventario/nuevo?cod=${encodeURIComponent(codigoLimpio)}`);
      }
    } catch (e: any) {
      mostrarToast('error', 'Error: ' + e.message);
      setActivo(true);
    } finally {
      setBuscando(false);
    }
  }, [buscando, router, mostrarToast]);

  const volver = () => {
    router.back();
  };

  const irAManual = () => {
    setActivo(false);
    router.push('/inventario/nuevo');
  };

  return (
    <div className="screen active" style={{ padding: 0, gap: 0 }}>
      <div className={`scanner-overlay${activo ? ' active' : ''}`}>
        <div className="scan-ui">
          {/* Top bar */}
          <div className="scan-top">
            <button className="icon-btn" onClick={volver}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </button>
            <h1>Escanear producto</h1>
            <div style={{ width: 40 }} />
          </div>

          {/* Viewfinder - renderizado DENTRO de BarcodeScanner */}
{activo && (
              <BarcodeScanner
                ref={scannerRef}
                activo={activo}
                onScan={onScan}
                cooldownMs={1500}
                onReady={() => setCameraReady(true)}
              />
            )}

          {/* Footer - solo cuando cámara lista */}
          {cameraReady && (
            <div className="scan-foot">
              <button
                className={`flash${torchOn ? ' on' : ''}`}
                onClick={() => { scannerRef.current?.alternarTorch(); setTorchOn(!torchOn); }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              </button>
            </div>
          )}
        </div>

        {/* Flash verde al detectar */}
        {showFlash && <div className="absolute inset-0 z-50 bg-green-500/30 animate-flash pointer-events-none" />}
      </div>

      {/* Pantalla manual */}
      {!activo && (
        <div className="screen active" style={{ padding: 20, gap: 20, paddingTop: 60 }}>
          <div>
            <p className="eyebrow">Escanear</p>
            <h1 className="h-page">Código de barras</h1>
          </div>

          <button onClick={() => setActivo(true)} className="btn-primary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9a2 2 0 0 1 2-2h.93a2 2 0 0 0 1.664-.89l.812-1.22A2 2 0 0 1 10.07 4h3.86a2 2 0 0 1 1.664.89l.812 1.22A2 2 0 0 0 18.07 7H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-1-2V9z"/><circle cx="15" cy="13" r="3"/></svg>
            Abrir cámara
          </button>

          <form onSubmit={(e) => { e.preventDefault(); if (escaneado.trim()) onScan(escaneado.trim(), 'manual'); }} className="form-panel">
            <div className="fp-head">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.001"/><path d="M10 8h.001"/><path d="M14 8h.001"/><path d="M18 8h.001"/></svg>
              <h2>Entrada manual</h2>
            </div>
            <div className="fgrid">
              <div className="field full">
                <label>Código</label>
                <input type="text" value={escaneado} onChange={(e) => setEscaneado(e.target.value)} placeholder="EAN, PLU o código" autoFocus />
              </div>
              <div className="field full" style={{ gap: 10, marginTop: 4 }}>
                <button type="submit" className="btn-primary" disabled={buscando || !escaneado.trim()}>
                  {buscando ? 'Buscando...' : 'Buscar producto'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default function Scanner() {
  return (
    <Suspense fallback={<div className="screen active"><div className="empty"><p>Cargando...</p></div></div>}>
      <ScannerInner />
    </Suspense>
  );
}