import { DATE_RANGES, type DateRange, type SectorFilter } from '@ar-training/shared';
import { ChevronDown, LogOut, Settings } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/overlays';
import { setPortalLanguage, usePortalLanguage } from '@/i18n';
import { SECTORS, useFilters } from '@/lib/filters';
import { useSession } from '@/lib/session';
import { cn, initials } from '@/lib/utils';

export function RangeSelect() {
  const { t } = useTranslation();
  const { range, setRange } = useFilters();
  return (
    <Select value={range} onValueChange={(value) => setRange(value as DateRange)}>
      <SelectTrigger className="w-[150px]" aria-label="Period">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {DATE_RANGES.map((value) => (
          <SelectItem key={value} value={value}>
            {t(`filters.range.${value}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function SectorSelect() {
  const { t } = useTranslation();
  const { sector, setSector } = useFilters();
  return (
    <Select value={sector} onValueChange={(value) => setSector(value as SectorFilter)}>
      <SelectTrigger className="w-[140px]" aria-label="Sector">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SECTORS.map((value) => (
          <SelectItem key={value} value={value}>
            {t(`filters.sector.${value}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function LanguageToggle() {
  const lang = usePortalLanguage();
  return (
    <div className="inline-flex h-9 items-center rounded-md border bg-card p-0.5 text-sm shadow-xs">
      {(['en', 'hi'] as const).map((code) => (
        <button
          key={code}
          type="button"
          lang={code}
          aria-pressed={lang === code}
          onClick={() => void setPortalLanguage(code)}
          className={cn(
            'h-full rounded-[5px] px-2.5 font-medium text-muted-foreground transition-colors',
            lang === code && 'bg-zinc-100 text-foreground',
          )}
        >
          {code === 'en' ? 'EN' : 'हि'}
        </button>
      ))}
    </div>
  );
}

export function UserMenu({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const { admin, signOut } = useSession();
  const navigate = useNavigate();
  if (admin == null) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-9 items-center gap-2 rounded-md px-1.5 text-sm hover:bg-accent"
        >
          <span className="grid size-8 place-items-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">
            {initials(admin.name || admin.email)}
          </span>
          {!compact && (
            <span className="hidden max-w-[160px] truncate xl:inline">{admin.email}</span>
          )}
          {!compact && <ChevronDown className="size-4 text-muted-foreground" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <p className="font-medium">{admin.name}</p>
          <p className="truncate text-xs text-muted-foreground">{admin.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate('/settings')}>
          <Settings /> {t('nav.settings')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={signOut}>
          <LogOut /> {t('actions.signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Title and subtitle on the left; filters, actions, language and account on the right
 * (wrapping under the title on narrow screens).
 */
export function PageHeader({
  title,
  subtitle,
  filters = false,
  actions,
}: {
  title: string;
  subtitle?: string;
  /** Show the period and sector filters. */
  filters?: boolean | 'sector';
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
      <div className="min-w-0">
        <h1 className="text-[22px] leading-tight font-semibold tracking-tight">{title}</h1>
        {subtitle != null && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {filters === true && <RangeSelect />}
        {filters !== false && <SectorSelect />}
        <LanguageToggle />
        {actions}
        <span className="hidden lg:inline-flex">
          <UserMenu />
        </span>
      </div>
    </div>
  );
}
