import { useEffect, useRef } from 'react';
import { useEngineStore } from '../engineStore';
import { runner } from './runnerStore';

/** In AR the first step's clock starts once the area is placed, not while searching the floor. */
export function usePlacementClock(): void {
  const placed = useEngineStore((state) => state.placement === 'placed');
  const started = useRef(false);
  useEffect(() => {
    if (placed && !started.current) {
      started.current = true;
      runner().restartStepTimer();
    }
  }, [placed]);
}
