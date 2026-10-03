import { FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { downloadExport } from '@/lib/files';
import { useToast } from '@/lib/toast';

type Query = Record<string, string | number | null | undefined>;

export function ExportButton({
  path,
  query,
  filename,
  kind,
  label,
  variant = 'outline',
}: {
  path: string;
  query: Query;
  filename: string;
  kind: 'pdf' | 'csv';
  label?: string;
  variant?: 'outline' | 'default';
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const Icon = kind === 'pdf' ? FileText : FileSpreadsheet;

  const run = async () => {
    setBusy(true);
    try {
      const name = await downloadExport(path, query, filename);
      toast(t('common.exported', { name }));
    } catch (error) {
      toast(
        t('common.exportFailed', {
          message: error instanceof Error ? error.message : String(error),
        }),
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant={variant} onClick={() => void run()} disabled={busy}>
      {busy ? <Loader2 className="animate-spin" /> : <Icon />}
      {busy
        ? t('actions.exporting')
        : (label ?? (kind === 'pdf' ? t('actions.exportPdf') : t('actions.exportCsv')))}
    </Button>
  );
}
