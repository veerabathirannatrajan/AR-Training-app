import type { AdminLoginResponse, AdminProfile } from '@ar-training/shared';
import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, ApiError, getToken, setToken, setUnauthorizedHandler } from './api';

interface Session {
  admin: AdminProfile | null;
  /** Restoring a saved session on start. */
  restoring: boolean;
  /** Why the saved session could not be restored (e.g. the API is not reachable). */
  restoreError: unknown;
  retryRestore: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [restoring, setRestoring] = useState(() => getToken() != null);
  const [restoreError, setRestoreError] = useState<unknown>(null);

  const signOut = useCallback(() => {
    setToken(null);
    setAdmin(null);
    queryClient.clear();
  }, [queryClient]);

  /** Checks the saved token with the API (`restoring` is already true while this runs). */
  const restore = useCallback(() => {
    if (getToken() == null) return;
    api<AdminProfile>('/api/auth/admin/me')
      .then((profile) => {
        setAdmin(profile);
        setRestoreError(null);
      })
      .catch((error: unknown) => {
        // A rejected token is dropped; if the API is just unreachable the token is kept so a
        // retry can restore the session once it is back.
        if (error instanceof ApiError) setToken(null);
        setRestoreError(error);
      })
      .finally(() => setRestoring(false));
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(signOut);
    restore();
  }, [signOut, restore]);

  const signIn = useCallback(async (email: string, password: string) => {
    const response = await api<AdminLoginResponse>('/api/auth/admin/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    });
    setToken(response.token);
    setAdmin(response.admin);
    setRestoreError(null);
  }, []);

  const retryRestore = useCallback(() => {
    if (getToken() == null) return;
    setRestoring(true);
    restore();
  }, [restore]);

  const value = useMemo(
    () => ({ admin, restoring, restoreError, retryRestore, signIn, signOut }),
    [admin, restoring, restoreError, retryRestore, signIn, signOut],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (session == null) throw new Error('useSession outside SessionProvider');
  return session;
}
