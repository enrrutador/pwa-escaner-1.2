'use client';

import { useEffect, useRef, useImperativeHandle, forwardRef, useCallback, useState } from 'react';
import { BrowserMultiFormatReader, IScannerControls, BarcodeFormat } from '@zxing/browser';

interface BarcodeScannerProps {
  onScan: (codigo: string) => void;
  activo: boolean;
  onCameraReady?: () => void;
}

export interface BarcodeScannerHandle {
  alternarTorch: () => Promise<void>;
}

export const BarcodeScanner = forwardRef<BarcodeScannerHandle, BarcodeScannerProps>(({ onScan, activo, onCameraReady }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const scanningRef = useRef(false);
  const torchRef = useRef(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleScan = useCallback((texto: string) => {
    if (!scanningRef.current) {
      scanningRef.current = true;
      console.log('[Scanner] Código detectado:', texto);
      onScan(texto);
      setTimeout(() => { scanningRef.current = false; }, 2000);
    }
  }, [onScan]);

  useImperativeHandle(ref, () => ({
    alternarTorch: async () => {
      const video = videoRef.current;
      if (!video?.srcObject) return;
      const stream = video.srcObject as MediaStream;
      const track = stream.getVideoTracks()[0];
      if (!track) return;
      const caps = track.getCapabilities() as any;
      if (caps.torch) {
        try {
          torchRef.current = !torchRef.current;
          await track.applyConstraints({ advanced: [{ torch: torchRef.current }] } as any);
        } catch (err) {
          console.error('Error flash:', err);
        }
      } else {
        console.warn('Flash no soportado');
      }
    }
  }), []);

  useEffect(() => {
    let isMounted = true;

    async function start() {
      if (!activo || !videoRef.current) return;

      setError(null);
      setCameraReady(false);

      try {
        console.log('[Scanner] === INICIANDO CÁMARA ===');
        
        // Stop previous if any
        if (controlsRef.current) {
          console.log('[Scanner] Deteniendo cámara anterior');
          controlsRef.current.stop();
          controlsRef.current = null;
        }

        if (!readerRef.current) {
          console.log('[Scanner] Creando BrowserMultiFormatReader');
          readerRef.current = new BrowserMultiFormatReader();
          const hints = new Map();
          hints.set('possible_formats', [
            BarcodeFormat.EAN_13,
            BarcodeFormat.EAN_8,
            BarcodeFormat.UPC_A,
            BarcodeFormat.UPC_E,
            BarcodeFormat.CODE_128,
            BarcodeFormat.CODE_39,
            BarcodeFormat.ITF,
          ]);
          readerRef.current.setHints(hints);
        }

        scanningRef.current = false;

        console.log('[Scanner] Llamando decodeFromVideoDevice...');
        
        // Start decoding - this will request camera permission and start stream
        controlsRef.current = await readerRef.current.decodeFromVideoDevice(
          undefined, // deviceId - undefined = default
          videoRef.current,
          (result, err) => {
            if (!isMounted) return;
            if (result) {
              console.log('[Scanner] Resultado:', result.getText());
              handleScan(result.getText());
            }
            if (err && err.name !== 'NotFoundException' && err.name !== 'ChecksumException' && err.name !== 'FormatException') {
              console.debug('[Scanner] ZXing error:', err.name, err.message);
            }
          }
        );

        console.log('[Scanner] decodeFromVideoDevice completado, controlsRef:', !!controlsRef.current);

        // Check if video has stream
        const video = videoRef.current;
        if (video && video.srcObject) {
          console.log('[Scanner] Video stream activo:', video.srcObject);
          
          // Wait for video to be ready
          if (video.readyState >= 2) {
            console.log('[Scanner] Video ya listo (readyState >= 2)');
            if (isMounted) {
              setCameraReady(true);
              onCameraReady?.();
            }
          } else {
            console.log('[Scanner] Esperando video.onloadeddata...');
            await new Promise<void>((resolve) => {
              if (!video) return resolve();
              const timeout = setTimeout(() => {
                console.warn('[Scanner] Timeout esperando video');
                resolve();
              }, 3000);
              
              video.onloadeddata = () => {
                clearTimeout(timeout);
                console.log('[Scanner] Video loadeddata');
                resolve();
              };
              video.onerror = (e) => {
                clearTimeout(timeout);
                console.error('[Scanner] Video error:', e);
                resolve();
              };
              video.play().catch((e) => {
                console.warn('[Scanner] play() falló:', e);
              });
            });
            
            if (isMounted) {
              setCameraReady(true);
              onCameraReady?.();
            }
          }
        } else {
          console.error('[Scanner] ERROR: video.srcObject es null - no hay stream');
          setError('No se pudo obtener stream de cámara');
        }

        console.log('[Scanner] Cámara iniciada y escaneando');
      } catch (err: any) {
        console.error('[Scanner] ERROR iniciando cámara:', err);
        if (isMounted) {
          setError(err.message || 'Error al iniciar cámara');
          setCameraReady(false);
        }
      }
    }

    function stop() {
      console.log('[Scanner] === DETENIENDO CÁMARA ===');
      if (controlsRef.current) {
        controlsRef.current.stop();
        controlsRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setCameraReady(false);
    }

    if (activo) {
      start();
    } else {
      stop();
      scanningRef.current = false;
    }

    return () => {
      isMounted = false;
      stop();
    };
  }, [activo, handleScan, onCameraReady]);

  if (error) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100%', 
        gap: 16,
        color: 'var(--danger)',
        padding: 20,
        textAlign: 'center'
      }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        <p style={{ fontWeight: 600 }}>Error de cámara</p>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>{error}</p>
        <button 
          onClick={() => { setError(null); window.location.reload(); }}
          style={{ marginTop: 8, padding: '10px 20px', background: 'var(--primary)', color: 'var(--on-primary)', borderRadius: 'var(--r-lg)', fontWeight: 600 }}
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: cameraReady ? 1 : 0, transition: 'opacity 0.3s' }}
      playsInline
      muted
    />
  );
});

BarcodeScanner.displayName = 'BarcodeScanner';