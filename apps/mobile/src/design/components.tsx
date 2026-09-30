import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { XR_UI_PROPS } from '../engine/xr/xrUi';
import { cx } from './cx';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'md' | 'lg';
  block?: boolean;
  icon?: ReactNode;
}

/** Every button blocks the tap from also reaching the AR scene (see useBlockXRSelectOnUI). */
export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  icon,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        'btn',
        `btn-${variant}`,
        size === 'lg' && 'btn-lg',
        block && 'btn-block',
        className,
      )}
      {...XR_UI_PROPS}
      {...rest}
    >
      {icon}
      {children != null && <span>{children}</span>}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
  glass?: boolean;
  children: ReactNode;
}

export function IconButton({
  label,
  active = false,
  glass = true,
  className,
  children,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cx('icon-btn', glass && 'glass', active && 'is-active', className)}
      {...XR_UI_PROPS}
      {...rest}
    >
      {children}
    </button>
  );
}

export type Tone = 'neutral' | 'accent' | 'ok' | 'warn' | 'critical';

interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  icon?: ReactNode;
}

export function Chip({ tone = 'neutral', icon, className, children, ...rest }: ChipProps) {
  return (
    <span className={cx('chip', `chip-${tone}`, className)} {...rest}>
      {icon}
      {children}
    </span>
  );
}

interface ChipButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: Tone;
  icon?: ReactNode;
}

export function ChipButton({
  tone = 'neutral',
  icon,
  className,
  children,
  type = 'button',
  ...rest
}: ChipButtonProps) {
  return (
    <button
      type={type}
      className={cx('chip', `chip-${tone}`, className)}
      {...XR_UI_PROPS}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

export function ProgressBar({
  value,
  tone = 'accent',
  label,
}: {
  /** 0..1 */
  value: number;
  tone?: 'accent' | 'ok';
  label?: string;
}) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      className={cx('progress', tone === 'ok' && 'progress-ok')}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label={label}
    >
      <div className="progress-fill" style={{ width: `${percent}%` }} />
    </div>
  );
}

export function Notice({
  tone,
  icon,
  children,
}: {
  tone: 'info' | 'warn' | 'critical' | 'ok';
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={`notice notice-${tone}`} role={tone === 'critical' ? 'alert' : 'status'}>
      {icon}
      <div>{children}</div>
    </div>
  );
}

/** Modal bottom sheet. Tapping the backdrop calls onClose. */
export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="sheet-backdrop" {...XR_UI_PROPS} onClick={onClose}>
      <section
        className="sheet glass card-lg"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="t-title">{title}</h2>
        {children}
      </section>
    </div>
  );
}
