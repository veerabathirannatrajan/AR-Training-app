import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  Float32BufferAttribute,
  IcosahedronGeometry,
  Matrix4,
  MeshLambertMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RIG } from './rig';

/**
 * Procedural low-poly worker: every body segment is built from primitives, baked with
 * per-vertex colours and merged into one geometry, so the whole figure is a dozen draw calls
 * with one shared flat-shaded material (no textures, works offline).
 */

export type AvatarBuild = 'male' | 'female';

export interface AvatarLook {
  skin: string;
  hair: string;
  shirt: string;
  trousers: string;
  vest: string;
  helmet: string;
  build: AvatarBuild;
  mustache: boolean;
}

export const DEFAULT_LOOK: AvatarLook = {
  skin: '#b07a52',
  hair: '#1c1714',
  shirt: '#2d4a6e',
  trousers: '#2a3442',
  vest: '#ff7a1a',
  helmet: '#ffc93c',
  build: 'male',
  mustache: false,
};

const STRIPE = '#e6ecf0';
const BELT = '#3a2a1e';
const BUCKLE = '#b8a46a';
const BOOT = '#2b2420';
const SOLE = '#141618';
const EYE_WHITE = '#f2efe8';
const PUPIL = '#1a1410';
const LIPS = '#6e3b2c';

/** One flat-shaded material for every avatar; colours live in the geometry. */
export const avatarMaterial = new MeshLambertMaterial({ vertexColors: true, flatShading: true });

type V3 = readonly [number, number, number];

interface Part {
  geometry: BufferGeometry;
  color: string;
  position?: V3;
  rotation?: V3;
  scale?: V3;
}

const matrix = new Matrix4();
const quaternion = new Quaternion();
const euler = new Euler();
const offset = new Vector3();
const stretch = new Vector3();
const tint = new Color();

/** Darker or lighter version of a colour, for subtle two-tone detail. */
function shade(hex: string, factor: number): string {
  return `#${tint.set(hex).multiplyScalar(factor).getHexString()}`;
}

function bake(parts: readonly Part[]): BufferGeometry {
  const pieces = parts.map(
    ({ geometry, color, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1] }) => {
      const piece = geometry.toNonIndexed();
      geometry.dispose();
      piece.deleteAttribute('uv');
      matrix.compose(
        offset.set(...position),
        quaternion.setFromEuler(euler.set(...rotation)),
        stretch.set(...scale),
      );
      piece.applyMatrix4(matrix);
      tint.set(color);
      const count = piece.getAttribute('position').count;
      const colors = new Float32Array(count * 3);
      for (let i = 0; i < count; i += 1) colors.set([tint.r, tint.g, tint.b], i * 3);
      piece.setAttribute('color', new Float32BufferAttribute(colors, 3));
      return piece;
    },
  );
  const merged = mergeGeometries(pieces, false);
  pieces.forEach((piece) => piece.dispose());
  if (merged == null) throw new Error('avatar: could not merge segment geometry');
  merged.computeBoundingSphere();
  return merged;
}

const box = (w: number, h: number, d: number) => new BoxGeometry(w, h, d);
const cylinder = (top: number, bottom: number, height: number, sides: number) =>
  new CylinderGeometry(top, bottom, height, sides);

/** Half the shoulder width, metres. */
function shoulderHalf(build: AvatarBuild): number {
  return build === 'female' ? 0.185 : 0.205;
}

/** Where the arms hang from, either side of the centre line. */
export function shoulderJointX(build: AvatarBuild): number {
  return shoulderHalf(build) + 0.01;
}

