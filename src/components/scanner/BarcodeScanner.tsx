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
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const torchRef = useRef(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleScan = useCallback((texto: string) => {
    if (!scanningRef.current) {
      scanningRef.current = true;
      onScan(texto);
      setTimeout(() => { scanningRef.current = false; }, 2000);
    }
  }, [onScan]);

  useImperativeHandle(ref, () => ({
    alternarTorch: async () => {
      const track = streamRef.current?.getVideoTracks()[0];
      if (!track) return;
      const caps = track.getCapabilities() as any;
      if (caps.torch) {
        try {
          torchRef.current = !torchRef.current;
          await track.applyConstraints({ advanced: [{ torch: torchRef.current }] } as any);
        } catch (err) {
          console.error('Error flash:', err);
        }
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
        // 1. Get camera stream FIRST (user permission happens here)
        const constraints = {
          video: { 
            facingMode: 'environment', 
            width: { ideal: 1280 }, 
            height: { ideal: 720 },
            frameRate: { ideal: 30 }
          }
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        if (!isMounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = stream;
        videoRef.current.srcObject = stream;

        // 2. Wait for video to be playing
        await new Promise<void>((resolve, reject) => {
          const video = videoRef.current!;
          video.onloadeddata = () => resolve();
          video.onerror = reject;
          video.play().catch(reject);
        });

        if (!isMounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        // 3. Initialize ZXing reader with the existing stream
        if (!readerRef.current) {
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

        // 4. Start decoding from the video element that already has the stream
        controlsRef.current = await readerRef.current.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result, err) => {
            if (!isMounted) return;
            if (result) {
              handleScan(result.getText());
            }
            if (err && err.name !== 'NotFoundException' && err.name !== 'ChecksumException' && err.name !== 'FormatException') {
              console.debug('[Scanner] ZXing:', err.name);
            }
          }
        );

        if (isMounted) {
          setCameraReady(true);
          onCameraReady?.();
        }
      } catch (err: any) {
        console.error('[Scanner] Error:', err);
        if (isMounted) {
          setError(err.name === 'NotAllowedError' ? 'Permiso de cámara denegado' : 
                   err.name === 'NotFoundError' ? 'No hay cámara disponible' :
                   err.name === 'NotReadableError' ? 'Cámara en uso por otra app' :
                   err.message || 'Error al iniciar cámara');
          setCameraReady(false);
        }
      }
    }

    function stop() {
      if (controlsRef.current) {
        controlsRef.current.stop();
        controlsRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
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
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
        height: '100%', gap: 16, color: 'var(--danger)', padding: 20, textAlign: 'center'
      }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        <p style={{ fontWeight: 600 }}>Error de cámara</p>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>{error}</p>
        <button onClick={() => { setError(null); }} style={{ marginTop: 8, padding: '10px 20px', background: 'var(--primary)', color: 'var(--on-primary)', borderRadius: 'var(--r-lg)', fontWeight: 600 }}>
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