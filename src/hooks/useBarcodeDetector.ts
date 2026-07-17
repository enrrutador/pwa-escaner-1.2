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

// Worker inline as blob
function createZXingWorker(lowEnd: boolean): Worker {
  const workerCode = `
    importScripts('https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/esm/index.js');
    importScripts('https://cdn.jsdelivr.net/npm/@zxing/library@0.23.0/esm/index.js');

    const { BrowserMultiFormatReader } = ZXingBrowser;
    const { DecodeHintType, BarcodeFormat } = ZXing;

    let reader = null;
    let hints = null;
    let running = false;
    let lowEndMode = ${lowEnd};

    const formatKeys = ['EAN_13', 'EAN_8', 'UPC_A', 'UPC_E', 'CODE_128', 'CODE_39', 'QR_CODE'];

    function initReader() {
      hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, formatKeys.map(k => BarcodeFormat[k]).filter(Boolean));
      hints.set(DecodeHintType.TRY_HARDER, !lowEndMode);
      reader = new BrowserMultiFormatReader(hints);
    }

    self.onmessage = async (e) => {
      const { type, payload } = e.data;
      if (type === 'init') {
        lowEndMode = payload.lowEnd;
        initReader();
        self.postMessage({ type: 'ready' });
      } else if (type === 'decode') {
        if (!reader) initReader();
        const { canvas, width, height } = payload;
        try {
          const result = await reader.decodeFromCanvas(canvas);
          if (result) {
            const bf = result.getBarcodeFormat();
            const format = BarcodeFormat[bf] ?? 'UNKNOWN';
            self.postMessage({ 
              type: 'result', 
              payload: { code: result.getText().trim(), format: String(format) } 
            });
          }
        } catch (err) {
          // no result
        }
      } else if (type === 'stop') {
        running = false;
      }
    };
  `;
  const blob = new Blob([workerCode], { type: 'application/javascript' });
  return new Worker(URL.createObjectURL(blob));
}

export function useBarcodeDetector({ onDetect, lowEnd = false }: UseBarcodeDetectorOptions) {
  const [useNative, setUseNative] = useState(false);
  const onDetectRef = useRef(onDetect);
  const nativeDetectorRef = useRef<BarcodeDetector | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => { onDetectRef.current = onDetect; }, [onDetect]);

  // Native BarcodeDetector init
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
      } catch {}
    };
    init();
    return () => { mountedRef.current = false; };
  }, []);

  // Detect with native
  const detect = useCallback(async (imageBitmap: ImageBitmap) => {
    if (!useNative || !nativeDetectorRef.current) return;
    try {
      const results = await nativeDetectorRef.current.detect(imageBitmap);
      if (results.length > 0) {
        onDetectRef.current(results.map((r) => ({ rawValue: r.rawValue, format: r.format })));
      }
    } catch {}
  }, [useNative]);

  // ZXing via Worker
  const startZXing = useCallback(async (video: HTMLVideoElement, crop: { x: number; y: number; width: number; height: number }) => {
    if (useNative || workerRef.current) return;
    if (!video || video.readyState < 2) return;

    const worker = createZXingWorker(lowEnd);
    workerRef.current = worker;

    const canvas = document.createElement('canvas');
    canvas.width = crop.width;
    canvas.height = crop.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

    worker.onmessage = (e) => {
      const { type, payload } = e.data;
      if (type === 'result' && mountedRef.current && payload.code.length >= 4) {
        onDetectRef.current([{ rawValue: payload.code, format: payload.format }]);
      }
    };

    worker.postMessage({ type: 'init', payload: { lowEnd } });

    await new Promise<void>((resolve) => {
      worker.onmessage = (e) => { if (e.data.type === 'ready') resolve(); };
    });

    const scanLoop = async () => {
      if (!mountedRef.current || !workerRef.current || video.paused) return;
      try {
        ctx.drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
        worker.postMessage({ type: 'decode', payload: { canvas: canvas, width: crop.width, height: crop.height } }, [canvas]);
      } catch {}
      if (!mountedRef.current || !workerRef.current) return;
      setTimeout(scanLoop, lowEnd ? 800 : 500);
    };
    scanLoop();
  }, [useNative, lowEnd]);

  const stop = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'stop' });
      workerRef.current.terminate();
      workerRef.current = null;
    }
  }, []);

  return { detect, startZXing, stop, useNative };
}