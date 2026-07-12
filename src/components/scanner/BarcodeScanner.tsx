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

  // Guard para evitar múltiples lecturas del mismo código
  const handleScan = useCallback((texto: string) => {
    if (!scanningRef.current) {
      scanningRef.current = true;
      onScan(texto);
      // Resetear después de un tiempo para permitir nuevo escaneo si la cámara sigue activa
      setTimeout(() => { scanningRef.current = false; }, 2000);
    }
  }, [onScan]);

  useImperativeHandle(ref, () => ({
    alternarTorch: async () => {
      const stream = videoRef.current?.srcObject as MediaStream | null;
      if (!stream) return;
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities() as any;
      if (capabilities.torch) {
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
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });

        if (!isMounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        if (!readerRef.current) {
          readerRef.current = new BrowserMultiFormatReader();
          // Configurar solo formatos de uso común en retail para mayor velocidad
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
          (result, err, controls) => {
            if (result) {
              handleScan(result.getText());
            }
          }
        );
      } catch (err) {
        console.error('Error cámara:', err);
      }
    }

    function stop() {
      if (controlsRef.current) {
        controlsRef.current.stop();
        controlsRef.current = null;
      }
      if (videoRef.current?.srcObject) {
        const s = videoRef.current.srcObject as MediaStream;
        s.getTracks().forEach(t => t.stop());
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
      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'var(--r-xl)' }}
      playsInline
      muted
    />
  );
});

BarcodeScanner.displayName = 'BarcodeScanner';