import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { apiFetch } from './api';

function filenameFrom(response: Response, fallback: string): string {
  const header = response.headers.get('Content-Disposition') ?? '';
  return /filename="?([^";]+)"?/.exec(header)?.[1] ?? fallback;
}

async function toBase64(blob: Blob): Promise<string> {
  const buffer = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let index = 0; index < buffer.length; index += 0x8000) {
    binary += String.fromCharCode(...buffer.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

/**
 * Downloads an export from the API (with the admin token) and saves it: a normal browser
 * download on the web; in the Android app the file is written to the app cache and opened in
 * the share sheet (save to Files / Drive, open in a PDF viewer, send on WhatsApp…).
 */
export async function downloadExport(
  path: string,
  query: Record<string, string | number | null | undefined>,
  fallbackName: string,
): Promise<string> {
  const response = await apiFetch(path, { query });
  const blob = await response.blob();
  const name = filenameFrom(response, fallbackName);

  if (Capacitor.isNativePlatform()) {
    const written = await Filesystem.writeFile({
      path: name,
      data: await toBase64(blob),
      directory: Directory.Cache,
    });
    await Share.share({ title: name, url: written.uri, dialogTitle: name });
    return name;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return name;
}
