import {
  BarChart3,
  BookOpen,
  Cloud,
  CloudOff,
  FileCheck2,
  House,
  Link2,
  ListChecks,
  Menu,
  ScanSearch,
  Settings,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router-dom';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/overlays';
import { useDashboard } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { UserMenu } from './PageHeader';

interface NavItem {
  to: string;
  icon: LucideIcon;
  label:
    | 'dashboard'
    | 'workers'
    | 'modules'
    | 'assessments'
    | 'certificates'
    | 'verify'
    | 'blockchain'
    | 'reports'
    | 'settings';
}

const NAV: NavItem[] = [
  { to: '/dashboard', icon: House, label: 'dashboard' },
  { to: '/workers', icon: Users, label: 'workers' },
  { to: '/modules', icon: BookOpen, label: 'modules' },
  { to: '/assessments', icon: ListChecks, label: 'assessments' },
  { to: '/certificates', icon: FileCheck2, label: 'certificates' },
  { to: '/verify', icon: ScanSearch, label: 'verify' },
  { to: '/blockchain', icon: Link2, label: 'blockchain' },
  { to: '/reports', icon: BarChart3, label: 'reports' },
  { to: '/settings', icon: Settings, label: 'settings' },
];

function Brand() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3 px-2">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-zinc-900 text-white">
        <ShieldCheck className="size-5" strokeWidth={2.2} />
      </span>
      <div className="min-w-0 leading-tight">
        <p className="text-[15px] font-semibold">{t('app.name')}</p>
        <p className="text-xs text-muted-foreground">{t('app.panel')}</p>
      </div>
    </div>
  );
}

function SyncFooter() {
  const { t } = useTranslation();
  const dashboard = useDashboard();
  const sync = dashboard.data?.sync;
  return (
    <div className="space-y-2 px-2 text-xs text-muted-foreground">
      <p className="flex items-center gap-2" title={t('sync.tooltip')}>
        {dashboard.isError ? <CloudOff className="size-4" /> : <Cloud className="size-4" />}
        {dashboard.isError
          ? t('sync.offline')
          : t('sync.status', {
              synced: sync?.resultsSynced ?? '…',
              pending: sync?.pendingOnDevices ?? '…',
            })}
      </p>
      <p>v{__APP_VERSION__}</p>
    </div>
  );
}

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex h-10 items-center gap-3 rounded-lg px-3 text-[14px] font-medium text-zinc-700 transition-colors hover:bg-accent',
              isActive && 'bg-zinc-100 text-zinc-950',
            )
          }
        >
          <Icon className="size-[18px]" strokeWidth={1.8} />
          {t(`nav.${label}`)}
        </NavLink>
      ))}
    </nav>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-6 py-5">
      <Brand />
      <div className="min-h-0 flex-1 overflow-y-auto px-2">
        <Nav {...(onNavigate != null ? { onNavigate } : {})} />
      </div>
      <SyncFooter />
    </div>
  );
}

/** Sidebar on wide screens; a top bar with a drawer on phones (the admin Android app). */
export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-[244px] shrink-0 border-r bg-sidebar lg:block">
        <SidebarBody />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="safe-top sticky top-0 z-40 border-b bg-card/95 backdrop-blur lg:hidden">
          <div className="flex h-14 items-center gap-2 px-3">
            <button
              type="button"
              className="grid size-10 place-items-center rounded-md hover:bg-accent"
              aria-label={t('nav.menu')}
              onClick={() => setOpen(true)}
            >
              <Menu className="size-5" />
            </button>
            <span className="grid size-8 place-items-center rounded-md bg-zinc-900 text-white">
              <ShieldCheck className="size-4" />
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">
              {t(
                `nav.${NAV.find((item) => location.pathname.startsWith(item.to))?.label ?? 'dashboard'}`,
              )}
            </span>
            <UserMenu compact />
          </div>
        </header>

        <main className="flex-1 px-4 py-5 sm:px-6 lg:py-6">{children}</main>
        <footer className="safe-bottom border-t px-4 py-3 text-xs text-muted-foreground sm:px-6">
          {t('app.footer')}
        </footer>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent side="left" aria-describedby={undefined}>
          <DialogTitle className="sr-only">{t('nav.menu')}</DialogTitle>
          <SidebarBody onNavigate={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
