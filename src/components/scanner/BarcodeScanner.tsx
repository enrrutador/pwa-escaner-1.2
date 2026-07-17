'use client';

import {
  useRef,
  useEffect,
  useState,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from 'react';
import { useBarcodeDetector } from '@/hooks/useBarcodeDetector';

export interface BarcodeScannerProps {
  onScan: (codigo: string, formato: string) => void;
  activo: boolean;
  cooldownMs?: number;
  onReady?: () => void;
}

export interface BarcodeScannerHandle {
  alternarTorch: () => Promise<boolean>;
  hasTorch: () => boolean;
  apagarCamara: () => void;
}

type CameraState = 'idle' | 'active' | 'denied' | 'error';

function matarStream(stream: MediaStream | null) {
  if (!stream) return;
  stream.getTracks().forEach((track) => {
    track.stop();
    stream.removeTrack(track);
  });
}

function esIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function esGamaBaja(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
    ((navigator as any).deviceMemory && (navigator as any).deviceMemory <= 3) ||
    /Android.*(?:SM-A|SM-J|SM-K|SM-M|SM-G[0-9]|LM-[XQGK]|K40|J7|Grand|Prime|A0[0-9])/i.test(navigator.userAgent)
  );
}

const BarcodeScanner = forwardRef<BarcodeScannerHandle, BarcodeScannerProps>(
  ({ onScan, activo, cooldownMs = 1500, onReady }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const lastScanRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });
    const mountedRef = useRef(true);
    const cropRectRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);

    const [cameraState, setCameraState] = useState<CameraState>('idle');
    const [torchOn, setTorchOn] = useState(false);
    const [torchAvailable, setTorchAvailable] = useState(false);

    const lowEnd = esGamaBaja();

    // BarcodeDetector nativo + ZXing fallback con crop
    const { detect, startZXing, stop: stopEngine, useNative } = useBarcodeDetector({
      onDetect: useCallback((results) => {
        if (!mountedRef.current) return;
        for (const r of results) {
          const codigo = r.rawValue?.trim();
          const formato = r.format;
          if (!codigo || codigo.length < 4) continue;
          const ahora = Date.now();
          if (codigo === lastScanRef.current.code && ahora - lastScanRef.current.time < cooldownMs) continue;
          lastScanRef.current = { code: codigo, time: ahora };
          if (navigator.vibrate) navigator.vibrate([40, 20, 40]);
          onScan(codigo, formato);
          break;
        }
      }, [cooldownMs, onScan]),
      lowEnd,
    });

    // Calcular rectángulo de crop (viewfinder centrado, 70% ancho, 40% alto)
    const calcularCrop = useCallback(() => {
      const video = videoRef.current;
      if (!video || video.videoWidth === 0) return null;
      
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      // Viewfinder: 70% ancho, 40% alto, centrado
      const cropW = Math.round(vw * 0.7);
      const cropH = Math.round(vh * 0.4);
      const cropX = Math.round((vw - cropW) / 2);
      const cropY = Math.round((vh - cropH) / 2);
      
      return { x: cropX, y: cropY, width: cropW, height: cropH };
    }, []);

    // Arranca el engine de detección cuando la cámara está activa
    const scanLoopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    
    useEffect(() => {
      if (cameraState !== 'active') {
        if (scanLoopRef.current) { clearTimeout(scanLoopRef.current); scanLoopRef.current = null; }
        return;
      }
      if (!videoRef.current) return;

      const crop = calcularCrop();
      if (!crop) return;
      cropRectRef.current = crop;

      if (useNative) {
        // Nativo: crear ImageBitmap del crop y detectar
        const tick = async () => {
          if (!mountedRef.current || !videoRef.current || videoRef.current.paused) return;
          const v = videoRef.current;
          const c = cropRectRef.current;
          if (!c) return;
          
          try {
            // Crear bitmap solo de la región del viewfinder
            const bitmap = await createImageBitmap(v, c.x, c.y, c.width, c.height, { resizeQuality: 'low' });
            await detect(bitmap);
            bitmap.close();
          } catch {
            // ignore
          }
          scanLoopRef.current = setTimeout(tick, lowEnd ? 500 : 300);
        };
        scanLoopRef.current = setTimeout(tick, 0);
      } else {
        // ZXing: loop manual con canvas crop
        startZXing(videoRef.current, crop);
      }

      return () => {
        if (scanLoopRef.current) { clearTimeout(scanLoopRef.current); scanLoopRef.current = null; }
      };
    }, [cameraState, useNative, detect, startZXing, lowEnd, calcularCrop]);

    const pausarDecodificacion = useCallback(() => {
      stopEngine();
      if (scanLoopRef.current) { clearTimeout(scanLoopRef.current); scanLoopRef.current = null; }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => { t.enabled = false; });
      }
      if (mountedRef.current) setCameraState('idle');
    }, [stopEngine]);

    const apagarCamaraCompleto = useCallback(() => {
      stopEngine();
      if (scanLoopRef.current) { clearTimeout(scanLoopRef.current); scanLoopRef.current = null; }
      matarStream(streamRef.current);
      streamRef.current = null;
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.load();
      }
      setTorchOn(false);
      setTorchAvailable(false);
      if (mountedRef.current) setCameraState('idle');
    }, [stopEngine]);

    const inicializar = useCallback(async () => {
      if (!mountedRef.current) return;
      if (cameraState === 'active') return;

      // Reusar stream existente (iOS no pide permiso de nuevo)
      if (streamRef.current) {
        const stream = streamRef.current;
        stream.getTracks().forEach(t => { t.enabled = true; });
        if (videoRef.current && videoRef.current.srcObject !== stream) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setCameraState('active');
        onReady?.();
        return;
      }

      // Resolución: 1280x720 siempre (mejor calidad para crop), focusMode continuous
      const videoConstraints: any = {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280, min: 640 },
        height: { ideal: 720, min: 480 },
        focusMode: 'continuous',
      };

      if (esIOS()) {
        videoConstraints.frameRate = { ideal: 24, max: 30 };
      }

      try {
        const stream = await navigator.mediaDevices?.getUserMedia({
          video: videoConstraints,
          audio: false,
        });

        if (!mountedRef.current) { matarStream(stream); return; }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        const track = stream.getVideoTracks()[0];
        if (track) {
          const caps = track.getCapabilities() as any;
          setTorchAvailable(!!caps?.torch);
        }

        if (!mountedRef.current) { matarStream(stream); return; }

        // Esperar a que el video esté reproduciendo
        await new Promise<void>((resolve) => {
          const v = videoRef.current;
          if (!v) { resolve(); return; }
          if (!v.paused && v.readyState >= 2) { resolve(); return; }
          const timeout = setTimeout(resolve, 3000);
          const onPlaying = () => {
            v.removeEventListener('playing', onPlaying);
            clearTimeout(timeout);
            resolve();
          };
          v.addEventListener('playing', onPlaying, { once: true });
        });

        setCameraState('active');
        onReady?.();
      } catch (err: any) {
        if (!mountedRef.current) return;
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setCameraState('denied');
        } else {
          setCameraState('error');
          console.error('[scanner] init error:', err.message);
        }
      }
    }, [cameraState, onReady]);

    useEffect(() => {
      if (activo) {
        if (mountedRef.current) inicializar();
      } else {
        pausarDecodificacion();
      }
    }, [activo, inicializar, pausarDecodificacion]);

    useEffect(() => {
      mountedRef.current = true;
      return () => {
        mountedRef.current = false;
        apagarCamaraCompleto();
      };
    }, [apagarCamaraCompleto]);

    useEffect(() => {
      const handler = () => {
        if (document.hidden) {
          pausarDecodificacion();
        } else if (activo && streamRef.current) {
          setTimeout(() => {
            if (mountedRef.current && activo) inicializar();
          }, 300);
        }
      };
      document.addEventListener('visibilitychange', handler);
      return () => document.removeEventListener('visibilitychange', handler);
    }, [activo, pausarDecodificacion, inicializar]);

    useEffect(() => {
      if (cameraState === 'active' && onReady) onReady();
    }, [cameraState, onReady]);

    const alternarTorch = useCallback(async (): Promise<boolean> => {
      const track = streamRef.current?.getVideoTracks()[0];
      if (!track) return false;
      const caps = track.getCapabilities() as any;
      if (!caps?.torch) return false;

      const nuevo = !torchOn;
      try {
        await track.applyConstraints({ advanced: [{ torch: nuevo } as any] });
        setTorchOn(nuevo);
        return nuevo;
      } catch { return torchOn; }
    }, [torchOn]);

    useImperativeHandle(ref, () => ({
      alternarTorch,
      hasTorch: () => torchAvailable,
      apagarCamara: apagarCamaraCompleto,
    }), [alternarTorch, torchAvailable, apagarCamaraCompleto]);

    // Viewfinder UI
    const viewfinderUI = (
      <div className="viewfinder">
        <div className="corner tl" />
        <div className="corner tr" />
        <div className="corner bl" />
        <div className="corner br" />
        {!lowEnd && <div className="laser" />}
        {cameraState === 'active' && (
          <div className="scan-hint">
            <span>Alineá el código de barras dentro del marco</span>
          </div>
        )}
      </div>
    );

    return (
      <div className="scanner-camera-container">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />

        {activo && viewfinderUI}

        {cameraState === 'denied' && (
          <div className="absolute inset-0 z-20 grid place-items-center bg-black/90">
            <div className="text-center px-6 max-w-[280px]">
              <div className="text-[48px] text-danger mb-3 block" style={{ fontFamily: 'system-ui' }}>📷</div>
              <p className="text-sm font-semibold mb-2">Cámara bloqueada</p>
              <p className="text-xs text-text-faint">
                Habilitá el acceso en Configuración → Safari/Chrome → Cámara.
              </p>
            </div>
          </div>
        )}

        {cameraState === 'error' && (
          <div className="absolute inset-0 z-20 grid place-items-center bg-black/90">
            <div className="text-center px-6 max-w-[280px]">
              <div className="text-[48px] text-warn mb-3 block" style={{ fontFamily: 'system-ui' }}>⚠️</div>
              <p className="text-sm font-semibold mb-2">Cámara no disponible</p>
              <p className="text-xs text-text-faint">
                Cerrá otras apps que usen la cámara e intentá de nuevo.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }
);

BarcodeScanner.displayName = 'BarcodeScanner';
export default BarcodeScanner;