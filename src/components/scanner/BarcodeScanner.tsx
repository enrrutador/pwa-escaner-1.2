'use client';

import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';

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
        }

        controlsRef.current = await readerRef.current.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result, err, controls) => {
            if (result) {
              onScan(result.getText());
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
    }

    return () => {
      isMounted = false;
      stop();
    };
  }, [activo, onScan]);

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