/** Torso, pelvis, neck and the hi-vis vest, in body coordinates (hip joint at the origin). */
function torso(look: AvatarLook): BufferGeometry {
  const female = look.build === 'female';
  const shoulder = shoulderHalf(look.build);
  const chest = female ? 0.152 : 0.165;
  const hip = female ? 0.152 : 0.145;
  const depth = 0.62;
  const chestTop = shoulder - 0.02;
  const vestTop = shoulder - 0.012;
  const vestBottom = chest + 0.012;
  // Vest radius at height y (it tapers from the chest to the belt).
  const vestAt = (y: number) => vestBottom + ((vestTop - vestBottom) * (y - 0.11)) / 0.4;
  const front = (y: number) => vestAt(y) * (depth + 0.02);
  // Shoulders slope down from the neck (trapezius) to round deltoids.
  const slope = Math.atan2(0.09, chestTop - 0.072);
  return bake([
    {
      geometry: cylinder(hip, hip * 0.95, 0.18, 8),
      color: look.trousers,
      position: [0, 0.03, 0],
      scale: [1, 1, 0.72],
    },
    {
      geometry: cylinder(hip + 0.006, hip + 0.006, 0.045, 8),
      color: BELT,
      position: [0, 0.105, 0],
      scale: [1, 1, 0.74],
    },
    { geometry: box(0.05, 0.034, 0.012), color: BUCKLE, position: [0, 0.105, hip * 0.74 + 0.006] },
    {
      geometry: cylinder(chest, hip * 0.98, 0.14, 8),
      color: look.shirt,
      position: [0, 0.19, 0],
      scale: [1, 1, 0.66],
    },
    {
      geometry: cylinder(chestTop, chest, 0.26, 8),
      color: look.shirt,
      position: [0, 0.38, 0],
      scale: [1, 1, depth],
    },
    {
      geometry: cylinder(0.072, chestTop, 0.09, 8),
      color: look.shirt,
      position: [0, 0.555, 0],
      scale: [1, 1, depth],
    },
    ...[-1, 1].map((side): Part => ({
      geometry: new SphereGeometry(0.066, 8, 6),
      color: look.shirt,
      position: [side * (shoulder - 0.01), 0.49, 0],
      scale: [1, 0.85, 0.95],
    })),
    // Vest with straps over the shoulders, front zip and reflective bands.
    {
      geometry: cylinder(vestTop, vestBottom, 0.4, 8),
      color: look.vest,
      position: [0, 0.31, 0],
      scale: [1, 1, depth + 0.02],
    },
    ...[-1, 1].flatMap((side): Part[] => [
      {
        geometry: box(0.075, 0.014, 0.135),
        color: look.vest,
        position: [side * 0.12, 0.548, 0],
        rotation: [0, 0, -side * slope],
      },
      {
        geometry: box(0.034, 0.006, 0.139),
        color: STRIPE,
        position: [side * 0.118, 0.557, 0],
        rotation: [0, 0, -side * slope],
      },
    ]),
    {
      geometry: box(0.012, 0.37, 0.006),
      color: shade(look.vest, 0.7),
      position: [0, 0.315, front(0.315) + 0.002],
    },
    ...[0.22, 0.36].map((y): Part => ({
      geometry: cylinder(vestAt(y) + 0.004, vestAt(y) + 0.004, 0.04, 8),
      color: STRIPE,
      position: [0, y, 0],
      scale: [1, 1, depth + 0.025],
    })),
    ...[-1, 1].flatMap((side): Part[] =>
      [-1, 1].map((face) => ({
        geometry: box(0.04, 0.14, 0.006),
        color: STRIPE,
        position: [side * 0.085, 0.44, face * (front(0.44) + 0.004)],
        rotation: [face * -0.06, 0, 0],
      })),
    ),
    {
      geometry: cylinder(0.06, 0.068, 0.03, 8),
      color: look.shirt,
      position: [0, 0.6, 0],
      scale: [1, 1, 0.85],
    },
    { geometry: cylinder(0.047, 0.052, 0.09, 6), color: look.skin, position: [0, 0.61, 0] },
  ]);
}

