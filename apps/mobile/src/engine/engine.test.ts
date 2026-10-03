import { describe, expect, it } from 'vitest';
import { crouchDepth, crouchThreshold, nextCrouchState } from './crouch';
import { FALLBACK_FOV, fallbackFov, MIN_HORIZONTAL_FOV } from './fallback/view';
import { HIP_HEIGHT, legAngles, RIG } from './primitives/avatar/rig';
import {
  angleDelta,
  dragRotateDelta,
  headingOf,
  intersectHorizontalPlane,
  twistDelta,
} from './gestures';

const deg = (d: number) => (d * Math.PI) / 180;
const dirAtHeading = (h: number) => ({ x: Math.sin(h), y: -0.3, z: Math.cos(h) });

describe('gestures', () => {
  it('wraps angle differences across ±π', () => {
    expect(angleDelta(deg(170), deg(-170))).toBeCloseTo(deg(20));
    expect(angleDelta(deg(-170), deg(170))).toBeCloseTo(deg(-20));
  });

  it('matches three.js rotation.y for headings', () => {
    expect(headingOf({ x: 0, y: 0, z: 1 })).toBeCloseTo(0);
    expect(headingOf({ x: 1, y: 0, z: 0 })).toBeCloseTo(Math.PI / 2);
  });

  it('turns the scene positively when the finger moves right', () => {
    // Viewer faces -z; moving the finger right swings the ray from -z towards +x.
    const before = dirAtHeading(Math.PI);
    const after = dirAtHeading(Math.PI - deg(10));
    expect(dragRotateDelta(before, after)).toBeCloseTo(deg(30));
  });

  it('measures a two-finger twist from floor points', () => {
    const a = { x: 0, y: 0, z: 0 };
    const b0 = { x: 0, y: 0, z: 1 };
    const b1 = { x: Math.sin(deg(15)), y: 0, z: Math.cos(deg(15)) };
    expect(twistDelta(a, b0, a, b1)).toBeCloseTo(deg(15));
  });

  it('intersects rays with a horizontal plane', () => {
    const hit = intersectHorizontalPlane({ x: 0, y: 1.5, z: 0 }, { x: 0, y: -1, z: -1 }, 0);
    expect(hit).toEqual({ x: 0, y: 0, z: -1.5 });
    expect(intersectHorizontalPlane({ x: 0, y: 1.5, z: 0 }, { x: 0, y: 1, z: -1 }, 0)).toBeNull();
  });
});

describe('crouch detection', () => {
  it('scales the threshold with standing height', () => {
    expect(crouchThreshold(1.4)).toBeCloseTo(1.05);
    expect(crouchThreshold(1.0)).toBeCloseTo(0.7);
  });

  it('uses hysteresis so the state does not flicker', () => {
    const standing = 1.4;
    expect(nextCrouchState(1.04, standing, false)).toBe(true);
    expect(nextCrouchState(1.08, standing, true)).toBe(true);
    expect(nextCrouchState(1.08, standing, false)).toBe(false);
    expect(nextCrouchState(1.2, standing, true)).toBe(false);
  });

  it('reports crouch depth from 0 (standing) to 1 (low enough)', () => {
    expect(crouchDepth(1.4, 1.4)).toBe(0);
    expect(crouchDepth(1.225, 1.4)).toBeCloseTo(0.5);
    expect(crouchDepth(0.6, 1.4)).toBe(1);
  });
});

describe('3D mode field of view', () => {
  const horizontal = (vertical: number, aspect: number) =>
    (Math.atan(Math.tan((vertical * Math.PI) / 360) * aspect) * 360) / Math.PI;

  it('keeps the standard view on landscape screens', () => {
    expect(fallbackFov(16 / 9)).toBe(FALLBACK_FOV);
  });

  it('widens on portrait screens so the sides of the area stay in view', () => {
    const aspect = 412 / 760;
    expect(fallbackFov(aspect)).toBeGreaterThan(FALLBACK_FOV);
    expect(horizontal(fallbackFov(aspect), aspect)).toBeCloseTo(MIN_HORIZONTAL_FOV, 5);
  });
});

describe('avatar leg IK', () => {
  /** Where the ankle ends up for the given angles (forward, down from the hip). */
  function ankleOf(hip: number, knee: number) {
    const thigh = -hip;
    const shin = thigh - knee;
    return {
      forward: RIG.thigh * Math.sin(thigh) + RIG.shin * Math.sin(shin),
      down: RIG.thigh * Math.cos(thigh) + RIG.shin * Math.cos(shin),
    };
  }

  it('stands with straight legs and level feet', () => {
    const leg = legAngles(0, HIP_HEIGHT - RIG.ankle);
    expect(leg.hip).toBeCloseTo(0, 1);
    expect(leg.knee).toBeCloseTo(0, 1);
    expect(leg.hip + leg.knee + leg.ankle).toBeCloseTo(0, 6);
  });

  it.each([
    [0, 0.45],
    [0.2, 0.75],
    [-0.15, 0.6],
  ])('puts the ankle on the target (%s m forward, %s m down)', (forward, down) => {
    const leg = legAngles(forward, down);
    const ankle = ankleOf(leg.hip, leg.knee);
    expect(ankle.forward).toBeCloseTo(forward, 4);
    expect(ankle.down).toBeCloseTo(down, 4);
    // Knees bend forward, like a person's.
    expect(leg.knee).toBeGreaterThanOrEqual(0);
  });
});
