'use client';

import {
  useRef,
  useEffect,
  useState,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from 'react';

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
    const readerRef = useRef<any>(null);
    const controlsRef = useRef<{ stop: () => void } | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const lastScanRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });
    const mountedRef = useRef(true);
    const primeraAperturaRef = useRef(true);

    const [cameraState, setCameraState] = useState<CameraState>('idle');
    const [torchOn, setTorchOn] = useState(false);
    const [torchAvailable, setTorchAvailable] = useState(false);

    const pausarDecodificacion = useCallback(() => {
      if (controlsRef.current) {
        try { controlsRef.current.stop(); } catch {}
        controlsRef.current = null;
      }
      if (readerRef.current) {
        try { readerRef.current.reset?.(); } catch {}
        readerRef.current = null;
      }
      // Pausar tracks sin matar el stream (iOS no pide permiso de nuevo)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => { t.enabled = false; });
      }
      if (mountedRef.current) {
        setCameraState('idle');
      }
    }, []);

    const apagarCamaraCompleto = useCallback(() => {
      if (controlsRef.current) {
        try { controlsRef.current.stop(); } catch {}
        controlsRef.current = null;
      }
      if (readerRef.current) {
        try { readerRef.current.reset?.(); } catch {}
        readerRef.current = null;
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
    }, []);

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
        await reanudarDecodificacion();
        return;
      }

      try {
        const [zxingBrowser, zxingLib, stream] = await Promise.all([
          import('@zxing/browser'),
          import('@zxing/library'),
          navigator.mediaDevices?.getUserMedia({
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280, min: 640 },
              height: { ideal: 720, min: 480 },
              ...(esIOS() ? { frameRate: { ideal: 24, max: 30 } } : {}),
            },
            audio: false,
          }),
        ]);

        if (!mountedRef.current) {
          matarStream(stream);
          return;
        }

        const { BrowserMultiFormatReader } = zxingBrowser;
        const { DecodeHintType, BarcodeFormat } = zxingLib;

        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.QR_CODE,
        ]);
        hints.set(DecodeHintType.TRY_HARDER, true);

        streamRef.current = stream;

        const track = stream.getVideoTracks()[0];
        if (track) {
          const caps = track.getCapabilities() as any;
          setTorchAvailable(!!caps?.torch);
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        if (!mountedRef.current) {
          matarStream(stream);
          return;
        }

        setCameraState('active');
        onReady?.();

        const reader = new BrowserMultiFormatReader(hints);
        readerRef.current = reader;

        const controls = await reader.decodeFromVideoElement(
          videoRef.current!,
          (result: any, _err: any, _ctrl: any) => {
            if (!result || !mountedRef.current) return;

            const codigo = result.getText().trim();
            const formato = BarcodeFormat[result.getBarcodeFormat()] ?? 'UNKNOWN';
            const ahora = Date.now();

            if (
              codigo === lastScanRef.current.code &&
              ahora - lastScanRef.current.time < cooldownMs
            ) return;

            if (codigo.length < 4) return;

            lastScanRef.current = { code: codigo, time: ahora };
            if (navigator.vibrate) navigator.vibrate([40, 20, 40]);

            onScan(codigo, formato);
          }
        );

        controlsRef.current = controls;
      } catch (err: any) {
        if (!mountedRef.current) return;
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setCameraState('denied');
        } else {
          setCameraState('error');
          console.error('[scanner] init error:', err.message);
        }
      }
    }, [cameraState, cooldownMs, onScan, onReady]);

    const reanudarDecodificacion = useCallback(async () => {
      if (!mountedRef.current) return;
      if (!streamRef.current || !videoRef.current) return;
      if (controlsRef.current) return;

      // Reactivar tracks pausadas
      streamRef.current.getTracks().forEach(t => { t.enabled = true; });

      try {
        const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([
          import('@zxing/browser'),
          import('@zxing/library'),
        ]);

        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.QR_CODE,
        ]);
        hints.set(DecodeHintType.TRY_HARDER, true);

        const reader = new BrowserMultiFormatReader(hints);
        readerRef.current = reader;

        const controls = await reader.decodeFromVideoElement(
          videoRef.current,
          (result: any, _err: any, _ctrl: any) => {
            if (!result || !mountedRef.current) return;

            const codigo = result.getText().trim();
            const formato = BarcodeFormat[result.getBarcodeFormat()] ?? 'UNKNOWN';
            const ahora = Date.now();

            if (
              codigo === lastScanRef.current.code &&
              ahora - lastScanRef.current.time < cooldownMs
            ) return;

            if (codigo.length < 4) return;

            lastScanRef.current = { code: codigo, time: ahora };
            if (navigator.vibrate) navigator.vibrate([40, 20, 40]);

            onScan(codigo, formato);
          }
        );

        controlsRef.current = controls;
        if (mountedRef.current) {
          setCameraState('active');
          onReady?.();
        }
      } catch (err) {
        console.error('[scanner] reanudarDecodificacion error:', err);
      }
    }, [cooldownMs, onScan]);

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
          // Background: pausar tracks sin matar stream (iOS no pide permiso al volver)
          pausarDecodificacion();
        } else if (activo && streamRef.current) {
          // Foreground: reusar stream existente
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