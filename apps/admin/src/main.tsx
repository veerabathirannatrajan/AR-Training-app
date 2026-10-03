import '@fontsource-variable/inter';
import '@fontsource/noto-sans-devanagari/devanagari-400.css';
import '@fontsource/noto-sans-devanagari/devanagari-600.css';
import './index.css';
import './i18n';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { ApiError } from './lib/api';
import { FiltersProvider } from './lib/filters';
import { setupNativeApp } from './lib/native';
import { SessionProvider } from './lib/session';
import { ToastProvider } from './lib/toast';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      refetchOnWindowFocus: true,
      // Auth and validation errors will not fix themselves; network blips might.
      retry: (failures, error) => !(error instanceof ApiError) && failures < 2,
    },
  },
});

setupNativeApp();

const root = document.getElementById('root');
if (root == null) throw new Error('#root is missing');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <SessionProvider>
          <FiltersProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </FiltersProvider>
        </SessionProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
