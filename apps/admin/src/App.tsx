import { Loader2 } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { useSession } from '@/lib/session';
import { LoginPage } from '@/pages/LoginPage';

// One chunk per page, so the first screen loads quickly (also inside the Android app).
const DashboardPage = lazy(() =>
  import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const WorkersPage = lazy(() =>
  import('@/pages/WorkersPage').then((m) => ({ default: m.WorkersPage })),
);
const WorkerDetailPage = lazy(() =>
  import('@/pages/WorkerDetailPage').then((m) => ({ default: m.WorkerDetailPage })),
);
const ModulesPage = lazy(() =>
  import('@/pages/ModulesPage').then((m) => ({ default: m.ModulesPage })),
);
const AssessmentsPage = lazy(() =>
  import('@/pages/AssessmentsPage').then((m) => ({ default: m.AssessmentsPage })),
);
const CertificatesPage = lazy(() =>
  import('@/pages/CertificatesPage').then((m) => ({ default: m.CertificatesPage })),
);
const VerifyPage = lazy(() =>
  import('@/pages/VerifyPage').then((m) => ({ default: m.VerifyPage })),
);
const BlockchainPage = lazy(() =>
  import('@/pages/BlockchainPage').then((m) => ({ default: m.BlockchainPage })),
);
const ReportsPage = lazy(() =>
  import('@/pages/ReportsPage').then((m) => ({ default: m.ReportsPage })),
);
const SettingsPage = lazy(() =>
  import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);

function Spinner() {
  return (
    <div className="grid min-h-[50vh] place-items-center text-muted-foreground">
      <Loader2 className="size-6 animate-spin" />
    </div>
  );
}

export function App() {
  const { admin, restoring } = useSession();
  const location = useLocation();

  if (restoring) return <Spinner />;

  if (admin == null) {
    // Certificate verification is public; everything else needs a sign-in.
    if (location.pathname.startsWith('/verify')) {
      return (
        <div className="mx-auto max-w-3xl px-4 py-6">
          <Suspense fallback={<Spinner />}>
            <VerifyPage />
          </Suspense>
        </div>
      );
    }
    return <LoginPage />;
  }

  return (
    <AppShell>
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/workers" element={<WorkersPage />} />
          <Route path="/workers/:workerId" element={<WorkerDetailPage />} />
          <Route path="/modules" element={<ModulesPage />} />
          <Route path="/modules/:moduleId" element={<ModulesPage />} />
          <Route path="/assessments" element={<AssessmentsPage />} />
          <Route path="/certificates" element={<CertificatesPage />} />
          <Route path="/verify" element={<VerifyPage />} />
          <Route path="/blockchain" element={<BlockchainPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}
