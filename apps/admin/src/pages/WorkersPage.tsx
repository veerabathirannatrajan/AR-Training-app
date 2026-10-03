import { UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { CertificateStateDot, CertificationDot } from '@/components/badges';
import { ExportButton } from '@/components/ExportButtons';
import { PageHeader } from '@/components/layout/PageHeader';
import { Pagination } from '@/components/Pagination';
import { EmptyState, ErrorState, LoadingRows } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge, Input } from '@/components/ui/misc';
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
import { WorkerForm } from '@/components/WorkerForm';
import { useFilters } from '@/lib/filters';
import { useSites, useWorkers } from '@/lib/queries';
import { formatDate, percent } from '@/lib/utils';

const PAGE_SIZE = 20;
const ALL = 'all';
const MODULE_SHORT: Record<string, string> = {
  'fire-explosion': 'Fire',
  'gas-confined-space': 'Gas',
};

export function WorkersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { sector } = useFilters();
  const sites = useSites();
  const [search, setSearch] = useState('');
  const [site, setSite] = useState(ALL);
  const [certification, setCertification] = useState(ALL);
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const workers = useWorkers({
    page,
    pageSize: PAGE_SIZE,
    search: search.trim() || null,
    site: site === ALL ? null : site,
    certification: certification === ALL ? null : certification,
  });

  return (
    <>
      <PageHeader
        title={t('workers.title')}
        subtitle={t('workers.subtitle')}
        filters="sector"
        actions={
          <>
            <ExportButton
              kind="csv"
              path="/api/reports/compliance.csv"
              query={{ range: 'all', sector, site: site === ALL ? null : site }}
              filename="worker-register.csv"
            />
            <Button onClick={() => setAdding(true)} disabled={sites.data == null}>
              <UserPlus /> {t('workers.add')}
            </Button>
          </>
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
              value={site}
              onValueChange={(value) => {
                setSite(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('filters.allSites')}</SelectItem>
                {sites.data?.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={certification}
              onValueChange={(value) => {
                setCertification(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('workers.allCertification')}</SelectItem>
                {(['certified', 'partial', 'expiring', 'not-certified'] as const).map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`certification.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {workers.isError ? (
            <ErrorState error={workers.error} onRetry={() => void workers.refetch()} />
          ) : workers.data == null ? (
            <LoadingRows rows={10} />
          ) : workers.data.items.length === 0 ? (
            <EmptyState />
          ) : (
            <div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('table.worker')}</TableHead>
                    <TableHead>{t('table.role')}</TableHead>
                    <TableHead>{t('table.site')}</TableHead>
                    <TableHead>{t('table.language')}</TableHead>
                    <TableHead>{t('table.modules')}</TableHead>
                    <TableHead className="text-right">{t('table.avgScore')}</TableHead>
                    <TableHead>{t('table.lastActivity')}</TableHead>
                    <TableHead>{t('table.status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workers.data.items.map((row) => (
                    <TableRow
                      key={row.workerId}
                      data-clickable
                      onClick={() => navigate(`/workers/${row.workerId}`)}
                    >
                      <TableCell>
                        <p className="font-medium">{row.name}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {row.workerId}
                          {!row.active && (
                            <Badge variant="secondary" className="ml-2">
                              {t('workers.inactive')}
                            </Badge>
                          )}
                        </p>
                      </TableCell>
                      <TableCell>{row.role}</TableCell>
                      <TableCell>{row.district}</TableCell>
                      <TableCell>{t(`languages.${row.preferredLanguage}`)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5 text-xs">
                          {row.certificates.length === 0
                            ? '—'
                            : row.certificates.map((badge) => (
                                <span key={badge.moduleId} className="flex items-center gap-2">
                                  <span className="w-8 text-muted-foreground">
                                    {MODULE_SHORT[badge.moduleId] ?? badge.moduleId}
                                  </span>
                                  <CertificateStateDot state={badge.state} />
                                </span>
                              ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {percent(row.avgScore)}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {row.lastActivityAt != null
                          ? formatDate(row.lastActivityAt)
                          : t('common.never')}
                      </TableCell>
                      <TableCell>
                        <CertificationDot state={row.certification} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                total={workers.data.total}
                shown={workers.data.items.length}
                onPage={setPage}
              />
            </div>
          )}
        </CardContent>
      </Card>
      {adding && sites.data != null && (
        <WorkerForm
          open={adding}
          onOpenChange={setAdding}
          sites={sites.data}
          onSaved={(worker) => navigate(`/workers/${worker.workerId}`)}
        />
      )}
    </>
  );
}