/** Head with face and hair, in head coordinates (top of the neck at the origin). */
function head(look: AvatarLook): BufferGeometry {
  const skinShade = shade(look.skin, 0.88);
  const parts: Part[] = [
    {
      geometry: new IcosahedronGeometry(1, 1),
      color: look.skin,
      position: [0, 0.105, 0],
      scale: [0.092, 0.112, 0.102],
    },
    { geometry: cylinder(0.074, 0.048, 0.075, 6), color: look.skin, position: [0, 0.04, 0.016] },
    {
      geometry: new ConeGeometry(0.017, 0.045, 4),
      color: skinShade,
      position: [0, 0.094, 0.104],
      rotation: [Math.PI / 2, 0, Math.PI / 4],
    },
    { geometry: box(0.032, 0.006, 0.006), color: LIPS, position: [0, 0.052, 0.088] },
    ...[-1, 1].flatMap((side): Part[] => [
      {
        geometry: box(0.026, 0.013, 0.006),
        color: EYE_WHITE,
        position: [side * 0.034, 0.118, 0.093],
      },
      { geometry: box(0.012, 0.012, 0.006), color: PUPIL, position: [side * 0.034, 0.118, 0.097] },
      {
        geometry: box(0.034, 0.008, 0.01),
        color: look.hair,
        position: [side * 0.034, 0.138, 0.093],
        rotation: [0, 0, side * -0.1],
      },
      {
        geometry: cylinder(0.022, 0.022, 0.014, 6),
        color: skinShade,
        position: [side * 0.092, 0.104, -0.006],
        rotation: [0, 0, Math.PI / 2],
        scale: [1.25, 1, 0.8],
      },
    ]),
    // Hair: a cap tilted back so the hairline sits high at the front and low at the back.
    {
      geometry: new SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.58),
      color: look.hair,
      position: [0, 0.108, -0.006],
      rotation: [-0.45, 0, 0],
      scale: [0.097, 0.118, 0.108],
    },
  ];
  if (look.mustache) {
    parts.push({
      geometry: box(0.052, 0.012, 0.012),
      color: look.hair,
      position: [0, 0.066, 0.095],
    });
  }
  if (look.build === 'female') {
    parts.push({
      geometry: new SphereGeometry(0.042, 8, 6),
      color: look.hair,
      position: [0, 0.112, -0.104],
    });
  }
  return bake(parts);
}

/** Safety helmet with a front peak and a crown ridge, in head coordinates. */
function helmet(look: AvatarLook): BufferGeometry {
  const peak = new CylinderGeometry(0.13, 0.13, 0.012, 14, 1, false, -Math.PI / 2, Math.PI);
  return bake([
    {
      geometry: new SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      color: look.helmet,
      position: [0, 0.15, 0.004],
      scale: [0.117, 0.098, 0.128],
    },
    {
      geometry: cylinder(0.125, 0.128, 0.012, 14),
      color: look.helmet,
      position: [0, 0.152, 0.004],
      scale: [1, 1, 1.1],
    },
    {
      geometry: peak,
      color: look.helmet,
      position: [0, 0.148, 0.03],
      rotation: [0.12, 0, 0],
      scale: [1, 1, 1.05],
    },
    { geometry: box(0.026, 0.022, 0.15), color: shade(look.helmet, 0.88), position: [0, 0.24, 0] },
  ]);
}

/** Upper arm (shirt sleeve), from the shoulder joint. */
function upperArm(look: AvatarLook): BufferGeometry {
  return bake([
    {
      geometry: cylinder(0.052, 0.043, RIG.upperArm, 6),
      color: look.shirt,
      position: [0, -RIG.upperArm / 2, 0],
    },
  ]);
}

