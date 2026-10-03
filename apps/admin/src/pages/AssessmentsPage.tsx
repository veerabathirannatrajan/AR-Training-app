import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { AssessmentDialog } from '@/components/AssessmentDialog';
import { AssessmentTable } from '@/components/AssessmentTable';
import { ExportButton } from '@/components/ExportButtons';
import { PageHeader } from '@/components/layout/PageHeader';
import { Pagination } from '@/components/Pagination';
import { EmptyState, ErrorState, LoadingRows } from '@/components/states';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/misc';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/overlays';
import { useText } from '@/i18n';
import { useFilters } from '@/lib/filters';
import { useAssessments, useModules, useSites } from '@/lib/queries';

const PAGE_SIZE = 15;
const ALL = 'all';

export function AssessmentsPage() {
  const { t } = useTranslation();
  const text = useText();
  const { range, sector } = useFilters();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [site, setSite] = useState(ALL);
  const [module, setModule] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [type, setType] = useState('assessment');
  const [page, setPage] = useState(1);
  const modules = useModules();
  const sites = useSites();
  const query = useAssessments({
    page,
    pageSize: PAGE_SIZE,
    search: search.trim() || null,
    site: site === ALL ? null : site,
    module: module === ALL ? null : module,
    status: status === ALL ? null : status,
    type,
  });
  const openId = params.get('open');
  const reset =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setPage(1);
    };

  return (
    <>
      <PageHeader
        title={t('assessments.title')}
        subtitle={t('assessments.subtitle')}
        filters
        actions={
          <ExportButton
            kind="csv"
            path="/api/reports/assessments.csv"
            query={{
              range,
              sector,
              site: site === ALL ? null : site,
              module: module === ALL ? null : module,
            }}
            filename="assessments.csv"
          />
        }
      />
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Input
              value={search}
              onChange={(event) => reset(setSearch)(event.target.value)}
              placeholder={t('filters.search')}
              className="w-full sm:w-56"
            />
            <Select value={site} onValueChange={reset(setSite)}>
              <SelectTrigger className="w-[170px]">
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
            <Select value={module} onValueChange={reset(setModule)}>
              <SelectTrigger className="w-[210px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('filters.allModules')}</SelectItem>
                {modules.data?.map((item) => (
                  <SelectItem key={item.moduleId} value={item.moduleId}>
                    {text(item.title)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={type} onValueChange={reset(setType)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(['assessment', 'retraining', 'practice', 'all'] as const).map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`assessments.typeFilter.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={reset(setStatus)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('filters.allStatuses')}</SelectItem>
                {(['passed', 'failed', 'certified'] as const).map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`assessments.statusFilter.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {query.isError ? (
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          ) : query.data == null ? (
            <LoadingRows rows={10} />
          ) : query.data.items.length === 0 ? (
            <EmptyState />
          ) : (
            <div>
              <AssessmentTable
                rows={query.data.items}
                showDate
                onOpen={(row) => setParams({ open: row.resultId })}
              />
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                total={query.data.total}
                shown={query.data.items.length}
                onPage={setPage}
              />
            </div>
          )}
        </CardContent>
      </Card>
      <AssessmentDialog resultId={openId} onClose={() => setParams({})} />
    </>
  );
}
