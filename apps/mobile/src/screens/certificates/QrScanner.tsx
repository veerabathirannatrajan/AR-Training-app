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

/**
 * Live camera QR scanner. Uses the built-in BarcodeDetector where Chrome has it (Android) and
 * falls back to jsQR on a downscaled frame, so it also works in desktop browsers and WebViews.
 */
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
      if (stopped || video == null || video.readyState < 2) {
        if (!stopped) timer = window.setTimeout(() => void scan(), SCAN_INTERVAL_MS);
        return;
      }
      let text: string | null = null;
      if (detector != null) {
        try {
          text = (await detector.detect(video))[0]?.rawValue ?? null;
        } catch {
          detector = null; // fall back to jsQR from now on
        }
      }
      if (text == null && context != null) {
        const scale = Math.min(1, 720 / Math.max(video.videoWidth, video.videoHeight));
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const image = context.getImageData(0, 0, canvas.width, canvas.height);
        text =
          jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' })?.data ??
          null;
      }
      if (stopped) return;
      if (text != null && text !== '') {
        onResultRef.current(text);
        return;
      }
      timer = window.setTimeout(() => void scan(), SCAN_INTERVAL_MS);
    };

    (async () => {
      if (navigator.mediaDevices?.getUserMedia == null) {
        onErrorRef.current('unavailable');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
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
    <div className="qr-scanner">
      <video ref={videoRef} playsInline muted />
      <span className="qr-scanner-frame" aria-hidden />
    </div>
  );
}
