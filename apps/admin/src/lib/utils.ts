import { istDate } from '@ar-training/shared';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * DD-MM-YYYY (the format used on Indian certificates). Timestamps are shown as the date in
 * India, like certificate issue dates.
 */
export function formatDate(value: string | null | undefined): string {
  if (value == null || value === '') return '—';
  const date = value.includes('T') ? istDate(Date.parse(value)) : value.slice(0, 10);
  const day = date.split('-');
  if (day.length !== 3) return value;
  return `${day[2]}-${day[1]}-${day[0]}`;
}

export function formatDateTime(value: string | null | undefined, locale = 'en-IN'): string {
  if (value == null) return '—';
  return new Date(value).toLocaleString(locale, {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function percent(value: number | null | undefined): string {
  return value == null ? '—' : `${value}%`;
}

export function initials(name: string): string {
  return name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function shortHash(hash: string | null | undefined, head = 6, tail = 4): string {
  if (hash == null) return '—';
  return hash.length <= head + tail + 1 ? hash : `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}
