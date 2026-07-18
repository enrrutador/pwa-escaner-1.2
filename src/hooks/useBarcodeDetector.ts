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

export function useBarcodeDetector({ onDetect, lowEnd = false }: UseBarcodeDetectorOptions) {
  const [useNative, setUseNative] = useState(false);
  const onDetectRef = useRef(onDetect);
  const nativeDetectorRef = useRef<BarcodeDetector | null>(null);
  const zxingReaderRef = useRef<{ decodeFromCanvas: Function } | null>(null);
  const zxingRunningRef = useRef(false);
  const quaggaStartedRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => { onDetectRef.current = onDetect; }, [onDetect]);

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
      } catch {}
    };
    init();
    return () => { mountedRef.current = false; };
  }, []);

  // Nativo: detect (recibe ImageBitmap del crop o video)
  const detect = useCallback(async (source: ImageBitmapSource) => {
    if (!useNative || !nativeDetectorRef.current) return;
    try {
      const results = await nativeDetectorRef.current.detect(source);
      if (results.length > 0) {
        onDetectRef.current(results.map((r) => ({ rawValue: r.rawValue, format: r.format })));
      }
    } catch {}
  }, [useNative]);

  // ZXing (iPhone / gama alta) — loop manual con decodeOnceFromVideoElement
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
      // Throttle: 500ms gama alta (iPhone), 800ms gama baja
      const delay = lowEnd ? 800 : 500;
      setTimeout(scanLoop, delay);
    };

    scanLoop();
  }, [useNative, lowEnd]);

  // Quagga2 (gama baja Android, cuando no hay BarcodeDetector nativo)
  const startQuagga = useCallback(async (video: HTMLVideoElement) => {
    if (useNative || quaggaStartedRef.current) return;
    if (!video || video.readyState < 2) return;
    quaggaStartedRef.current = true;

    const Quagga = (await import('@ericblade/quagga2')).default;

    Quagga.init({
      inputStream: {
        type: 'LiveStream',
        target: video,
        constraints: {
          width: 640,
          height: 480,
          facingMode: 'environment',
        },
      },
      locator: {
        patchSize: 'medium',
        halfSample: true,
      },
      numOfWorkers: 0,
      frequency: 5,
      decoder: {
        readers: [
          'ean_reader', 'ean_8_reader',
          'upc_reader', 'upc_e_reader',
          'code_128_reader', 'code_39_reader',
          'i2of5_reader',
        ],
      },
      locate: true,
    }, (err: any) => {
      if (err) {
        console.error('[Quagga2] init error:', err);
        return;
      }
      if (!mountedRef.current) {
        Quagga.stop();
        return;
      }
      Quagga.onDetected((result: any) => {
        if (!result || !mountedRef.current) return;
        const codigo = result.codeResult?.code;
        const formato = result.codeResult?.format || 'UNKNOWN';
        if (codigo && codigo.length >= 4) {
          onDetectRef.current([{ rawValue: codigo, format: String(formato) }]);
        }
      });
      Quagga.start();
    });
  }, [useNative]);

  const stop = useCallback(() => {
    // ZXing
    zxingRunningRef.current = false;
    zxingReaderRef.current = null;
    // Quagga2
    if (quaggaStartedRef.current) {
      quaggaStartedRef.current = false;
      import('@ericblade/quagga2').then((Quagga) => {
        try { Quagga.default.stop(); } catch {}
      });
    }
  }, []);

  return { detect, startZXing, startQuagga, stop, useNative };
}