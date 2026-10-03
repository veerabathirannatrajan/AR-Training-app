import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { cx } from './cx';

/** A QR code drawn as SVG (sharp at any size, works offline). */
export function QrCode({
  text,
  label,
  className,
}: {
  text: string;
  label: string;
  className?: string;
}) {
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toString(text, { type: 'svg', errorCorrectionLevel: 'M', margin: 1 })
      .then((markup) => {
        if (!cancelled) setSvg(markup);
      })
      .catch((error: unknown) => console.error('[qr] could not draw the QR code', error));
    return () => {
      cancelled = true;
    };
  }, [text]);

  return (
    <div className={cx('qr-code', className)} role="img" aria-label={label}>
      {svg != null && <img src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`} alt="" />}
    </div>
  );
}
