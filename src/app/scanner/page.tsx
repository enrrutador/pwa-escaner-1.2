'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { dbEscaneos } from '@/lib/db-escaneos';
import { dbProductos } from '@/lib/db-productos';

export default function Scanner() {
  const router = useRouter();
  const { mostrarToast } = useUIStore();
  const { usuario } = useAuthStore();
  const [activo, setActivo] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [resultado, setResultado] = useState<{ producto: any; fuente: string } | null>(null);
  const [historial, setHistorial] = useState<any[]>([]);
  const [cargando, setCargando] = useState(false);
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
            const codigoDetectado = barcodes[0].rawValue;
            await procesarCodigo(codigoDetectado, 'camara');
            escaneando.current = false;
            return;
          }
        }
      } catch (e) {
        // BarcodeDetector no disponible, usar fallback
      }
    }

    escaneando.current = false;
    if (activo) requestAnimationFrame(escanearLoop);
  };

  const procesarCodigo = async (codigo: string, origen: 'camara' | 'manual') => {
    if (cargando) return;
    setCargando(true);
    setCodigo(codigo);

    try {
      // Buscar en BD local
      const local
      const producto = await dbProductos.obtenerPorCodigoBarras(codigo) || await dbProductos.obtenerPorPlu(codigo);

      if (producto) {
        await dbEscaneos.registrar({
          codigo,
          origen,
          resultado: 'encontrado',
          productoId: producto.id,
          nombreProducto: producto.nombre,
        });
        setResultado({ producto, fuente: 'local' });
        mostrarToast('exito', `Encontrado: ${producto.nombre}`);
        return;
      }

      // Buscar en API externa
      const res = await fetch(`/api/buscar?q=${encodeURIComponent(codigo)}`);
      const data = await res.json();
      const externos = data.resultados || [];

      if (externos.length > 0) {
        const p = externos[0];
        await dbEscaneos.registrar({
          codigo,
          origen,
          resultado: 'encontrado',
          productoId: null,
          nombreProducto: p.nombre,
        });
        setResultado({ producto: { ...p, externo: true }, fuente: p.fuente });
        mostrarToast('exito', `Encontrado en ${p.fuente}: ${p.nombre}`);
        return;
      }

      // No encontrado
      await dbEscaneos.registrar({
        codigo,
        origen,
        resultado: 'no_encontrado',
      });
      setResultado({ producto: { codigo, nombre: 'No encontrado' }, fuente: 'ninguna' });
      mostrarToast('advertencia', 'Código no encontrado en ninguna fuente');
    } catch (e: any) {
      mostrarToast('error', 'Error al buscar: ' + e.message);
    } finally {
      setCargando(false);
      await cargarHistorial();
    }
  };

  const manejarInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCodigo(e.target.value);
  };

  const manejarSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (codigo.trim()) procesarCodigo(codigo.trim(), 'manual');
  };

  const irAFicha = (productoId: string) => {
    if (productoId) router.push(`/producto/${productoId}`);
  };

  return (
    <div className="space-y-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-center">Escáner</h1>

      {/* Cámara */}
      <div className="relative aspect-[4/3] bg-navy-900 rounded-xl overflow-hidden">
        {activo && videoRef.current && (
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />
        )}
        {!activo && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-zinc-500">
            <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <button
              onClick={iniciarCamara}
              className="px-6 py-3 bg-cyan-500 text-navy-950 font-semibold rounded-lg hover:bg-cyan-400"
            >
              Iniciar cámara
            </button>
          </div>
        )}

        {/* Overlay de escaneo */}
        {activo && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-48 h-28 border-2 border-cyan-500/50 rounded-lg relative">
              <div className="absolute -top-2 -left-2 w-4 h-4 border-t-2 border-l-2 border-cyan-500" />
              <div className="absolute -top-2 -right-2 w-4 h-4 border-t-2 border-r-2 border-cyan-500" />
              <div className="absolute -bottom-2 -left-2 w-4 h-4 border-b-2 border-l-2 border-cyan-500" />
              <div className="absolute -bottom-2 -right-2 w-4 h-4 border-b-2 border-r-2 border-cyan-500" />
              <div className="absolute bottom-10 left-1/2 -translate-x-1/2 text-cyan-500 text-xs">Apuntá al código</div>
            </div>
          </div>
        )}

        {!activo && streamRef.current === null && (
          <button
            onClick={iniciarCamara}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 px-6 py-3 bg-cyan-500 text-navy-950 font-semibold rounded-lg hover:bg-cyan-400"
          >
            Iniciar cámara
          </button>
        )}

        {activo && (
          <button
            onClick={detenerCamara}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 px-6 py-3 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600"
          >
            Detener cámara
          </button>
        )}
      </div>

      {/* Input manual */}
      <form onSubmit={manejarSubmit} className="flex gap-2">
        <input
          type="text"
          value={codigo}
          onChange={manejarInput}
          placeholder="Ingresar código manualmente..."
          className="flex-1 px-4 py-3 bg-navy-900 border border-navy-700 rounded-xl text-white placeholder-zinc-500 focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent"
          autoFocus
        />
        <button
          type="submit"
          disabled={cargando || !codigo.trim()}
          className="px-6 py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 disabled:opacity-50"
        >
          {cargando ? 'Buscando...' : 'Buscar'}
        </button>
      </form>

      {/* Resultado */}
      {resultado && (
        <div className="bg-navy-900/50 border border-navy-700 rounded-xl p-4 space-y-3 animate-slide-up">
          <div className="flex items-center gap-2">
            <span className="text-3xl">{resultado.producto.externo ? '🌐' : '📦'}</span>
            <div>
              <p className="font-semibold">{resultado.producto.nombre}</p>
              <p className="text-sm text-zinc-400">Fuente: {resultado.fuente}</p>
            </div>
          </div>
          {resultado.producto.codigoBarras && (
            <p className="text-sm font-mono text-cyan-400">EAN: {resultado.producto.codigoBarras}</p>
          )}
          {resultado.producto.precio && (
            <p className="text-lg font-bold text-orange-400">${resultado.producto.precio.toLocaleString('es-AR')}</p>
          )}
          {resultado.producto.id && (
            <button
              onClick={() => irAFicha(resultado.producto.id)}
              className="w-full py-2 bg-cyan-500 text-navy-950 font-semibold rounded-lg hover:bg-cyan-400"
            >
              Ver ficha completa
            </button>
          )}
          {resultado.fuente === 'ninguna' && (
            <button
              onClick={() => router.push('/inventario/nuevo')}
              className="w-full py-2 bg-orange-500/20 text-orange-400 border border-orange-500/50 rounded-lg hover:bg-orange-500/30"
            >
              Crear producto con este código
            </button>
          )}
        </div>
      )}

      {/* Historial */}
      <section>
        <h2 className="font-semibold mb-3">Historial reciente</h2>
        <div className="bg-navy-900/50 border border-navy-700 rounded-xl overflow-hidden">
          {historial.length === 0 ? (
            <p className="p-6 text-center text-zinc-500">Sin escaneos aún</p>
          ) : (
            <ul className="divide-y divide-navy-800">
              {historial.map((e) => (
                <li key={e.id} className="p-3 flex items-center justify-between hover:bg-navy-800/50">
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full ${
                      e.resultado === 'encontrado' ? 'bg-green-400' : 'bg-red-400'
                    }`} />
                    <div>
                      <p className="font-mono text-sm">{e.codigo}</p>
                      <p className="text-xs text-zinc-500">{e.nombreProducto || 'Sin nombre'}</p>
                    </div>
                  </div>
                  <span className="text-xs text-zinc-500">{new Date(e.createdAt).toLocaleTimeString('es-AR')}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
