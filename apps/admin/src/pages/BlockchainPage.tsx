import type { AnchorStatus } from '@ar-training/shared';
import { ExternalLink, Link2, Link2Off, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AnchorDot } from '@/components/badges';
import { PageHeader } from '@/components/layout/PageHeader';
import { Pagination } from '@/components/Pagination';
import { EmptyState, ErrorState, LoadingRows } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/misc';
import {
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
import { useAnchors, useChainStatus, useRunAnchoring } from '@/lib/queries';
import { useToast } from '@/lib/toast';
import { formatDate, formatDateTime, shortHash } from '@/lib/utils';

const PAGE_SIZE = 20;
const ALL = 'all';

export function BlockchainPage() {
  const { t } = useTranslation();
  const locale = useLocale();
  const toast = useToast();
  const chain = useChainStatus();
  const run = useRunAnchoring();
  const [status, setStatus] = useState(ALL);
  const [page, setPage] = useState(1);
  const anchors = useAnchors({ page, pageSize: PAGE_SIZE, status: status === ALL ? null : status });
  const info = chain.data;

  const anchorNow = async () => {
    try {
      const result = await run.mutateAsync();
      toast(
        result.message ?? t('blockchain.ran', { ...result }),
        result.message != null ? 'error' : 'ok',
      );
    } catch (error) {
      toast(error instanceof Error ? error.message : String(error), 'error');
    }
  };

  return (
    <>
      <PageHeader
        title={t('blockchain.title')}
        subtitle={t('blockchain.subtitle')}
        actions={
          <Button
            onClick={() => void anchorNow()}
            disabled={info?.configured !== true || run.isPending}
          >
            {run.isPending ? <Loader2 className="animate-spin" /> : <Link2 />}
            {t('blockchain.run')}
          </Button>
        }
      />

      <Card className="mb-4">
        <CardContent>
          {chain.isError ? (
            <ErrorState error={chain.error} />
          ) : info == null ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <div className="flex flex-col gap-4">
              <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
                <div>
                  <dt className="text-xs text-muted-foreground">{t('blockchain.adapter')}</dt>
                  <dd className="mt-1 flex items-center gap-2 font-medium">
                    {info.configured ? (
                      <Link2 className="size-4 text-green-600" />
                    ) : (
                      <Link2Off className="size-4 text-zinc-400" />
                    )}
                    {info.configured ? t('blockchain.live') : t('blockchain.stub')}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{t('blockchain.network')}</dt>
                  <dd className="mt-1 font-medium">
                    Polygon Amoy{' '}
                    {info.chainId != null && (
                      <span className="text-muted-foreground">· chain {info.chainId}</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{t('blockchain.wallet')}</dt>
                  <dd className="mt-1 font-mono text-xs">
                    {info.address != null && info.explorerUrl != null ? (
                      <a
                        href={info.explorerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 underline"
                      >
                        {shortHash(info.address, 8, 6)} <ExternalLink className="size-3" />
                      </a>
                    ) : (
                      '—'
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{t('blockchain.balance')}</dt>
                  <dd className="mt-1 font-medium tabular-nums">
                    {info.balance != null ? `${info.balance} POL` : '—'}
                  </dd>
                </div>
              </dl>
              {!info.configured && (
                <div className="rounded-lg border border-dashed p-4 text-sm">
                  <p className="font-semibold">{t('blockchain.off')}</p>
                  <p className="mt-1 text-muted-foreground">{t('blockchain.offBody')}</p>
                </div>
              )}
              {info.configured && info.message != null && (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  {info.message}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('nav.certificates')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t('blockchain.allStatuses')}</SelectItem>
              {(['not-anchored', 'pending', 'anchored', 'failed'] as AnchorStatus[]).map(
                (value) => (
                  <SelectItem key={value} value={value}>
                    {t(`anchor.${value}`)}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
          {anchors.isError ? (
            <ErrorState error={anchors.error} onRetry={() => void anchors.refetch()} />
          ) : anchors.data == null ? (
            <LoadingRows rows={10} />
          ) : anchors.data.items.length === 0 ? (
            <EmptyState />
          ) : (
            <div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('table.certificate')}</TableHead>
                    <TableHead>{t('table.worker')}</TableHead>
                    <TableHead>{t('table.issued')}</TableHead>
                    <TableHead>{t('table.hash')}</TableHead>
                    <TableHead>{t('table.status')}</TableHead>
                    <TableHead>{t('table.tx')}</TableHead>
                    <TableHead className="text-right">{t('table.block')}</TableHead>
                    <TableHead>{t('table.date')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {anchors.data.items.map((row) => (
                    <TableRow key={row.certificateId}>
                      <TableCell>
                        <Link
                          to={`/verify?id=${row.certificateId}`}
                          className="font-medium underline underline-offset-2"
                        >
                          {row.certificateId}
                        </Link>
                      </TableCell>
                      <TableCell>{row.workerName}</TableCell>
                      <TableCell className="tabular-nums">{formatDate(row.issuedOn)}</TableCell>
                      <TableCell
                        className="font-mono text-xs text-muted-foreground"
                        title={row.hash}
                      >
                        {shortHash(row.hash, 10, 6)}
                      </TableCell>
                      <TableCell>
                        <AnchorDot status={row.status} />
                        {row.error != null && row.status === 'failed' && (
                          <p
                            className="max-w-[220px] truncate text-xs text-red-700"
                            title={row.error}
                          >
                            {row.error}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {row.txHash != null && row.explorerUrl != null ? (
                          <a
                            href={row.explorerUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-blue-700 underline"
                          >
                            {shortHash(row.txHash)} <ExternalLink className="size-3" />
                          </a>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.blockNumber ?? '—'}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {row.anchoredAt != null ? formatDateTime(row.anchoredAt, locale) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                total={anchors.data.total}
                shown={anchors.data.items.length}
                onPage={setPage}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
