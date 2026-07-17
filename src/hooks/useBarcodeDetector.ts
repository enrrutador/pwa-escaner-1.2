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
  getBarcodeFormat(): string | number;
}

type ZXingCallbackResult = ZXingResult | null | undefined;

interface ZXingControls {
  stop(): void;
}

export function useBarcodeDetector({ onDetect }: UseBarcodeDetectorOptions) {
  const [useNative, setUseNative] = useState(false);
  const onDetectRef = useRef(onDetect);
  const nativeDetectorRef = useRef<BarcodeDetector | null>(null);
  const zxingStartedRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    onDetectRef.current = onDetect;
  }, [onDetect]);

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
        // native not usable, stay with ZXing
      }
    };
    init();
    return () => { mountedRef.current = false; };
  }, []);

  const detect = useCallback(async (video: HTMLVideoElement) => {
    if (!useNative || !nativeDetectorRef.current) return;
    if (!video || video.readyState < 2 || video.paused) return;
    try {
      const results = await nativeDetectorRef.current.detect(video);
      if (results.length > 0) {
        onDetectRef.current(results.map((r) => ({
          rawValue: r.rawValue,
          format: r.format,
        })));
      }
    } catch {
      // single detect failure, ignore
    }
  }, [useNative]);

  const ensureZXing = useCallback(async (video: HTMLVideoElement) => {
    if (useNative || zxingStartedRef.current) return;
    if (!video || video.readyState < 2) return;
    zxingStartedRef.current = true;

    const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([
      import('@zxing/browser'),
      import('@zxing/library'),
    ]);

    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, getZxingFormats(BarcodeFormat as Record<string, unknown>));
    hints.set(DecodeHintType.TRY_HARDER, true);

    const reader = new BrowserMultiFormatReader(hints);
    await reader.decodeFromVideoElement(
      video,
      (result: ZXingCallbackResult, _err: unknown) => {
        if (!result || !mountedRef.current) return;
        const codigo = result.getText().trim();
        const formato = BarcodeFormat[result.getBarcodeFormat() as keyof typeof BarcodeFormat] ?? 'UNKNOWN';
        if (codigo.length >= 4) {
          onDetectRef.current([{ rawValue: codigo, format: String(formato) }]);
        }
      }
    );
  }, [useNative]);

  const stop = useCallback(() => {
    zxingStartedRef.current = false;
  }, []);

  return { detect, ensureZXing, stop, useNative };
}