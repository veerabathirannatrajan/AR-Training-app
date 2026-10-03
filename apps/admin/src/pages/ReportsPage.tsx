import { ClipboardList, FileBadge2, FileCheck2, FileText } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ExportButton } from '@/components/ExportButtons';
import { PageHeader } from '@/components/layout/PageHeader';
import { ErrorState, LoadingRows } from '@/components/states';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/misc';
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
import { useFilters } from '@/lib/filters';
import { useDashboard, useSites } from '@/lib/queries';
import { percent } from '@/lib/utils';

const ALL = 'all';

function ReportCard({
  icon: Icon,
  title,
  body,
  children,
}: {
  icon: typeof FileText;
  title: string;
  body: string;
  children: ReactNode;
}) {
  return (
    <Card className="gap-3 px-5 py-4">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-zinc-100">
          <Icon className="size-[18px] text-zinc-700" />
        </span>
        <div className="min-w-0">
          <p className="font-semibold">{title}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{body}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 pl-12">{children}</div>
    </Card>
  );
}

export function ReportsPage() {
  const { t } = useTranslation();
  const { range, sector } = useFilters();
  const sites = useSites();
  const dashboard = useDashboard();
  const [site, setSite] = useState(ALL);
  const query = { range, sector, site: site === ALL ? null : site };
  const preview = dashboard.data?.sites.filter((item) => site === ALL || item.id === site) ?? [];

  return (
    <>
      <PageHeader title={t('reports.title')} subtitle={t('reports.subtitle')} filters />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">{t('reports.filters')}:</span>
        <Select value={site} onValueChange={setSite}>
          <SelectTrigger className="w-[200px]">
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
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ReportCard
          icon={FileText}
          title={t('reports.compliance')}
          body={t('reports.complianceBody')}
        >
          <ExportButton
            kind="pdf"
            path="/api/reports/compliance.pdf"
            query={query}
            filename="compliance-report.pdf"
            variant="default"
          />
        </ReportCard>
        <ReportCard
          icon={ClipboardList}
          title={t('reports.register')}
          body={t('reports.registerBody')}
        >
          <ExportButton
            kind="csv"
            path="/api/reports/compliance.csv"
            query={query}
            filename="compliance-register.csv"
          />
        </ReportCard>
        <ReportCard
          icon={FileCheck2}
          title={t('reports.assessmentLog')}
          body={t('reports.assessmentLogBody')}
        >
          <ExportButton
            kind="csv"
            path="/api/reports/assessments.csv"
            query={query}
            filename="assessments.csv"
          />
        </ReportCard>
        <ReportCard
          icon={FileBadge2}
          title={t('reports.certificateList')}
          body={t('reports.certificateListBody')}
        >
          <ExportButton
            kind="csv"
            path="/api/reports/certificates.csv"
            query={{ sector, site: query.site }}
            filename="certificates.csv"
          />
        </ReportCard>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>{t('reports.preview')}</CardTitle>
          <CardDescription>{t(`filters.range.${range}`)}</CardDescription>
        </CardHeader>
        <CardContent>
          {dashboard.isError ? (
            <ErrorState error={dashboard.error} />
          ) : dashboard.data == null ? (
            <LoadingRows rows={4} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('table.site')}</TableHead>
                  <TableHead>{t('table.sector')}</TableHead>
                  <TableHead className="text-right">{t('table.workers')}</TableHead>
                  <TableHead className="text-right">{t('table.certified')}</TableHead>
                  <TableHead className="w-[30%]">{t('table.compliance')}</TableHead>
                  <TableHead className="text-right">{t('table.avgScore')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.district}</p>
                    </TableCell>
                    <TableCell>{t(`filters.sector.${item.sector}`)}</TableCell>
                    <TableCell className="text-right tabular-nums">{item.workers}</TableCell>
                    <TableCell className="text-right tabular-nums">{item.certified}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Progress value={item.compliancePercent} />
                        <span className="w-10 text-right text-xs tabular-nums">
                          {item.compliancePercent}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {percent(item.avgScore)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
