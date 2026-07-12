'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { dbEscaneos } from '@/lib/db-escaneos';
import { dbProductos } from '@/lib/db-productos';

function ScannerInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoCamara = searchParams.get('auto') === '1';
  const { mostrarToast } = useUIStore();
  const { usuario } = useAuthStore();
  const [activo, setActivo] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [resultado, setResultado] = useState<{ producto: any; fuente: string } | null>(null);
  const [historial, setHistorial] = useState<any[]>([]);
  const [cargando, setCargando] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const escaneando = useRef(false);

  const cargarHistorial = useCallback(async () => {
    const h = await dbEscaneos.listar({ limite: 20 });
    setHistorial(h);
  }, []);

  useEffect(() => {
    cargarHistorial();
  }, [cargarHistorial]);

  useEffect(() => {
    if (autoCamara && !activo) {
      iniciarCamara();
    }
  }, [autoCamara]);

  const iniciarCamara = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActivo(true);
      escanearLoop();
    } catch (e: any) {
      mostrarToast('error', 'No se pudo acceder a la cámara: ' + e.message);
    }
  };

  const detenerCamara = () => {
    escaneando.current = false;
    setActivo(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const escanearLoop = async () => {
    if (!activo || !videoRef.current || escaneando.current) return;
    escaneando.current = true;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const video = videoRef.current;

    if (video.videoWidth > 0 && video.videoHeight > 0) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx?.drawImage(video, 0, 0);

      try {
        const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
        if (imageData && (window as any).BarcodeDetector) {
          const detector = new (window as any).BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'] });
          const barcodes = await detector.detect(imageData);
          if (barcodes.length > 0) {
            await procesarCodigo(barcodes[0].rawValue, 'camara');
            escaneando.current = false;
            return;
          }
        }
      } catch {}
    }

    escaneando.current = false;
    if (activo) requestAnimationFrame(escanearLoop);
  };

  const procesarCodigo = async (cod: string, origen: 'camara' | 'manual') => {
    if (cargando) return;
    setCargando(true);
    setCodigo(cod);

    try {
      const producto = await dbProductos.obtenerPorCodigoBarras(cod) || await dbProductos.obtenerPorPlu(cod);

      if (producto) {
        await dbEscaneos.registrar({ codigo: cod, origen, resultado: 'encontrado', productoId: producto.id, nombreProducto: producto.nombre });
        setResultado({ producto, fuente: 'local' });
        return;
      }

      const res = await fetch(`/api/buscar?q=${encodeURIComponent(cod)}`);
      const data = await res.json();
      const externos = data.resultados || [];

      if (externos.length > 0) {
        const p = externos[0];
        await dbEscaneos.registrar({ codigo: cod, origen, resultado: 'encontrado', productoId: null, nombreProducto: p.nombre });
        setResultado({ producto: { ...p, externo: true }, fuente: p.fuente });
        return;
      }

      await dbEscaneos.registrar({ codigo: cod, origen, resultado: 'no_encontrado' });
      setResultado({ producto: { codigo: cod, nombre: 'No encontrado' }, fuente: 'ninguna' });
    } catch (e: any) {
      mostrarToast('error', 'Error al buscar: ' + e.message);
    } finally {
      setCargando(false);
      await cargarHistorial();
    }
  };

  const manejarSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (codigo.trim()) procesarCodigo(codigo.trim(), 'manual');
  };

  return (
    <div className="screen active" style={{ padding: 0, gap: 0 }}>
      {/* Scanner overlay */}
      <div className={`scanner-overlay${activo ? ' active' : ''}`}>
        <div className="scan-cam" />
        <div className="scan-ui">
          <div className="scan-top">
            <button className="icon-btn" onClick={detenerCamara}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </button>
            <h1>Escanear producto</h1>
            <div style={{ width: 40 }} />
          </div>
          <div className="scan-main">
            <div className="viewfinder">
              <div className="corner tl" />
              <div className="corner tr" />
              <div className="corner bl" />
              <div className="corner br" />
              <div className="laser" />
              <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'var(--r-xl)' }} playsInline muted />
            </div>
            <div className="scan-hint"><span>Alineá el código de barras dentro del marco</span></div>
          </div>
          <div className="scan-foot">
            <button className={`flash${flashOn ? ' on' : ''}`} onClick={() => setFlashOn(!flashOn)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            </button>
            <button className="manual" onClick={() => { detenerCamara(); setShowManual(true); }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.001"/><path d="M10 8h.001"/><path d="M14 8h.001"/><path d="M18 8h.001"/><path d="M8 12h.001"/><path d="M12 12h.001"/><path d="M16 12h.001"/><path d="M7 16h10"/></svg>
              Entrada manual
            </button>
          </div>
        </div>
      </div>

      {/* Manual input / results (shown when not scanning) */}
      {!activo && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <p className="eyebrow">Escanear</p>
              <h1 className="h-page">Código de barras</h1>
            </div>

            <button onClick={iniciarCamara} className="btn-primary">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9a2 2 0 0 1 2-2h.93a2 2 0 0 0 1.664-.89l.812-1.22A2 2 0 0 1 10.07 4h3.86a2 2 0 0 1 1.664.89l.812 1.22A2 2 0 0 0 18.07 7H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z"/><circle cx="15" cy="13" r="3"/></svg>
              Abrir cámara
            </button>

            <form onSubmit={manejarSubmit} className="form-panel">
              <div className="fp-head">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.001"/><path d="M10 8h.001"/><path d="M14 8h.001"/><path d="M18 8h.001"/></svg>
                <h2>Entrada manual</h2>
              </div>
              <div className="fgrid">
                <div className="field full">
                  <label>Código <span className="req">*</span></label>
                  <input
                    type="text"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value)}
                    placeholder="EAN, PLU o código interno"
                    required
                  />
                </div>
                <div className="field full" style={{ gap: 10, marginTop: 4 }}>
                  <button type="submit" className="btn-primary" disabled={cargando || !codigo.trim()}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                    {cargando ? 'Buscando...' : 'Buscar producto'}
                  </button>
                </div>
              </div>
            </form>

            {resultado && (
              <div className="form-panel" style={{ animation: 'fade .32s var(--ease)' }}>
                <div className="fp-head">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                  <h2>Resultado</h2>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 12, background: 'var(--surface-high)', borderRadius: 'var(--r-xl)', border: '1px solid var(--line-soft)' }}>
                    <div className="thumb">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="name">{resultado.producto.nombre}</div>
                      <div className="time">{resultado.fuente}</div>
                    </div>
                    <span className="sku">#{codigo}</span>
                  </div>

                  {resultado.producto.id && (
                    <button onClick={() => router.push(`/producto/${resultado.producto.id}`)} className="btn-primary">
                      Ver ficha completa
                    </button>
                  )}
                  {resultado.fuente === 'ninguna' && (
                    <button onClick={() => router.push('/inventario/nuevo')} className="btn-ghost">
                      Crear producto con este código
                    </button>
                  )}
                </div>
              </div>
            )}

            {historial.length > 0 && (
              <div>
                <h3 className="section-title" style={{ marginBottom: 12 }}>Historial reciente</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {historial.map((e) => (
                    <div key={e.id} className="scan-row">
                      <div className="thumb">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><rect width="10" height="10" x="7" y="7" rx="1"/></svg>
                      </div>
                      <div className="info">
                        <div className="name">{e.nombreProducto || e.codigo}</div>
                        <div className="time">{new Date(e.createdAt).toLocaleTimeString('es-AR')}</div>
                      </div>
                      <div className="sku">#{e.codigo}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
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
