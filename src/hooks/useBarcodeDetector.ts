'use client';

import { useRef, useCallback, useEffect, useState } from 'react';

// TypeScript declarations for Shape Detection API (BarcodeDetector)
declare global {
  interface Window {
    BarcodeDetector: {
      new (options?: { formats?: string[] }): BarcodeDetector;
      getSupportedFormats(): Promise<string[]>;
    };
  }
  interface BarcodeDetector {
    detect(source: ImageBitmapSource): Promise<DetectedBarcode[]>;
  }
  interface DetectedBarcode {
    rawValue: string;
    format: string;
    cornerPoints?: readonly DOMRectReadOnly[];
    boundingBox?: DOMRectReadOnly;
  }
}

interface BarcodeResult {
  rawValue: string;
  format: string;
  cornerPoints?: readonly DOMRectReadOnly[];
  boundingBox?: DOMRectReadOnly;
}

interface UseBarcodeDetectorOptions {
  onDetect: (results: BarcodeResult[]) => void;
  formats?: string[];
  throttleMs?: number;
}

const FALLBACK_FORMATS = [
  'ean_13', 'ean_8', 'upc_a', 'code_128', 'code_39', 'qr_code'
];

export function useBarcodeDetector({
  onDetect,
  formats,
  throttleMs = 200,
}: UseBarcodeDetectorOptions) {
  const [useNative, setUseNative] = useState(false);
  const lastDetectRef = useRef(0);
  const nativeDetectorRef = useRef<BarcodeDetector | null>(null);
  const zxingReaderRef = useRef<any>(null);
  const zxingControlsRef = useRef<{ stop: () => void } | null>(null);
  const mountedRef = useRef(true);

  // Inicializar detector nativo si está disponible
  useEffect(() => {
    const initNative = async () => {
      if (typeof window === 'undefined') return;
      if (!('BarcodeDetector' in window)) {
        setUseNative(false);
        return;
      }
      try {
        const supportedFormats = await window.BarcodeDetector.getSupportedFormats();
        const targetFormats = formats || FALLBACK_FORMATS;
        const available = targetFormats.filter(f => supportedFormats.includes(f));
        if (available.length === 0) {
          setUseNative(false);
          return;
        }
        nativeDetectorRef.current = new window.BarcodeDetector({ formats: available });
        setUseNative(true);
      } catch {
        setUseNative(false);
      }
    };
    initNative();
    return () => { mountedRef.current = false; };
  }, [formats]);

  // Limpiar ZXing reader si cambia a nativo
  useEffect(() => {
    if (useNative && zxingControlsRef.current) {
      try { zxingControlsRef.current.stop(); } catch {}
      zxingControlsRef.current = null;
      zxingReaderRef.current = null;
    }
  }, [useNative]);

  const detect = useCallback(async (video: HTMLVideoElement) => {
    if (!mountedRef.current) return;
    if (!video || video.readyState < 2) return;

    const now = Date.now();
    if (now - lastDetectRef.current < throttleMs) return;
    lastDetectRef.current = now;

    if (useNative && nativeDetectorRef.current) {
      try {
        const results = await nativeDetectorRef.current.detect(video);
        if (results.length > 0) {
          onDetect(results.map(r => ({
            rawValue: r.rawValue,
            format: r.format,
            cornerPoints: r.cornerPoints,
            boundingBox: r.boundingBox,
          })));
        }
      } catch (e) {
        console.warn('[BarcodeDetector] native detect failed, falling back to ZXing:', e);
        setUseNative(false);
      }
    } else {
      // Fallback ZXing - lazy init
      if (!zxingReaderRef.current) {
        try {
          const [zxingBrowser, zxingLibModule] = await Promise.all([
            import('@zxing/browser'),
            import('@zxing/library'),
          ]);
          const { BrowserMultiFormatReader } = zxingBrowser;
          const { DecodeHintType, BarcodeFormat } = zxingLibModule;

          // Store BarcodeFormat enum for later use in callback
          (zxingReaderRef.current as any)._barcodeFormat = BarcodeFormat;

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

          zxingReaderRef.current = new BrowserMultiFormatReader(hints);
        } catch (e) {
          console.error('[BarcodeDetector] ZXing init failed:', e);
          return;
        }
      }

      if (zxingReaderRef.current && !zxingControlsRef.current) {
        try {
          zxingControlsRef.current = await zxingReaderRef.current.decodeFromVideoElement(
            video,
            (result: any, _err: any) => {
              if (!result || !mountedRef.current) return;
              const codigo = result.getText().trim();
              const BarcodeFormat = (zxingReaderRef.current as any)._barcodeFormat;
              const formato = BarcodeFormat?.[result.getBarcodeFormat()] ?? 'UNKNOWN';
              if (codigo.length >= 4) {
                onDetect([{
                  rawValue: codigo,
                  format: formato,
                }]);
              }
            }
          );
        } catch (e) {
          console.error('[BarcodeDetector] ZXing decode failed:', e);
        }
      }
    }
  }, [useNative, onDetect, throttleMs]);

  const stop = useCallback(() => {
    if (zxingControlsRef.current) {
      try { zxingControlsRef.current.stop(); } catch {}
      zxingControlsRef.current = null;
    }
  }, []);

  return { detect, stop, useNative };
}