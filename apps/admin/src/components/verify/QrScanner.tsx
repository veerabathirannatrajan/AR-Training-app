import jsQR from 'jsqr';
import { useEffect, useRef } from 'react';

export type ScanError = 'blocked' | 'unavailable';

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}

declare global {
  interface Window {
    BarcodeDetector?: new (options: { formats: string[] }) => BarcodeDetectorLike;
  }
}

const SCAN_INTERVAL_MS = 180;

function decode(context: CanvasRenderingContext2D, width: number, height: number): string | null {
  const image = context.getImageData(0, 0, width, height);
  return (
    jsQR(image.data, image.width, image.height, { inversionAttempts: 'attemptBoth' })?.data ?? null
  );
}

/** Reads a QR code from a photo or screenshot (for laptops without a camera). */
export async function decodeQrImage(file: File): Promise<string | null> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (context == null) return null;
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return decode(context, canvas.width, canvas.height);
}

/** Live camera QR scanner: BarcodeDetector where available, jsQR otherwise (desktop, WebView). */
export function QrScanner({
  onResult,
  onError,
}: {
  onResult: (text: string) => void;
  onError: (error: ScanError) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onResultRef.current = onResult;
    onErrorRef.current = onError;
  });

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: number | null = null;
    let stopped = false;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    let detector: BarcodeDetectorLike | null = null;
    try {
      detector =
        window.BarcodeDetector != null
          ? new window.BarcodeDetector({ formats: ['qr_code'] })
          : null;
    } catch {
      detector = null;
    }

    const scan = async () => {
      const video = videoRef.current;
      if (stopped) return;
      if (video == null || video.readyState < 2) {
        timer = window.setTimeout(() => void scan(), SCAN_INTERVAL_MS);
        return;
      }
      let text: string | null = null;
      if (detector != null) {
        try {
          text = (await detector.detect(video))[0]?.rawValue ?? null;
        } catch {
          detector = null;
        }
      }
      if (text == null && context != null) {
        const scale = Math.min(1, 720 / Math.max(video.videoWidth, video.videoHeight));
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        text = decode(context, canvas.width, canvas.height);
      }
      if (stopped) return;
      if (text != null && text !== '') {
        onResultRef.current(text);
        return;
      }
      timer = window.setTimeout(() => void scan(), SCAN_INTERVAL_MS);
    };

    void (async () => {
      if (navigator.mediaDevices?.getUserMedia == null) {
        onErrorRef.current('unavailable');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
          audio: false,
        });
      } catch (error) {
        const name = (error as DOMException | null)?.name;
        onErrorRef.current(
          name === 'NotAllowedError' || name === 'SecurityError' ? 'blocked' : 'unavailable',
        );
        return;
      }
      if (stopped) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const video = videoRef.current;
      if (video == null) return;
      video.srcObject = stream;
      await video.play().catch(() => undefined);
      void scan();
    })();

    return () => {
      stopped = true;
      if (timer != null) window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-zinc-900">
      <video ref={videoRef} playsInline muted className="size-full object-cover" />
      <span
        className="pointer-events-none absolute inset-[18%] rounded-lg ring-2 ring-white/90"
        style={{ boxShadow: '0 0 0 999px rgb(0 0 0 / 0.35)' }}
        aria-hidden
      />
    </div>
  );
}
