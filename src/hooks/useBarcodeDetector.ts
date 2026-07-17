'use client';

import { useRef, useCallback, useEffect, useState } from 'react';

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

export interface BarcodeResult {
  rawValue: string;
  format: string;
}

interface UseBarcodeDetectorOptions {
  onDetect: (results: BarcodeResult[]) => void;
  lowEnd?: boolean;
  cropRect?: { x: number; y: number; width: number; height: number } | null;
}

const TARGET_FORMATS = [
  'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf',
];

const ZXING_FORMAT_KEYS = [
  'EAN_13', 'EAN_8', 'UPC_A', 'UPC_E', 'CODE_128', 'CODE_39', 'QR_CODE',
];

let _zxingFormatsCache: unknown[] | null = null;
function getZxingFormats(BarcodeFormat: Record<string, unknown>): unknown[] {
  if (_zxingFormatsCache) return _zxingFormatsCache;
  _zxingFormatsCache = ZXING_FORMAT_KEYS
    .map((k) => BarcodeFormat[k])
    .filter((v): v is unknown => v !== undefined);
  return _zxingFormatsCache;
}

interface ZXingResult {
  getText(): string;
  getBarcodeFormat(): number | string;
}

export function useBarcodeDetector({ onDetect, lowEnd = false, cropRect = null }: UseBarcodeDetectorOptions) {
  const [useNative, setUseNative] = useState(false);
  const onDetectRef = useRef(onDetect);
  const nativeDetectorRef = useRef<BarcodeDetector | null>(null);
  const zxingReaderRef = useRef<{ decodeFromCanvas: Function } | null>(null);
  const zxingRunningRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    onDetectRef.current = onDetect;
  }, [onDetect]);

  // Inicializar BarcodeDetector nativo
  useEffect(() => {
    mountedRef.current = true;
    const init = async () => {
      if (typeof window === 'undefined') return;
      if (!('BarcodeDetector' in window)) return;
      try {
        const supported = await window.BarcodeDetector.getSupportedFormats();
        const supportedSet = new Set(supported.map((f) => f.toLowerCase().replace(/_/g, '')));
        const available = TARGET_FORMATS.filter((f) => supportedSet.has(f));
        if (available.length === 0) return;
        nativeDetectorRef.current = new window.BarcodeDetector({ formats: available });
        setUseNative(true);
      } catch {
        // native not usable
      }
    };
    init();
    return () => { mountedRef.current = false; };
  }, []);

  // Detectar con nativo (recibe ImageBitmap del crop)
  const detect = useCallback(async (imageBitmap: ImageBitmap) => {
    if (!useNative || !nativeDetectorRef.current) return;
    try {
      const results = await nativeDetectorRef.current.detect(imageBitmap);
      if (results.length > 0) {
        onDetectRef.current(results.map((r) => ({
          rawValue: r.rawValue,
          format: r.format,
        })));
      }
    } catch {
      // ignore
    }
  }, [useNative]);

  // ZXing: loop manual con crop canvas
  const startZXing = useCallback(async (video: HTMLVideoElement, crop: { x: number; y: number; width: number; height: number }) => {
    if (useNative || zxingRunningRef.current) return;
    if (!video || video.readyState < 2) return;
    zxingRunningRef.current = true;

    const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([
      import('@zxing/browser'),
      import('@zxing/library'),
    ]);

    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, getZxingFormats(BarcodeFormat as Record<string, unknown>));
    hints.set(DecodeHintType.TRY_HARDER, !lowEnd);

    const reader = new BrowserMultiFormatReader(hints);
    zxingReaderRef.current = reader;

    // Canvas pequeño para el crop (reutilizable)
    const canvas = document.createElement('canvas');
    canvas.width = crop.width;
    canvas.height = crop.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

    const scanLoop = async () => {
      if (!mountedRef.current || !zxingRunningRef.current || video.paused) return;
      try {
        // Dibujar SOLO la región del viewfinder
        ctx.drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
        
        const result = await reader.decodeFromCanvas(canvas);
        if (result && mountedRef.current) {
          const codigo = result.getText().trim();
          const bf = result.getBarcodeFormat();
          const formato = (BarcodeFormat as Record<number | string, unknown>)[String(bf)] ?? 'UNKNOWN';
          if (codigo.length >= 4) {
            onDetectRef.current([{ rawValue: codigo, format: String(formato) }]);
          }
        }
      } catch {
        // no result this iteration
      }

      if (!mountedRef.current || !zxingRunningRef.current) return;

      // Throttle: 500ms gama alta, 800ms gama baja
      const delay = lowEnd ? 800 : 500;
      setTimeout(scanLoop, delay);
    };

    scanLoop();
  }, [useNative, lowEnd]);

  const stop = useCallback(() => {
    zxingRunningRef.current = false;
    zxingReaderRef.current = null;
  }, []);

  return { detect, startZXing, stop, useNative };
}