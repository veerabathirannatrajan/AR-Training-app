import { Vector3 } from 'three';

/** A segment whose ends and visibility are updated every frame by its owner (see SegmentLine). */
export interface Segment {
  a: Vector3;
  b: Vector3;
  visible: boolean;
}

export function newSegment(): Segment {
  return { a: new Vector3(), b: new Vector3(), visible: false };
}
