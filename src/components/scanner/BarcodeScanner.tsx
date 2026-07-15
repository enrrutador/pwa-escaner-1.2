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
    /Android.*(?:SM-A|SM-J|SM-K|LM-[XQGK]|K40)/i.test(navigator.userAgent)
  );
}

const BarcodeScanner = forwardRef<BarcodeScannerHandle, BarcodeScannerProps>(
  ({ onScan, activo, cooldownMs = 1500, onReady }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const lastScanRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });
    const mountedRef = useRef(true);
    const scanLoopRef = useRef<number | null>(null);
    const cameraStateRef = useRef<CameraState>('idle');

    const [cameraState, setCameraState] = useState<CameraState>('idle');
    const [torchOn, setTorchOn] = useState(false);
    const [torchAvailable, setTorchAvailable] = useState(false);

    // Sincronizar ref con state para que el loop no capture stale
    useEffect(() => {
      cameraStateRef.current = cameraState;
    }, [cameraState]);

    // Nuevo hook: BarcodeDetector nativo + fallback ZXing
    const { detect, ensureZXing, stop: stopDetector, useNative } = useBarcodeDetector({
      onDetect: useCallback((results) => {
        if (!mountedRef.current) return;
        for (const r of results) {
          const codigo = r.rawValue?.trim();
          const formato = r.format;
          if (!codigo || codigo.length < 4) continue;

          const ahora = Date.now();
          if (
            codigo === lastScanRef.current.code &&
            ahora - lastScanRef.current.time < cooldownMs
          ) continue;

          lastScanRef.current = { code: codigo, time: ahora };
          if (navigator.vibrate) navigator.vibrate([40, 20, 40]);
          onScan(codigo, formato);
          break; // solo el primero
        }
      }, [cooldownMs, onScan]),
      throttleMs: 150, // ~6-7 fps max, ahorra CPU en gama baja
    });

    const apagarCamaraCompleto = useCallback(() => {
      stopDetector();
      if (scanLoopRef.current) {
        cancelAnimationFrame(scanLoopRef.current);
        scanLoopRef.current = null;
      }
      matarStream(streamRef.current);
      streamRef.current = null;
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.load();
      }
      setTorchOn(false);
      setTorchAvailable(false);
      if (mountedRef.current) {
        setCameraState('idle');
      }
    }, [stopDetector]);

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
        await waitForPlaying(videoRef.current);
        setCameraState('active');
        onReady?.();
        return;
      }

      // Resoluciones: 1280x720 en gama baja = ~5px/módulo EAN-13 a 30cm (mínimo robusto)
      const videoConstraints: any = esGamaBaja()
        ? { facingMode: { ideal: 'environment' }, width: { ideal: 1280, min: 960 }, height: { ideal: 720, min: 540 }, focusMode: 'continuous' }
        : { facingMode: { ideal: 'environment' }, width: { ideal: 1280, min: 640 }, height: { ideal: 720, min: 480 } };

      if (esIOS()) {
        videoConstraints.frameRate = { ideal: 24, max: 30 };
      }

      try {
        // Iniciar getUserMedia inmediatamente (es lo que tarda 3s en gama baja)
        const stream = await navigator.mediaDevices?.getUserMedia({
          video: videoConstraints,
          audio: false,
        });

        if (!mountedRef.current) {
          matarStream(stream);
          return;
        }

        streamRef.current = stream;

        // Signal visual inmediato: mostrar video apenas llegue el stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        const track = stream.getVideoTracks()[0];
        if (track) {
          const caps = track.getCapabilities() as any;
          setTorchAvailable(!!caps?.torch);
        }

        if (!mountedRef.current) {
          matarStream(stream);
          return;
        }

        // Esperar a que el video esté REPRODUCIENDO antes de iniciar decode loop
        await waitForPlaying(videoRef.current);

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

    // Espera a que video.play() resuelva y haya frames fluyendo
    const waitForPlaying = useCallback(async (video: HTMLVideoElement | null) => {
      if (!video) return;
      // Si ya está playing, ok
      if (!video.paused && video.readyState >= 2) return;
      // Esperar evento 'playing' o timeout 3s
      await new Promise<void>(resolve => {
        const timeout = setTimeout(resolve, 3000);
        const onPlaying = () => {
          video.removeEventListener('playing', onPlaying);
          clearTimeout(timeout);
          resolve();
        };
        video.addEventListener('playing', onPlaying, { once: true });
      });
    }, []);

    // Loop de escaneo: detect() para native, ensureZXing() para arrancar ZXing una vez
    const startScanLoop = useCallback(() => {
      // Siempre cancelar loop viejo primero para permitir reinicio cuando useNative cambie
      if (scanLoopRef.current) cancelAnimationFrame(scanLoopRef.current);
      const loop = () => {
        if (!mountedRef.current || cameraStateRef.current !== 'active' || !videoRef.current) return;
        if (useNative) {
          detect(videoRef.current);
        } else {
          ensureZXing(videoRef.current);
        }
        scanLoopRef.current = requestAnimationFrame(loop);
      };
      scanLoopRef.current = requestAnimationFrame(loop);
    }, [detect, ensureZXing, useNative]);

    const stopScanLoop = useCallback(() => {
      if (scanLoopRef.current) {
        cancelAnimationFrame(scanLoopRef.current);
        scanLoopRef.current = null;
      }
    }, []);

    // Efecto que arranca/para el loop SOLO cuando cameraState cambia a/from 'active'
    useEffect(() => {
      if (cameraState === 'active') {
        startScanLoop();
      } else {
        stopScanLoop();
      }
    }, [cameraState, startScanLoop, stopScanLoop]);

    const pausarDecodificacion = useCallback(() => {
      stopScanLoop();
      stopDetector();
      // Pausar tracks sin matar el stream (iOS no pide permiso de nuevo)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => { t.enabled = false; });
      }
      if (mountedRef.current) {
        setCameraState('idle');
      }
    }, [stopDetector, stopScanLoop]);

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
      if (cameraState === 'active' && onReady) {
        onReady();
      }
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

    // Viewfinder UI (esquinas, laser, hint) — renderizado SIEMPRE encima del video
    const viewfinderUI = (
      <div className="viewfinder">
        <div className="corner tl" />
        <div className="corner tr" />
        <div className="corner bl" />
        <div className="corner br" />
        <div className="laser" />
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

        {/* Viewfinder SIEMPRE visible cuando activo=true (encima del video) */}
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