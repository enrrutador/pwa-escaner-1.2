'use client';

import {
  useRef,
  useEffect,
  useState,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from 'react';
import { useBarcodeDetector, detectFromVideoFrame, BURST_VALID_FORMATS } from '@/hooks/useBarcodeDetector';

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
type BurstState = 'idle' | 'capturing' | 'processing';

const BURST_FRAMES = 6;
const BURST_INTERVAL_MS = 120;

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
  const ua = navigator.userAgent;
  const hw = navigator.hardwareConcurrency;
  const mem = (navigator as any).deviceMemory;
  
  console.log('[Scanner] Device detection:', { 
    ua, 
    hardwareConcurrency: hw, 
    deviceMemory: mem,
    isLowEnd: (hw && hw <= 4) || (mem && mem <= 3) ||
      /Android.*(?:SM-A|SM-J|SM-K|SM-M|SM-G[0-9]|LM-[XQGK]|K40|J7|Grand|Prime|A0[0-9]|LM-X|LM-K|LM-Q|LG[- ][KM])/i.test(ua)
  });
  
  return (
    (hw && hw <= 4) ||
    (mem && mem <= 3) ||
    /Android.*(?:SM-A|SM-J|SM-K|SM-M|SM-G[0-9]|LM-[XQGK]|K40|J7|Grand|Prime|A0[0-9]|LM-X|LM-K|LM-Q|LG[- ][KM])/i.test(ua)
  );
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

    const lowEnd = esGamaBaja();

    // Burst mode state (solo low-end Android)
    const [burstState, setBurstState] = useState<BurstState>('idle');
    const [burstProgress, setBurstProgress] = useState(0);
    const burstAbortRef = useRef(false);

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

    const scanLoopRef = useRef<number | null>(null);
    const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
      if (cameraState !== 'active') {
        if (scanLoopRef.current) { cancelAnimationFrame(scanLoopRef.current); scanLoopRef.current = null; }
        if (scanTimeoutRef.current) { clearTimeout(scanTimeoutRef.current); scanTimeoutRef.current = null; }
        return;
      }
      if (!videoRef.current) return;

      if (useNative) {
        if (lowEnd) {
          const tick = async () => {
            if (!mountedRef.current || !videoRef.current || videoRef.current.paused) return;
            await detect(videoRef.current);
            scanTimeoutRef.current = setTimeout(tick, 300);
          };
          scanTimeoutRef.current = setTimeout(tick, 300);
        } else {
          const loop = () => {
            if (!mountedRef.current || !videoRef.current) return;
            detect(videoRef.current);
            scanLoopRef.current = requestAnimationFrame(loop);
          };
          scanLoopRef.current = requestAnimationFrame(loop);
        }
      } else {
        startZXing(videoRef.current);
      }

      return () => {
        if (scanLoopRef.current) { cancelAnimationFrame(scanLoopRef.current); scanLoopRef.current = null; }
        if (scanTimeoutRef.current) { clearTimeout(scanTimeoutRef.current); scanTimeoutRef.current = null; }
      };
    }, [cameraState, useNative, detect, startZXing, lowEnd]);

    const pausarDecodificacion = useCallback(() => {
      stopEngine();
      if (scanLoopRef.current) { cancelAnimationFrame(scanLoopRef.current); scanLoopRef.current = null; }
      if (scanTimeoutRef.current) { clearTimeout(scanTimeoutRef.current); scanTimeoutRef.current = null; }
      if (mountedRef.current) setCameraState('idle');
    }, [stopEngine]);

    const apagarCamaraCompleto = useCallback(() => {
      stopEngine();
      if (scanLoopRef.current) { cancelAnimationFrame(scanLoopRef.current); scanLoopRef.current = null; }
      if (scanTimeoutRef.current) { clearTimeout(scanTimeoutRef.current); scanTimeoutRef.current = null; }
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

    // Burst mode: captura N frames consecutivos y procesa con ZBar
    const iniciarBurst = useCallback(async () => {
      if (!lowEnd || burstState !== 'idle') return;
      if (!videoRef.current || videoRef.current.readyState < 2) return;

      burstAbortRef.current = false;
      setBurstState('capturing');
      setBurstProgress(0);

      try {
        const video = videoRef.current;
        const validFormats = new Set(BURST_VALID_FORMATS);

        for (let i = 0; i < BURST_FRAMES; i++) {
          if (burstAbortRef.current || !mountedRef.current) break;
          
          setBurstProgress(i + 1);
          
          const results = await detectFromVideoFrame(video);
          
          for (const r of results) {
            const codigo = r.rawValue?.trim();
            const formato = r.format;
            if (!codigo || codigo.length < 4) continue;
            if (!validFormats.has(formato)) continue;
            
            const ahora = Date.now();
            if (codigo === lastScanRef.current.code && ahora - lastScanRef.current.time < cooldownMs) continue;
            
            lastScanRef.current = { code: codigo, time: ahora };
            if (navigator.vibrate) navigator.vibrate([40, 20, 40]);
            
            setBurstState('idle');
            setBurstProgress(0);
            onScan(codigo, formato);
            return;
          }

          // Pequeña pausa entre frames
          if (i < BURST_FRAMES - 1) {
            await new Promise(r => setTimeout(r, BURST_INTERVAL_MS));
          }
        }
      } catch (err) {
        console.warn('[Burst] Error:', err);
      } finally {
        if (mountedRef.current) {
          setBurstState('idle');
          setBurstProgress(0);
        }
      }
    }, [lowEnd, burstState, cooldownMs, onScan]);

    const cancelarBurst = useCallback(() => {
      burstAbortRef.current = true;
      setBurstState('idle');
      setBurstProgress(0);
    }, []);

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

      const videoConstraints: any = lowEnd
        ? { facingMode: { ideal: 'environment' }, width: { ideal: 640, min: 480, max: 800 }, height: { ideal: 480, min: 360, max: 600 }, focusMode: 'continuous' }
        : { facingMode: { ideal: 'environment' }, width: { ideal: 1280, min: 640 }, height: { ideal: 720, min: 480 }, focusMode: 'continuous' };

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
          const settings = track.getSettings();
          console.log('[Scanner] Stream resolution:', settings.width, 'x', settings.height, '| focusMode:', caps?.focusMode);
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
    }, [cameraState, onReady, lowEnd]);

    useEffect(() => {
      if (activo) {
        if (mountedRef.current) inicializar();
      } else {
        pausarDecodificacion();
        cancelarBurst();
      }
    }, [activo, inicializar, pausarDecodificacion, cancelarBurst]);

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
          cancelarBurst();
        } else if (activo && streamRef.current) {
          setTimeout(() => {
            if (mountedRef.current && activo) inicializar();
          }, 300);
        }
      };
      document.addEventListener('visibilitychange', handler);
      return () => document.removeEventListener('visibilitychange', handler);
    }, [activo, pausarDecodificacion, inicializar, cancelarBurst]);

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
      if (useNative && lowEnd) return '🟡 POLYFILL WASM';
      if (useNative) return '🟢 NATIVO';
      return '🔵 ZXING';
    };

    const viewfinderUI = (
      <div className="viewfinder">
        <div className="corner tl" />
        <div className="corner tr" />
        <div className="corner bl" />
        <div className="corner br" />
        {!lowEnd && <div className="laser" />}
        {cameraState === 'active' && burstState === 'idle' && (
          <div className="scan-hint">
            <span>Alineá el código de barras dentro del marco</span>
          </div>
        )}
        {lowEnd && (
          <div style={{
            position: 'absolute', top: 8, right: 8, zIndex: 10,
            background: 'rgba(255,193,7,0.9)', color: '#000',
            padding: '2px 8px', borderRadius: 4, fontSize: '10px',
            fontFamily: 'monospace', fontWeight: 600
          }}>
            {getModeBadge()}
          </div>
        )}
        {burstState === 'capturing' && (
          <div style={{
            position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 10,
            background: 'rgba(0,0,0,0.85)', color: '#fff',
            padding: '8px 16px', borderRadius: 8, fontSize: '13px',
            fontFamily: 'monospace', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8
          }}>
            <span style={{width: 80, textAlign: 'right'}}>{burstProgress}/{BURST_FRAMES}</span>
            <div style={{width: 120, height: 4, background: '#333', borderRadius: 2, overflow: 'hidden'}}>
              <div style={{
                width: `${(burstProgress / BURST_FRAMES) * 100}%`, height: '100%',
                background: '#FFC107', transition: 'width 100ms linear'
              }} />
            </div>
          </div>
        )}
        {burstState === 'processing' && (
          <div style={{
            position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 10,
            background: 'rgba(0,0,0,0.85)', color: '#fff',
            padding: '8px 16px', borderRadius: 8, fontSize: '13px',
            fontFamily: 'monospace', fontWeight: 600
          }}>
            Procesando…
          </div>
        )}
      </div>
    );

    // Botón de captura burst (solo low-end, cámara activa, no en burst)
    const burstButton = lowEnd && cameraState === 'active' && burstState === 'idle' && (
      <button
        onClick={iniciarBurst}
        style={{
          position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 20,
          width: 72, height: 72, borderRadius: '50%',
          background: '#FFC107', border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        aria-label="Capturar código"
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="4" />
        </svg>
      </button>
    );

    // Botón cancelar burst
    const cancelButton = (burstState === 'capturing' || burstState === 'processing') && (
      <button
        onClick={cancelarBurst}
        style={{
          position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 20,
          padding: '10px 20px', borderRadius: 8,
          background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff',
          fontSize: '13px', fontWeight: 600,
        }}
      >
        Cancelar
      </button>
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
        {burstButton}
        {cancelButton}

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