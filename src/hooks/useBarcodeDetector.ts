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

const ZBAR_FORMAT_MAP: Record<number, string> = {
  8: 'ean_8',
  13: 'ean_13',
  9: 'upc_e',
  12: 'upc_a',
  25: 'itf',
  39: 'code_39',
  128: 'code_128',
};

const MAX_LOW_END_W = 480;
const MAX_LOW_END_H = 360;

let _zbarDetectorPromise: Promise<BarcodeDetector | null> | null = null;

function getZbarDetector(): Promise<BarcodeDetector | null> {
  if (_zbarDetectorPromise) return _zbarDetectorPromise;
  _zbarDetectorPromise = createZbarDetector(true);
  return _zbarDetectorPromise;
}

async function createZbarDetector(lowEnd: boolean = false): Promise<BarcodeDetector | null> {
  if (typeof window === 'undefined') return null;

  const MAX_LOW_END_W = 480;
  const MAX_LOW_END_H = 360;

  try {
    const { scanRGBABuffer, setModuleArgs } = await import('@undecaf/zbar-wasm');

    setModuleArgs({
      locateFile: (path: string) => {
        if (path.endsWith('.wasm')) return '/zbar/zbar.wasm';
        return path;
      },
    });

    const supportedFormats = Object.values(ZBAR_FORMAT_MAP);

    const detector: BarcodeDetector = {
      async detect(source: ImageBitmapSource) {
        let bitmap: ImageBitmap;
        if (source instanceof ImageBitmap) {
          bitmap = source;
        } else if (source instanceof HTMLVideoElement || source instanceof HTMLImageElement || source instanceof HTMLCanvasElement) {
          bitmap = await createImageBitmap(source);
        } else {
          throw new Error('Unsupported source type');
        }

        let width = bitmap.width;
        let height = bitmap.height;

        // Downscale for low-end to speed up detection
        if (lowEnd && (width > MAX_LOW_END_W || height > MAX_LOW_END_H)) {
          const scale = Math.min(MAX_LOW_END_W / width, MAX_LOW_END_H / height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }

        const pixelData = new Uint8Array(width * height * 4);
        
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        ctx.drawImage(bitmap, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);
        pixelData.set(imageData.data);

        const results = await scanRGBABuffer(pixelData.buffer, width, height);
        
        if (!bitmap.close) {
          bitmap.close?.();
        }

        return results
          .map((r) => ({
            rawValue: typeof r.data === 'string' ? r.data : new TextDecoder().decode(r.data),
            format: ZBAR_FORMAT_MAP[r.type] || `unknown_${r.type}`,
            cornerPoints: undefined,
            boundingBox: undefined,
          }))
          .filter((r) => TARGET_FORMATS.includes(r.format));
      },
    };

    Object.defineProperty(detector, 'getSupportedFormats', {
      value: async () => supportedFormats,
      writable: false,
      configurable: false,
    });

    return detector;
  } catch (err) {
    console.warn('[ZBar] Failed to initialize:', err);
    return null;
  }
}

export function useBarcodeDetector({ onDetect, lowEnd = false }: UseBarcodeDetectorOptions) {
  const [useNative, setUseNative] = useState(false);
  const onDetectRef = useRef(onDetect);
  const nativeDetectorRef = useRef<BarcodeDetector | null>(null);
  const zxingReaderRef = useRef<{ decodeFromCanvas: Function } | null>(null);
  const zxingRunningRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => { onDetectRef.current = onDetect; }, [onDetect]);

  useEffect(() => {
    mountedRef.current = true;
    const init = async () => {
      if (typeof window === 'undefined') return;

      if ('BarcodeDetector' in window) {
        try {
          const supported = await window.BarcodeDetector.getSupportedFormats();
          const supportedSet = new Set(supported.map((f) => f.toLowerCase().replace(/_/g, '')));
          const available = TARGET_FORMATS.filter((f) => supportedSet.has(f));
          if (available.length === 0) return;
          nativeDetectorRef.current = new window.BarcodeDetector({ formats: available });
          setUseNative(true);
          return;
        } catch {}
      }

      if (lowEnd) {
        const detector = await createZbarDetector(lowEnd);
        if (detector) {
          nativeDetectorRef.current = detector;
          setUseNative(true);
        }
      }
    };
    init();
    return () => { mountedRef.current = false; };
  }, [lowEnd]);

  const detect = useCallback(async (source: ImageBitmapSource) => {
    if (!useNative || !nativeDetectorRef.current) return;
    try {
      const results = await nativeDetectorRef.current.detect(source);
      if (results.length > 0) {
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
    hints.set(DecodeHintType.TRY_HARDER, !lowEnd);

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

// Función standalone para burst mode (photo capture) en low-end
// No usa React hooks, se puede llamar desde cualquier componente
export async function detectFromVideoFrame(video: HTMLVideoElement): Promise<BarcodeResult[]> {
  if (typeof window === 'undefined') return [];
  if (!video || video.readyState < 2) return [];

  try {
    const detector = await getZbarDetector();
    if (!detector) return [];

    const bitmap = await createImageBitmap(video);
    
    // El detector ya hace downscale interno a 480x360
    const results = await detector.detect(bitmap);
    
    if (!bitmap.close) {
      bitmap.close?.();
    }

    return results.map((r) => ({ rawValue: r.rawValue, format: r.format }));
  } catch (err) {
    console.warn('[Burst] detectFromVideoFrame error:', err);
    return [];
  }
}

// Formatos EAN/UPC que consideramos "válidos" para auto-aceptar en burst
export const BURST_VALID_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf'];