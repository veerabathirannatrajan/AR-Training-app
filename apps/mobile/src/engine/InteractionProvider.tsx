import { useState, type ReactNode } from 'react';
import { InteractionRegistry, RegistryContext } from './interaction';

/** Owns the registry of tappable, draggable and aimable objects for one training scene. */
export function InteractionProvider({ children }: { children: ReactNode }) {
  const [registry] = useState(() => new InteractionRegistry());
  return <RegistryContext.Provider value={registry}>{children}</RegistryContext.Provider>;
}
