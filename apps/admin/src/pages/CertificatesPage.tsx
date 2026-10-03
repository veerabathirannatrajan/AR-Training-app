import type { CertificateRow } from '@ar-training/shared';
import { Ban, ExternalLink, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AnchorDot, CertificateStateDot } from '@/components/badges';
import { ExportButton } from '@/components/ExportButtons';
import { PageHeader } from '@/components/layout/PageHeader';
import { Pagination } from '@/components/Pagination';
import { EmptyState, ErrorState, LoadingRows } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input, Label, Textarea } from '@/components/ui/misc';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useText } from '@/i18n';
import { ApiError } from '@/lib/api';
import { useFilters } from '@/lib/filters';
import { useCertificates, useModules, useRevokeCertificate } from '@/lib/queries';
import { useToast } from '@/lib/toast';
import { formatDate, shortHash } from '@/lib/utils';

const PAGE_SIZE = 20;
const ALL = 'all';

function RevokeDialog({
  certificate,
  onClose,
}: {
  certificate: CertificateRow | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const revoke = useRevokeCertificate();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  if (certificate == null) return null;
  const submit = async () => {
    setError(null);
    try {
      await revoke.mutateAsync({ id: certificate.id, reason: reason.trim() });
      toast(t('certificates.revoked', { id: certificate.id }));
      onClose();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : String(caught));
    }
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('certificates.revokeTitle', { id: certificate.id })}</DialogTitle>
          <DialogDescription>{t('certificates.revokeBody')}</DialogDescription>
        </DialogHeader>
        <p className="text-sm">
          {certificate.workerName} · {certificate.workerId}
        </p>
        <div className="grid gap-2">
          <Label htmlFor="revoke-reason">{t('certificates.reason')}</Label>
          <Textarea
            id="revoke-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t('certificates.reasonPlaceholder')}
          />
        </div>
        {error != null && <p className="text-sm text-red-700">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('actions.cancel')}
          </Button>
          <Button
            variant="destructive"
            disabled={reason.trim().length < 3 || revoke.isPending}
            onClick={() => void submit()}
          >
            {revoke.isPending && <Loader2 className="animate-spin" />}
            {t('actions.revoke')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CertificatesPage() {
  const { t } = useTranslation();
  const text = useText();
  const { sector } = useFilters();
  const modules = useModules();
  const [search, setSearch] = useState('');
  const [state, setState] = useState(ALL);
  const [module, setModule] = useState(ALL);
  const [page, setPage] = useState(1);
  const [revoking, setRevoking] = useState<CertificateRow | null>(null);
  const certificates = useCertificates({
    page,
    pageSize: PAGE_SIZE,
    search: search.trim() || null,
    state: state === ALL ? null : state,
    module: module === ALL ? null : module,
  });

  return (
    <>
      <PageHeader
        title={t('certificates.title')}
        subtitle={t('certificates.subtitle')}
        filters="sector"
        actions={
          <ExportButton
            kind="csv"
            path="/api/reports/certificates.csv"
            query={{ sector }}
            filename="certificates.csv"
          />
        }
      />
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder={t('filters.search')}
              className="w-full sm:w-64"
            />
            <Select
              value={state}
              onValueChange={(value) => {
                setState(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('certificates.allStates')}</SelectItem>
                {(['valid', 'expiring', 'expired', 'revoked'] as const).map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`certState.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={module}
              onValueChange={(value) => {
                setModule(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[210px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('filters.allModules')}</SelectItem>
                {modules.data
                  ?.filter((item) => item.kind === 'assessed')
                  .map((item) => (
                    <SelectItem key={item.moduleId} value={item.moduleId}>
                      {text(item.title)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {certificates.isError ? (
            <ErrorState error={certificates.error} onRetry={() => void certificates.refetch()} />
          ) : certificates.data == null ? (
            <LoadingRows rows={10} />
          ) : certificates.data.items.length === 0 ? (
            <EmptyState />
          ) : (
            <div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('table.certificate')}</TableHead>
                    <TableHead>{t('table.worker')}</TableHead>
                    <TableHead>{t('table.module')}</TableHead>
                    <TableHead className="text-right">{t('table.score')}</TableHead>
                    <TableHead>{t('table.issued')}</TableHead>
                    <TableHead>{t('table.validUntil')}</TableHead>
                    <TableHead>{t('table.status')}</TableHead>
                    <TableHead>Polygon</TableHead>
                    <TableHead>{t('table.hash')}</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {certificates.data.items.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Link
                          to={`/verify?id=${row.id}`}
                          className="font-medium text-blue-700 underline underline-offset-2"
                        >
                          {row.id}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link to={`/workers/${row.workerId}`} className="hover:underline">
                          {row.workerName}
                        </Link>
                        <p className="text-xs text-muted-foreground">{row.siteName}</p>
                      </TableCell>
                      <TableCell>{text(row.moduleTitle)}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.score}%</TableCell>
                      <TableCell className="tabular-nums">{formatDate(row.issuedOn)}</TableCell>
                      <TableCell className="tabular-nums">{formatDate(row.expiresOn)}</TableCell>
                      <TableCell>
                        <CertificateStateDot state={row.state} />
                        {row.revokedReason != null && (
                          <p
                            className="max-w-[180px] truncate text-xs text-muted-foreground"
                            title={row.revokedReason}
                          >
                            {row.revokedReason}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.anchor.explorerUrl != null ? (
                          <a
                            href={row.anchor.explorerUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1"
                          >
                            <AnchorDot status={row.anchor.status} />
                            <ExternalLink className="size-3" />
                          </a>
                        ) : (
                          <AnchorDot status={row.anchor.status} />
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {shortHash(row.hash, 8, 4)}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1.5">
                          <ExportButton
                            kind="pdf"
                            path={`/api/certificates/${row.id}/pdf`}
                            query={{}}
                            filename={`${row.id}.pdf`}
                            label="PDF"
                          />
                          {row.status !== 'revoked' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title={t('actions.revoke')}
                              onClick={() => setRevoking(row)}
                            >
                              <Ban className="text-red-600" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                total={certificates.data.total}
                shown={certificates.data.items.length}
                onPage={setPage}
              />
            </div>
          )}
        </CardContent>
      </Card>
      <RevokeDialog
        key={revoking?.id ?? 'none'}
        certificate={revoking}
        onClose={() => setRevoking(null)}
      />
    </>
  );
}
