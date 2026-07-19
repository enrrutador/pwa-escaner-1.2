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

const BarcodeScanner = forwardRef<BarcodeScannerHandle, BarcodeScannerProps>(
  ({ onScan, activo, cooldownMs = 1500, onReady }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const lastScanRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });
    const mountedRef = useRef(true);

    const [cameraState, setCameraState] = useState<CameraState>('idle');
    const [torchOn, setTorchOn] = useState(false);
    const [torchAvailable, setTorchAvailable] = useState(false);

    const isIOS = esIOS();

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
    });

    const scanLoopRef = useRef<number | null>(null);

    useEffect(() => {
      if (cameraState !== 'active') {
        if (scanLoopRef.current) { cancelAnimationFrame(scanLoopRef.current); scanLoopRef.current = null; }
        return;
      }
      if (!videoRef.current) return;

      if (useNative) {
        const loop = () => {
          if (!mountedRef.current || !videoRef.current) return;
          detect(videoRef.current);
          scanLoopRef.current = requestAnimationFrame(loop);
        };
        scanLoopRef.current = requestAnimationFrame(loop);
      } else {
        startZXing(videoRef.current);
      }

      return () => {
        if (scanLoopRef.current) { cancelAnimationFrame(scanLoopRef.current); scanLoopRef.current = null; }
      };
    }, [cameraState, useNative, detect, startZXing]);

    const pausarDecodificacion = useCallback(() => {
      stopEngine();
      if (scanLoopRef.current) { cancelAnimationFrame(scanLoopRef.current); scanLoopRef.current = null; }
      if (mountedRef.current) setCameraState('idle');
    }, [stopEngine]);

    const apagarCamaraCompleto = useCallback(() => {
      stopEngine();
      if (scanLoopRef.current) { cancelAnimationFrame(scanLoopRef.current); scanLoopRef.current = null; }
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

      const videoConstraints: any = {
        facingMode: { ideal: 'environment' },
      };

      if (isIOS) {
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
          // focusMode es una capability avanzada, se aplica vía applyConstraints
          if (caps?.focusMode && Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
            try {
              await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as any] });
            } catch {}
          }
        }

        if (!mountedRef.current) { matarStream(stream); return; }

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
    }, [cameraState, onReady, isIOS]);

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

    const getModeBadge = () => {
      if (useNative) return '🟢 NATIVO';
      return '🔵 ZXING';
    };

    const viewfinderUI = (
      <div className="viewfinder">
        <div className="corner tl" />
        <div className="corner tr" />
        <div className="corner bl" />
        <div className="corner br" />
        {!isIOS && <div className="laser" />}
        {cameraState === 'active' && (
          <div className="scan-hint">
            <span>Alineá el código de barras dentro del marco</span>
          </div>
        )}
        {cameraState === 'active' && (
          <div style={{
            position: 'absolute', top: 8, right: 8, zIndex: 10,
            background: 'rgba(0,0,0,0.6)', color: '#fff',
            padding: '2px 8px', borderRadius: 4, fontSize: '10px',
            fontFamily: 'monospace', fontWeight: 600
          }}>
            {getModeBadge()}
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