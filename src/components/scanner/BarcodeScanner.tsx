'use client';

import { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
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
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const scanningRef = useRef(false);
  const torchRef = useRef(false);

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

      try {
        if (controlsRef.current) {
          controlsRef.current.stop();
          controlsRef.current = null;
        }

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

        // Use ZXing to directly handle camera + decoding (no dual stream)
        controlsRef.current = await readerRef.current.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result, err) => {
            if (!isMounted) return;
            if (result) {
              handleScan(result.getText());
            }
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
