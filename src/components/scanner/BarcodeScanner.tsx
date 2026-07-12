'use client';

import { useEffect, useRef, useImperativeHandle, forwardRef, useState, useCallback } from 'react';
import { BrowserMultiFormatReader, IScannerControls, BarcodeFormat } from '@zxing/browser';

interface BarcodeScannerProps {
  onScan: (codigo: string) => void;
  activo: boolean;
}

export interface BarcodeScannerHandle {
  alternarTorch: () => Promise<void>;
}

export const BarcodeScanner = forwardRef<BarcodeScannerHandle, BarcodeScannerProps>(({ onScan, activo }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [torchState, setTorchState] = useState(false);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const scanningRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);

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
      const track = streamRef.current?.getVideoTracks()[0];
      if (!track) return;
      const caps = track.getCapabilities() as any;
      if (caps.torch) {
        try {
          await track.applyConstraints({ advanced: [{ torch: !torchState }] } as any);
          setTorchState(!torchState);
        } catch (err) {
          console.error('Error flash:', err);
        }
      } else {
        console.warn('Flash no soportado');
      }
    }
  }), [torchState]);

  useEffect(() => {
    let isMounted = true;

    async function start() {
      if (!activo || !videoRef.current) return;

      try {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'environment', 
            width: { ideal: 1280 }, 
            height: { ideal: 720 }
          }
        });

        if (!isMounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        
        // Esperar a que el video esté listo
        await new Promise<void>((resolve, reject) => {
          if (!videoRef.current) return reject();
          videoRef.current.onloadedmetadata = () => resolve();
          videoRef.current.onerror = reject;
          videoRef.current.play().catch(reject);
        });

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

        controlsRef.current = await readerRef.current.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result, err) => {
            if (result) {
              handleScan(result.getText());
            }
            // Log errors occasionally
            if (err && err.name !== 'NotFoundException') {
              console.debug('[Scanner] ZXing:', err.name);
            }
          }
        );

        console.log('[Scanner] Cámara iniciada y escaneando');
      } catch (err) {
        console.error('[Scanner] Error iniciando cámara:', err);
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
  }, [activo, handleScan]);

  return (
    <video
      ref={videoRef}
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      playsInline
      muted
    />
  );
});

BarcodeScanner.displayName = 'BarcodeScanner';