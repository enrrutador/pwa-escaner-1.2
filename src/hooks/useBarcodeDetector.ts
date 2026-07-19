'use client';

import { useRef, useCallback, useEffect, useState } from 'react';

declare global {
  interface Window {
    BarcodeDetector?: {
      new (options?: { formats?: string[] }): BarcodeDetectorInstance;
      getSupportedFormats(): Promise<string[]>;
    };
  }
  interface BarcodeDetectorInstance {
    detect(source: ImageBitmapSource): Promise<DetectedBarcode[]>;
  }
  interface DetectedBarcode {
    rawValue: string;
    format: string;
    cornerPoints?: readonly DOMRectReadOnly[];
    boundingBox?: DOMRectReadOnly;
  }
}

export interface BarcodeResult {
  rawValue: string;
  format: string;
}

interface UseBarcodeDetectorOptions {
  onDetect: (results: BarcodeResult[]) => void;
}

// Mismo set que M-Scanner: solo EAN + UPC (rápido y específico)
const TARGET_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

const ZXING_FORMAT_KEYS = ['EAN_13', 'EAN_8', 'UPC_A', 'UPC_E'];

let _zxingFormatsCache: unknown[] | null = null;
function getZxingFormats(BarcodeFormat: Record<string, unknown>): unknown[] {
  if (_zxingFormatsCache) return _zxingFormatsCache;
  _zxingFormatsCache = ZXING_FORMAT_KEYS
    .map((k) => BarcodeFormat[k])
    .filter((v): v is unknown => v !== undefined);
  return _zxingFormatsCache;
}

export function useBarcodeDetector({ onDetect }: UseBarcodeDetectorOptions) {
  const [useNative, setUseNative] = useState(false);
  const [ready, setReady] = useState(false);
  const onDetectRef = useRef(onDetect);
  const nativeDetectorRef = useRef<BarcodeDetectorInstance | null>(null);
  const zxingReaderRef = useRef<{ decodeFromCanvas: Function } | null>(null);
  const zxingRunningRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => { onDetectRef.current = onDetect; }, [onDetect]);

  useEffect(() => {
    mountedRef.current = true;
    const init = async () => {
      if (typeof window === 'undefined') return;

      // Native BarcodeDetector (Chrome Android = ML Kit)
      if (window.BarcodeDetector) {
        try {
          let formats = TARGET_FORMATS;
          try {
            const supported = await window.BarcodeDetector.getSupportedFormats();
            if (Array.isArray(supported) && supported.length > 0) {
              const filtered = TARGET_FORMATS.filter((f) => supported.includes(f));
              if (filtered.length > 0) formats = filtered;
            }
          } catch {}

          nativeDetectorRef.current = new window.BarcodeDetector({ formats });
          setUseNative(true);
          console.log('[Scanner] Native BarcodeDetector ready, formats:', formats);
          setReady(true);
          return;
        } catch (err) {
          console.warn('[Scanner] Native BarcodeDetector init failed:', err);
        }
      }

      // No native → ZXing fallback (iPhone Safari)
      setUseNative(false);
      setReady(true);
      console.log('[Scanner] ZXing fallback will be used');
    };
    init();
    return () => { mountedRef.current = false; };
  }, []);

  const detect = useCallback(async (video: HTMLVideoElement) => {
    if (!useNative || !nativeDetectorRef.current) return;
    // M-Scanner check: only detect when video has enough data
    if (video.readyState !== 4) return;
    try {
      const results = await nativeDetectorRef.current.detect(video);
      if (results.length > 0 && mountedRef.current) {
        onDetectRef.current(results.map((r) => ({ rawValue: r.rawValue, format: r.format })));
      }
    } catch {}
  }, [useNative]);

  const startZXing = useCallback(async (video: HTMLVideoElement) => {
    if (useNative || zxingRunningRef.current) return;
    if (!video || video.readyState < 2) return;
    zxingRunningRef.current = true;

    const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([
      import('@zxing/browser'),
      import('@zxing/library'),
    ]);

    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, getZxingFormats(BarcodeFormat as Record<string, unknown>));
    hints.set(DecodeHintType.TRY_HARDER, true);

    const reader = new BrowserMultiFormatReader(hints);
    zxingReaderRef.current = reader;

    const scanLoop = async () => {
      if (!mountedRef.current || !zxingRunningRef.current || !video || video.paused) return;
      try {
        const result = await reader.decodeOnceFromVideoElement(video);
        if (result && mountedRef.current) {
          const codigo = result.getText().trim();
          const bf = result.getBarcodeFormat();
          const formato = (BarcodeFormat as Record<number | string, unknown>)[String(bf)] ?? 'UNKNOWN';
          if (codigo.length >= 4) {
            onDetectRef.current([{ rawValue: codigo, format: String(formato) }]);
          }
        }
      } catch {}

      if (!mountedRef.current || !zxingRunningRef.current) return;
      setTimeout(scanLoop, 500);
    };

    scanLoop();
  }, [useNative]);

  const stop = useCallback(() => {
    zxingRunningRef.current = false;
    zxingReaderRef.current = null;
  }, []);

  return { detect, startZXing, stop, useNative, ready };
}