/** Forearm, cuff and hand, from the elbow joint; `side` is +1 or -1 (the arm's x sign). */
function forearm(look: AvatarLook, side: number): BufferGeometry {
  const f = RIG.forearm;
  const skinShade = shade(look.skin, 0.9);
  return bake([
    {
      geometry: cylinder(0.043, 0.037, f * 0.68, 6),
      color: look.shirt,
      position: [0, -f * 0.34, 0],
    },
    {
      geometry: cylinder(0.04, 0.04, 0.022, 6),
      color: shade(look.shirt, 0.75),
      position: [0, -f * 0.68, 0],
    },
    { geometry: cylinder(0.034, 0.03, f * 0.34, 6), color: look.skin, position: [0, -f * 0.84, 0] },
    // Palm faces the body; fingers curl slightly forward; thumb in front.
    { geometry: box(0.034, 0.09, 0.068), color: look.skin, position: [0, -f - 0.04, 0.004] },
    {
      geometry: box(0.03, 0.045, 0.06),
      color: skinShade,
      position: [0, -f - 0.1, 0.014],
      rotation: [-0.35, 0, 0],
    },
    {
      geometry: box(0.022, 0.05, 0.022),
      color: skinShade,
      position: [-side * 0.01, -f - 0.03, 0.042],
      rotation: [-0.3, 0, 0],
    },
  ]);
}

/** Thigh with a cargo pocket, from the hip joint. */
function thigh(look: AvatarLook, side: number): BufferGeometry {
  return bake([
    {
      geometry: cylinder(0.078, 0.06, RIG.thigh, 7),
      color: look.trousers,
      position: [0, -RIG.thigh / 2, 0],
    },
    {
      geometry: box(0.03, 0.09, 0.075),
      color: shade(look.trousers, 0.82),
      position: [side * 0.07, -0.25, 0.004],
    },
  ]);
}

/** Shin with a reflective band, from the knee joint. */
function shin(look: AvatarLook): BufferGeometry {
  return bake([
    {
      geometry: cylinder(0.06, 0.047, RIG.shin, 7),
      color: look.trousers,
      position: [0, -RIG.shin / 2, 0],
    },
    {
      geometry: cylinder(0.057, 0.055, 0.03, 7),
      color: STRIPE,
      position: [0, -RIG.shin * 0.62, 0],
    },
  ]);
}

/** Safety boot, from the ankle joint (sole bottom at -RIG.ankle). */
function boot(): BufferGeometry {
  return bake([
    { geometry: cylinder(0.054, 0.06, 0.1, 7), color: BOOT, position: [0, 0, 0] },
    { geometry: box(0.1, 0.065, 0.22), color: BOOT, position: [0, -0.05, 0.05] },
    {
      geometry: box(0.098, 0.03, 0.045),
      color: BOOT,
      position: [0, -0.022, 0.13],
      rotation: [0.6, 0, 0],
    },
    {
      geometry: box(0.04, 0.005, 0.08),
      color: shade(BOOT, 1.6),
      position: [0, -0.016, 0.07],
      rotation: [0.25, 0, 0],
    },
    { geometry: box(0.108, 0.022, 0.236), color: SOLE, position: [0, -RIG.ankle + 0.011, 0.05] },
  ]);
}

export interface AvatarGeometry {
  torso: BufferGeometry;
  head: BufferGeometry;
  helmet: BufferGeometry;
  upperArm: BufferGeometry;
  /** Indexed by side: [x < 0, x > 0]. */
  forearm: readonly [BufferGeometry, BufferGeometry];
  thigh: readonly [BufferGeometry, BufferGeometry];
  shin: BufferGeometry;
  boot: BufferGeometry;
}

const cache = new Map<string, AvatarGeometry>();

/** Segment geometries for a look, built once and shared by every avatar that looks the same. */
export function avatarGeometry(look: AvatarLook): AvatarGeometry {
  const key = JSON.stringify(look);
  let geometry = cache.get(key);
  if (geometry == null) {
    geometry = {
      torso: torso(look),
      head: head(look),
      helmet: helmet(look),
      upperArm: upperArm(look),
      forearm: [forearm(look, -1), forearm(look, 1)],
      thigh: [thigh(look, -1), thigh(look, 1)],
      shin: shin(look),
      boot: boot(),
    };
    cache.set(key, geometry);
  }
  return geometry;
}
