import type { ComponentType } from 'react';
import {
  AttendantIllustration,
  HeavyGasIllustration,
  NoSwitchIllustration,
  RescueIllustration,
  TestOrderIllustration,
} from './illustrations';

/** Quiz illustrations for the gas module, by the ids used in its content JSON. */
export const GAS_ILLUSTRATIONS: Record<string, ComponentType> = {
  'test-order': TestOrderIllustration,
  'heavy-gas': HeavyGasIllustration,
  'no-switch': NoSwitchIllustration,
  attendant: AttendantIllustration,
  rescue: RescueIllustration,
};
