import type { LanguageCode, Site, WorkerDetail } from '@ar-training/shared';
import { Loader2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/misc';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/overlays';
import { ApiError } from '@/lib/api';
import { useCreateWorker, useUpdateWorker } from '@/lib/queries';
import { useToast } from '@/lib/toast';

const LANGUAGES: LanguageCode[] = ['hi', 'sat', 'en'];

/** Add a worker, or edit one (name, role, site, language, active, new PIN). */
export function WorkerForm({
  open,
  onOpenChange,
  sites,
  worker,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sites: Site[];
  worker?: WorkerDetail;
  onSaved?: (worker: WorkerDetail) => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const create = useCreateWorker();
  const update = useUpdateWorker();
  const [name, setName] = useState(worker?.name ?? '');
  const [role, setRole] = useState(worker?.role ?? '');
  const [siteId, setSiteId] = useState(worker?.siteId ?? sites[0]?.id ?? '');
  const [language, setLanguage] = useState<LanguageCode>(worker?.preferredLanguage ?? 'hi');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const busy = create.isPending || update.isPending;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (worker == null && !/^\d{4}$/.test(pin)) {
      setError(t('workers.form.pinHint'));
      return;
    }
    try {
      const saved =
        worker == null
          ? await create.mutateAsync({ name, role, siteId, preferredLanguage: language, pin })
          : await update.mutateAsync({
              id: worker.workerId,
              body: {
                name,
                role,
                siteId,
                preferredLanguage: language,
                ...(pin !== '' ? { pin } : {}),
              },
            });
      toast(worker == null ? t('workers.form.created', { id: saved.workerId }) : t('common.saved'));
      onSaved?.(saved);
      onOpenChange(false);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : String(caught));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {worker == null ? t('workers.form.title') : t('workers.form.editTitle')}
          </DialogTitle>
          <DialogDescription>{t('workers.form.pinHint')}</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={(event) => void onSubmit(event)}>
          <div className="grid gap-2">
            <Label htmlFor="worker-name">{t('workers.form.name')}</Label>
            <Input
              id="worker-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="worker-role">{t('workers.form.role')}</Label>
            <Input
              id="worker-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              required
              minLength={2}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>{t('workers.form.site')}</Label>
              <Select value={siteId} onValueChange={setSiteId}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sites.map((site) => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>{t('workers.form.language')}</Label>
              <Select
                value={language}
                onValueChange={(value) => setLanguage(value as LanguageCode)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((code) => (
                    <SelectItem key={code} value={code}>
                      {t(`languages.${code}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="worker-pin">
              {worker == null ? t('workers.form.pin') : t('workers.form.newPin')}
            </Label>
            <Input
              id="worker-pin"
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              required={worker == null}
              className="w-28 tracking-[0.4em]"
            />
          </div>
          {error != null && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('actions.cancel')}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              {worker == null ? t('actions.create') : t('actions.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
