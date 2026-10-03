import type { AppSettings, Sector } from '@ar-training/shared';
import { Loader2, Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState, ErrorState, LoadingRows } from '@/components/states';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge, Input, Label, StatusDot } from '@/components/ui/misc';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/overlays';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useLocale } from '@/i18n';
import { ApiError, apiBase, setApiBase } from '@/lib/api';
import {
  useAdmins,
  useAppSettings,
  useCreateAdmin,
  useCreateSite,
  useDevices,
  useSaveSettings,
  useSites,
  useUpdateAdmin,
} from '@/lib/queries';
import { useSession } from '@/lib/session';
import { useToast } from '@/lib/toast';
import { formatDateTime } from '@/lib/utils';

function errorText(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : error instanceof Error
      ? error.message
      : String(error);
}

function RulesCard() {
  const { t } = useTranslation();
  const toast = useToast();
  const settings = useAppSettings();
  const save = useSaveSettings();
  const [draft, setDraft] = useState<AppSettings | null>(null);
  const values = draft ?? settings.data;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (values == null) return;
    try {
      await save.mutateAsync(values);
      setDraft(null);
      toast(t('common.saved'));
    } catch (error) {
      toast(errorText(error), 'error');
    }
  };

  const field = (key: keyof AppSettings, label: string, min: number, max: number) => (
    <div className="grid gap-2">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        type="number"
        min={min}
        max={max}
        value={values?.[key] ?? ''}
        onChange={(event) =>
          values != null && setDraft({ ...values, [key]: Number(event.target.value) })
        }
        className="w-32"
        required
      />
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.rules')}</CardTitle>
        <CardDescription>{t('settings.rulesBody')}</CardDescription>
      </CardHeader>
      <CardContent>
        {settings.isError ? (
          <ErrorState error={settings.error} />
        ) : values == null ? (
          <LoadingRows rows={2} />
        ) : (
          <form
            className="flex flex-wrap items-end gap-4"
            onSubmit={(event) => void onSubmit(event)}
          >
            {field('passMark', t('settings.passMark'), 40, 100)}
            {field('certificateValidityDays', t('settings.validity'), 30, 1825)}
            {field('expiringSoonDays', t('settings.expiringSoon'), 7, 180)}
            <Button type="submit" disabled={draft == null || save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" />}
              {t('actions.save')}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function SitesCard() {
  const { t } = useTranslation();
  const toast = useToast();
  const sites = useSites();
  const create = useCreateSite();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    id: '',
    name: '',
    district: '',
    sector: 'coal' as Sector,
    latitude: '',
    longitude: '',
  });

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await create.mutateAsync({
        ...form,
        id: form.id.toUpperCase(),
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
      });
      toast(t('common.saved'));
      setOpen(false);
    } catch (error) {
      toast(errorText(error), 'error');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.sites')}</CardTitle>
        <CardAction>
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            <Plus /> {t('settings.addSite')}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {sites.isError ? (
          <ErrorState error={sites.error} />
        ) : sites.data == null ? (
          <LoadingRows rows={4} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('settings.siteId')}</TableHead>
                <TableHead>{t('settings.siteName')}</TableHead>
                <TableHead>{t('table.district')}</TableHead>
                <TableHead>{t('table.sector')}</TableHead>
                <TableHead className="text-right">{t('table.workers')}</TableHead>
                <TableHead className="text-right">GPS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sites.data.map((site) => (
                <TableRow key={site.id}>
                  <TableCell className="font-mono text-xs">{site.id}</TableCell>
                  <TableCell className="font-medium">{site.name}</TableCell>
                  <TableCell>{site.district}</TableCell>
                  <TableCell>{t(`filters.sector.${site.sector}`)}</TableCell>
                  <TableCell className="text-right tabular-nums">{site.workers}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                    {site.latitude.toFixed(3)}, {site.longitude.toFixed(3)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('settings.addSite')}</DialogTitle>
          </DialogHeader>
          <form className="grid grid-cols-1 gap-4" onSubmit={(event) => void onSubmit(event)}>
            <div className="grid grid-cols-[120px_1fr] gap-4">
              <div className="grid gap-2">
                <Label htmlFor="site-id">{t('settings.siteId')}</Label>
                <Input
                  id="site-id"
                  value={form.id}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      id: e.target.value
                        .toUpperCase()
                        .replace(/[^A-Z]/g, '')
                        .slice(0, 6),
                    })
                  }
                  required
                  minLength={3}
                  placeholder="JMS"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="site-name">{t('settings.siteName')}</Label>
                <Input
                  id="site-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  minLength={2}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="site-district">{t('table.district')}</Label>
                <Input
                  id="site-district"
                  value={form.district}
                  onChange={(e) => setForm({ ...form, district: e.target.value })}
                  required
                  minLength={2}
                />
              </div>
              <div className="grid gap-2">
                <Label>{t('table.sector')}</Label>
                <Select
                  value={form.sector}
                  onValueChange={(value) => setForm({ ...form, sector: value as Sector })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(['coal', 'steel', 'mica'] as const).map((value) => (
                      <SelectItem key={value} value={value}>
                        {t(`filters.sector.${value}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="site-lat">{t('settings.latitude')}</Label>
                <Input
                  id="site-lat"
                  type="number"
                  step="any"
                  value={form.latitude}
                  onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                  required
                  placeholder="22.80"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="site-lng">{t('settings.longitude')}</Label>
                <Input
                  id="site-lng"
                  type="number"
                  step="any"
                  value={form.longitude}
                  onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                  required
                  placeholder="86.18"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                {t('actions.cancel')}
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending && <Loader2 className="animate-spin" />}
                {t('actions.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function AdminsCard() {
  const { t } = useTranslation();
  const locale = useLocale();
  const toast = useToast();
  const { admin: me } = useSession();
  const admins = useAdmins();
  const create = useCreateAdmin();
  const update = useUpdateAdmin();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: '', name: '', password: '' });

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await create.mutateAsync(form);
      toast(t('common.saved'));
      setOpen(false);
      setForm({ email: '', name: '', password: '' });
    } catch (error) {
      toast(errorText(error), 'error');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.admins')}</CardTitle>
        <CardAction>
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            <Plus /> {t('settings.addAdmin')}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {admins.data == null ? (
          <LoadingRows rows={2} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('table.name')}</TableHead>
                <TableHead>{t('table.email')}</TableHead>
                <TableHead>{t('table.lastLogin')}</TableHead>
                <TableHead>{t('table.active')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {admins.data.map((admin) => (
                <TableRow key={admin.id}>
                  <TableCell className="font-medium">
                    {admin.name}
                    {admin.id === me?.id && (
                      <Badge variant="secondary" className="ml-2">
                        {t('settings.you')}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{admin.email}</TableCell>
                  <TableCell className="tabular-nums">
                    {admin.lastLoginAt != null
                      ? formatDateTime(admin.lastLoginAt, locale)
                      : t('common.never')}
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      disabled={admin.id === me?.id || update.isPending}
                      className="disabled:cursor-default"
                      onClick={() =>
                        void update
                          .mutateAsync({ id: admin.id, body: { active: !admin.active } })
                          .catch((error: unknown) => toast(errorText(error), 'error'))
                      }
                    >
                      <StatusDot tone={admin.active ? 'green' : 'grey'}>
                        {admin.active ? t('common.yes') : t('common.no')}
                      </StatusDot>
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('settings.addAdmin')}</DialogTitle>
          </DialogHeader>
          <form className="grid grid-cols-1 gap-4" onSubmit={(event) => void onSubmit(event)}>
            <div className="grid gap-2">
              <Label htmlFor="admin-name">{t('settings.adminName')}</Label>
              <Input
                id="admin-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="admin-email">{t('table.email')}</Label>
              <Input
                id="admin-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="admin-password">{t('settings.adminPassword')}</Label>
              <Input
                id="admin-password"
                type="password"
                minLength={8}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                autoComplete="new-password"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                {t('actions.cancel')}
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending && <Loader2 className="animate-spin" />}
                {t('actions.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function DevicesCard() {
  const { t } = useTranslation();
  const locale = useLocale();
  const devices = useDevices();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.devices')}</CardTitle>
        <CardDescription>{t('settings.devicesBody')}</CardDescription>
      </CardHeader>
      <CardContent>
        {devices.data == null ? (
          <LoadingRows rows={2} />
        ) : devices.data.length === 0 ? (
          <EmptyState text={t('settings.noDevices')} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('table.device')}</TableHead>
                <TableHead>{t('table.worker')}</TableHead>
                <TableHead>{t('table.lastSync')}</TableHead>
                <TableHead className="text-right">{t('table.uploaded')}</TableHead>
                <TableHead className="text-right">{t('table.pending')}</TableHead>
                <TableHead>{t('table.appVersion')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {devices.data.map((device) => (
                <TableRow key={device.deviceId}>
                  <TableCell className="font-mono text-xs">{device.deviceId.slice(0, 8)}</TableCell>
                  <TableCell>{device.lastWorkerName ?? '—'}</TableCell>
                  <TableCell className="tabular-nums">
                    {formatDateTime(device.lastSyncAt, locale)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {device.resultsUploaded}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{device.pendingCount}</TableCell>
                  <TableCell>{device.appVersion}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function ServerCard() {
  const { t } = useTranslation();
  const toast = useToast();
  const [server, setServer] = useState(apiBase());
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.server')}</CardTitle>
        <CardDescription>{t('login.serverHint')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setApiBase(server);
            setServer(apiBase());
            toast(t('login.serverSaved'));
          }}
        >
          <Input
            value={server}
            onChange={(event) => setServer(event.target.value)}
            className="w-full sm:w-80"
          />
          <Button type="submit" variant="outline">
            {t('actions.save')}
          </Button>
        </form>
        <p className="mt-3 text-xs text-muted-foreground">
          {t('settings.version', { version: __APP_VERSION__ })}
        </p>
      </CardContent>
    </Card>
  );
}

export function SettingsPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <RulesCard />
        <ServerCard />
        <SitesCard />
        <AdminsCard />
        <div className="xl:col-span-2">
          <DevicesCard />
        </div>
      </div>
    </>
  );
}
