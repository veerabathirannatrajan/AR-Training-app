import { create } from 'zustand';
import type { LocalWorker } from '../data/db';

interface SessionState {
  worker: LocalWorker | null;
  setWorker: (worker: LocalWorker | null) => void;
}

/** The logged-in worker for this app session (persisted in Dexie by data/auth). */
export const useSession = create<SessionState>()((set) => ({
  worker: null,
  setWorker: (worker) => set({ worker }),
}));
